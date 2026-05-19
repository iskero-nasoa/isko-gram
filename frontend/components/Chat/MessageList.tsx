"use client";

import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Message } from "../../types/chat";
import { UserAvatar } from "../Common/UserAvatar";
import { Trash2, Reply } from "lucide-react";
import Link from "next/link";
import { AudioPlayer } from "./AudioPlayer";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  onDeleteMessage: (messageId: string, forEveryone?: boolean) => void;
  onReply?: (message: Message) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  onDeleteMessage,
  onReply
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [deleteMenuFor, setDeleteMenuFor] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const scrollToOriginal = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-primary/10");
      setTimeout(() => element.classList.remove("bg-primary/10"), 2000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-muted-foreground opacity-50 italic">
          No messages yet. Start the conversation!
        </div>
      ) : (
        messages.map((msg) => {
          const senderIdStr = typeof msg.senderId === "string" ? msg.senderId : (msg.senderId as any)?._id;
          const isMe = senderIdStr === currentUserId;

          const senderUsername = msg.senderUsername || (typeof msg.senderId !== "string" ? (msg.senderId as any).username : "?");
          const senderAvatar = msg.senderAvatar || (typeof msg.senderId !== "string" ? (msg.senderId as any).avatar : undefined);

          return (
            <div
              key={msg._id}
              id={`msg-${msg._id}`}
              className={`flex gap-3 group relative transition-colors duration-500 rounded-2xl ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Message Actions (Visible on hover) */}
              <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all self-center shrink-0 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Reply Button */}
                <button 
                  onClick={() => onReply?.(msg)}
                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                  title="Ответить"
                >
                  <Reply size={16} />
                </button>

                {/* Delete Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDeleteMenuFor(deleteMenuFor === msg._id ? null : msg._id)}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>

                  {deleteMenuFor === msg._id && (
                    <div className={`absolute bottom-full mb-1 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[180px] ${isMe ? 'right-0' : 'left-0'}`}>
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => { onDeleteMessage(msg._id, true); setDeleteMenuFor(null); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors font-medium"
                        >
                          Delete for everyone
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { onDeleteMessage(msg._id, false); setDeleteMenuFor(null); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        Delete for me
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Avatar next to EACH message */}
              <div className="flex-shrink-0 mt-1">
                <UserAvatar
                  user={{ username: senderUsername, avatar: senderAvatar }}
                  size="sm"
                />
              </div>

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] md:max-w-md`}>
                {/* Sender name (only for others) */}
                {!isMe && (
                  <p className="text-muted-foreground text-[10px] font-bold mb-1 ml-1 uppercase tracking-wider">
                    {senderUsername}
                  </p>
                )}

                {/* Message Bubble */}
                <div
                  className={`px-4 py-2 rounded-2xl shadow-sm transition-all duration-200 hover:shadow-md relative overflow-hidden ${isMe
                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                    : 'bg-secondary text-foreground rounded-tl-none border border-border/50'
                    }`}
                >
                  {/* Reply Quote */}
                  {msg.replyTo && (
                    <div 
                      onClick={() => scrollToOriginal(msg.replyTo!._id)}
                      className={`mb-2 p-2 rounded-lg text-xs border-l-2 flex flex-col gap-1 cursor-pointer hover:opacity-80 transition-opacity ${
                        isMe ? 'bg-black/10 border-white/50' : 'bg-primary/5 border-primary/50'
                      }`}
                    >
                      <p className={`font-bold ${isMe ? 'text-white/90' : 'text-primary'}`}>
                        {typeof msg.replyTo.senderId === 'string' ? '...' : (msg.replyTo.senderId as any).username}
                      </p>
                      <p className="opacity-80 truncate max-w-[200px]">
                        {msg.replyTo.text || "Вложение"}
                      </p>
                    </div>
                  )}

                  {/* Attachments support */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {msg.attachments.map((att, i) => {
                        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace("/api", "");
                        const fullUrl = `${baseUrl}${att.url}`;
                        return (
                          <div key={i} className="rounded-lg overflow-hidden border border-black/10">
                            {att.type === "image" ? (
                              <img src={fullUrl} alt={att.filename} className="max-w-full h-auto object-contain" />
                            ) : att.type === "video" ? (
                              <video src={fullUrl} controls className="max-w-full h-auto" />
                            ) : (
                              <AudioPlayer src={fullUrl} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {msg.text && (
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  )}

                  {/* Internal time for "modern" look */}
                  <div className={`flex justify-end mt-1 text-[9px] opacity-60 font-medium`}>
                    {format(new Date(msg.createdAt), "HH:mm")}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
};
