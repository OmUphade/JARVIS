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
              <div className="userMessageContainer">
                {chat.attachments && chat.attachments.length > 0 && (
                  <div className="messageAttachments">
                    {chat.attachments.map((att, aIdx) => (
                      <div key={aIdx} className="messageAttachmentItem">
                        {att.mimeType.startsWith("image/") ? (
                          <img src={att.fileUrl} alt={att.fileName} className="attachmentImg" />
                        ) : att.mimeType.startsWith("audio/") ? (
                          <audio src={att.fileUrl} controls className="attachmentAudio" />
                        ) : att.mimeType.startsWith("video/") ? (
                          <video src={att.fileUrl} controls className="attachmentVideo" />
                        ) : (
                          <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="attachmentFileLink">
                            <i className="fa-solid fa-file-lines"></i> {att.fileName}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {chat.content && <p className="userMessage">{chat.content}</p>}
              </div>
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
