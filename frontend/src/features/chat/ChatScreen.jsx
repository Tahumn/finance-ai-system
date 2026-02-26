import { useEffect, useMemo, useRef, useState } from "react";

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
      replies: [
        "Gợi ý: đặt mục tiêu tiết kiệm theo tháng và theo dõi dòng tiền ra vào.",
        "Bạn có thể bắt đầu với 10-20% thu nhập, sau đó tăng dần khi ổn định.",
        "Chia mục tiêu lớn thành mục tiêu nhỏ theo tuần hoặc theo tháng sẽ dễ theo hơn."
      ]
    },
    {
      keywords: ["ngan sach", "budget", "ke hoach chi"],
      replies: [
        "Gợi ý: thử quy tắc 50/30/20 và điều chỉnh theo thu nhập thực tế.",
        "Lập ngân sách theo tuần giúp bạn kiểm soát chi tiêu linh hoạt hơn.",
        "Hãy đặt giới hạn cho từng danh mục và xem lại mỗi cuối tuần."
      ]
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
      replies: [
        "Gợi ý: nhóm chi phí theo danh mục và đặt giới hạn cho mỗi danh mục.",
        "Theo dõi 7 ngày liên tiếp để xác định khoản chi nào là không cần thiết.",
        "Bạn có thể thử cắt 1-2 khoản chi nhỏ và đánh giá lại sau 30 ngày."
      ]
    },
    {
      keywords: ["thu nhap", "income", "luong", "tang thu", "thuong"],
      replies: [
        "Gợi ý: ưu tiên tiết kiệm trước, chi tiêu sau (pay yourself first).",
        "Hãy tách tiền thu nhập thành các phong bì: tiết kiệm, chi tiêu, dự phòng.",
        "Nếu thu nhập không đều, hãy lấy mức trung bình 3 tháng làm mốc."
      ]
    },
    {
      keywords: ["no", "tra no", "vay", "lai suat", "the tin dung", "credit"],
      replies: [
        "Gợi ý: ưu tiên trả khoản có lãi suất cao trước (avalanche).",
        "Bạn có thể thử phương pháp snowball: trả khoản nhỏ trước để tạo động lực.",
        "Hạn chế dùng thẻ tín dụng cho khoản chi không thiết yếu."
      ]
    },
    {
      keywords: ["dau tu", "invest", "co phieu", "trai phieu", "quy", "etf", "vang"],
      replies: [
        "Gợi ý: bắt đầu với quỹ dự phòng trước khi đầu tư.",
        "Bạn có thể tìm hiểu ETF hoặc quỹ mở để đa dạng hóa rủi ro.",
        "Luôn xác định mục tiêu và khẩu vị rủi ro trước khi giải ngân."
      ]
    },
    {
      keywords: ["quy du phong", "khan cap", "emergency"],
      replies: [
        "Gợi ý: xây quỹ dự phòng 3-6 tháng chi tiêu thiết yếu.",
        "Tách quỹ dự phòng khỏi tài khoản chi tiêu để tránh dùng nhầm.",
        "Có thể đặt chuyển khoản tự động mỗi tháng cho quỹ dự phòng."
      ]
    },
    {
      keywords: ["muc tieu", "ke hoach", "mua nha", "mua xe", "du lich"],
      replies: [
        "Gợi ý: đặt mục tiêu theo thời hạn và số tiền cụ thể.",
        "Chia mục tiêu thành các mốc nhỏ sẽ dễ theo dõi hơn.",
        "Bạn có thể lập kế hoạch theo tháng rồi điều chỉnh theo thực tế."
      ]
    },
    {
      keywords: ["theo doi", "ghi chep", "bao cao", "kiem soat", "thong ke"],
      replies: [
        "Gợi ý: ghi lại chi tiêu hằng ngày để thấy mô hình tiêu dùng.",
        "Kiểm tra báo cáo mỗi tuần giúp bạn điều chỉnh kịp thời.",
        "Bạn có thể đặt nhắc nhở cuối ngày để cập nhật giao dịch."
      ]
    }
  ];

  for (const group of groups) {
    if (group.keywords.some((keyword) => normalized.includes(keyword))) {
      return pickVariant(normalized, group.replies);
    }
  }

  return `Tôi đang ở chế độ demo. Bạn vừa hỏi: "${text}".`;
};

export default function ChatScreen({ userEmail }) {
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

  const handleSend = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    const now = Date.now();
    const next = [
      ...messages,
      { id: `u-${now}`, role: "user", content: text, created_at: now },
      {
        id: `a-${now}`,
        role: "assistant",
        content: buildMockReply(text),
        created_at: now + 1
      }
    ];
    setMessages(next);
    setInput("");
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
          <h3>Chat AI</h3>
          <p className="chat-subtitle">
            Chế độ demo. Câu trả lời được mô phỏng trên frontend.
          </p>
        </div>
        <button className="ghost" type="button" onClick={handleClear}>
          Xoá lịch sử
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
          placeholder="Nhập câu hỏi về tài chính..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="primary" type="submit" disabled={!input.trim()}>
          Gửi
        </button>
      </form>
    </section>
  );
}
