import "./Chat.css";
import React, { useContext } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function Chat() {
  const { newChat, prevChats, streamingReply } = useContext(MyContext);

  return (
    <>
      {newChat && <h1>Start a New Chat!</h1>}
      <div className="chats">
        {prevChats?.map((chat, idx) => (
          <div
            className={chat.role === "user" ? "userDiv" : "gptDiv"}
            key={idx}
          >
            {chat.role === "user" ? (
              <p className="userMessage">{chat.content}</p>
            ) : (
              <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                {chat.content}
              </ReactMarkdown>
            )}
          </div>
        ))}

        {streamingReply && (
          <div className="gptDiv" key="streaming">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {streamingReply}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </>
  );
}

export default Chat;
