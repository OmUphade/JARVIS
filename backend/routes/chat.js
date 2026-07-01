import express from "express";
import Thread from "../models/Thread.js";
import Message from "../models/Message.js";
import geminiAPIResponse, { geminiAPIStreamResponse } from "../utils/ai.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import logger from "../utils/logger.js";

const router = express.Router();

// Middleware to handle file uploads safely and catch validation errors
const handleUpload = (req, res, next) => {
  upload.array("files", 5)(req, res, (err) => {
    if (err) {
      logger.error(`Multer upload error: ${err.message}`);
      return sendError(res, err.message, "FILE_UPLOAD_ERROR", 400);
    }
    next();
  });
};

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
      attachments: m.attachments || [],
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

// Chat route supporting text and files (multimodal)
router.post("/chat", handleUpload, async (req, res) => {
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

    // Process attachments from uploaded files
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          fileUrl: `http://localhost:8080/uploads/${file.filename}`,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
      }
    }

    // Save user message to DB
    const userMsg = new Message({
      threadId,
      role: "user",
      content: message,
      attachments,
    });
    await userMsg.save();

    // Get AI response
    const assistantReply = await geminiAPIResponse(message, req.files);

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

// Chat stream route (SSE)
router.post("/chat/stream", handleUpload, async (req, res) => {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return sendError(res, "Missing required fields", "VALIDATION_ERROR", 400);
  }

  try {
    let thread = await Thread.findOne({ threadId, userId: req.user.id, isDeleted: false });

    if (!thread) {
      thread = new Thread({
        threadId,
        userId: req.user.id,
        title: message.length > 30 ? `${message.substring(0, 30)}...` : message,
      });
      await thread.save();
    }

    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          fileUrl: `http://localhost:8080/uploads/${file.filename}`,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
      }
    }

    // Save user message to DB
    const userMsg = new Message({
      threadId,
      role: "user",
      content: message,
      attachments,
    });
    await userMsg.save();

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for Nginx if proxying

    const resultStream = await geminiAPIStreamResponse(message, req.files);
    let fullReply = "";

    for await (const chunk of resultStream.stream) {
      const text = chunk.text();
      fullReply += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    // Save assistant message to DB
    const assistantMsg = new Message({
      threadId,
      role: "assistant",
      content: fullReply,
    });
    await assistantMsg.save();

    // Update thread timestamp
    thread.updatedAt = new Date();
    await thread.save();

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    logger.error(`Streaming failed for user ${req.user.id}: ${error.message}`);
    // If headers are already sent, we cannot send standard json error response. We write custom error event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Streaming disconnected unexpectedly." })}\n\n`);
      return res.end();
    }
    return sendError(res, "Something went wrong in streaming your request.", "STREAM_PROCESSING_ERROR", 500);
  }
});

export default router;
