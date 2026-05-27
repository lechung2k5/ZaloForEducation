import React, { useState } from "react";
import { useChatStore } from "../../store/chatStore";
import { PlusCircle, Edit3, Trash2, Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const TagManagerModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTheme();
  const { tags, addTag, editTag, deleteTag } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#ffb020");

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingId(null);
    setName("");
    setColor("#ffb020");
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setName(t.name);
    setColor(t.color || "#ffb020");
  };

  const handleSave = async () => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (editingId) {
      await editTag(editingId, { name: trimmed, color });
    } else {
      const id = `TAG#${Date.now()}`;
      await addTag({ id, name: trimmed, color });
    }
    startCreate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("tags.confirm_delete"))) return;
    await deleteTag(id);
  };

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-130 bg-white dark:bg-surface-container-high rounded-xl shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-extrabold">{t("tags.manage")}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={startCreate}
              className="flex items-center gap-2 px-3 py-1 rounded-md bg-primary text-white"
            >
              <PlusCircle size={16} /> {t("tags.add")}
            </button>
            <button onClick={onClose} className="px-3 py-1 rounded-md border">
              {t("tags.close")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="space-y-2">
              {(tags || []).map((t: any) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-2 border rounded-md"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      style={{ background: t.color }}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-bold">{t.name}</div>
                      <div className="truncate text-xs text-on-surface-variant">
                        {t.id}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => startEdit(t)}
                      className="shrink-0 rounded-md p-2 hover:bg-surface-container"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="shrink-0 rounded-md p-2 text-error hover:bg-error/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="p-3 border rounded-md">
              <label className="block text-sm font-bold mb-1">{t("tags.name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("tags.name_placeholder")}
                className="w-full px-3 py-2 border rounded-md mb-3"
              />
              <label className="block text-sm font-bold mb-1">{t("tags.color")}</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 p-0 border-0"
              />

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="flex items-center gap-2 px-3 py-1 rounded-md bg-primary text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check size={16} /> {t("tags.save")}
                </button>
                <button
                  onClick={startCreate}
                  className="px-3 py-1 rounded-md border"
                >
                  {t("tags.new")}
                </button>
              </div>

              <div className="mt-4 text-xs text-on-surface-variant">
                {t("tags.local_note")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagManagerModal;
