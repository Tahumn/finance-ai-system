import { useMemo, useState, useEffect } from "react";
import {
  getDefaultTimezone,
  saveCategoryPrefs,
  saveUserPrefs,
  setOnboardingDone
} from "../../utils/userPrefs.js";
import { saveUiPrefs, UI_COLORS, UI_LAYOUTS } from "../../utils/uiPrefs.js";
import { t } from "../../utils/i18n.js";
import { createCategory, createTransaction, createAccount } from "../../api/finance.js";
import { formatNumberInput, parseNumberInput, currency } from "../../utils/format.js";

const DEFAULT_CATEGORIES = [
  { id: "food", name: "Ăn uống", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>, color: "#ff8b5f" },
  { id: "transport", name: "Di chuyển", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg>, color: "#38b6ff" },
  { id: "fun", name: "Giải trí", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="15.5" cy="10.5" r=".5" /><circle cx="17.5" cy="13.5" r=".5" /></svg>, color: "#ffd166" },
  { id: "saving", name: "Tiết kiệm", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2h0V5z" /><circle cx="7" cy="11" r="1" /></svg>, color: "#06d6a0" },
  { id: "bill", name: "Hóa đơn", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>, color: "#ff7b6b" },
  { id: "income", name: "Thu nhập", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>, color: "#8e7dff" }
];

const PROVIDERS = {
  bank: [
    "Vietcombank", "Techcombank", "BIDV", "Agribank", "Vietinbank",
    "MB Bank", "TPBank", "VPBank", "ACB", "OCB", "VIB"
  ],
  wallet: ["MoMo", "ZaloPay", "ShopeePay", "Viettel Money", "Moca"],
  credit: ["Visa", "Mastercard", "JCB", "American Express"]
};

export default function OnboardingScreen({ userEmail, currentUiPrefs, onComplete }) {
  const [step, setStep] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const totalSteps = 4;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Step 1: Account Setup
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("bank");
  const [accProvider, setAccProvider] = useState("");
  const [accLast4, setAccLast4] = useState("");
  const [accBalance, setAccBalance] = useState("");
  const [accLimit, setAccLimit] = useState("");

  // Step 2: Categories
  const [categories, setCategories] = useState(
    DEFAULT_CATEGORIES.map((item) => ({ ...item, enabled: true }))
  );
  const [activeIconPicker, setActiveIconPicker] = useState(null);

  // Step 3: Personalization
  const [language, setLanguage] = useState("vi");
  const [theme, setTheme] = useState("light");
  const [primaryColor, setPrimaryColor] = useState(UI_COLORS[0].value);
  const [layoutTemplate, setLayoutTemplate] = useState(UI_LAYOUTS[0].id);
  const [fontScale, setFontScale] = useState("medium");
  const [textColorMode, setTextColorMode] = useState("auto");
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Close dropdown on click outside
  useEffect(() => {
    const closeDropdown = () => {
      setActiveDropdown(null);
      setActiveIconPicker(null);
    };
    if (activeDropdown || activeIconPicker !== null) {
      window.addEventListener("click", closeDropdown);
    }
    return () => window.removeEventListener("click", closeDropdown);
  }, [activeDropdown, activeIconPicker]);

  const progressValue = (step / totalSteps) * 100;

  const handleNext = () => {
    setError("");
    if (step === 1) {
      if (!accName.trim()) {
        setError("Vui lòng nhập tên tài khoản hoặc thẻ.");
        return;
      }
      if (!accBalance) {
        setError("Vui lòng nhập số dư ban đầu.");
        return;
      }
    }
    if (step === 2) {
      if (categories.filter(c => c.enabled).length === 0) {
        setError("Vui lòng chọn ít nhất một danh mục để tiếp tục.");
        return;
      }
    }
    setStep((current) => Math.min(totalSteps, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  const handleFinish = async () => {
    setSaving(true);
    setError("");
    try {
      // 1. Create categories
      const enabledCats = categories.filter(c => c.enabled);
      await Promise.all(enabledCats.map(c => createCategory(c.name).catch(() => null)));

      const categoryPrefs = enabledCats.reduce((acc, item) => {
        acc[item.name] = { icon: item.icon, color: item.color };
        return acc;
      }, {});
      saveCategoryPrefs(userEmail, categoryPrefs);

      // 2. Create first account
      await createAccount({
        name: accName,
        type: accType,
        provider: accProvider,
        last4: accLast4,
        balance: parseNumberInput(accBalance),
        credit_limit: parseNumberInput(accLimit) || null,
        color: primaryColor === "custom" ? customPrimary : primaryColor
      });

      // 3. Save preferences
      saveUserPrefs(userEmail, {
        language,
        currency: "VND",
        timezone: getDefaultTimezone(),
        theme,
        primaryColor,
        fontScale,
        textColorMode
      });

      saveUiPrefs(userEmail, {
        ...(currentUiPrefs || {}),
        theme,
        brandColor: primaryColor,
        templateId: layoutTemplate
      });

      setOnboardingDone(userEmail, true);
      onComplete();
    } catch (err) {
      setError(err?.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="ob-shell">
      <div className="ob-container">
        <header className="ob-header">
          <div className="ob-header-top">
            <div className="ob-header-left">
              <span className="ob-eyebrow">THIẾT LẬP LẦN ĐẦU</span>
              <h1>Bước {step} / {totalSteps}</h1>
            </div>
            <div className="ob-header-right">
              <span className="ob-progress-fraction">{step}/{totalSteps}</span>
            </div>
          </div>

          <div className="ob-progress-container">
            <div className="ob-progress-track">
              <div className="ob-progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }}></div>
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`ob-progress-dot ${s <= step ? "active" : ""}`} style={{ left: `${((s - 1) / (totalSteps - 1)) * 100}%` }}></div>
              ))}
            </div>
          </div>

          <p className="ob-subtitle">
            {step === 1 && "Hoàn tất các thông tin cơ bản để khởi tạo tài khoản của bạn."}
            {step === 2 && "Chọn các danh mục bạn thường sử dụng. Bạn có thể thay đổi hoặc thêm mới sau này."}
            {step === 3 && "Tùy chỉnh ngôn ngữ và giao diện để phù hợp với thói quen sử dụng của bạn."}
            {step === 4 && "Vui lòng xem lại các thiết lập của bạn trước khi bắt đầu."}
          </p>
        </header>

        <div className="ob-content">
          {error && (
            <div className="ob-error-banner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span>{error}</span>
              <button className="close-error" onClick={() => setError("")}>×</button>
            </div>
          )}
          {step === 1 && (
            <div className="ob-step ob-step-1">
              <div className="ob-form-col">
                <div className="ob-section-title">
                  <div className="ob-icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
                  <div>
                    <h3>Tạo tài khoản / thẻ đầu tiên</h3>
                    <p>Lưu tài khoản hoặc thẻ đầu tiên của bạn và số dư mở đầu để bắt đầu quản lý tài chính.</p>
                  </div>
                </div>

                <div className="ob-field">
                  <label>Tên tài khoản / thẻ *</label>
                  <input type="text" value={accName} onChange={e => setAccName(e.target.value)} placeholder="Ví dụ: Tài khoản lương, Techcombank, Thẻ Visa..." />
                </div>

                <div className="ob-field">
                  <label>Loại *</label>
                  <div className="ob-type-group">
                    <button type="button" className={accType === "cash" ? "active" : ""} onClick={() => { setAccType("cash"); setAccProvider(""); }}>
                      <div className="type-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></svg>
                      </div>
                      <span>Tiền mặt</span>
                    </button>
                    <button type="button" className={accType === "bank" ? "active" : ""} onClick={() => { setAccType("bank"); setAccProvider(""); }}>
                      <div className="type-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" /></svg>
                      </div>
                      <span>Ngân hàng</span>
                    </button>
                    <button type="button" className={accType === "wallet" ? "active" : ""} onClick={() => { setAccType("wallet"); setAccProvider(""); }}>
                      <div className="type-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
                      </div>
                      <span>Ví điện tử</span>
                    </button>
                    <button type="button" className={accType === "credit" ? "active" : ""} onClick={() => { setAccType("credit"); setAccProvider(""); }}>
                      <div className="type-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                      </div>
                      <span>Thẻ tín dụng</span>
                    </button>
                  </div>
                </div>

                {accType !== "cash" && (
                  <div className="ob-field">
                    <label>Nhà cung cấp</label>
                    <select value={accProvider} onChange={e => setAccProvider(e.target.value)}>
                      <option value="">Chọn nhà cung cấp</option>
                      {(PROVIDERS[accType] || []).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                )}

                <div className="ob-row">
                  {accType !== "cash" && (
                    <div className="ob-field">
                      <label>4 số cuối (nếu có)</label>
                      <input type="text" value={accLast4} onChange={e => setAccLast4(e.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 1234" maxLength={4} />
                    </div>
                  )}
                  <div className="ob-field">
                    <label>Số dư ban đầu *</label>
                    <input type="text" value={accBalance} onChange={e => setAccBalance(formatNumberInput(e.target.value))} placeholder="Ví dụ: 1.000.000 đ" />
                  </div>
                </div>

                {accType !== "cash" && (
                  <div className="ob-field">
                    <label>Hạn mức (nếu có) <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg></label>
                    <input type="text" value={accLimit} onChange={e => setAccLimit(formatNumberInput(e.target.value))} placeholder="Ví dụ: 20.000.000 đ" />
                  </div>
                )}

                <div className="ob-preview-mini">
                  <p className="preview-label">Xem trước tài khoản</p>
                  <div className="acc-mini-card">
                    <div className="acc-mini-icon">
                      {accType === "cash" && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></svg>}
                      {accType === "bank" && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" /></svg>}
                      {accType === "wallet" && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>}
                      {accType === "credit" && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
                    </div>
                    <div className="acc-mini-main">
                      <strong>{accName || (accType === "cash" ? "Tiền mặt" : "Tài khoản mới")}</strong>
                      <span>{accProvider || "Số dư ban đầu"}</span>
                      <strong>{accBalance || "0"} đ</strong>
                    </div>
                    <div className="acc-mini-badge">Sẵn sàng</div>
                    <div className="acc-mini-more">•••</div>
                  </div>
                </div>

                <div className="ob-info-note">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                  <span>Số dư ban đầu sẽ được lưu cho tài khoản/thẻ này và được dùng khi tạo giao dịch.</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="ob-step ob-step-2">
              <div className="ob-cat-section">
                <div className="ob-cat-list">
                  {categories.map((cat, idx) => (
                    <div key={idx} className="ob-cat-card">
                      <label className="ob-check-wrap">
                        <input type="checkbox" checked={cat.enabled} onChange={e => {
                          const newCats = [...categories];
                          newCats[idx].enabled = e.target.checked;
                          setCategories(newCats);
                        }} />
                        <span className="checkmark"></span>
                      </label>
                      <div className="ob-cat-icon-box"
                        style={{ backgroundColor: `${cat.color}15`, color: cat.color, cursor: "pointer", position: "relative" }}
                        onClick={(e) => { e.stopPropagation(); setActiveIconPicker(activeIconPicker === idx ? null : idx); }}>
                        {cat.icon}

                        {activeIconPicker === idx && (
                          <div className="ob-icon-picker">
                            {[
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" /><polyline points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 2.6-2 3.5 0 1 1 1 1 1h17s1 0 1-1c0-.9-.5-2.24-2-3.5" /><path d="M15 14.5s-1.5 2-3 2-3-2-3-2V3c0-1 1-1 1-1h4s1 0 1 1v11.5z" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10v6M22 12a10 10 0 0 1-20 0 10 10 0 0 1 20 0z" /><path d="M12 2a10 10 0 0 1 0 20M2 12h20" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M6.7 6.7l10.6 10.6M6.7 17.3l10.6-10.6" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><rect x="14" y="11" width="8" height="2" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            ].map((icon, i) => (
                              <div key={i} className="ob-icon-option" onClick={(e) => {
                                e.stopPropagation();
                                const newCats = [...categories];
                                newCats[idx].icon = icon;
                                setCategories(newCats);
                                setActiveIconPicker(null);
                              }}>
                                {icon}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <input type="text" value={cat.name} onChange={e => {
                        const newCats = [...categories];
                        newCats[idx].name = e.target.value;
                        setCategories(newCats);
                      }} />
                      <div className="ob-cat-color-pick">
                        <div className="color-circle" style={{ backgroundColor: cat.color }}></div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                        <input type="color" value={cat.color} onChange={e => {
                          const newCats = [...categories];
                          newCats[idx].color = e.target.value;
                          setCategories(newCats);
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="ob-btn-add-cat" onClick={() => {
                  setCategories([...categories, {
                    name: "Danh mục mới",
                    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>,
                    color: "#64748b",
                    enabled: true
                  }]);
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
                  Thêm danh mục khác
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="ob-step ob-step-3">
              <div className="ob-section-title">
                <div className="ob-icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2v20M2 12h20" /></svg></div>
                <div>
                  <h3>Ngôn ngữ & Giao diện</h3>
                  <p>Tùy chỉnh ngôn ngữ và giao diện để phù hợp với thói quen sử dụng của bạn.</p>
                </div>
              </div>

              <div className="ob-settings-list">
                {/* Ngôn ngữ */}
                <div className={`ob-setting-item ${activeDropdown === "language" ? "open" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === "language" ? null : "language"); }}>
                  <div className="osi-left">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  </div>
                  <div className="osi-main">Ngôn ngữ</div>
                  <div className="osi-right">
                    <span>{language === "vi" ? "Tiếng Việt" : "English"}</span>
                    <svg className="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                  {activeDropdown === "language" && (
                    <div className="ob-dropdown-menu">
                      <div className={`ob-dropdown-option ${language === "vi" ? "active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setLanguage("vi"); setActiveDropdown(null); }}>
                        Tiếng Việt
                      </div>
                      <div className={`ob-dropdown-option ${language === "en" ? "active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setLanguage("en"); setActiveDropdown(null); }}>
                        English
                      </div>
                    </div>
                  )}
                </div>

                {/* Chế độ màu */}
                <div className={`ob-setting-item ${activeDropdown === "theme" ? "open" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === "theme" ? null : "theme"); }}>
                  <div className="osi-left">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                  </div>
                  <div className="osi-main">Chế độ màu</div>
                  <div className="osi-right">
                    <span>{theme === "light" ? "Sáng" : "Tối"}</span>
                    <svg className="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                  {activeDropdown === "theme" && (
                    <div className="ob-dropdown-menu">
                      <div className={`ob-dropdown-option ${theme === "light" ? "active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setTheme("light"); setActiveDropdown(null); }}>
                        Sáng (Light)
                      </div>
                      <div className={`ob-dropdown-option ${theme === "dark" ? "active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setTheme("dark"); setActiveDropdown(null); }}>
                        Tối (Dark)
                      </div>
                    </div>
                  )}
                </div>

                {/* Màu chủ đạo */}
                <div className="ob-setting-item" onClick={() => setActiveDropdown(null)}>
                  <div className="osi-left">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 11-8-8-7 7 1 1h3v10h10V11h3Z" /><path d="m5 8 7-7 7 7" /></svg>
                  </div>
                  <div className="osi-main">Màu chủ đạo</div>
                  <div className="osi-right">
                    <span>Tùy chỉnh</span>
                    <div className="color-dot" style={{ backgroundColor: primaryColor }}></div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                  <input type="color" className="ob-hidden-color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
                </div>

                {/* C cỡ chữ */}
                <div className={`ob-setting-item ${activeDropdown === "font" ? "open" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === "font" ? null : "font"); }}>
                  <div className="osi-left">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
                  </div>
                  <div className="osi-main">Cỡ chữ</div>
                  <div className="osi-right">
                    <span>{fontScale === "small" ? "Nhỏ" : fontScale === "large" ? "Lớn" : "Trung bình"}</span>
                    <svg className="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                  {activeDropdown === "font" && (
                    <div className="ob-dropdown-menu">
                      <div className={`ob-dropdown-option ${fontScale === "small" ? "active" : ""}`} onClick={() => setFontScale("small")}>Nhỏ</div>
                      <div className={`ob-dropdown-option ${fontScale === "medium" ? "active" : ""}`} onClick={() => setFontScale("medium")}>Trung bình</div>
                      <div className={`ob-dropdown-option ${fontScale === "large" ? "active" : ""}`} onClick={() => setFontScale("large")}>Lớn</div>
                    </div>
                  )}
                </div>

                <div className={`ob-setting-item ${activeDropdown === "text" ? "open" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === "text" ? null : "text"); }}>
                  <div className="osi-left">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 6.1H3" /><path d="M21 12.1H3" /><path d="M15.1 18.1H3" /></svg>
                  </div>
                  <div className="osi-main">Màu chữ</div>
                  <div className="osi-right">
                    <span>{textColorMode === "auto" ? "Tự động" : textColorMode === "dark" ? "Tối" : "Xám"}</span>
                    <svg className="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                  </div>
                  {activeDropdown === "text" && (
                    <div className="ob-dropdown-menu">
                      <div className={`ob-dropdown-option ${textColorMode === "auto" ? "active" : ""}`} onClick={() => setTextColorMode("auto")}>Tự động (Tối)</div>
                      <div className={`ob-dropdown-option ${textColorMode === "dark" ? "active" : ""}`} onClick={() => setTextColorMode("dark")}>Tối</div>
                      <div className={`ob-dropdown-option ${textColorMode === "gray" ? "active" : ""}`} onClick={() => setTextColorMode("gray")}>Xám</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="ob-preview-mobile">
                <p className="preview-label">Xem trước giao diện</p>
                <div className="mock-app">
                  <div className="mock-sidebar">
                    <div className="ms-item active" style={{ backgroundColor: primaryColor }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    </div>
                    <div className="ms-item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    </div>
                    <div className="ms-item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></svg>
                    </div>
                    <div className="ms-item">•••</div>
                  </div>
                  <div className="mock-main">
                    <div className="mock-header">
                      <div>
                        <strong>Tổng quan</strong>
                        <p>Tài chính cá nhân</p>
                      </div>
                      <div className="mock-user"></div>
                    </div>
                    <div className="mock-grid">
                      <div className="mock-card">
                        <small>Mục tiêu</small>
                        <div className="mock-goal-item">
                          <div className="mg-bar"><div className="mg-fill" style={{ width: '60%', backgroundColor: primaryColor }}></div></div>
                          <span style={{ fontSize: '10px' }}>60%</span>
                        </div>
                      </div>
                      <div className="mock-card">
                        <small>Báo cáo</small>
                        <div className="mock-chart">
                          <svg viewBox="0 0 200 60"><path d="M0 50 Q 50 20, 100 40 T 200 10" stroke={primaryColor} fill="none" strokeWidth="2" /></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="ob-step ob-step-4">
              <div className="ob-section-title">
                <div>
                  <h3>Xác nhận & Hoàn tất</h3>
                  <p>Vui lòng xem lại các thiết lập của bạn trước khi bắt đầu.</p>
                </div>
              </div>

              <div className="ob-confirm-list">
                <div className="ob-confirm-card">
                  <div className="occ-icon" style={{ backgroundColor: "#eff6ff" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                  </div>
                  <div className="occ-main">
                    <span>Tài khoản / thẻ đầu tiên</span>
                    <div className="occ-val">
                      {accType === "bank" && "Ngân hàng"}
                      {accType === "wallet" && "Ví điện tử"}
                      {accType === "credit" && "Thẻ tín dụng"}
                      {accType === "cash" && "Tiền mặt"}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                </div>

                <div className="ob-confirm-card">
                  <div className="occ-icon" style={{ backgroundColor: "#f0fdf4" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  </div>
                  <div className="occ-main">
                    <span>Số dư ban đầu</span>
                    <strong>{accBalance || "0"} đ</strong>
                  </div>
                </div>

                <div className="ob-confirm-card">
                  <div className="occ-icon" style={{ backgroundColor: "#fffbeb" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M3 3h18v18H3z" /><path d="M9 9h6v6H9z" /></svg>
                  </div>
                  <div className="occ-main">
                    <span>Số danh mục đã chọn</span>
                    <strong>{categories.filter(c => c.enabled).length} danh mục</strong>
                  </div>
                </div>

                <div className="ob-confirm-card">
                  <div className="occ-icon" style={{ backgroundColor: "#f5f3ff" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  </div>
                  <div className="occ-main">
                    <span>Ngôn ngữ</span>
                    <strong>{language === "vi" ? "Tiếng Việt" : "English"}</strong>
                  </div>
                </div>

                <div className="ob-confirm-card">
                  <div className="occ-icon" style={{ backgroundColor: "#eff6ff" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2v2M12 20v2M4.93 4.93 1.41 1.41M17.66 17.66 1.41 1.41M2 12h2M20 12h2M6.34 17.66-1.41 1.41M19.07 4.93-1.41 1.41" /></svg>
                  </div>
                  <div className="occ-main">
                    <span>Chế độ màu</span>
                    <strong>{theme === "light" ? "Sáng (Light)" : "Tối (Dark)"}</strong>
                  </div>
                </div>


              </div>

              <div className="ob-security-card">
                <div className="osc-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
                </div>
                <p>Finanzy cam kết bảo mật thông tin và an toàn dữ liệu của bạn.</p>
              </div>
            </div>
          )}
        </div>

        <footer className="ob-footer-actions">
          <button className="ob-btn-back" onClick={handleBack} disabled={step === 1 || saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Quay lại
          </button>
          {step < totalSteps ? (
            <button className="ob-btn-next" onClick={handleNext} style={{ backgroundColor: primaryColor }}>
              Tiếp tục <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          ) : (
            <button className="ob-btn-finish" onClick={handleFinish} disabled={saving} style={{ backgroundColor: primaryColor }}>
              {saving ? "Đang xử lý..." : "Bắt đầu sử dụng"} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
