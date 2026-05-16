import { useEffect, useMemo, useRef, useState } from "react";
import OcrScreen from "../ocr/OcrScreen.jsx";
import {
  formatNumberInput,
  parseNumberInput,
  toInputDate,
  currency
} from "../../utils/format.js";
import { colorFor, onColor } from "../../utils/colors.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { getBaseUrl } from "../../api/client.js";
import { t } from "../../utils/i18n.js";
import { getCatMeta, CAT_ICONS } from "../../utils/categoryIcons.jsx";
import "./transactions-desktop.css";

/* ─── helpers ─── */
const parseDateInput = (value) => {
  if (!value) return new Date();
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
};
const toDateInput = (date) => toInputDate(date instanceof Date ? date : new Date(date));

const normalizeTag = (v) => v.trim().replace(/^#/, "");

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "highest", label: "Cao nhất" },
  { value: "lowest", label: "Thấp nhất" },
];

/* Icon options for category picker (id maps to CAT_ICONS key or svg name) */
const CAT_ICON_OPTIONS = [
  "Di chuyển", "Mua sắm", "Ăn uống", "Giải trí", "Hóa đơn",
  "Thưởng", "Hoàn tiền", "Sức khỏe", "Giáo dục", "Du lịch",
  "Nhà cửa", "Công nghệ", "Đầu tư", "Lương", "Freelance", "Thu nhập khác",
];

/* SVG icons */
const IcOcr = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M7 7h.01M17 7h.01M7 12h10M7 17h10" />
  </svg>
);
const IcAdd = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IcCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const IcChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const IcChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);
const IcEye = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IcArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const IcMore = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
);
const IcClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const IcIncome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
const IcExpense = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);
const IcTx = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

/* Format date range label */
const formatRangeLabel = (start, end) => {
  if (!start && !end) return "Chọn thời gian";
  const fmt = (d) => {
    if (!d) return "";
    const parts = (d || "").split("-");
    if (parts.length < 3) return "";
    const [y, m, day] = parts;
    return `${day}/${m}/${y}`;
  };
  if (start === end || !end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
};

const formatAnomalyTip = (anomaly) => {
  if (anomaly == null) return "";
  if (typeof anomaly === "string" || typeof anomaly === "number") return String(anomaly);
  if (typeof anomaly !== "object") return String(anomaly);

  if (anomaly.message) return String(anomaly.message);

  const headParts = [];
  if (anomaly.severity) headParts.push(String(anomaly.severity).toUpperCase());
  if (anomaly.reason) headParts.push(String(anomaly.reason));
  const head = headParts.join(": ");

  const tailParts = [];
  if (anomaly.description) tailParts.push(String(anomaly.description));
  if (anomaly.amount != null && !Number.isNaN(Number(anomaly.amount))) tailParts.push(currency(Number(anomaly.amount)));
  if (anomaly.date) tailParts.push(String(anomaly.date).slice(0, 10));
  const tail = tailParts.join(" · ");

  if (head && tail) return `${head} — ${tail}`;
  return head || tail || JSON.stringify(anomaly);
};

/* SVG icons for AI */
const IcSparkle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </svg>
);
const IcTrendUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" />
  </svg>
);
const IcTrendDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 18l-9.5-9.5-5 5L1 6" /><path d="M17 18h6v-6" />
  </svg>
);
const IcAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const IcLightbulb = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2v1" /><path d="M5.22 5.22l.707.707" /><path d="M1 12h1" /><path d="M21 12h1" /><path d="M18.07 5.93l.707-.707" /><path d="M12 2c-3.31 0-6 2.69-6 6 0 1.5.5 3 1.5 4.5.83 1.25 1.5 3 1.5 4.5h6c0-1.5.67-3.25 1.5-4.5 1-1.5 1.5-3 1.5-4.5 0-3.31-2.69-6-6-6z" />
  </svg>
);

