import { Request, Response, NextFunction } from "express";
import { LoggerFactory } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

// 🎯 Extend Express Request type to include logger
declare global {
  namespace Express {
    interface Request {
      id: string;
      logger: any; // ContextLogger
      startTime: number;
    }
  }
}

// 🎯 Request logging middleware
// This adds a logger to every request with requestId
export function requestLoggerMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate unique request ID
    const requestId = uuidv4();
    req.id = requestId;
    req.startTime = Date.now();

    // Create request-scoped logger
    req.logger = LoggerFactory.createRequestLogger(requestId, req.user?.id);

    // Add request ID to response headers
    res.setHeader("X-Request-ID", requestId);

    // Log request start
    req.logger.http("→ Request started", {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      body: req.method === "POST" ? req.body : undefined, // Be careful with sensitive data
    });

    // 🎯 Capture response finish to log completion
    const originalEnd = res.end;
    const chunks: Buffer[] = [];

    // Intercept response body for logging (optional)
    const originalWrite = res.write;
    res.write = function (chunk: any, ...args: any[]) {
      chunks.push(Buffer.from(chunk));
      return originalWrite.apply(res, [chunk, ...args]);
    };

    res.end = function (chunk?: any, ...args: any[]) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }

      const duration = Date.now() - req.startTime;
      const responseBody = Buffer.concat(chunks).toString("utf8");

      // Log request completion
      req.logger.http("← Request completed", {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength:
          res.get("Content-Length") ||
          chunks.reduce((acc, c) => acc + c.length, 0),
        // Only log response body for errors (for debugging)
        responseBody:
          res.statusCode >= 400 ? responseBody.substring(0, 500) : undefined,
      });

      return originalEnd.apply(res, [chunk, ...args]);
    };

    next();
  };
}
