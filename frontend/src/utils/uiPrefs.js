const DEFAULT_UI_PREFS = {
  theme: "light",
  compactMode: false,
  reportLayout: "cards",
  templateId: "classic",
  brandColor: "#2e6bd1"
};

const UI_LAYOUTS = [
  {
    id: "classic",
    labelKey: "settings.layout.classic",
    descriptionKey: "settings.layout.classic_desc",
    name: "Classic Stack",
    description: "Cân bằng, dễ đọc",
    values: {
      shellMax: "1180px",
      shellMaxNarrow: "940px",
      panelRadius: "22px",
      cardRadius: "18px",
      panelPadding: "18px",
      gridGap: "18px",
      panelShadow: "0 14px 30px rgba(16, 24, 40, 0.08)"
    }
  },
  {
    id: "airy",
    labelKey: "settings.layout.airy",
    descriptionKey: "settings.layout.airy_desc",
    name: "Airy Space",
    description: "Rộng rãi, thoáng mắt",
    values: {
      shellMax: "1240px",
      shellMaxNarrow: "980px",
      panelRadius: "26px",
      cardRadius: "20px",
      panelPadding: "22px",
      gridGap: "22px",
      panelShadow: "0 18px 36px rgba(16, 24, 40, 0.12)"
    }
  },
  {
    id: "compact",
    labelKey: "settings.layout.compact",
    descriptionKey: "settings.layout.compact_desc",
    name: "Compact Focus",
    description: "Gọn gàng, tiết kiệm diện tích",
    values: {
      shellMax: "1120px",
      shellMaxNarrow: "880px",
      panelRadius: "16px",
      cardRadius: "14px",
      panelPadding: "14px",
      gridGap: "12px",
      panelShadow: "0 10px 22px rgba(16, 24, 40, 0.08)"
    }
  },
  {
    id: "editorial",
    labelKey: "settings.layout.editorial",
    descriptionKey: "settings.layout.editorial_desc",
    name: "Editorial",
    description: "Nhấn mạnh số liệu",
    values: {
      shellMax: "1200px",
      shellMaxNarrow: "960px",
      panelRadius: "24px",
      cardRadius: "16px",
      panelPadding: "20px",
      gridGap: "16px",
      panelShadow: "0 16px 32px rgba(16, 24, 40, 0.1)"
    }
  }
];

const UI_COLORS = [
  { id: "blue", labelKey: "settings.color.blue", label: "Ocean Blue", value: "#2e6bd1" },
  { id: "teal", labelKey: "settings.color.teal", label: "Teal Green", value: "#2d7a5f" },
  { id: "amber", labelKey: "settings.color.amber", label: "Warm Amber", value: "#d86a4b" },
  { id: "violet", labelKey: "settings.color.violet", label: "Violet", value: "#6d5bd0" },
  { id: "rose", labelKey: "settings.color.rose", label: "Rose", value: "#d34f6a" }
];

const LEGACY_TEMPLATE_COLORS = {
  classic: "#1565c0",
  mint: "#2d7a5f",
  peach: "#d86a4b",
  sky: "#2e6bd1",
  midnight: "#4f8cff"
};

const layoutMap = UI_LAYOUTS.reduce((acc, layout) => {
  acc[layout.id] = layout;
  return acc;
}, {});

const prefsKey = (email) => `finance_ui_prefs:${email || "guest"}`;

const normalizeTheme = (theme) => {
  if (theme === "dark" || theme === "system") return theme;
  return "light";
};

const normalizeLayout = (layout) => {
  if (layout === "charts" || layout === "table") return layout;
  return "cards";
};

const normalizeColor = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return normalized;
};

const normalizePrefs = (prefs = {}) => {
  const merged = { ...DEFAULT_UI_PREFS, ...prefs };
  const legacyColor = LEGACY_TEMPLATE_COLORS[merged.templateId];
  const templateId = layoutMap[merged.templateId] ? merged.templateId : DEFAULT_UI_PREFS.templateId;
  const brandColor =
    normalizeColor(merged.brandColor) ||
    normalizeColor(legacyColor) ||
    DEFAULT_UI_PREFS.brandColor;
  return {
    theme: normalizeTheme(merged.theme),
    compactMode: Boolean(merged.compactMode),
    reportLayout: normalizeLayout(merged.reportLayout),
    templateId,
    brandColor
  };
};

const resolveTheme = (theme) => {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return theme === "dark" ? "dark" : "light";
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

const luminance = ({ r, g, b }) => {
  const convert = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
};

const readableTextColor = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  return luminance(rgb) > 0.6 ? "#0b0f14" : "#ffffff";
};

const getUiPrefs = (email) => {
  if (typeof localStorage === "undefined") return DEFAULT_UI_PREFS;
  try {
    const raw = localStorage.getItem(prefsKey(email));
    if (!raw) return DEFAULT_UI_PREFS;
    return normalizePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_UI_PREFS;
  }
};

const saveUiPrefs = (email, prefs) => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(prefsKey(email), JSON.stringify(normalizePrefs(prefs)));
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("finance:ui-prefs", {
        detail: { email: email || "guest", prefs: normalizePrefs(prefs) }
      })
    );
  }
};

const applyUiPrefs = (prefs) => {
  if (typeof document === "undefined") return;
  const normalized = normalizePrefs(prefs);
  const layout = layoutMap[normalized.templateId] || UI_LAYOUTS[0];
  const resolvedTheme = resolveTheme(normalized.theme);
  const root = document.documentElement;
  const body = document.body;
  root.dataset.theme = resolvedTheme;
  root.dataset.layout = layout.id;
  if (body) {
    body.classList.toggle("compact-mode", normalized.compactMode);
  }

  const brandBase = normalized.brandColor || DEFAULT_UI_PREFS.brandColor;
  const primary =
    resolvedTheme === "dark" ? adjustColor(brandBase, 30) : adjustColor(brandBase, 0);
  const primaryDark = adjustColor(primary, resolvedTheme === "dark" ? -10 : -24);
  const accent = adjustColor(primary, resolvedTheme === "dark" ? 40 : 48);
  const onPrimary = readableTextColor(primary);
  const balanceStart = adjustColor(primary, resolvedTheme === "dark" ? -50 : -30);
  const balanceMiddle = adjustColor(primary, resolvedTheme === "dark" ? -20 : -10);
  const balanceEnd = adjustColor(primary, resolvedTheme === "dark" ? 30 : 50);

  const variables = {
    "--primary": primary,
    "--primary-dark": primaryDark,
    "--accent": accent,
    "--on-primary": onPrimary,
    "--balance-1": balanceStart,
    "--balance-2": balanceMiddle,
    "--balance-3": balanceEnd,
    "--shell-max": layout.values.shellMax,
    "--shell-max-narrow": layout.values.shellMaxNarrow,
    "--panel-radius": layout.values.panelRadius,
    "--card-radius": layout.values.cardRadius,
    "--panel-padding": layout.values.panelPadding,
    "--grid-gap": layout.values.gridGap,
    "--panel-shadow": layout.values.panelShadow
  };

  Object.entries(variables).forEach(([key, value]) => {
    if (value) root.style.setProperty(key, value);
    else root.style.removeProperty(key);
  });
};

export { DEFAULT_UI_PREFS, UI_LAYOUTS, UI_COLORS, applyUiPrefs, getUiPrefs, saveUiPrefs };
