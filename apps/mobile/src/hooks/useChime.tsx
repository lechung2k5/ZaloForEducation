import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionsAndroid, Platform, Alert, AppState } from 'react-native';
import { useCallStore } from '../store/callStore';
import { chimeRef } from '../utils/chimeRef';
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from 'amazon-chime-sdk-js';
import { mediaDevices } from 'react-native-webrtc';

export const useChime = () => {
  const { meetingData, attendeeData, callType, callState, remoteTiles: globalRemoteTiles } = useCallStore();

  const [localTileId, setLocalTileId] = useState<number | null>(null);
  const isStarted = useRef(false);
  const localTileIdRef = useRef<number | null>(null);
  const activeVideoDeviceIdRef = useRef<string | null>(null);

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
    console.log(`[Chime-JS] Cleaning up session. Reason: ${reason}`);
    
    if (chimeRef.current?.meetingSession) {
      try {
        chimeRef.current.meetingSession.audioVideo.stop();
      } catch (e) {
        console.warn('Error stopping AV:', e);
      }
    }
    
    isStarted.current = false;
    useCallStore.getState().setRemoteTiles([]);
    setLocalTileId(null);
  }, []);

  useEffect(() => {
    if (!chimeRef.current) chimeRef.current = { cleanup };
    else chimeRef.current.cleanup = cleanup;
    
    return () => { 
       cleanup('unmount');
    };
  }, [cleanup]);

  const setupSession = useCallback(async () => {
    if (isStarted.current) return;
    if (!meetingData || !attendeeData) return;

    isStarted.current = true;
    console.log(`[Chime-JS] Setup Starting (Meeting: ${meetingData.MeetingId})...`);
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Thiếu quyền', 'Vui lòng cấp quyền Camera và Micro.');
      isStarted.current = false;
      return;
    }

    try {
      const logger = new ConsoleLogger('MobileChime', LogLevel.INFO);
      const deviceController = new DefaultDeviceController(logger, { enableWebAudio: false });
      const configuration = new MeetingSessionConfiguration(meetingData, attendeeData);
      
      const meetingSession = new DefaultMeetingSession(
        configuration,
        logger,
        deviceController
      );
      
      if (!chimeRef.current) chimeRef.current = { cleanup };
      chimeRef.current.meetingSession = meetingSession;

      const observer = {
        videoTileDidUpdate: (tileState: any) => {
          console.log('[Chime-JS] videoTileDidUpdate:', JSON.stringify({
            tileId: tileState.tileId,
            isLocal: tileState.localTile,
            isContent: tileState.isContent,
            active: tileState.active
          }));
          const isLocal = tileState.localTile;
          const tileId = tileState.tileId;
          const isContent = tileState.isContent;
          
          if (isLocal) {
            setLocalTileId(tileId);
          } else {
            const store = useCallStore.getState();
            const currentTiles = store.remoteTiles;
            const existingIdx = currentTiles.findIndex((t: any) => t.tileId === tileId);
            
            if (existingIdx === -1) {
              store.setRemoteTiles([...currentTiles, { tileId, isLocal: false, isContent }]);
            } else if (currentTiles[existingIdx].isContent !== isContent) {
              const newTiles = [...currentTiles];
              newTiles[existingIdx] = { ...newTiles[existingIdx], isContent };
              store.setRemoteTiles(newTiles);
            }
          }
        },
        videoTileWasRemoved: (tileId: number) => {
          if (tileId === localTileIdRef.current) {
            setLocalTileId(null);
          } else {
            const store = useCallStore.getState();
            store.setRemoteTiles(store.remoteTiles.filter((t: any) => t.tileId !== tileId));
          }
        },
        audioVideoDidStart: () => {
          console.log('[Chime-JS] audioVideoDidStart');
          useCallStore.getState().setConnected();
        },
        audioVideoDidStop: () => {
          console.log('[Chime-JS] audioVideoDidStop');
          isStarted.current = false;
        }
      };

      meetingSession.audioVideo.addObserver(observer);
      
      // Select input devices
      const devices: any[] = (await mediaDevices.enumerateDevices()) as any[];
      const defaultAudio = devices.find((d: any) => d.kind === 'audioinput');
      if (defaultAudio) {
         await meetingSession.audioVideo.startAudioInput(defaultAudio.deviceId);
      }
      
      if (callType === 'video') {
         // Prefer front camera initially
         let defaultVideo = devices.find((d: any) => d.kind === 'videoinput' && d.facing === 'front');
         if (!defaultVideo) defaultVideo = devices.find((d: any) => d.kind === 'videoinput');
         if (defaultVideo) {
            await meetingSession.audioVideo.startVideoInput(defaultVideo.deviceId);
            activeVideoDeviceIdRef.current = defaultVideo.deviceId;
            meetingSession.audioVideo.startLocalVideoTile();
         }
      }

      meetingSession.audioVideo.start();

    } catch (err) {
      console.error('[Chime-JS] Setup CRASHED:', err);
      isStarted.current = false;
    }
  }, [callType, meetingData, attendeeData]);

  useEffect(() => {
    if (meetingData && attendeeData && callState === 'JOINING') {
      setupSession();
    }
  }, [meetingData, attendeeData, callState, setupSession]);

  const isCameraUserEnabled = useRef(callType === 'video');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: any) => {
      if (isStarted.current && chimeRef.current?.meetingSession) {
        if (nextAppState === 'background') {
          chimeRef.current.meetingSession.audioVideo.stopLocalVideoTile();
        } else if (nextAppState === 'active' && isCameraUserEnabled.current) {
          chimeRef.current.meetingSession.audioVideo.startLocalVideoTile();
        }
      }
    });
    return () => subscription.remove();
  }, []);

  return {
    localTileId,
    remoteTiles: globalRemoteTiles,
    cleanup,
    toggleMic: useCallback((on: boolean) => {
       const session = chimeRef.current?.meetingSession;
       if (!session) return;
       if (on) session.audioVideo.realtimeUnmuteLocalAudio();
       else session.audioVideo.realtimeMuteLocalAudio();
    }, []),
    requestCameraPermissionUpgrade: async () => {
      return await requestPermissions();
    },
    toggleCamera: useCallback(async (on: boolean) => {
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
    }, []),
    switchAudioOutput: useCallback((useSpeaker: boolean) => {
       // Not fully supported via JS SDK unless WebAudio is used, 
       // but react-native-incall-manager handles it usually.
       console.log('Switch audio output (JS):', useSpeaker);
    }, []),
    switchCamera: useCallback(async () => {
      const session = chimeRef.current?.meetingSession;
      if (!session) return;
      
      try {
         const devices: any[] = (await mediaDevices.enumerateDevices()) as any[];
         const videoDevices = devices.filter((d: any) => d.kind === 'videoinput');
         
         if (videoDevices.length < 2) {
           console.log('[Chime-JS] Only one camera found, cannot switch');
           return;
         }
         
         const currentIdx = videoDevices.findIndex((d: any) => d.deviceId === activeVideoDeviceIdRef.current);
         const nextIdx = (currentIdx + 1) % videoDevices.length;
         const nextDevice = videoDevices[nextIdx];
         
         console.log(`[Chime-JS] Switching camera from ${activeVideoDeviceIdRef.current} to ${nextDevice.deviceId}`);
         await session.audioVideo.startVideoInput(nextDevice.deviceId);
         activeVideoDeviceIdRef.current = nextDevice.deviceId;
      } catch (e) {
         console.error('[Chime-JS] Error switching camera:', e);
      }
    }, []),
    requestPermissions
  };
};
