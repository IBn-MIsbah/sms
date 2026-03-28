import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "../errors/custom-errors";
import { Prisma } from "../../../generated/prisma/client";

// 🎯 Error handler middleware
// This is the LAST middleware in the chain
// It catches ALL errors and sends appropriate responses

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Get logger from request (or fallback to console)
  const logger = req.logger || console;

  // Log the error with full context
  logger.error("Error occurred", {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      meta: err.meta,
    },
    request: {
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      userId: req.user?.id,
      requestId: req.id,
    },
  });

  // 🎯 Handle known error types
  // Order matters: more specific first, then generic

  // 1. Custom App Errors (our own error classes)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err instanceof ValidationError && { errors: err.errors }),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: formattedErrors,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // 3. Prisma Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const handledPrismaError = handlePrismaError(err);
    return res.status(handledPrismaError.statusCode).json({
      success: false,
      message: handledPrismaError.message,
      ...(handledPrismaError.details && {
        details: handledPrismaError.details,
      }),
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
        prismaCode: err.code,
      }),
    });
  }

  // 4. Prisma Client Validation Errors (type mismatches, etc.)
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: "Invalid data provided to database",
      ...(process.env.NODE_ENV === "development" && {
        details: err.message,
        stack: err.stack,
      }),
    });
  }

  // 5. Prisma Initialization Errors (connection issues)
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error("Database connection error", { error: err.message });
    return res.status(503).json({
      success: false,
      message: "Database connection error. Please try again later.",
    });
  }

  // 6. JWT Errors
  //   if (err instanceof JsonWebTokenError) {
  //     return res.status(401).json({
  //       success: false,
  //       message: "Invalid or malformed token",
  //     });
  //   }

  //   if (err instanceof TokenExpiredError) {
  //     return res.status(401).json({
  //       success: false,
  //       message: "Token expired. Please login again",
  //     });
  //   }

  // 7. Rate Limit Errors (if using express-rate-limit)
  if (err.name === "RateLimitError" || err.statusCode === 429) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
    });
  }

  // 8. Syntax Errors (invalid JSON, etc.)
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }

  // 9. Multer Errors (file upload)
  if (err.name === "MulterError") {
    const multerErrors: Record<string, string> = {
      LIMIT_FILE_SIZE: "File too large",
      LIMIT_FILE_COUNT: "Too many files",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field",
      LIMIT_FIELD_KEY: "Field name too long",
      LIMIT_FIELD_VALUE: "Field value too long",
      LIMIT_FIELD_COUNT: "Too many fields",
      LIMIT_PART_COUNT: "Too many parts",
    };

    return res.status(400).json({
      success: false,
      message: multerErrors[err.code] || "File upload error",
    });
  }

  // 10. Unhandled Errors (catch-all)
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  // Don't expose internal errors in production
  const responseMessage =
    process.env.NODE_ENV === "production" && statusCode === 500
      ? "An unexpected error occurred"
      : message;

  res.status(statusCode).json({
    success: false,
    message: responseMessage,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      originalError: err.message,
    }),
  });
}

