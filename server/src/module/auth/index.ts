import { Router } from "express";
import { AuthService } from "./auth.service";
import { createAuthRouter } from "./auth.routes";

export interface AuthModule {
  router: Router;
  service: AuthService;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export function initAuthModule(): AuthModule {
  console.log("🔐 Initializing Auth Module");

  const authService = new AuthService();
  const router = createAuthRouter(authService);
  const initialize = async () => {
    console.log("  - Auth module: Connecting to services...");
    console.log("  - Auth module: Ready");
  };

  const cleanup = async () => {
    console.log("  - Auth module: Cleaning up...");
  };
  return {
    router,
    service: authService,
    initialize,
    cleanup,
  };
}
