/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AlertCircle,
  AudioLines,
  Download,
  FileDigit,
  FileImage,
  FileText,
  Forward,
  Loader2,
  MoreHorizontal,
  Music,
  Pin,
  Quote,
  ThumbsUp,
  Video,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useCallStore } from "../../store/callStore";
import { useChatStore } from "../../store/chatStore";
import {
  formatFileSize,
  getDisplayAvatar,
  getDisplayName,
  normalizeAttachment,
  truncateFileName,
} from "../../utils/chatUtils";
import { useCallActions } from "../../hooks/useCallActions";
import SystemCallMessageItem from "./SystemCallMessageItem";
import PollMessage from "./PollMessage";
import ReminderMessage from "./ReminderMessage";
import CodeSnippet from "./CodeSnippet";
import api from "../../services/api";
import Swal from "sweetalert2";
import { Users } from "lucide-react";

interface MessageBubbleProps {
  message: any;
  onContextMenu: (message: any, x: number, y: number) => void;
  userProfiles: Record<string, any>;
  hideTime?: boolean;
  onReply: (message: any) => void;
  onForward?: (message: any) => void;
  isConsecutive?: boolean;
  activeConvId?: string;
  onVotePoll?: (messageId: string, optionIndex: number) => Promise<void>;
}

const FLUENT_EMOJI_MAP: Record<string, string> = {
  "👍": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Thumbs%20Up/3D/thumbs_up_3d.png",
  "❤️": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Red%20Heart/3D/red_heart_3d.png",
  "😄": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Grinning%20Face%20with%20Big%20Eyes/3D/grinning_face_with_big_eyes_3d.png",
  "😮": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Face%20with%20Open%20Mouth/3D/face_with_open_mouth_3d.png",
  "😭": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Loudly%20Crying%20Face/3D/loudly_crying_face_3d.png",
  "😡": "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Enraged%20Face/3D/enraged_face_3d.png",
};

// URL-encode spaces for all links
Object.keys(FLUENT_EMOJI_MAP).forEach((key) => {
  FLUENT_EMOJI_MAP[key] = FLUENT_EMOJI_MAP[key].replace(/ /g, "%20");
});

