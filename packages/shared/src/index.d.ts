export interface User {
    id: string;
    email: string;
    fullName: string;
    gender: boolean;
    dataOfBirth: string;
    phone: string;
    avatarUrl?: string;
    backgroundUrl?: string;
    album?: any[];
    address?: string;
    bio?: string;
    passwordHash: string;
    currentDeviceId?: string;
    googleId?: string;
    authProvider?: "LOCAL" | "GOOGLE";
    isVerified?: boolean;
    lastLoginAt: string;
    createdAt: string;
    updatedAt: string;
    status: "active" | "suspended" | "LOCKED" | "DELETED";
    isActive: boolean;
    isDeleted?: boolean;
    deletedAt?: string;
    lockedAt?: string;
}
export interface FileURL {
    fileName: string;
    fileType: string;
    fileUrl: string;
    size?: number;
}
export interface Conversation {
    id: string;
    name?: string;
    avatar?: string;
    admin?: string;
    owner?: string;
    deputies?: string[];
    members: string[];
    type: "direct" | "group" | "system";
    lastMessage?: string;
    lastMessageContent?: string;
    lastMessageSenderId?: string;
    lastMessageTimestamp?: number;
    isDelete?: boolean;
    delete_history?: string[];
    approvedMembers?: boolean;
    listApprovedMembers?: string[];
    createdAt: string;
    updatedAt: string;
    partner?: string;
    online?: boolean;
    lastReadAt?: number;
    unreadCount?: number;
    hasUnreadMention?: boolean;
    mentionCount?: number;
    lastMentionMessageId?: string;
    lastMentionAt?: string;
    pinnedMessageIds?: string[];
    autoDeleteDays?: 1 | 7 | 30 | null;
    autoDeleteUpdatedAt?: string;
    settings?: {
        isMuted?: boolean;
        isPinned?: boolean;
    };
}
export interface Friendship {
    id: string;
    sender_id: string;
    receiver_id: string;
    status: "pending" | "accepted" | "declined" | "blocked";
    content?: string;
    type?: string;
    nickname?: string;
    closeFriend?: boolean;
    blockedBy?: string;
    createdAt: string;
    updatedAt: string;
}
export interface FriendSuggestion {
    email: string;
    fullName: string;
    avatarUrl?: string;
    mutualFriendCount: number;
    mutualFriends: string[];
    sharedGroups: string[];
    reasons: string[];
}
export interface MessageMention {
    email: string;
    displayName?: string;
    start?: number;
    end?: number;
}
export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    attachments?: string[];
    media?: FileURL[];
    files?: FileURL[];
    mentions?: MessageMention[];
    like?: string[];
    seen?: string[];
    status?: 'sending' | 'sent' | 'delivered' | 'seen' | 'error';
    replyTo?: any;
    recalled?: boolean;
    removed?: string[];
    type: "text" | "image" | "video" | "file" | "system" | "contact_card" | "location" | "SYSTEM_CALL";
    contactCard?: {
        email: string;
        fullName?: string;
        avatarUrl?: string;
        phone?: string;
    };
    location?: {
        latitude: number;
        longitude: number;
        label?: string;
        isLive?: boolean;
        liveSessionId?: string;
        sentAt?: string;
        expiresAt?: string;
    };
    createdAt: string;
    updatedAt?: string;
    pinned?: boolean;
    pinnedAt?: string;
    reactions?: Record<string, string[]>;
}
export interface OtpCode {
    id: string;
    code: string;
    type: "register" | "forgot_password";
    attempts: number;
    expiresAt: number;
}
export interface UserSession {
    id: string;
    userId: string;
    isActive: boolean;
    lastActiveAt: string;
}
export interface RegisterRequestDto {
    email: string;
    password?: string;
    fullName?: string;
    gender?: boolean;
    dataOfBirth?: string;
    phone?: string;
    otp?: string;
}
export interface LoginRequestDto {
    email: string;
    password: string;
    deviceId: string;
    deviceName?: string;
    deviceType?: string;
    platform?: "web" | "mobile";
}
export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
}
export type SystemCallStatus = 'calling' | 'ringing' | 'completed' | 'missed' | 'rejected' | 'canceled';
export interface SystemCallMetadata {
    callId: string;
    callType: 'audio' | 'video';
    callStatus: SystemCallStatus;
    callerId: string;
    receiverId: string;
    duration: number;
}
export declare const CALL_UI: {
    colors: {
        missed: string;
        textPrimary: string;
        textSecondary: string;
        actionBlue: string;
    };
    spacing: {
        padding: string;
        radius: string;
        gap: string;
    };
};
export declare const formatCallDuration: (sec?: number) => string;
export interface BotConversationResponse {
    convId: string;
    botEmail: string;
    botName: string;
}
export declare const BOT_EMAIL = "bot@UniChat.system";
export declare const BOT_NAME = "UniChat AI";
export declare const BOT_AVATAR = "https://img.freepik.com/free-vector/graident-ai-robot-vectorart_78370-4114.jpg?semt=ais_hybrid&w=740&q=80";
