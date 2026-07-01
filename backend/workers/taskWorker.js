import { Worker } from "bullmq";
import { isRedisAvailable, redisConnection } from "../config/redis.js";
import logger from "../utils/logger.js";
import Thread from "../models/Thread.js";
import Message from "../models/Message.js";

const QUEUE_NAME = "task-queue";

/**
 * Core Job Processor
 * @param {Object} job BullMQ or Mock job object
 */
export const processJob = async (job) => {
  logger.info(`Starting background job processing: ${job.name}`);
  const startTime = Date.now();

  try {
    switch (job.name) {
      case "cleanup-soft-deleted": {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Delete threads
        const threadsRes = await Thread.deleteMany({
          isDeleted: true,
          deletedAt: { $lte: thirtyDaysAgo },
        });

        // Delete messages
        const messagesRes = await Message.deleteMany({
          isDeleted: true,
          deletedAt: { $lte: thirtyDaysAgo },
        });

        logger.info(
          `[Cleanup Job] Cleaned up ${threadsRes.deletedCount} threads and ${messagesRes.deletedCount} messages.`
        );
        break;
      }
      case "generate-chat-summary": {
        const { threadId } = job.data;
        logger.info(`[Summary Job] Generating summary for thread: ${threadId}`);
        // Simulate a heavy task
        await new Promise((resolve) => setTimeout(resolve, 3000));
        logger.info(`[Summary Job] Finished summary generation for thread: ${threadId}`);
        break;
      }
      default:
        logger.warn(`Unknown job name: ${job.name}`);
    }

    const duration = Date.now() - startTime;
    logger.info(`Finished background job: ${job.name} in ${duration}ms`);
  } catch (error) {
    logger.error(`Failed background job ${job.name}: ${error.message}`);
    throw error;
  }
};

// Initialize BullMQ Worker if Redis is online
let taskWorker = null;

if (isRedisAvailable) {
  taskWorker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
  });

  taskWorker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed successfully.`);
  });

  taskWorker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
  });

  logger.info(`Initialized BullMQ worker: ${QUEUE_NAME}`);
}

export default taskWorker;
