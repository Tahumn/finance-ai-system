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
    setUiPrefs(next);
    saveUiPrefs(email, next);
    applyUiPrefs(next);
  };

  const exportData = () => {
    const data = {
      settings,
      budgets: safeParse(localStorage.getItem(`finance_local_budgets:${email}`), []),
      accounts: safeParse(localStorage.getItem(`finance_local_accounts:${email}`), []),
      ui: uiPrefs
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance_export_${email}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.settings) setSettings(parsed.settings);
        if (parsed.budgets) {
          localStorage.setItem(`finance_local_budgets:${email}`, JSON.stringify(parsed.budgets));
        }
        if (parsed.accounts) {
          localStorage.setItem(`finance_local_accounts:${email}`, JSON.stringify(parsed.accounts));
        }
        setNotice("Nhập dữ liệu thành công!");
        setTimeout(() => setNotice(""), 3000);
      } catch {
        setNotice("File không hợp lệ.");
        setTimeout(() => setNotice(""), 3000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="stg-container">
      <div className="stg-header-top">
        <h2 className="stg-header-title">Cài đặt</h2>
        <p className="stg-header-subtitle">Quản lý tài khoản, tùy chỉnh ứng dụng và bảo mật thông tin của bạn.</p>
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

      <div className="stg-grid">
        {/* Cột 1 */}
        <div className="stg-col">
          <div className="stg-card">
            <div className="stg-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
              <h4>Tài khoản</h4>
            </div>
            
            <div className="stg-list-item">
              <div className="stg-list-icon purple">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
              <div className="stg-list-info">
                <p>Gói hiện tại <span className="stg-list-badge">Pro</span></p>
                <span>Finanzy Pro</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>

            <div className="stg-list-item">
              <div className="stg-list-icon green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              </div>
              <div className="stg-list-info">
                <p>Đồng bộ dữ liệu</p>
                <span>Trạng thái đồng bộ theo dữ liệu hiện có của hệ thống</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>

            <div className="stg-list-item">
              <div className="stg-list-icon blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <div className="stg-list-info">
                <p>Ngôn ngữ</p>
                <span>{uiPrefs.language === 'en' ? 'English' : 'Tiếng Việt'}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>

            <div className="stg-list-item">
              <div className="stg-list-icon orange">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              </div>
              <div className="stg-list-info">
                <p>Chế độ</p>
                <span>{uiPrefs.theme === 'dark' ? 'Tối' : 'Sáng'}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </div>

          <div className="stg-card">
            <div className="stg-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <h4>Thông báo & Đồng bộ</h4>
            </div>

            <div className="stg-toggle-item">
              <div className="stg-toggle-info">
                <p>Thông báo đẩy (Push)</p>
                <span>Nhận thông báo trên trình duyệt</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={settings.pushNotifications} onChange={(e) => updateSetting("pushNotifications", e.target.checked)} />
            </div>
            
            <div className="stg-toggle-item">
              <div className="stg-toggle-info">
                <p>Báo cáo email hàng tuần</p>
                <span>Gửi báo cáo tài chính vào ngày Chủ nhật</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={settings.emailNotifications} onChange={(e) => updateSetting("emailNotifications", e.target.checked)} />
            </div>

            <div className="stg-toggle-item">
              <div className="stg-toggle-info">
                <p>Cảnh báo chi tiêu</p>
                <span>Thông báo khi vượt ngân sách hoặc bất thường</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={settings.thresholdAlerts} onChange={(e) => updateSetting("thresholdAlerts", e.target.checked)} />
            </div>
          </div>
        </div>

        {/* Cột 2 */}
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

          <div className="stg-card">
            <div className="stg-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <h4>AI & Privacy</h4>
            </div>

            <div className="stg-toggle-item">
              <div className="stg-toggle-info">
                <p>Gợi ý chi tiêu thông minh (AI)</p>
                <span>Phân tích & gợi ý tối ưu chi tiêu</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={settings.aiOptIn} onChange={(e) => updateSetting("aiOptIn", e.target.checked)} />
            </div>
            
            <div className="stg-toggle-item">
              <div className="stg-toggle-info">
                <p>Tự động phân loại giao dịch (AI)</p>
                <span>Phân loại giao dịch mới bằng AI</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={true} onChange={() => {}} />
            </div>

            <div className="stg-toggle-item">
              <div className="stg-toggle-info">
                <p>Ẩn danh dữ liệu khi gửi AI</p>
                <span>Không gửi thông tin cá nhân cho AI</span>
              </div>
              <input type="checkbox" className="stg-switch" checked={true} onChange={() => {}} />
            </div>

            <div className="stg-toggle-item" style={{ borderBottom: 'none' }}>
              <div className="stg-toggle-info">
                <p>Chi phí AI ước tính (tháng)</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', background: '#f8fafc', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '500' }}>{Number(settings.estimatedMonthlyCost || 0)} USD</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#94a3b8' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Cột 3 */}
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

            <div className="stg-select-row">
              <label>Bố cục báo cáo</label>
              <select className="stg-select" value={uiPrefs.layout} onChange={(e) => updateUi("layout", e.target.value)}>
                <option value="sidebar">Chuẩn (Đầy đủ)</option>
                <option value="grid">Dạng lưới</option>
                <option value="list">Danh sách</option>
              </select>
            </div>

            <span className="stg-layout-title">Xem trước bố cục</span>
            <div className="stg-layout-previews">
              <div className={`stg-layout-preview ${uiPrefs.layout === "sidebar" ? "active" : ""}`} onClick={() => updateUi("layout", "sidebar")}>
                <div className="stg-layout-wireframe sidebar-layout">
                  <div className="box"></div><div className="box"></div>
                </div>
              </div>
              <div className={`stg-layout-preview ${uiPrefs.layout === "grid" ? "active" : ""}`} onClick={() => updateUi("layout", "grid")}>
                <div className="stg-layout-wireframe grid-layout">
                  <div className="box"></div><div className="box"></div><div className="box"></div><div className="box"></div>
                </div>
              </div>
              <div className={`stg-layout-preview ${uiPrefs.layout === "list" ? "active" : ""}`} onClick={() => updateUi("layout", "list")}>
                <div className="stg-layout-wireframe list-layout">
                  <div className="box"></div><div className="box"></div>
                </div>
              </div>
            </div>

            <span className="stg-layout-title">Chủ đề màu</span>
            <div className="stg-color-themes">
              {Object.entries(UI_COLORS).map(([cKey, hex]) => (
                <div 
                  key={cKey} 
                  className={`stg-color-dot ${uiPrefs.color === cKey ? "active" : ""}`} 
                  style={{ background: hex }}
                  onClick={() => updateUi("color", cKey)}
                ></div>
              ))}
            </div>
          </div>

          <div className="stg-card">
            <div className="stg-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <h4>Xuất / Nhập dữ liệu</h4>
            </div>

            <div className="stg-export-row">
              <div className="stg-export-info">
                <p>Xuất dữ liệu</p>
                <span>Tải toàn bộ dữ liệu của bạn về máy</span>
              </div>
              <button className="stg-export-btn" onClick={exportData} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Xuất JSON
              </button>
            </div>

            <div className="stg-export-row" style={{ borderBottom: 'none', marginBottom: 0 }}>
              <div className="stg-export-info">
                <p>Nhập dữ liệu</p>
                <span>Khôi phục hoặc chuyển dữ liệu từ file JSON</span>
              </div>
              <button className="stg-export-btn" onClick={triggerImport} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Nhập JSON
              </button>
              <input type="file" style={{ display: "none" }} ref={fileInputRef} accept=".json" onChange={handleImport} />
            </div>

            <div className="stg-export-notice">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Dữ liệu của bạn luôn được mã hóa và chỉ bạn có thể truy cập.
            </div>
          </div>
        </div>
      </div>

      <div className="stg-card">
        <div className="stg-activity-header">
          <h4>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Nhật ký hoạt động
          </h4>
          <a href="#view-all">Xem tất cả</a>
        </div>
        <div className="stg-table-wrapper">
          <table className="stg-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hoạt động</th>
                <th>Thiết bị / Trình duyệt</th>
                <th>IP</th>
                <th>Vị trí</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.map((log, idx) => (
                <tr key={idx}>
                  <td>{log.time}</td>
                  <td style={{ fontWeight: 500 }}>{log.activity}</td>
                  <td>{log.device}</td>
                  <td>{log.ip}</td>
                  <td>{log.location}</td>
                  <td>
                    {log.status === 'Thành công' ? (
                      <span className="stg-status-ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> {log.status}</span>
                    ) : (
                      <span className="stg-status-fail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> {log.status}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!activityLogs.length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>
                    Chưa có nhật ký hoạt động từ backend.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
