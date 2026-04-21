import { t } from "../utils/i18n.js";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const primaryViews = [
  { key: "dashboard", label: "nav.dashboard" },
  { key: "transactions", label: "nav.transactions" },
  { key: "reports", label: "nav.reports" },
  { key: "budgets", label: "nav.budgets" },
  { key: "recurring", label: "nav.recurring" }
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
  const headerRef = useRef(null);

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

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el || typeof document === "undefined") return;

    const applyHeaderHeight = () => {
      const height = Math.max(0, Math.ceil(el.getBoundingClientRect().height));
      if (!height) return;
      document.documentElement.style.setProperty("--top-header-height", `${height}px`);
    };

    applyHeaderHeight();
    const raf1 = window.requestAnimationFrame(applyHeaderHeight);
    const raf2 = window.requestAnimationFrame(applyHeaderHeight);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            applyHeaderHeight();
          });
    resizeObserver?.observe(el);

    window.addEventListener("resize", applyHeaderHeight);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener("resize", applyHeaderHeight);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      <header ref={headerRef} className="top-header">
        <div className="top-header-left">
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
          <div className="notif-menu">
            <button
              className="notif-btn"
              type="button"
              onClick={() => onChange("notifications")}
              aria-label={t("nav.notifications", null, "Notifications")}
              title={t("nav.notifications", null, "Notifications")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 21a2 2 0 0 1-3.46 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {notificationsCount > 0 && <span className="notif-pill">{unreadLabel}</span>}
            </button>
          </div>

          {isAuthed ? (
            <button
              className="avatar-chip avatar-button"
              type="button"
              onClick={() => onChange("settings")}
              title={t("nav.account")}
            >
              <span className="avatar-dot">{getInitial(user)}</span>
              <span>{user?.username || user?.email || "User"}</span>
            </button>
          ) : (
            <button
              className="avatar-chip avatar-button guest"
              type="button"
              onClick={() => onChange("auth")}
              title={t("nav.login")}
            >
              <span>{t("nav.login")}</span>
            </button>
          )}
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
          {isAuthed && (
            <button className="ghost top-logout" type="button" onClick={onLogout}>
              {t("nav.logout")}
            </button>
          )}
        </div>
      </header>

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
            </div>
          </aside>
        </>
      )}
    </>
  );
}
