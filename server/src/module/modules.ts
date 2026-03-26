import { Application, Router } from "express";
import { initAuthModule } from "./auth";

export interface RegisterModule {
  name: string;
  router?: Router;
  service?: any;
  initialize: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const registerModules = async (
  app: Application,
): Promise<Map<string, RegisterModule>> => {
  const modules = new Map<string, RegisterModule>();
  const API_VERSION = "v1";
  const API_PREFIX = `/api/${API_VERSION}`;

  console.log("\n📦 Registering modules...\n");
  console.log("1. Loading Auth module...");

  const authModule = initAuthModule();
  modules.set("auth", {
    name: "auth",
    router: authModule.router,
    service: authModule.service,
    initialize: authModule.initialize,
    cleanup: authModule.cleanup,
  });

  app.use(`${API_PREFIX}/auth`, authModule.router);

  console.log("\n✅ All modules registered successfully\n");

  return modules;
};
