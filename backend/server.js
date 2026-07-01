import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/config.js";
import logger from "./utils/logger.js";
import { sendSuccess, sendError } from "./utils/response.js";
import ChatRoutes from "./routes/chat.js";
import AuthRoutes from "./routes/auth.js";
import taskQueue from "./queues/taskQueue.js";
import "./workers/taskWorker.js"; // Initialize background worker

const app = express();

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodbUri);
    logger.info("Connected to MongoDB successfully");
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

connectDB().then(() => {
  // Trigger soft delete cleanup task on startup
  taskQueue.add("cleanup-soft-deleted", {});
});

// Security Middlewares
app.use(helmet());
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("public/uploads"));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// Health check endpoint
app.use("/api/v1/health", async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const healthData = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: Date.now(),
    services: {
      database: dbStatus,
    },
  };
  return sendSuccess(res, healthData);
});

// Swagger API Documentation Config
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "JARVIS Production API Documentation",
      version: "1.0.0",
      description: "Complete API specification for authentication, user conversations, streaming, and audit features.",
    },
    servers: [
      {
        url: process.env.BASE_URL ? `${process.env.BASE_URL}/api/v1` : `http://localhost:${config.port}/api/v1`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Version 1 Routes
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1", ChatRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`${err.message} - ${err.stack}`);
  return sendError(res, "An unexpected error occurred on the server.", "INTERNAL_SERVER_ERROR", 500);
});

app.listen(config.port, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
});
