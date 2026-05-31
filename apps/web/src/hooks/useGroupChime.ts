import { useEffect, useRef, useState, useCallback } from 'react';
import {
  DefaultDeviceController,
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  ConsoleLogger,
  LogLevel,
} from 'amazon-chime-sdk-js';
import { useGroupCallStore } from '../store/groupCallStore';
import { useAuth } from '../context/AuthContext';
import { BackgroundBlurVideoFrameProcessor, DefaultVideoTransformDevice } from 'amazon-chime-sdk-js';

/**
 * [Web-Chime] Normalize Chime attendee IDs (strips modality suffix like #1, #content)
 */
const normalizeAttendeeId = (id?: string | null): string | null => {
  if (!id) return null;
  return id.split('#')[0];
};

export const useGroupChime = () => {
  const { user, socket } = useAuth();
  const {
    meetingData,
    attendeeData,
    activeCallId,
    conversationId,
    addRemoteTile,
    removeRemoteTile,
    setConnected,
    isCameraOn,
    isMicOn,
    setMicOn,
    setCameraOn,
    updateParticipant,
    removeParticipant,
  } = useGroupCallStore();

  const [session, setSession] = useState<DefaultMeetingSession | null>(null);
  const sessionRef = useRef<DefaultMeetingSession | null>(null);
  const deviceControllerRef = useRef<DefaultDeviceController | null>(null);
  const observerRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);

  // [SENIOR] Physical video element singletons for group
  const groupLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const groupRemoteVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const groupContentVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const contentTileIdsRef = useRef<Map<string, number>>(new Map());

  // [FIX #4] Dùng ref để tránh stale closure trong onended handler
  const stopScreenShareRef = useRef<() => Promise<void>>(async () => { });

  // ─────────────────────────────────────────────
  // [FIX #2] Helper cleanup stream độc lập với session
  // Đảm bảo stream luôn được stop dù session null hay không
  // ─────────────────────────────────────────────
  const cleanupScreenShareStream = () => {
    const store = useGroupCallStore.getState();

    if (store.localScreenShareStream) {
      store.localScreenShareStream.getTracks().forEach(t => t.stop());
    }
    store.setLocalScreenSharing(false, null);

    if (attendeeData?.AttendeeId) {
      const myId = normalizeAttendeeId(attendeeData.AttendeeId)?.toLowerCase();
      if (myId) {
        store.setScreenShare(myId, { stream: null, isSharing: false });
        
        // [FIX] Khởi tạo việc xóa tile ngay lập tức thay vì đợi AWS Chime SDK delay
        const tileId = contentTileIdsRef.current.get(myId);
        if (tileId !== undefined) {
          store.removeRemoteTile(tileId);
          delete groupRemoteVideoRefs.current[tileId];
          contentTileIdsRef.current.delete(myId);
        }
      }
    }
  };

  // ─────────────────────────────────────────────
  // [FIX #1] Event-driven content share start, không dùng setTimeout magic number
  // Dùng double requestAnimationFrame để nhường SDK flush 1 tick
  // ─────────────────────────────────────────────
  const startContentShareWhenReady = (stream: MediaStream) => {
    const s = sessionRef.current;
    if (!s) return;

    const tryStart = () => {
      s.audioVideo.startContentShare(stream).catch((e: Error) => {
        console.error('[GroupChime] startContentShare failed:', e);
        cleanupScreenShareStream();
      });
    };

    requestAnimationFrame(() => requestAnimationFrame(tryStart));
  };

  // ─────────────────────────────────────────────
  // [FIX #6] Retry binding content tile với exponential backoff
  // Xử lý trường hợp React ref chưa mount tại thời điểm tile update
  // ─────────────────────────────────────────────
  const tryBindContentTile = (tileId: number, attendeeId: string, attempt = 0) => {
    const el = groupContentVideoRefs.current.get(attendeeId);
    if (el && sessionRef.current) {
      sessionRef.current.audioVideo.bindVideoElement(tileId, el);
      console.log(`[GroupChime] ✅ Content tile=${tileId} bound for ${attendeeId} on attempt ${attempt}`);
    } else if (attempt < 5) {
      setTimeout(() => tryBindContentTile(tileId, attendeeId, attempt + 1), 100 * (attempt + 1));
    } else {
      console.error(`[GroupChime] ❌ Content tile=${tileId} bind failed after 5 attempts`);
    }
  };

  // ─────────────────────────────────────────────
  // Video ref setters
  // ─────────────────────────────────────────────
  const setGroupLocalVideoRef = useCallback((node: HTMLVideoElement | null) => {
    groupLocalVideoRef.current = node;
    const store = useGroupCallStore.getState();
    const localTile = store.remoteTiles.find(t => t.isLocal);
    if (node && sessionRef.current && localTile) {
      sessionRef.current.audioVideo.bindVideoElement(localTile.tileId, node);
    }
  }, []);

  const setGroupRemoteVideoRef = useCallback((tileId: number, node: HTMLVideoElement | null) => {
    groupRemoteVideoRefs.current[tileId] = node;
    if (node && sessionRef.current) {
      sessionRef.current.audioVideo.bindVideoElement(tileId, node);
    }
  }, []);

  const setGroupContentVideoRef = useCallback((attendeeId: string, node: HTMLVideoElement | null) => {
    if (node) {
      groupContentVideoRefs.current.set(attendeeId, node);
      const tid = contentTileIdsRef.current.get(attendeeId);
      if (tid !== undefined && sessionRef.current) {
        console.log(`[GroupChime] 🔗 Binding Content Ref to tile=${tid} for ${attendeeId}`);
        sessionRef.current.audioVideo.bindVideoElement(tid, node);
      }
    } else {
      groupContentVideoRefs.current.delete(attendeeId);
    }
  }, []);

  const rebindAllGroupTiles = () => {
    const s = sessionRef.current;
    if (!s) return;

    const store = useGroupCallStore.getState();

    // 1. Bind Local
    const localTile = store.remoteTiles.find(t => t.isLocal);
    if (localTile && groupLocalVideoRef.current) {
      s.audioVideo.bindVideoElement(localTile.tileId, groupLocalVideoRef.current);
    }

    // 2. Bind Remotes
    store.remoteTiles.forEach(tile => {
      if (tile.isLocal) return;
      const el = groupRemoteVideoRefs.current[tile.tileId];
      if (el) {
        s.audioVideo.bindVideoElement(tile.tileId, el);
      }
    });

    // 3. Bind Content
    contentTileIdsRef.current.forEach((tileId, attendeeId) => {
      const el = groupContentVideoRefs.current.get(attendeeId);
      if (el) {
        s.audioVideo.bindVideoElement(tileId, el);
      }
    });
  };

  // ─────────────────────────────────────────────
  // Setup Session
  // ─────────────────────────────────────────────
  const setupSession = async () => {
    if (!meetingData || !attendeeData || sessionRef.current) return;

    const logger = new ConsoleLogger('GroupChime', LogLevel.ERROR);
    const deviceController = new DefaultDeviceController(logger);
    deviceControllerRef.current = deviceController;
    const configuration = new MeetingSessionConfiguration(meetingData, attendeeData);
    
    // [PREMIUM] Enable Simulcast for Bandwidth Optimization
    configuration.enableSimulcastForUnifiedPlanChromiumBasedBrowsers = true;

    const newSession = new DefaultMeetingSession(configuration, logger, deviceController);

    sessionRef.current = newSession;
    setSession(newSession);

    // [SENIOR] Physical presence mapping handled by socket SSOT
    newSession.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId, present) => {
      if (attendeeId.includes('#')) return; // Ignore modality attendees (like #content)
      
      const { setActiveSpeaker } = useGroupCallStore.getState();

      if (present) {
        updateParticipant(attendeeId, { status: 'connected' });
        
        // [PREMIUM] Active Speaker Detection
        newSession.audioVideo.realtimeSubscribeToVolumeIndicator(
          attendeeId,
          (id: string, volume: number | null, muted: boolean | null, signalStrength: number | null) => {
            if (volume !== null && volume > 0.1 && !muted) {
              const currentActive = useGroupCallStore.getState().activeSpeakerId;
              if (currentActive !== id) {
                setActiveSpeaker(id);
              }
            }
          }
        );
      } else {
        removeParticipant(attendeeId);
        newSession.audioVideo.realtimeUnsubscribeFromVolumeIndicator(attendeeId);
        const currentActive = useGroupCallStore.getState().activeSpeakerId;
        if (currentActive === attendeeId) {
          setActiveSpeaker(null);
        }
      }
    });

    // [PREMIUM] Reactions Receiver
    newSession.audioVideo.realtimeSubscribeToReceiveDataMessage('reaction', (message: any) => {
      try {
        const text = new TextDecoder().decode(message.data);
        const payload = JSON.parse(text);
        const { addReaction } = useGroupCallStore.getState();
        const senderId = message.senderAttendeeId;
        // The sender might have a suffix if it's from a web client sometimes, normalize it
        addReaction(normalizeAttendeeId(senderId) || senderId, payload.emoji);
      } catch (e) {
        console.error('[GroupChime] Failed to parse reaction message', e);
      }
    });

    const observer = {
      audioVideoDidStart: () => {
        console.log('[GroupChime] ✅ AudioVideo Started successfully');
        setConnected();

        // [SENIOR] Start Heartbeat (15s)
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (socket && activeCallId) {
            socket.emit('group-call:heartbeat', {
              callId: activeCallId,
              attendeeId: attendeeData.AttendeeId,
            });
          }
        }, 15000);

        // [SENIOR] Ensure we are in the socket room for this conversation
        if (socket) {
          console.log(`[GroupChime] 🏠 Joining socket room: ${conversationId}`);
          socket.emit('join_room', { convId: conversationId });
        }

        // Notify backend via socket
        if (socket && user?.email) {
          console.log('[GroupChime] 📣 Emitting peer_joined for local user');
          socket.emit('group-call:peer_joined', {
            convId: conversationId,
            callId: activeCallId,
            userEmail: user.email,
            attendeeId: attendeeData.AttendeeId.toLowerCase(),
            participant: {
              email: user.email,
              name: user.fullName || user.name,
              avatar: user.avatarUrl || user.avatar,
              status: 'connected',
            }
          });
        }

        // Initialize mic/camera state from store
        syncMediaState(newSession);

        // [SENIOR] Add Content Share Observer
        newSession.audioVideo.addContentShareObserver({
          contentShareDidStart: () => {
            console.log('[GroupChime] 🖥️ Content Share Started');
          },
          contentShareDidStop: () => {
            console.log('[GroupChime] 🖥️ Content Share Stopped');
            const store = useGroupCallStore.getState();
            store.clearAllScreenShares();
            store.setLocalScreenSharing(false, null);
            setTimeout(() => rebindAllGroupTiles(), 200);
          },
        });
      },

      videoTileDidUpdate: (tileState: any) => {
        const rawAttendeeId = tileState.localTile
          ? attendeeData?.AttendeeId
          : tileState.boundAttendeeId;

        const attendeeId = normalizeAttendeeId(rawAttendeeId)?.toLowerCase();
        if (!attendeeId) return;

        if (tileState.isContent) {
          contentTileIdsRef.current.set(attendeeId, tileState.tileId);
          console.log(`[GroupChime] 📺 CONTENT TILE UPDATE: id=${tileState.tileId} attendee=${attendeeId} active=${tileState.active}`);

          const store = useGroupCallStore.getState();

          if (!tileState.localTile && !store.screenShares[attendeeId]) {
            store.setScreenShare(attendeeId, { stream: null, isSharing: true });
          }

          addRemoteTile({
            tileId: tileState.tileId,
            attendeeId,
            active: true,
            isLocal: tileState.localTile,
            isContent: true,
          });

          // [FIX #6] Dùng retry thay vì bind trực tiếp một lần
          tryBindContentTile(tileState.tileId, attendeeId);
          return;
        }

        addRemoteTile({
          tileId: tileState.tileId,
          attendeeId,
          active: tileState.active,
          isLocal: tileState.localTile,
        });

        if (tileState.localTile && groupLocalVideoRef.current) {
          sessionRef.current?.audioVideo.bindVideoElement(tileState.tileId, groupLocalVideoRef.current);
        } else {
          const el = groupRemoteVideoRefs.current[tileState.tileId];
          if (el) sessionRef.current?.audioVideo.bindVideoElement(tileState.tileId, el);
        }
      },

      videoTileDidRemove: (tileId: number) => {
        removeRemoteTile(tileId);
        delete groupRemoteVideoRefs.current[tileId];

        let removedAttendeeId: string | undefined;
        contentTileIdsRef.current.forEach((tId, aId) => {
          if (tId === tileId) removedAttendeeId = aId;
        });

        if (removedAttendeeId) {
          contentTileIdsRef.current.delete(removedAttendeeId);
          const store = useGroupCallStore.getState();
          store.removeScreenShare(removedAttendeeId);
          setTimeout(() => rebindAllGroupTiles(), 100);
        }
      },

      audioVideoDidStop: (sessionStatus: any) => {
        console.log('[GroupChime] AudioVideo Stopped', sessionStatus);
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      },
    };

    observerRef.current = observer;
    newSession.audioVideo.addObserver(observer);

    // Setup Devices
    try {
      const audioInputs = await newSession.audioVideo.listAudioInputDevices();
      if (audioInputs.length > 0) {
        await newSession.audioVideo.startAudioInput(audioInputs[0].deviceId);
      }

      const videoInputs = await newSession.audioVideo.listVideoInputDevices();
      if (videoInputs.length > 0) {
        await newSession.audioVideo.startVideoInput(videoInputs[0].deviceId);
      }

      // Bind Audio Output
      const audioEl = document.getElementById('group-chime-audio') as HTMLAudioElement;
      if (audioEl) {
        await newSession.audioVideo.bindAudioElement(audioEl);
      }

      // Start the session
      newSession.audioVideo.start();
    } catch (error) {
      console.error('[GroupChime] Setup failed', error);
    }
  };

  const syncMediaState = async (s: DefaultMeetingSession) => {
    if (isMicOn) {
      s.audioVideo.realtimeUnmuteLocalAudio();
    } else {
      s.audioVideo.realtimeMuteLocalAudio();
    }

    if (isCameraOn) {
      s.audioVideo.startLocalVideoTile();
    } else {
      s.audioVideo.stopLocalVideoTile();
    }
  };

  // [PREMIUM] Send Reaction
  const sendReaction = useCallback((emoji: string) => {
    if (sessionRef.current) {
      const payload = JSON.stringify({ emoji });
      sessionRef.current.audioVideo.realtimeSendDataMessage('reaction', payload);
    }
  }, []);

  // ─────────────────────────────────────────────
  // [FIX #5] leaveSession — await content share stop đúng thứ tự
  // ─────────────────────────────────────────────
  const leaveSession = async () => {
    if (!sessionRef.current) return;

    console.log('[GroupChime] 🛑 Stopping session');
    const sessionToStop = sessionRef.current;
    sessionRef.current = null;
    setSession(null);

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    try {
      const store = useGroupCallStore.getState();

      // [FIX #5] Stop content share TRƯỚC, nhường 1 tick cho SDK xử lý
      if (store.isLocalScreenSharing) {
        sessionToStop.audioVideo.stopContentShare();
        await new Promise(res => setTimeout(res, 200));
        cleanupScreenShareStream();
      }

      // Stop media devices song song
      if (groupLocalVideoRef.current?.srcObject) {
        (groupLocalVideoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
        groupLocalVideoRef.current.srcObject = null;
      }

      await Promise.allSettled([
        sessionToStop.audioVideo.stopVideoInput(),
        sessionToStop.audioVideo.stopAudioInput(),
      ]);

      // Stop session sau cùng
      if (observerRef.current) {
        sessionToStop.audioVideo.removeObserver(observerRef.current);
        observerRef.current = null;
      }
      sessionToStop.audioVideo.stop();

      if (deviceControllerRef.current) {
        deviceControllerRef.current.destroy();
        deviceControllerRef.current = null;
      }
    } catch (error) {
      console.error('[GroupChime] Error leaving session:', error);
    }
  };

  const toggleMic = (on: boolean) => {
    if (!sessionRef.current) return;
    if (on) {
      sessionRef.current.audioVideo.realtimeUnmuteLocalAudio();
    } else {
      sessionRef.current.audioVideo.realtimeMuteLocalAudio();
    }
    setMicOn(on);
  };

  const toggleCamera = async (on: boolean) => {
    if (!sessionRef.current) return;
    if (on) {
      const videoInputs = await sessionRef.current.audioVideo.listVideoInputDevices();
      if (videoInputs.length > 0) {
        let videoDevice: any = videoInputs[0].deviceId;
        const { isBlurEnabled } = useGroupCallStore.getState();

        // [PREMIUM] Background Blur
        if (isBlurEnabled) {
          try {
            const blurProcessor = await BackgroundBlurVideoFrameProcessor.create();
            videoDevice = new DefaultVideoTransformDevice(
              new ConsoleLogger('Chime', LogLevel.INFO),
              videoDevice,
              [blurProcessor]
            );
          } catch (e) {
            console.error('[GroupChime] Failed to create background blur processor', e);
          }
        }

        await sessionRef.current.audioVideo.startVideoInput(videoDevice);
      }
      sessionRef.current.audioVideo.startLocalVideoTile();
    } else {
      sessionRef.current.audioVideo.stopLocalVideoTile();
    }
    setCameraOn(on);
  };

  // ─────────────────────────────────────────────
  // [FIX #2 + #3] stopScreenShare — cleanup luôn chạy, không bị chặn bởi session guard
  // ─────────────────────────────────────────────
  const stopScreenShare = async () => {
    try {
      // Gọi SDK nếu session vẫn còn, nhưng KHÔNG early return nếu null
      sessionRef.current?.audioVideo.stopContentShare();
    } catch (e) {
      console.error('[GroupChime] stopContentShare error:', e);
    } finally {
      // [FIX #2] Cleanup stream LUÔN chạy bất kể session state
      cleanupScreenShareStream();
    }
  };

  // ─────────────────────────────────────────────
  // [FIX #3 + #1] startScreenShare — block thay vì clear state người khác
  // ─────────────────────────────────────────────
  const startScreenShare = async () => {
    if (!sessionRef.current) return;

    const store = useGroupCallStore.getState();

    // [FIX #3] Nếu mình đang share → toggle off
    if (store.isLocalScreenSharing) {
      await stopScreenShare();
      return;
    }

    // [FIX #3] Nếu người KHÁC đang share → block, không xóa state của họ
    const someoneElseIsSharing = Object.values(store.screenShares).some(s => s.isSharing);
    if (someoneElseIsSharing) {
      alert("Đang có người khác chia sẻ màn hình. Bạn không thể chia sẻ lúc này.");
      return;
    }

    try {
      console.log('[GroupChime] 🚀 Starting Screen Capture...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // [SENIOR] Disable audio to stabilize negotiation
      });

      // [FIX #4] Dùng ref để tránh stale closure
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShareRef.current();
      };

      store.setLocalScreenSharing(true, stream);

      // [FIX #1] Dùng event-driven thay vì setTimeout 500ms
      startContentShareWhenReady(stream);
    } catch (e: any) {
      console.error('[GroupChime] startScreenShare failed:', e);
      store.setLocalScreenSharing(false, null);
      if (e.name === 'NotAllowedError') {
        alert('Bạn đã từ chối quyền chia sẻ màn hình.');
      }
    }
  };

  // [FIX #4] Giữ stopScreenShareRef luôn trỏ đến version mới nhất của stopScreenShare
  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  });

  // Automatically setup session when data is available
  useEffect(() => {
    if (meetingData && attendeeData && !sessionRef.current) {
      setupSession();
    }
  }, [meetingData, attendeeData]);

  // Handle unmount
  useEffect(() => {
    return () => {
      // Uncomment nếu muốn tự động leave khi component unmount:
      // leaveSession();
    };
  }, []);

  return {
    setupSession,
    leaveSession,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    sendReaction,
    setGroupLocalVideoRef,
    setGroupRemoteVideoRef,
    setGroupContentVideoRef,
    rebindAllGroupTiles,
    session,
  };
};