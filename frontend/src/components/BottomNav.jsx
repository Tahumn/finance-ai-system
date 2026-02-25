const views = [
  { key: "dashboard", label: "Tổng quan" },
  { key: "transactions", label: "Giao dịch" },
  { key: "categories", label: "Danh mục" },
  { key: "reports", label: "Báo cáo" }
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {views.map((item) => (
        <button
          key={item.key}
          className={active === item.key ? "active" : ""}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
