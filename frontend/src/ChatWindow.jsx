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
    authenticatedFetch,
  } = useContext(MyContext);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Base64 JWT parser helper
  const parseJwt = (token) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const token = localStorage.getItem("accessToken");
  const decoded = token ? parseJwt(token) : null;
  const isGuestUser = decoded?.role === "guest" || localStorage.getItem("isGuest") === "true";
  const userEmail = decoded?.email || (isGuestUser ? "Temporary Guest" : "user@jarvis.local");

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

    // Create attachments preview
    const attachmentsPreview = filesToSend.map(file => ({
      fileName: file.name,
      mimeType: file.type,
      fileUrl: URL.createObjectURL(file),
    }));

    // Render user message immediately
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
      const response = await authenticatedFetch("/chat/stream", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMsg = `HTTP error! status: ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error?.message) {
            errMsg = errData.error.message;
          }
        } catch (_) {
          // Ignore if body is not JSON
        }
        throw new Error(errMsg);
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
      const isFetchError = err.message === "Failed to fetch" || err.message === "NetworkError when attempting to fetch resource.";
      
      let errorMsg = err.message;
      if (isFetchError) {
        errorMsg = "Connection to the server failed. The server might be waking up from sleep mode (Render free tier servers sleep after inactivity). Please try sending your message again in 15-30 seconds.";
      } else {
        // User-friendly error message mapping
        const msgLower = errorMsg.toLowerCase();
        if (msgLower.includes("quota") || msgLower.includes("429") || msgLower.includes("rate limit") || msgLower.includes("rate_limit")) {
          errorMsg = "Gemini API Quota Exceeded: The free tier request limit has been reached. Please wait a few minutes before trying again or configure a billing plan.";
        } else if (msgLower.includes("api key") || msgLower.includes("api_key") || msgLower.includes("invalid key")) {
          errorMsg = "Invalid API Key: The Gemini developer key configuration on the server is invalid. Please check your credentials.";
        } else if (msgLower.includes("bad request") || msgLower.includes("400")) {
          errorMsg = "Bad Request: The AI service could not interpret this request format. Try rephrasing your prompt.";
        } else {
          errorMsg = errorMsg.replace(/^Error:\s*/i, "");
        }
      }
      
      setPrevChats((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMsg.startsWith("⚠️") ? errorMsg : `⚠️ ${errorMsg}`
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
      await authenticatedFetch("/auth/logout", {
        method: "POST",
      });
    } catch (err) {
      console.error("Logout failed:", err);
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("isGuest");
    localStorage.removeItem("guestUserId");
    window.location.reload();
  };

  const handleUpgrade = () => {
    const guestId = localStorage.getItem("guestUserId");
    if (guestId) {
      localStorage.setItem("upgradeGuestId", guestId);
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("isGuest");
    localStorage.removeItem("guestUserId");
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
            <i className={isGuestUser ? "fa-solid fa-user-secret" : "fa-solid fa-user"}></i>
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="profileDropdownCard">
          <div className="profileHeader">
            <div className="profileAvatar">
              <i className={isGuestUser ? "fa-solid fa-user-secret" : "fa-solid fa-user"}></i>
            </div>
            <div className="profileInfo">
              <p className="profileEmail" title={userEmail}>{userEmail}</p>
              <span className={`profileRoleBadge ${isGuestUser ? 'guestRole' : 'memberRole'}`}>
                {isGuestUser ? 'Guest Session' : 'Member Account'}
              </span>
            </div>
          </div>

          <div className="profileDivider"></div>

          <div className="profileActions">
            {isGuestUser && (
              <button onClick={handleUpgrade} className="profileUpgradeBtn">
                <i className="fa-solid fa-cloud-arrow-up"></i> Sign Up to Save Chats
              </button>
            )}
            <button onClick={handleLogout} className="profileLogoutBtn">
              <i className="fa-solid fa-right-from-bracket"></i> {isGuestUser ? "End Session" : "Log Out"}
            </button>
          </div>
        </div>
      )}

      {/* Render chats here */}
      <Chat />

      {/* Input section */}
      <div className="chatInput">
        {selectedFiles.length > 0 && (
          <div className="filePreviews">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="previewItem">
                <i className="fa-solid fa-file fileIcon"></i>
                <span className="previewName" title={file.name}>
                  {file.name}
                </span>
                <i
                  className="fa-solid fa-xmark removeFile"
                  onClick={() => removeFile(idx)}
                ></i>
              </div>
            ))}
          </div>
        )}

        <div className="inputBox">
          {/* File selector input */}
          <label htmlFor="file-upload" className="clipIcon">
            <i className="fa-solid fa-paperclip"></i>
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          <input
            type="text"
            placeholder="Ask JARVIS..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") getReply();
            }}
          />

          {loading ? (
            <div id="submit" style={{ cursor: "default" }}>
              <ScaleLoader color="#e2e8f0" height={15} width={2} margin={1} />
            </div>
          ) : (
            <div id="submit" onClick={getReply}>
              <i className="fa-solid fa-arrow-up"></i>
            </div>
          )}
        </div>
        <p className="info">
          JARVIS can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;
