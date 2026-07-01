import Redis from "ioredis";
import { config } from "./config.js";
import logger from "../utils/logger.js";

const redisUrl = config.cloudinaryUrl || process.env.REDIS_URL || "redis://127.0.0.1:6379";

export let isRedisAvailable = false;
export let redisConnection = null;

try {
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000, // 2 seconds timeout to fail fast locally
  });

  redisConnection.on("connect", () => {
    isRedisAvailable = true;
    logger.info("Connected to Redis successfully.");
  });

  redisConnection.on("error", (err) => {
    isRedisAvailable = false;
    logger.warn(`Redis connection failed (using in-memory fallback): ${err.message}`);
  });
} catch (e) {
  isRedisAvailable = false;
  logger.warn(`Failed to initialize Redis client: ${e.message}`);
}
