import "dotenv/config";

const geminiAPIResponse = async (message) => {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
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
    const reply = data?.choices?.[0]?.message?.content;

    return reply || "No response from Gemini.";
  } catch (error) {
    console.error(error);
  }
};

export default geminiAPIResponse;
