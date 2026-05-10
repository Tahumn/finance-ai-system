import { useState, useEffect, useRef } from "react";
import { chatWithAi, getChatHistory, getForecast, getAnomalies, getSavingsTips } from "../api/ai.js";
import { currency } from "../utils/format.js";
import "./FloatingChatbot.css";

const RobotIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    <path d="M7 11C7 8.23858 9.23858 6 12 6C14.7614 6 17 8.23858 17 11V14C17 16.7614 14.7614 19 12 19C9.23858 19 7 16.7614 7 14V11Z" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="10" width="6" height="4" rx="2" fill="currentColor" />
    <circle cx="10.5" cy="12" r="0.8" fill="white" />
    <circle cx="13.5" cy="12" r="0.8" fill="white" />
    <path d="M11 16H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M12 6V4M12 4L10 3M12 4L14 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

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

export default function FloatingChatbot({ isAuthed, userEmail, onCreateTransaction }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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

  const renderInsightData = (msg) => {
    if (!msg.insightData) return null;
    const data = msg.insightData;

    if (msg.insightType === "forecast") {
      const { points = [], summary = "" } = data;
      return (
        <div className="ai-insight-card forecast-mini">
          <div className="card-tag">Dự báo chi tiêu</div>
          <p className="card-summary">{summary}</p>
          <div className="forecast-chart-mini">
            {points.slice(0, 3).map((p, i) => (
              <div key={i} className="forecast-item">
                <span className="month">{p.month}</span>
                <span className="amt">{currency(p.predicted_expense)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (msg.insightType === "savings") {
      const { tips = [], total_potential_saving = 0 } = data;
      return (
        <div className="ai-insight-card savings-mini">
          <div className="card-tag">Gợi ý tiết kiệm</div>
          <div className="savings-header">
            <span className="label">Tiềm năng:</span>
            <span className="amt">{currency(total_potential_saving)}</span>
          </div>
          <div className="tips-list-mini">
            {tips.slice(0, 2).map((t, i) => (
              <div key={i} className="tip-item">💡 {t.tip}</div>
            ))}
          </div>
        </div>
      );
    }

    if (msg.insightType === "anomaly") {
      const { alerts = [] } = data;
      return (
        <div className="ai-insight-card anomaly-mini">
          <div className="card-tag alert">Phát hiện bất thường</div>
          <div className="anomaly-list-mini">
            {alerts.slice(0, 2).map((a, i) => (
              <div key={i} className="anomaly-item">
                <div className="anomaly-header">
                  <span className="date">{new Date(a.date).toLocaleDateString('vi-VN')}</span>
                  <span className={`severity ${a.severity}`}>{a.severity}</span>
                </div>
                <p className="reason">{a.reason}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (msg.insightType === "ocr_result") {
      return (
        <div className="ai-insight-card ocr-mini">
          <div className="card-tag success">Kết quả quét hóa đơn</div>
          <div className="receipt-preview">
            <div className="receipt-row">
              <span className="label">Cửa hàng:</span>
              <strong>{data.merchant || "---"}</strong>
            </div>
            <div className="receipt-row">
              <span className="label">Tổng tiền:</span>
              <strong className="amt">{currency(data.total || 0)}</strong>
            </div>
            <div className="receipt-row">
              <span className="label">Ngày:</span>
              <span>{data.date || "---"}</span>
            </div>
          </div>
          <button
            className="save-tx-btn"
            onClick={() => handleSaveOcr(data)}
            disabled={loading}
          >
            {loading ? "Đang lưu..." : "Xác nhận & Lưu"}
          </button>
        </div>
      );
    }

    return null;
  };

  const handleSaveOcr = async (data) => {
    if (!data.total) return;
    setLoading(true);
    try {
      await onCreateTransaction({
        description: data.note || `Hóa đơn từ ${data.merchant || 'AI'}`,
        amount: data.total,
        transaction_type: "expense",
        date: data.date || new Date().toISOString().split('T')[0]
      });
      setMessages(prev => [...prev, { role: "assistant", content: "Đã lưu giao dịch thành công! ✅" }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Không thể lưu giao dịch. Vui lòng thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

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

      const newMsg = {
        role: "assistant",
        content,
        intent: response.intent
      };

      // Tự động nhận diện ý định để lấy dữ liệu phong phú (Rich Data)
      if (response.intent === "forecast") {
        const forecast = await getForecast();
        newMsg.insightType = "forecast";
        newMsg.insightData = forecast;
      } else if (response.intent === "anomalies") {
        const anomalyData = await getAnomalies();
        newMsg.insightType = "anomaly";
        newMsg.insightData = anomalyData;
      } else if (response.intent === "savings") {
        const savings = await getSavingsTips();
        newMsg.insightType = "savings";
        newMsg.insightData = savings;
      }

      setMessages((prev) => [...prev, newMsg]);

      const refreshIntents = [
        "create_transaction",
        "create_transactions",
        "create_expense",
        "create_income",
        "transfer",
        "adjust_balance",
        "update_transaction",
        "delete_transaction",
        "set_budget"
      ];
      if (refreshIntents.includes(response?.intent)) {
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
              <div className="bot-avatar-circle">
                <RobotIcon />
              </div>
              <div>
                <h3>Trợ lý AI</h3>
                <span className="online-status">Đang trực tuyến</span>
              </div>
            </div>
            <button
              className="minimize-btn"
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(true);
              }}
              title="Thu nhỏ trợ lý"
            >
              −
            </button>
          </header>

          <div className="chatbot-messages" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                {msg.role === "assistant" && <div className="msg-avatar">🤖</div>}
                <div className="message-content-wrapper">
                  <div className="message-bubble">
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  {renderInsightData(msg)}
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
        <button
          className={`chatbot-launcher ${isMinimized ? "mini" : ""}`}
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
        >
          <div className="launcher-icon">
            <RobotIcon size={26} />
          </div>
          {!isMinimized ? <div className="launcher-label">Chat AI</div> : null}
        </button>
      )}
    </div>
  );
}