// 🎯 Helper function to handle specific Prisma errors
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  details?: any;
} {
  // Prisma error codes reference:
  // https://www.prisma.io/docs/reference/api-reference/error-reference

  switch (error.code) {
    // P2000: Value too long for column
    case "P2000":
      return {
        statusCode: 400,
        message: "Input value is too long",
        details: error.meta,
      };

    // P2001: Record not found
    case "P2001":
      return {
        statusCode: 404,
        message: "Record not found",
        details: error.meta,
      };

    // P2002: Unique constraint failed
    case "P2002":
      const field = error.meta?.target as string[];
      return {
        statusCode: 409,
        message: `A record with this ${field?.join(", ")} already exists`,
        details: { field: field?.join(", ") },
      };

    // P2003: Foreign key constraint failed
    case "P2003":
      return {
        statusCode: 400,
        message: "Related record not found",
        details: error.meta,
      };

    // P2004: Constraint failed on database
    case "P2004":
      return {
        statusCode: 400,
        message: "Database constraint failed",
        details: error.meta,
      };

    // P2005: Invalid value for field
    case "P2005":
      return {
        statusCode: 400,
        message: "Invalid value provided",
        details: error.meta,
      };

    // P2006: Invalid value for field
    case "P2006":
      return {
        statusCode: 400,
        message: "Invalid data format",
        details: error.meta,
      };

    // P2007: Data validation error
    case "P2007":
      return {
        statusCode: 400,
        message: "Data validation error",
        details: error.meta,
      };

    // P2008: Query parsing error
    case "P2008":
      return {
        statusCode: 500,
        message: "Query parsing error",
        details: error.meta,
      };

    // P2009: Query validation error
    case "P2009":
      return {
        statusCode: 400,
        message: "Invalid query",
        details: error.meta,
      };

    // P2010: Raw query error
    case "P2010":
      return {
        statusCode: 500,
        message: "Database query failed",
        details: error.meta,
      };

    // P2011: Null constraint violation
    case "P2011":
      return {
        statusCode: 400,
        message: "Required field is missing",
        details: error.meta,
      };

    // P2012: Missing required value
    case "P2012":
      return {
        statusCode: 400,
        message: "Missing required field",
        details: error.meta,
      };

    // P2013: Missing required argument
    case "P2013":
      return {
        statusCode: 400,
        message: "Missing required argument",
        details: error.meta,
      };

    // P2014: Invalid relation
    case "P2014":
      return {
        statusCode: 400,
        message: "Invalid relation",
        details: error.meta,
      };

    // P2015: Related record not found
    case "P2015":
      return {
        statusCode: 404,
        message: "Related record not found",
        details: error.meta,
      };

    // P2016: Query interpretation error
    case "P2016":
      return {
        statusCode: 500,
        message: "Query interpretation error",
        details: error.meta,
      };

    // P2017: Records not connected
    case "P2017":
      return {
        statusCode: 400,
        message: "Records are not connected",
        details: error.meta,
      };

    // P2018: Connected records not found
    case "P2018":
      return {
        statusCode: 404,
        message: "Connected records not found",
        details: error.meta,
      };

    // P2019: Input error
    case "P2019":
      return {
        statusCode: 400,
        message: "Invalid input",
        details: error.meta,
      };

    // P2020: Value out of range
    case "P2020":
      return {
        statusCode: 400,
        message: "Value out of range",
        details: error.meta,
      };

    // P2021: Table not found
    case "P2021":
      return {
        statusCode: 500,
        message: "Database table not found",
        details: error.meta,
      };

    // P2022: Column not found
    case "P2022":
      return {
        statusCode: 500,
        message: "Database column not found",
        details: error.meta,
      };

    // P2023: Inconsistent column data
    case "P2023":
      return {
        statusCode: 400,
        message: "Inconsistent column data",
        details: error.meta,
      };

    // P2024: Connection pool timeout
    case "P2024":
      return {
        statusCode: 503,
        message: "Database connection pool timeout",
        details: error.meta,
      };

    // P2025: Record not found for update/delete
    case "P2025":
      return {
        statusCode: 404,
        message: "Record not found",
        details: error.meta,
      };

    // P2026: Unsupported feature
    case "P2026":
      return {
        statusCode: 500,
        message: "Unsupported database feature",
        details: error.meta,
      };

    // P2027: Multiple errors
    case "P2027":
      return {
        statusCode: 500,
        message: "Multiple database errors occurred",
        details: error.meta,
      };

    // P2028: Transaction error
    case "P2028":
      return {
        statusCode: 500,
        message: "Database transaction error",
        details: error.meta,
      };

    // Default: Unknown Prisma error
    default:
      return {
        statusCode: 500,
        message: "Database error occurred",
        details: { code: error.code },
      };
  }
}
