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
        {/* Search removed as per user request */}
      </div>
    </header>
  );
}
