import { Queue } from "bullmq";
import { isRedisAvailable, redisConnection } from "../config/redis.js";
import logger from "../utils/logger.js";

const QUEUE_NAME = "task-queue";

let taskQueue = null;

if (isRedisAvailable) {
  taskQueue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
  });
  logger.info(`Initialized BullMQ queue: ${QUEUE_NAME}`);
} else {
  logger.info(`Redis offline. Initialized mock inline queue execution.`);
  
  // Mock queue implementation that runs jobs inline
  taskQueue = {
    add: async (name, data) => {
      logger.info(`[Mock Queue] Adding inline job: ${name}`);
      // Lazy load worker executor to avoid circular dependencies
      const { processJob } = await import("../workers/taskWorker.js");
      try {
        await processJob({ name, data });
      } catch (err) {
        logger.error(`[Mock Queue] Inline job failed: ${err.message}`);
      }
      return { id: "mock-job-id", data };
    },
  };
}

export default taskQueue;
