import React from "react";
import { AlertTriangle, Info, CheckCircle2, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info" | "success";
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  onConfirm,
  onCancel,
  variant = "warning",
  loading = false,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <AlertTriangle size={24} className="text-error" />;
      case "warning":
        return <AlertTriangle size={24} className="text-orange-500" />;
      case "success":
        return <CheckCircle2 size={24} className="text-green-500" />;
      default:
        return <Info size={24} className="text-primary" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case "danger":
        return "bg-error text-white hover:bg-error/90";
      case "warning":
        return "bg-orange-500 text-white hover:bg-orange-600";
      case "success":
        return "bg-green-500 text-white hover:bg-green-600";
      default:
        return "bg-primary text-white hover:bg-primary/90";
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute right-4 top-4 rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-surface-container-highest p-4">
            {getIcon()}
          </div>
          <h3 className="mb-2 text-[18px] font-black text-on-surface">
            {title}
          </h3>
          <p className="mb-6 text-[14px] text-on-surface-variant leading-relaxed">
            {message}
          </p>

          <div className="flex w-full gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-2xl bg-surface-container px-4 py-3 text-[14px] font-bold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 rounded-2xl px-4 py-3 text-[14px] font-bold transition-all active:scale-95 disabled:opacity-70 flex justify-center items-center ${getConfirmButtonClass()}`}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
