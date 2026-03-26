import "dotenv/config";
import { createApp } from "./app";

const startServer = async () => {
  try {
    const app = createApp();
    const PORT = Number(process.env.PORT) || 3000;

    const server = (await app).listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    });

    const shutdown = () => {
      console.log("🛑 Shutting down gracefully...");

      server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error("💥 Forced shutdown");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
