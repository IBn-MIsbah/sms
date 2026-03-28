import { Router } from "express";
import { AuthService } from "./auth.service";
import { createAuthRouter } from "./auth.routes";
import { LoggerFactory } from "../../shared/utils/logger";
import { prisma } from "../../shared/prisma";

export interface AuthModule {
  router: Router;
  service: AuthService;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export function initAuthModule(): AuthModule {
  const logger = LoggerFactory.createModuleLogger("AuthModule");
  logger.info("Initailizing Auth Module");

  const authService = new AuthService();
  const router = createAuthRouter(authService);
  const initialize = async () => {
    logger.info("Starting Auth Module initialization...");
    await prisma.$queryRaw`SELECT 1`;
    logger.debug("Database connection verified");

    logger.debug("Auth module ready");
  };

  logger.info("Auth Module initialized successfully");

  const cleanup = async () => {
    logger.info("Cleaning up Auth Module...");
    // Close connections, clear sessions, etc.
    logger.info("Auth Module cleaned up");
  };
  return {
    router,
    service: authService,
    initialize,
    cleanup,
  };
}
