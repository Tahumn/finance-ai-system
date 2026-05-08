import { useMemo, useState, useEffect } from "react";
import {
  getDefaultTimezone,
  saveCategoryPrefs,
  saveUserPrefs,
  setOnboardingDone
} from "../../utils/userPrefs.js";
import { saveUiPrefs } from "../../utils/uiPrefs.js";
import { STRINGS, t } from "../../utils/i18n.js";
import { createCategory, createTransaction, listCategories, createAccount } from "../../api/finance.js";
import { formatNumberInput, parseNumberInput, toInputDate, currency } from "../../utils/format.js";

const DEFAULT_CATEGORIES = [
  { id: "food", name: "Ăn uống", icon: "🍜", color: "#ff8b5f" },
  { id: "transport", name: "Di chuyển", icon: "🚗", color: "#38b6ff" },
  { id: "fun", name: "Giải trí", icon: "🎮", color: "#ffd166" },
  { id: "saving", name: "Tiết kiệm", icon: "💰", color: "#06d6a0" },
  { id: "bill", name: "Hóa đơn", icon: "📄", color: "#ff7b6b" },
  { id: "income", name: "Thu nhập", icon: "💼", color: "#8e7dff" }
];

const PRIMARY_COLORS = [
  { id: "blue", label: "Xanh dương", value: "#2563eb" },
  { id: "green", label: "Xanh lá", value: "#10b981" },
  { id: "purple", label: "Tím", value: "#7c3aed" },
  { id: "orange", label: "Cam", value: "#f59e0b" }
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

  // Step 3: Personalization
  const [language, setLanguage] = useState("vi");
  const [theme, setTheme] = useState("light");
  const [primaryColor, setPrimaryColor] = useState(PRIMARY_COLORS[0].value);
  const [customPrimary, setCustomPrimary] = useState("#2563eb");
  const [fontScale, setFontScale] = useState("medium");
  const [textColorMode, setTextColorMode] = useState("auto");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const progressValue = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step === 1 && (!accName || !accBalance)) return;
    setStep((current) => Math.min(totalSteps, current + 1));
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
        primaryColor: primaryColor === "custom" ? customPrimary : primaryColor,
        fontScale,
        textColorMode
      });

      saveUiPrefs(userEmail, {
        ...(currentUiPrefs || {}),
        theme,
        brandColor: primaryColor === "custom" ? customPrimary : primaryColor
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
          <div className="ob-header-left">
            <span className="ob-eyebrow">THIẾT LẬP LẦN ĐẦU</span>
            <h1>Bước {step} / {totalSteps}</h1>
          </div>
          <div className="ob-header-right">
            <span className="ob-progress-fraction">{step}/{totalSteps}</span>
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
          {step === 1 && (
            <div className="ob-step ob-step-1">
              <div className="ob-form-col">
                <div className="ob-section-title">
                  <div className="ob-icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
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
                    <button className={accType === "cash" ? "active" : ""} onClick={() => {setAccType("cash"); setAccProvider("");}}>
                       <div className="type-icon">💵</div>
                       <span>Tiền mặt</span>
                    </button>
                    <button className={accType === "bank" ? "active" : ""} onClick={() => {setAccType("bank"); setAccProvider("");}}>
                       <div className="type-icon">🏛️</div>
                       <span>Ngân hàng</span>
                    </button>
                    <button className={accType === "wallet" ? "active" : ""} onClick={() => {setAccType("wallet"); setAccProvider("");}}>
                       <div className="type-icon">📱</div>
                       <span>Ví điện tử</span>
                    </button>
                    <button className={accType === "credit" ? "active" : ""} onClick={() => {setAccType("credit"); setAccProvider("");}}>
                       <div className="type-icon">💳</div>
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
                    <label>Hạn mức (nếu có) <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></label>
                    <div className="input-wrap">
                      <input type="text" value={accLimit} onChange={e => setAccLimit(formatNumberInput(e.target.value))} placeholder="Ví dụ: 20.000.000 đ" />
                      <span className="unit">đ</span>
                    </div>
                  </div>
                )}

                <div className="ob-preview-mini">
                   <p className="preview-label">Xem trước</p>
                   <div className="acc-mini-card">
                      <div className="acc-mini-icon">🏛️</div>
                      <div className="acc-mini-main">
                         <strong>{accName || (accType === "cash" ? "Tiền mặt" : "Tài khoản mới")}</strong>
                         <span>Số dư ban đầu</span>
                         <strong>{accBalance || "0"} đ</strong>
                      </div>
                      <div className="acc-mini-badge">Mới</div>
                      <div className="acc-mini-more">...</div>
                   </div>
                </div>

                <div className="ob-info-note">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
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
                        <div className="ob-cat-icon-box" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                           {cat.icon}
                        </div>
                        <input type="text" value={cat.name} onChange={e => {
                           const newCats = [...categories];
                           newCats[idx].name = e.target.value;
                           setCategories(newCats);
                        }} />
                        <div className="ob-cat-color-pick">
                           <div className="color-circle" style={{ backgroundColor: cat.color }}></div>
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="ob-btn-add-cat">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                     Thêm danh mục khác
                  </button>
               </div>
            </div>
          )}

          {step === 3 && (
            <div className="ob-step ob-step-3">
              <div className="ob-section-title">
                  <div className="ob-icon-box"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg></div>
                  <div>
                    <h3>Ngôn ngữ & Giao diện</h3>
                    <p>Tùy chỉnh ngôn ngữ và giao diện để phù hợp với thói quen sử dụng của bạn.</p>
                  </div>
              </div>

              <div className="ob-settings-list">
                 <div className="ob-setting-item">
                    <div className="osi-left">🌐</div>
                    <div className="osi-main">Ngôn ngữ</div>
                    <div className="osi-right">
                       <span>{language === "vi" ? "Tiếng Việt" : "English"}</span>
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                 </div>
                 <div className="ob-setting-item">
                    <div className="osi-left">☀️</div>
                    <div className="osi-main">Chế độ màu</div>
                    <div className="osi-right">
                       <span>{theme === "light" ? "Sáng" : "Tối"}</span>
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                 </div>
                 <div className="ob-setting-item">
                    <div className="osi-left">🎨</div>
                    <div className="osi-main">Màu chủ đạo</div>
                    <div className="osi-right">
                       <span>Xanh dương</span>
                       <div className="color-dot" style={{ backgroundColor: primaryColor }}></div>
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                 </div>
                 <div className="ob-setting-item">
                    <div className="osi-left">Aa</div>
                    <div className="osi-main">Cỡ chữ</div>
                    <div className="osi-right">
                       <span>Trung bình</span>
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                 </div>
                 <div className="ob-setting-item">
                    <div className="osi-left">T</div>
                    <div className="osi-main">Màu chữ</div>
                    <div className="osi-right">
                       <span>Tối</span>
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                 </div>
              </div>

              <div className="ob-preview-mobile">
                 <p className="preview-label">Xem trước giao diện</p>
                 <div className="mock-app">
                    <div className="mock-sidebar">
                       <div className="ms-item active">🏠</div>
                       <div className="ms-item">🕒</div>
                       <div className="ms-item">👛</div>
                       <div className="ms-item">...</div>
                    </div>
                    <div className="mock-main">
                       <div className="mock-header">
                          <div>
                            <strong>Tổng quan</strong>
                            <p>Số dư tài khoản</p>
                          </div>
                          <select><option>Tháng này</option></select>
                       </div>
                       <div className="mock-balance">
                          <strong>120.500.000 đ</strong>
                          <span className="trend">↑ 12,5% <small>so với tuần trước</small></span>
                       </div>
                       <div className="mock-chart">
                          <svg viewBox="0 0 200 60"><path d="M0 50 Q 50 20, 100 40 T 200 10" stroke="#2563eb" fill="none" strokeWidth="2" /></svg>
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                     </div>
                     <div className="occ-main">
                        <span>Tài khoản / thẻ đầu tiên</span>
                        <div className="occ-val">
                           🏛️ Ngân hàng
                        </div>
                     </div>
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                  </div>

                  <div className="ob-confirm-card">
                     <div className="occ-icon" style={{ backgroundColor: "#f0fdf4" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                     </div>
                     <div className="occ-main">
                        <span>Số dư ban đầu</span>
                        <strong>{accBalance || "0"} đ</strong>
                     </div>
                  </div>

                  <div className="ob-confirm-card">
                     <div className="occ-icon" style={{ backgroundColor: "#fffbeb" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                     </div>
                     <div className="occ-main">
                        <span>Số danh mục đã chọn</span>
                        <strong>{categories.filter(c => c.enabled).length}</strong>
                     </div>
                  </div>

                  <div className="ob-confirm-card">
                     <div className="occ-icon" style={{ backgroundColor: "#f5f3ff" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                     </div>
                     <div className="occ-main">
                        <span>Ngôn ngữ</span>
                        <strong>{language === "vi" ? "Tiếng Việt" : "English"}</strong>
                     </div>
                  </div>

                  <div className="ob-confirm-card">
                     <div className="occ-icon" style={{ backgroundColor: "#eff6ff" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
                     </div>
                     <div className="occ-main">
                        <span>Chế độ màu</span>
                        <strong>{theme === "light" ? "Light" : "Dark"}</strong>
                     </div>
                  </div>

                  <div className="ob-confirm-card">
                     <div className="occ-icon" style={{ backgroundColor: "#fef2f2" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                     </div>
                     <div className="occ-main">
                        <span>Giao dịch import</span>
                        <strong>0</strong>
                     </div>
                  </div>
               </div>

               <div className="ob-security-card">
                  <div className="osc-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                  </div>
                  <p>Finanzy cam kết bảo mật thông tin và an toàn dữ liệu của bạn.</p>
               </div>
            </div>
          )}
        </div>

        <footer className="ob-footer-actions">
           <button className="ob-btn-back" onClick={handleBack} disabled={step === 1 || saving}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             Quay lại
           </button>
           {step < totalSteps ? (
             <button className="ob-btn-next" onClick={handleNext}>
               Tiếp tục <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
             </button>
           ) : (
             <button className="ob-btn-finish" onClick={handleFinish} disabled={saving}>
               {saving ? "Đang xử lý..." : "Bắt đầu sử dụng"} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
             </button>
           )}
        </footer>
      </div>
    </main>
  );
}
