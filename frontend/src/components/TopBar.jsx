import { t } from "../utils/i18n.js";

const getInitial = (user) => {
  if (!user) return "";
  const source = user?.full_name || user?.username || user?.email || "U";
  return source.trim().charAt(0).toUpperCase();
};

export default function TopBar({ user, notificationsCount = 0, onChange }) {
  const isAuthed = Boolean(user);
  const unreadLabel = notificationsCount > 99 ? "99+" : `${notificationsCount}`;

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        {/* Empty or breadcrumbs could go here */}
      </div>

      <div className="top-bar-right">
        <div className="search-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '16px', color: '#94a3b8' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Tìm kiếm..." className="search-input" style={{ paddingLeft: '44px' }} />
        </div>

        <div className="top-actions">
          <button
            className="icon-btn notif-btn"
            type="button"
            onClick={() => onChange("notifications")}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notificationsCount > 0 && <span className="notif-pill">{unreadLabel}</span>}
          </button>

          <button className="icon-btn theme-btn" type="button" aria-label="Toggle Theme">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>

          {isAuthed ? (
            <button className="avatar-btn" type="button" onClick={() => onChange("settings")}>
              <span className="avatar-dot small">{getInitial(user)}</span>
            </button>
          ) : (
            <button className="ghost" type="button" onClick={() => onChange("auth")}>
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
