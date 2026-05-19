import axios, { AxiosError } from "axios";
import { AuthResponse, LoginPayload, RegisterPayload } from "@/types/auth";

// Инициализация axios с базовым URL
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
});

// Добавляем JWT токен в заголовок Authorization для каждого запроса
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Обрабатываем ошибки API централизованно
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    // Если получаем 401 Unauthorized, можно автоматически разлогинить пользователя
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
    }

    const message = error.response?.data?.message || "Произошла ошибка при обращении к API";
    return Promise.reject(new Error(message));
  }
);

export const api = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
    if (typeof window !== "undefined") {
      localStorage.setItem("token", data.token);
    }
    return data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>("/auth/register", {
      username: payload.username,
      email: payload.email,
      password: payload.password,
    });
    if (typeof window !== "undefined") {
      localStorage.setItem("token", data.token);
    }
    return data;
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
  },

  getMe: async (): Promise<AuthResponse["user"]> => {
    const { data } = await apiClient.get<AuthResponse["user"]>("/auth/me");
    return data;
  },

  // Заглушки для методов чата (будут реализованы с Socket.io)
  getChats: async () => {
    const { data } = await apiClient.get("/chats");
    return data;
  },

  getGroups: async () => {
    const { data } = await apiClient.get("/groups");
    return data;
  },

  getGroup: async (groupId: string) => {
    const { data } = await apiClient.get(`/groups/${groupId}`);
    return data;
  },

  createGroup: async (name: string, description?: string, members?: string[]) => {
    const { data } = await apiClient.post("/groups", { name, description, members });
    return data;
  },

  updateGroup: async (groupId: string, payload: any) => {
    const { data } = await apiClient.patch(`/groups/${groupId}`, payload);
    return data;
  },

  deleteGroup: async (groupId: string) => {
    const { data } = await apiClient.delete(`/groups/${groupId}`);
    return data;
  },

  getGroupMessages: async (groupId: string, skip: number = 0, limit: number = 50) => {
    const { data } = await apiClient.get(`/groups/${groupId}/messages`, {
      params: { skip, limit }
    });
    return data;
  },

  addGroupMember: async (groupId: string, userId: string) => {
    const { data } = await apiClient.post(`/groups/${groupId}/members`, { userId });
    return data;
  },

  removeGroupMember: async (groupId: string, userId: string) => {
    const { data } = await apiClient.delete(`/groups/${groupId}/members/${userId}`);
    return data;
  },

  leaveGroup: async (groupId: string) => {
    const { data } = await apiClient.post(`/groups/${groupId}/leave`);
    return data;
  },

  // Supergroups
  getSupergroups: async () => {
    const { data } = await apiClient.get("/supergroups");
    return data;
  },

  getSupergroup: async (id: string) => {
    const { data } = await apiClient.get(`/supergroups/${id}`);
    return data;
  },

  createSupergroup: async (name: string, description?: string, members?: string[]) => {
    const { data } = await apiClient.post("/supergroups", { name, description, members });
    return data;
  },

  updateSupergroup: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/supergroups/${id}`, payload);
    return data;
  },

  deleteSupergroup: async (id: string) => {
    const { data } = await apiClient.delete(`/supergroups/${id}`);
    return data;
  },

  joinSupergroup: async (id: string) => {
    const { data } = await apiClient.post(`/supergroups/${id}/join`);
    return data;
  },

  leaveSupergroup: async (id: string) => {
    const { data } = await apiClient.post(`/supergroups/${id}/leave`);
    return data;
  },

  getSupergroupTopics: async (supergroupId: string) => {
    const { data } = await apiClient.get(`/supergroups/${supergroupId}/topics`);
    return data;
  },

  getSupergroupTopicMessages: async (supergroupId: string, topicId: string, skip: number = 0, limit: number = 50) => {
    const { data } = await apiClient.get(`/supergroups/${supergroupId}/topics/${topicId}/messages`, {
      params: { skip, limit }
    });
    return data;
  },

  createSupergroupTopic: async (supergroupId: string, name: string, description?: string) => {
    const { data } = await apiClient.post(`/supergroups/${supergroupId}/topics`, { name, description });
    return data;
  },

  updateSupergroupTopic: async (supergroupId: string, topicId: string, payload: any) => {
    const { data } = await apiClient.patch(`/supergroups/${supergroupId}/topics/${topicId}`, payload);
    return data;
  },

  deleteSupergroupTopic: async (supergroupId: string, topicId: string) => {
    const { data } = await apiClient.delete(`/supergroups/${supergroupId}/topics/${topicId}`);
    return data;
  },

  // Topics (aliased for components that use generic names)
  getTopics: async (supergroupId: string) => {
    const { data } = await apiClient.get(`/supergroups/${supergroupId}/topics`);
    return data;
  },

  getTopicMessages: async (supergroupId: string, topicId: string, skip: number = 0, limit: number = 50) => {
    const { data } = await apiClient.get(`/supergroups/${supergroupId}/topics/${topicId}/messages`, {
      params: { skip, limit }
    });
    return data;
  },

  createTopic: async (supergroupId: string, name: string, description?: string) => {
    const { data } = await apiClient.post(`/supergroups/${supergroupId}/topics`, { name, description });
    return data;
  },

  updateTopic: async (supergroupId: string, topicId: string, payload: any) => {
    const { data } = await apiClient.patch(`/supergroups/${supergroupId}/topics/${topicId}`, payload);
    return data;
  },

  deleteTopic: async (supergroupId: string, topicId: string) => {
    const { data } = await apiClient.delete(`/supergroups/${supergroupId}/topics/${topicId}`);
    return data;
  },

  createDirectChat: async (targetUserId: string) => {
    const { data } = await apiClient.post("/chats/create-direct", { targetUserId });
    return data;
  },

  deleteChat: async (chatId: string) => {
    const { data } = await apiClient.delete(`/chats/${chatId}`);
    return data;
  },

  getMessages: async (chatId: string, skip: number = 0, limit: number = 50) => {
    const { data } = await apiClient.get(`/messages/${chatId}`, {
      params: { skip, limit }
    });
    return data;
  },

  deleteMessage: async (messageId: string, forEveryone = false) => {
    const { data } = await apiClient.delete(`/messages/${messageId}`, { data: { forEveryone } });
    return data;
  },

  uploadFile: async (file: File, onProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: onProgress,
    });
    return data;
  },

  getUsers: async () => {
    const { data } = await apiClient.get("/auth/users");
    return data;
  },

  getUserProfile: async (userId: string) => {
    const { data } = await apiClient.get(`/users/${userId}`);
    return data;
  },

  updateProfile: async (payload: any) => {
    const { data } = await apiClient.patch("/users/me", payload);
    return data;
  },

  uploadAvatar: async (file: File, onProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append("avatar", file);
    const { data } = await apiClient.put("/users/me/avatar", formData, {
      onUploadProgress: onProgress,
    });
    return data;
  },

  searchUsers: async (query: string) => {
    const { data } = await apiClient.get(`/users/search`, {
      params: { q: query },
    });
    return data;
  },
};
