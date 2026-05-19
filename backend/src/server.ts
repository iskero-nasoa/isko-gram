import express from "express";
import http from "http";
import cors from "cors";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chats";
import messageRoutes from "./routes/messages";
import uploadRoutes from "./routes/upload";
import userRoutes from "./routes/users";
import groupRoutes from "./routes/groups";
import supergroupRoutes from "./routes/supergroups";
import { initSocket } from "./config/socket";
import path from "path";
import multer from "multer";

const app = express();
const server = http.createServer(app);
initSocket(server);

// Middleware
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));

// Serve static uploads with correct MIME types for audio
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".webm") && filePath.includes("/audio/")) {
        res.setHeader("Content-Type", "audio/webm");
      }
    },
  })
);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/supergroups", supergroupRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("🔥 Global Error Handler:", err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max 5MB allowed." });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }

  res.status(err.status || 500).json({ 
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

// Start server
async function start() {
  await connectDatabase();

  server.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📝 Environment: ${env.NODE_ENV}`);
    console.log(`🌐 CORS origin: ${env.CORS_ORIGIN}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

export { app, server };