/* Mini Sparkline for Trends */
const TrendSparkline = ({ data = [] }) => {
  if (data.length < 2) return null;
  const values = data.map(d => d.expense || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="txd-sparkline">
      <path d={`M ${points}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const AiIntelligencePanel = ({
  monthlySeries,
  anomalies,
  aiSuggestions,
  showAllTips,
  setShowAllTips,
  loading,
  formatAnomalyTip,
  IcSparkle,
  IcTrendUp,
  IcTrendDown,
  IcAlert,
  IcLightbulb,
  categoryStats = [],
  transactions = [],
  setSelectedTx,
  setActiveModal,
  IcEye
}) => {
  // Find the category with the highest spending to provide a better tip
  const topCategory = categoryStats.length > 0
    ? [...categoryStats].sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt))[0]
    : null;

  return (
    <div className="txd-ai-horizontal-panel">
      <div className="txd-ai-hp-header">
        <div className="txd-ai-chip-wrap">
          <div className="txd-ai-chip">
            <IcSparkle size={14} /> Trợ lý Tài chính AI
          </div>
        </div>
        <div className="txd-ai-status">{loading ? "Đang quét dữ liệu..." : "Hệ thống đã sẵn sàng"}</div>
      </div>

      <div className="txd-ai-hp-content">
        {/* 1. Phân tích Biến động Chi tiết */}
        <div className="txd-ai-hp-col trend-col">
          <div className="txd-ai-section-title">
            <IcTrendUp /> PHÂN TÍCH BIẾN ĐỘNG
          </div>
          {monthlySeries && monthlySeries.length >= 2 ? (
            (() => {
              const last = monthlySeries[monthlySeries.length - 1];
              const prev = monthlySeries[monthlySeries.length - 2];
              const diff = last.expense - prev.expense;
              const pct = prev.expense ? (diff / prev.expense) * 100 : 0;
              return (
                <div className="txd-ai-trend-card pro horizontal">
                  <div className="txd-ai-trend-header">
                    <div className="txd-ai-trend-main">
                      <div className={`txd-ai-trend-circle ${diff > 0 ? "up" : "down"}`}>
                        {diff > 0 ? <IcTrendUp /> : <IcTrendDown />}
                      </div>
                      <div>
                        <div className="txd-ai-trend-val">
                          {diff > 0 ? "+" : ""}{Math.abs(pct) > 999 ? "999%+" : `${Math.round(pct)}%`}
                        </div>
                        <div className="txd-ai-trend-label">Dòng tiền tháng này</div>
                      </div>
                    </div>
                    <div className={`txd-ai-spark-container ${diff > 0 ? "up" : "down"}`}>
                      <TrendSparkline data={monthlySeries.slice(-6)} />
                    </div>
                  </div>
                  <div className="txd-ai-trend-footer">
                    <div className="txd-ai-insight-box mini">
                      <p className="txd-ai-trend-desc-mini">
                        {diff > 0
                          ? `Cảnh báo: Chi tiêu đang vượt mức kiểm soát, tập trung tại '${topCategory?.name || 'nhóm chính'}'.`
                          : "Tối ưu: Bạn đang duy trì kỷ luật ngân sách xuất sắc. Xu hướng giảm chi phí đang ổn định."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="txd-ai-empty">Đang xây dựng mô hình dự báo...</p>
          )}
        </div>

        {/* 2. Hệ thống Cảnh báo Sớm */}
        <div className="txd-ai-hp-col anomaly-col">
          <div className="txd-ai-section-title warning">
            <IcAlert /> HỆ THỐNG CẢNH BÁO SỚM
          </div>
          <div className="txd-ai-anomaly-list horizontal">
            {anomalies && anomalies.length > 0 ? (
              anomalies.slice(0, 1).map((a, idx) => {
                const level = a.type?.toLowerCase() || "medium";
                return (
                  <div key={idx} className={`txd-ai-anomaly-card-premium ${level} horizontal scanner-effect`}>
                    <div className="txd-ai-anomaly-left">
                      <div className="txd-ai-anomaly-icon-wrap mini pulse">
                        <IcAlert />
                      </div>
                    </div>
                    <div className="txd-ai-anomaly-right">
                      <div className="txd-ai-anomaly-meta-row">
                        <div className="txd-ai-anomaly-status-tag">{level === 'high' ? 'RỦI RO CAO' : 'CẦN XÁC MINH'}</div>
                        <div className="txd-ai-live-tag"><span className="dot"></span> LIVE</div>
                      </div>
                      <div className="txd-ai-anomaly-text-main mini"><strong>Phát hiện:</strong> {formatAnomalyTip(a)}</div>
                      <button
                        className="txd-ai-anomaly-btn-premium"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const topHeader = document.querySelector('.txd-header-top') || document.querySelector('.tx-top-header');
                          if (topHeader) {
                            topHeader.scrollIntoView({ behavior: 'smooth' });
                          } else {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <span>Rà soát chi tiết</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="txd-ai-status-safe pro">
                <div className="txd-ai-safe-icon">🛡️</div>
                <p>Hệ thống đang bảo mật. Không có giao dịch nghi vấn trong chu kỳ này.</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Chiến lược Tối ưu Tài sản */}
        <div className="txd-ai-hp-col tips-col">
          <div className="txd-ai-section-title savings">
            <IcLightbulb /> CHIẾN LƯỢC TỐI ƯU TÀI SẢN
          </div>
          <div className="txd-ai-tips-list horizontal">
            {(() => {
              const finalTips = (aiSuggestions && aiSuggestions.length > 0) ? aiSuggestions : [
                "Chiến lược 50/30/20: Phân bổ 50% cho thiết yếu, 30% linh hoạt và 20% cho đầu tư dài hạn.",
                `Tối ưu nhóm '${topCategory?.name || 'chi tiêu'}': Cắt giảm 15% tại đây sẽ tạo ra khoản thặng dư đáng kể sau 12 tháng.`,
                "Nguyên tắc 72 giờ: Đợi 3 ngày trước khi quyết định mua sắm các món đồ giá trị lớn để tránh bốc đồng."
              ];
              const tipIcons = ["🚀", "💡", "🛡️", "🎯", "📈"];
              return finalTips.slice(0, 3).map((tip, idx) => (
                <div key={idx} className="txd-ai-tip-card pro mini expert">
                  <div className="txd-ai-tip-body">
                    <div className="txd-ai-tip-icon mini">{tipIcons[idx % tipIcons.length]}</div>
                    <div className="txd-ai-tip-text mini"><strong>Chiến lược:</strong> {typeof tip === 'string' ? tip : tip.message}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── main component ─── */
export default function TransactionsScreen({
  transactions,
  totalCount,
  categories,
  tags = [],
  filters,
  onFiltersChange,
  onCreate,
  onUpdate,
  onDelete,
  onCreateCategory,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onCreateTransaction,
  onLoadMore,
  hasMore,
  userEmail,
  onBack,
  loading,
  onCreateFromText,
  onParseFromText,
  accounts = [],
  anomalies = [],
  newlyCreatedId,
  onCreateBill,
  aiSuggestions = [],
  monthlySeries = []
}) {
  /* modals */
  const [activeModal, setActiveModal] = useState(null); // "add" | "ocr" | "edit" | "detail" | "dateRange" | "addCategory" | "addTag"
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [showAllTips, setShowAllTips] = useState(false);
  const [showAllCatsMobile, setShowAllCatsMobile] = useState(false);
  const [showAllTagsMobile, setShowAllTagsMobile] = useState(false);

  /* desktop layout toggle */
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* add-form state */
  const [createType, setCreateType] = useState("expense");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createAccountId, setCreateAccountId] = useState("");
  const [createDate, setCreateDate] = useState(() => toInputDate(new Date()));
  const [createAmount, setCreateAmount] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createTagIds, setCreateTagIds] = useState([]);

  /* edit-form state */
  const [editAmount, setEditAmount] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editTagIds, setEditTagIds] = useState([]);

  /* tag input */
  const [tagInput, setTagInput] = useState("");

  /* UI state */
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [searchText, setSearchText] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showAllGroups, setShowAllGroups] = useState({});
  const [dateRangeLabel, setDateRangeLabel] = useState(() => formatRangeLabel(filters.start, filters.end));

  /* add category modal state */
  const [newCatName, setNewCatName] = useState("");
  const [newCatIconKey, setNewCatIconKey] = useState("Di chuyển");
  const [newCatColor, setNewCatColor] = useState("#ec4899");

  /* add tag modal state */
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#ec4899");

  /* sidebar category pagination + sort */
  const [catSort, setCatSort] = useState("pct"); // "az" | "pct"
  const [catPage, setCatPage] = useState(0);
  const CAT_PAGE_SIZE = 5;

  /* sidebar tag pagination */
  const [tagPage, setTagPage] = useState(0);
  const TAG_PAGE_SIZE = 8;

  const categoryPrefs = useMemo(() => getCategoryPrefs(userEmail), [userEmail]);

  /* sync date label */
  useEffect(() => {
    setDateRangeLabel(formatRangeLabel(filters.start, filters.end));
  }, [filters.start, filters.end]);

  useEffect(() => {
    if (activeModal) document.body.classList.add("tx-modal-open");
    else document.body.classList.remove("tx-modal-open");
    return () => document.body.classList.remove("tx-modal-open");
  }, [activeModal]);

  /* tag lookup maps */
  const tagMap = useMemo(() => {
    const m = {};
    tags.forEach((tag) => { m[tag.id] = tag; });
    return m;
  }, [tags]);

  const tagNameMap = useMemo(() => {
    const m = {};
    tags.forEach((tag) => { if (tag?.name) m[tag.name.toLowerCase()] = tag; });
    return m;
  }, [tags]);

  /* payment tag helpers */
  const cashTag = useMemo(() => tags.find((t) => t.name === "Tiền mặt"), [tags]);
  const bankTag = useMemo(() => tags.find((t) => t.name === "Ngân hàng"), [tags]);

  const getPaymentTag = (item) => {
    if (!Array.isArray(item.tags)) return null;
    const cash = item.tags.find((t) => t.name === "Tiền mặt");
    const bank = item.tags.find((t) => t.name === "Ngân hàng");
    return cash || bank || null;
  };

  /* sync editingTx */
  useEffect(() => {
    if (!editingTx) { setEditTagIds([]); setEditAmount(""); setEditAccountId(""); return; }
    const nextTags = Array.isArray(editingTx.tags) ? editingTx.tags.map((t) => t.id).filter(Boolean) : [];
    setEditTagIds(nextTags);
    setEditAmount(formatNumberInput(editingTx.amount));
    setEditAccountId(editingTx.account_id || "");
  }, [editingTx]);

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1);

  /* filtered + sorted transactions */
  const filtered = useMemo(() => {
    return transactions.filter((item) => {
      if (typeFilter && item.transaction_type !== typeFilter) return false;

      if (categoryFilter) {
        const itemCat = String(item.categoryLabel || "Khác").trim().toLowerCase();
        const filterCat = String(categoryFilter).trim().toLowerCase();
        if (itemCat !== filterCat) return false;
      }

      if (tagFilter) {
        if (!Array.isArray(item.tags) || !item.tags.some(t => String(t.id) === String(tagFilter))) return false;
      }

      if (searchText) {
        const q = searchText.toLowerCase();
        if (!item.description?.toLowerCase().includes(q)) return false;
      }

      if (paymentFilter !== "all") {
        if (paymentFilter === "cash") {
          return !item.account_id || (accounts.find(a => a.id === item.account_id)?.type === "cash");
        }
        return item.account_id === Number(paymentFilter);
      }

      return true;
    });
  }, [transactions, typeFilter, categoryFilter, tagFilter, searchText, paymentFilter, accounts]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortOrder === "newest") arr.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.id - a.id));
    else if (sortOrder === "oldest") arr.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : a.id - b.id));
    else if (sortOrder === "highest") arr.sort((a, b) => b.amount - a.amount);
    else arr.sort((a, b) => a.amount - b.amount);
    return arr;
  }, [filtered, sortOrder]);

  /* summary stats */
  const totalIncome = useMemo(() => filtered.filter((i) => i.transaction_type === "income").reduce((s, i) => s + i.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter((i) => i.transaction_type === "expense").reduce((s, i) => s + i.amount, 0), [filtered]);

  /* group by category */
  const grouped = useMemo(() => {
    const map = new Map();
    sorted.forEach((item) => {
      const key = item.categoryLabel || "Khác";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries()).map(([cat, items]) => ({
      cat,
      items,
      total: items.reduce((s, i) => {
        const sign = i.transaction_type === "income" ? 1 : -1;
        return s + sign * i.amount;
      }, 0),
    })).sort((a, b) => {
      const dateA = a.items.reduce((max, item) => (item.date > max ? item.date : max), "0000-00-00");
      const dateB = b.items.reduce((max, item) => (item.date > max ? item.date : max), "0000-00-00");
      return sortOrder === "oldest" ? (dateA > dateB ? 1 : -1) : (dateB > dateA ? 1 : -1);
    });
  }, [sorted, sortOrder]);

  /* category breakdown for icons row */
  const categoryStats = useMemo(() => {
    const map = {};
    // Calculate stats based on transactions filtered by everything EXCEPT categoryFilter
    transactions.filter((item) => {
      if (typeFilter && item.transaction_type !== typeFilter) return false;
      if (paymentFilter === "cash") {
        if (!Array.isArray(item.tags) || !item.tags.some((t) => t.name === "Tiền mặt")) return false;
      }
      if (paymentFilter === "bank") {
        if (!Array.isArray(item.tags) || !item.tags.some((t) => t.name === "Ngân hàng")) return false;
      }
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!item.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    }).forEach((item) => {
      const key = item.categoryLabel || "Khác";
      if (!map[key]) map[key] = 0;
      map[key] += 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions, typeFilter, paymentFilter, searchText, filters.start, filters.end]);

  /* toggle group expand */
  const toggleGroup = (cat) => setExpandedGroups((prev) => ({ ...prev, [cat]: !prev[cat] }));

  /* add tag helpers */
  const addTagById = (setIds) => (id) => setIds((curr) => curr.includes(id) ? curr : [...curr, id]);
  const removeTagById = (setIds) => (id) => setIds((curr) => curr.filter((x) => x !== id));

  const addTagByName = async (value, setIds) => {
    const name = normalizeTag(value);
    if (!name) return;
    const existing = tagNameMap[name.toLowerCase()];
    if (existing) { addTagById(setIds)(existing.id); return; }
    if (!onCreateTag) return;
    const created = await onCreateTag({ name, color: "#3b82f6" });
    if (created?.id) addTagById(setIds)(created.id);
  };

  /* form handlers */
  const handleCreate = (e) => {
    e.preventDefault();
    const amount = parseNumberInput(createAmount);
    if (!amount || amount <= 0) return;
    onCreate({
      description: createDesc,
      amount,
      transaction_type: createType,
      category_id: createCategoryId ? Number(createCategoryId) : null,
      account_id: createAccountId ? Number(createAccountId) : null,
      date: createDate,
      tag_ids: createTagIds,
    });
    setCreateDesc(""); setCreateAmount(""); setCreateDate(toInputDate(new Date()));
    setCreateCategoryId(""); setCreateAccountId(""); setCreateTagIds([]); setTagInput(""); setActiveModal(null);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onUpdate(editingTx.id, {
      description: form.get("description"),
      amount: parseNumberInput(editAmount),
      transaction_type: form.get("transaction_type"),
      category_id: form.get("category_id") ? Number(form.get("category_id")) : null,
      account_id: editAccountId ? Number(editAccountId) : null,
      date: form.get("date"),
      tag_ids: editTagIds,
    });
    setEditingTx(null); setActiveModal(null);
  };

  /* ─── RENDER DESKTOP ─── */
  const renderDesktop = () => {
    // 1. Group filtered/sorted transactions by Category
    const grouped = {};
    sorted.forEach((tx) => {
      const cat = tx.categoryLabel || "Khác";
      if (!grouped[cat]) grouped[cat] = { total: 0, count: 0, items: [] };
      grouped[cat].items.push(tx);
      grouped[cat].count++;
      grouped[cat].total += tx.transaction_type === "income" ? Number(tx.amount) : -Number(tx.amount);
    });
    const sortedGroups = Object.entries(grouped).sort((a, b) => {
      const dateA = a[1].items.reduce((max, item) => (item.date > max ? item.date : max), "0000-00-00");
      const dateB = b[1].items.reduce((max, item) => (item.date > max ? item.date : max), "0000-00-00");
      return sortOrder === "oldest" ? (dateA > dateB ? 1 : -1) : (dateB > dateA ? 1 : -1);
    });

    return (
      <div className="txd-container">
        {/* Top Header Row */}
        <div className="txd-header-top">
          <div className="txd-title-block">
            <h1 className="txd-title">Giao dịch</h1>
            <p className="txd-subtitle">Quản lý tất cả giao dịch thu chi của bạn</p>
          </div>
          <div className="txd-header-actions">
            <button className="txd-date-range" onClick={() => setActiveModal("dateRange")}>
              <IcCalendar /> {dateRangeLabel} <IcChevronDown />
            </button>
            <button className="txd-btn-ocr" onClick={() => setActiveModal("ocr")}>
              <IcOcr /> Quét hóa đơn OCR
            </button>
            <button className="txd-btn-add" onClick={() => {
              setCreateType("expense"); setCreateCategoryId(""); setCreateDate(filters.end || toInputDate(new Date()));
              setCreateAmount(""); setCreateDesc(""); setCreateTagIds([]); setActiveModal("add");
            }}>
              + Thêm giao dịch
            </button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="txd-kpi-row-top">
          <div className="txd-kpi-card">
            <div className="txd-kpi-icon income"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg></div>
            <div className="txd-kpi-text">
              <div className="txd-kpi-label">Tổng thu</div>
              <div className="txd-kpi-value income">{currency(totalIncome)}</div>
              <div className="txd-kpi-meta"><span className="up">↑ {filtered.filter(i => i.transaction_type === "income").length}</span> giao dịch thu nhập</div>
            </div>
          </div>
          <div className="txd-kpi-card">
            <div className="txd-kpi-icon expense"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></div>
            <div className="txd-kpi-text">
              <div className="txd-kpi-label">Tổng chi</div>
              <div className="txd-kpi-value expense">{currency(totalExpense)}</div>
              <div className="txd-kpi-meta"><span className="down">↓ {filtered.filter(i => i.transaction_type === "expense").length}</span> giao dịch chi tiêu</div>
            </div>
          </div>
          <div className="txd-kpi-card">
            <div className="txd-kpi-icon count"><IcTx /></div>
            <div className="txd-kpi-text">
              <div className="txd-kpi-label">Số giao dịch</div>
              <div className="txd-kpi-value count">{filtered.length} giao dịch</div>
              <div className="txd-kpi-meta"><span className="up">↑ {categoryStats.length}</span> danh mục đang phát sinh</div>
            </div>
          </div>
        </div>

        {/* Body Layout (2 Columns) */}
        <div className="txd-body-cols">
          {/* Left Column (Search + Sidebar) */}
          <div className="txd-col-left">
            <div className="txd-searchbox-top">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Tìm kiếm giao dịch..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="txd-sidebar-cat">
              {/* ── Category Header with sort toggle ── */}
              <div className="txd-sb-head">
                <h3 className="txd-sb-title">Tổng quan theo danh mục</h3>
                <div className="txd-sb-sort-btns">
                  <button
                    type="button"
                    className={`txd-sort-btn ${catSort === "az" ? "active" : ""}`}
                    onClick={() => { setCatSort("az"); setCatPage(0); }}
                  >A-Z</button>
                  <button
                    type="button"
                    className={`txd-sort-btn ${catSort === "pct" ? "active" : ""}`}
                    onClick={() => { setCatSort("pct"); setCatPage(0); }}
                  >%</button>
                </div>
              </div>

              {/* ── Category List (paginated) ── */}
              {(() => {
                const catAmounts = categoryStats.map(([name]) => {
                  const amt = sorted.filter((i) => (i.categoryLabel || "Khác") === name)
                    .reduce((s, i) => s + (i.transaction_type === "income" ? i.amount : -i.amount), 0);
                  return { name, amt };
                });
                const maxAmt = Math.max(...catAmounts.map(c => Math.abs(c.amt)), 1);

                const sortedCats = [...catAmounts].sort((a, b) =>
                  catSort === "az"
                    ? a.name.localeCompare(b.name, "vi")
                    : Math.abs(b.amt) - Math.abs(a.amt)
                );

                const totalPages = Math.ceil(sortedCats.length / CAT_PAGE_SIZE);
                const pageCats = sortedCats.slice(catPage * CAT_PAGE_SIZE, (catPage + 1) * CAT_PAGE_SIZE);

                return (
                  <>
                    <div className="txd-cip-scroll">
                      {pageCats.map(({ name, amt }) => {
                        const meta = getCatMeta(name);
                        const pct = (Math.abs(amt) / maxAmt * 100).toFixed(1);
                        return (
                          <div
                            key={name}
                            className={`txd-cat-item-pro ${categoryFilter === name ? "active" : ""}`}
                            onClick={() => setCategoryFilter(categoryFilter === name ? "" : name)}
                          >
                            <div className="txd-cip-icon" style={{ background: meta.light, color: meta.bg }}>
                              <meta.SvgIcon size={18} />
                            </div>
                            <div className="txd-cip-info">
                              <div className="txd-cip-name">{name}</div>
                              <div className="txd-cip-amt">{currency(Math.abs(amt))}</div>
                            </div>
                            <div className="txd-cip-pct">{pct}%</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="txd-sb-pagination">
                        <button
                          type="button"
                          className="txd-sb-pg-btn"
                          disabled={catPage === 0}
                          onClick={() => setCatPage(p => p - 1)}
                        >‹</button>
                        <span className="txd-sb-pg-label">{catPage + 1} / {totalPages}</span>
                        <button
                          type="button"
                          className="txd-sb-pg-btn"
                          disabled={catPage >= totalPages - 1}
                          onClick={() => setCatPage(p => p + 1)}
                        >›</button>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── Add Category button at bottom ── */}
              <button
                type="button"
                className="txd-add-bottom-btn"
                onClick={() => { setNewCatName(""); setNewCatColor("#ec4899"); setActiveModal("addCategory"); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Thêm danh mục
              </button>

              {/* ── Tags Section ── */}
              <div className="txd-sb-tags-section">
                <div className="txd-sb-head" style={{ marginTop: 20 }}>
                  <h3 className="txd-sb-title">Nhãn</h3>
                </div>
                {(() => {
                  const totalTagPages = Math.ceil(tags.length / TAG_PAGE_SIZE);
                  const pageTags = tags.slice(tagPage * TAG_PAGE_SIZE, (tagPage + 1) * TAG_PAGE_SIZE);
                  return (
                    <>
                      <div className="txd-tags-wrap">
                        {pageTags.map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            className={`txd-tag-pill ${tagFilter === String(tag.id) ? "active" : ""}`}
                            style={tagFilter === String(tag.id)
                              ? { background: tag.color, color: "#fff", borderColor: tag.color }
                              : { borderColor: tag.color, color: tag.color }}
                            onClick={() => setTagFilter(tagFilter === String(tag.id) ? "" : String(tag.id))}
                          >
                            {tag.name}
                          </button>
                        ))}
                        {tags.length === 0 && <p className="txd-tags-empty">Chưa có nhãn nào</p>}
                      </div>

                      {totalTagPages > 1 && (
                        <div className="txd-sb-pagination">
                          <button
                            type="button"
                            className="txd-sb-pg-btn"
                            disabled={tagPage === 0}
                            onClick={() => setTagPage(p => p - 1)}
                          >‹</button>
                          <span className="txd-sb-pg-label">{tagPage + 1} / {totalTagPages}</span>
                          <button
                            type="button"
                            className="txd-sb-pg-btn"
                            disabled={tagPage >= totalTagPages - 1}
                            onClick={() => setTagPage(p => p + 1)}
                          >›</button>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Add Tag button at bottom */}
                <button
                  type="button"
                  className="txd-add-bottom-btn"
                  onClick={() => { setNewTagName(""); setNewTagColor("#ec4899"); setActiveModal("addTag"); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Thêm nhãn
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (List + Filters) */}
          <div className="txd-col-right">
            <div className="txd-filters-bar">
              <div className="txd-filter-pills">
                <div className="txd-fpill-group">
                  <label>Nguồn tiền:</label>
                  <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
                    <option value="all">Tất cả</option>
                    {accounts.map(acc => <option key={acc.id} value={String(acc.id)}>{acc.name}</option>)}
                  </select>
                </div>
                <div className="txd-fpill-group">
                  <label>Loại:</label>
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    <option value="">Tất cả</option>
                    <option value="income">Thu nhập</option>
                    <option value="expense">Chi tiêu</option>
                  </select>
                </div>
                <div className="txd-fpill-group">
                  <label>Danh mục:</label>
                  <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="">Tất cả</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="txd-fpill-group">
                  <label>Nhãn:</label>
                  <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
                    <option value="">Tất cả</option>
                    {tags.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="txd-filter-right">
                {(typeFilter || categoryFilter || tagFilter || paymentFilter !== "all") && (
                  <button className="txd-reset-btn" onClick={() => { setTypeFilter(""); setCategoryFilter(""); setTagFilter(""); setPaymentFilter("all"); }}>
                    × Xóa bộ lọc
                  </button>
                )}
                <button className="txd-btn-filter-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                </button>
              </div>
            </div>

            <div className="txd-list-container">
              <div className="txd-list-header">
                <div className="lh-col">Giao dịch</div>
                <div className="lh-col date">Ngày</div>
                <div className="lh-col source">Nguồn tiền</div>
                <div className="lh-col cat">Danh mục</div>
                <div className="lh-col tags">Nhãn</div>
                <div className="lh-col amount">Số tiền</div>
              </div>

              <div className="txd-groups">
                {(() => {
                  const totalTx = sorted.length;
                  const CATS_PER_PAGE = totalTx > 30 ? 3 : 5;
                  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / CATS_PER_PAGE));
                  const safePage = Math.min(currentPage, totalPages);
                  const pagedGroups = sortedGroups.slice((safePage - 1) * CATS_PER_PAGE, safePage * CATS_PER_PAGE);
                  return pagedGroups;
                })().map(([catName, data]) => {
                  const isExpanded = expandedGroups[catName] !== false; // Default Open
                  const meta = getCatMeta(catName);
                  return (
                    <div key={catName} className="txd-group-pro">
                      <button className="txd-gp-head" onClick={() => toggleGroup(catName)}>
                        <div className="txd-gph-icon" style={{ color: meta.bg }}><meta.SvgIcon size={18} /></div>
                        <div className="txd-gph-title">{catName} <span>({data.count})</span></div>
                        <div className={`txd-gph-total ${data.total >= 0 ? "income" : "expense"}`}>
                          {data.total > 0 ? "+" : ""}{currency(data.total)}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="txd-gp-body">
                          {data.items.slice(0, showAllGroups[catName] ? data.items.length : 4).map(tx => {
                            const isIncome = tx.transaction_type === "income";
                            const txMeta = getCatMeta(tx.categoryLabel || "Khác");
                            const acc = accounts.find(a => a.id === tx.account_id);

                            let sourceText = acc ? acc.name : "Tiền mặt";
                            let sourceClass = acc ? (acc.type === "credit" ? "bank" : "ewallet") : "cash";

                            return (
                              <div key={tx.id || tx.description} className={`txd-list-row ${newlyCreatedId === tx.id ? "new-item-flash" : ""}`} onClick={() => setSelectedTx(tx)}>
                                <div className="lr-col main">
                                  <div className="lr-icon" style={{ background: txMeta.bg, color: "#fff" }}><txMeta.SvgIcon size={14} /></div>
                                  <span className="lr-title">
                                    {tx.description || "Giao dịch"}
                                    {tx.ocr_confidence > 0 && (
                                      <span className="tx-ocr-badge" title={`Độ tin cậy OCR: ${Math.round(tx.ocr_confidence * 100)}%`}>
                                        <IcOcr /> {Math.round(tx.ocr_confidence * 100)}%
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="lr-col notes">{tx.notes || "—"}</div>
                                <div className="lr-col date">{tx.date?.split('-').reverse().join('/')}</div>
                                <div className="lr-col source"><span className={`src-badge ${sourceClass}`}>{sourceText}</span></div>
                                <div className="lr-col cat"><span className="cat-badge" style={{ color: txMeta.bg, background: txMeta.light }}>{catName}</span></div>
                                <div className="lr-col tags">
                                  <div className="txd-tag-list">
                                    {(tx.tags || []).map(t => (
                                      <span key={t.id} className="txd-tag-small" style={{ color: t.color, borderColor: t.color }}>{t.name}</span>
                                    ))}
                                  </div>
                                </div>
                                <div className={`lr-col amount ${isIncome ? "income" : "expense"}`}>
                                  {isIncome ? "+" : "-"}{currency(Math.abs(tx.amount))}
                                  <button className="lr-more-btn" onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }}>...</button>
                                </div>
                              </div>
                            );
                          })}

                          {data.items.length > 4 && !showAllGroups[catName] && (
                            <button className="txd-gp-expand" onClick={() => setShowAllGroups(p => ({ ...p, [catName]: true }))}>
                              <span className="expand-arrow">{'>'}</span> Xem tất cả {data.items.length} giao dịch <IcChevronDown />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Pagination with real page numbers */}
            {(() => {
              const totalTx = sorted.length;
              const CATS_PER_PAGE = totalTx > 30 ? 3 : 5;
              const totalPages = Math.max(1, Math.ceil(sortedGroups.length / CATS_PER_PAGE));
              const safePage = Math.min(currentPage, totalPages);
              if (totalPages <= 1) return (
                <div className="txd-pagination-bar">
                  <div className="txd-page-info">{filtered.length} giao dịch</div>
                </div>
              );
              const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
              return (
                <div className="txd-pagination-bar">
                  <div className="txd-page-info">Trang {safePage} / {totalPages} &nbsp;·&nbsp; {filtered.length} giao dịch</div>
                  <div className="txd-page-nums">
                    <button className="txd-page-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>‹</button>
                    {pageNums.map(n => (
                      <button key={n} className={`txd-page-btn ${n === safePage ? "active" : ""}`} onClick={() => setCurrentPage(n)}>{n}</button>
                    ))}
                    <button className="txd-page-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>›</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* AI Intelligence Horizontal Panel (Desktop Bottom) */}
        <div className="txd-ai-footer-wrap">
          <AiIntelligencePanel
            monthlySeries={monthlySeries}
            anomalies={anomalies}
            aiSuggestions={aiSuggestions}
            showAllTips={showAllTips}
            setShowAllTips={setShowAllTips}
            loading={loading}
            formatAnomalyTip={formatAnomalyTip}
            IcSparkle={IcSparkle}
            IcTrendUp={IcTrendUp}
            IcTrendDown={IcTrendDown}
            IcAlert={IcAlert}
            IcLightbulb={IcLightbulb}
            categoryStats={categoryStats.map(([name, amt]) => ({ name, amt }))}
            transactions={transactions}
            setSelectedTx={setSelectedTx}
            setActiveModal={setActiveModal}
            IcEye={IcEye}
          />
        </div>
      </div>
    );
  };

  /* ─── RENDER MOBILE ─── */
  const renderMobile = () => {
    const DotsIcon = getCatMeta("Khác").SvgIcon;
    return (
      <section className="tx-page mobile-white-theme">
        {/* ===== TOP HEADER (Clean) ===== */}
        <div className="tx-top-header">
          <h1 className="tx-title">Giao dịch</h1>
          <div className="tx-header-actions">
            <button className="tx-btn-ocr" type="button" onClick={() => setActiveModal("ocr")}>
              <IcOcr /> OCR
            </button>
            <button className="tx-btn-add" type="button" onClick={() => {
              setCreateType("expense"); setCreateCategoryId("");
              setCreateDate(filters.end || toInputDate(new Date()));
              setCreateAmount(""); setCreateDesc(""); setCreateTagIds([]);
              setActiveModal("add");
            }}>
              <IcAdd /> Thêm
            </button>
          </div>
        </div>

        {/* ===== PAYMENT TABS + DATE RANGE ===== */}
        <div className="tx-tabs-row white-bg-row">
          <div className="tx-payment-tabs">
            {[
              { value: "all", label: "Tất cả" },
              ...accounts.map(acc => ({ value: String(acc.id), label: acc.name }))
            ].map((tab) => (
              <button
                key={tab.value}
                className={`tx-tab ${paymentFilter === tab.value ? "active" : ""}`}
                type="button"
                onClick={() => setPaymentFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button className="tx-date-btn" type="button" onClick={() => setActiveModal("dateRange")}>
            <IcCalendar />
            <span>{dateRangeLabel}</span>
            <IcChevronDown />
          </button>
        </div>

        {/* ===== SUMMARY CARDS (White Theme) ===== */}
        <div className="tx-summary-cards white-cards">
          <div className="tx-sum-card income white">
            <div className="tx-sum-icon income"><IcIncome /></div>
            <div>
              <p className="tx-sum-label">Tổng thu</p>
              <p className="tx-sum-amount income">{currency(totalIncome)}</p>
              <p className="tx-sum-meta"><span className="up">↑</span> {filtered.filter(i => i.transaction_type === "income").length} giao dịch</p>
            </div>
          </div>
          <div className="tx-sum-card expense white">
            <div className="tx-sum-icon expense"><IcExpense /></div>
            <div>
              <p className="tx-sum-label">Tổng chi</p>
              <p className="tx-sum-amount expense">{currency(totalExpense)}</p>
              <p className="tx-sum-meta"><span className="down">↓</span> {filtered.filter(i => i.transaction_type === "expense").length} giao dịch</p>
            </div>
          </div>
          <div className="tx-sum-card count white">
            <div className="tx-sum-icon count"><IcTx /></div>
            <div>
              <p className="tx-sum-label">Số giao dịch</p>
              <p className="tx-sum-amount count">{filtered.length}</p>
              <p className="tx-sum-meta"><span className="up">↑</span> {categories.length} danh mục</p>
            </div>
          </div>
        </div>

        {/* ===== CATEGORY SECTION (Sorted & Paginated) ===== */}
        <div className="tx-mobile-cat-section">
          <div className="tx-m-sec-head">
            <h3 className="tx-m-sec-title">Danh mục</h3>
            <div className="tx-m-sort-toggle">
              <button className={catSort === "az" ? "active" : ""} onClick={() => { setCatSort("az"); setCatPage(0); }}>A-Z</button>
              <button className={catSort === "pct" ? "active" : ""} onClick={() => { setCatSort("pct"); setCatPage(0); }}>%</button>
            </div>
          </div>

          {(() => {
            const catAmounts = categoryStats.map(([name]) => {
              const amt = sorted.filter((i) => (i.categoryLabel || "Khác") === name)
                .reduce((s, i) => s + (i.transaction_type === "income" ? i.amount : -i.amount), 0);
              return { name, amt, count: categoryStats.find(s => s[0] === name)[1] };
            });
            const sortedCats = [...catAmounts].sort((a, b) =>
              catSort === "az" ? a.name.localeCompare(b.name, "vi") : Math.abs(b.amt) - Math.abs(a.amt)
            );

            const limit = 5;
            const hasMoreCats = sortedCats.length > limit;
            const displayCats = (showAllCatsMobile || !hasMoreCats) ? sortedCats : sortedCats.slice(0, limit);

            return (
              <div className="tx-cats-scroll-container">
                <div className="tx-cats-row-scrollable">
                  {displayCats.map(({ name, amt, count }) => {
                    const meta = getCatMeta(name);
                    return (
                      <button
                        key={name}
                        className={`tx-cat-icon-btn ${categoryFilter === name ? "selected" : ""}`}
                        type="button"
                        onClick={() => setCategoryFilter(categoryFilter === name ? "" : name)}
                      >
                        <div className="tx-cat-bubble" style={{ background: meta.gradient || meta.bg, color: "#fff" }}>
                          <meta.SvgIcon size={22} />
                          <span className="tx-cat-count">{count}</span>
                        </div>
                        <p className="tx-cat-name">{name}</p>
                        <p className="tx-cat-amount" style={{ color: meta.bg }}>{currency(Math.abs(amt))}</p>
                      </button>
                    );
                  })}
                  {hasMoreCats && !showAllCatsMobile && (
                    <button className="tx-cat-more-btn" onClick={() => setShowAllCatsMobile(true)}>
                      <div className="tx-cat-bubble-more">
                        <span>...</span>
                      </div>
                      <p className="tx-cat-name">Thêm</p>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
          <button className="tx-add-btn-m" onClick={() => setActiveModal("addCategory")}>+ Thêm danh mục</button>
        </div>

        {/* ===== TAGS SECTION (Paginated) ===== */}
        <div className="tx-mobile-tags-section">
          <h3 className="tx-m-sec-title">Nhãn</h3>
          {(() => {
            const limit = 8;
            const hasMoreTags = tags.length > limit;
            const displayTags = (showAllTagsMobile || !hasMoreTags) ? tags : tags.slice(0, limit);

            return (
              <div className="tx-m-tags-scroll-container">
                <div className="tx-m-tags-row-scrollable">
                  {displayTags.map(tag => (
                    <button
                      key={tag.id}
                      className={`tx-tag-chip ${tagFilter === String(tag.id) ? "active" : ""}`}
                      style={tagFilter === String(tag.id) ? { background: tag.color, color: "#fff" } : { borderColor: tag.color, color: tag.color }}
                      onClick={() => setTagFilter(tagFilter === String(tag.id) ? "" : String(tag.id))}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {hasMoreTags && !showAllTagsMobile && (
                    <button className="tx-tag-chip-more" onClick={() => setShowAllTagsMobile(true)}>
                      ...
                    </button>
                  )}
                  {tags.length === 0 && <p className="tx-empty-text">Chưa có nhãn nào</p>}
                </div>
              </div>
            );
          })()}
          <button className="tx-add-btn-m" onClick={() => setActiveModal("addTag")}>+ Thêm nhãn</button>
        </div>

        {/* ===== FILTER ROW (Web Style Pills) ===== */}
        <div className="tx-mobile-pills-filter">
          <div className="tx-pill-f">
            <span>Loại</span>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="income">Thu nhập</option>
              <option value="expense">Chi tiêu</option>
            </select>
          </div>
          <div className="tx-pill-f">
            <span>Danh mục</span>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">Tất cả</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="tx-pill-f">
            <span>Sắp xếp</span>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* ===== GROUPED TRANSACTION LIST (Beautified) ===== */}
        <div className="tx-group-list premium-list">
          {!sorted.length ? (
            <div className="tx-empty">
              <p>Chưa có giao dịch nào trong khoảng thời gian này.</p>
            </div>
          ) : (
            grouped.map(({ cat, items, total }) => {
              const meta = getCatMeta(cat);
              const isExpanded = expandedGroups[cat] !== false;
              return (
                <div key={cat} className="tx-group-premium">
                  <button className="tx-group-header-p" onClick={() => toggleGroup(cat)}>
                    <div className="tx-gp-icon-p" style={{ background: meta.light, color: meta.bg }}>
                      <meta.SvgIcon size={18} />
                    </div>
                    <div className="tx-gp-info-p">
                      <span className="tx-gp-name-p">{cat}</span>
                      <span className="tx-gp-count-p">{items.length} giao dịch</span>
                    </div>
                    <div className="tx-gp-total-p" style={{ color: total >= 0 ? "#10b981" : "#ef4444" }}>
                      {total >= 0 ? "+" : ""}{currency(total)}
                    </div>
                    <span className={`tx-gp-arrow-p ${isExpanded ? "up" : ""}`}>
                      <IcChevronDown />
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="tx-gp-items-p">
                      {items.map((item) => {
                        const payTag = getPaymentTag(item);
                        const isIncome = item.transaction_type === "income";
                        return (
                          <div key={item.id} className="tx-item-p" onClick={() => { setSelectedTx(item); setActiveModal("detail"); }}>
                            <div className="tx-item-main-p">
                              <p className="tx-item-desc-p">{item.description || item.categoryLabel || "Giao dịch"}</p>
                              <div className="tx-item-sub-p">
                                {item.date?.split("-").reverse().join("/")}
                                {payTag && <span className="tx-item-tag-p"> · {payTag.name}</span>}
                              </div>
                              <div className="tx-item-tags-m">
                                {(item.tags || []).filter(t => t.name !== "Tiền mặt" && t.name !== "Ngân hàng").map(t => (
                                  <span key={t.id} className="tx-m-tag-p" style={{ background: t.color }}>{t.name}</span>
                                ))}
                              </div>
                            </div>
                            <div className="tx-item-right-p">
                              <p className={`tx-item-amt-p ${isIncome ? "income" : "expense"}`}>
                                {isIncome ? "+" : "-"}{currency(item.amount)}
                              </p>
                              <div className="tx-item-chevron-p"><IcChevronDown style={{ transform: 'rotate(-90deg)' }} /></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {(() => {
            const CATS_PER_PAGE = sorted.length > 30 ? 3 : 5;
            const totalPages = Math.max(1, Math.ceil(grouped.length / CATS_PER_PAGE));
            if (totalPages <= 1) return null;

            return (
              <div className="tx-m-list-pagination">
                <button
                  className="tx-pg-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <IcChevronDown style={{ transform: 'rotate(90deg)' }} />
                </button>
                <div className="tx-pg-info">
                  <span className="current">Trang {currentPage}</span>
                  <span className="total">/ {totalPages}</span>
                </div>
                <button
                  className="tx-pg-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <IcChevronDown style={{ transform: 'rotate(-90deg)' }} />
                </button>
              </div>
            );
          })()}
        </div>

        {/* AI Panel (Mobile) */}
        <div className="tx-mobile-ai-footer">
          <AiIntelligencePanel
            monthlySeries={monthlySeries}
            anomalies={anomalies}
            aiSuggestions={aiSuggestions}
            showAllTips={showAllTips}
            setShowAllTips={setShowAllTips}
            loading={loading}
            formatAnomalyTip={formatAnomalyTip}
            IcSparkle={IcSparkle}
            IcTrendUp={IcTrendUp}
            IcTrendDown={IcTrendDown}
            IcAlert={IcAlert}
            IcLightbulb={IcLightbulb}
            categoryStats={categoryStats.map(([name, amt]) => ({ name, amt }))}
            transactions={transactions}
            setSelectedTx={setSelectedTx}
            setActiveModal={setActiveModal}
            IcEye={IcEye}
          />
        </div>
      </section>
    );
  };

  /* ─── MAIN RENDER RETURN ─── */
  return (
    <>
      {isDesktop ? renderDesktop() : renderMobile()}

      {/* ===================================
          MODALS
      =================================== */}

      {/* --- ADD CATEGORY MODAL --- */}
      {activeModal === "addCategory" && (
        <div className="txm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}>
          <div className="txm-dialog">
            <div className="txm-dialog-header">
              <h3>Thêm danh mục</h3>
              <button className="txm-close-btn" type="button" onClick={() => setActiveModal(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="txm-body">
              <div className="txm-field">
                <label>1. Tên danh mục</label>
                <input
                  className="txm-input"
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="Ví dụ: Học tập"
                />
              </div>

              <div className="txm-field">
                <label>2. Biểu tượng</label>
                <div className="txm-icon-grid">
                  {CAT_ICON_OPTIONS.map(key => {
                    const meta = CAT_ICONS[key];
                    if (!meta) return null;
                    const SvgIcon = meta.SvgIcon;
                    const isActive = newCatIconKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`txm-icon-btn ${isActive ? "active" : ""}`}
                        style={isActive ? { borderColor: newCatColor, background: newCatColor + "18" } : {}}
                        onClick={() => setNewCatIconKey(key)}
                        title={key}
                      >
                        <span style={{ color: isActive ? newCatColor : meta.bg }}>
                          <SvgIcon size={22} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="txm-field">
                <label>3. Màu biểu tượng</label>
                <div className="txm-color-row">
                  {["#ec4899", "#10b981", "#f97316", "#f59e0b", "#a855f7", "#e879f9", "#94a3b8", "#6b7280", "#22c55e", "#84cc16"].map(c => (
                    <button
                      key={c} type="button"
                      className={`txm-color-dot ${newCatColor === c ? "active" : ""}`}
                      style={{ background: c }}
                      onClick={() => setNewCatColor(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="txm-field">
                <label>Xem trước</label>
                <div className="txm-preview">
                  {(() => {
                    const meta = CAT_ICONS[newCatIconKey];
                    const SvgIcon = meta?.SvgIcon;
                    return (
                      <div className="txm-preview-icon" style={{ background: newCatColor + "20", color: newCatColor }}>
                        {SvgIcon && <SvgIcon size={24} />}
                      </div>
                    );
                  })()}
                  <span className="txm-preview-name">{newCatName || "Tên danh mục"}</span>
                </div>
              </div>
            </div>

            <div className="txm-footer">
              <button className="txm-btn-cancel" type="button" onClick={() => setActiveModal(null)}>Hủy</button>
              <button
                className="txm-btn-save"
                type="button"
                disabled={!newCatName.trim() || loading}
                onClick={async () => {
                  if (!newCatName.trim() || !onCreateCategory) return;
                  await onCreateCategory(newCatName.trim());
                  setNewCatName(""); setActiveModal(null);
                }}
              >Lưu danh mục</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD TAG MODAL --- */}
      {activeModal === "addTag" && (
        <div className="txm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}>
          <div className="txm-dialog txm-dialog-sm">
            <div className="txm-dialog-header">
              <h3>Thêm nhãn</h3>
              <button className="txm-close-btn" type="button" onClick={() => setActiveModal(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="txm-body">
              <div className="txm-field">
                <label>Tên nhãn</label>
                <input
                  className="txm-input"
                  type="text"
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder="Ví dụ: Công việc"
                />
              </div>

              <div className="txm-field">
                <label>Màu nhãn</label>
                <div className="txm-color-row">
                  {["#ec4899", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#a855f7", "#e879f9", "#94a3b8", "#6b7280"].map(c => (
                    <button
                      key={c} type="button"
                      className={`txm-color-dot ${newTagColor === c ? "active" : ""}`}
                      style={{ background: c }}
                      onClick={() => setNewTagColor(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="txm-field">
                <label>Xem trước</label>
                <div className="txm-tag-preview-area">
                  <span
                    className="txm-tag-preview-pill"
                    style={{ background: newTagColor, color: "#fff" }}
                  >
                    {newTagName || "Tên nhãn"}
                  </span>
                </div>
              </div>
            </div>

            <div className="txm-footer">
              <button className="txm-btn-cancel" type="button" onClick={() => setActiveModal(null)}>Hủy</button>
              <button
                className="txm-btn-save"
                type="button"
                disabled={!newTagName.trim() || loading}
                onClick={async () => {
                  if (!newTagName.trim() || !onCreateTag) return;
                  await onCreateTag({ name: newTagName.trim(), color: newTagColor });
                  setNewTagName(""); setActiveModal(null);
                }}
              >Lưu nhãn</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DATE RANGE PICKER --- */}
      {activeModal === "dateRange" && (
        <div className="tx-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}>
          <div className="tx-sheet-body">
            <div className="tx-sheet-header">
              <h3>Chọn khoảng thời gian</h3>
              <button className="tx-icon-close" type="button" onClick={() => setActiveModal(null)}><IcClose /></button>
            </div>
            <div className="tx-date-quick-btns">
              {[
                { label: "Hôm nay", days: 0 },
                { label: "7 ngày", days: 7 },
                { label: "30 ngày", days: 30 },
              ].map((q) => (
                <button
                  key={q.label}
                  className="tx-quick-date-btn"
                  type="button"
                  onClick={() => {
                    const end = toInputDate(new Date());
                    const start = q.days === 0 ? end : toInputDate(new Date(Date.now() - q.days * 86400000));
                    onFiltersChange({ ...filters, start, end });
                    setActiveModal(null);
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <div className="tx-date-range-inputs">
              <label className="tx-field">
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={filters.start || ""}
                  onChange={(e) => onFiltersChange({ ...filters, start: e.target.value })}
                />
              </label>
              <label className="tx-field">
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={filters.end || ""}
                  onChange={(e) => onFiltersChange({ ...filters, end: e.target.value })}
                />
              </label>
            </div>
            <div className="tx-sheet-actions">
              <button className="tx-btn-secondary" type="button" onClick={() => setActiveModal(null)}>Đóng</button>
              <button className="tx-btn-primary" type="button" onClick={() => setActiveModal(null)}>Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD TRANSACTION --- */}
      {activeModal === "add" && (
        <div className="tx-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}>
          <div className="tx-sheet-body tx-sheet-wide">
            <div className="tx-sheet-header">
              <h3>Thêm giao dịch</h3>
              <button className="tx-icon-close" type="button" onClick={() => setActiveModal(null)}><IcClose /></button>
            </div>

            <form className="tx-form" onSubmit={handleCreate}>
              {/* Type tabs */}
              <div className="tx-type-tabs">
                <button
                  className={`tx-type-tab ${createType === "expense" ? "active expense" : ""}`}
                  type="button"
                  onClick={() => setCreateType("expense")}
                >Chi tiêu</button>
                <button
                  className={`tx-type-tab ${createType === "income" ? "active income" : ""}`}
                  type="button"
                  onClick={() => setCreateType("income")}
                >Thu nhập</button>
              </div>

              <label className="tx-field">
                <span>Mô tả</span>
                <input type="text" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="Mô tả giao dịch..." required />
              </label>

              <div className="tx-row-2">
                <label className="tx-field">
                  <span>Số tiền</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(formatNumberInput(e.target.value))}
                    placeholder="0"
                    required
                  />
                  {createAmount && <small className="tx-hint">{currency(parseNumberInput(createAmount))}</small>}
                </label>
                <label className="tx-field">
                  <span>Ngày</span>
                  <input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} required />
                </label>
              </div>

              <label className="tx-field">
                <span>Danh mục</span>
                <div className="tx-cat-picker">
                  <button
                    type="button"
                    className={`tx-cat-pill ${!createCategoryId ? "selected" : ""}`}
                    onClick={() => setCreateCategoryId("")}
                  >Không</button>
                  {categories.map((cat) => {
                    const meta = getCatMeta(cat.name);
                    const sel = String(createCategoryId) === String(cat.id);
                    const iconStyle = sel
                      ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                      : { background: meta.light, color: meta.bg };
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`tx-cat-pill ${sel ? "selected" : ""}`}
                        style={sel ? { background: meta.bg, color: "#fff", border: `2px solid ${meta.bg}` } : {}}
                        onClick={() => setCreateCategoryId(String(cat.id))}
                      >
                        <span className="tx-cat-pill-icon" style={iconStyle}>
                          <meta.SvgIcon size={14} />
                        </span>
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="tx-pay-section">
                <span>Phương thức thanh toán</span>
                <div className="tx-pay-picker">
                  {accounts.map((acc) => {
                    const sel = String(createAccountId) === String(acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        className={`tx-pay-btn ${sel ? "selected" : ""}`}
                        style={sel ? { borderColor: "#3b82f6", background: "#eff6ff", color: "#1d4ed8" } : {}}
                        onClick={() => setCreateAccountId(sel ? "" : String(acc.id))}
                      >
                        {acc.type === "cash" ? "💵" : "💳"} {acc.name}
                      </button>
                    );
                  })}
                  {accounts.length === 0 && <p className="tx-hint">Chưa có tài khoản nào. <button type="button" className="tx-link">Thêm ngay</button></p>}
                </div>
              </div>

              <div className="tx-tags-section-f">
                <span>Nhãn (Tags)</span>
                <div className="tx-tags-picker-f">
                  {tags.map(tag => {
                    const sel = createTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`tx-tag-chip-f ${sel ? "selected" : ""}`}
                        style={sel ? { background: tag.color, color: "#fff" } : { borderColor: tag.color, color: tag.color }}
                        onClick={() => {
                          if (sel) setCreateTagIds(p => p.filter(id => id !== tag.id));
                          else setCreateTagIds(p => [...p, tag.id]);
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                  <button type="button" className="tx-add-tag-inline" onClick={() => setActiveModal("addTag")}>+ Mới</button>
                </div>
              </div>

              <div className="tx-sheet-actions">
                <button className="tx-btn-secondary" type="button" onClick={() => setActiveModal(null)}>Hủy</button>
                <button className="tx-btn-primary" type="submit" disabled={loading}>Lưu giao dịch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT TRANSACTION --- */}
      {activeModal === "edit" && editingTx && (
        <div className="tx-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) { setActiveModal(null); setEditingTx(null); } }}>
          <div className="tx-sheet-body tx-sheet-wide">
            <div className="tx-sheet-header">
              <h3>Chỉnh sửa giao dịch</h3>
              <button className="tx-icon-close" type="button" onClick={() => { setActiveModal(null); setEditingTx(null); }}><IcClose /></button>
            </div>
            <form className="tx-form" onSubmit={handleUpdate}>
              <label className="tx-field">
                <span>Mô tả</span>
                <input name="description" type="text" defaultValue={editingTx.description} required />
              </label>

              <div className="tx-row-2">
                <label className="tx-field">
                  <span>Số tiền</span>
                  <input
                    name="amount"
                    type="text"
                    inputMode="numeric"
                    value={editAmount}
                    onChange={(e) => setEditAmount(formatNumberInput(e.target.value))}
                    required
                  />
                </label>
                <label className="tx-field">
                  <span>Ngày</span>
                  <input name="date" type="date" defaultValue={editingTx.date} required />
                </label>
              </div>

              <div className="tx-row-2">
                <label className="tx-field">
                  <span>Loại</span>
                  <select name="transaction_type" defaultValue={editingTx.transaction_type}>
                    <option value="expense">Chi tiêu</option>
                    <option value="income">Thu nhập</option>
                  </select>
                </label>
                <label className="tx-field">
                  <span>Danh mục</span>
                  <select name="category_id" defaultValue={editingTx.category_id || ""}>
                    <option value="">Không</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="tx-pay-section">
                <span>Phương thức thanh toán</span>
                <div className="tx-pay-picker">
                  {accounts.map((acc) => {
                    const sel = String(editAccountId) === String(acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        className={`tx-pay-btn ${sel ? "selected" : ""}`}
                        style={sel ? { borderColor: "#3b82f6", background: "#eff6ff", color: "#1d4ed8" } : {}}
                        onClick={() => setEditAccountId(sel ? "" : String(acc.id))}
                      >
                        {acc.type === "cash" ? "💵" : "💳"} {acc.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="tx-tags-section-f">
                <span>Nhãn (Tags)</span>
                <div className="tx-tags-picker-f">
                  {tags.map(tag => {
                    const sel = editTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`tx-tag-chip-f ${sel ? "selected" : ""}`}
                        style={sel ? { background: tag.color, color: "#fff" } : { borderColor: tag.color, color: tag.color }}
                        onClick={() => {
                          if (sel) setEditTagIds(p => p.filter(id => id !== tag.id));
                          else setEditTagIds(p => [...p, tag.id]);
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="tx-sheet-actions">
                <button
                  className="tx-btn-danger"
                  type="button"
                  onClick={() => {
                    if (window.confirm("Xóa giao dịch này?")) {
                      onDelete(editingTx.id);
                      setEditingTx(null); setActiveModal(null);
                    }
                  }}
                >Xóa</button>
                <button className="tx-btn-secondary" type="button" onClick={() => { setActiveModal(null); setEditingTx(null); }}>Hủy</button>
                <button className="tx-btn-primary" type="submit" disabled={loading}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DETAIL --- */}
      {activeModal === "detail" && selectedTx && (
        <div className="tx-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) { setActiveModal(null); setSelectedTx(null); } }}>
          <div className="tx-sheet-body">
            <div className="tx-sheet-header">
              <h3>Chi tiết giao dịch</h3>
              <button className="tx-icon-close" type="button" onClick={() => { setActiveModal(null); setSelectedTx(null); }}><IcClose /></button>
            </div>
            {(() => {
              const meta = getCatMeta(selectedTx.categoryLabel || "Khác");
              const isIncome = selectedTx.transaction_type === "income";
              const acc = accounts.find(a => a.id === selectedTx.account_id);
              const txTags = selectedTx.tags || [];

              return (
                <div className="tx-detail white-theme-detail">
                  <div className="tx-detail-hero">
                    <div className="tx-detail-cat-icon" style={{ background: meta.gradient || meta.bg, color: "#fff" }}>
                      <meta.SvgIcon size={28} />
                    </div>
                    <div className="tx-detail-main-info">
                      <p className="tx-det-desc">{selectedTx.description || "Giao dịch"}</p>
                      <p className="tx-det-cat-name">{selectedTx.categoryLabel || "Chưa phân loại"}</p>
                      <p className={`tx-det-amount ${isIncome ? "income" : "expense"}`}>
                        {isIncome ? "+" : "-"}{currency(selectedTx.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="tx-detail-rows">
                    <div className="tx-det-row">
                      <span>Ngày</span>
                      <span className="val">{selectedTx.date?.split("-").reverse().join("/")}</span>
                    </div>
                    <div className="tx-det-row">
                      <span>Loại</span>
                      <span className="val">{isIncome ? "Thu nhập" : "Chi tiêu"}</span>
                    </div>
                    <div className="tx-det-row">
                      <span>Thanh toán</span>
                      <span className="val">
                        <span className={`src-badge ${acc?.type === "credit" ? "bank" : "cash"}`}>
                          {acc ? acc.name : "Tiền mặt"}
                        </span>
                      </span>
                    </div>
                    {txTags.length > 0 && (
                      <div className="tx-det-row tags-row">
                        <span>Nhãn</span>
                        <div className="tx-det-tags">
                          {txTags.map(t => (
                            <span key={t.id} className="tx-tag-pill" style={{ background: t.color }}>{t.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="tx-sheet-actions">
                    <button className="tx-btn-secondary" type="button" onClick={() => { setActiveModal(null); setSelectedTx(null); }}>Đóng</button>
                    <button
                      className="tx-btn-primary"
                      type="button"
                      onClick={() => { setEditingTx(selectedTx); setSelectedTx(null); setActiveModal("edit"); }}
                    >Chỉnh sửa</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* --- OCR --- */}
      {activeModal === "ocr" && (
        <div className="tx-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}>
          <div className="tx-sheet-body tx-sheet-wide">
            <div className="tx-sheet-header">
              <h3>Nhập hóa đơn (OCR)</h3>
              <button className="tx-icon-close" type="button" onClick={() => setActiveModal(null)}><IcClose /></button>
            </div>
            <OcrScreen
              categories={categories}
              accounts={accounts}
              tags={tags}
              userEmail={userEmail}
              onCreateCategory={onCreateCategory}
              onCreateTag={onCreateTag}
              onCreateTransaction={onCreateTransaction}
              onCreateBill={onCreateBill}
              loading={loading}
              embedded
            />
          </div>
        </div>
      )}
      {isImageModalOpen && selectedTx?.image_path && (
        <div className="tx-modal-overlay" onClick={() => setIsImageModalOpen(false)}>
          <div className="tx-modal-content" onClick={e => e.stopPropagation()}>
            <button className="tx-modal-close" onClick={() => setIsImageModalOpen(false)}>&times;</button>
            <img
              src={`${getBaseUrl()}${selectedTx.image_path}`}
              alt="Hóa đơn phóng lớn"
            />
          </div>
        </div>
      )}
    </>
  );

  return isDesktop ? renderDesktop() : renderMobile();
}
