import { t } from "../utils/i18n.js";

const primaryViews = [
  { key: "dashboard", label: "nav.dashboard" },
  { key: "transactions", label: "nav.transactions" },
  { key: "reports", label: "nav.reports" },
  { key: "budgets", label: "nav.budgets" },
  { key: "chat", label: "nav.chat" }
];

const getInitial = (user) => {
  if (!user) return "";
  const source = user?.full_name || user?.username || user?.email || "U";
  return source.trim().charAt(0).toUpperCase();
};

export default function SideMenu({ active, onChange, onLogout, user, notificationsCount = 0 }) {
  const isAuthed = Boolean(user);
  const unreadLabel = notificationsCount > 99 ? "99+" : `${notificationsCount}`;

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
              {t(item.label)}
            </button>
          ))}
        </nav>
      </div>

      <div className="top-header-right">
        <button
          className="icon-btn notif-btn"
          type="button"
          onClick={() => onChange("notifications")}
          aria-label={t("notif.title", null, "Thông báo")}
        >
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
          {notificationsCount > 0 && <span className="notif-pill">{unreadLabel}</span>}
        </button>
        <button
          className="avatar-chip avatar-button"
          type="button"
          onClick={() => onChange("settings")}
          title={t("nav.account")}
        >
          {isAuthed && <span className="avatar-dot">{getInitial(user)}</span>}
          <span>{isAuthed ? user?.username || user?.email || "User" : t("nav.login")}</span>
        </button>
        {isAuthed && (
          <button className="ghost top-logout" type="button" onClick={onLogout}>
            {t("nav.logout")}
          </button>
        )}
      </div>
    </header>
  );
}
