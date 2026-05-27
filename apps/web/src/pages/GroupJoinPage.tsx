import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, ShieldCheck, Loader2 } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import { useTheme } from "../context/ThemeContext";

interface GroupPreview {
  id: string;
  name: string;
  avatarUrl: string;
  memberCount: number;
  isGroup: boolean;
}

const GroupJoinPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTheme();
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!id) return;
      try {
        const res = await api.get(`/chat/conversations/${encodeURIComponent(id)}/preview`);
        setPreview(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || t("group.join_not_found"));
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [id]);

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    try {
      await api.post(`/chat/conversations/${encodeURIComponent(id)}/join`);
      Swal.fire({
        title: t("info.success"),
        text: t("group.join_success"),
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      navigate(`/chat?id=${encodeURIComponent(id)}`);
    } catch (err: any) {
      Swal.fire(t("modal.error"), err.response?.data?.message || t("group.join_error"), "error");
      setJoining(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-surface">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-surface-container rounded-3xl shadow-xl border border-outline-variant/10 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-primary/5 p-8 flex flex-col items-center justify-center border-b border-outline-variant/10">
            {loading ? (
              <Loader2 size={48} className="text-primary animate-spin opacity-50" />
            ) : preview ? (
              <>
                <img
                  src={preview.avatarUrl || "/avatar_placeholder.png"}
                  alt={preview.name}
                  className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-white dark:border-surface-container"
                />
                <h1 className="mt-4 text-[20px] font-extrabold text-on-surface text-center">
                  {preview.name}
                </h1>
                <div className="mt-2 flex items-center gap-4 text-[13px] font-bold text-on-surface-variant">
                  <span className="flex items-center gap-1.5 bg-surface-container-high px-3 py-1 rounded-full">
                    <Users size={14} />
                    {preview.memberCount} thành viên
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-error font-medium p-4 flex flex-col items-center gap-3">
                <ShieldCheck size={48} className="opacity-50" />
                <p>{error}</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-surface-container-lowest">
            {!loading && preview && (
              <div className="space-y-4">
                <p className="text-center text-[13px] text-on-surface-variant leading-relaxed">
                  Bạn được mời tham gia vào nhóm chat <strong>{preview.name}</strong>. Hãy tham gia để trò chuyện cùng mọi người nhé!
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-md shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {joining ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      "Tham gia nhóm"
                    )}
                  </button>
                  <button
                    onClick={() => navigate("/chat")}
                    disabled={joining}
                    className="w-full bg-surface-container hover:bg-surface-container-high text-on-surface font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {!loading && !preview && (
              <button
                onClick={() => navigate("/chat")}
                className="w-full bg-surface-container hover:bg-surface-container-high text-on-surface font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
              >
                Quay lại Zalo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupJoinPage;
