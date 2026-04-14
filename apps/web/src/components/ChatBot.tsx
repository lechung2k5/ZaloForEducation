import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  citations?: Array<{ sourceTitle: string; content: string }>;
}

const ChatBot: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: `Xin chào ${user?.fullName || user?.fullname || ''}! Tôi là trợ lý AI của ZaloEdu.\nBạn có thể hỏi kiến thức học tập, bài tập, hoặc hỏi theo tài liệu đã tải lên.`,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      const response = await api.post('/api/ai/chat', { message: query });

      const { answer } = response.data;

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        'Có lỗi xảy ra. Vui lòng thử lại sau.';

      const botMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'bot',
        content: `❌ Lỗi: ${errorMsg}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f7f9fb]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-white border-b border-outline-variant/20 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[20px]">smart_toy</span>
          </div>
          <div>
            <h3 className="font-bold text-on-surface">ZaloEdu AI</h3>
            <p className="text-xs text-on-surface-variant">Trợ lý ảo RAG</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs p-3 rounded-[16px] ${
                  msg.type === 'user'
                    ? 'bg-primary text-white rounded-br-none'
                    : 'bg-white text-on-surface border border-outline-variant/20 rounded-bl-none'
                }`}
              >
                <p className="text-[14px] leading-relaxed">{msg.content}</p>
                <span className={`text-xs mt-1 block ${msg.type === 'user' ? 'text-white/70' : 'text-on-surface-variant'}`}>
                  {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Citations */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="flex justify-start mt-2">
                <div className="max-w-xs text-xs text-on-surface-variant">
                  <p className="font-semibold mb-1">📚 Nguồn tham chiếu:</p>
                  <ul className="space-y-1">
                    {msg.citations.map((citation, idx) => (
                      <li key={idx} className="bg-surface-container-lowest p-2 rounded border-l-2 border-primary/40">
                        <strong>{citation.sourceTitle}</strong>
                        <p className="text-xs mt-1 line-clamp-2">{citation.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-on-surface p-3 rounded-[16px] rounded-bl-none border border-outline-variant/20">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-outline-variant/20 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Nhập câu hỏi của bạn..."
            className="flex-1 bg-surface-container-highest border border-outline-variant/20 rounded-[12px] px-4 py-2 text-[14px] focus:ring-2 focus:ring-primary/40 transition-all outline-none text-on-surface placeholder:text-outline-variant"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputText.trim()}
            className="bg-primary text-white rounded-[12px] px-4 py-2 font-semibold transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