const WebAudioPlayer: React.FC<{ src: string; title?: string; allowDownload?: boolean }> = ({ src, title = "Tin nhắn thoại", allowDownload = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (isFinite(d)) {
        setDuration(d);
      }
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || !isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 w-[280px] md:w-[340px] max-w-full bg-white/80 dark:bg-surface-container-high/80 border border-primary/20 rounded-2xl shadow-sm hover:shadow-md transition-all group">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${error ? "bg-error/10 text-error" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"}`}
      >
        {error ? (
          <AlertCircle size={20} />
        ) : (
          <AudioLines size={20} className="animate-pulse-slow" />
        )}
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <p className="text-[11px] font-extrabold text-primary/80 uppercase tracking-wider truncate mr-2" title={title}>
            {title}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold opacity-60">
              {duration ? formatTime(duration) : "--:--"}
            </span>
            {allowDownload && (
              <a
                href={src}
                download
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:text-primary/80 transition-colors"
                title="Tải xuống"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
              </a>
            )}
          </div>
        </div>
        <audio
          ref={audioRef}
          controls
          controlsList={allowDownload ? undefined : "nodownload"}
          preload="metadata"
          className="w-full h-8 brightness-95 contrast-125 focus:outline-none"
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => setError(true)}
          src={src}
        />
        {error && (
          <p className="text-[9px] text-error font-bold italic">
            Không thể phát tệp này
          </p>
        )}
      </div>
    </div>
  );
};

const GroupInviteBubble: React.FC<{ groupId: string }> = ({ groupId }) => {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await api.get(`/chat/conversations/${encodeURIComponent(groupId)}/preview`);
        setPreview(res.data);
      } catch (err) {
        console.error("Failed to fetch group preview", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [groupId]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await api.post(`/chat/conversations/${encodeURIComponent(groupId)}/join`);
      await useChatStore.getState().fetchConversation(groupId);
      
      if (res.data?.message === "Đã là thành viên") {
        Swal.fire({
          title: "Thông báo",
          text: "Bạn đã là thành viên của nhóm này!",
          icon: "info",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          title: "Thành công",
          text: "Bạn đã tham gia nhóm thành công!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
      navigate(`/chat?id=${encodeURIComponent(groupId)}`);
    } catch (err: any) {
      Swal.fire("Lỗi", err.response?.data?.message || "Không thể tham gia nhóm", "error");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl shadow-sm w-[250px]">
        <Loader2 size={16} className="animate-spin text-primary" />
        <span className="text-[12px] text-on-surface-variant font-medium">Đang tải thông tin nhóm...</span>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="flex flex-col gap-3 p-4 bg-white dark:bg-surface-container border border-outline-variant/20 rounded-2xl shadow-sm w-[280px] max-w-full">
      <div className="flex items-center gap-3">
        <img
          src={preview.avatarUrl || "/avatar_placeholder.png"}
          alt={preview.name}
          className="w-12 h-12 rounded-full object-cover shadow-sm ring-1 ring-black/5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-on-surface truncate">{preview.name}</p>
          <div className="flex items-center gap-1 text-[11px] font-medium text-on-surface-variant mt-0.5">
            <Users size={12} />
            <span>{preview.memberCount} thành viên</span>
          </div>
        </div>
      </div>
      <button
        onClick={handleJoin}
        disabled={joining}
        className="w-full py-2 bg-primary hover:bg-primary/90 text-white text-[13px] font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        {joining ? <Loader2 size={16} className="animate-spin" /> : "Tham gia ngay"}
      </button>
    </div>
  );
};

const FluentEmoji: React.FC<{
  emoji: string;
  className?: string;
  alt?: string;
}> = ({ emoji, className, alt }) => {
  const [failed, setFailed] = useState(false);
  const url = FLUENT_EMOJI_MAP[emoji];

  if (failed || !url) return <span className={className}>{emoji}</span>;

  return (
    <img
      src={url}
      className={className}
      alt={alt || emoji}
      onError={() => setFailed(true)}
    />
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onContextMenu,
  userProfiles,
  onReply,
  onForward,
  isConsecutive,
  onVotePoll,
}) => {
  // --- HOOKS (Must be at the top level) ---
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCallOverlayActive = useCallStore(
    (state) => state.callState === "CONNECTED" || state.callState === "JOINING",
  );
  const {
    patchMessageOptimistic,
    activeConvId,
    highlightedMessageId,
    setPreviewImage,
    startDirectChat,
    tags,
    loadUserProfile,
  } = useChatStore();
  const { startCall, joinGroupCall } = useCallActions();
  const [isMenuReactionOpen, setIsMenuReactionOpen] = useState(false);
  const reactionDockRef = useRef<HTMLDivElement | null>(null);

  // Load autoDownload settings once
  const [autoDownload, setAutoDownload] = useState(true);
  const [revealedMedia, setRevealedMedia] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mobile_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.autoDownloadMedia === false) {
          setAutoDownload(false);
        }
      }
    } catch (e) {
      console.error("Failed to parse settings in MessageBubble", e);
    }
  }, []);

  const renderTextWithMentions = (
    text: string,
    mentions?: Array<{ email: string; displayName?: string; start?: number; end?: number }>,
  ) => {
    const processLinks = (input: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const linkParts = [];
      let linkLastIndex = 0;
      let linkMatch;
      while ((linkMatch = urlRegex.exec(input)) !== null) {
        if (linkMatch.index > linkLastIndex) {
          linkParts.push(input.substring(linkLastIndex, linkMatch.index));
        }
        linkParts.push(
          <a
            key={`link-${linkMatch.index}-${Math.random()}`}
            href={linkMatch[1]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline hover:text-primary-dark cursor-pointer break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {linkMatch[1]}
          </a>
        );
        linkLastIndex = urlRegex.lastIndex;
      }
      if (linkLastIndex < input.length) {
        linkParts.push(input.substring(linkLastIndex));
      }
      return linkParts.length > 0 ? linkParts : input;
    };

    if (!mentions || mentions.length === 0) return processLinks(text);

    const nameMap = new Map<string, string>();
    mentions.forEach((m) => {
      const name = m.displayName || getDisplayName(m.email, user, userProfiles);
      if (name) {
        nameMap.set(name, m.email);
      }
    });

    const sortedNames = Array.from(nameMap.keys()).sort((a, b) => b.length - a.length);
    if (sortedNames.length === 0) return processLinks(text);

    const escapedNames = sortedNames.map((name) =>
      name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),
    );
    const regex = new RegExp(`@(${escapedNames.join("|")})(?=$|[\\s.,!?;:])`, "g");

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchedName = match[1];
      const email = nameMap.get(matchedName);

      if (matchIndex > lastIndex) {
        parts.push(...(Array.isArray(processLinks(text.substring(lastIndex, matchIndex))) ? processLinks(text.substring(lastIndex, matchIndex)) : [processLinks(text.substring(lastIndex, matchIndex))]));
      }

      const isAllMention = email === "all";
      const isMe = isAllMention || email === user?.email;
      parts.push(
        <span
          key={`mention-${matchIndex}`}
          onClick={() => {
            if (email && email !== "all") {
              navigate(`/profile?email=${encodeURIComponent(email)}`);
            }
          }}
          className={`font-extrabold rounded-md px-1 cursor-pointer transition-all hover:underline inline-block ${
            isMe
              ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-1 ring-amber-300/30"
              : "text-primary hover:text-primary-dark"
          }`}
        >
          @{matchedName}
        </span>,
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(...(Array.isArray(processLinks(text.substring(lastIndex))) ? processLinks(text.substring(lastIndex)) : [processLinks(text.substring(lastIndex))]));
    }

    return parts.length > 0 ? parts : processLinks(text);
  };

  // Use state to track conversation/message changes and reset reaction dock
  // This is a safe way to handle state resets based on prop changes
  const [prevConvId, setPrevConvId] = useState(activeConvId);
  const [prevMsgId, setPrevMsgId] = useState(message.id);
  const [prevCallOverlay, setPrevCallOverlay] = useState(isCallOverlayActive);

  // Sync state with props in a safe way
  if (activeConvId !== prevConvId || message.id !== prevMsgId) {
    setPrevConvId(activeConvId);
    setPrevMsgId(message.id);
    setIsMenuReactionOpen(false);
  }
  if (isCallOverlayActive !== prevCallOverlay) {
    setPrevCallOverlay(isCallOverlayActive);
    if (isCallOverlayActive) {
      setIsMenuReactionOpen(false);
    }
  }

  useEffect(() => {
    if (!isMenuReactionOpen) return;

    const closePicker = () => {
      setIsMenuReactionOpen(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        closePicker();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const node = reactionDockRef.current;
      if (!node) return;
      if (event.target instanceof Node && !node.contains(event.target)) {
        closePicker();
      }
    };

    window.addEventListener("blur", closePicker);
    window.addEventListener("scroll", closePicker, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("blur", closePicker);
      window.removeEventListener("scroll", closePicker, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isMenuReactionOpen]);

  useEffect(() => {
    if (message.type === "system") {
      try {
        const parsed = JSON.parse(message.content);
        if (parsed.actor && parsed.actor !== "system") {
          loadUserProfile(parsed.actor);
        }
        if (parsed.target) {
          loadUserProfile(parsed.target);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [message.type, message.content, loadUserProfile]);

  // --- UTILS & DATA (No hooks here) ---
  const isVideoMedia = (mediaItem: any) => {
    const mime = String(
      mediaItem?.mimeType || mediaItem?.fileType || "",
    ).toLowerCase();
    const name = String(
      mediaItem?.name ||
        mediaItem?.fileName ||
        mediaItem?.url ||
        mediaItem?.dataUrl ||
        "",
    ).toLowerCase();
    return (
      mime.startsWith("video/") ||
      /\.(mp4|mov|avi|wmv|webm|mkv)(\?.*)?$/.test(name)
    );
  };

  const isStickerMedia = (mediaItem: any) => {
    const mime = String(
      mediaItem?.mimeType || mediaItem?.fileType || "",
    ).toLowerCase();
    return mime.includes("sticker") || mediaItem?.isSticker === true;
  };

  const isAudioFile = (fileItem: any) => {
    const mime = String(
      fileItem?.mimeType || fileItem?.fileType || "",
    ).toLowerCase();
    const name = String(
      fileItem?.name || fileItem?.fileName || "",
    ).toLowerCase();
    return (
      mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(name)
    );
  };

  const isMe = message.senderId === user?.email;
  const isRecalled = !!message.recalled;
  const isPinned = !!message.pinned;
  const isHighlighted = highlightedMessageId === message.id;

  const isMediaOnly = (() => {
    if (!message.content) return true;
    const placeholders = [
      "[Hình ảnh]",
      "[Tin nhắn thoại]",
      "[Ghi âm]",
      "[Tệp tin]",
      "[Ảnh/Video]",
    ];
    if (placeholders.includes(message.content)) {
      return (
        (message.media && message.media.length > 0) ||
        (message.files && message.files.some(isAudioFile)) ||
        !!message.audioUrl
      );
    }
    return false;
  })();

  const isSticker = (() => {
    if (message.media && message.media.length === 1) {
      return isStickerMedia(message.media[0]);
    }
    return false;
  })();

  const shouldHideBubble = isMediaOnly || isSticker;
  const hasReactions = !!(
    message.reactions &&
    Object.keys(message.reactions).length > 0 &&
    !isRecalled
  );

  const bubbleClass = isMe
    ? "bg-primary/15 text-on-surface shadow-[0_2px_12px_rgba(var(--color-primary-rgb),0.08)] rounded-[22px] rounded-tr-[4px] border border-primary/20"
    : "bg-white dark:bg-surface-container-high text-on-surface shadow-[0_2px_12px_rgba(0,0,0,0.03)] rounded-[22px] rounded-tl-[4px] border border-outline-variant/10";

  const handleReact = (emoji: string, action: "add" | "remove" = "add") => {
    if (isCallOverlayActive) return;
    if (!activeConvId) return;

    patchMessageOptimistic(activeConvId, message.id, {
      action: "react",
      reactAction: action,
      emoji,
    });
  };

  const handleOpenSenderProfile = () => {
    if (isMe || !message.senderId) return;
    navigate(`/profile?email=${encodeURIComponent(message.senderId)}`);
  };

  const FileIconComponent = ({ fileName }: { fileName: string }) => {
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i))
      return <FileImage size={24} />;
    if (fileName.match(/\.(mp4|mov|avi|wmv)$/i)) return <Video size={24} />;
    if (fileName.match(/\.(mp3|wav|ogg|m4a)$/i)) return <Music size={24} />;
    if (fileName.match(/\.(zip|rar|7z|tar)$/i)) return <FileDigit size={24} />;
    return <FileText size={24} />;
  };

  if (
    message.type === "system" ||
    message.type === "SYSTEM_CALL" ||
    message.type === "call"
  ) {
    if (
      message.type === "SYSTEM_CALL" ||
      message.type === "call" ||
      (message.type === "system" && message.content?.includes("Cuộc gọi"))
    ) {
      return (
        <SystemCallMessageItem
          message={message}
          currentUserEmail={user?.email || ""}
          onCallBack={(type) => {
            startCall(type);
          }}
          onJoinCall={(callId, type) => {
            joinGroupCall(activeConvId!, callId, type);
          }}
        />
      );
    }

    let displayContent = message.content;
    try {
      const parsed = JSON.parse(message.content);
      if (parsed.action) {
        const actorName = getDisplayName(parsed.actor, user, userProfiles);
        const rawTarget = parsed.target
          ? String(parsed.target).trim().toLowerCase()
          : "";
        const targetName = parsed.target
          ? getDisplayName(parsed.target, user, userProfiles)
          : "";
        const isActorMe =
          String(parsed.actor || "").trim().toLowerCase() ===
          String(user?.email || "")
            .trim()
            .toLowerCase();
        const actorLabel = isActorMe ? "Bạn" : actorName;
        const targetLabel =
          rawTarget &&
          user?.email &&
          rawTarget === String(user.email).trim().toLowerCase()
            ? "bạn"
            : targetName;

        switch (parsed.action) {
          case "member_added":
            displayContent = `${actorLabel} đã thêm ${targetLabel} vào nhóm`;
            break;
          case "member_removed":
          case "member_kicked":
            displayContent = `${actorLabel} đã xóa ${targetLabel} khỏi nhóm`;
            break;
          case "member_left":
            displayContent = `${actorLabel} đã rời nhóm`;
            break;
          case "member_joined_link":
            displayContent = `${actorLabel} đã tham gia nhóm bằng link`;
            break;
          case "role_updated":
          case "promoted_to_deputy":
          case "demoted_to_member":
          case "transferred_owner":
          case "demoted_from_deputy":
          case "ownership_transferred": {
            const role = parsed.role || (parsed.action === "promoted_to_deputy" ? "deputy" : (parsed.action === "transferred_owner" || parsed.action === "ownership_transferred") ? "owner" : "member");
            if (role === "owner") {
              displayContent = `${actorLabel} đã chuyển quyền trưởng nhóm cho ${targetLabel}`;
            } else if (role === "deputy") {
              displayContent = `${actorLabel} đã đặt ${targetLabel} làm phó nhóm`;
            } else {
              displayContent = `${actorLabel} đã hạ ${targetLabel} xuống làm thành viên`;
            }
            break;
          }
          case "pin_message":
            displayContent = `${actorLabel} đã ghim một tin nhắn`;
            break;
          case "unpin_message":
            displayContent = `${actorLabel} đã bỏ ghim tin nhắn`;
            break;
          case "info_updated":
            displayContent = `${actorLabel} đã cập nhật thông tin nhóm`;
            break;
          case "group_name_updated":
            displayContent = `${actorLabel} đã đổi tên nhóm`;
            break;
          case "group_avatar_updated":
            displayContent = `${actorLabel} đã thay đổi ảnh đại diện nhóm`;
            break;
          case "group_created":
            displayContent = `${actorLabel} đã tạo nhóm`;
            break;
          default:
            displayContent = `${actorLabel} đã thực hiện một thay đổi hệ thống`;
            break;
        }
      }
    } catch (e) {
      // Fallback to legacy parsing
      const actorEmail = (message as any).systemActionBy;
      const isActorMe = actorEmail === user?.email;
      if (isActorMe && actorEmail) {
        const actorProfile = userProfiles[actorEmail];
        const actorName =
          actorProfile?.fullName || actorProfile?.fullname || actorEmail;
        displayContent = displayContent.replace(actorName, "Bạn");
      }
    }

    return (
      <div className="flex justify-center my-8 animate-in fade-in zoom-in-95 duration-700 w-full">
        <div className="flex flex-col items-center gap-2">
          <div className="bg-black/5 dark:bg-white/5 px-5 py-2 rounded-2xl backdrop-blur-md border border-white/10 shadow-sm">
            <p className="text-[12px] font-bold text-on-surface-variant/80 tracking-wide text-center">
              {displayContent}
            </p>
          </div>
          <p className="text-[10px] font-black text-on-surface-variant/40 tracking-widest text-center uppercase">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="contents">
      <style>
        {`
          @keyframes message-flash {
            0% { background-color: transparent; }
            30% { background-color: rgba(255, 245, 157, 0.6); }
            60% { background-color: transparent; }
            80% { background-color: rgba(255, 245, 157, 0.6); }
            100% { background-color: transparent; }
          }
          .message-flash-active {
            animation: message-flash 2s ease-out;
          }
        `}
      </style>
      <motion.div
        id={`msg-${message.id}`}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex items-end gap-3 group relative mb-4 transition-all duration-500 ${isMe ? "flex-row-reverse" : "flex-row"} ${isHighlighted ? "scale-[1.02] z-10" : ""}`}
      >
        <div className="shrink-0 mb-1">
          {!isMe && !isConsecutive ? (
            <img
              src={getDisplayAvatar(message.senderId, user, userProfiles)}
              className="w-10 h-10 rounded-full object-cover shadow-sm ring-1 ring-black/5 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={handleOpenSenderProfile}
              title="Xem trang cá nhân"
              alt=""
            />
        ) : !isMe && isConsecutive ? (
          <div className="w-10" />
        ) : null}
      </div>

      <div
        className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}
      >
        <div className="flex items-center gap-2 mb-1.5 px-1">
          {!isMe && !isConsecutive && (
            <span className="text-[12px] font-extrabold text-on-surface-variant/70">
              {getDisplayName(message.senderId, user, userProfiles)}
            </span>
          )}
          {isPinned && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full ring-1 ring-amber-200 animate-in fade-in zoom-in">
              <Pin size={12} strokeWidth={2.5} className="fill-amber-600/10" />
              <span className="text-[10px] font-extrabold uppercase tracking-tighter">
                Đã ghim
              </span>
            </div>
          )}
          {message.tagId &&
            (() => {
              const tag = (tags || []).find((t: any) => t.id === message.tagId);
              if (!tag) return null;
              return (
                <div className="flex items-center gap-1 ml-2">
                  <div
                    style={{ background: tag.color }}
                    className="px-2 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-sm"
                  >
                    {tag.name}
                  </div>
                </div>
              );
            })()}
        </div>

        <div className="relative group/bubble">
          {!isRecalled && !isCallOverlayActive && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 z-[30] ${isMe ? "-left-32 flex-row-reverse animate-in slide-in-from-right-4" : "-right-32 animate-in slide-in-from-left-4"}`}
            >
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onContextMenu(message, rect.left, rect.top);
                }}
                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-surface-container border border-outline-variant/30 dark:border-outline-variant/40 rounded-full shadow-lg hover:bg-surface-container active:scale-90 transition-all text-on-surface-variant group/btn"
                title="Tùy chọn khác"
              >
                <MoreHorizontal
                  size={18}
                  className="group-hover/btn:text-primary transition-colors"
                />
              </button>

              <div className="relative" ref={reactionDockRef}>
                <button
                  onClick={() => setIsMenuReactionOpen(!isMenuReactionOpen)}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-surface-container border border-outline-variant/30 dark:border-outline-variant/40 rounded-full shadow-lg hover:bg-surface-container active:scale-90 transition-all text-on-surface-variant group/btn"
                  title="Thả cảm xúc"
                >
                  <ThumbsUp
                    size={18}
                    className={`group-hover/btn:text-primary transition-colors ${isMenuReactionOpen ? "text-primary" : ""}`}
                  />
                </button>
                {isMenuReactionOpen && (
                  <div className={`absolute top-full mt-2 flex items-center gap-1.5 p-1.5 bg-white dark:bg-surface-container border border-outline-variant/20 shadow-xl rounded-full z-[100] animate-in zoom-in-95 duration-200 ${isMe ? "right-0" : "left-0"}`}>
                    {["👍", "❤️", "😄", "😮", "😭", "😡"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          handleReact(emoji, "add");
                          setIsMenuReactionOpen(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-transform hover:scale-110 active:scale-90"
                      >
                        <FluentEmoji emoji={emoji} className="w-6 h-6" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => onForward?.(message)}
                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-surface-container border border-outline-variant/30 dark:border-outline-variant/40 rounded-full shadow-lg hover:bg-surface-container active:scale-90 transition-all text-on-surface-variant group/btn"
                title="Chia sẻ"
              >
                <Forward
                  size={18}
                  className="group-hover/btn:text-primary transition-colors"
                />
              </button>

              <button
                onClick={() => onReply(message)}
                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-surface-container border border-outline-variant/30 dark:border-outline-variant/40 rounded-full shadow-lg hover:bg-surface-container active:scale-90 transition-all text-on-surface-variant group/btn"
                title="Trả lời"
              >
                <Quote
                  size={18}
                  className="group-hover/btn:text-primary transition-colors"
                />
              </button>
            </div>
          )}

          <div
            className={`rounded-2xl relative transition-all duration-500 ${
              shouldHideBubble
                ? "bg-transparent p-0 border-none shadow-none"
                : `p-3 shadow-sm border ${bubbleClass} ${isMe ? "border-primary/20" : "border-outline-variant/20"}`
            } ${isHighlighted ? "message-flash-active" : ""}`}
          >
            {message.replyTo && (
              <div className={`mb-3 rounded-xl ${isMe ? 'bg-primary/10' : 'bg-black/5'} p-3 text-[12px] border-l-4 border-primary/50 flex items-center gap-3 transition-colors hover:bg-black/5`}>
                <div className="flex-1 min-w-0">
                  <p className={`font-black opacity-50 text-[10px] uppercase tracking-[0.1em] mb-1 truncate`}>
                    Phản hồi {message.replyTo.senderId ? getDisplayName(message.replyTo.senderId, user, userProfiles) : "Tin nhắn"}
                  </p>
                  <p className={`truncate italic ${isMe ? 'text-white/90' : 'text-on-surface/80'} font-medium`}>
                    {message.replyTo.content}
                  </p>
                </div>
              </div>
            )}

            {message.content && !isMediaOnly && (
              <div className="flex flex-col gap-2">
                {(() => {
                  if (isRecalled) {
                    return (
                      <p className="text-[15px] leading-[1.6] whitespace-pre-wrap font-medium italic opacity-50 text-on-surface">
                        Tin nhắn đã được thu hồi
                      </p>
                    );
                  }

                  // 1. Detect explicit code blocks: ```[language][:filename][\n]code```
                  const codeBlockRegex = /```(\w+)?(?::([^ \n]+))?[\n\r]?([\s\S]*?)```/g;
                  const parts = [];
                  let lastIndex = 0;
                  let match;

                  while ((match = codeBlockRegex.exec(message.content)) !== null) {
                    // Text before the code block
                    if (match.index > lastIndex) {
                      const textBefore = message.content.substring(lastIndex, match.index);
                      if (textBefore) {
                        parts.push(
                          <p key={`text-${lastIndex}`} className="text-[15px] leading-[1.6] whitespace-pre-wrap font-medium text-on-surface">
                            {renderTextWithMentions(textBefore, message.mentions)}
                          </p>
                        );
                      }
                    }

                    const language = match[1] || "text";
                    const filename = match[2] || "";
                    const code = match[3].trim();

                    if (code) {
                      parts.push(
                        <CodeSnippet 
                          key={`code-${match.index}`} 
                          code={code} 
                          language={language} 
                          filename={filename} 
                        />
                      );
                    }

                    lastIndex = codeBlockRegex.lastIndex;
                  }

                  // 2. Heuristic Detection for "Plain Text Code"
                  // If no explicit blocks were found, check if the WHOLE content looks like code
                  if (parts.length === 0) {
                    const content = message.content.trim();
                    const lines = content.split('\n');
                    
                    const codeKeywords = ['import ', 'export ', 'const ', 'function ', 'class ', 'interface ', 'public ', 'private ', 'namespace ', 'using ', 'package '];
                    const hasKeyword = codeKeywords.some(kw => content.includes(kw));
                    const hasStructure = (content.match(/{/g)?.length || 0) > 0 && (content.match(/}/g)?.length || 0) > 0;
                    const isLongEnough = lines.length >= 3;

                    if ((hasKeyword && hasStructure) || (isLongEnough && hasStructure)) {
                      // Basic language guessing
                      let guessedLang = "javascript"; // default for JS/TS
                      if (content.includes("<?php")) guessedLang = "php";
                      else if (content.includes("def ") && content.includes(":")) guessedLang = "python";
                      else if (content.includes("namespace ") && content.includes(";")) guessedLang = "csharp";
                      else if (content.includes("package ") && content.includes("class ")) guessedLang = "java";
                      else if (content.includes("<html>") || content.includes("</div>")) guessedLang = "html";
                      else if (content.includes("body {") || content.includes(".class {")) guessedLang = "css";

                      return [
                        <CodeSnippet 
                          key="auto-code" 
                          code={content} 
                          language={guessedLang} 
                          filename="Auto-Detected Code" 
                        />
                      ];
                    }
                  }

                  // Remaining text after last code block
                  if (lastIndex < message.content.length) {
                    parts.push(
                      <p key={`text-${lastIndex}`} className="text-[15px] leading-[1.6] whitespace-pre-wrap font-medium text-on-surface">
                        {renderTextWithMentions(message.content.substring(lastIndex), message.mentions)}
                      </p>
                    );
                  }

                  return parts.length > 0 ? parts : (
                    <p className="text-[15px] leading-[1.6] whitespace-pre-wrap font-medium text-on-surface">
                      {renderTextWithMentions(message.content, message.mentions)}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Invite Link Preview Bubble */}
            {!isRecalled && message.content && (
              (() => {
                const matchInvite = message.content.match(/\/join\/(CONV#GROUP#[a-zA-Z0-9-]+)/);
                if (matchInvite) {
                  return (
                    <div className="mt-2">
                      <GroupInviteBubble groupId={matchInvite[1]} />
                    </div>
                  );
                }
                return null;
              })()
            )}



            {!isRecalled && message.contactCard && (
              <div
                className="mt-2 p-3 rounded-2xl border border-primary/20 bg-white/70 dark:bg-surface-container-high/70 max-w-[320px] cursor-pointer hover:bg-white dark:hover:bg-surface-container transition-all"
                onClick={() =>
                  navigate(
                    `/profile?email=${encodeURIComponent(message.contactCard.email)}`,
                  )
                }
              >
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary/80 mb-2">
                  Danh thiếp liên hệ
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={
                      message.contactCard.avatarUrl ||
                      getDisplayAvatar(
                        message.contactCard.email,
                        user,
                        userProfiles,
                      )
                    }
                    alt=""
                    className="w-11 h-11 rounded-full object-cover ring-1 ring-outline-variant/20"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-extrabold text-on-surface truncate">
                      {message.contactCard.fullName ||
                        message.contactCard.email}
                    </p>
                    <p className="text-[12px] text-on-surface-variant truncate">
                      {message.contactCard.email}
                    </p>
                    {message.contactCard.phone && (
                      <p className="text-[11px] text-on-surface-variant/80 truncate">
                        {message.contactCard.phone}
                      </p>
                    )}
                  </div>
                </div>
                {message.contactCard.email &&
                  message.contactCard.email !== user?.email && (
                    <div
                      className="flex gap-2 mt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="flex-1 py-1.5 rounded-full bg-primary text-white text-[12px] font-bold hover:opacity-90 active:scale-[0.98] transition-all"
                        onClick={() =>
                          startDirectChat(message.contactCard.email)
                        }
                      >
                        Nhắn tin
                      </button>
                    </div>
                  )}
              </div>
            )}

            {!isRecalled && message.location && (
              <div className="mt-2 p-3 rounded-2xl border border-sky-200 bg-sky-50/70 dark:bg-sky-900/20 max-w-[340px]">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 mb-2">
                  {message.location.isLive
                    ? "Vị trí trực tiếp"
                    : "Vị trí hiện tại"}
                </p>
                <p className="text-[13px] font-semibold text-on-surface">
                  {message.location.label || "Vị trí chia sẻ"}
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {Number(message.location.latitude).toFixed(5)},{" "}
                  {Number(message.location.longitude).toFixed(5)}
                </p>
                {message.location.isLive && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">
                    Đang chia sẻ trực tiếp
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps?q=${message.location.latitude},${message.location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex mt-3 px-3 py-1.5 rounded-full bg-sky-600 text-white text-[12px] font-bold hover:opacity-90"
                >
                  Mở bản đồ
                </a>
              </div>
            )}

            {!isRecalled && (message.payload?.poll || message.poll) && (
              <div className="mt-2">
                <PollMessage
                  messageId={message.id}
                  topic={(message.payload?.poll || message.poll).topic}
                  options={(message.payload?.poll || message.poll).options}
                  votes={(message.payload?.poll || message.poll).votes || {}}
                  senderEmail={message.senderId}
                  isClosed={(message.payload?.poll || message.poll).isClosed}
                  userProfiles={userProfiles}
                  onVote={async (optionIndex: number) => {
                    if (onVotePoll) {
                      await onVotePoll(message.id, optionIndex);
                    }
                  }}
                  onClosePoll={async () => {
                    const { closePoll } = useChatStore.getState();
                    const { activeConvId } = useChatStore.getState();
                    if (activeConvId) {
                      await closePoll(activeConvId, message.id);
                    }
                  }}
                />
              </div>
            )}

            {!isRecalled && message.payload?.reminder && (
              <div className="mt-2">
                <ReminderMessage
                  messageId={message.id}
                  content={message.payload.reminder.content}
                  time={message.payload.reminder.time}
                  date={message.payload.reminder.date}
                  repeatType={message.payload.reminder.repeatType}
                />
              </div>
            )}

            {!isRecalled && (
              <div className="mt-2 space-y-2">
                {message.audioUrl && (
                  <WebAudioPlayer 
                    src={message.audioUrl} 
                    title={message.content === "[Tin nhắn thoại]" ? "Tin nhắn thoại" : "File âm thanh"} 
                    allowDownload={message.content !== "[Tin nhắn thoại]"} 
                  />
                )}

                {message.media && message.media.length > 0 && (
                  <div
                    className={
                      message.media.length === 1
                        ? "flex flex-col gap-2"
                        : message.media.length === 2 ||
                            message.media.length === 4
                          ? "grid grid-cols-2 gap-1.5 max-w-[280px]"
                          : "grid grid-cols-3 gap-1.5 max-w-[320px]"
                    }
                  >
                    {message.media.map((m: any, i: number) => {
                      const src = m.dataUrl || m.url;
                      const isVideo = isVideoMedia(m);
                      const isSticker = isStickerMedia(m);
                      const isHD = m?.isHD === true;
                      const mediaClass = `${
                        message.media.length === 1
                          ? "max-w-full max-h-[300px] object-contain rounded-2xl"
                          : "w-full aspect-square object-cover rounded-[10px]"
                      } border border-outline-variant/10 shadow-sm transition-opacity backdrop-blur-sm bg-surface-container`;

                      // Data saver blur container
                      const isBlur = !autoDownload && !isSticker && !revealedMedia[i];
                      if (isBlur) {
                        return (
                          <div 
                            key={i} 
                            onClick={() => setRevealedMedia(prev => ({ ...prev, [i]: true }))}
                            className={`${
                              message.media.length === 1
                                ? "w-[260px] h-[180px]"
                                : "w-full aspect-square"
                            } relative rounded-2xl border border-outline-variant/20 overflow-hidden cursor-pointer flex flex-col items-center justify-center bg-surface-container-highest/20 dark:bg-surface-container-highest/10 backdrop-blur-md shadow-sm group/blur hover:bg-surface-container-highest/30 transition-all select-none`}
                          >
                            <div className="absolute inset-0 bg-primary/5 filter blur-lg opacity-40 group-hover/blur:scale-110 transition-transform duration-500"></div>
                            <div className="relative flex flex-col items-center gap-2 p-3 text-center">
                              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover/blur:scale-105 transition-transform duration-300">
                                <span className="material-symbols-outlined text-[20px]">
                                  {isVideo ? "play_circle" : "download_for_offline"}
                                </span>
                              </div>
                              <span className="text-[11px] font-extrabold text-on-surface leading-tight">
                                {isVideo ? "Tải video" : "Tải hình ảnh"}
                              </span>
                              <span className="text-[9px] font-bold text-on-surface-variant/70 uppercase tracking-wider block">
                                Tiết kiệm dữ liệu
                              </span>
                            </div>
                          </div>
                        );
                      }

                      if (isVideo) {
                        return (
                          <video
                            key={i}
                            src={src}
                            className={`${mediaClass} hover:opacity-95`}
                            controls
                            preload="metadata"
                            playsInline
                          />
                        );
                      }

                      return (
                        <div key={i} className="relative inline-block">
                          <img
                            src={src}
                            onClick={() =>
                              setPreviewImage(
                                src,
                                m.fileName || m.name || "image.png",
                              )
                            }
                            className={`${isSticker ? "max-h-[180px] object-contain bg-transparent border-0 shadow-none" : mediaClass} hover:opacity-90 cursor-pointer active:scale-[0.98]`}
                            alt=""
                          />
                          {(isSticker || isHD) && (
                            <div className="absolute left-2 bottom-2 flex gap-1">
                              {isSticker && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                  STK
                                </span>
                              )}
                              {isHD && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                                  HD
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {(message.files || []).map((f: any, i: number) => {
                  const file = normalizeAttachment(f);

                  if (file.mimeType === "application/location") {
                    try {
                      const loc = JSON.parse(file.dataUrl || "{}");
                      return (
                        <div
                          key={i}
                          className="mt-2 p-3 rounded-2xl border border-sky-200 bg-sky-50/70 dark:bg-sky-900/20 max-w-[340px]"
                        >
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 mb-2">
                            Vị trí chia sẻ
                          </p>
                          <p className="text-[13px] font-semibold text-on-surface">
                            {loc.label || "Vị trí hiện tại"}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {Number(loc.latitude).toFixed(5)},{" "}
                            {Number(loc.longitude).toFixed(5)}
                          </p>
                          <a
                            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex mt-3 px-3 py-1.5 rounded-full bg-sky-600 text-white text-[12px] font-bold hover:opacity-90"
                          >
                            Mở bản đồ
                          </a>
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  }

                  if (file.mimeType === "application/contact") {
                    try {
                      const contact = JSON.parse(file.dataUrl || "{}");
                      return (
                        <div
                          key={i}
                          className="mt-2 p-3 rounded-2xl border border-primary/20 bg-white/70 dark:bg-surface-container-high/70 max-w-[320px]"
                        >
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary/80 mb-2">
                            Danh thiếp liên hệ
                          </p>
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                contact.avatarUrl ||
                                getDisplayAvatar(
                                  contact.email,
                                  user,
                                  userProfiles,
                                )
                              }
                              alt=""
                              className="w-11 h-11 rounded-full object-cover ring-1 ring-outline-variant/20"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-extrabold text-on-surface truncate">
                                {contact.fullName || contact.email}
                              </p>
                              <p className="text-[12px] text-on-surface-variant truncate">
                                {contact.email}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="mt-3 px-3 py-1.5 rounded-full bg-primary text-white text-[12px] font-bold hover:opacity-90 active:scale-[0.98]"
                            onClick={() => startDirectChat(contact.email)}
                          >
                            Nhắn tin
                          </button>
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  }

                  if (isAudioFile(f) && message.content === "[Tin nhắn thoại]") {
                    return (
                      <WebAudioPlayer 
                        key={i} 
                        src={file.dataUrl} 
                        title="Tin nhắn thoại"
                        allowDownload={false}
                      />
                    );
                  }

                  const handleDownload = async (e: React.MouseEvent) => {
                    e.preventDefault();
                    try {
                      const response = await fetch(file.dataUrl);
                      const blob = await response.blob();
                      const blobUrl = window.URL.createObjectURL(blob);

                      const link = document.createElement("a");
                      link.href = blobUrl;
                      link.download = file.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                    } catch (err) {
                      console.error("Download failed", err);
                      window.open(file.dataUrl, "_blank");
                    }
                  };

                  return (
                    <div
                      key={i}
                      onClick={handleDownload}
                      className="flex items-center gap-3 p-3 w-[270px] md:w-[320px] max-w-full bg-white/50 dark:bg-surface-container-high/70 border border-outline-variant/10 dark:border-outline-variant/40 rounded-xl hover:bg-white dark:hover:bg-surface-container-high transition-all shadow-sm group/file cursor-pointer active:scale-[0.98]"
                    >
                      <div className="w-10 h-10 flex items-center justify-center bg-primary/5 rounded-xl text-primary group-hover/file:bg-primary/10 transition-colors">
                        <FileIconComponent fileName={file.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[14px] font-bold text-on-surface"
                          title={file.name}
                        >
                          {truncateFileName(file.name, 40)}
                        </p>
                        <p className="text-[11px] font-medium opacity-50 uppercase">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Download
                        size={20}
                        className="ml-2 opacity-40 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {hasReactions && (
            <div
              className={`absolute -bottom-3.5 flex flex-wrap gap-1 ${isMe ? "right-2" : "left-2"} z-[5] ${isCallOverlayActive ? "pointer-events-none" : ""}`}
            >
              <div className="flex items-center bg-white dark:bg-surface-container-high shadow-lg rounded-full px-2 py-1 border border-outline-variant/20 gap-1.5 animate-in zoom-in-50 duration-300">
                {Object.entries(message.reactions).map(
                  ([emoji, users]: [string, any]) => (
                    <div
                      key={emoji}
                      className="flex items-center gap-1 group/emoji relative cursor-pointer hover:scale-110 active:scale-95 transition-all"
                      title={users.join(", ")}
                      onClick={() => handleReact(emoji, "add")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleReact(emoji, "remove");
                      }}
                    >
                      <FluentEmoji emoji={emoji} className="w-4.5 h-4.5 drop-shadow-sm" />
                      <span className="text-[11px] font-black text-on-surface-variant/80">
                        {users.length}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5 px-1 opacity-60 transition-all">
          <span className="text-[10px] font-extrabold uppercase tracking-tight">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isMe && (
            <div className="flex items-center ml-1">
              {message.status === "sending" ? (
                <span className="text-[10px] text-on-surface-variant font-medium flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Đang gửi...
                </span>
              ) : message.status === "error" ? (
                <span className="text-[10px] text-error font-medium flex items-center gap-1">
                  <AlertCircle size={10} /> Lỗi
                </span>
              ) : message.status === "read" ? (
                <span className="text-[10px] text-primary font-bold">
                  Đã xem
                </span>
              ) : message.status === "delivered" ? (
                <span className="text-[10px] text-outline font-medium">
                  Đã nhận
                </span>
              ) : (
                <span className="text-[10px] text-outline font-medium">
                  Đã gửi
                </span>
              )}
            </div>
          )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MessageBubble;
