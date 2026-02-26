import { useEffect, useMemo, useRef, useState } from "react";
import { applyUiPrefs, getUiPrefs, saveUiPrefs, UI_TEMPLATES } from "../../utils/uiPrefs.js";

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

export default function SettingsScreen({ user }) {
  const email = user?.email || "guest";
  const emailRef = useRef(email);
  const [settings, setSettings] = useState(defaultSettings);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [notice, setNotice] = useState("");
  const [uiPrefs, setUiPrefs] = useState(() => getUiPrefs(email));

  useEffect(() => {
    emailRef.current = email;
    setSettings(safeParse(localStorage.getItem(settingsKey(email)), defaultSettings));
  }, [email]);

  useEffect(() => {
    localStorage.setItem(settingsKey(email), JSON.stringify(settings));
  }, [settings, email]);

  useEffect(() => {
    setUiPrefs(getUiPrefs(email));
  }, [email]);

  useEffect(() => {
    saveUiPrefs(emailRef.current, uiPrefs);
    applyUiPrefs(uiPrefs);
  }, [uiPrefs]);

  const activityLogs = useMemo(() => {
    const now = new Date().toLocaleString();
    return [
      `Phiên đăng nhập gần nhất: ${now}`,
      "Thiết bị hiện tại: Web browser",
      "Bản ghi audit nâng cao: mock mode"
    ];
  }, []);

  const handleChangePassword = (event) => {
    event.preventDefault();
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setNotice("Mật khẩu mới cần tối thiểu 6 ký tự.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice("Mật khẩu xác nhận không khớp.");
      return;
    }
    setNotice("Đổi mật khẩu thành công (demo UI). Chưa gọi API backend.");
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleExport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      email,
      settings,
      budgets: safeParse(localStorage.getItem(`finance_local_budgets:${email}`), []),
      tags: safeParse(localStorage.getItem(`finance_local_tags:${email}`), []),
      accounts: safeParse(localStorage.getItem(`finance_local_accounts:${email}`), [])
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finance-export-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.settings) setSettings(parsed.settings);
        if (parsed.budgets) {
          localStorage.setItem(`finance_local_budgets:${email}`, JSON.stringify(parsed.budgets));
        }
        if (parsed.tags) {
          localStorage.setItem(`finance_local_tags:${email}`, JSON.stringify(parsed.tags));
        }
        if (parsed.accounts) {
          localStorage.setItem(`finance_local_accounts:${email}`, JSON.stringify(parsed.accounts));
        }
        setNotice("Import dữ liệu thành công.");
      } catch {
        setNotice("File import không hợp lệ.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="panel settings-panel">
      <div className="panel-header">
        <h3>Cài đặt & Hồ sơ</h3>
      </div>

      <section className="settings-section">
        <h4>Hồ sơ</h4>
        <div className="report-grid">
          <div className="report-card">
            <p>Email</p>
            <strong>{user?.email || "--"}</strong>
          </div>
          <div className="report-card">
            <p>Họ tên</p>
            <strong>{[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "--"}</strong>
          </div>
          <div className="report-card">
            <p>Số điện thoại</p>
            <strong>{user?.phone || "--"}</strong>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h4>Bảo mật</h4>
        <form className="form" onSubmit={handleChangePassword}>
          <div className="row">
            <input
              type="password"
              placeholder="Mật khẩu hiện tại"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
              }
            />
            <input
              type="password"
              placeholder="Mật khẩu mới"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
              }
            />
            <input
              type="password"
              placeholder="Xác nhận mật khẩu"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
            />
          </div>
          <div className="row-actions">
            <button className="primary" type="submit">
              Đổi mật khẩu
            </button>
          </div>
        </form>
      </section>

      <section className="settings-section">
        <h4>Đồng bộ đa nền tảng</h4>
        <div className="switch-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.cloudSync}
              onChange={(event) =>
                setSettings((current) => ({ ...current, cloudSync: event.target.checked }))
              }
            />
            Bật đồng bộ cloud
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.thresholdAlerts}
              onChange={(event) =>
                setSettings((current) => ({ ...current, thresholdAlerts: event.target.checked }))
              }
            />
            Cảnh báo vượt ngưỡng chi tiêu
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>Tùy chỉnh giao diện / báo cáo</h4>
        <div className="row">
          <label className="field">
            <span>Theme</span>
            <select
              value={uiPrefs.theme}
              onChange={(event) =>
                setUiPrefs((current) => ({ ...current, theme: event.target.value }))
              }
            >
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
              <option value="system">Theo hệ thống</option>
            </select>
          </label>
          <label className="field">
            <span>Layout báo cáo</span>
            <select
              value={uiPrefs.reportLayout}
              onChange={(event) =>
                setUiPrefs((current) => ({ ...current, reportLayout: event.target.value }))
              }
            >
              <option value="cards">Cards</option>
              <option value="charts">Charts</option>
              <option value="table">Table</option>
            </select>
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={uiPrefs.compactMode}
            onChange={(event) =>
              setUiPrefs((current) => ({ ...current, compactMode: event.target.checked }))
            }
          />
          Compact mode
        </label>

        <p className="muted" style={{ margin: "10px 0 0" }}>
          Templates dễ thương
        </p>
        <div className="template-grid" style={{ marginTop: 12 }}>
          {UI_TEMPLATES.map((template) => {
            const swatches = [
              template.colors.primary,
              template.colors.accent,
              template.colors.grad1,
              template.colors.grad2
            ];
            return (
              <button
                key={template.id}
                type="button"
                className={`template-card ${
                  uiPrefs.templateId === template.id ? "active" : ""
                }`}
                onClick={() =>
                  setUiPrefs((current) => ({
                    ...current,
                    templateId: template.id,
                    theme: template.theme
                  }))
                }
              >
                <strong>{template.name}</strong>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {template.description}
                </p>
                <div className="template-swatches">
                  {swatches.map((color) => (
                    <span
                      key={color}
                      className="template-swatch"
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <h4>Thông báo & Đồng bộ</h4>
        <div className="switch-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.pushNotifications}
              onChange={(event) =>
                setSettings((current) => ({ ...current, pushNotifications: event.target.checked }))
              }
            />
            Push notifications
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(event) =>
                setSettings((current) => ({ ...current, emailNotifications: event.target.checked }))
              }
            />
            Email notifications
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.thresholdAlerts}
              onChange={(event) =>
                setSettings((current) => ({ ...current, thresholdAlerts: event.target.checked }))
              }
            />
            Threshold alerts
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>AI & Privacy</h4>
        <div className="switch-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.aiOptIn}
              onChange={(event) =>
                setSettings((current) => ({ ...current, aiOptIn: event.target.checked }))
              }
            />
            Opt-in model usage
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.keepPromptLogs}
              onChange={(event) =>
                setSettings((current) => ({ ...current, keepPromptLogs: event.target.checked }))
              }
            />
            Lưu log truy vấn AI
          </label>
          <label>
            Estimated monthly AI cost (USD)
            <input
              type="number"
              min="0"
              step="0.5"
              value={settings.estimatedMonthlyCost}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  estimatedMonthlyCost: Number(event.target.value)
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>Export / Import</h4>
        <div className="row-actions">
          <button className="ghost" type="button" onClick={handleExport}>
            Export JSON
          </button>
          <label className="ghost import-button">
            Import JSON
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>Activity logs</h4>
        <div className="list">
          {activityLogs.map((line) => (
            <p key={line} className="empty">
              {line}
            </p>
          ))}
        </div>
      </section>

      {notice && <p className="form-note">{notice}</p>}
    </section>
  );
}
