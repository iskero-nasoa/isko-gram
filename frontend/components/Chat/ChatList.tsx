"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Search, UserPlus, X, MessageSquareOff, Users, Hash, Globe, Trash2 } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { api } from "../../utils/api";
import { UserAvatar } from "../Common/UserAvatar";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { NewChatModal } from "./NewChatModal";
import { CreateGroupModal } from "./CreateGroupModal";
import { CreateSupergroupModal } from "./CreateSupergroupModal";
import { useSocket } from "../../hooks/useSocket";

interface ChatListProps {
  currentUserId: string;
}

interface UnifiedItem {
  id: string;
  type: "direct" | "group" | "supergroup";
  name: string;
  avatar?: string;
  status?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  memberCount?: number;
  raw: any;
}

export const ChatList: React.FC<ChatListProps> = ({ currentUserId }) => {
  const [chats, setChats] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [supergroups, setSupergroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateSupergroupModal, setShowCreateSupergroupModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UnifiedItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { socket, connected } = useSocket();

  const fetchAll = useCallback(async () => {
    try {
      const [chatData, groupData, sgData] = await Promise.all([
        api.getChats(),
        api.getGroups(),
        api.getSupergroups(),
      ]);
      setChats(chatData);
      setGroups(groupData || []);
      setSupergroups(sgData || []);
    } catch (error) {
      console.error("Failed to fetch chats/groups", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Join rooms for all chats, groups, and supergroups
  useEffect(() => {
    if (!socket || !connected || loading) return;

    chats.forEach((chat) => socket.emit("join_chat", { chatId: chat._id, userId: currentUserId }));
    groups.forEach((group) => socket.emit("join_group", group._id));
    supergroups.forEach((sg) => socket.emit("join_supergroup", sg._id));

    // Also join personal room
    socket.emit("join_user_room", currentUserId);
  }, [socket, connected, loading, chats.length, groups.length, supergroups.length, currentUserId]);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleMessageReceived = (message: any) => {
      setChats((prev) => {
        const chatIndex = prev.findIndex((c) => c._id === message.chatId);
        if (chatIndex === -1) {
          fetchAll();
          return prev;
        }
        const updatedChat = {
          ...prev[chatIndex],
          messages: [message],
          updatedAt: message.createdAt,
        };
        const otherChats = prev.filter((_, i) => i !== chatIndex);
        return [updatedChat, ...otherChats];
      });
    };

    const handleGroupMessageReceived = (message: any) => {
      setGroups((prev) => {
        const groupIndex = prev.findIndex((g) => g._id === message.groupId || g._id === message.chatId);
        if (groupIndex !== -1) {
          const updatedGroup = {
            ...prev[groupIndex],
            messages: [message],
            updatedAt: message.createdAt,
          };
          const otherGroups = prev.filter((_, i) => i !== groupIndex);
          return [updatedGroup, ...otherGroups];
        }
        return prev;
      });

      setSupergroups((prev) => {
        const sgIndex = prev.findIndex((sg) => sg._id === message.groupId || sg._id === message.chatId);
        if (sgIndex !== -1) {
          const updatedSg = {
            ...prev[sgIndex],
            lastMessage: message, // Store the actual message object
            updatedAt: message.createdAt,
          };
          const otherSg = prev.filter((_, i) => i !== sgIndex);
          return [updatedSg, ...otherSg];
        }
        return prev;
      });
    };

    const handleTopicMessage = (message: any) => {
      // Re-use group message logic as they share the same sidebar behavior
      handleGroupMessageReceived(message);
    };

    socket.on("message_received", handleMessageReceived);
    socket.on("group_message_received", handleGroupMessageReceived);
    socket.on("topic_message_received", handleTopicMessage);

    return () => {
      socket.off("message_received", handleMessageReceived);
      socket.off("group_message_received", handleGroupMessageReceived);
      socket.off("topic_message_received", handleTopicMessage);
    };
  }, [socket, connected, fetchAll]);

  // Build unified list
  const unifiedItems: UnifiedItem[] = [
    // Direct chats
    ...chats.map((chat) => {
      const otherParticipant = chat.participants.find((p: any) => p._id !== currentUserId);
      const lastMsg = chat.messages?.[0];
      return {
        id: chat._id,
        type: "direct" as const,
        name: otherParticipant?.username || "Chat",
        avatar: otherParticipant?.avatar,
        status: otherParticipant?.status,
        lastMessage: lastMsg?.text || "",
        lastMessageTime: chat.updatedAt,
        raw: chat,
      };
    }),
    // Groups
    ...groups.map((group) => {
      const lastMsg = group.messages?.[0];
      const senderName = lastMsg?.senderUsername || lastMsg?.senderId?.username;
      return {
        id: group._id,
        type: "group" as const,
        name: group.name,
        avatar: group.avatar,
        lastMessage: lastMsg
          ? `${senderName ? senderName + ": " : ""}${lastMsg.text || "Вложение"}`
          : "",
        lastMessageTime: group.updatedAt,
        memberCount: group.members?.length || 0,
        raw: group,
      };
    }),
    // Supergroups
    ...supergroups.map((sg) => {
      const lastMsg = sg.lastMessage;
      const senderName = lastMsg?.senderUsername;
      return {
        id: sg._id,
        type: "supergroup" as const,
        name: sg.name,
        avatar: sg.avatar,
        lastMessage: lastMsg
          ? `${senderName ? senderName + ": " : ""}${lastMsg.text || "Вложение"}`
          : "",
        lastMessageTime: sg.updatedAt,
        memberCount: sg.members?.length || 0,
        raw: sg,
      };
    }),
  ].sort((a, b) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });

  const filteredItems = unifiedItems.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      (item.lastMessage?.toLowerCase() || "").includes(query)
    );
  });

  const formatMessageTime = (date: string) => {
    if (!date) return "";
    return formatDistanceToNow(new Date(date), { addSuffix: false, locale: ru });
  };

  const canDelete = (item: UnifiedItem) => {
    if (item.type === "direct") return true;
    return item.raw.admin?.toString() === currentUserId || item.raw.admin?._id?.toString() === currentUserId;
  };

  const handleDeleteClick = (e: React.MouseEvent, item: UnifiedItem) => {
    e.stopPropagation();
    setConfirmDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.type === "direct") {
        await api.deleteChat(confirmDelete.id);
        setChats((prev) => prev.filter((c) => c._id !== confirmDelete.id));
      } else if (confirmDelete.type === "group") {
        await api.deleteGroup(confirmDelete.id);
        setGroups((prev) => prev.filter((g) => g._id !== confirmDelete.id));
      } else {
        await api.deleteSupergroup(confirmDelete.id);
        setSupergroups((prev) => prev.filter((sg) => sg._id !== confirmDelete.id));
      }
      if (params.id === confirmDelete.id) router.push("/chat");
    } catch (error) {
      console.error("Failed to delete", error);
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const handleItemClick = (item: UnifiedItem) => {
    if (item.type === "supergroup") {
      router.push(`/chat/supergroup/${item.id}`);
    } else if (item.type === "group") {
      router.push(`/chat/group/${item.id}`);
    } else {
      router.push(`/chat/${item.id}`);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 bg-secondary rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-secondary rounded w-1/2" />
              <div className="h-2 bg-secondary rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Search Area */}
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Поиск чатов или сообщений..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-secondary text-foreground rounded-xl border border-border focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-sm placeholder:text-muted-foreground transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-all"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-bold flex items-center justify-center gap-1.5 text-xs transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
          >
            <UserPlus size={14} />
            НОВЫЙ ЧАТ
          </button>
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className="flex-1 px-3 py-2.5 bg-secondary text-foreground rounded-xl hover:bg-secondary/70 font-bold flex items-center justify-center gap-1.5 text-xs transition-all border border-border active:scale-[0.98]"
          >
            <Users size={14} />
            ГРУППА
          </button>
        </div>
        <button
          onClick={() => setShowCreateSupergroupModal(true)}
          className="w-full px-3 py-2.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-foreground rounded-xl hover:from-blue-500/20 hover:to-purple-500/20 font-bold flex items-center justify-center gap-1.5 text-xs transition-all border border-blue-500/20 active:scale-[0.98]"
        >
          <Globe size={14} className="text-blue-400" />
          СУПЕРГРУППА
        </button>
      </div>

      {/* Modals */}
      {showNewChatModal && (
        <NewChatModal onClose={() => setShowNewChatModal(false)} />
      )}
      {showCreateGroupModal && (
        <CreateGroupModal onClose={() => setShowCreateGroupModal(false)} />
      )}
      {showCreateSupergroupModal && (
        <CreateSupergroupModal onClose={() => setShowCreateSupergroupModal(false)} />
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="font-bold text-base mb-2">Удалить {confirmDelete.type === "direct" ? "чат" : "группу"}?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Все сообщения будут удалены навсегда. Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-bold hover:bg-secondary transition-all"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 transition-all disabled:opacity-50"
              >
                {deleting ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Chat + Group List */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 p-4 text-center">
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-muted-foreground mb-3">
              <MessageSquareOff size={24} />
            </div>
            <p className="text-sm font-bold">Ничего не найдено</p>
            <p className="text-xs text-muted-foreground mt-1">
              Попробуйте изменить запрос или <br /> начните новый чат
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isActive =
              (item.type === "direct" && params.id === item.id) ||
              (item.type === "group" && params.id === item.id) ||
              (item.type === "supergroup" && params.id === item.id);

            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => handleItemClick(item)}
                className={`group/item px-4 py-3.5 border-b border-border/50 cursor-pointer transition-all ${
                  isActive
                    ? "bg-secondary border-l-4 border-l-primary"
                    : "border-l-4 border-l-transparent hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {item.type === "supergroup" ? (
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/80 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shrink-0">
                      <Globe size={18} />
                    </div>
                  ) : item.type === "group" ? (
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg shrink-0 overflow-hidden">
                      {item.avatar ? (
                        <img
                          src={`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace("/api", "")}${item.avatar}`}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Hash size={18} />
                      )}
                    </div>
                  ) : (
                    <UserAvatar
                      user={{
                        username: item.name,
                        avatar: item.avatar,
                        status: item.status as any,
                      }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <h3
                          className={`text-sm font-bold truncate ${
                            isActive ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {item.name}
                        </h3>
                        {(item.type === "group" || item.type === "supergroup") && (
                          <span className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            {item.memberCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {canDelete(item) && (
                          <button
                            onClick={(e) => handleDeleteClick(e, item)}
                            className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        {item.lastMessageTime && (
                          <span className="text-muted-foreground text-[10px] font-medium">
                            {formatMessageTime(item.lastMessageTime)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p
                      className={`text-xs truncate ${
                        isActive ? "text-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {item.lastMessage || "Нет сообщений"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
