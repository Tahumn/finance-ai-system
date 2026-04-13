import { getCategoryPrefs } from "./userPrefs.js";

const palette = [
  "#ff8b5f",
  "#38b6ff",
  "#ffd166",
  "#06d6a0",
  "#8e7dff",
  "#f4a261",
  "#e76f51",
  "#2a9d8f",
  "#c084fc",
  "#3b82f6"
];

export const colorFor = (label, email) => {
  if (!label) return palette[0];
  const prefs = getCategoryPrefs(email);
  const stored = prefs[label];
  if (stored?.color) return stored.color;
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseHexColor = (value) => {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw.startsWith("#")) return null;
  const hex = raw.slice(1);
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some((channel) => Number.isNaN(channel))) return null;
    return { r, g, b };
  }
  if (hex.length !== 6) return null;
  const num = Number.parseInt(hex, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const srgbToLinear = (channel) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = ({ r, g, b }) => {
  const rl = srgbToLinear(clamp(r, 0, 255));
  const gl = srgbToLinear(clamp(g, 0, 255));
  const bl = srgbToLinear(clamp(b, 0, 255));
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
};

export const onColor = (background, { dark = "#ffffff", light = "#171717", veryDark = "#ffe08a" } = {}) => {
  const rgb = parseHexColor(background);
  if (!rgb) return dark;
  const lum = relativeLuminance(rgb);
  if (lum < 0.06) return veryDark;
  return lum < 0.45 ? dark : light;
};
