import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionsAndroid, Platform, Alert, AppState } from 'react-native';
import { useGroupCallStore } from '../store/groupCallStore';
import { chimeRef } from '../utils/chimeRef';
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from 'amazon-chime-sdk-js';
import { mediaDevices } from 'react-native-webrtc';
import { useAuth } from '../context/AuthContext';
import SocketService from '../utils/socket';

const normalizeAttendeeId = (id?: string | null): string | null => {
  if (!id) return null;
  return id.split('#')[0].toLowerCase();
};

export const useGroupChime = () => {
  const { user } = useAuth();
  const store = useGroupCallStore();
  const { callType, callState, localTileId } = store;

  const isStarted = useRef(false);
  const localTileIdRef = useRef<number | null>(null);
  const activeVideoDeviceIdRef = useRef<string | null>(null);
  const isCameraUserEnabled = useRef(false);
  const heartbeatIntervalRef = useRef<any>(null);

  useEffect(() => {
    localTileIdRef.current = localTileId;
  }, [localTileId]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (!hasAudio) {
        const grantedAudio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) return false;
      }
      const hasVideo = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (!hasVideo) {
        const grantedVideo = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (grantedVideo !== PermissionsAndroid.RESULTS.GRANTED) return false;
      }
      return true;
    } catch (err) {
      console.warn("[Chime-Permissions] Permission error:", err);
      return false;
    }
  };

  const cleanup = useCallback(async (reason: string = 'unknown') => {
    console.log(`[Chime-JS] Group Cleanup session. Reason: ${reason}`);
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (chimeRef.current?.meetingSession) {
      try {
        chimeRef.current.meetingSession.audioVideo.stop();
      } catch (e) {
        console.warn('Error stopping audioVideo:', e);
      }
      chimeRef.current.meetingSession = null;
    }
    
    useGroupCallStore.getState().setLocalTileId(null);
    isStarted.current = false;
    isCameraUserEnabled.current = false;
    
    useGroupCallStore.getState().resetGroupCall();
  }, []);

  useEffect(() => {
    return () => {
      if (isStarted.current) {
        cleanup('unmount');
      }
    };
  }, [cleanup]);

  useEffect(() => {
    if (callState === 'IDLE' && isStarted.current) {
      cleanup('callState IDLE');
    }
  }, [callState, cleanup]);

  const setupSession = useCallback(async (meetingData: any, attendeeData: any) => {
    if (isStarted.current) return;
    
    try {
      console.log('[Chime-JS] Setting up Group session...');
      const logger = new ConsoleLogger('MobileGroupChime', LogLevel.WARN);
      const deviceController = new DefaultDeviceController(logger, { enableWebAudio: false });
      
      const configuration = new MeetingSessionConfiguration(meetingData, attendeeData);
      // [FIX] Disable simulcast for React Native to prevent "Could not get transceiver" exception
      configuration.enableSimulcastForUnifiedPlanChromiumBasedBrowsers = false;
      
      const meetingSession = new DefaultMeetingSession(configuration, logger, deviceController);
      
      if (chimeRef.current) {
        chimeRef.current.meetingSession = meetingSession;
      }

      const observer = {
        videoTileDidUpdate: (tileState: any) => {
          const isLocal = tileState.localTile;
          const tileId = tileState.tileId;
          const isContent = tileState.isContent;
          
          const currentStore = useGroupCallStore.getState();
          const rawAttendeeId = isLocal ? currentStore.attendeeData?.AttendeeId : tileState.boundAttendeeId;
          const boundAttendeeId = normalizeAttendeeId(rawAttendeeId);

          if (!boundAttendeeId) {
            console.log(`[Chime-JS] Ignoring videoTileDidUpdate for tile ${tileId} because boundAttendeeId is missing`);
            return;
          }

          if (isLocal) {
            useGroupCallStore.getState().setLocalTileId(tileId);
          } else {
            const currentTiles = currentStore.videoTiles || [];
            const existingIdx = currentTiles.findIndex((t: any) => t.tileId === tileId);
            
            if (existingIdx === -1) {
              currentStore.addVideoTile({ tileId, isLocal: false, isContent, boundAttendeeId });
            } else if (currentTiles[existingIdx].isContent !== isContent || currentTiles[existingIdx].boundAttendeeId !== boundAttendeeId) {
              // Update if content flag or attendeeId changes
              const newTiles = [...currentTiles];
              newTiles[existingIdx] = { ...newTiles[existingIdx], isContent, boundAttendeeId };
              currentStore.removeVideoTile(tileId);
              currentStore.addVideoTile(newTiles[existingIdx]);
            }
          }
        },
        videoTileWasRemoved: (tileId: number) => {
          if (tileId === localTileIdRef.current) {
            useGroupCallStore.getState().setLocalTileId(null);
          } else {
            useGroupCallStore.getState().removeVideoTile(tileId);
          }
        },
        audioVideoDidStart: () => {
          console.log('[Chime-JS] Group audioVideoDidStart');
          useGroupCallStore.getState().setConnected();
          
          const currentStore = useGroupCallStore.getState();
          if (SocketService.socket && currentStore.convId && currentStore.callId) {
            console.log(`[Chime-JS] Joining socket room: ${currentStore.convId}`);
            (SocketService.socket as any).emit('join_room', { convId: currentStore.convId });
            
            console.log('[Chime-JS] Emitting group-call:peer_joined');
            (SocketService.socket as any).emit('group-call:peer_joined', {
              convId: currentStore.convId,
              callId: currentStore.callId,
              userEmail: user?.email,
              attendeeId: attendeeData.AttendeeId,
              participant: {
                email: user?.email,
                name: user?.fullName || user?.name,
                avatar: user?.avatarUrl || user?.avatar,
                joinedAt: new Date().toISOString()
              }
            });

            // [SENIOR] Start Heartbeat (15s)
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = setInterval(() => {
              if (SocketService.socket && useGroupCallStore.getState().callId) {
                (SocketService.socket as any).emit('group-call:heartbeat', {
                  callId: useGroupCallStore.getState().callId,
                  attendeeId: attendeeData.AttendeeId,
                });
              }
            }, 15000);
          }
        },
        audioVideoDidStop: (sessionStatus: any) => {
          console.log('[Chime-JS] Group audioVideoDidStop with status:', sessionStatus.statusCode());
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
          cleanup('audioVideoDidStop');
        }
      };

      meetingSession.audioVideo.addObserver(observer);

      meetingSession.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId, present) => {
        const normalizedId = normalizeAttendeeId(attendeeId);
        if (!normalizedId) return;
        
        const isContent = attendeeId.includes('#content');
        if (isContent) return; // We handle content in videoTile updates mostly, or ignore roster presence for it

        console.log(`[Chime-JS] Attendee presence updated: ${normalizedId} -> ${present}`);
        if (present) {
          useGroupCallStore.getState().updateParticipant(normalizedId, { status: 'connected' });
        } else {
          useGroupCallStore.getState().updateParticipant(normalizedId, { status: 'disconnected' });
        }
      });

      // Bind Audio Device
      const devices: any[] = (await mediaDevices.enumerateDevices()) as any[];
      const defaultAudio = devices.find((d: any) => d.kind === 'audioinput');
      if (defaultAudio) {
         await meetingSession.audioVideo.startAudioInput(defaultAudio.deviceId);
      }
      
      if (callType === 'video') {
         isCameraUserEnabled.current = true;
         let defaultVideo = devices.find((d: any) => d.kind === 'videoinput' && d.facing === 'front');
         if (!defaultVideo) defaultVideo = devices.find((d: any) => d.kind === 'videoinput');
         if (defaultVideo) {
            await meetingSession.audioVideo.startVideoInput(defaultVideo.deviceId);
            activeVideoDeviceIdRef.current = defaultVideo.deviceId;
            meetingSession.audioVideo.startLocalVideoTile();
         }
      }

      meetingSession.audioVideo.start();
      isStarted.current = true;
      
    } catch (e) {
      console.error('[Chime-JS] Setup CRASHED:', e);
      cleanup('setup_crash');
    }
  }, [callType, cleanup]);

  const toggleMic = useCallback((on: boolean) => {
    const session = chimeRef.current?.meetingSession;
    if (session) {
      if (on) {
        session.audioVideo.realtimeUnmuteLocalAudio();
      } else {
        session.audioVideo.realtimeMuteLocalAudio();
      }
    }
  }, []);

  const toggleCamera = useCallback(async (on: boolean) => {
      isCameraUserEnabled.current = on;
      const session = chimeRef.current?.meetingSession;
      if (!session) return;
      if (on) {
         const devices: any[] = (await mediaDevices.enumerateDevices()) as any[];
         let targetVideo = devices.find((d: any) => d.deviceId === activeVideoDeviceIdRef.current);
         if (!targetVideo) targetVideo = devices.find((d: any) => d.kind === 'videoinput' && d.facing === 'front');
         if (!targetVideo) targetVideo = devices.find((d: any) => d.kind === 'videoinput');
         
         if (targetVideo) {
            await session.audioVideo.startVideoInput(targetVideo.deviceId);
            activeVideoDeviceIdRef.current = targetVideo.deviceId;
            session.audioVideo.startLocalVideoTile();
         }
      } else {
         session.audioVideo.stopLocalVideoTile();
      }
  }, []);

  const switchCamera = useCallback(async () => {
    const session = chimeRef.current?.meetingSession;
    if (!session) return;
    
    try {
       const devices: any[] = (await mediaDevices.enumerateDevices()) as any[];
       const videoDevices = devices.filter((d: any) => d.kind === 'videoinput');
       
       if (videoDevices.length < 2) return;
       
       const currentIdx = videoDevices.findIndex((d: any) => d.deviceId === activeVideoDeviceIdRef.current);
       const nextIdx = (currentIdx + 1) % videoDevices.length;
       const nextDevice = videoDevices[nextIdx];
       
       await session.audioVideo.startVideoInput(nextDevice.deviceId);
       activeVideoDeviceIdRef.current = nextDevice.deviceId;
    } catch (e) {
       console.error('[Chime-JS] Error switching camera:', e);
    }
  }, []);

  const switchAudioOutput = useCallback(async (useSpeaker: boolean) => {
     console.log('Switch audio output (Group):', useSpeaker);
  }, []);

  return {
    localTileId,
    setupSession,
    cleanup,
    toggleMic,
    toggleCamera,
    switchAudioOutput,
    switchCamera,
    requestPermissions
  };
};
