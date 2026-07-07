import "./Sidebar.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import { v1 as uuidv1 } from "uuid";
import logo from "./assets/jarvis6.png";

function Sidebar() {
  const {
    allThreads,
    setAllThreads,
    currThreadId,
    setNewChat,
    setPrompt,
    setReply,
    setCurrThreadId,
    setPrevChats,
    authenticatedFetch,
  } = useContext(MyContext);

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(15); // Simple pagination state

  const getAllThreads = async () => {
    try {
      const response = await authenticatedFetch("/thread");
      const res = await response.json();
      const filteredData = res.data.map((thread) => ({
        threadId: thread.threadId,
        title: thread.title,
      }));
      setAllThreads(filteredData);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    getAllThreads();
  }, [currThreadId]);

  const createNewChat = () => {
    setNewChat(true);
    setPrompt("");
    setReply(null);
    setCurrThreadId(uuidv1());
    setPrevChats([]);
  };

  const changeThread = async (newThreadId) => {
    setCurrThreadId(newThreadId);

    try {
      const response = await authenticatedFetch(`/thread/${newThreadId}`);
      const res = await response.json();
      console.log(res);
      setPrevChats(res.data);
      setNewChat(false);
      setReply(null);
    } catch (err) {
      console.log(err);
    }
  };

  const deleteThread = async (threadId) => {
    try {
      const response = await authenticatedFetch(`/thread/${threadId}`, {
        method: "DELETE",
      });
      const res = await response.json();
      console.log(res);

      setAllThreads((prev) =>
        prev.filter((thread) => thread.threadId !== threadId)
      );

      if (threadId === currThreadId) {
        createNewChat();
      }
    } catch (err) {
      console.log(err);
    }
  };

  // Local thread search filter
  const filteredThreads = allThreads?.filter((thread) =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Paginated thread subset
  const paginatedThreads = filteredThreads.slice(0, visibleCount);

  return (
    <section className="sidebar">
      <button onClick={createNewChat}>
        <img
          src={logo}
          alt="Jarvis logo"
          className="logo"
        />
        <span>
          <i className="fa-solid fa-pen-to-square"></i>
        </span>
      </button>

      {/* Sidebar search bar */}
      <div className="searchBarContainer">
        <i className="fa-solid fa-magnifying-glass searchIcon"></i>
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebarSearchInput"
        />
      </div>

      <ul className="history">
        {paginatedThreads.map((thread, idx) => (
          <li
            key={idx}
            onClick={(e) => changeThread(thread.threadId)}
            className={thread.threadId === currThreadId ? "highlighted" : " "}
          >
            <span className="threadTitle">{thread.title}</span>
            <i
              className="fa-solid fa-trash"
              onClick={(e) => {
                e.stopPropagation();
                deleteThread(thread.threadId);
              }}
            />
          </li>
        ))}
        
        {/* Simple pagination load more trigger */}
        {filteredThreads.length > visibleCount && (
          <button 
            onClick={() => setVisibleCount(prev => prev + 15)} 
            className="loadMoreBtn"
          >
            Load Older Chats
          </button>
        )}
      </ul>

      <div className="sign">
        <p>By OmUphade</p>
      </div>
    </section>
  );
}

export default Sidebar;
