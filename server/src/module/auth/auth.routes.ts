import { Router } from "express";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

export const createAuthRouter = (
  authService: AuthService,
  BASE_URL?: string,
): Router => {
  const router = Router();
  const controller = new AuthController(authService);

  router.post("/login", controller.login.bind(controller));

  return router;
};
