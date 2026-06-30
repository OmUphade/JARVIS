import "./App.css";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import { MyContext } from "./MyContext";
import { useState, useEffect } from "react";
import { v1 as uuidv1 } from "uuid";

function App() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [currThreadId, setCurrThreadId] = useState(uuidv1);
  const [prevChats, setPrevChats] = useState([]); //stores all chats of threads
  const [newChat, setNewChat] = useState(true); //to indicate new chat creation
  const [allThreads, setAllThreads] = useState([]);
  const [streamingReply, setStreamingReply] = useState("");

  useEffect(() => {
    const initDevAuth = async () => {
      if (localStorage.getItem("accessToken")) return;

      const devUser = {
        name: "Dev User",
        email: "devuser@jarvis.local",
        password: "password123",
      };

      try {
        // Register dev user (fails silently if already exists)
        await fetch("http://localhost:8080/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(devUser),
        });
      } catch (err) {
        console.log("Dev registration skipped:", err);
      }

      try {
        // Login and store accessToken
        const response = await fetch("http://localhost:8080/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: devUser.email,
            password: devUser.password,
          }),
        });
        const res = await response.json();
        if (res.success && res.data.accessToken) {
          localStorage.setItem("accessToken", res.data.accessToken);
          window.location.reload();
        }
      } catch (err) {
        console.error("Dev auth failed:", err);
      }
    };

    initDevAuth();
  }, []);

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
  }; // passing values

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
