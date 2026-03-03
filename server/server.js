// File: server/server.js

import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// ─── Connect to Database ───────────────────────────────────────────────────
await connectDB();

// ─── App Initialisation ────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ─── Core Middleware ───────────────────────────────────────────────────────

// CORS — only allow configured origins
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_ORIGIN || "http://localhost:5173",
      "http://localhost:3000",
    ];
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin "${origin}" is not allowed.`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: "10kb" }));          // JSON body limit
app.use(express.urlencoded({ extended: true }));   // Form-urlencoded support

// HTTP request logging (dev: coloured, production: combined)
if (NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status:  "healthy",
    env:     NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────
app.use("/api/products", productRoutes);
app.use("/api/orders",   orderRoutes);

// ─── API root ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "StrikeGreen API is running.",
    version: "1.0.0",
    docs: {
      products: "/api/products",
      orders:   "/api/orders",
      health:   "/health",
    },
  });
});

// ─── Error Handling ────────────────────────────────────────────────────────
app.use(notFound);     // 404 — must come after all routes
app.use(errorHandler); // 500 — global error handler

// ─── Start Server ──────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🚀  StrikeGreen API running`);
  console.log(`   Mode:    ${NODE_ENV}`);
  console.log(`   Port:    ${PORT}`);
  console.log(`   URL:     http://localhost:${PORT}\n`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully…`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  // Force shutdown after 10s if connections are still open
  setTimeout(() => {
    console.error("Forcing shutdown after timeout.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions — log and exit (let process manager restart)
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  server.close(() => process.exit(1));
});

export default app;
