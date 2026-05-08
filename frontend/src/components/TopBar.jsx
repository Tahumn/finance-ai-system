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
      </div>
    </header>
  );
}
