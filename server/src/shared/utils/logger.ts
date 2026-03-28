import winston from "winston";
import path from "path";
import fs from "fs";

// 🎯 LOGGER ARCHITECTURE EXPLANATION
//
// Why Winston?
// - Structured logging (JSON for machines)
// - Multiple transports (console, file, network)
// - Log levels (error, warn, info, debug)
// - Child loggers for context
//
// Why separate files?
// - error.log: Only errors for monitoring
// - combined.log: Everything for debugging
// - audit.log: Security/compliance
//
// Why request context?
// - Correlate logs from same request
// - Track user actions
// - Debug production issues

// Create logs directory
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 🎯 Custom log levels
// Lower number = higher priority
const customLevels = {
  levels: {
    error: 0, // Critical errors, app crashes
    warn: 1, // Warnings, potential issues
    info: 2, // Important events (user registered)
    http: 3, // HTTP requests (method, url, status)
    verbose: 4, // More detailed info
    debug: 5, // Debugging info (dev only)
    silly: 6, // Extremely verbose
    audit: 7, // Security/compliance logs
    performance: 8, // Performance metrics
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    verbose: "cyan",
    debug: "blue",
    silly: "grey",
    audit: "white bold",
    performance: "yellow bold",
  },
};

// Apply colors
winston.addColors(customLevels.colors);

// 🎯 Base logger configuration
const baseLogger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.NODE_ENV === "production" ? "info" : "debug",

  // Default metadata added to every log
  defaultMeta: {
    service: process.env.SERVICE_NAME || "api-service",
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  },

  // Format: JSON for machines (parsable by log aggregators)
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),

  transports: [
    // Transport 1: Console (with colors for development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Remove internal metadata for cleaner output
          const { service, environment, ...restMeta } = meta;
          const metaStr = Object.keys(restMeta).length
            ? `\n  ${JSON.stringify(restMeta, null, 2)}`
            : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        }),
      ),
    }),

    // Transport 2: Error log file (only errors)
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // Transport 3: All logs (rotated)
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // Transport 4: Audit log (security/compliance)
    new winston.transports.File({
      filename: path.join(logsDir, "audit.log"),
      level: "audit",
      maxsize: 50 * 1024 * 1024, // 50MB - larger because important
      maxFiles: 1, // Keep only current file for audit
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),

    // Transport 5: Performance log
    new winston.transports.File({
      filename: path.join(logsDir, "performance.log"),
      level: "performance",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],

  // Don't exit on handled exceptions
  exitOnError: false,
});

// 🎯 Context Logger: Adds request/module context
export class ContextLogger {
  constructor(
    private logger: winston.Logger,
    private context: Record<string, any> = {},
  ) {}

  // Create child logger with additional context
  child(additionalContext: Record<string, any>): ContextLogger {
    return new ContextLogger(this.logger, {
      ...this.context,
      ...additionalContext,
    });
  }

  // Log with context
  private log(level: string, message: string, meta?: any) {
    this.logger.log(level, message, {
      ...this.context,
      ...meta,
    });
  }

  // Standard log levels
  error(message: string, meta?: any) {
    this.log("error", message, meta);
  }

  warn(message: string, meta?: any) {
    this.log("warn", message, meta);
  }

  info(message: string, meta?: any) {
    this.log("info", message, meta);
  }

  http(message: string, meta?: any) {
    this.log("http", message, meta);
  }

  debug(message: string, meta?: any) {
    this.log("debug", message, meta);
  }

  // Custom levels
  audit(message: string, meta?: any) {
    this.log("audit", message, meta);
  }

  performance(message: string, meta?: any) {
    this.log("performance", message, meta);
  }

  // 🎯 Performance timing helper
  async time<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.debug(`${label} started`);

    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.performance(`${label} completed`, { duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${label} failed`, { duration: `${duration}ms`, error });
      throw error;
    }
  }
}

// 🎯 Logger Factory: Creates loggers with different contexts
export class LoggerFactory {
  private static baseLogger = baseLogger;

  // Create a module-scoped logger
  static createModuleLogger(moduleName: string): ContextLogger {
    return new ContextLogger(this.baseLogger, {
      module: moduleName,
      logType: "module",
    });
  }

  // Create a request-scoped logger (with requestId)
  static createRequestLogger(
    requestId: string,
    userId?: string,
  ): ContextLogger {
    return new ContextLogger(this.baseLogger, {
      requestId,
      userId,
      logType: "request",
    });
  }

  // Create a service-scoped logger
  static createServiceLogger(serviceName: string): ContextLogger {
    return new ContextLogger(this.baseLogger, {
      service: serviceName,
      logType: "service",
    });
  }

  // Create an audit logger (for security events)
  static createAuditLogger(): ContextLogger {
    return new ContextLogger(this.baseLogger, {
      logType: "audit",
    });
  }

  // Get raw logger (for advanced use)
  static getRawLogger(): winston.Logger {
    return this.baseLogger;
  }
}

// Export a default logger for simple use cases
export const logger = LoggerFactory.createModuleLogger("app");
