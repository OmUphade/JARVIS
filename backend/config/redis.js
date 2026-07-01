import Redis from "ioredis";
import { config } from "./config.js";
import logger from "../utils/logger.js";

const redisUrl = config.cloudinaryUrl || process.env.REDIS_URL || "redis://127.0.0.1:6379";

export let isRedisAvailable = false;
export let redisConnection = null;

let loggedError = false;

try {
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000, // 2 seconds timeout to fail fast locally
    retryStrategy(times) {
      if (times > 3) {
        // End reconnecting to prevent infinite warning loops
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  redisConnection.on("connect", () => {
    isRedisAvailable = true;
    logger.info("Connected to Redis successfully.");
  });

  redisConnection.on("error", (err) => {
    isRedisAvailable = false;
    if (!loggedError) {
      logger.warn(`Redis connection failed (using in-memory fallback): ${err.message}`);
      loggedError = true;
    }
  });
} catch (e) {
  isRedisAvailable = false;
  logger.warn(`Failed to initialize Redis client: ${e.message}`);
}
