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
import Thread from "./models/Thread.js";
import Message from "./models/Message.js";

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

connectDB().then(async () => {
  // Trigger soft delete database cleanup task directly on startup
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const threadsRes = await Thread.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: thirtyDaysAgo },
    });

    const messagesRes = await Message.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: thirtyDaysAgo },
    });

    if (threadsRes.deletedCount > 0 || messagesRes.deletedCount > 0) {
      logger.info(`[Cleanup Task] Cleaned up ${threadsRes.deletedCount} threads and ${messagesRes.deletedCount} messages.`);
    }
  } catch (error) {
    logger.error(`Database cleanup task failed: ${error.message}`);
  }
});

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      const isAllowed =
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.endsWith(".vercel.app") ||
        (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL);

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`Origin blocked by CORS: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
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
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to the JARVIS API.",
    documentation: "/api/v1/docs",
    health: "/api/v1/health"
  });
});

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1", ChatRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`${err.message} - ${err.stack}`);
  return sendError(res, "An unexpected error occurred on the server.", "INTERNAL_SERVER_ERROR", 500);
});

app.listen(config.port, "0.0.0.0", () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
});
