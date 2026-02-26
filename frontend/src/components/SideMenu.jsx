const primaryViews = [
  { key: "dashboard", label: "Dashboard" },
  { key: "transactions", label: "Transactions" },
  { key: "reports", label: "Reports" },
  { key: "budgets", label: "Budgets" },
  { key: "chat", label: "Chat" },
  { key: "settings", label: "Settings" }
];

const toolViews = [
  { key: "ocr", label: "OCR" },
  { key: "dashboard", label: "AI Insights" },
  { key: "categories", label: "Categories" },
  { key: "tags", label: "Tags" }
];

const getInitial = (user) => {
  const source = user?.full_name || user?.username || user?.email || "U";
  return source.trim().charAt(0).toUpperCase();
};

export default function SideMenu({ active, onChange, onLogout, user }) {
  const isToolsActive = ["ocr", "categories", "tags"].includes(active);
  const handleToolClick = (event, key) => {
    onChange(key);
    const menu = event.currentTarget.closest("details");
    if (menu) menu.removeAttribute("open");
  };

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
          <details className={`tools-menu ${isToolsActive ? "active" : ""}`}>
            <summary className="top-nav-item">Tools ▼</summary>
            <div className="tools-dropdown">
              {toolViews.map((item) => (
                <button
                  key={item.label}
                  className="tools-item"
                  type="button"
                  onClick={(event) => handleToolClick(event, item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </details>
        </nav>
      </div>

      <div className="top-header-right">
        <div className="avatar-chip">
          <span className="avatar-dot">{getInitial(user)}</span>
          <span>{user?.email || "User"}</span>
        </div>
        <button className="ghost top-logout" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
