import "dotenv/config";
import { createApp } from "./app";
import { createServer } from "http";
import { AddressInfo } from "net";

interface ServerConfig {
  port: number;
  host?: string;
}
const startServer = async (config: ServerConfig) => {
  let server: any = null;
  try {
    console.log("Creating application...");
    const { app, modules } = await createApp();

    server = createServer(app);
    server.listen(config.port, config.host || "0.0.0.0", () => {
      const address = server.address() as AddressInfo;
      console.log(`
        ╔═══════════════════════════════════════╗
        ║   🚀 Server Started Successfully      ║
        ╠═══════════════════════════════════════╣
        ║ Port:     ${address.port.toString().padEnd(28)}║
        ║ Host:     ${address.address.padEnd(28)}║
        ║ Env:      ${process.env.NODE_ENV?.padEnd(28) || "development".padEnd(28)}║
        ║ PID:      ${process.pid.toString().padEnd(28)}║
        ╚═══════════════════════════════════════╝
      `);
    });

    const shutdown = (signal: string) => {
      console.log(`\n⚠️  Received ${signal}, starting graceful shutdown...`);
      if (server) {
        server.close(async () => {
          console.log("✅ HTTP server closed");

          console.log("✅ Graceful shutdown complete");
          process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          console.error("💥 Forced shutdown");
          process.exit(1);
        }, 10000);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

const config: ServerConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
};

if (isNaN(config.port)) {
  console.error("❌ Invalid PORT environment variable");
  process.exit(1);
}

startServer(config).catch(console.error);
