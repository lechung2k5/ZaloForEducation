import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  title,
  placeholder = "Nhập giá trị...",
  initialValue = "",
  confirmText = "Lưu",
  cancelText = "Hủy",
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-black text-on-surface">{title}</h3>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            autoFocus
            className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) {
                onConfirm(value);
              }
            }}
          />
        </div>

        <div className="flex w-full justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl px-5 py-2.5 text-[14px] font-bold text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onConfirm(value)}
            disabled={loading}
            className="rounded-2xl bg-primary px-6 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-70 flex justify-center items-center min-w-[80px]"
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
  );
};

export default PromptDialog;
