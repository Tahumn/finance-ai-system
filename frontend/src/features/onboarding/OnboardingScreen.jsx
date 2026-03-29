import { useMemo, useState } from "react";
import {
  getDefaultTimezone,
  saveCategoryPrefs,
  saveUserPrefs,
  setOnboardingDone
} from "../../utils/userPrefs.js";
import { saveUiPrefs } from "../../utils/uiPrefs.js";
import { STRINGS, t } from "../../utils/i18n.js";
import { createCategory, createTransaction, listCategories } from "../../api/finance.js";
import { formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";

const DEFAULT_CATEGORIES = [
  { id: "food", name: { vi: "Ăn uống", en: "Food" }, icon: "🍜", color: "#ff8b5f" },
  { id: "transport", name: { vi: "Di chuyển", en: "Transport" }, icon: "🚗", color: "#38b6ff" },
  { id: "fun", name: { vi: "Giải trí", en: "Entertainment" }, icon: "🎮", color: "#ffd166" },
  { id: "saving", name: { vi: "Tiết kiệm", en: "Savings" }, icon: "💰", color: "#06d6a0" },
  { id: "income", name: { vi: "Thu nhập", en: "Income" }, icon: "💼", color: "#8e7dff" }
];

const CURRENCY_OPTIONS = ["VND", "USD", "EUR", "JPY", "KRW", "SGD", "GBP"];

const PRIMARY_COLORS = [
  { id: "blue", labels: { vi: "Xanh dương", en: "Blue" }, value: "#2e6bd1" },
  { id: "green", labels: { vi: "Xanh lá", en: "Green" }, value: "#2d7a5f" },
  { id: "purple", labels: { vi: "Tím", en: "Purple" }, value: "#6d5bd0" },
  { id: "orange", labels: { vi: "Cam", en: "Orange" }, value: "#d86a4b" }
];

const FONT_SIZES = [
  { id: "small", labels: { vi: "Nhỏ", en: "Small" } },
  { id: "medium", labels: { vi: "Vừa", en: "Medium" } },
  { id: "large", labels: { vi: "Lớn", en: "Large" } }
];

const THEMES = [
  { id: "light", labels: { vi: "Sáng (Light)", en: "Light" } },
  { id: "dark", labels: { vi: "Tối (Dark)", en: "Dark" } }
];

const LANGUAGE_OPTIONS = [
  { id: "vi", labels: { vi: "Tiếng Việt", en: "Vietnamese" } },
  { id: "en", labels: { vi: "English", en: "English" } }
];

const parseCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((value) => value.trim().replace(/^"|"$/g, ""));
};

const parseCsvText = (text) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
};

const mapCsvRows = (headers, rows) => {
  const index = (nameList) => headers.findIndex((header) => nameList.includes(header));
  const dateIndex = index(["date", "ngay", "ngay_giao_dich"]);
  const descIndex = index(["description", "desc", "mo_ta", "mota"]);
  const amountIndex = index(["amount", "so_tien", "money"]);
  const typeIndex = index(["type", "transaction_type", "loai"]);
  const categoryIndex = index(["category", "danh_muc"]);
  return rows.map((row) => ({
    date: row[dateIndex] || "",
    description: row[descIndex] || "",
    amount: row[amountIndex] || "",
    transaction_type: row[typeIndex] || "",
    category: row[categoryIndex] || ""
  }));
};

const hexToRgb = (hex) => {
  if (!hex) return null;
  const value = hex.replace("#", "");
  if (value.length !== 6) return null;
  const number = parseInt(value, 16);
  if (Number.isNaN(number)) return null;
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255
  };
};

