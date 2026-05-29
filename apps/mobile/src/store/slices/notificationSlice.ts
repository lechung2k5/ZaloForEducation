import { StateCreator } from 'zustand';
import { getStorage } from '../storage';
import { safeJsonParse } from '../chatHelpers';
import { ChatStore } from '../chatStore';
import { apiRequest } from '../../utils/api';

export interface NotificationSlice {
  notifications: any[];
  unreadNotificationCount: number;
  pendingFriendRequestsCount: number;
  markNotificationsRead: (conversationId?: string) => void;
  addNotification: (notification: any) => void;
  clearNotifications: () => void;
  setPendingFriendRequestsCount: (count: number | ((prev: number) => number)) => void;
  fetchPendingFriendRequestsCount: () => Promise<void>;
}

export const createNotificationSlice: StateCreator<ChatStore, [], [], NotificationSlice> = (set, get) => {
  const storage = getStorage();
  const initialNotifications = storage ? safeJsonParse(storage.getString("notifications"), []) : [];
  
  return {
    notifications: initialNotifications,
    unreadNotificationCount: initialNotifications.filter((n: any) => !n.read).length,
    pendingFriendRequestsCount: 0,

    setPendingFriendRequestsCount: (count) => set((state) => ({
      pendingFriendRequestsCount: typeof count === 'function' ? count(state.pendingFriendRequestsCount) : count
    })),

    fetchPendingFriendRequestsCount: async () => {
      try {
        const res = await apiRequest('/chat/friends/requests');
        if (res && res.data && Array.isArray(res.data)) {
          set({ pendingFriendRequestsCount: res.data.length });
        }
      } catch (err) {
        console.log("Failed to fetch pending requests count", err);
      }
    },

    markNotificationsRead: (conversationId) =>
      set((state) => {
        const nextNotifications = state.notifications.map((n) => {
          if (conversationId) {
            const match = n.metadata?.conversationId === conversationId;
            return match ? { ...n, read: true } : n;
          }
          return { ...n, read: true };
        });

        if (storage) {
          storage.set("notifications", JSON.stringify(nextNotifications));
        }

        return {
          notifications: nextNotifications,
          unreadNotificationCount: nextNotifications.filter((n) => !n.read).length,
        };
      }),

    addNotification: (notification) =>
      set((state) => {
        const msgId = notification.messageId || notification.metadata?.messageId;
        const isDuplicate = state.notifications.some(n => 
          n.id === notification.id || (msgId && n.metadata?.messageId === msgId)
        );
        if (isDuplicate) return state;

        // Note: activeConvId check will be handled in the combined store or via a helper
        
        const newNotification = {
          id: notification.id || `notif#${Date.now()}#${Math.random().toString(36).slice(2, 5)}`,
          title: notification.title || "Thông báo mới",
          message: notification.content || notification.message || "",
          at: notification.at || new Date().toISOString(),
          read: false,
          type: notification.type || "text",
          metadata: {
            conversationId: notification.conversationId || notification.metadata?.conversationId,
            messageId: msgId,
            ...notification.metadata
          },
        };

        const nextNotifications = [newNotification, ...state.notifications].slice(0, 100);
        
        if (storage) {
          storage.set("notifications", JSON.stringify(nextNotifications));
        }

        return {
          notifications: nextNotifications,
          unreadNotificationCount: nextNotifications.filter(n => !n.read).length,
        };
      }),

    clearNotifications: () =>
      set(() => {
        if (storage) {
          storage.set("notifications", "[]");
        }
        return {
          notifications: [],
          unreadNotificationCount: 0,
        };
      }),
  };
};
