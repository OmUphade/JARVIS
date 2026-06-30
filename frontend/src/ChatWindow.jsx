import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import { ScaleLoader } from "react-spinners";

function ChatWindow() {
  const {
    prompt,
    setPrompt,
    currThreadId,
    setPrevChats,
    setNewChat,
    streamingReply,
    setStreamingReply,
  } = useContext(MyContext);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
 
  const getReply = async () => {
    if (!prompt.trim()) return;
    
    const userPrompt = prompt;
    setPrompt(""); // Clear input box immediately for responsive feel
    setNewChat(false);
    setLoading(true);

    // Append user message immediately to the UI chat
    setPrevChats((prev) => [
      ...prev,
      { role: "user", content: userPrompt }
    ]);

    const formData = new FormData();
    formData.append("threadId", currThreadId);
    formData.append("message", userPrompt);

    try {
      const response = await fetch("http://localhost:8080/api/v1/chat/stream", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setLoading(false); // Disable spinner once stream begins

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedReply = "";
      setStreamingReply("");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulatedReply += parsed.text;
                setStreamingReply(accumulatedReply);
              } else if (parsed.error) {
                accumulatedReply += `\n\n⚠️ ${parsed.error}`;
                setStreamingReply(accumulatedReply);
              }
            } catch (e) {
              // Ignore partial JSON parse errors
            }
          }
        }
      }

      // Commit full assistant reply to memory once finished
      setPrevChats((prev) => [
        ...prev,
        { role: "assistant", content: accumulatedReply }
      ]);
      setStreamingReply("");

    } catch (err) {
      console.error("Streaming error:", err);
      setLoading(false);
      setPrevChats((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Sorry, I couldn't connect to the backend server. Please check if your backend and database are running properly."
        }
      ]);
      setStreamingReply("");
    }
  };

  const handleProfileClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="chatWindow">
      <div className="navbar">
        <span>
          JARVIS <i className="fa-solid fa-chevron-down"></i>
        </span>
        <div className="userIconDiv" onClick={handleProfileClick}>
          <span className="userIcon">
            <i className="fa-solid fa-user"></i>
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="dropDown">
          <div className="dropDownItem">
            <i class="fa-solid fa-gear"></i> Settings
          </div>
          <div className="dropDownItem">
            <i class="fa-solid fa-cloud-arrow-up"></i> Upgrade plan
          </div>
          <div className="dropDownItem">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Log out
          </div>
        </div>
      )}
      <Chat></Chat>

      <ScaleLoader color="#fff" loading={loading}></ScaleLoader>

      <div className="chatInput">
        <div className="inputBox">
          <input
            placeholder="Ask anything"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? getReply() : "")}
          ></input>
          <div id="submit" onClick={getReply}>
            <i className="fa-solid fa-paper-plane"></i>
          </div>
        </div>
        <p className="info">
          JARVIS can make mistakes. Check important info. See Cookie
          Preferences.
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;
