"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_AVATAR = exports.BOT_NAME = exports.BOT_EMAIL = exports.formatCallDuration = exports.CALL_UI = void 0;
exports.CALL_UI = {
    colors: {
        missed: '#ef4444',
        textPrimary: '#111827',
        textSecondary: '#6b7280',
        actionBlue: '#0068FF',
    },
    spacing: {
        padding: '6px 12px',
        radius: '8px',
        gap: '6px',
    }
};
const formatCallDuration = (sec = 0) => {
    if (sec <= 0)
        return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};
exports.formatCallDuration = formatCallDuration;
exports.BOT_EMAIL = 'bot@UniChat.system';
exports.BOT_NAME = 'UniChat AI';
exports.BOT_AVATAR = 'https://img.freepik.com/free-vector/graident-ai-robot-vectorart_78370-4114.jpg?semt=ais_hybrid&w=740&q=80';
//# sourceMappingURL=index.js.map