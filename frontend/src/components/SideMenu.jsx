import { t } from "../utils/i18n.js";
import { useEffect, useState } from "react";

const getInitial = (user) => {
  if (!user) return "";
  const source = user?.full_name || user?.username || user?.email || "U";
  return source.trim().charAt(0).toUpperCase();
};

export default function SideMenu({ active, onChange, onLogout, user, notificationsCount = 0 }) {
  const isAuthed = Boolean(user);
  const [collapsed, setCollapsed] = useState(false);

  const mainNav = [
    { key: "dashboard", label: "Tổng quan", icon: <IcOverview /> },
    { key: "transactions", label: "Giao dịch", icon: <IcTransactions /> },
    { key: "budgets", label: "Ngân sách", icon: <IcBudgets /> },
    { key: "reports", label: "Báo cáo", icon: <IcReports /> },
    { key: "goals", label: "Mục tiêu", icon: <IcGoals /> },
    { key: "notifications", label: "Thông báo", icon: <IcNotifications /> },
    { key: "bills", label: "Hóa đơn", icon: <IcBills /> },
    // { key: "contacts", label: "Danh bạ", icon: <IcContacts /> }
  ];

  const toolsNav = [
    // { key: "reminders", label: "Nhắc nhở", icon: <IcReminders /> },
    { key: "accounts", label: "Thẻ & Tài khoản", icon: <IcAccounts /> },
    // { key: "categories", label: "Danh mục", icon: <IcCategories /> },
    // { key: "tags", label: "Nhãn", icon: <IcTags /> },
    // { key: "templates", label: "Mẫu giao dịch", icon: <IcTemplates /> },
    { key: "settings", label: "Cài đặt", icon: <IcSettings /> }
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="logo-btn" onClick={() => onChange("dashboard")} type="button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#F9206B" />
            <path d="M2 17L12 22L22 17" stroke="#F9206B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="#F9206B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="logo-text">Finanzy</span>
        </button>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          type="button"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar-wrapper">
          <div className="user-avatar">{isAuthed ? getInitial(user) : "?"}</div>
        </div>
        <div className="user-info">
          <div className="user-name">{isAuthed ? (user?.full_name || user?.username || "User") : "Khách"}</div>
          <div className="user-email">{isAuthed ? user?.email : "Chưa đăng nhập"}</div>
        </div>
        {isAuthed && (
          <div className="user-status">
            <span className="status-dot"></span> Đang hoạt động
          </div>
        )}
      </div>

      <div className="sidebar-scroll">
        <nav className="sidebar-nav">
          <ul>
            {mainNav.map((item) => (
              <li key={item.key}>
                <button
                  className={`nav-item ${active === item.key ? "active" : ""}`}
                  onClick={() => onChange(item.key)}
                  type="button"
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">
                    {item.label}
                    {item.key === "notifications" && notificationsCount > 0 && (
                      <span className="nav-notif-badge">{notificationsCount > 99 ? "99+" : notificationsCount}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="nav-section-title">Công cụ</div>
          <ul>
            {toolsNav.map((item) => (
              <li key={item.key}>
                <button
                  className={`nav-item ${active === item.key ? "active" : ""}`}
                  onClick={() => onChange(item.key)}
                  type="button"
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="sidebar-footer">
        <ul>
          <li>
            <button className="nav-item" onClick={() => { }} type="button">
              {/* <span className="nav-icon"><IcHelp /></span>
              <span className="nav-label">Trợ giúp & Hỗ trợ</span> */}
            </button>
          </li>
          {isAuthed ? (
            <li>
              <button className="nav-item" onClick={onLogout} type="button">
                <span className="nav-icon"><IcLogout /></span>
                <span className="nav-label">Đăng xuất</span>
              </button>
            </li>
          ) : (
            <li>
              <button className="nav-item" onClick={() => onChange("auth")} type="button">
                <span className="nav-icon"><IcLogout /></span>
                <span className="nav-label">Đăng nhập</span>
              </button>
            </li>
          )}
        </ul>
        <div className="sidebar-copyright">
          © 2026 Finanzy. Tất cả quyền được bảo lưu.
        </div>
      </div>
    </aside>
  );
}

// Icons
const IcOverview = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
const IcTransactions = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>;
const IcBudgets = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const IcReports = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="8" y2="16" /><line x1="16" y1="10" x2="16" y2="16" /></svg>;
const IcGoals = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
const IcLoans = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
const IcInvestments = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>;
const IcBills = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
const IcContacts = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const IcReminders = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
const IcAccounts = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const IcCategories = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
const IcTags = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
const IcTemplates = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M12 8v8M8 12h8" /></svg>;
const IcSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
const IcHelp = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const IcLogout = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
const IcNotifications = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
