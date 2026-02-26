const primaryViews = [
  { key: "dashboard", label: "Dashboard" },
  { key: "transactions", label: "Transactions" },
  { key: "reports", label: "Reports" },
  { key: "budgets", label: "Budgets" },
  { key: "chat", label: "Chat" }
];

const getInitial = (user) => {
  const source = user?.full_name || user?.username || user?.email || "U";
  return source.trim().charAt(0).toUpperCase();
};

export default function SideMenu({ active, onChange, onLogout, user }) {
  const notifications = [
    {
      id: "n1",
      title: "Chi tiêu ăn uống tăng 18%",
      time: "Hôm nay"
    },
    {
      id: "n2",
      title: "Hoá đơn OCR đã được tạo giao dịch",
      time: "Hôm qua"
    },
    {
      id: "n3",
      title: "Sắp đến hạn ngân sách tháng",
      time: "2 ngày trước"
    }
  ];

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button className="logo-btn" onClick={() => onChange("dashboard")} type="button">
          FinanceAI
        </button>
        <nav className="top-nav">
          {primaryViews.map((item) => (
            <button
              key={item.key}
              className={`top-nav-item ${active === item.key ? "active" : ""}`}
              type="button"
              onClick={() => onChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="top-header-right">
        <details className="notif-menu">
          <summary className="icon-btn notif-btn" aria-label="Thông báo">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d="M12 3a6 6 0 0 0-6 6v3.2l-1.6 2.4a1 1 0 0 0 .84 1.56h13.52a1 1 0 0 0 .84-1.56L18 12.2V9a6 6 0 0 0-6-6Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 18a2.5 2.5 0 0 0 5 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </summary>
          <div className="notif-dropdown">
            <div className="notif-header">Thông báo</div>
            {!notifications.length ? (
              <p className="empty">Chưa có thông báo.</p>
            ) : (
              notifications.map((item) => (
                <div key={item.id} className="notif-item">
                  <strong>{item.title}</strong>
                  <small>{item.time}</small>
                </div>
              ))
            )}
          </div>
        </details>
        <button
          className="avatar-chip avatar-button"
          type="button"
          onClick={() => onChange("settings")}
          title="Tài khoản & bảo mật"
        >
          <span className="avatar-dot">{getInitial(user)}</span>
          <span>{user?.username || user?.email || "User"}</span>
        </button>
        <button className="ghost top-logout" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
