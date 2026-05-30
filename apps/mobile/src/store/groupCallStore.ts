import { create } from 'zustand';

export type GroupCallState = 'IDLE' | 'RINGING' | 'JOINING' | 'CONNECTED';

export interface Participant {
  email: string;
  name?: string;
  fullName?: string; // Keep for compatibility
  avatar?: string;
  avatarUrl?: string; // Keep for compatibility
  status: 'ringing' | 'connected' | 'declined' | 'disconnected';
  tileId?: number;
  isVideoActive?: boolean;
  isLocal?: boolean;
}

interface GroupCallStore {
  callState: GroupCallState;
  convId: string | null;
  callId: string | null;
  callType: string | null;
  fromEmail: string | null;
  participants: Record<string, any>; // { [attendeeId]: Participant }
  ringingEmails: string[];
  peerProfile: any | null;
  groupName: string | null;
  groupAvatar: string | null;
  videoTiles: any[];
  isMinimized: boolean;
  meetingData: any | null;
  attendeeData: any | null;

  // Actions
  setIncomingGroupCall: (convId: string, callId: string, callType: string, fromEmail: string, peerProfile?: any, groupName?: string, groupAvatar?: string) => void;
  startJoining: (convId: string, callId: string, callType: string, groupName?: string, groupAvatar?: string, ringingEmails?: string[]) => void;
  setConnected: () => void;
  setParticipants: (participants: Record<string, any>) => void;
  updateParticipant: (attendeeId: string, data: any) => void;
  removeParticipant: (attendeeId: string) => void;
  addVideoTile: (tile: any) => void;
  removeVideoTile: (tileId: number) => void;
  resetGroupCall: () => void;
  toggleMinimized: (minimized?: boolean) => void;
  setMeetingData: (meetingData: any, attendeeData: any) => void;
  initiateGroupCall: (convId: string, callId: string, type: string, recipients: string[], profile: any, groupName?: string, groupAvatar?: string) => Promise<any>;
}

export const useGroupCallStore = create<GroupCallStore>((set, get) => ({
  callState: 'IDLE',
  convId: null,
  callId: null,
  callType: null,
  fromEmail: null,
  participants: {},
  ringingEmails: [],
  peerProfile: null,
  groupName: null,
  groupAvatar: null,
  videoTiles: [],
  isMinimized: false,
  meetingData: null,
  attendeeData: null,

  setIncomingGroupCall: (convId, callId, callType, fromEmail, peerProfile, groupName, groupAvatar) => set({
    callState: 'RINGING',
    convId,
    callId,
    callType,
    fromEmail,
    peerProfile,
    groupName: groupName || null,
    groupAvatar: groupAvatar || null
  }),

  startJoining: (convId, callId, callType, groupName, groupAvatar, ringingEmails) => set({ 
    callState: 'JOINING', 
    convId, 
    callId, 
    callType,
    groupName: groupName || null,
    groupAvatar: groupAvatar || null,
    ringingEmails: ringingEmails || [] 
  }),
  setConnected: () => set({ callState: 'CONNECTED' }),
  
  setParticipants: (participants) => {
    const normalized: Record<string, any> = {};
    if (participants) {
      Object.entries(participants).forEach(([id, p]) => {
        normalized[id.toLowerCase()] = p;
      });
    }
    set({ participants: normalized });
  },

  updateParticipant: (attendeeId, data) =>
    set((state) => {
      const id = attendeeId.toLowerCase();
      const participant = state.participants[id] || {};
      const updated = { ...participant, ...data };
      
      let newRinging = state.ringingEmails;
      if (updated.email) {
        const emailLower = updated.email.toLowerCase();
        newRinging = state.ringingEmails.filter(e => e.toLowerCase() !== emailLower);
      }

      return {
        participants: {
          ...state.participants,
          [id]: updated
        },
        ringingEmails: newRinging
      };
    }),

  removeParticipant: (attendeeId) =>
    set((state) => {
      const id = attendeeId.toLowerCase();
      const participant = state.participants[id];
      let newRinging = state.ringingEmails;
      
      if (participant?.email) {
        const emailLower = participant.email.toLowerCase();
        newRinging = state.ringingEmails.filter(e => e.toLowerCase() !== emailLower);
      }

      const newParticipants = { ...state.participants };
      delete newParticipants[id];
      
      const newTiles = state.videoTiles.filter(t => (t.attendeeId || "").toLowerCase() !== id);

      return { 
        participants: newParticipants,
        ringingEmails: newRinging,
        videoTiles: newTiles
      };
    }),

  addVideoTile: (tile) =>
    set((state) => ({
      videoTiles: [...state.videoTiles.filter(t => t.tileId !== tile.tileId), tile]
    })),

  removeVideoTile: (tileId) =>
    set((state) => ({
      videoTiles: state.videoTiles.filter(t => t.tileId !== tileId)
    })),

  resetGroupCall: () => set({ 
    callState: 'IDLE', 
    convId: null, 
    callId: null, 
    callType: null, 
    fromEmail: null,
    participants: {},
    ringingEmails: [],
    peerProfile: null,
    groupName: null,
    groupAvatar: null,
    videoTiles: [],
    isMinimized: false,
    meetingData: null,
    attendeeData: null,
  }),

  toggleMinimized: (minimized) => set((state) => ({ 
    isMinimized: minimized !== undefined ? minimized : !state.isMinimized 
  })),

  setMeetingData: (meetingData, attendeeData) => set({ meetingData, attendeeData }),

  initiateGroupCall: async (convId, callId, type, recipients, profile, groupName, groupAvatar) => {
    set({
      convId: convId,
      callId: callId,
      callState: "JOINING",
      callType: type,
      ringingEmails: recipients,
      groupName,
      groupAvatar
    });

    try {
      const { apiRequest } = require('../utils/api');
      const res = await apiRequest("/api/chat/group-call/create", "POST", {
        conversationId: convId,
        callId: callId,
        type: type,
        initiatorProfile: profile
      });
      get().setMeetingData(res.meeting || res.data?.meeting, res.attendee || res.data?.attendee);
      return res;
    } catch (e) {
      console.error('[GroupCallStore] initiateGroupCall failed:', e);
      get().resetGroupCall();
      throw e;
    }
  }
}));
