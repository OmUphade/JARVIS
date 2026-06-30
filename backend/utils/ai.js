import { config } from "../config/config.js";

const geminiAPIResponse = async (message) => {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.geminiApiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await response.json();
    
    // Check if the API returned an error
    if (!response.ok) {
      if (data.error && data.error.message) {
        return `API Error (${response.status}): ${data.error.message}`;
      } else if (Array.isArray(data) && data[0]?.error?.message) {
        return `API Error (${response.status}): ${data[0].error.message}`;
      }
      return `API Error (${response.status}): Exceeded quota or service unavailable.`;
    }

    const reply = data?.choices?.[0]?.message?.content;
    return reply || "No response from Gemini.";
  } catch (error) {
    console.error(error);
    return "Network error or failure reaching the Gemini API.";
  }
};

export default geminiAPIResponse;
