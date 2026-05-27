import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { PhoneOff, Video, VideoOff, Mic, MicOff, Monitor, User, MessageSquare, Sparkles, Smile, Hand } from 'lucide-react';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useAuth } from '../../context/AuthContext';
import { useGroupChime } from '../../hooks/useGroupChime';
import api from '../../services/api';
import { playHangupSound } from "../../utils/audioUtils";

const GroupCallOverlay: React.FC = () => {
  const { 
    callState, 
    activeCallId, 
    conversationId, 
    participants, 
    ringingEmails,
    remoteTiles, 
    attendeeData,
    isCameraOn, 
    isMicOn,
    isMinimized,
    toggleMinimized,
    isLocalScreenSharing,
    screenShares,
    resetGroupCall,
    
    // Premium features
    isChatOpen, toggleChat,
    isBlurEnabled, toggleBlur,
  } = useGroupCallStore();

  const { socket, user } = useAuth();
  const { 
    setupSession, 
    leaveSession, 
    toggleMic, 
    toggleCamera, 
    startScreenShare, 
    stopScreenShare, 
    setGroupLocalVideoRef,
    setGroupRemoteVideoRef,
    setGroupContentVideoRef,
    rebindAllGroupTiles,
    sendReaction,
    session 
  } = useGroupChime();
  const ringbackRef = useRef<HTMLAudioElement | null>(null);

  const [focusedStageId, setFocusedStageId] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  useEffect(() => {
    if (!ringbackRef.current) {
      ringbackRef.current = new Audio('/audio_sound/ringback.mp3');
      ringbackRef.current.loop = true;
    }

    const joinedCount = Object.values(participants).filter(p => p.status === 'connected').length;
    const hasRemoteJoined = joinedCount > 0;
    const hasRinging = ringingEmails.length > 0;
    const isJoining = callState === 'JOINING';
    
    if (isJoining || (callState === 'CONNECTED' && !hasRemoteJoined && hasRinging)) {
      ringbackRef.current.play().catch(() => {});
    } else {
      if (ringbackRef.current) {
        ringbackRef.current.pause();
        ringbackRef.current.currentTime = 0;
      }
    }

    return () => {
      if (ringbackRef.current) {
        ringbackRef.current.pause();
      }
    };
  }, [callState, ringingEmails.length, participants]);

  useEffect(() => {
    if (callState === 'JOINING' || (callState === 'CONNECTED' && !session)) {
      setupSession();
    }
  }, [callState]);

  const activeShare = Object.entries(screenShares).find(([_, s]) => s.isSharing);
  const someoneIsSharing = !!activeShare || isLocalScreenSharing;

  useEffect(() => {
    if (callState === 'CONNECTED') {
      const timer = setTimeout(() => {
        rebindAllGroupTiles();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [someoneIsSharing, callState]);

  const handleHangup = async () => {
    playHangupSound();

    if (!user?.email || !attendeeData?.AttendeeId) {
      // If clicked while still initiating, just force close UI
      resetGroupCall();
      return;
    }

    if (socket && conversationId && activeCallId) {
      socket.emit('group-call:hangup', {
        convId: conversationId,
        callId: activeCallId,
        userEmail: user.email,
        attendeeId: attendeeData.AttendeeId
      });
    }

    try {
      await api.post('/group-call/hangup', { 
        conversationId, 
        callId: activeCallId,
        attendeeId: attendeeData.AttendeeId 
      });
    } catch (e) {}

    await leaveSession();
    resetGroupCall();
  };

  const availableStreams = useMemo(() => {
    let items: any[] = [];
    
    // 1. Add all active video tiles
    remoteTiles.forEach(tile => {
      const attendeeId = (tile.attendeeId || "").toLowerCase();
      const p = participants[attendeeId];

      items.push({
        id: tile.isLocal ? (tile.isContent ? 'local-content' : 'local-camera') : (tile.isContent ? `remote-content-${attendeeId}` : `remote-camera-${attendeeId}`),
        attendeeId: attendeeId,
        email: p?.email || (tile.isLocal ? user?.email : 'unknown'),
        name: p?.name || (tile.isLocal ? (user?.fullName || 'Bạn') : null),
        avatar: p?.avatar || (tile.isLocal ? user?.avatarUrl : null),
        tileId: tile.tileId,
        isVideoActive: tile.active,
        isLocal: tile.isLocal,
        isContent: tile.isContent,
        status: 'connected'
      });
    });

    // 2. Add connected participants who DON'T have a video tile (camera off)
    Object.entries(participants || {}).forEach(([id, p]) => {
      if (!id || !p) return;
      if (p.status === 'disconnected' || p.status === 'left') return; 
      
      const attendeeId = id.toLowerCase();
      const hasTile = remoteTiles.some(t => t.attendeeId && t.attendeeId.toLowerCase() === attendeeId && !t.isContent);
      if (!hasTile) {
        items.push({
          id: attendeeId === (attendeeData?.AttendeeId || "").toLowerCase() ? 'local-camera' : `remote-camera-${attendeeId}`,
          attendeeId: attendeeId,
          ...p,
          isVideoActive: attendeeId === (attendeeData?.AttendeeId || "").toLowerCase() ? isCameraOn : false,
          isLocal: attendeeId === (attendeeData?.AttendeeId || "").toLowerCase(),
          isContent: false,
          status: 'connected'
        });
      }
    });    // 3. (Removed ringing emails rendering as cards based on user feedback)

    // 4. Local screen share (if no tile yet)
    if (isLocalScreenSharing && !items.some(i => i.id === 'local-content')) {
        items.push({
            id: 'local-content',
            isLocal: true,
            isContent: true,
            isVideoActive: true,
            name: user?.fullName || 'Bạn',
            email: user?.email,
            status: 'connected'
        });
    }

    // 5. Remote screen share (if no tile yet but sharing state true)
    Object.entries(screenShares).forEach(([id, share]) => {
        if (share.isSharing && !items.some(i => i.id === `remote-content-${id}`)) {
            const p = participants[id];
            items.push({
                id: `remote-content-${id}`,
                isLocal: false,
                isContent: true,
                isVideoActive: false,
                name: p?.name || 'Unknown',
                email: p?.email,
                status: 'connected',
                attendeeId: id
            });
        }
    });

    // Deduplicate to prevent React key errors
    const uniqueItems = new Map();
    items.forEach(item => uniqueItems.set(item.id, item));
    return Array.from(uniqueItems.values());
  }, [remoteTiles, participants, ringingEmails, user, attendeeData, isLocalScreenSharing, screenShares]);

  useEffect(() => {
    const currentFocus = availableStreams.find(s => s.id === focusedStageId);
    if (!currentFocus && availableStreams.length > 0) {
      const firstScreen = availableStreams.find(s => s.isContent);
      setFocusedStageId(firstScreen ? firstScreen.id : null);
    } else if (!currentFocus) {
      setFocusedStageId(null);
    }
  }, [availableStreams, focusedStageId]);

  const handleToggleScreenShare = async () => {
    if (isLocalScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  const focusedStream = availableStreams.find(s => s.id === focusedStageId);
  const gridStreams = focusedStream ? availableStreams.filter(s => s.id !== focusedStageId) : availableStreams;

  // [PREMIUM] Auto-pin active speaker if no screen share and no manual pin
  useEffect(() => {
    const { activeSpeakerId } = useGroupCallStore.getState();
    if (!focusedStageId && activeSpeakerId && gridStreams.length > 2) {
      const speakerStream = availableStreams.find(s => s.attendeeId === activeSpeakerId && !s.isContent);
      if (speakerStream) setFocusedStageId(speakerStream.id);
    }
  }, [availableStreams, focusedStageId, useGroupCallStore.getState().activeSpeakerId, gridStreams.length]);

  if (callState === 'IDLE') return null;

  return (
    <>
      {/* Audio element for incoming mixed audio from AWS Chime */}
      <audio id="group-chime-audio" style={{ display: 'none' }} autoPlay />

      {isMinimized ? (
        <div 
          onClick={() => toggleMinimized(false)}
          className="fixed bottom-6 right-6 z-[999] w-[280px] bg-[#1a1a1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all animate-in slide-in-from-bottom-5"
        >
        <div className="p-4 flex items-center justify-between bg-gradient-to-r from-blue-600/20 to-indigo-600/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white shadow-lg">
              {Object.values(participants).filter(p => p.status !== 'ringing').length}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white/90">Cuộc gọi nhóm</span>
              <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Đang diễn ra</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
             <button 
               onClick={(e) => { e.stopPropagation(); toggleMic(!isMicOn); }}
               className={`p-2 rounded-lg ${isMicOn ? 'text-white/70 hover:bg-white/10' : 'text-red-400 bg-red-400/10'}`}
             >
               {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); handleHangup(); }}
               className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
             >
               <PhoneOff size={16} />
             </button>
          </div>
        </div>
        {isCameraOn && availableStreams.length > 0 && (
          <div className="aspect-video bg-black relative">
            <VideoTile 
              item={availableStreams.find(s => s.isLocal && !s.isContent) || availableStreams[0]} 
              isMinimized 
              setLocalRef={setGroupLocalVideoRef}
              setRemoteRef={setGroupRemoteVideoRef}
              setContentRef={setGroupContentVideoRef}
            />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          </div>
        )}
      </div>
      ) : (
      <div className={`fixed top-0 bottom-0 left-0 ${isChatOpen ? 'right-[350px] shadow-[10px_0_30px_rgba(0,0,0,0.5)]' : 'right-0'} z-[999] bg-[#0a0a0c] text-white flex flex-col font-sans transition-all duration-300 border-r border-white/5`}>
        {/* Header */}
      <div className="p-6 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-xl font-bold">Cuộc gọi nhóm</h2>
          <p className="text-sm text-white/50">{Object.values(participants).filter(p => p.status !== 'ringing').length} đang tham gia</p>
        </div>
        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={() => toggleMinimized(true)}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group"
            title="Thu nhỏ"
          >
            <div className="w-5 h-1 bg-white/40 group-hover:bg-white rounded-full" />
          </button>
          <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-mono">
             {callState}
          </div>
        </div>
      </div>
 
      {/* Video Layout */}
      <div className="grow px-6 overflow-hidden flex flex-col md:flex-row gap-6">
        {/* Main Stage */}
        {focusedStream && (
           <div 
            className="grow bg-[#1a1a1e] rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl flex items-center justify-center cursor-pointer group animate-in zoom-in-95 duration-500" 
            onClick={() => setFocusedStageId(null)}
           >
              <VideoTile 
                key={focusedStream.id} 
                item={focusedStream} 
                setLocalRef={setGroupLocalVideoRef}
                setRemoteRef={setGroupRemoteVideoRef}
                setContentRef={setGroupContentVideoRef}
              />
              <div className="absolute top-4 left-4 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {focusedStream.isContent ? <Monitor size={16} className="text-blue-400" /> : <User size={16} className="text-blue-400" />}
                <span className="text-xs font-bold text-white/90">
                  {focusedStream.name}
                </span>
              </div>
           </div>
        )}

        {/* Sidebar/Grid */}
        <div className={`${focusedStream ? 'w-full md:w-[320px] lg:w-[400px] shrink-0 overflow-y-auto pr-2' : 'grow overflow-y-auto'}`}>
            <div className={`grid gap-4 ${focusedStream ? 'grid-cols-2 md:grid-cols-1 auto-rows-[200px]' : 'grid-cols-[repeat(auto-fit,minmax(280px,1fr))] auto-rows-[250px] lg:auto-rows-[300px]'}`}>
                {gridStreams.map((item) => (
                    <div key={item.id} onClick={() => setFocusedStageId(item.id)} className="cursor-pointer h-full min-h-[200px] relative">
                        <VideoTile 
                            item={item} 
                            setLocalRef={setGroupLocalVideoRef}
                            setRemoteRef={setGroupRemoteVideoRef}
                            setContentRef={setGroupContentVideoRef}
                        />
                        {/* Overlay to indicate it is clickable if not focused */}
                        {!focusedStream && (
                          <div className="absolute inset-0 bg-white/0 hover:bg-white/5 transition-colors rounded-3xl z-20 pointer-events-none" />
                        )}
                    </div>
                ))}

                {gridStreams.length === 0 && !focusedStream && ringingEmails.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center text-white/20 uppercase tracking-widest text-sm py-20">
                        <div className="w-20 h-20 border-2 border-dashed border-white/10 rounded-full flex items-center justify-center mb-4">
                            <VideoOff size={32} />
                        </div>
                        Đang kết nối...
                    </div>
                )}

                {gridStreams.length === 1 && !focusedStream && ringingEmails.length > 0 && (
                    <div className="col-span-full mt-10 flex flex-col items-center justify-center animate-pulse">
                        <span className="px-6 py-3 bg-white/5 rounded-full text-white/60 font-medium text-[13px] border border-white/10 shadow-xl">
                            Đang chờ những người khác tham gia...
                        </span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-8 pb-10 flex justify-center items-center gap-6 bg-gradient-to-t from-black/80 to-transparent">
        <button 
          onClick={() => toggleMic(!isMicOn)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMicOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 shadow-lg shadow-red-500/20'}`}
        >
          {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button 
          onClick={handleHangup}
          className="w-16 h-16 bg-red-600 hover:bg-red-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-600/40 transition-transform active:scale-90"
        >
          <PhoneOff size={28} />
        </button>

        <button 
          onClick={handleToggleScreenShare}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isLocalScreenSharing ? 'bg-blue-500 shadow-lg shadow-blue-500/20' : 'bg-white/10 hover:bg-white/20'}`}
          title="Chia sẻ màn hình"
        >
          <Monitor size={24} />
        </button>

        <button 
          onClick={() => toggleCamera(!isCameraOn)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isCameraOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 shadow-lg shadow-red-500/20'}`}
        >
          {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        {/* [PREMIUM] Reactions */}
        <div className="relative">
          <button 
            onClick={() => setShowReactions(!showReactions)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${showReactions ? 'bg-white/20 shadow-lg' : 'bg-white/10 hover:bg-white/20'}`}
          >
            <Smile size={24} />
          </button>
          
          {showReactions && (
            <>
              {/* Click outside overlay */}
              <div 
                className="fixed inset-0 z-40 cursor-default" 
                onClick={() => setShowReactions(false)} 
              />
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-[#1a1a1e] border border-white/10 rounded-2xl p-2 flex gap-2 shadow-2xl z-50 animate-in slide-in-from-bottom-2 fade-in">
                 {['👍', '❤️', '😂', '✋'].map(emoji => (
                   <button 
                     key={emoji} 
                     onClick={() => {
                       sendReaction(emoji);
                       setShowReactions(false);
                     }}
                     className="w-10 h-10 hover:bg-white/10 rounded-xl text-2xl flex items-center justify-center transition-transform hover:scale-125"
                   >
                     {emoji}
                   </button>
                 ))}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
      )}
    </>
  );
};

const VideoTile: React.FC<{ 
  item: any; 
  isMinimized?: boolean;
  setLocalRef?: (node: HTMLVideoElement | null) => void;
  setRemoteRef?: (tileId: number, node: HTMLVideoElement | null) => void;
  setContentRef?: (attendeeId: string, node: HTMLVideoElement | null) => void;
}> = ({ item, isMinimized, setLocalRef, setRemoteRef, setContentRef }) => {
  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    if (item.isContent) {
        if (item.isLocal) {
            const currentStream = useGroupCallStore.getState().localScreenShareStream;
            if (node && currentStream && node.srcObject !== currentStream) {
                node.srcObject = currentStream;
                node.muted = true;
                node.play().catch(() => {});
            }
        } else if (item.attendeeId) {
            setContentRef?.(item.attendeeId, node);
        }
    } else if (item.isLocal) {
      setLocalRef?.(node);
    } else if (item.tileId !== undefined) {
      setRemoteRef?.(item.tileId, node);
    }
  }, [item.isLocal, item.isContent, item.tileId, item.attendeeId, setLocalRef, setRemoteRef, setContentRef]);

  const displayName = item.isLocal 
    ? (item.isContent ? 'Màn hình của bạn' : 'Bạn') 
    : (item.name || (item.email ? item.email.split('@')[0] : 'Người dùng'));
  
  const finalName = item.isContent && !item.isLocal 
    ? `${displayName} (Đang chia sẻ)` 
    : displayName;

  const initials = (item.name || item.email || '?').charAt(0).toUpperCase();

  // [PREMIUM]
  const { activeSpeakerId, reactions } = useGroupCallStore();
  const isActiveSpeaker = activeSpeakerId === item.attendeeId && !item.isContent;
  const userReactions = reactions.filter(r => r.attendeeId === item.attendeeId);

  if (isMinimized) {
    return (
      <div className="w-full h-full bg-black">
        <video 
          ref={videoRef} 
          className={`w-full h-full object-cover ${item.isLocal && !item.isContent ? 'scale-x-[-1]' : ''}`} 
          autoPlay 
          muted={item.isLocal} 
          playsInline 
        />
        {!item.isVideoActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1e]">
            {item.avatar ? (
              <img src={item.avatar} alt={initials} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-xl font-bold text-blue-400">
                {initials}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 w-full h-full bg-[#1a1a1e] rounded-3xl overflow-hidden border transition-all duration-300 ${isActiveSpeaker ? 'border-green-500 ring-4 ring-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-white/5 shadow-2xl'}`}>
      
      {/* [PREMIUM] Reactions Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-50">
        {userReactions.map(r => (
           <div key={r.id} className="text-4xl animate-in slide-in-from-bottom-10 fade-in duration-500 zoom-in">
             {r.emoji}
           </div>
        ))}
      </div>

      {/* Video Element */}
      <video 
        ref={videoRef} 
        className={`w-full h-full transition-opacity duration-500 ${item.isContent ? 'object-contain' : 'object-cover'} ${item.isVideoActive ? 'opacity-100' : 'opacity-0'} ${item.isLocal && !item.isContent ? 'scale-x-[-1]' : ''}`} 
        autoPlay 
        muted={item.isLocal} 
        playsInline 
      />

      {/* Placeholder / Camera Off State */}
      {!item.isVideoActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
          {item.avatar ? (
            <img 
              src={item.avatar} 
              alt={initials} 
              className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border border-blue-500/20 shadow-lg shadow-blue-500/10 ring-4 ring-white/5" 
            />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-4xl font-bold text-blue-400 shadow-lg shadow-blue-500/10 ring-4 ring-white/5">
              {initials}
            </div>
          )}
          <span className="mt-4 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] text-center px-4">
            {item.status === 'ringing' ? 'Đang đổ chuông...' : (item.isContent ? 'Đang kết nối...' : 'Camera đang tắt')}
          </span>
        </div>
      )}

      {/* Identity Badge */}
      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-xl rounded-xl text-[13px] font-medium border border-white/10 flex items-center gap-2.5 max-w-[85%] transition-transform">
        <div className={`w-2 h-2 rounded-full shrink-0 ${item.isVideoActive ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-white/20'} ${isActiveSpeaker ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : ''}`} />
        <span className="truncate text-white/90">
          {finalName}
        </span>
        {/* [PREMIUM] Mic Icon for Active Speaker */}
        {isActiveSpeaker && <Mic size={14} className="text-green-400 shrink-0 animate-pulse" />}
      </div>

      {/* Connection Indicator for remote users */}
      {!item.isLocal && item.status === 'connected' && !item.isVideoActive && (
        <div className="absolute top-4 right-4">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default GroupCallOverlay;
