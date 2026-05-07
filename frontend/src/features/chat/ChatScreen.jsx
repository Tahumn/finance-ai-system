import { useEffect, useMemo, useRef, useState } from "react";

import { chatWithAi, getForecast, getAnomalies, getSavingsTips } from "../../api/ai.js";
import { currency } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";

const buildStorageKey = (email) => `finance_chat_history:${email || "guest"}`;

const formatTimestamp = (ts) => {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const normalizeText = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const pickVariant = (seed, variants) => {
  if (!variants.length) return "";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % variants.length;
  }
  return variants[hash];
};

const buildMockReply = (text) => {
  const normalized = normalizeText(text);
  const groups = [
    {
      keywords: ["tiet kiem", "tich luy", "saving", "ky luat"],
      replies: ["chat.reply.saving_1", "chat.reply.saving_2", "chat.reply.saving_3"]
    },
    {
      keywords: ["ngan sach", "budget", "ke hoach chi"],
      replies: ["chat.reply.budget_1", "chat.reply.budget_2", "chat.reply.budget_3"]
    },
    {
      keywords: [
        "chi tieu",
        "chi phi",
        "expense",
        "mua sam",
        "an uong",
        "di lai",
        "hoa don",
        "subscription"
      ],
      replies: ["chat.reply.spend_1", "chat.reply.spend_2", "chat.reply.spend_3"]
    },
    {
      keywords: ["thu nhap", "income", "luong", "tang thu", "thuong"],
      replies: ["chat.reply.income_1", "chat.reply.income_2", "chat.reply.income_3"]
    },
    {
      keywords: ["no", "tra no", "vay", "lai suat", "the tin dung", "credit"],
      replies: ["chat.reply.debt_1", "chat.reply.debt_2", "chat.reply.debt_3"]
    },
    {
      keywords: ["dau tu", "invest", "co phieu", "trai phieu", "quy", "etf", "vang"],
      replies: ["chat.reply.invest_1", "chat.reply.invest_2", "chat.reply.invest_3"]
    },
    {
      keywords: ["quy du phong", "khan cap", "emergency"],
      replies: ["chat.reply.emergency_1", "chat.reply.emergency_2", "chat.reply.emergency_3"]
    },
    {
      keywords: ["muc tieu", "ke hoach", "mua nha", "mua xe", "du lich"],
      replies: ["chat.reply.goal_1", "chat.reply.goal_2", "chat.reply.goal_3"]
    },
    {
      keywords: ["theo doi", "ghi chep", "bao cao", "kiem soat", "thong ke"],
      replies: ["chat.reply.track_1", "chat.reply.track_2", "chat.reply.track_3"]
    }
  ];

  for (const group of groups) {
    if (group.keywords.some((keyword) => normalized.includes(keyword))) {
      const key = pickVariant(normalized, group.replies);
      return t(key);
    }
  }

  return t("chat.reply.default", { text });
};

