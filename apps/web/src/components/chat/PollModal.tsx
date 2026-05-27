import React, { useEffect, useState } from "react";
import { Settings, X, Plus, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { useTheme } from "../../context/ThemeContext";

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPoll: (poll: { topic: string; options: string[] }) => Promise<void>;
}

const PollModal: React.FC<PollModalProps> = ({
  isOpen,
  onClose,
  onSendPoll,
}) => {
  const { t } = useTheme();
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTopic("");
    setOptions(["", ""]);
    setIsSubmitting(false);
  }, [isOpen]);

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      Swal.fire(t("modal.error"), t("poll.min_options"), "error");
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    if (!topic.trim()) {
      Swal.fire(t("modal.error"), t("poll.topic_required"), "error");
      return;
    }

    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      Swal.fire(t("modal.error"), t("poll.min_options"), "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSendPoll({
        topic: topic.trim(),
        options: validOptions,
      });
      setTopic("");
      setOptions(["", ""]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl overflow-hidden rounded-md border border-outline-variant/20 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-4">
          <h2 className="text-[18px] font-extrabold text-[#1f2f4a]">
            {t("poll.create_title")}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X size={20} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-5">
          {/* Topic Input */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-on-surface">
              {t("poll.topic_label")}
            </label>
            <div className="relative">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value.slice(0, 200))}
                placeholder={t("poll.topic_placeholder")}
                maxLength={200}
                className="h-36 w-full resize-none rounded-md border border-[#98b5eb] bg-white px-4 py-3 pr-16 text-[14px] outline-none transition-all focus:ring-2 focus:ring-primary/20"
                rows={3}
              />
              <p className="absolute bottom-3 right-3 text-[11px] text-on-surface-variant">
                {topic.length}/200
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-on-surface">
              {t("poll.options_label")}
            </label>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {options.map((option, index) => (
                <div key={index} className="flex items-start gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) =>
                      handleOptionChange(index, e.target.value.slice(0, 100))
                    }
                    placeholder={t("poll.option_placeholder", { number: index + 1 })}
                    maxLength={100}
                    className="flex-1 rounded-md border border-outline-variant/20 bg-white px-3 py-2.5 text-[13px] outline-none transition-all focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={() => handleRemoveOption(index)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-error transition-colors hover:bg-error/10"
                    title={t("poll.remove_option")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Option Button */}
            <button
              onClick={handleAddOption}
              className="inline-flex items-center justify-center gap-2 rounded-md px-2 py-1 text-[14px] font-bold text-primary transition-colors hover:bg-primary/5"
            >
              <Plus size={16} />
              {t("poll.add_option")}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-outline-variant/20 px-5 py-3">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
            title={t("sidebar.settings")}
          >
            <Settings size={19} />
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md bg-[#e0e4ea] px-6 py-2.5 text-[14px] font-bold text-[#24334f] transition-all hover:bg-[#d6dce4] disabled:opacity-50"
            >
              {t("inbox.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-md bg-primary px-6 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? t("poll.sending") : t("poll.create_title")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollModal;
