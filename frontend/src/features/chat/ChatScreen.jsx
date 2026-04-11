import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../utils/i18n.js";

import { chatWithAi } from "../../api/ai.js";

const seedMessages = [
  {
    id: "seed-hello",
    role: "assistant",
    content:
      "Chat AI (demo). Hãy hỏi về thu chi, ngân sách, hoặc kế hoạch tiết kiệm."
  }
];

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

  const handleSend = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    const now = Date.now();
    setMessages((current) => [
      ...current,
      { id: `u-${now}`, role: "user", content: text, created_at: now }
    ]);
    setInput("");

    let reply = "";
    try {
      const response = await chatWithAi(text);
      reply = response?.answer || "";
    } catch {
      reply = "";
    }

    if (!reply) {
      reply = "Khong the tra loi. Vui long thu lai hoac hoi ro hon.";
    }

    setMessages((current) => [
      ...current,
      {
        id: `a-${now}`,
        role: "assistant",
        content: reply,
        created_at: now + 1
      }
    ]);
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
        {messages.map((item) => (
          <div
            key={item.id}
            className={`chat-bubble ${item.role === "user" ? "is-user" : "is-bot"}`}
          >
            <p>{item.content}</p>
            {item.created_at && <span>{formatTimestamp(item.created_at)}</span>}
          </div>
        ))}
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
    </section>
  );
}
