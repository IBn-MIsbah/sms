import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { registerModules } from "./module/modules";
import { LoggerFactory } from "./shared/utils/logger";
import { requestLoggerMiddleware } from "./shared/middleware/request-logger";
import { errorHandler } from "./shared/middleware/error-handler";

const BASE_URL = process.env.BASE_URL;
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "PRODUCTION";

export const createApp = async () => {
  const app = express();
  const logger = LoggerFactory.createModuleLogger("App");

  logger.info("Creating Express application");

  app.use(requestLoggerMiddleware());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: isProduction ? BASE_URL : "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message:
        "Too many requests from this IP, please try again after 15 minutes",
    },
  });

  app.use(limiter);
  app.use(cookieParser());

  app.get("/health", (req: Request, res: Response) => {
    req.logger.info("Health check requested");
    res.status(200).json({
      success: true,
      message: "Health check passed",
      timestamp: new Date().toISOString(),
    });
  });

  const modules = await registerModules(app);

  // -------404 Handler-------------
  app.use((req: Request, res: Response) => {
    req.logger.warn("Route not found", { url: req.originalUrl });
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
    });
  });
  app.use(errorHandler);
  logger.info("Application configured successfully");

  return { app, modules };
};
