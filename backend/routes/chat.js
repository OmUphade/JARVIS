import express from "express";
import Thread from "../models/Thread.js";
import geminiAPIResponse from "../utils/ai.js";

const router = express.Router();

// Test route
router.post("/test", async (req, res) => {
  try {
    const thread = new Thread({
      threadId: "xyz",
      title: "testing New Thread",
    });

    const response = await thread.save();
    res.send(response);
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to save in database");
  }
});

// Fetch all threads
router.get("/thread", async (req, res) => {
  try {
    const threads = await Thread.find({});
    res.json(threads);
  } catch (error) {
    console.log(error);
    res.status(500).send("Failed to fetch threads");
  }
});

// Fetch a thread's messages
router.get("/thread/:threadId", async (req, res) => {
  const { threadId } = req.params;

  try {
    const thread = await Thread.findOne({ threadId });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json(thread.messages);
  } catch (error) {
    console.log(error);
    res.status(500).send("Failed to fetch chat");
  }
});

// Delete a thread
router.delete("/thread/:threadId", async (req, res) => {
  const { threadId } = req.params;

  try {
    const deletedThread = await Thread.findOneAndDelete({ threadId });

    if (!deletedThread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({ success: "Thread deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send("Failed to delete thread");
  }
});

// Chat route
router.post("/chat", async (req, res) => {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    let thread = await Thread.findOne({ threadId });

    if (!thread) {
      // Create new thread
      thread = new Thread({
        threadId,
        title: message,
        messages: [{ role: "user", content: message }],
      });
    } else {
      // Add user message
      thread.messages.push({ role: "user", content: message });
    }

    // Get AI response
    const assistantReply = await geminiAPIResponse(message);

    // Add AI response
    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = Date.now();

    await thread.save();

    res.json({ reply: assistantReply });
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
  }
});

export default router;
