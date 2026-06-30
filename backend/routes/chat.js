import express from "express";
import Thread from "../models/Thread.js";
import Message from "../models/Message.js";
import geminiAPIResponse from "../utils/ai.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { requireAuth } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Apply requireAuth middleware to protect all chat and thread routes
router.use(requireAuth);

// Fetch all threads for the logged-in user (non-deleted, sorted by updated time)
router.get("/thread", async (req, res) => {
  try {
    const threads = await Thread.find({ userId: req.user.id, isDeleted: false })
      .sort({ updatedAt: -1 });
    
    // Format response to match frontend expectations
    const filteredThreads = threads.map(t => ({
      threadId: t.threadId,
      title: t.title,
    }));

    return sendSuccess(res, filteredThreads);
  } catch (error) {
    logger.error(`Failed to fetch threads for user ${req.user.id}: ${error.message}`);
    return sendError(res, "Failed to fetch threads", "THREAD_FETCH_ERROR", 500);
  }
});

// Fetch a thread's messages
router.get("/thread/:threadId", async (req, res) => {
  const { threadId } = req.params;

  try {
    // Ensure thread belongs to the current user
    const thread = await Thread.findOne({ threadId, userId: req.user.id, isDeleted: false });
    if (!thread) {
      return sendError(res, "Thread not found or access denied", "THREAD_NOT_FOUND", 404);
    }

    const messages = await Message.find({ threadId, isDeleted: false })
      .sort({ createdAt: 1 });

    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    return sendSuccess(res, formattedMessages);
  } catch (error) {
    logger.error(`Failed to fetch thread ${threadId} for user ${req.user.id}: ${error.message}`);
    return sendError(res, "Failed to fetch chat", "CHAT_FETCH_ERROR", 500);
  }
});

// Delete a thread (soft delete)
router.delete("/thread/:threadId", async (req, res) => {
  const { threadId } = req.params;

  try {
    // Ensure thread belongs to current user
    const thread = await Thread.findOneAndUpdate(
      { threadId, userId: req.user.id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );

    if (!thread) {
      return sendError(res, "Thread not found or access denied", "THREAD_NOT_FOUND", 404);
    }

    // Soft delete associated messages
    await Message.updateMany(
      { threadId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );

    logger.info(`User ${req.user.id} soft deleted thread: ${threadId}`);
    return sendSuccess(res, { message: "Thread deleted successfully" });
  } catch (error) {
    logger.error(`Failed to delete thread ${threadId} for user ${req.user.id}: ${error.message}`);
    return sendError(res, "Failed to delete thread", "THREAD_DELETE_ERROR", 500);
  }
});

// Chat route
router.post("/chat", async (req, res) => {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return sendError(res, "Missing required fields", "VALIDATION_ERROR", 400);
  }

  try {
    let thread = await Thread.findOne({ threadId, userId: req.user.id, isDeleted: false });

    if (!thread) {
      // Create new thread linked to logged-in user
      thread = new Thread({
        threadId,
        userId: req.user.id,
        title: message.length > 30 ? `${message.substring(0, 30)}...` : message,
      });
      await thread.save();
      logger.info(`Created new thread ${threadId} for user ${req.user.id}`);
    }

    // Save user message to DB
    const userMsg = new Message({
      threadId,
      role: "user",
      content: message,
    });
    await userMsg.save();

    // Get AI response
    const assistantReply = await geminiAPIResponse(message);

    // Save assistant message to DB
    const assistantMsg = new Message({
      threadId,
      role: "assistant",
      content: assistantReply,
    });
    await assistantMsg.save();

    // Update thread timestamp
    thread.updatedAt = new Date();
    await thread.save();

    return sendSuccess(res, { reply: assistantReply });
  } catch (error) {
    logger.error(`Chat route failed for user ${req.user.id}: ${error.message}`);
    return sendError(res, "Something went wrong processing your request.", "CHAT_PROCESSING_ERROR", 500);
  }
});

export default router;