const relativeLuminance = ({ r, g, b }) => {
  const convert = (val) => {
    const channel = val / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
};

const contrastRatio = (fg, bg) => {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  if (!fgRgb || !bgRgb) return 0;
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const buildLocalT = (language) => (key, vars, fallback) => {
  const base = STRINGS[language] || STRINGS.vi;
  const text = base[key] || STRINGS.vi[key] || fallback || key;
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (acc, [field, value]) => acc.replace(new RegExp(`{${field}}`, "g"), String(value)),
    text
  );
};

export default function OnboardingScreen({ userEmail, currentUiPrefs, onComplete }) {
  const [step, setStep] = useState(1);
  const [balance, setBalance] = useState("");
  const [currencyCode, setCurrencyCode] = useState("VND");
  const [timezone, setTimezone] = useState(getDefaultTimezone());
  const [categories, setCategories] = useState(
    DEFAULT_CATEGORIES.map((item) => ({
      id: item.id,
      enabled: true,
      name: item.name.vi,
      icon: item.icon,
      color: item.color
    }))
  );
  const [language, setLanguage] = useState("vi");
  const [previousLanguage, setPreviousLanguage] = useState("vi");
  const [theme, setTheme] = useState("light");
  const [primaryColor, setPrimaryColor] = useState(PRIMARY_COLORS[0].value);
  const [customPrimary, setCustomPrimary] = useState("#2e6bd1");
  const [fontScale, setFontScale] = useState("medium");
  const [textColorMode, setTextColorMode] = useState("auto");
  const [textColor, setTextColor] = useState("#171717");
  const [importRows, setImportRows] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importSkipped, setImportSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = 5;
  const tLocal = useMemo(() => buildLocalT(language), [language]);
  const formatLocalCurrency = useMemo(
    () => (value) =>
      new Intl.NumberFormat(language === "en" ? "en-US" : "vi-VN", {
        style: "currency",
        currency: currencyCode
      }).format(value || 0),
    [language, currencyCode]
  );

  const timezoneOptions = useMemo(() => {
    if (typeof Intl !== "undefined" && Intl.supportedValuesOf) {
      return Intl.supportedValuesOf("timeZone");
    }
    return ["Asia/Ho_Chi_Minh", "UTC", "Asia/Singapore", "America/New_York", "Europe/London"];
  }, []);

  const selectedCategories = useMemo(
    () => categories.filter((item) => item.enabled && item.name.trim()),
    [categories]
  );

  const themeBackground = theme === "dark" ? "#151922" : "#ffffff";
  const autoTextColor = theme === "dark" ? "#f1f2f4" : "#171717";
  const previewTextColor = textColorMode === "custom" ? textColor : autoTextColor;
  const previewContrast = contrastRatio(previewTextColor, themeBackground);
  const contrastOk = textColorMode !== "custom" || previewContrast >= 4.5;

  const balanceValid = balance !== "" && !Number.isNaN(parseNumberInput(balance));
  const stepValid = [
    balanceValid && currencyCode && timezone,
    selectedCategories.length > 0,
    contrastOk,
    true,
    true
  ];

  const progressValue = (step / totalSteps) * 100;

  const handleCategoryChange = (id, field, value) => {
    setCategories((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleCsvUpload = async (file) => {
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCsvText(text);
    const mapped = mapCsvRows(headers, rows);
    setImportRows(mapped);
    setCsvPreview(mapped.slice(0, 5));
    setImportSkipped(false);
  };

  const handleNext = () => {
    if (!stepValid[step - 1]) return;
    setStep((current) => Math.min(totalSteps, current + 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  const handleFinish = async () => {
    setSaving(true);
    setError("");
    try {
      const cleanedCategories = selectedCategories.map((item) => ({
        ...item,
        name: item.name.trim()
      }));
      const created = await Promise.all(
        cleanedCategories.map((item) => createCategory(item.name))
      );
      let nameToId = {};
      created.forEach((item, index) => {
        if (item?.id) {
          nameToId[cleanedCategories[index].name.toLowerCase()] = item.id;
        }
      });
      if (!Object.keys(nameToId).length) {
        const fetched = await listCategories();
        nameToId = fetched.reduce((acc, item) => {
          acc[item.name.toLowerCase()] = item.id;
          return acc;
        }, {});
      }
      const categoryPrefs = cleanedCategories.reduce((acc, item) => {
        acc[item.name] = { icon: item.icon, color: item.color };
        return acc;
      }, {});
      saveCategoryPrefs(userEmail, categoryPrefs);

      const startingBalance = parseNumberInput(balance);
      if (!Number.isNaN(startingBalance) && startingBalance !== 0) {
        await createTransaction({
          description: "Initial Balance",
          amount: Math.abs(startingBalance),
          transaction_type: startingBalance >= 0 ? "income" : "expense",
          category_id: null,
          date: toInputDate(new Date())
        });
      }

      if (!importSkipped && importRows.length) {
        const sanitized = importRows
          .map((row) => {
            const rawAmount = String(row.amount || "0").replace(/,/g, "");
            const parsedAmount = Number(rawAmount);
            const rawType = String(row.transaction_type || "").toLowerCase();
            const normalizedType =
              rawType === "income" || rawType === "expense" ? rawType : "expense";
            return {
              description: row.description || "Imported",
              amount: parsedAmount,
              transaction_type: normalizedType,
              category_id: row.category
                ? nameToId[row.category.toLowerCase()] || null
                : null,
              date: row.date || toInputDate(new Date())
            };
          })
          .filter((row) => row.amount && row.description);
        for (const payload of sanitized) {
          await createTransaction(payload);
        }
      }

      saveUserPrefs(userEmail, {
        language,
        currency: currencyCode,
        timezone,
        theme,
        primaryColor: primaryColor === "custom" ? customPrimary : primaryColor,
        fontScale,
        textColorMode,
        textColor: textColorMode === "custom" ? textColor : ""
      });

      saveUiPrefs(userEmail, {
        ...(currentUiPrefs || {}),
        theme,
        brandColor: primaryColor === "custom" ? customPrimary : primaryColor
      });

      setOnboardingDone(userEmail, true);
      onComplete();
    } catch (err) {
      setError(err?.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <header className="onboarding-header">
          <div>
            <p className="eyebrow">{tLocal("onboarding.title")}</p>
            <h1>{tLocal("onboarding.step", { current: step, total: totalSteps })}</h1>
          </div>
          <div className="onboarding-progress">
            <div className="progress-bar">
              <span style={{ width: `${progressValue}%` }} />
            </div>
            <span className="progress-text">
              {step}/{totalSteps}
            </span>
          </div>
        </header>

        {step === 1 && (
          <div className="onboarding-step">
            <h2>{tLocal("onboarding.step1.title")}</h2>
            <div className="grid two">
              <div className="field">
                <label>{tLocal("onboarding.step1.balance")}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={balance}
                  onChange={(event) => setBalance(formatNumberInput(event.target.value))}
                  placeholder="0"
                  required
                />
              </div>
              <div className="field">
                <label>{tLocal("onboarding.step1.currency")}</label>
                <select value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value)}>
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{tLocal("onboarding.step1.timezone")}</label>
                <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {timezoneOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="muted">{tLocal("onboarding.step1.note")}</p>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <h2>{tLocal("onboarding.step2.title")}</h2>
            <p className="muted">{tLocal("onboarding.step2.helper")}</p>
            <div className="category-setup">
              {categories.map((item) => (
                <div key={item.id} className="category-item">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => handleCategoryChange(item.id, "enabled", event.target.checked)}
                    />
                    <span />
                  </label>
                  <div className="field">
                    <label>{tLocal("onboarding.step2.name")}</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) => handleCategoryChange(item.id, "name", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>{tLocal("onboarding.step2.icon")}</label>
                    <input
                      type="text"
                      value={item.icon}
                      onChange={(event) => handleCategoryChange(item.id, "icon", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>{tLocal("onboarding.step2.color")}</label>
                    <div className="color-input">
                      <span className="color-swatch" style={{ background: item.color }} />
                      <input
                        type="color"
                        value={item.color}
                        onChange={(event) => handleCategoryChange(item.id, "color", event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <h2>{tLocal("onboarding.step3.title")}</h2>
            <div className="grid two">
              <div className="field">
                <label>{tLocal("onboarding.step3.language")}</label>
                <div className="chip-group">
                  {LANGUAGE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={language === item.id ? "chip active" : "chip"}
                      onClick={() => {
                        const nextLang = item.id;
                        setCategories((current) =>
                          current.map((cat) => {
                            const defaults = DEFAULT_CATEGORIES.find((d) => d.id === cat.id)?.name;
                            if (!defaults) return cat;
                            const prevDefault = defaults[previousLanguage];
                            const nextDefault = defaults[nextLang];
                            if (cat.name === prevDefault) {
                              return { ...cat, name: nextDefault };
                            }
                            return cat;
                          })
                        );
                        setPreviousLanguage(nextLang);
                        setLanguage(nextLang);
                      }}
                    >
                      {item.labels[language] || item.labels.vi}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{tLocal("onboarding.step3.theme")}</label>
                <div className="chip-group">
                  {THEMES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={theme === item.id ? "chip active" : "chip"}
                      onClick={() => setTheme(item.id)}
                    >
                      {item.labels[language] || item.labels.vi}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{tLocal("onboarding.step3.primary")}</label>
                <div className="chip-group">
                  {PRIMARY_COLORS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={primaryColor === item.value ? "chip active" : "chip"}
                      onClick={() => setPrimaryColor(item.value)}
                    >
                      <span className="dot" style={{ background: item.value }} />
                      {item.labels[language] || item.labels.vi}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={primaryColor === "custom" ? "chip active" : "chip"}
                    onClick={() => setPrimaryColor("custom")}
                  >
                    Custom
                  </button>
                </div>
                {primaryColor === "custom" && (
                  <div className="color-input">
                    <span className="color-swatch" style={{ background: customPrimary }} />
                    <input
                      type="color"
                      value={customPrimary}
                      onChange={(event) => setCustomPrimary(event.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="field">
                <label>{tLocal("onboarding.step3.font")}</label>
                <div className="chip-group">
                  {FONT_SIZES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={fontScale === item.id ? "chip active" : "chip"}
                      onClick={() => setFontScale(item.id)}
                    >
                      {item.labels[language] || item.labels.vi}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{tLocal("onboarding.step3.text_color")}</label>
                <div className="chip-group">
                  <button
                    type="button"
                    className={textColorMode === "auto" ? "chip active" : "chip"}
                    onClick={() => setTextColorMode("auto")}
                  >
                    {tLocal("onboarding.step3.auto")}
                  </button>
                  <button
                    type="button"
                    className={textColorMode === "custom" ? "chip active" : "chip"}
                    onClick={() => setTextColorMode("custom")}
                  >
                    {tLocal("onboarding.step3.custom")}
                  </button>
                </div>
                {textColorMode === "custom" && (
                  <div className="color-input">
                    <span className="color-swatch" style={{ background: textColor }} />
                    <input
                      type="color"
                      value={textColor}
                      onChange={(event) => setTextColor(event.target.value)}
                    />
                  </div>
                )}
                {!contrastOk && <p className="form-error">{tLocal("onboarding.step3.contrast_bad")}</p>}
              </div>
            </div>

            <div className="preview-card" style={{ background: themeBackground, color: previewTextColor }}>
              <div className="preview-header">
                <span className="badge">{tLocal("onboarding.step3.preview")}</span>
                <button
                  type="button"
                  className="preview-button"
                  style={{
                    background:
                      primaryColor === "custom" ? customPrimary : primaryColor,
                    color: "#fff"
                  }}
                >
                  {tLocal("dashboard.add_tx")}
                </button>
              </div>
              <h3>{tLocal("dashboard.overview")}</h3>
              <p className="muted">{tLocal("dashboard.balance")}</p>
              <strong>{formatLocalCurrency(2500000)}</strong>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-step">
            <h2>{tLocal("onboarding.step4.title")}</h2>
            <div className="row">
              <input
                type="file"
                accept=".csv"
                onChange={(event) => handleCsvUpload(event.target.files?.[0])}
              />
              <button className="ghost" type="button" onClick={() => setImportSkipped(true)}>
                {tLocal("onboarding.step4.skip")}
              </button>
            </div>
            {!importSkipped && !!csvPreview.length && (
              <div className="preview-table">
                <div className="preview-head">{tLocal("onboarding.step4.preview")}</div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, index) => (
                      <tr key={`row-${index}`}>
                        <td>{row.date}</td>
                        <td>{row.description}</td>
                        <td>{row.amount}</td>
                        <td>{row.transaction_type}</td>
                        <td>{row.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="onboarding-step">
            <h2>{tLocal("onboarding.step5.title")}</h2>
            <div className="summary-grid">
              <div className="summary-item">
                <p>{tLocal("onboarding.step5.balance")}</p>
                <strong>{formatLocalCurrency(parseNumberInput(balance || 0))}</strong>
              </div>
              <div className="summary-item">
                <p>{tLocal("onboarding.step5.categories")}</p>
                <strong>{selectedCategories.length}</strong>
              </div>
              <div className="summary-item">
                <p>{tLocal("onboarding.step5.language")}</p>
                <strong>
                  {LANGUAGE_OPTIONS.find((item) => item.id === language)?.labels[language] ||
                    LANGUAGE_OPTIONS[0].labels[language]}
                </strong>
              </div>
              <div className="summary-item">
                <p>{tLocal("onboarding.step5.theme")}</p>
                <strong>{theme}</strong>
              </div>
              <div className="summary-item">
                <p>{tLocal("onboarding.step5.currency")}</p>
                <strong>{currencyCode}</strong>
              </div>
              <div className="summary-item">
                <p>{tLocal("onboarding.step5.timezone")}</p>
                <strong>{timezone}</strong>
              </div>
              <div className="summary-item">
                <p>{tLocal("onboarding.step5.import")}</p>
                <strong>{importSkipped ? 0 : importRows.length}</strong>
              </div>
            </div>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="wizard-actions">
          <button className="ghost" type="button" onClick={handleBack} disabled={step === 1 || saving}>
            {tLocal("common.prev")}
          </button>
          {step < totalSteps ? (
            <button
              className="primary"
              type="button"
              onClick={handleNext}
              disabled={!stepValid[step - 1] || saving}
            >
              {tLocal("common.next")}
            </button>
          ) : (
            <button className="primary" type="button" onClick={handleFinish} disabled={saving}>
              {saving ? tLocal("common.loading") : tLocal("common.finish")}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
