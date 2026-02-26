import { useEffect, useMemo, useState } from "react";

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
  const [settings, setSettings] = useState(defaultSettings);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [notice, setNotice] = useState("");

  const email = user?.email || "guest";

  useEffect(() => {
    setSettings(safeParse(localStorage.getItem(settingsKey(email)), defaultSettings));
  }, [email]);

  useEffect(() => {
    localStorage.setItem(settingsKey(email), JSON.stringify(settings));
  }, [settings, email]);

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
        <span className="badge">UI local + read-only profile</span>
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
          <label>
            <input
              type="checkbox"
              checked={settings.cloudSync}
              onChange={(event) =>
                setSettings((current) => ({ ...current, cloudSync: event.target.checked }))
              }
            />
            Cloud sync
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
