import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Thread from "../models/Thread.js";
import Message from "../models/Message.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("Error: MONGODB_URI environment variable is missing.");
  process.exit(1);
}

const runMigration = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.");

    // 1. Create or Find Default Migrated User
    let defaultUser = await User.findOne({ email: "system@jarvis.local" });
    if (!defaultUser) {
      console.log("Creating default system user for migrated chats...");
      defaultUser = new User({
        email: "system@jarvis.local",
        name: "Default User",
        passwordHash: "migrated_hash_unusable_password",
        isVerified: true,
        role: "user",
      });
      await defaultUser.save();
      console.log(`Created default user: ${defaultUser._id}`);
    } else {
      console.log(`Found default user: ${defaultUser._id}`);
    }

    // 2. Fetch raw threads to check if they have embedded 'messages'
    // Mongoose doesn't return fields not in the schema anymore by default,
    // so we access via .collection to read raw fields.
    const rawThreads = await Thread.collection.find({}).toArray();
    console.log(`Found ${rawThreads.length} threads in total to analyze.`);

    let threadsMigratedCount = 0;
    let messagesCreatedCount = 0;

    for (const rawThread of rawThreads) {
      const updates = {};
      let needsSaving = false;

      // Check if thread needs to be linked to a user
      if (!rawThread.userId) {
        updates.userId = defaultUser._id;
        needsSaving = true;
      }

      // Check if thread has nested messages field
      if (rawThread.messages && Array.isArray(rawThread.messages) && rawThread.messages.length > 0) {
        console.log(`Migrating ${rawThread.messages.length} messages for Thread: ${rawThread.threadId || rawThread._id}`);
        
        for (const msg of rawThread.messages) {
          const newMessage = new Message({
            threadId: rawThread.threadId || String(rawThread._id),
            role: msg.role,
            content: msg.content,
            attachments: [],
            createdAt: msg.timestamp || msg.createdAt || new Date(),
            updatedAt: msg.timestamp || msg.updatedAt || new Date(),
          });
          await newMessage.save();
          messagesCreatedCount++;
        }

        // Mark nested messages array for removal
        updates.$unset = { messages: "" };
        needsSaving = true;
      }

      if (needsSaving) {
        const updateOps = {};
        if (updates.userId) {
          updateOps.$set = { userId: updates.userId };
        }
        if (updates.$unset) {
          updateOps.$unset = updates.$unset;
        }

        // Apply raw updates back to thread document
        await Thread.collection.updateOne({ _id: rawThread._id }, updateOps);
        threadsMigratedCount++;
      }
    }

    console.log(`\nMigration completed successfully:`);
    console.log(`- Threads updated/migrated: ${threadsMigratedCount}`);
    console.log(`- Message documents created: ${messagesCreatedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
