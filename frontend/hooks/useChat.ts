"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "./useSocket";
import { useAuth } from "./useAuth";
import { api } from "../utils/api";
import { Message } from "../types/chat";

export const useChat = (chatId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const LIMIT = 50;

  // Initial load
  useEffect(() => {
    if (!chatId || !user) {
      setMessages([]);
      setSkip(0);
      setHasMore(true);
      return;
    }

    const fetchInitialMessages = async () => {
      setLoading(true);
      try {
        const data = await api.getMessages(chatId, 0, LIMIT);
        setMessages(data);
        setSkip(data.length);
        setHasMore(data.length === LIMIT);
      } catch (error) {
        console.error("Failed to load initial messages", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialMessages();
  }, [chatId, user]);

  // Load more (Pagination)
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !chatId) return;

    setLoading(true);
    try {
      const data = await api.getMessages(chatId, skip, LIMIT);
      if (data.length > 0) {
        setMessages((prev) => [...data, ...prev]); // Prepend older messages
        setSkip((prev) => prev + data.length);
      }
      setHasMore(data.length === LIMIT);
    } catch (error) {
      console.error("Failed to load more messages", error);
    } finally {
      setLoading(false);
    }
  }, [chatId, loading, hasMore, skip]);

  // Socket setup
  useEffect(() => {
    if (!socket || !connected || !chatId || !user) return;

    socket.emit("join_chat", { chatId, userId: user.id });

    const handleMessage = (message: any) => {
      if (message.chatId === chatId) {
        setMessages((prev) => {
          // If this is a confirmation of an optimistic message, replace it
          if (message.tempId) {
            const index = prev.findIndex((m) => m._id === message.tempId);
            if (index !== -1) {
              const newMessages = [...prev];
              newMessages[index] = message;
              return newMessages;
            }
          }
          // Avoid duplicates
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }
    };

    const handleTyping = (data: { userId: string; username: string; isTyping: boolean }) => {
      if (data.userId === user.id) return; // Ignore own typing status
      
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (data.isTyping) {
          newSet.add(data.username);
        } else {
          newSet.delete(data.username);
        }
        return newSet;
      });
    };

    const handleMessageDeleted = (deletedMessageId: string) => {
      setMessages((prev) => prev.filter((m) => m._id !== deletedMessageId));
    };

    socket.on("message_received", handleMessage);
    socket.on("user_typing", handleTyping);
    socket.on("message_deleted", handleMessageDeleted);

    return () => {
      socket.off("message_received", handleMessage);
      socket.off("user_typing", handleTyping);
      socket.off("message_deleted", handleMessageDeleted);
      socket.emit("leave_chat", chatId);
    };
  }, [socket, connected, chatId, user]);

  const sendMessage = useCallback(
    async (text: string, attachments?: any[], replyToId?: string) => {
      if (!chatId || !socket || !user) return;
      if (!text.trim() && (!attachments || attachments.length === 0)) return;

      // Optimistic message
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        _id: tempId,
        chatId,
        text,
        senderId: user.id,
        senderUsername: user.username,
        senderAvatar: user.avatar,
        attachments: attachments || [],
        status: "sent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      
      try {
        socket.emit("send_message", { 
          chatId, 
          text, 
          senderId: user.id,
          attachments,
          replyTo: replyToId,
          tempId 
        });
        
        // Clear typing status
        socket.emit("typing", { chatId, userId: user.id, isTyping: false });
      } catch (error) {
        console.error("Failed to send message", error);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
      }
    },
    [chatId, socket, user]
  );

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatId || !socket || !user) return;

      socket.emit("typing", { chatId, userId: user.id, isTyping });

      if (isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit("typing", { chatId, userId: user.id, isTyping: false });
        }, 3000);
      }
    },
    [chatId, socket, user]
  );

  const deleteMessage = useCallback(async (messageId: string, forEveryone = false) => {
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
    try {
      await api.deleteMessage(messageId, forEveryone);
    } catch (error) {
      console.error("Failed to delete message", error);
    }
  }, []);

  return { 
    messages, 
    sendMessage, 
    loading, 
    hasMore, 
    loadMore, 
    typingUsers, 
    emitTyping, 
    deleteMessage 
  };
};
