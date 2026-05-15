import { useMemo, useState } from "react";
import { getLocaleForLanguage, getUserPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";
import { formatNotificationVars, getNotificationTypeLabel } from "../../utils/notifications.js";
import "./notifications.css";

const FILTERS = [
  { id: "all", labelKey: "notif.filter_all", labelDefault: "Tất cả" },
  { id: "unread", labelKey: "notif.filter_unread", labelDefault: "Chưa đọc" },
  { id: "warning", labelKey: "notif.filter_warning", labelDefault: "Cảnh báo" },
  { id: "insight", labelKey: "notif.filter_insight", labelDefault: "Gợi ý AI" }
];

/* SVG Icons */
const IcWarning = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IcSparkle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>
  </svg>
);
const IcBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const IcClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);
const IcBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);
const IcTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
  </svg>
);
const IcCheckAll = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5M12 6l11 11"/>
  </svg>
);

const formatTimestamp = (value, locale) => {
  try {
    const d = new Date(value);
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    const date = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
    return `${time} ${date}`;
  } catch {
    return String(value);
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
    <section className="notif-layout">
      <div className="notif-header">
        <div className="notif-title-area">
          <h2>{t("notif.page_title", null, "Thông báo")}</h2>
        </div>
        <div className="notif-header-actions">
          <button className="notif-btn-ghost" type="button" onClick={onMarkAllRead}>
            <IcCheckAll /> {t("notif.mark_all", null, "Đánh dấu đã đọc")}
          </button>
          <button className="notif-btn-ghost notif-btn-danger" type="button" onClick={onClearAll}>
            <IcTrash /> {t("notif.clear_all", null, "Xóa tất cả")}
          </button>
          <button className="notif-btn-ghost" type="button" onClick={onBack}>
            <IcBack /> {t("common.back", null, "Quay lại")}
          </button>
        </div>
      </div>

      <div className="notif-tabs">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`notif-tab ${filter === item.id ? "active" : ""}`}
            onClick={() => setFilter(item.id)}
          >
            {t(item.labelKey, null, item.labelDefault)}
          </button>
        ))}
      </div>

      <div className="notif-list">
        {!filteredNotifications.length ? (
          <p className="empty-state" style={{textAlign:'center', padding:40, color:'#64748b'}}>
            {t("notif.empty", null, "Chưa có thông báo mới.")}
          </p>
        ) : (
          filteredNotifications.map((item) => {
            const vars = formatNotificationVars(item.vars);
            const title = t(item.titleKey, vars, item.titleKey);
            const body = t(item.bodyKey, vars, item.bodyKey);
            
            let IconComp = IcBell;
            if (item.type === "warning") IconComp = IcWarning;
            if (item.type === "insight") IconComp = IcSparkle;

            return (
              <article
                key={item.id}
                className={`notif-card ${item.type || "info"} ${item.read ? "" : "unread"}`}
                onClick={() => onMarkRead(item.id)}
              >
                <div className="notif-left">
                  <div className={`notif-icon-box ${item.type || "info"}`}>
                    <IconComp />
                  </div>
                  <div className="notif-content">
                    <div className="notif-card-head">
                      <span className={`notif-badge ${item.type || "info"}`}>
                        {getNotificationTypeLabel(item.type)}
                      </span>
                      <h4>{title}</h4>
                    </div>
                    <p>{body}</p>
                  </div>
                </div>
                <div className="notif-right">
                  <span className="notif-time">{formatTimestamp(item.createdAt, locale)}</span>
                  {!item.read && <span className="notif-unread-dot" />}
                </div>
              </article>
            );
          })
        )}
      </div>

    </section>
  );
}
