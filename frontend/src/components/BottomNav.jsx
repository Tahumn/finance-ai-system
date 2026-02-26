const views = [
  { key: "dashboard", label: "Tổng quan" },
  { key: "transactions", label: "Thêm GD" },
  { key: "chat", label: "Chat" },
  { key: "reports", label: "Báo cáo" },
  { key: "settings", label: "Hồ sơ" }
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {views.map((item) => (
        <button
          key={item.key}
          className={active === item.key ? "active" : ""}
          onClick={() => onChange(item.key)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
