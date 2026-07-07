import "./App.css";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import Auth from "./Auth";
import { MyContext } from "./MyContext";
import { useState } from "react";
import { v1 as uuidv1 } from "uuid";

function App() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [currThreadId, setCurrThreadId] = useState(uuidv1);
  const [prevChats, setPrevChats] = useState([]); //stores all chats of threads
  const [newChat, setNewChat] = useState(true); //to indicate new chat creation
  const [allThreads, setAllThreads] = useState([]);
  const [streamingReply, setStreamingReply] = useState("");
  const [token, setToken] = useState(localStorage.getItem("accessToken"));

  // Resilient, auto-refreshing fetch wrapper
  const authenticatedFetch = async (url, options = {}) => {
    let API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";
    if (API_URL && !API_URL.includes("/api/v1")) {
      API_URL = `${API_URL.replace(/\/$/, "")}/api/v1`;
    }

    const normalizedUrl = url.startsWith("http")
      ? url
      : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;

    options.headers = options.headers || {};
    let accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      options.headers["Authorization"] = `Bearer ${accessToken}`;
    }
    options.credentials = "include"; // Send refresh token HttpOnly cookies

    let response = await fetch(normalizedUrl, options);

    // If access token has expired (401), perform silent token refresh
    if (response.status === 401) {
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (refreshRes.ok) {
          const resJson = await refreshRes.json();
          if (resJson.success && resJson.data.accessToken) {
            const newAccessToken = resJson.data.accessToken;
            localStorage.setItem("accessToken", newAccessToken);
            setToken(newAccessToken);

            // Retry original request with new access token
            options.headers["Authorization"] = `Bearer ${newAccessToken}`;
            response = await fetch(normalizedUrl, options);
          }
        } else {
          // Refresh token expired -> force logout
          localStorage.removeItem("accessToken");
          setToken(null);
        }
      } catch (err) {
        console.error("Token refresh failed:", err);
        localStorage.removeItem("accessToken");
        setToken(null);
      }
    }

    return response;
  };

  const providerValue = {
    prompt,
    setPrompt,
    reply,
    setReply,
    currThreadId,
    setCurrThreadId,
    newChat,
    setNewChat,
    prevChats,
    setPrevChats,
    allThreads,
    setAllThreads,
    streamingReply,
    setStreamingReply,
    authenticatedFetch, // Expose API client to all components
  };

  if (!token) {
    return <Auth onAuthSuccess={(t) => setToken(t)} />;
  }

  return (
    <div className="app">
      <MyContext.Provider value={providerValue}>
        <Sidebar></Sidebar>
        <ChatWindow></ChatWindow>
      </MyContext.Provider>
    </div>
  );
}

export default App;
