import React from "react";

/* SVG icons */
const IcOcr = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M7 7h.01M17 7h.01M7 12h10M7 17h10"/>
  </svg>
);
const IcAdd = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IcCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const IcChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
);
const IcChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 15l-6-6-6 6"/>
  </svg>
);
const IcEye = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IcArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M9 6l6 6-6 6"/>
  </svg>
);
const IcMore = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
);
const IcClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);
const IcIncome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
);
const IcExpense = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M19 12l-7 7-7-7"/>
  </svg>
);
const IcTx = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
  </svg>
);

/* ─── Category SVG Icons ─── */
const SvgUtensils = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
  </svg>
);
const SvgCar = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
    <circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>
  </svg>
);
const SvgBag = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const SvgHeart = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const SvgWallet = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V22H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16v5"/>
    <path d="M20 12a2 2 0 0 0-2 2 2 2 0 0 0 2 2h4v-4z"/>
    <circle cx="16" cy="14" r="1" fill="currentColor"/>
  </svg>
);
const SvgLaptop = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
);
const SvgTrendUp = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);
const SvgFileText = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const SvgGamepad = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/>
    <circle cx="15" cy="11" r="1" fill="currentColor"/><circle cx="17" cy="13" r="1" fill="currentColor"/>
    <rect x="2" y="6" width="20" height="12" rx="4"/>
  </svg>
);
const SvgHome = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const SvgBook = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const SvgPlane = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-2 0-2 2-3.5 3.5L8 5.2"/><path d="m2 7 9 2"/>
    <path d="m4 17 1-6"/><path d="M2 7l2.5 2.5"/>
  </svg>
);
const SvgZap = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const SvgGift = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/>
    <rect x="2" y="7" width="20" height="5"/>
    <line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);
const SvgRefund = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/><path d="M12 8v4l3 3"/>
  </svg>
);
const SvgBriefcase = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const SvgDots = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
);

/* Category icon map – SVG inside colored circle */
const CAT_ICONS = {
  "Ăn uống":       { SvgIcon: SvgUtensils,  bg: "#ff6b35", gradient: "linear-gradient(135deg,#ff8a57,#ff4500)", light: "#ffe7dc" },
  "Di chuyển":     { SvgIcon: SvgCar,        bg: "#3b82f6", gradient: "linear-gradient(135deg,#60a5fa,#2563eb)", light: "#dbeafe" },
  "Mua sắm":       { SvgIcon: SvgBag,        bg: "#a855f7", gradient: "linear-gradient(135deg,#c084fc,#9333ea)", light: "#f3e8ff" },
  "Sức khỏe":      { SvgIcon: SvgHeart,      bg: "#ec4899", gradient: "linear-gradient(135deg,#f472b6,#db2777)", light: "#fce7f3" },
  "Lương":         { SvgIcon: SvgWallet,     bg: "#10b981", gradient: "linear-gradient(135deg,#34d399,#059669)", light: "#d1fae5" },
  "Freelance":     { SvgIcon: SvgLaptop,     bg: "#06b6d4", gradient: "linear-gradient(135deg,#22d3ee,#0891b2)", light: "#cffafe" },
  "Đầu tư":        { SvgIcon: SvgTrendUp,    bg: "#f59e0b", gradient: "linear-gradient(135deg,#fbbf24,#d97706)", light: "#fef3c7" },
  "Hóa đơn":       { SvgIcon: SvgFileText,   bg: "#ef4444", gradient: "linear-gradient(135deg,#f87171,#dc2626)", light: "#fee2e2" },
  "Giải trí":      { SvgIcon: SvgGamepad,    bg: "#8b5cf6", gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)", light: "#ede9fe" },
  "Nhà cửa":       { SvgIcon: SvgHome,       bg: "#22c55e", gradient: "linear-gradient(135deg,#4ade80,#16a34a)", light: "#dcfce7" },
  "Giáo dục":      { SvgIcon: SvgBook,       bg: "#0ea5e9", gradient: "linear-gradient(135deg,#38bdf8,#0284c7)", light: "#e0f2fe" },
  "Du lịch":       { SvgIcon: SvgPlane,      bg: "#14b8a6", gradient: "linear-gradient(135deg,#2dd4bf,#0f766e)", light: "#ccfbf1" },
  "Công nghệ":     { SvgIcon: SvgZap,        bg: "#6366f1", gradient: "linear-gradient(135deg,#818cf8,#4f46e5)", light: "#e0e7ff" },
  "Thưởng":        { SvgIcon: SvgGift,       bg: "#f97316", gradient: "linear-gradient(135deg,#fb923c,#ea580c)", light: "#ffedd5" },
  "Hoàn tiền":     { SvgIcon: SvgRefund,     bg: "#22c55e", gradient: "linear-gradient(135deg,#4ade80,#16a34a)", light: "#dcfce7" },
  "Thu nhập khác": { SvgIcon: SvgBriefcase,  bg: "#64748b", gradient: "linear-gradient(135deg,#94a3b8,#475569)", light: "#f1f5f9" },
};

const getCatMeta = (name) =>
  CAT_ICONS[name] || { SvgIcon: SvgDots, bg: "#94a3b8", gradient: "linear-gradient(135deg,#cbd5e1,#64748b)", light: "#f8fafc" };

export { getCatMeta, CAT_ICONS };
