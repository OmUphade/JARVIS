import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/config.js";
import fs from "fs";
import logger from "./logger.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Helper to convert local file to GenerativePart object
 * @param {string} path Local file path
 * @param {string} mimeType File MIME type
 * @returns {Object} GenerativePart for Gemini
 */
const fileToGenerativePart = (path, mimeType) => {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
};

/**
 * Send prompts and optional files to Gemini
 * @param {string} message Text message prompt
 * @param {Array<Object>} files Array of uploaded Express file objects
 * @returns {Promise<string>} Gemini response content
 */
const geminiAPIResponse = async (message, files = []) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const contents = [message];

    // Append files as parts if any exist
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        const filePart = fileToGenerativePart(file.path, file.mimetype);
        contents.push(filePart);
      }
    }

    const result = await model.generateContent(contents);
    const response = await result.response;
    const reply = response.text();

    return reply || "No response from Gemini.";
  } catch (error) {
    logger.error(`Gemini API Error: ${error.message}`);
    return `API Error: ${error.message}`;
  }
};

/**
 * Generate stream response from Gemini API
 * @param {string} message Text message prompt
 * @param {Array<Object>} files Uploaded files
 * @returns {Promise<Object>} Mapped result stream from Gemini
 */
export const geminiAPIStreamResponse = async (message, files = []) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const contents = [message];

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      contents.push(fileToGenerativePart(file.path, file.mimetype));
    }
  }

  return model.generateContentStream(contents);
};

export default geminiAPIResponse;
