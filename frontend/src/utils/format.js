import { getLocaleForLanguage, getUserPrefs } from "./userPrefs.js";

export const currency = (value) => {
  const prefs = getUserPrefs();
  const locale = getLocaleForLanguage(prefs.language);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: prefs.currency || "VND"
  }).format(value || 0);
};

export const formatDate = (value) => {
  const prefs = getUserPrefs();
  const locale = getLocaleForLanguage(prefs.language);
  try {
    return new Date(value).toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      timeZone: prefs.timezone || "UTC"
    });
  } catch {
    return new Date(value).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  }
};

export const formatDateFull = (value) => {
  const prefs = getUserPrefs();
  const locale = getLocaleForLanguage(prefs.language);
  try {
    return new Date(value).toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: prefs.timezone || "UTC"
    });
  } catch {
    return new Date(value).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  }
};

export const formatTime = (value) => {
  if (!value) return "";
  const raw = String(value);
  if (!/T\d{2}:\d{2}/.test(raw) && !/\d{2}:\d{2}/.test(raw)) return "";
  const prefs = getUserPrefs();
  const locale = getLocaleForLanguage(prefs.language);
  try {
    return new Date(value).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: prefs.timezone || "UTC"
    });
  } catch {
    return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
};

export const percent = (value) => `${Math.round(value * 100)}%`;

export const toInputDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const parseNumberParts = (value) => {
  const raw = String(value ?? "").trim();
  const sign = raw.startsWith("-") ? -1 : 1;
  const digits = raw.replace(/[^\d]/g, "");
  return { sign, digits };
};

export const parseNumberInput = (value) => {
  const { sign, digits } = parseNumberParts(value);
  if (!digits) return 0;
  return Number(digits) * sign;
};

export const formatNumberInput = (value) => {
  const { sign, digits } = parseNumberParts(value);
  if (!digits) return "";
  const prefs = getUserPrefs();
  const locale = getLocaleForLanguage(prefs.language);
  const numberValue = Number(digits) * sign;
  if (!Number.isFinite(numberValue)) return "";
  return new Intl.NumberFormat(locale).format(numberValue);
};
