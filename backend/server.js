import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import ChatRoutes from "./routes/chat.js";

const app = express();
const port = 8080;

app.use(express.json());
app.use(cors());

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected with database");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
};

connectDB();

app.use("/api", ChatRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
