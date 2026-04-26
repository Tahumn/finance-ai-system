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
import { t } from "../../utils/i18n.js";
import { getCatMeta } from "../../utils/categoryIcons.jsx";
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

/* Format date range label */
const formatRangeLabel = (start, end) => {
  if (!start && !end) return "Chọn thời gian";
  const fmt = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };
  if (start === end || !end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
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
}) {
  /* modals */
  const [activeModal, setActiveModal] = useState(null); // "add" | "ocr" | "edit" | "detail" | "dateRange"
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);

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
  const [createDate, setCreateDate] = useState(() => toInputDate(new Date()));
  const [createAmount, setCreateAmount] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createTagIds, setCreateTagIds] = useState([]);

  /* edit-form state */
  const [editAmount, setEditAmount] = useState("");
  const [editTagIds, setEditTagIds] = useState([]);

  /* tag input */
  const [tagInput, setTagInput] = useState("");

  /* UI state */
  const [paymentFilter, setPaymentFilter] = useState("all"); // "all" | "cash" | "bank"
  const [typeFilter, setTypeFilter] = useState(""); // "" | "income" | "expense"
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [searchText, setSearchText] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showAllGroups, setShowAllGroups] = useState({});
  const [dateRangeLabel, setDateRangeLabel] = useState(() => formatRangeLabel(filters.start, filters.end));
  const [showQuickCategoryForm, setShowQuickCategoryForm] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");

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
    if (!editingTx) { setEditTagIds([]); setEditAmount(""); return; }
    const nextTags = Array.isArray(editingTx.tags) ? editingTx.tags.map((t) => t.id).filter(Boolean) : [];
    setEditTagIds(nextTags);
    setEditAmount(formatNumberInput(editingTx.amount));
  }, [editingTx]);

  /* filtered + sorted transactions */
  const filtered = useMemo(() => {
    return transactions.filter((item) => {
      if (typeFilter && item.transaction_type !== typeFilter) return false;
      if (categoryFilter && (item.categoryLabel || "Khác") !== categoryFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!item.description?.toLowerCase().includes(q)) return false;
      }
      if (paymentFilter === "cash") {
        return Array.isArray(item.tags) && item.tags.some((t) => t.name === "Tiền mặt");
      }
      if (paymentFilter === "bank") {
        return Array.isArray(item.tags) && item.tags.some((t) => t.name === "Ngân hàng");
      }
      if (paymentFilter === "ewallet") {
        return (
          Array.isArray(item.tags) &&
          item.tags.some((t) => {
            const lower = String(t.name || "").toLowerCase();
            return lower.includes("ví") || lower.includes("momo");
          })
        );
      }
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, searchText, paymentFilter, filters.start, filters.end]);

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
    }));
  }, [sorted]);

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
      date: createDate,
      tag_ids: createTagIds,
    });
    setCreateDesc(""); setCreateAmount(""); setCreateDate(toInputDate(new Date()));
    setCreateCategoryId(""); setCreateTagIds([]); setTagInput(""); setActiveModal(null);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const category = form.get("category_id");
    onUpdate(editingTx.id, {
      description: form.get("description"),
      amount: parseNumberInput(editAmount),
      transaction_type: form.get("transaction_type"),
      category_id: category ? Number(category) : null,
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
    const sortedGroups = Object.entries(grouped);

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
              <div className="txd-kpi-icon income"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></div>
              <div className="txd-kpi-text">
                 <div className="txd-kpi-label">Tổng thu</div>
                 <div className="txd-kpi-value income">{currency(totalIncome)}</div>
                 <div className="txd-kpi-meta"><span className="up">↑ {filtered.filter(i => i.transaction_type === "income").length}</span> giao dịch thu nhập</div>
              </div>
           </div>
           <div className="txd-kpi-card">
              <div className="txd-kpi-icon expense"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>
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
                   <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                 </svg>
                 <input 
                   type="text" 
                   placeholder="Tìm kiếm giao dịch..." 
                   value={searchText}
                   onChange={(e) => setSearchText(e.target.value)} 
                 />
              </div>

              <div className="txd-sidebar-cat">
                 <div className="txd-sb-head">
                   <h3 className="txd-sb-title">Tổng quan theo danh mục</h3>
                   <button
                     type="button"
                     className="txd-add-cat-btn"
                     onClick={() => setShowQuickCategoryForm((s) => !s)}
                   >
                     + Danh mục
                   </button>
                 </div>
                 {showQuickCategoryForm && (
                   <div className="txd-quick-cat-form">
                     <input
                       type="text"
                       value={quickCategoryName}
                       onChange={(e) => setQuickCategoryName(e.target.value)}
                       placeholder="Tên danh mục mới..."
                     />
                     <button
                       type="button"
                       onClick={async () => {
                         const val = quickCategoryName.trim();
                         if (!val || !onCreateCategory) return;
                         await onCreateCategory(val);
                         setQuickCategoryName("");
                         setShowQuickCategoryForm(false);
                       }}
                     >
                       Lưu
                     </button>
                   </div>
                 )}
                 <div className="txd-cat-list">
                    {categoryStats.map(([name, count]) => {
                       const meta = getCatMeta(name);
                       const amt = sorted.filter((i) => (i.categoryLabel || "Khác") === name).reduce((s, i) => s + (i.transaction_type === "income" ? i.amount : -i.amount), 0);
                       // Mock percentage based on max value for visual matching
                       const maxAmt = Math.max(...categoryStats.map(([n]) => Math.abs(sorted.filter((i) => (i.categoryLabel || "Khác") === n).reduce((s, i) => s + (i.transaction_type === "income" ? i.amount : -i.amount), 0))));
                       const pct = maxAmt ? (Math.abs(amt) / maxAmt * 46.7).toFixed(1) : 0;
                       
                       return (
                         <div key={name} className={`txd-cat-item-pro ${categoryFilter === name ? "active" : ""}`} onClick={() => setCategoryFilter(categoryFilter === name ? "" : name)}>
                            <div className="txd-cip-icon" style={{background: meta.light, color: meta.bg}}><meta.SvgIcon size={18} /></div>
                            <div className="txd-cip-info">
                               <div className="txd-cip-name">{name}</div>
                               <div className="txd-cip-amt">{currency(Math.abs(amt))}</div>
                            </div>
                            <div className="txd-cip-pct">{pct}%</div>
                         </div>
                       );
                    })}
                 </div>
              </div>
           </div>

           {/* Right Column (List + Filters) */}
           <div className="txd-col-right">
              <div className="txd-filters-bar">
                 <div className="txd-pay-tabs">
                   {[
                     { value: "all", label: "Tất cả" },
                     { value: "cash", label: "Tiền mặt" },
                     { value: "bank", label: "Ngân hàng" },
                     { value: "ewallet", label: "Ví điện tử" },
                   ].map(t => (
                     <button 
                       key={t.value}
                       className={`txd-pay-tab ${paymentFilter === t.value ? "active" : ""}`}
                       onClick={() => setPaymentFilter(t.value)}
                     >
                       {t.label}
                     </button>
                   ))}
                 </div>
                 <div className="txd-filter-selectors">
                    <div className="txd-fsel">
                       <span>Loại:</span>
                       <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                         <option value="">Tất cả</option>
                         <option value="income">Thu nhập</option>
                         <option value="expense">Chi tiêu</option>
                       </select>
                    </div>
                    <div className="txd-fsel">
                       <span>Danh mục:</span>
                       <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                         <option value="">Tất cả</option>
                         {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                       </select>
                    </div>
                    <div className="txd-fsel">
                       <span>Sắp xếp:</span>
                       <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                         {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                       </select>
                    </div>
                    <button className="txd-btn-filter-icon"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg></button>
                 </div>
              </div>

              <div className="txd-list-container">
                 <div className="txd-list-header">
                    <div className="lh-col">Giao dịch</div>
                    <div className="lh-col">Ghi chú / Thương nhân</div>
                    <div className="lh-col">Ngày</div>
                    <div className="lh-col">Nguồn tiền</div>
                    <div className="lh-col">Danh mục</div>
                    <div className="lh-col amount">Số tiền</div>
                 </div>
                 
                 <div className="txd-groups">
                    {sortedGroups.map(([catName, data]) => {
                       const isExpanded = expandedGroups[catName] !== false; // Default Open
                       const meta = getCatMeta(catName);
                       return (
                          <div key={catName} className="txd-group-pro">
                             <button className="txd-gp-head" onClick={() => toggleGroup(catName)}>
                                <div className="txd-gph-icon" style={{color: meta.bg}}><meta.SvgIcon size={18}/></div>
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
                                      const isBank = (tx.tagLabels || []).some(t => String(t).toLowerCase().includes("ngân hàng"));
                                      const isEWallet = (tx.tagLabels || []).some(t => String(t).toLowerCase().includes("ví") || String(t).toLowerCase().includes("momo"));
                                      
                                      let sourceText = "Tiền mặt";
                                      let sourceClass = "cash";
                                      if (isBank) { sourceText = "Thẻ tín dụng"; sourceClass = "bank"; }
                                      if (isEWallet) { sourceText = "Ví MoMo"; sourceClass = "ewallet"; }
                                      
                                      return (
                                        <div key={tx.id || tx.description} className="txd-list-row" onClick={() => setSelectedTx(tx)}>
                                           <div className="lr-col main">
                                              <div className="lr-icon" style={{background: txMeta.bg, color: "#fff"}}><txMeta.SvgIcon size={14}/></div>
                                              <span className="lr-title">{tx.description || "Giao dịch"}</span>
                                           </div>
                                           <div className="lr-col notes">{tx.notes || "—"}</div>
                                           <div className="lr-col date">{tx.date?.split('-').reverse().join('/')}</div>
                                           <div className="lr-col source"><span className={`src-badge ${sourceClass}`}>{sourceText}</span></div>
                                           <div className="lr-col cat"><span className="cat-badge" style={{color: txMeta.bg, background: txMeta.light}}>{catName}</span></div>
                                           <div className={`lr-col amount ${isIncome ? "income" : "expense"}`}>
                                              {isIncome ? "+" : "-"}{currency(Math.abs(tx.amount))}
                                              <button className="lr-more-btn" onClick={(e) => { e.stopPropagation(); setEditingTx(tx); setEditAmount(tx.amount); setEditTagIds(tx.tagIds || []); setActiveModal("edit"); }}>...</button>
                                           </div>
                                        </div>
                                      );
                                   })}
                                   
                                   {data.items.length > 4 && !showAllGroups[catName] && (
                                      <button className="txd-gp-expand" onClick={() => setShowAllGroups(p => ({...p, [catName]: true}))}>
                                         <span className="expand-arrow">{'>'}</span> Xem tất cả {data.items.length} giao dịch <IcChevronDown/>
                                      </button>
                                   )}
                                </div>
                             )}
                          </div>
                       )
                    })}
                 </div>
              </div>

              <div className="txd-pagination-bar">
                 <div className="txd-page-info">Hiển thị 1 – {Math.min(filtered.length, 10)} trong tổng số {filtered.length} giao dịch</div>
                 <div className="txd-page-nums">
                    <button className="txd-page-btn">{'<'}</button>
                    <button className="txd-page-btn active">1</button>
                    <button className="txd-page-btn">2</button>
                    <button className="txd-page-btn">3</button>
                    <button className="txd-page-btn">5</button>
                    <button className="txd-page-btn">{'>'}</button>
                 </div>
                 <div className="txd-page-size">
                    Hiển thị <select><option>10</option></select> giao dịch / trang
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  /* ─── RENDER MOBILE ─── */
  const renderMobile = () => {
    const DotsIcon = getCatMeta("Khác").SvgIcon;
    return (
      <section className="tx-page">
      {/* ===== TOP HEADER ===== */}
      <div className="tx-top-header">
        <h1 className="tx-title">Giao dịch</h1>
        <div className="tx-header-actions">
          <button
            className="tx-btn-ocr"
            type="button"
            onClick={() => setActiveModal("ocr")}
          >
            <IcOcr />
            OCR
          </button>
          <button
            className="tx-btn-add"
            type="button"
            onClick={() => {
              setCreateType("expense");
              setCreateCategoryId("");
              setCreateDate(filters.end || toInputDate(new Date()));
              setCreateAmount(""); setCreateDesc(""); setCreateTagIds([]);
              setActiveModal("add");
            }}
          >
            <IcAdd />
            Thêm
          </button>
        </div>
      </div>

      {/* ===== SEARCH BAR ===== */}
      <div className="tx-search-wrap">
        <svg className="tx-search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          className="tx-search"
          type="text"
          placeholder="Tìm kiếm giao dịch..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* ===== PAYMENT TABS + DATE RANGE ===== */}
      <div className="tx-tabs-row">
        <div className="tx-payment-tabs">
          {[
            { value: "all", label: "Tất cả" },
            { value: "cash", label: "Tiền mặt" },
            { value: "bank", label: "Ngân hàng" },
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

        <button
          className="tx-date-btn"
          type="button"
          onClick={() => setActiveModal("dateRange")}
        >
          <IcCalendar />
          <span>{dateRangeLabel}</span>
          <IcChevronDown />
        </button>
      </div>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="tx-summary-cards">
        <div className="tx-sum-card income">
          <div className="tx-sum-icon income"><IcIncome /></div>
          <div>
            <p className="tx-sum-label">Tổng thu</p>
            <p className="tx-sum-amount income">{currency(totalIncome)}</p>
            <p className="tx-sum-meta">
              <span className="up">↑</span> {filtered.filter(i => i.transaction_type === "income").length} giao dịch
            </p>
          </div>
        </div>

        <div className="tx-sum-card expense">
          <div className="tx-sum-icon expense"><IcExpense /></div>
          <div>
            <p className="tx-sum-label">Tổng chi</p>
            <p className="tx-sum-amount expense">{currency(totalExpense)}</p>
            <p className="tx-sum-meta">
              <span className="down">↓</span> {filtered.filter(i => i.transaction_type === "expense").length} giao dịch
            </p>
          </div>
        </div>

        <div className="tx-sum-card count">
          <div className="tx-sum-icon count"><IcTx /></div>
          <div>
            <p className="tx-sum-label">Số giao dịch</p>
            <p className="tx-sum-amount count">{filtered.length}</p>
            <p className="tx-sum-meta">
              <span className="up">↑</span> {categories.length} danh mục
            </p>
          </div>
        </div>
      </div>

      {/* ===== CATEGORY ICONS ROW ===== */}
      {categoryStats.length > 0 && (
        <div className="tx-cats-scroll">
          <div className="tx-cats-row">
            {categoryStats.slice(0, 5).map(([name, count]) => {
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
                  <p className="tx-cat-amount" style={{ color: meta.bg }}>
                    {currency(
                      sorted
                        .filter((i) => (i.categoryLabel || "Khác") === name)
                        .reduce((s, i) => s + (i.transaction_type === "income" ? i.amount : -i.amount), 0)
                    )}
                  </p>
                </button>
              );
            })}
            {categoryStats.length > 5 && (
              <div className="tx-cat-icon-btn">
                <div className="tx-cat-bubble" style={{ background: "linear-gradient(135deg,#94a3b8,#475569)", color: "#fff" }}>
                  <DotsIcon size={22} />
                  <span className="tx-cat-count">+{categoryStats.length - 5}</span>
                </div>
                <p className="tx-cat-name">Khác</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== FILTER ROW ===== */}
      <div className="tx-filter-row">
        <div className="tx-filter-item">
          <label className="tx-filter-label">Loại</label>
          <div className="tx-filter-select">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="income">Thu nhập</option>
              <option value="expense">Chi tiêu</option>
            </select>
            <IcChevronDown />
          </div>
        </div>

        <div className="tx-filter-item">
          <label className="tx-filter-label">Danh mục</label>
          <div className="tx-filter-select">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <IcChevronDown />
          </div>
        </div>

        <div className="tx-filter-item">
          <label className="tx-filter-label">Sắp xếp</label>
          <div className="tx-filter-select">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <IcChevronDown />
          </div>
        </div>
      </div>

      {/* ===== GROUPED TRANSACTION LIST ===== */}
      <div className="tx-group-list">
        {!sorted.length ? (
          <div className="tx-empty">
            <p>Không có giao dịch nào</p>
          </div>
        ) : (
          grouped.map(({ cat, items, total }) => {
            const meta = getCatMeta(cat);
            const isExpanded = expandedGroups[cat] !== false; // default expanded
            const PREVIEW = 5;
            const showAll = showAllGroups[cat];
            const displayItems = showAll ? items : items.slice(0, PREVIEW);

            return (
              <div key={cat} className="tx-group">
                {/* Group header */}
                <button
                  className="tx-group-header"
                  type="button"
                  onClick={() => toggleGroup(cat)}
                >
                  <div className="tx-group-icon" style={{ background: meta.gradient || meta.bg, color: "#fff" }}>
                    <meta.SvgIcon size={20} />
                  </div>
                  <div className="tx-group-info">
                    <span className="tx-group-name">{cat}</span>
                    <span
                      className="tx-group-total"
                      style={{ color: total >= 0 ? "#10b981" : "#ef4444" }}
                    >
                      {total >= 0 ? "+" : ""}{currency(Math.abs(total))}
                    </span>
                    <span className="tx-group-dot">·</span>
                    <span className="tx-group-count">{items.length} giao dịch</span>
                  </div>
                  <span className="tx-group-chevron">
                    {isExpanded ? <IcChevronUp /> : <IcChevronDown />}
                  </span>
                </button>

                {/* Group items */}
                {isExpanded && (
                  <div className="tx-group-items">
                    {displayItems.map((item) => {
                      const payTag = getPaymentTag(item);
                      const isIncome = item.transaction_type === "income";
                      const tagColor = payTag?.name === "Tiền mặt" ? { bg: "#dcfce7", text: "#16a34a", border: "#bbf7d0" } : { bg: "#dbeafe", text: "#2563eb", border: "#bfdbfe" };

                      return (
                        <div key={item.id} className="tx-item">
                          <div className="tx-item-icon" style={{ background: meta.light, color: meta.bg }}>
                            <meta.SvgIcon size={18} />
                          </div>
                          <div className="tx-item-body">
                            <p className="tx-item-desc">{item.description || item.categoryLabel || "Giao dịch"}</p>
                            <p className="tx-item-sub">{item.categoryLabel || cat}</p>
                          </div>
                          <div className="tx-item-meta">
                            <p className="tx-item-date">
                              {item.date?.split("-").reverse().join("/")}
                            </p>
                            {payTag && (
                              <span
                                className="tx-pay-badge"
                                style={{ background: tagColor.bg, color: tagColor.text, border: `1px solid ${tagColor.border}` }}
                              >
                                {payTag.name}
                              </span>
                            )}
                          </div>
                          <p
                            className="tx-item-amount"
                            style={{ color: isIncome ? "#10b981" : "#ef4444" }}
                          >
                            {isIncome ? "+" : "-"}{currency(item.amount)}
                          </p>
                          <div className="tx-item-actions">
                            <button
                              className="tx-item-action"
                              type="button"
                              title="Chi tiết"
                              onClick={() => { setSelectedTx(item); setActiveModal("detail"); }}
                            >
                              <IcEye />
                            </button>
                            <button
                              className="tx-item-action"
                              type="button"
                              title="Chỉnh sửa"
                              onClick={() => { setEditingTx(item); setActiveModal("edit"); }}
                            >
                              <IcArrowRight />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Show all / collapse */}
                    {items.length > PREVIEW && (
                      <button
                        className="tx-show-more"
                        type="button"
                        onClick={() => setShowAllGroups((prev) => ({ ...prev, [cat]: !showAll }))}
                      >
                        {showAll ? "Thu gọn" : `Xem tất cả (${items.length})`}
                        {showAll ? <IcChevronUp /> : <IcChevronDown />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {hasMore && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button className="tx-load-more" type="button" onClick={onLoadMore} disabled={loading}>
              {loading ? "Đang tải..." : "Tải thêm"}
            </button>
          </div>
        )}
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

              {/* Payment method (tags) */}
              {(cashTag || bankTag) && (
                <label className="tx-field">
                  <span>Phương thức thanh toán</span>
                  <div className="tx-pay-picker">
                    {[cashTag, bankTag].filter(Boolean).map((tag) => {
                      const isCash = tag.name === "Tiền mặt";
                      const sel = createTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className={`tx-pay-btn ${sel ? "selected" : ""}`}
                          style={sel ? { background: isCash ? "#dcfce7" : "#dbeafe", color: isCash ? "#16a34a" : "#2563eb", borderColor: isCash ? "#86efac" : "#93c5fd" } : {}}
                          onClick={() => {
                            if (sel) { setCreateTagIds((prev) => prev.filter((x) => x !== tag.id)); }
                            else {
                              const other = isCash ? bankTag : cashTag;
                              setCreateTagIds((prev) => prev.filter((x) => x !== other?.id).concat(tag.id));
                            }
                          }}
                        >
                          {isCash ? "💵" : "🏦"} {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </label>
              )}

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

              {/* Payment method */}
              {(cashTag || bankTag) && (
                <label className="tx-field">
                  <span>Phương thức thanh toán</span>
                  <div className="tx-pay-picker">
                    {[cashTag, bankTag].filter(Boolean).map((tag) => {
                      const isCash = tag.name === "Tiền mặt";
                      const sel = editTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className={`tx-pay-btn ${sel ? "selected" : ""}`}
                          style={sel ? { background: isCash ? "#dcfce7" : "#dbeafe", color: isCash ? "#16a34a" : "#2563eb", borderColor: isCash ? "#86efac" : "#93c5fd" } : {}}
                          onClick={() => {
                            if (sel) { setEditTagIds((prev) => prev.filter((x) => x !== tag.id)); }
                            else {
                              const other = isCash ? bankTag : cashTag;
                              setEditTagIds((prev) => prev.filter((x) => x !== other?.id).concat(tag.id));
                            }
                          }}
                        >
                          {isCash ? "💵" : "🏦"} {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </label>
              )}

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
              const payTag = getPaymentTag(selectedTx);
              return (
                <div className="tx-detail">
                  <div className="tx-detail-hero" style={{ background: meta.light }}>
                    <div className="tx-detail-cat-icon" style={{ background: meta.gradient || meta.bg, color: "#fff" }}>
                      <meta.SvgIcon size={28} />
                    </div>
                    <p className="tx-detail-desc">{selectedTx.description}</p>
                    <p className="tx-detail-cat">{selectedTx.categoryLabel || "Khác"}</p>
                    <p className="tx-detail-amount" style={{ color: isIncome ? "#10b981" : "#ef4444" }}>
                      {isIncome ? "+" : "-"}{currency(selectedTx.amount)}
                    </p>
                  </div>

                  <div className="tx-detail-grid">
                    <div className="tx-detail-row">
                      <span className="tx-detail-key">Ngày</span>
                      <span className="tx-detail-val">{selectedTx.date?.split("-").reverse().join("/")}</span>
                    </div>
                    <div className="tx-detail-row">
                      <span className="tx-detail-key">Loại</span>
                      <span className="tx-detail-val">{isIncome ? "Thu nhập" : "Chi tiêu"}</span>
                    </div>
                    <div className="tx-detail-row">
                      <span className="tx-detail-key">Thanh toán</span>
                      <span className="tx-detail-val">
                        {payTag ? (
                          <span
                            className="tx-pay-badge"
                            style={payTag.name === "Tiền mặt"
                              ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
                              : { background: "#dbeafe", color: "#2563eb", border: "1px solid #bfdbfe" }}
                          >
                            {payTag.name}
                          </span>
                        ) : "—"}
                      </span>
                    </div>
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
              tags={tags}
              userEmail={userEmail}
              onCreateCategory={onCreateCategory}
              onCreateTag={onCreateTag}
              onCreateTransaction={onCreateTransaction}
              loading={loading}
              embedded
            />
          </div>
        </div>
      )}
    </>
  );

  return isDesktop ? renderDesktop() : renderMobile();
}
