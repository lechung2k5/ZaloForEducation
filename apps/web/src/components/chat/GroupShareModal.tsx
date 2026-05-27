import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, CheckCircle2 } from "lucide-react";
import Swal from "sweetalert2";

interface GroupShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

const GroupShareModal: React.FC<GroupShareModalProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const joinLink = `${window.location.origin}/join/${conversationId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-surface-container rounded-3xl w-full max-w-[400px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant/10 dark:border-outline-variant/20 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-on-surface">
            Chia sẻ nhóm
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-outline-variant/20 mb-6">
            <QRCodeSVG value={joinLink} size={200} level="M" />
          </div>

          <p className="text-[13px] text-on-surface-variant text-center mb-4">
            Quét mã QR bằng camera hoặc chia sẻ đường link bên dưới để mời mọi
            người tham gia nhóm.
          </p>

          <div className="w-full flex items-center gap-2 bg-surface-container-low p-2 rounded-xl border border-outline-variant/20">
            <input
              type="text"
              readOnly
              value={joinLink}
              className="flex-1 bg-transparent outline-none text-[12px] text-on-surface px-2 truncate"
            />
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1 min-w-[70px] justify-center"
            >
              {copied ? (
                <>
                  <CheckCircle2 size={14} />
                  <span className="text-[12px] font-bold">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="text-[12px] font-bold">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupShareModal;
