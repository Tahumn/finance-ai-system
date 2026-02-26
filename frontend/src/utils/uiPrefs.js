const DEFAULT_UI_PREFS = {
  theme: "light",
  compactMode: false,
  reportLayout: "cards",
  templateId: "classic"
};

const UI_TEMPLATES = [
  {
    id: "classic",
    name: "Classic Cream",
    description: "Thanh lịch, dễ đọc",
    theme: "light",
    colors: {
      bg: "#f6f3ef",
      bg2: "#fefcf9",
      grad1: "#f3ede6",
      grad2: "#f8f5f2",
      grad3: "#fefbf7",
      text: "#171717",
      muted: "#6f6b67",
      primary: "#1565c0",
      primaryDark: "#0c418c",
      accent: "#ff8b5f",
      border: "#e6e0d9",
      cardSoft: "#f6ede4"
    },
    balance: {
      start: "#12274b",
      middle: "#1f4a82",
      end: "#f0a27b"
    }
  },
  {
    id: "mint",
    name: "Mint Matcha",
    description: "Mát mắt, dịu nhẹ",
    theme: "light",
    colors: {
      bg: "#eef6f0",
      bg2: "#fbfffc",
      grad1: "#e6f3ec",
      grad2: "#f2fbf6",
      grad3: "#fcfffd",
      text: "#1c2b25",
      muted: "#6a7c72",
      primary: "#2d7a5f",
      primaryDark: "#1f5f48",
      accent: "#8fd3a8",
      border: "#dbe8df",
      cardSoft: "#e6f3ec"
    },
    balance: {
      start: "#1c4b3a",
      middle: "#2d7a5f",
      end: "#a8e0c0"
    }
  },
  {
    id: "peach",
    name: "Peach Soda",
    description: "Ấm áp, đáng yêu",
    theme: "light",
    colors: {
      bg: "#fff2e6",
      bg2: "#fffaf6",
      grad1: "#ffe9d9",
      grad2: "#fff3ea",
      grad3: "#fffdf8",
      text: "#2f1f1a",
      muted: "#7d6a62",
      primary: "#d86a4b",
      primaryDark: "#b65136",
      accent: "#ffb596",
      border: "#f0d9cf",
      cardSoft: "#ffe8dc"
    },
    balance: {
      start: "#7a3b2e",
      middle: "#c06449",
      end: "#ffb28f"
    }
  },
  {
    id: "sky",
    name: "Sky Picnic",
    description: "Tươi sáng, nhẹ nhàng",
    theme: "light",
    colors: {
      bg: "#eef6ff",
      bg2: "#f9fcff",
      grad1: "#e6f0fb",
      grad2: "#f2f7ff",
      grad3: "#ffffff",
      text: "#1c2733",
      muted: "#6e7c8a",
      primary: "#2e6bd1",
      primaryDark: "#1e4d9f",
      accent: "#9bc2ff",
      border: "#dbe6f3",
      cardSoft: "#e6f0fb"
    },
    balance: {
      start: "#1f3b6d",
      middle: "#2e6bd1",
      end: "#9bc2ff"
    }
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    description: "Đậm, dễ tập trung",
    theme: "dark",
    colors: {
      bg: "#0f141f",
      bg2: "#161d2a",
      grad1: "#0c111b",
      grad2: "#111827",
      grad3: "#1a2232",
      text: "#e8edf3",
      muted: "#a2acba",
      primary: "#4f8cff",
      primaryDark: "#2a62d6",
      accent: "#f8b36d",
      border: "#2a3242",
      cardSoft: "#1b2230"
    },
    balance: {
      start: "#0c1e3d",
      middle: "#1a3d78",
      end: "#f0a46b"
    }
  }
];

const templateMap = UI_TEMPLATES.reduce((acc, template) => {
  acc[template.id] = template;
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

const normalizePrefs = (prefs = {}) => {
  const merged = { ...DEFAULT_UI_PREFS, ...prefs };
  const templateId = templateMap[merged.templateId] ? merged.templateId : DEFAULT_UI_PREFS.templateId;
  return {
    theme: normalizeTheme(merged.theme),
    compactMode: Boolean(merged.compactMode),
    reportLayout: normalizeLayout(merged.reportLayout),
    templateId
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
  const template = templateMap[normalized.templateId] || UI_TEMPLATES[0];
  const resolvedTheme = resolveTheme(normalized.theme || template.theme);
  const root = document.documentElement;
  const body = document.body;
  root.dataset.theme = resolvedTheme;
  if (body) {
    body.classList.toggle("compact-mode", normalized.compactMode);
  }
  const colors = template.colors || {};
  const balance = template.balance || {};
  const variables = {
    "--bg": colors.bg,
    "--bg-2": colors.bg2,
    "--bg-grad-1": colors.grad1,
    "--bg-grad-2": colors.grad2,
    "--bg-grad-3": colors.grad3,
    "--text": colors.text,
    "--muted": colors.muted,
    "--primary": colors.primary,
    "--primary-dark": colors.primaryDark,
    "--accent": colors.accent,
    "--border": colors.border,
    "--card-soft": colors.cardSoft,
    "--balance-1": balance.start,
    "--balance-2": balance.middle,
    "--balance-3": balance.end
  };
  Object.entries(variables).forEach(([key, value]) => {
    if (value) root.style.setProperty(key, value);
    else root.style.removeProperty(key);
  });
};

export { DEFAULT_UI_PREFS, UI_TEMPLATES, applyUiPrefs, getUiPrefs, saveUiPrefs };
