import { t } from "../utils/i18n.js";

const views = [
  { key: "dashboard", label: "nav.overview" },
  { key: "transactions", label: "nav.add_tx" },
  { key: "reports", label: "nav.reports" },
  { key: "notifications", label: "nav.notifications" },
  { key: "settings", label: "nav.settings" }
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
          {t(item.label)}
        </button>
      ))}
    </nav>
  );
}
