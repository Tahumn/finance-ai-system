const DEFAULT_USER_PREFS = {
  language: "vi",
  currency: "VND",
  timezone: "Asia/Ho_Chi_Minh",
  theme: "light",
  primaryColor: "#1565c0",
  fontScale: "medium",
  textColorMode: "auto",
  textColor: ""
};

const ACTIVE_USER_KEY = "finance_active_user";

const prefsKey = (email) => `finance_user_prefs:${email || "guest"}`;
const onboardingKey = (email) => `finance_onboarding_done:${email || "guest"}`;
const categoryPrefsKey = (email) => `finance_category_prefs:${email || "guest"}`;

const normalizeLanguage = (value) => (value === "en" ? "en" : "vi");
const normalizeCurrency = (value) => (typeof value === "string" && value ? value : "VND");
const normalizeTimezone = (value) =>
  typeof value === "string" && value ? value : DEFAULT_USER_PREFS.timezone;
const normalizeTheme = (value) => (value === "dark" ? "dark" : "light");
const normalizeFontScale = (value) => {
  if (value === "small" || value === "large") return value;
  return "medium";
};
const normalizeTextColorMode = (value) => (value === "custom" ? "custom" : "auto");

const normalizePrefs = (prefs = {}) => ({
  language: normalizeLanguage(prefs.language),
  currency: normalizeCurrency(prefs.currency),
  timezone: normalizeTimezone(prefs.timezone),
  theme: normalizeTheme(prefs.theme),
  primaryColor: typeof prefs.primaryColor === "string" ? prefs.primaryColor : DEFAULT_USER_PREFS.primaryColor,
  fontScale: normalizeFontScale(prefs.fontScale),
  textColorMode: normalizeTextColorMode(prefs.textColorMode),
  textColor: typeof prefs.textColor === "string" ? prefs.textColor : ""
});

const safeStorageGet = (key) => {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const safeStorageRemove = (key) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const getActiveUserEmail = () => safeStorageGet(ACTIVE_USER_KEY) || "guest";

export const setActiveUserEmail = (email) => {
  safeStorageSet(ACTIVE_USER_KEY, email || "guest");
};

export const getUserPrefs = (email) => {
  const target = email || getActiveUserEmail();
  const raw = safeStorageGet(prefsKey(target));
  if (!raw) return DEFAULT_USER_PREFS;
  try {
    return normalizePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_USER_PREFS;
  }
};

export const saveUserPrefs = (email, prefs) => {
  const target = email || getActiveUserEmail();
  const normalized = normalizePrefs(prefs);
  safeStorageSet(prefsKey(target), JSON.stringify(normalized));
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("finance:user-prefs", {
        detail: { email: target, prefs: normalized }
      })
    );
  }
};

export const isOnboardingDone = (email) => safeStorageGet(onboardingKey(email)) === "1";

export const setOnboardingDone = (email, done = true) => {
  safeStorageSet(onboardingKey(email), done ? "1" : "0");
};

export const clearOnboardingDone = (email) => {
  safeStorageRemove(onboardingKey(email));
};

export const getCategoryPrefs = (email) => {
  const target = email || getActiveUserEmail();
  const raw = safeStorageGet(categoryPrefsKey(target));
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
};

export const saveCategoryPrefs = (email, prefs) => {
  const target = email || getActiveUserEmail();
  safeStorageSet(categoryPrefsKey(target), JSON.stringify(prefs || {}));
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string") return null;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;
  const value = parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const toHex = (value) => value.toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const adjustColor = (hex, amount) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex({
    r: clamp(Math.round(rgb.r + amount), 0, 255),
    g: clamp(Math.round(rgb.g + amount), 0, 255),
    b: clamp(Math.round(rgb.b + amount), 0, 255)
  });
};

export const applyUserPrefs = (prefs) => {
  if (typeof document === "undefined") return;
  const normalized = normalizePrefs(prefs);
  const root = document.documentElement;
  root.dataset.lang = normalized.language;
  root.lang = normalized.language === "en" ? "en" : "vi";
  root.style.setProperty("--font-scale", normalized.fontScale === "small" ? "0.92" : normalized.fontScale === "large" ? "1.08" : "1");
};

export const getLocaleForLanguage = (language) => (language === "en" ? "en-US" : "vi-VN");

export const getDefaultTimezone = () => {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  }
  return DEFAULT_USER_PREFS.timezone;
};

export { DEFAULT_USER_PREFS };
