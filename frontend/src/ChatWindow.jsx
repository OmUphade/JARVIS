import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState } from "react";
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
  const [selectedFiles, setSelectedFiles] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getReply = async () => {
    if (!prompt.trim() && selectedFiles.length === 0) return;
    
    const userPrompt = prompt;
    const filesToSend = [...selectedFiles];
    
    setPrompt(""); // Clear input box immediately for responsive feel
    setSelectedFiles([]); // Clear previews
    setNewChat(false);
    setLoading(true);

    // Create attachments metadata array for user message rendering immediately
    const attachmentsPreview = filesToSend.map(file => ({
      fileName: file.name,
      mimeType: file.type,
      fileUrl: URL.createObjectURL(file), // Local temporary preview object URL
      sizeBytes: file.size
    }));

    // Append user message immediately to the UI chat
    setPrevChats((prev) => [
      ...prev,
      { role: "user", content: userPrompt, attachments: attachmentsPreview }
    ]);

    const formData = new FormData();
    formData.append("threadId", currThreadId);
    formData.append("message", userPrompt);
    filesToSend.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
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

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Logout failed:", err);
    }
    localStorage.removeItem("accessToken");
    window.location.reload();
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
            <i className="fa-solid fa-gear"></i> Settings
          </div>
          <div className="dropDownItem">
            <i className="fa-solid fa-cloud-arrow-up"></i> Upgrade plan
          </div>
          <div className="dropDownItem" onClick={handleLogout}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Log out
          </div>
        </div>
      )}
      
      <Chat></Chat>

      <ScaleLoader color="#fff" loading={loading}></ScaleLoader>

      <div className="chatInput">
        {selectedFiles.length > 0 && (
          <div className="filePreviews">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="previewItem">
                <i className="fa-solid fa-file-arrow-up fileIcon"></i>
                <span className="previewName">{file.name}</span>
                <i className="fa-solid fa-xmark removeFile" onClick={() => removeFile(idx)}></i>
              </div>
            ))}
          </div>
        )}

        <div className="inputBox">
          <label htmlFor="file-upload" className="clipIcon">
            <i className="fa-solid fa-paperclip"></i>
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <input
            placeholder="Ask anything (image, audio, video)..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? getReply() : "")}
          />
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
