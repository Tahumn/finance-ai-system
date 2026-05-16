import { useEffect, useRef, useState } from "react";
import { getUserPrefs, saveUserPrefs } from "../../utils/userPrefs.js";
import { applyUiPrefs, getUiPrefs, saveUiPrefs, UI_COLORS, UI_LAYOUTS } from "../../utils/uiPrefs.js";
import { t } from "../../utils/i18n.js";
import "./settings.css";

const settingsKey = (email) => `finance_local_settings:${email || "guest"}`;

const defaultSettings = {
  pushNotifications: true,
  emailNotifications: true,
  thresholdAlerts: true,
  cloudSync: false,
  aiOptIn: true,
  keepPromptLogs: true,
  estimatedMonthlyCost: 3
};

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export default function SettingsScreen({ user, onLogout }) {
  const email = user?.email || "guest";
  
  // States
  const [settings, setSettings] = useState(defaultSettings);
  const [uiPrefs, setUiPrefs] = useState(() => getUiPrefs(email));
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);

  const activityLogs = [];

  useEffect(() => {
    const saved = localStorage.getItem(settingsKey(email));
    if (saved) {
      setSettings((prev) => ({ ...prev, ...safeParse(saved, {}) }));
    }
  }, [email]);

  const updateSetting = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem(settingsKey(email), JSON.stringify(next));
    setNotice("Đã lưu tùy chọn.");
    setTimeout(() => setNotice(""), 3000);
  };

  const updateUi = (key, value) => {
    const next = { ...uiPrefs, [key]: value };
    
    // For specific keys, we also update userPrefs to ensure global effect (like t() function)
    if (key === "language" || key === "theme") {
      const uPrefs = getUserPrefs(email);
      saveUserPrefs(email, { ...uPrefs, [key]: value });
    }

    setUiPrefs(next);
    saveUiPrefs(email, next);
    applyUiPrefs(next);
  };

  const updateColor = (hex) => {
    updateUi("brandColor", hex);
  };

  return (
    <div className="stg-container">
      <div className="stg-header-top">
        <h2 className="stg-header-title">Cài đặt</h2>
      </div>

      <div className="stg-profile-card">
        <div className="stg-profile-left">
          <div className="stg-profile-avatar">
            {user?.full_name ? user.full_name.charAt(0) : "M"}
            <div className="edit-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </div>
          </div>
          <div className="stg-profile-info">
            <h3>{user?.full_name || user?.username || "Người dùng"} <span className="status-badge">Đang hoạt động</span></h3>
            <p>{user?.email || "—"} • @{user?.username || "—"}</p>
            <p className="join-date">Thông tin tài khoản lấy từ API đăng nhập.</p>
          </div>
        </div>
        <button className="stg-btn-outline" type="button">Chỉnh sửa hồ sơ</button>
      </div>

      <div className="stg-grid-3">
        {/* Cột 1: Thông báo */}
        <div className="stg-col">
          <div className="stg-card">
            <div className="stg-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <h4>Thông báo & Đồng bộ</h4>
            </div>

            <div className="stg-toggle-item" onClick={() => updateSetting("pushNotifications", !settings.pushNotifications)}>
              <div className="stg-toggle-info">
                <p>Thông báo đẩy (Push)</p>
                <span>Nhận thông báo trên trình duyệt</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={settings.pushNotifications} readOnly />
            </div>
            
            <div className="stg-toggle-item" onClick={() => updateSetting("emailNotifications", !settings.emailNotifications)}>
              <div className="stg-toggle-info">
                <p>Báo cáo email hàng tuần</p>
                <span>Gửi báo cáo tài chính vào ngày Chủ nhật</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={settings.emailNotifications} readOnly />
            </div>

            <div className="stg-toggle-item" onClick={() => updateSetting("thresholdAlerts", !settings.thresholdAlerts)}>
              <div className="stg-toggle-info">
                <p>Cảnh báo chi tiêu</p>
                <span>Thông báo khi vượt ngân sách hoặc bất thường</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={settings.thresholdAlerts} readOnly />
            </div>
          </div>
        </div>

        {/* Cột 2: Bảo mật */}
        <div className="stg-col">
          <div className="stg-card">
            <div className="stg-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <h4>Bảo mật</h4>
            </div>

            <div className="stg-input-group">
              <input type="password" placeholder="Mật khẩu hiện tại" className="stg-input" />
            </div>
            <div className="stg-input-group">
              <input type="password" placeholder="Mật khẩu mới" className="stg-input" />
            </div>
            <div className="stg-input-group">
              <input type="password" placeholder="Xác nhận mật khẩu mới" className="stg-input" />
            </div>
            <button className="stg-btn-full" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Đổi mật khẩu
            </button>
          </div>
        </div>

        {/* Cột 3: Giao diện */}
        <div className="stg-col">
          <div className="stg-card">
            <div className="stg-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              <h4>Giao diện & Cá nhân hóa</h4>
            </div>

            <div className="stg-select-row">
              <label>Ngôn ngữ hiển thị</label>
              <select className="stg-select" value={uiPrefs.language} onChange={(e) => updateUi("language", e.target.value)}>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="stg-select-row">
              <label>Chế độ màu</label>
              <select className="stg-select" value={uiPrefs.theme} onChange={(e) => updateUi("theme", e.target.value)}>
                <option value="light">Sáng</option>
                <option value="dark">Tối</option>
                <option value="system">Theo hệ thống</option>
              </select>
            </div>

            <span className="stg-layout-title" style={{ marginTop: '20px' }}>Chủ đề màu</span>
            <div className="stg-color-themes">
              {UI_COLORS.map((colorObj) => (
                <div 
                  key={colorObj.id} 
                  className={`stg-color-dot ${uiPrefs.brandColor === colorObj.value ? "active" : ""}`} 
                  style={{ background: colorObj.value }}
                  onClick={() => updateColor(colorObj.value)}
                ></div>
              ))}
              <div className="stg-color-dot custom-picker" style={{ background: uiPrefs.brandColor }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                <input type="color" value={uiPrefs.brandColor} onChange={(e) => updateColor(e.target.value)} />
              </div>
            </div>

            <span className="stg-layout-title" style={{ marginTop: '24px' }}>Bố cục hiển thị</span>
            <div className="stg-layouts-list">
              {UI_LAYOUTS.map((layout) => (
                <div 
                  key={layout.id} 
                  className={`stg-layout-card ${uiPrefs.templateId === layout.id ? "active" : ""}`}
                  onClick={() => updateUi("templateId", layout.id)}
                >
                  <div className="stg-layout-mini-preview">
                    <div className={`lp-skeleton lp-${layout.id}`}>
                      <div className="lp-side"></div>
                      <div className="lp-body"><div className="lp-box"></div><div className="lp-box long"></div></div>
                    </div>
                  </div>
                  <div className="stg-layout-card-info">
                    <strong>{layout.name}</strong>
                    <span>{layout.description}</span>
                  </div>
                  {uiPrefs.templateId === layout.id && <div className="active-tick">✓</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
