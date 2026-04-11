import { t } from "../utils/i18n.js";
import { useEffect, useMemo, useState } from "react";

const primaryViews = [
  { key: "dashboard", label: "nav.dashboard" },
  { key: "transactions", label: "nav.transactions" },
  { key: "reports", label: "nav.reports" },
  { key: "budgets", label: "nav.budgets" }
];

const getInitial = (user) => {
  if (!user) return "";
  const source = user?.full_name || user?.username || user?.email || "U";
  return source.trim().charAt(0).toUpperCase();
};

export default function SideMenu({ active, onChange, onLogout, user, notificationsCount = 0 }) {
  const isAuthed = Boolean(user);
  const unreadLabel = notificationsCount > 99 ? "99+" : `${notificationsCount}`;
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryItems = useMemo(() => primaryViews, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [active]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button
          className="icon-btn mobile-menu-btn"
          type="button"
          aria-label={t("nav.menu", null, "Menu")}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button className="logo-btn" onClick={() => onChange("dashboard")} type="button">
          FinanceAI
        </button>
        <nav className="top-nav">
          {primaryItems.map((item) => (
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

      {mobileOpen && (
        <>
          <button
            className="mobile-drawer-overlay"
            type="button"
            aria-label={t("common.close", null, "Close")}
            onClick={() => setMobileOpen(false)}
          />
          <aside className="mobile-drawer" role="dialog" aria-modal="true">
            <div className="mobile-drawer-header">
              <strong>FinanceAI</strong>
              <button
                className="icon-btn"
                type="button"
                aria-label={t("common.close", null, "Close")}
                onClick={() => setMobileOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mobile-drawer-body">
              <nav className="mobile-drawer-nav" aria-label={t("nav.menu", null, "Menu")}>
                {primaryItems.map((item) => (
                  <button
                    key={item.key}
                    className={`mobile-drawer-link ${active === item.key ? "active" : ""}`}
                    type="button"
                    onClick={() => onChange(item.key)}
                  >
                    {t(item.label)}
                  </button>
                ))}
              </nav>

              <div className="mobile-drawer-actions">
                <button className="mobile-drawer-link" type="button" onClick={() => onChange("notifications")}>
                  {t("nav.notifications")}
                  {notificationsCount > 0 && <span className="notif-pill">{unreadLabel}</span>}
                </button>
                <button className="mobile-drawer-link" type="button" onClick={() => onChange("settings")}>
                  {t("nav.settings")}
                </button>
                {isAuthed ? (
                  <button className="mobile-drawer-link danger" type="button" onClick={onLogout}>
                    {t("nav.logout")}
                  </button>
                ) : (
                  <button className="mobile-drawer-link" type="button" onClick={() => onChange("auth")}>
                    {t("nav.login")}
                  </button>
                )}
              </div>

              {isAuthed && (
                <div className="mobile-drawer-user">
                  <span className="avatar-dot">{getInitial(user)}</span>
                  <div>
                    <div className="mobile-drawer-username">{user?.username || user?.email || "User"}</div>
                    {user?.email && <div className="mobile-drawer-email">{user.email}</div>}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </header>
  );
}
