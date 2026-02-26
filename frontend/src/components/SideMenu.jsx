const views = [
  { key: "dashboard", label: "Dashboard" },
  { key: "transactions", label: "Transactions" },
  { key: "reports", label: "Reports" },
  { key: "budgets", label: "Budgets" },
  { key: "ocr", label: "OCR" },
  { key: "chat", label: "Chat" },
  { key: "settings", label: "Settings" }
];

export default function SideMenu({ active, onChange, onLogout }) {
  return (
    <aside className="side-menu">
      <h2>Finance AI</h2>
      <nav className="side-menu-nav">
        {views.map((item) => (
          <button
            key={item.key}
            className={`side-menu-item ${active === item.key ? "active" : ""}`}
            type="button"
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <button className="ghost side-menu-logout" type="button" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
}
