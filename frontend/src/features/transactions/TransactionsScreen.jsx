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

/* SVG icons */
const IcOcr = (props) => (
  <svg {...props} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M7 7h.01M17 7h.01M7 12h10M7 17h10"/>
  </svg>
);
const IcAdd = (props) => (
  <svg {...props} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IcCalendar = (props) => (
  <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const IcChevronDown = (props) => (
  <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
);
const IcClose = (props) => (
  <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);
const IcIncome = (props) => (
  <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
);
const IcExpense = (props) => (
  <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M19 12l-7 7-7-7"/>
  </svg>
);
const IcTx = (props) => (
  <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
  </svg>
);

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
  onUpdateCategory,
  onDeleteCategory,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onCreateTransaction,
  onLoadMore,
  hasMore,
  userEmail,
  onBack,
  loading,
  accounts = [],
}) {
  const [activeModal, setActiveModal] = useState(null); // "add" | "ocr" | "dateRange"
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* form state */
  const [createType, setCreateType] = useState("expense");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createDate, setCreateDate] = useState(() => toInputDate(new Date()));
  const [createAmount, setCreateAmount] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createAccountId, setCreateAccountId] = useState("");

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [dateRangeLabel, setDateRangeLabel] = useState(() => formatRangeLabel(filters.start, filters.end));
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => { setDateRangeLabel(formatRangeLabel(filters.start, filters.end)); }, [filters.start, filters.end]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (categoryFilter && tx.categoryLabel !== categoryFilter) return false;
      if (accountFilter && tx.account_id !== accountFilter) return false;
      if (tagFilter && !tx.tags?.includes(tagFilter)) return false;
      if (searchText && !tx.description?.toLowerCase().includes(searchText.toLowerCase())) return false;
      
      if (accountTypeFilter !== "all") {
        const acc = accounts.find(a => a.id === tx.account_id);
        if (accountTypeFilter === "cash" && acc?.type !== "cash") return false;
        if (accountTypeFilter === "bank" && acc?.type !== "bank") return false;
      }
      
      return true;
    });
  }, [transactions, categoryFilter, searchText, accountTypeFilter, accounts, accountFilter, tagFilter]);

  const totalIncome = useMemo(() => filtered.filter((i) => i.transaction_type === "income").reduce((s, i) => s + i.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter((i) => i.transaction_type === "expense").reduce((s, i) => s + i.amount, 0), [filtered]);

  const categoryStats = useMemo(() => {
    const map = {};
    transactions.forEach((item) => {
      const key = item.categoryLabel || "Khác";
      if (!map[key]) map[key] = 0;
      map[key] += 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const toggleGroup = (cat) => setExpandedGroups((prev) => ({ ...prev, [cat]: !prev[cat] }));
  
  const startEdit = (tx) => {
    setEditingTx(tx);
    setCreateDesc(tx.description || "");
    setCreateAmount(formatNumberInput(String(tx.amount)));
    setCreateDate(tx.date || toInputDate(new Date()));
    setCreateCategoryId(tx.category_id || "");
    setCreateAccountId(tx.account_id || "");
    setCreateType(tx.transaction_type || "expense");
  };

  const editingId = editingTx?.id || null;

  const handleCreate = (e) => {
    e.preventDefault();
    const amount = parseNumberInput(createAmount);
    if (!amount || amount <= 0) return;
    const payload = {
      description: createDesc, amount, transaction_type: createType,
      category_id: createCategoryId ? Number(createCategoryId) : null,
      date: createDate, account_id: createAccountId ? Number(createAccountId) : null,
    };
    if (editingId) {
      onUpdate(editingId, payload);
    } else {
      onCreate(payload);
    }
    setCreateDesc(""); setCreateAmount(""); setCreateDate(toInputDate(new Date()));
    setCreateCategoryId(""); setCreateAccountId(""); setEditingTx(null); setActiveModal(null);
  };

  const renderDesktop = () => {
    const grouped = {};
    filtered.forEach((tx) => {
      const cat = tx.categoryLabel || "Khác";
      if (!grouped[cat]) grouped[cat] = { total: 0, count: 0, items: [] };
      grouped[cat].items.push(tx);
      grouped[cat].count++;
      grouped[cat].total += tx.transaction_type === "income" ? Number(tx.amount) : -Number(tx.amount);
    });
    const sortedGroups = Object.entries(grouped);

    // If OCR or Add form is active, render it integrated into the right column
    const isFormView = activeModal === "ocr" || activeModal === "add";

    return (
      <div className="txd-container">
        <div className="txd-header-top">
          <div className="txd-title-block">
            <h1 className="txd-title">Giao dịch</h1>
            <p className="txd-subtitle">Quản lý tất cả giao dịch thu chi của bạn</p>
          </div>
          <div className="txd-header-actions">
            {!isFormView && (
              <>
                <button className="txd-date-range" onClick={() => setActiveModal("dateRange")}>
                  <IcCalendar /> {dateRangeLabel} <IcChevronDown />
                </button>
                <button className="txd-btn-ocr" onClick={() => setActiveModal("ocr")}>
                  <IcOcr /> Quét hóa đơn OCR
                </button>
                <button className="txd-btn-add" onClick={() => setActiveModal("add")}>
                  + Thêm giao dịch
                </button>
              </>
            )}
          </div>
        </div>

        {!isFormView && (
          <div className="txd-kpi-row-top">
             <div className="txd-kpi-card">
                <div className="txd-kpi-icon income"><IcIncome /></div>
                <div className="txd-kpi-text">
                   <div className="txd-kpi-label">Tổng thu</div>
                   <div className="txd-kpi-value income">{currency(totalIncome)}</div>
                </div>
             </div>
             <div className="txd-kpi-card">
                <div className="txd-kpi-icon expense"><IcExpense /></div>
                <div className="txd-kpi-text">
                   <div className="txd-kpi-label">Tổng chi</div>
                   <div className="txd-kpi-value expense">{currency(totalExpense)}</div>
                </div>
             </div>
             <div className="txd-kpi-card">
                <div className="txd-kpi-icon count"><IcTx /></div>
                <div className="txd-kpi-text">
                   <div className="txd-kpi-label">Số giao dịch</div>
                   <div className="txd-kpi-value count">{filtered.length} giao dịch</div>
                </div>
             </div>
          </div>
        )}

        <div className="txd-body-cols">
           <div className="txd-col-left">
              <div className="txd-searchbox-top">
                 <IcOcr />
                 <input type="text" placeholder="Tìm kiếm..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              </div>
              <div className="txd-sidebar-cat">
                 <div className="txd-sb-head">
                    <h3 className="txd-sb-title">Danh mục</h3>
                 </div>
                 <div className="txd-cat-list">
                    {categoryStats.slice(0, 8).map(([name, count]) => {
                       const meta = getCatMeta(name);
                       return (
                          <div key={name} className={`txd-cat-item-pro ${categoryFilter === name ? "active" : ""}`} onClick={() => setCategoryFilter(categoryFilter === name ? "" : name)}>
                             <div className="txd-cip-icon" style={{background: meta.light, color: meta.bg}}><meta.SvgIcon size={18} /></div>
                             <div className="txd-cip-info">
                                <div className="txd-cip-name">{name}</div>
                                <div className="txd-cip-amt">{count} giao dịch</div>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
           </div>

           <div className="txd-col-right">
              {activeModal === "ocr" ? (
                <div className="integrated-form-panel">
                  <OcrScreen
                    categories={categories} tags={tags} accounts={accounts} userEmail={userEmail}
                    onCreateCategory={onCreateCategory} onCreateTag={onCreateTag}
                    onCreateTransaction={onCreateTransaction} loading={loading}
                    embedded
                    onClose={() => setActiveModal(null)}
                  />
                </div>
              ) : activeModal === "add" ? (
                <div className="integrated-form-panel add-tx-form">
                   <div className="ocr-header-pro">
                      <div className="ocr-title-area">
                         <h2>{editingId ? "Sửa giao dịch" : "Thêm giao dịch mới"}</h2>
                         <p>{editingId ? "Cập nhật thông tin giao dịch hiện có." : "Nhập thông tin giao dịch thủ công vào hệ thống."}</p>
                      </div>
                      <IcClose onClick={() => { setActiveModal(null); setEditingTx(null); }} style={{cursor:'pointer'}} />
                   </div>
                   <form onSubmit={handleCreate} className="ocr-card-pro" style={{padding: 30}}>
                      <div className="ocr-field-row">
                         <label className="ocr-input-field">
                            <span>Mô tả giao dịch *</span>
                            <div className="ocr-input-wrap">
                               <input type="text" value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="Vd: Ăn trưa tại quán cơm" required />
                            </div>
                         </label>
                         <label className="ocr-input-field">
                            <span>Số tiền *</span>
                            <div className="ocr-input-wrap">
                               <input type="text" value={createAmount} onChange={e => setCreateAmount(formatNumberInput(e.target.value))} placeholder="0 d" required />
                            </div>
                         </label>
                      </div>
                      <div className="ocr-field-row">
                         <label className="ocr-input-field">
                            <span>Ngày giao dịch *</span>
                            <div className="ocr-input-wrap">
                               <input type="date" value={createDate} onChange={e => setCreateDate(e.target.value)} required />
                            </div>
                         </label>
                         <label className="ocr-input-field">
                            <span>Nguồn tiền</span>
                            <select className="ocr-input-wrap qm-input" value={createAccountId} onChange={e => setCreateAccountId(e.target.value)}>
                               <option value="">Chọn tài khoản</option>
                               {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                         </label>
                      </div>
                      <div className="ocr-field-row">
                         <label className="ocr-input-field" style={{width: '100%'}}>
                            <span>Danh mục *</span>
                            <select className="ocr-input-wrap qm-input" value={createCategoryId} onChange={e => setCreateCategoryId(e.target.value)} required>
                               <option value="">Chọn danh mục</option>
                               {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                         </label>
                      </div>
                      <div className="ocr-pill-group">
                         <span>Loại giao dịch</span>
                         <div className="ocr-pill-nav">
                            <button type="button" className={createType === "expense" ? "active" : ""} onClick={() => setCreateType("expense")}>Chi tiêu</button>
                            <button type="button" className={createType === "income" ? "active" : ""} onClick={() => setCreateType("income")}>Thu nhập</button>
                         </div>
                      </div>
                      <div className="ocr-footer-btns" style={{marginTop: 30}}>
                         <button type="button" className="ocr-btn-secondary" onClick={() => { setActiveModal(null); setEditingTx(null); }}>Hủy bỏ</button>
                         <button type="submit" className="ocr-btn-primary">{editingId ? "Cập nhật" : "Lưu giao dịch"}</button>
                      </div>
                   </form>
                </div>
              ) : (
                <div className="txd-list-container">
                   <div className="txd-list-header">
                      <div className="lh-col">Giao dịch</div>
                      <div className="lh-col">Ngày</div>
                      <div className="lh-col">Nguồn tiền</div>
                      <div className="lh-col amount">Số tiền</div>
                   </div>
                   <div className="txd-groups">
                      {sortedGroups.map(([catName, data]) => {
                         const isExpanded = expandedGroups[catName] !== false;
                         const meta = getCatMeta(catName);
                         return (
                            <div key={catName} className="txd-group-pro">
                               <button className="txd-gp-head" onClick={() => toggleGroup(catName)}>
                                  {(() => {
                                     const Icon = meta.SvgIcon;
                                     return <div className="txd-gph-icon" style={{color: meta.bg}}><Icon size={18}/></div>
                                  })()}
                                  <div className="txd-gph-title">{catName} <span>({data.count})</span></div>
                                  <div className={`txd-gph-total ${data.total >= 0 ? "income" : "expense"}`}>{currency(data.total)}</div>
                               </button>
                               {isExpanded && (
                                  <div className="txd-gp-body">
                                     {data.items.map(tx => (
                                        <div key={tx.id} className="txd-list-row" onClick={() => setSelectedTx(tx)}>
                                           <div className="lr-col main">
                                              {(() => {
                                                 const Icon = meta.SvgIcon;
                                                 return <div className="lr-icon" style={{background: meta.bg, color: "#fff"}}><Icon size={14}/></div>
                                              })()}
                                              <span className="lr-title">{tx.description || "Giao dịch"}</span>
                                           </div>
                                           <div className="lr-col date">{tx.date?.split('-').reverse().join('/')}</div>
                                           <div className="lr-col source">
                                              <span className="src-badge bank">{accounts.find(a => a.id === tx.account_id)?.name || "Tiền mặt"}</span>
                                           </div>
                                           <div className={`lr-col amount ${tx.transaction_type === "income" ? "income" : "expense"}`}>
                                              {currency(tx.amount)}
                                           </div>
                                        </div>
                                     ))}
                                  </div>
                               )}
                            </div>
                         );
                      })}
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    );
  };


  const renderMobile = () => {
    const grouped = {};
    filtered.forEach((tx) => {
      const cat = tx.categoryLabel || "Khác";
      if (!grouped[cat]) grouped[cat] = { total: 0, count: 0, items: [] };
      grouped[cat].items.push(tx);
      grouped[cat].count++;
      grouped[cat].total += tx.transaction_type === "income" ? Number(tx.amount) : -Number(tx.amount);
    });
    const sortedGroups = Object.entries(grouped);

    return (
      <section className="tx-mobile-container">
        {/* Header with Title and Actions */}
        <div className="tx-m-header">
          <h1 className="tx-m-title">Giao dịch</h1>
          <div className="tx-m-actions">
            <button className="tx-m-btn-add" onClick={() => setActiveModal("add")}>
               <IcAdd /> Thêm
            </button>
          </div>
        </div>

        {/* Transaction Search */}
        <div className="tx-m-search">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
           <input type="text" placeholder="Tìm kiếm giao dịch..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>

        {/* Account Type Chips */}
        <div className="tx-m-chips">
           <button className={accountTypeFilter === "all" ? "active" : ""} onClick={() => setAccountTypeFilter("all")}>Tất cả</button>
           <button className={accountTypeFilter === "cash" ? "active" : ""} onClick={() => setAccountTypeFilter("cash")}>Tiền mặt</button>
           <button className={accountTypeFilter === "bank" ? "active" : ""} onClick={() => setAccountTypeFilter("bank")}>Ngân hàng</button>
        </div>

        {/* Date Range Selector */}
        <button className="tx-m-date-picker" onClick={() => setActiveModal("dateRange")}>
           <IcCalendar />
           <span>{dateRangeLabel}</span>
           <IcChevronDown />
        </button>

        {/* KPI Row */}
        <div className="tx-m-kpis">
           <div className="tx-m-kpi income">
              <div className="kpi-icon"><IcIncome /></div>
              <p className="kpi-label">Tổng thu</p>
              <h3 className="kpi-val">{currency(totalIncome)}</h3>
           </div>
           <div className="tx-m-kpi expense">
              <div className="kpi-icon"><IcExpense /></div>
              <p className="kpi-label">Tổng chi</p>
              <h3 className="kpi-val">{currency(totalExpense)}</h3>
           </div>
        </div>

        {/* Category Bubble Row with Management */}
        <div className="tx-m-cat-header">
           <span>Danh mục</span>
           <button className="tx-m-link" onClick={() => setActiveModal("catManage")}>Quản lý</button>
        </div>
        <div className="tx-m-cat-row">
           {categoryStats.map(([name, count]) => {
              const meta = getCatMeta(name);
              const Icon = meta.SvgIcon;
              const isSelected = categoryFilter === name;
              return (
                 <div key={name} className={`tx-m-cat-item ${isSelected ? 'active' : ''}`} onClick={() => setCategoryFilter(isSelected ? '' : name)}>
                    <div className="cat-icon-wrap">
                       <div className="cat-icon" style={{background: meta.light, color: meta.bg}}>
                          <Icon size={24} />
                       </div>
                       <span className="cat-badge">{count}</span>
                    </div>
                    <p className="cat-name">{name}</p>
                 </div>
              );
           })}
        </div>

        {/* Secondary Filters using real data */}
        <div className="tx-m-filters">
           <div className="f-item">
              <label>Nguồn tiền</label>
              <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)}>
                 <option value="">Tất cả</option>
                 {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
           </div>
           <div className="f-item">
              <label>Danh mục</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                 <option value="">Tất cả</option>
                 {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
           </div>
           <div className="f-item">
              <label>Nhãn</label>
              <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
                 <option value="">Tất cả</option>
                 {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
           </div>
        </div>

        {/* Grouped List */}
        <div className="tx-m-list">
           {sortedGroups.map(([catName, data]) => {
              const isExpanded = expandedGroups[catName] !== false;
              const meta = getCatMeta(catName);
              return (
                 <div key={catName} className="tx-m-group">
                    <button className="tx-m-group-head" onClick={() => toggleGroup(catName)}>
                       <div className="g-left">
                          {(() => {
                             const Icon = meta.SvgIcon;
                             return <div className="g-icon" style={{background: meta.light, color: meta.bg}}><Icon size={18} /></div>
                          })()}
                          <span className="g-name">{catName}</span>
                          <span className="g-sum">{currency(data.total)}</span>
                       </div>
                       <div className={`g-chevron ${isExpanded ? 'up' : ''}`}><IcChevronDown /></div>
                    </button>
                    {isExpanded && (
                       <div className="tx-m-group-body">
                          {data.items.map(tx => (
                             <div key={tx.id} className="tx-m-row" onClick={() => { setSelectedTx(tx); setShowDetailModal(true); }}>
                                <div className="r-left">
                                   <div className="r-info">
                                      <p className="r-desc">{tx.description || "Giao dịch"}</p>
                                      <p className="r-sub">{accounts.find(a => a.id === tx.account_id)?.name || "Tiền mặt"}</p>
                                   </div>
                                </div>
                                <div className="r-right">
                                   <p className={`r-amt ${tx.transaction_type === 'income' ? 'income' : 'expense'}`}>
                                      {tx.transaction_type === 'income' ? '+' : '-'}{currency(tx.amount)}
                                   </p>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              );
           })}
        </div>

        {/* Transaction Detail Modal */}
        {showDetailModal && selectedTx && (
           <div className="qm-overlay">
              <div className="qm-modal bottom-sheet">
                 <div className="qm-modal-header">
                    <h3>Chi tiết giao dịch</h3>
                    <button className="qm-modal-close" onClick={() => setShowDetailModal(false)}><IcClose /></button>
                 </div>
                 <div className="qm-modal-body tx-detail-body">
                    {(() => {
                       const meta = getCatMeta(selectedTx.categoryLabel);
                       const Icon = meta.SvgIcon;
                       return (
                          <div className="tx-detail-highlight" style={{background: meta.light}}>
                             <div className="tx-detail-icon" style={{background: meta.bg}}>
                                {Icon && <Icon size={32} color="white" />}
                             </div>
                             <h3 className="tx-detail-desc">{selectedTx.description}</h3>
                             <p className="tx-detail-cat">{selectedTx.categoryLabel}</p>
                             <h2 className={`tx-detail-amt ${selectedTx.transaction_type === 'income' ? 'income' : 'expense'}`}>
                                {selectedTx.transaction_type === 'income' ? '+' : '-'}{currency(selectedTx.amount)}
                             </h2>
                          </div>
                       );
                    })()}
                    <div className="tx-detail-fields">
                       <div className="tx-df"><span>Ngày</span> <strong>{selectedTx.date}</strong></div>
                       <div className="tx-df"><span>Loại</span> <strong>{selectedTx.transaction_type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</strong></div>
                       <div className="tx-df">
                          <span>Thanh toán</span> 
                          <span className="badge" style={{background: '#dcfce7', color: '#16a34a'}}>
                             {accounts.find(a => a.id === selectedTx.account_id)?.name || "Tiền mặt"}
                          </span>
                       </div>
                    </div>
                 </div>
                 <div className="qm-modal-footer dual">
                    <button className="qm-btn-ghost" onClick={() => setShowDetailModal(false)}>Đóng</button>
                    <button className="qm-btn-save" onClick={() => { startEdit(selectedTx); setShowDetailModal(false); setActiveModal("add"); }}>Chỉnh sửa</button>
                 </div>
              </div>
           </div>
        )}

        {/* Add/Edit Modal with OCR integration */}
        {activeModal === "add" && (
          <div className="qm-overlay">
            <div className="qm-modal">
              <div className="qm-modal-header">
                <h3>{editingId ? "Sửa giao dịch" : "Thêm giao dịch"}</h3>
                <button className="qm-modal-close" onClick={() => setActiveModal(null)}><IcClose /></button>
              </div>
              <form onSubmit={handleCreate} className="qm-modal-body">
                <button type="button" className="tx-m-btn-ocr-inline" onClick={() => setActiveModal("ocr")}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h.01M17 7h.01M7 12h10M7 17h10"/></svg>
                   Nhập hóa đơn OCR
                </button>
                <div className="qm-input-group">
                  <label>Mô tả</label>
                  <input type="text" value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="Nhập mô tả..." required />
                </div>
                <div className="qm-input-group">
                  <label>Số tiền</label>
                  <input type="text" value={createAmount} onChange={e => setCreateAmount(formatNumberInput(e.target.value))} placeholder="0 đ" required />
                </div>
                <div className="qm-input-group">
                  <label>Ngày</label>
                  <input type="date" value={createDate} onChange={e => setCreateDate(e.target.value)} required />
                </div>
                <div className="qm-input-group">
                  <label>Tài khoản</label>
                  <select value={createAccountId} onChange={e => setCreateAccountId(e.target.value)}>
                    <option value="">Chọn tài khoản</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="qm-input-group">
                  <label>Danh mục</label>
                  <select value={createCategoryId} onChange={e => setCreateCategoryId(e.target.value)}>
                    <option value="">Chọn danh mục</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="qm-modal-footer">
                  <button type="submit" className="qm-btn-save">{editingId ? "Lưu thay đổi" : "Lưu giao dịch"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Category Management Modal */}
        {activeModal === "catManage" && (
           <div className="qm-overlay">
              <div className="qm-modal">
                 <div className="qm-modal-header">
                    <h3>Quản lý danh mục</h3>
                    <button className="qm-modal-close" onClick={() => setActiveModal(null)}><IcClose /></button>
                 </div>
                 <div className="qm-modal-body cat-manage-list">
                    <div className="cat-add-box">
                       <input type="text" placeholder="Tên danh mục mới..." id="newCatName" />
                       <button onClick={() => {
                          const name = document.getElementById('newCatName').value;
                          if (name) { onCreateCategory(name); document.getElementById('newCatName').value = ''; }
                       }}><IcAdd /></button>
                    </div>
                    {categories.map(c => (
                       <div key={c.id} className="cat-manage-item">
                          <span>{c.name}</span>
                          <div className="cat-actions">
                             <button onClick={() => {
                                const next = prompt("Tên mới:", c.name);
                                if (next) onUpdateCategory(c.id, { name: next });
                             }}>Sửa</button>
                             <button className="del" onClick={() => {
                                if (confirm("Xóa danh mục này?")) onDeleteCategory(c.id);
                             }}>Xóa</button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {activeModal === "ocr" && (
          <div className="qm-overlay">
            <div className="qm-modal full-screen">
               <div className="qm-modal-header">
                  <h3>Nhập hóa đơn OCR</h3>
                  <button className="qm-modal-close" onClick={() => setActiveModal(null)}><IcClose /></button>
               </div>
               <div className="qm-modal-body">
                  <OcrScreen
                    categories={categories} tags={tags} accounts={accounts} userEmail={userEmail}
                    onCreateCategory={onCreateCategory} onCreateTag={onCreateTag}
                    onCreateTransaction={onCreateTransaction} loading={loading}
                    embedded
                    onClose={() => setActiveModal(null)}
                  />
               </div>
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      {isDesktop ? renderDesktop() : renderMobile()}

      {activeModal === "dateRange" && (
        <div className="qm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}>
          <div className="qm-modal">
            <div className="qm-modal-header"><h3>Chọn khoảng thời gian</h3><button className="qm-modal-close" onClick={() => setActiveModal(null)}><IcClose /></button></div>
            <div className="qm-modal-body" style={{display: 'flex', gap: 12}}>
               <input className="qm-input" type="date" value={filters.start} onChange={e => onFiltersChange({...filters, start: e.target.value})} />
               <input className="qm-input" type="date" value={filters.end} onChange={e => onFiltersChange({...filters, end: e.target.value})} />
            </div>
            <div className="qm-modal-footer"><button className="qm-btn-save" onClick={() => setActiveModal(null)}>Áp dụng</button></div>
          </div>
        </div>
      )}
    </>
  );
}
