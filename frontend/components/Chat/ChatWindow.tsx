"use client";

import React from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { useChat } from "../../hooks/useChat";
import { useCall } from "../../context/CallContext";
import { Phone, Video, Info } from "lucide-react";
import { UserAvatar } from "../Common/UserAvatar";
import Link from "next/link";
import { Message } from "../../types/chat";

interface ChatWindowProps {
  chatId: string;
  currentUserId: string;
  recipient?: any;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, currentUserId, recipient }) => {
  const { messages, loading, sendMessage, emitTyping, typingUsers, deleteMessage } = useChat(chatId);
  const { initiateCall } = useCall();
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${recipient?._id || ""}`} className="hover:opacity-80 transition-opacity">
            <UserAvatar user={recipient} />
          </Link>
          <div>
            <h2 className="text-foreground font-medium leading-none mb-1">
              {recipient?.username || "Chat"}
            </h2>
            <p className="text-muted-foreground text-xs">
              {recipient?.status === 'online' ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-5 text-muted-foreground">
          <button
            onClick={() => recipient?._id && initiateCall(recipient._id, "audio")}
            className="hover:text-foreground transition-colors p-1"
            title="Голосовой звонок"
          >
            <Phone size={20} />
          </button>
          <button 
            onClick={() => recipient?._id && initiateCall(recipient._id, "video")}
            className="hover:text-foreground transition-colors p-1"
            title="Видеозвонок"
          >
            <Video size={20} />
          </button>
          <button className="hover:text-foreground transition-colors p-1">
            <Info size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <MessageList 
          messages={messages} 
          currentUserId={currentUserId} 
          onDeleteMessage={deleteMessage} 
          onReply={(msg) => setReplyTo(msg)}
        />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-card">
        <TypingIndicator users={Array.from(typingUsers)} />
        <MessageInput 
          onSendMessage={sendMessage} 
          onTyping={emitTyping} 
          disabled={loading} 
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>
    </div>
  );
};
