import { useState, useEffect, useRef } from "react";
import { chatWithAi, getChatHistory } from "../api/ai.js";
import { currency } from "../utils/format.js";
import "./FloatingChatbot.css";

const QUICK_ACTIONS = [
  { label: "Tuần này tiêu gì?", query: "Tuần này tôi tiêu bao nhiêu rồi?" },
  { label: "Kiểm tra ngân sách", query: "Tôi còn bao nhiêu tiền cho Ăn uống?" },
  { label: "Có gì bất thường?", query: "Gần đây có chi tiêu gì bất thường không?" },
  { label: "Lương tháng này", query: "Ghi nhận lương tháng này 15 triệu" },
];

const buildStorageKey = (email) => `finance_floating_chat_history:${email || "guest"}`;

const resolveEmailKey = (userEmail, isAuthed) => {
  if (isAuthed && userEmail) {
    localStorage.setItem("finance_last_email", userEmail);
    return userEmail;
  }
  if (isAuthed) {
    return localStorage.getItem("finance_last_email") || null;
  }
  return userEmail;
};

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) return null;
  const trimmed = messages
    .filter((msg) => msg && typeof msg.content === "string" && typeof msg.role === "string")
    .map((msg) => ({ role: msg.role, content: msg.content, intent: msg.intent }))
    .slice(-50);
  return trimmed.length ? trimmed : null;
};

export default function FloatingChatbot({ isAuthed, userEmail }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Xin chào! Tôi là trợ lý tài chính AI. Tôi có thể giúp bạn ghi chép chi tiêu, kiểm tra ngân sách hoặc tìm kiếm giao dịch. Bạn cần giúp gì nào?" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const resolvedEmail = resolveEmailKey(userEmail, isAuthed);
    const storageKey = buildStorageKey(resolvedEmail);
    const fallbackToLocal = () => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setMessages([
          { role: "assistant", content: "Xin chào! Tôi là trợ lý tài chính AI. Tôi có thể giúp bạn ghi chép chi tiêu, kiểm tra ngân sách hoặc tìm kiếm giao dịch. Bạn cần giúp gì nào?" }
        ]);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const normalized = normalizeMessages(parsed);
        if (normalized) {
          setMessages(normalized);
        } else {
          setMessages([
            { role: "assistant", content: "Xin chào! Tôi là trợ lý tài chính AI. Tôi có thể giúp bạn ghi chép chi tiêu, kiểm tra ngân sách hoặc tìm kiếm giao dịch. Bạn cần giúp gì nào?" }
          ]);
        }
      } catch {
        setMessages([
          { role: "assistant", content: "Xin chào! Tôi là trợ lý tài chính AI. Tôi có thể giúp bạn ghi chép chi tiêu, kiểm tra ngân sách hoặc tìm kiếm giao dịch. Bạn cần giúp gì nào?" }
        ]);
      }
    };

    const load = async () => {
      if (!isAuthed) {
        fallbackToLocal();
        return;
      }
      try {
        const response = await getChatHistory(50);
        const normalized = normalizeMessages(response?.messages);
        if (!cancelled && normalized) {
          setMessages(normalized);
          return;
        }
      } catch {
        // ignore and fallback
      }
      if (!cancelled) {
        fallbackToLocal();
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userEmail, isAuthed]);

  useEffect(() => {
    const resolvedEmail = resolveEmailKey(userEmail, isAuthed);
    const storageKey = buildStorageKey(resolvedEmail);
    const normalized = normalizeMessages(messages);
    if (!normalized) return;
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  }, [messages, userEmail, isAuthed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (textOverride = null) => {
    const text = (typeof textOverride === "string" ? textOverride : inputValue).trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const response = await chatWithAi(text);
      let content = response.answer;
      
      // Bổ sung thông tin nếu có total từ backend (intent summary/budget)
      if (response.intent === "summary" || response.intent === "budget_status") {
        // Content is formatted in backend service.py
      }

      setMessages((prev) => [...prev, { 
        role: "assistant", 
        content,
        intent: response.intent 
      }]);

      if (response?.intent === "create_transaction" || response?.intent === "create_transactions") {
        window.dispatchEvent(
          new CustomEvent("finance:refresh", {
            detail: {
              startDate: response.start_date || null,
              endDate: response.end_date || null
            }
          })
        );
      }
    } catch (err) {
      if (err.status === 401) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Rất tiếc, mình đang gặp chút trục trặc kết nối. Bạn thử lại sau nhé!" }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`chatbot-container ${isOpen ? "is-open" : ""}`}>
      {isOpen ? (
        <div className="chatbot-window">
          <header className="chatbot-header">
            <div className="header-info">
              <div className="bot-avatar">AI</div>
              <div>
                <h3>Trợ lý Tài chính</h3>
                <span className="online-status">Đang trực tuyến</span>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </header>
          
          <div className="chatbot-messages" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                {msg.role === "assistant" && <div className="msg-avatar">🤖</div>}
                <div className="message-bubble">
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message-row assistant">
                <div className="msg-avatar">🤖</div>
                <div className="message-bubble typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>

          <div className="chatbot-footer">
            {!isAuthed ? (
              <div className="not-authed-notice">
                Vui lòng đăng nhập để trò chuyện cùng trợ lý tài chính.
              </div>
            ) : (
              <>
                <div className="quick-actions-bar">
                  {QUICK_ACTIONS.map((action, i) => (
                    <button 
                      key={i} 
                      className="action-chip"
                      onClick={() => handleSend(action.query)}
                      disabled={loading}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <form className="chatbot-input-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Nhập yêu cầu của bạn..."
                    disabled={loading}
                  />
                  <button className="send-btn" type="submit" disabled={loading || !inputValue.trim()}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <button className="chatbot-launcher" onClick={() => setIsOpen(true)}>
          <div className="launcher-icon">💬</div>
          <div className="launcher-label">Hỏi AI</div>
        </button>
      )}
    </div>
  );
}
