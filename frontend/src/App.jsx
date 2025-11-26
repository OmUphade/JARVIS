import "./App.css";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
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
