import React from "react";
import { X, MessageSquare, UserMinus, ShieldAlert, BadgeCheck } from "lucide-react";

interface ChatUserProfile {
  email: string;
  fullName?: string;
  fullname?: string;
  avatarUrl?: string;
  bio?: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  profile: ChatUserProfile | null;
  nickname?: string;
  isFriend?: boolean;
  onClose: () => void;
  onMessage?: () => void;
  onUnfriend?: () => void;
  onBlock?: () => void;
  loading?: boolean;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  profile,
  nickname,
  isFriend,
  onClose,
  onMessage,
  onUnfriend,
  onBlock,
  loading = false,
}) => {
  if (!isOpen || !profile) return null;

  const displayName = nickname || profile.fullName || profile.fullname || profile.email;
  const originalName = profile.fullName || profile.fullname;
  const avatarUrl = profile.avatarUrl || "/logo_blue.png";
  const coverUrl = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/20 p-2 text-white backdrop-blur-md hover:bg-black/40 transition-colors disabled:opacity-50"
        >
          <X size={20} />
        </button>

        {/* Cover Photo */}
        <div className="relative h-32 w-full">
          <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>

        {/* Avatar & Info */}
        <div className="relative px-6 pb-6 text-center">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2">
            <div className="rounded-full bg-white p-1 shadow-lg">
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-24 w-24 rounded-full object-cover border-2 border-white"
              />
            </div>
          </div>

          <div className="mt-12 space-y-1">
            <h2 className="flex items-center justify-center gap-1 text-[22px] font-black text-on-surface">
              {displayName}
              <BadgeCheck size={18} className="text-primary mt-1" />
            </h2>
            {nickname && originalName && (
              <p className="text-[13px] font-medium text-on-surface-variant">
                Tên thật: {originalName}
              </p>
            )}
            <p className="text-[14px] text-on-surface-variant mt-2">
              {profile.bio || "Chưa cập nhật tiểu sử"}
            </p>
          </div>
          
          <div className="mt-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-3 text-left">
             <p className="text-[12px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Email liên hệ</p>
             <p className="text-[14px] font-medium text-on-surface">{profile.email}</p>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex w-full gap-2">
            {onMessage && (
              <button
                onClick={onMessage}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[14px] font-bold text-white transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-70"
              >
                <MessageSquare size={18} />
                Nhắn tin
              </button>
            )}
            
            {isFriend && (
              <div className="flex gap-2">
                {onUnfriend && (
                  <button
                    onClick={onUnfriend}
                    disabled={loading}
                    title="Xóa bạn"
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
                  >
                    <UserMinus size={20} />
                  </button>
                )}
                {onBlock && (
                  <button
                    onClick={onBlock}
                    disabled={loading}
                    title="Chặn"
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    <ShieldAlert size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
