import { useEffect, useRef, useState } from "react";
import { getUserPrefs, saveUserPrefs } from "../../utils/userPrefs.js";
import { applyUiPrefs, getUiPrefs, saveUiPrefs, UI_COLORS, UI_LAYOUTS } from "../../utils/uiPrefs.js";
import { t } from "../../utils/i18n.js";

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
  const [userPrefs, setUserPrefs] = useState(() => getUserPrefs(email));
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
    setUserPrefs(getUserPrefs(email));
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

  const updateUserPrefs = (patch) => {
    const next = { ...userPrefs, ...patch };
    setUserPrefs(next);
    saveUserPrefs(emailRef.current, next);
  };

  const now = new Date().toLocaleString();
  const activityLogs = [
    t("settings.logs.last_login", { time: now }),
    t("settings.logs.device"),
    t("settings.logs.audit")
  ];
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    user?.email ||
    t("user.default");
  const profileInitial = (displayName || "U").trim().charAt(0).toUpperCase();
  const normalizedBrandColor = (uiPrefs.brandColor || "").toLowerCase();
  const isPresetBrand = UI_COLORS.some(
    (item) => item.value.toLowerCase() === normalizedBrandColor
  );

  const handleChangePassword = (event) => {
    event.preventDefault();
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setNotice(t("settings.notice.password_short"));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice(t("settings.notice.password_mismatch"));
      return;
    }
    setNotice(t("settings.notice.password_changed"));
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleExport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      email,
      settings,
      budgets: safeParse(localStorage.getItem(`finance_local_budgets:${email}`), []),
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
        if (parsed.accounts) {
          localStorage.setItem(`finance_local_accounts:${email}`, JSON.stringify(parsed.accounts));
        }
        setNotice(t("settings.notice.import_ok"));
      } catch {
        setNotice(t("settings.notice.import_invalid"));
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="panel settings-panel">
      <div className="panel-header">
        <h3>{t("settings.title")}</h3>
      </div>

      <section className="settings-section profile-section">
        <h4>{t("settings.section.profile")}</h4>
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar">{profileInitial}</div>
            <div className="profile-main">
              <h5>{displayName}</h5>
              <p className="muted">{user?.email || "--"}</p>
              <div className="profile-badges">
                {user?.username && <span className="badge">{user.username}</span>}
                <span className="badge muted">{t("settings.profile.status", null, "Đang hoạt động")}</span>
              </div>
            </div>
          </div>
          <div className="profile-grid">
            <div className="profile-field">
              <span>{t("settings.label.email")}</span>
              <strong>{user?.email || "--"}</strong>
            </div>
            <div className="profile-field">
              <span>{t("settings.label.name")}</span>
              <strong>{[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "--"}</strong>
            </div>
            <div className="profile-field">
              <span>{t("settings.label.phone")}</span>
              <strong>{user?.phone || "--"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h4>{t("settings.section.security")}</h4>
        <form className="form" onSubmit={handleChangePassword}>
          <div className="row">
            <input
              type="password"
              placeholder={t("settings.label.current_password")}
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
              }
            />
            <input
              type="password"
              placeholder={t("settings.label.new_password")}
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
              }
            />
            <input
              type="password"
              placeholder={t("settings.label.confirm_password")}
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
            />
          </div>
          <div className="row-actions">
            <button className="primary" type="submit">
              {t("settings.action.change_password")}
            </button>
          </div>
        </form>
      </section>

      <section className="settings-section">
        <h4>{t("settings.section.sync")}</h4>
        <div className="switch-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.cloudSync}
              onChange={(event) =>
                setSettings((current) => ({ ...current, cloudSync: event.target.checked }))
              }
            />
            {t("settings.sync.cloud")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.thresholdAlerts}
              onChange={(event) =>
                setSettings((current) => ({ ...current, thresholdAlerts: event.target.checked }))
              }
            />
            {t("settings.sync.threshold")}
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>{t("settings.section.ui")}</h4>
        <div className="row">
          <label className="field">
            <span>{t("settings.ui.language")}</span>
            <select
              value={userPrefs.language}
              onChange={(event) => updateUserPrefs({ language: event.target.value })}
            >
              <option value="vi">{t("settings.ui.language_vi", null, "Tiếng Việt")}</option>
              <option value="en">{t("settings.ui.language_en", null, "English")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("settings.ui.theme")}</span>
            <select
              value={uiPrefs.theme}
              onChange={(event) =>
                setUiPrefs((current) => ({ ...current, theme: event.target.value }))
              }
            >
              <option value="light">{t("settings.ui.theme_light")}</option>
              <option value="dark">{t("settings.ui.theme_dark")}</option>
              <option value="system">{t("settings.ui.theme_system")}</option>
            </select>
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>{t("settings.ui.layout")}</span>
            <select
              value={uiPrefs.reportLayout}
              onChange={(event) =>
                setUiPrefs((current) => ({ ...current, reportLayout: event.target.value }))
              }
            >
              <option value="cards">{t("settings.ui.layout_cards")}</option>
              <option value="charts">{t("settings.ui.layout_charts")}</option>
              <option value="table">{t("settings.ui.layout_table")}</option>
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
          {t("settings.ui.compact")}
        </label>

        <p className="muted" style={{ margin: "12px 0 0" }}>
          {t("settings.ui.layout_style")}
        </p>
        <div className="layout-grid" style={{ marginTop: 12 }}>
          {UI_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              className={`layout-card ${uiPrefs.templateId === layout.id ? "active" : ""}`}
              onClick={() =>
                setUiPrefs((current) => ({
                  ...current,
                  templateId: layout.id
                }))
              }
            >
              <div className={`layout-preview layout-${layout.id}`}>
                <span />
                <span />
                <span />
              </div>
              <strong>{t(layout.labelKey, null, layout.name)}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {t(layout.descriptionKey, null, layout.description)}
              </p>
            </button>
          ))}
        </div>

        <p className="muted" style={{ margin: "16px 0 0" }}>
          {t("settings.ui.color")}
        </p>
        <div className="color-grid" style={{ marginTop: 12 }}>
          {UI_COLORS.map((color) => {
            const active = normalizedBrandColor === color.value.toLowerCase();
            return (
              <button
                key={color.id}
                type="button"
                className={`color-chip ${active ? "active" : ""}`}
                onClick={() =>
                  setUiPrefs((current) => ({ ...current, brandColor: color.value }))
                }
              >
                <span className="color-swatch" style={{ background: color.value }} />
                <span>{t(color.labelKey, null, color.label)}</span>
              </button>
            );
          })}
          <label className={`color-chip custom ${!isPresetBrand ? "active" : ""}`}>
            <span className="color-swatch" style={{ background: uiPrefs.brandColor }} />
            <span>{t("settings.color.custom", null, "Custom")}</span>
            <input
              type="color"
              value={uiPrefs.brandColor}
              onChange={(event) =>
                setUiPrefs((current) => ({ ...current, brandColor: event.target.value }))
              }
              aria-label={t("settings.color.custom", null, "Custom")}
            />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>{t("settings.section.notifications")}</h4>
        <div className="switch-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.pushNotifications}
              onChange={(event) => {
                const next = event.target.checked;
                if (next && typeof window !== "undefined" && "Notification" in window) {
                  if (Notification.permission === "default") {
                    Notification.requestPermission().catch(() => {});
                  }
                }
                setSettings((current) => ({ ...current, pushNotifications: next }));
              }}
            />
            {t("settings.notifications.push")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(event) =>
                setSettings((current) => ({ ...current, emailNotifications: event.target.checked }))
              }
            />
            {t("settings.notifications.email")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.thresholdAlerts}
              onChange={(event) =>
                setSettings((current) => ({ ...current, thresholdAlerts: event.target.checked }))
              }
            />
            {t("settings.notifications.threshold")}
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>{t("settings.section.ai")}</h4>
        <div className="switch-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.aiOptIn}
              onChange={(event) =>
                setSettings((current) => ({ ...current, aiOptIn: event.target.checked }))
              }
            />
            {t("settings.ai.opt_in")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.keepPromptLogs}
              onChange={(event) =>
                setSettings((current) => ({ ...current, keepPromptLogs: event.target.checked }))
              }
            />
            {t("settings.ai.keep_logs")}
          </label>
          <label>
            {t("settings.ai.cost")}
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
        <h4>{t("settings.section.export")}</h4>
        <div className="row-actions">
          <button className="ghost" type="button" onClick={handleExport}>
            {t("settings.export.export_json")}
          </button>
          <label className="ghost import-button">
            {t("settings.export.import_json")}
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4>{t("settings.section.logs")}</h4>
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