export default function ChatScreen({ userEmail }) {
  const seedMessages = [
    {
      id: "seed-hello",
      role: "assistant",
      content: t("chat.seed")
    }
  ];
  const [messages, setMessages] = useState(seedMessages);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveOcr = async (data) => {
    if (!data.total || !onCreateTransaction) return;
    setIsSaving(true);
    try {
      await onCreateTransaction({
        description: data.note || `Hóa đơn từ ${data.merchant || 'AI'}`,
        amount: data.total,
        transaction_type: "expense",
        date: data.date || new Date().toISOString().split('T')[0]
      });
      setMessages(prev => [
        ...prev,
        { 
          id: `save-${Date.now()}`, 
          role: "assistant", 
          content: "Đã lưu giao dịch thành công! ✅", 
          created_at: Date.now() 
        }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };
  const threadRef = useRef(null);

  const storageKey = useMemo(() => buildStorageKey(userEmail), [userEmail]);

  useEffect(() => {
    setLoaded(false);
    if (!userEmail) {
      setMessages(seedMessages);
      setLoaded(true);
      return;
    }
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        setMessages(JSON.parse(raw));
      } catch {
        setMessages(seedMessages);
      }
    } else {
      setMessages(seedMessages);
    }
    setLoaded(true);
  }, [storageKey, userEmail]);

  useEffect(() => {
    if (!loaded) return;
    if (!userEmail) return;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, loaded, storageKey, userEmail]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const suggestions = [
    { text: "Dự đoán xu hướng chi tiêu", icon: "📈" },
    { text: "Gợi ý tiết kiệm / cắt giảm", icon: "💡" },
    { text: "Phát hiện bất thường chi tiêu", icon: "🔍" }
  ];

  const handleSend = async (event, presetText = null, type = "chat") => {
    if (event) event.preventDefault();
    const text = typeof presetText === "string" ? presetText : input.trim();
    if (!text && type === "chat") return;

    const now = Date.now();
    if (text) {
      setMessages((current) => [
        ...current,
        { id: `u-${now}`, role: "user", content: text, created_at: now }
      ]);
      setInput("");
    }

    setIsTyping(true);
    let reply = "";
    let insightData = null;

    // Simulate AI thinking delay for premium feel
    await new Promise(r => setTimeout(r, text ? 800 : 400));

    try {
      if (type === "forecast") {
        insightData = await getForecast();
        reply = insightData.summary || "Dự báo xu hướng chi tiêu của bạn dựa trên dữ liệu 6 tháng qua.";
      } else if (type === "savings") {
        insightData = await getSavingsTips();
        reply = insightData.summary || "Tôi đã phân tích và tìm ra một số cách giúp bạn tối ưu ngân sách.";
      } else if (type === "anomaly") {
        insightData = await getAnomalies();
        reply = insightData.summary || "Tôi phát hiện một vài điểm chi tiêu bất thường cần bạn lưu ý.";
      } else {
        const response = await chatWithAi(text);
        reply = response?.answer || "";
        const refreshIntents = [
          "create_transaction",
          "create_transactions",
          "create_expense",
          "create_income",
          "transfer",
          "adjust_balance",
          "update_transaction",
          "delete_transaction",
          "set_budget",
        ];
        if (refreshIntents.includes(response?.intent)) {
          window.dispatchEvent(
            new CustomEvent("finance:refresh", {
              detail: {
                startDate: response.start_date || null,
                endDate: response.end_date || null,
              },
            })
          );
        }
      }
    } catch {
      reply = "";
    }

    if (!reply) {
      reply = buildMockReply(text);
    }

    setIsTyping(false);
    setMessages((current) => [
      ...current,
      {
        id: `a-${now}`,
        role: "assistant",
        content: reply,
        created_at: now + 50,
        insightType: type,
        insightData: insightData
      }
    ]);
  };

  const renderInsightData = (item) => {
    if (!item.insightData) return null;

    if (item.insightType === "forecast") {
      const { points = [], risk_level = "low", top_growing_categories = [] } = item.insightData;
      return (
        <div className="premium-insight-card forecast-card">
          <div className="card-header-ai">
            <span className="icon">📈</span>
            <strong>{t("reports.forecast_title", null, "Dự báo 3 tháng tới")}</strong>
          </div>
          <div className="forecast-grid-premium">
            {points.map((pt) => (
              <div key={pt.month} className="forecast-item-premium">
                <span className="label">{pt.month}</span>
                <span className="val">{currency(pt.predicted_expense)}</span>
                <div className="progress-track"><div className="progress-fill" style={{width: '70%', background: 'var(--primary)'}}></div></div>
              </div>
            ))}
          </div>
          {top_growing_categories.length > 0 && (
            <div className="growing-categories">
              <span className="muted">Tăng mạnh:</span>
              <div className="tags">
                {top_growing_categories.map(c => <span key={c} className="premium-tag warn">{c}</span>)}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (item.insightType === "savings") {
      const { tips = [], total_potential_saving = 0 } = item.insightData;
      return (
        <div className="premium-insight-card saving-card">
          <div className="card-header-ai">
            <span className="icon">💡</span>
            <strong>{t("reports.saving_title", null, "Gợi ý tiết kiệm")}</strong>
          </div>
          <div className="saving-summary-premium">
            <div className="save-total">
              <span>Tiềm năng:</span>
              <strong>{currency(total_potential_saving)}</strong>
            </div>
          </div>
          <div className="tips-list-premium">
            {tips.map((tip, i) => (
              <div key={i} className="tip-row-premium">
                <div className="tip-info">
                  <span className="cat">{tip.category}</span>
                  <span className="amt">-{currency(tip.potential_saving)}</span>
                </div>
                <p className="note">{tip.note}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.insightType === "anomaly") {
      const anomalies = item.insightData.alerts || item.insightData.anomalies || [];
      return (
        <div className="premium-insight-card anomaly-card">
          <div className="card-header-ai">
            <span className="icon">🔍</span>
            <strong>{t("reports.anomaly_title", null, "Phát hiện bất thường")}</strong>
          </div>
          <div className="anomaly-list-premium">
            {anomalies.map((a, i) => (
              <div key={i} className={`anomaly-item-premium ${a.severity}`}>
                <div className="anomaly-meta">
                  <span className="date">{new Date(a.date).toLocaleDateString('vi-VN')}</span>
                  <span className="amt">{currency(a.amount)}</span>
                </div>
                <p className="reason">{a.reason || a.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (item.insightType === "ocr_result") {
      const data = item.insightData;
      return (
        <div className="premium-insight-card ocr-confirm-card">
          <div className="card-header-ai">
            <span className="icon">📄</span>
            <strong>Xác nhận hóa đơn</strong>
          </div>
          <div className="ocr-details">
            <div className="ocr-row"><span>Cửa hàng:</span> <strong>{data.merchant}</strong></div>
            <div className="ocr-row"><span>Ngày:</span> <strong>{data.date}</strong></div>
            <div className="ocr-row"><span>Tổng tiền:</span> <strong className="primary">{currency(data.total)}</strong></div>
          </div>
          <button 
            className="premium-btn save-btn" 
            onClick={() => handleSaveOcr(data)}
          >
            Lưu vào sổ cái
          </button>
        </div>
      );
    }

    return null;
  };

  const handleClear = () => {
    setMessages(seedMessages);
    if (userEmail) {
      localStorage.removeItem(storageKey);
    }
  };

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <h3>{t("chat.title")}</h3>
          <p className="chat-subtitle">{t("chat.subtitle")}</p>
        </div>
        <button className="ghost" type="button" onClick={handleClear}>
          {t("chat.clear")}
        </button>
      </div>

      <div className="chat-thread" ref={threadRef}>
        {messages.length <= 1 && (
          <div className="chat-starter-card">
            <div className="insight-badge-ai">
              <span>✦ AI</span>
            </div>
            <div className="starter-header">
              <h4>TIK-TIK AI Insights</h4>
              <p>Phân tích thông minh dựa trên dữ liệu tài chính của bạn</p>
            </div>
          </div>
        )}

        {messages.map((item) => (
          <div
            key={item.id}
            className={`chat-bubble ${item.role === "user" ? "is-user" : "is-bot"}`}
          >
            <div className="bubble-content">
              <p>{item.content}</p>
              {renderInsightData(item)}
              {item.created_at && <span className="timestamp">{formatTimestamp(item.created_at)}</span>}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-bubble is-bot typing">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-wrapper">
        <div className="chat-suggestions sticky">
          <button type="button" className="suggestion-chip" onClick={() => handleSend(null, "Dự báo", "forecast")}>
            <span className="chip-icon">📈</span> Dự báo
          </button>
          <button type="button" className="suggestion-chip" onClick={() => handleSend(null, "Tiết kiệm", "savings")}>
            <span className="chip-icon">💡</span> Tiết kiệm
          </button>
          <button type="button" className="suggestion-chip" onClick={() => handleSend(null, "Bất thường", "anomaly")}>
            <span className="chip-icon">🔍</span> Bất thường
          </button>
        </div>

        <form className="chat-input" onSubmit={handleSend}>
          <input
            type="text"
            placeholder={t("chat.placeholder")}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button className="primary" type="submit" disabled={!input.trim()}>
            {t("chat.send")}
          </button>
        </form>
      </div>
    </section>
  );
}
