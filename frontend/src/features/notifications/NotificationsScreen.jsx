import { useMemo, useState } from "react";
import { getLocaleForLanguage, getUserPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";
import { formatNotificationVars, getNotificationTypeLabel } from "../../utils/notifications.js";

const FILTERS = [
  { id: "all", labelKey: "notif.filter_all" },
  { id: "unread", labelKey: "notif.filter_unread" },
  { id: "warning", labelKey: "notif.filter_warning" },
  { id: "insight", labelKey: "notif.filter_insight" }
];

const formatTimestamp = (value, locale) => {
  try {
    return new Date(value).toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return new Date(value).toLocaleString(locale);
  }
};

export default function NotificationsScreen({
  notifications,
  onBack,
  onMarkRead,
  onMarkAllRead,
  onClearAll
}) {
  const [filter, setFilter] = useState("all");
  const locale = getLocaleForLanguage(getUserPrefs().language);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((item) => !item.read);
    if (filter === "warning") return notifications.filter((item) => item.type === "warning");
    if (filter === "insight") return notifications.filter((item) => item.type === "insight");
    return notifications;
  }, [filter, notifications]);

  return (
    <section className="panel notifications-panel">
      <div className="panel-header">
        <div>
          <h3>{t("notif.page_title", null, "Thông báo")}</h3>
          <p className="muted">{t("notif.subtitle", null, "Cập nhật mới nhất cho bạn")}</p>
        </div>
        <div className="row-actions">
          <button className="ghost" type="button" onClick={onMarkAllRead}>
            {t("notif.mark_all", null, "Đánh dấu đã đọc")}
          </button>
          <button className="ghost" type="button" onClick={onClearAll}>
            {t("notif.clear_all", null, "Xóa tất cả")}
          </button>
          <button className="ghost" type="button" onClick={onBack}>
            {t("common.back")}
          </button>
        </div>
      </div>

      <div className="notification-filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "active" : ""}
            onClick={() => setFilter(item.id)}
          >
            {t(item.labelKey, null, item.id)}
          </button>
        ))}
      </div>

      <div className="notification-list">
        {!filteredNotifications.length ? (
          <p className="empty">{t("notif.empty", null, "Chưa có thông báo.")}</p>
        ) : (
          filteredNotifications.map((item) => {
            const vars = formatNotificationVars(item.vars);
            const title = t(item.titleKey, vars, item.titleKey);
            const body = t(item.bodyKey, vars, item.bodyKey);
            return (
              <article
                key={item.id}
                className={`notification-card ${item.read ? "" : "unread"}`}
                onClick={() => onMarkRead(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onMarkRead(item.id);
                }}
              >
                <div className="notification-head">
                  <span className={`notification-badge ${item.type}`}>
                    {getNotificationTypeLabel(item.type)}
                  </span>
                  <span className="notification-time">
                    {formatTimestamp(item.createdAt, locale)}
                  </span>
                </div>
                <h4>{title}</h4>
                <p>{body}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
