import { useMemo, useState } from "react";
import { currency, formatNumberInput, parseNumberInput } from "../../utils/format.js";
import { getCatMeta } from "../../utils/categoryIcons.jsx";
import "./budgets.css";
const toD = (d) => d.toISOString().slice(0,10);

const emptyForm = () => ({ categoryId: "", amount: "" });

export default function BudgetsScreen({
  categories,
  budgets = [],
  onCreateBudget,
  onUpdateBudget,
  onDeleteBudget,
  loading
}) {
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [bdStart, setBdStart] = useState(() => { const d = new Date(); d.setDate(1); return toD(d); });
  const [bdEnd, setBdEnd] = useState(() => toD(new Date()));
  const [statusFilter, setStatusFilter] = useState("");
  const [sortMode, setSortMode] = useState("progress");

  const plansWithStats = Array.isArray(budgets) ? budgets : [];
  const totalBudget = plansWithStats.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalSpent = plansWithStats.reduce((sum, p) => sum + Number(p.spent || 0), 0);
  const activePlansCount = plansWithStats.length;
  const overallProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const filteredPlans = useMemo(
    () =>
      plansWithStats.filter((plan) =>
        searchText ? String(plan.category || "").toLowerCase().includes(searchText.toLowerCase()) : true
      ),
    [plansWithStats, searchText]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = parseNumberInput(form.amount);
    if (!(amount > 0) || !form.categoryId) return;
    if (editingId) {
      await onUpdateBudget?.(editingId, { amount });
    } else {
      await onCreateBudget?.({ category_id: Number(form.categoryId), amount });
    }
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const removePlan = async (planId) => {
    await onDeleteBudget?.(planId);
    if (editingId === planId) setEditingId(null);
  };

  const startEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      categoryId: String(plan.category_id),
      amount: formatNumberInput(plan.amount)
    });
    setShowForm(true);
  };

  return (
    <div className="bgd-container">
      {/* Top Header */}
      <div className="bgd-header-top">
        <div className="bgd-title-block">
          <h1 className="bgd-title">Ngân sách</h1>
        </div>
        <div className="bgd-header-actions">
          <button className="bgd-btn-add" onClick={() => { setForm(emptyForm()); setEditingId(null); setShowForm(true); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span className="btn-text">Ngân sách</span>
          </button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="bgd-kpi-row">
        <div className="bgd-kpi-card">
          <div className="bgd-kpi-icon total"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></div>
          <div className="bgd-kpi-text">
            <div className="bgd-kpi-label">Tổng ngân sách tháng</div>
            <div className="bgd-kpi-value total">{currency(totalBudget)}</div>
          </div>
        </div>
        <div className="bgd-kpi-card">
          <div className="bgd-kpi-icon spent"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>
          <div className="bgd-kpi-text">
            <div className="bgd-kpi-label">Đã sử dụng</div>
            <div className="bgd-kpi-value spent">{currency(totalSpent)} <span className="pct">({overallProgress.toFixed(1)}%)</span></div>
            <div className="bgd-kpi-bar">
              <div className="bgd-kpi-bar-fill" style={{width: `${Math.min(100, Math.max(0, overallProgress))}%`}}></div>
            </div>
          </div>
        </div>
        <div className="bgd-kpi-card">
          <div className="bgd-kpi-icon count"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
          <div className="bgd-kpi-text">
            <div className="bgd-kpi-label">Đang hoạt động</div>
            <div className="bgd-kpi-value count">{activePlansCount} ngân sách</div>
          </div>
        </div>
      </div>

      {/* FORM (Tạo / Chỉnh sửa) - Modal Container for Mobile consistency */}
      <div className={`bgd-modal-overlay ${showForm ? "show" : ""}`}>
        <div className="bgd-modal-container">
          <form className="budget-form-card" onSubmit={handleSubmit}>
            <div className="bd-form-header">
              <h3>{editingId ? "Chỉnh sửa ngân sách" : "Thiết lập ngân sách"}</h3>
              <button type="button" className="bd-modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            
            <div className="bd-form-row">
              <div className="bd-field">
                <label>Danh mục</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  required
                  disabled={Boolean(editingId)}
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bd-field">
                <label>Ngân sách mục tiêu</label>
                <input type="text" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: formatNumberInput(e.target.value) })} placeholder="0 đ" required />
              </div>
            </div>

            <div className="bd-form-actions">
              <button type="button" className="bd-btn-cancel" onClick={() => setShowForm(false)}>Hủy</button>
              <button type="submit" className="bd-btn-save" disabled={loading}>Lưu ngân sách</button>
            </div>
          </form>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bgd-filters-row">
         <div className="bgd-filters-left">
            <div className="bgd-date-range">
               <div className="bgd-date-field">
                 <span>Từ ngày</span>
                 <input type="date" value={bdStart} onChange={(e) => setBdStart(e.target.value)} />
               </div>
               <div className="bgd-date-field">
                 <span>Đến ngày</span>
                 <input type="date" value={bdEnd} onChange={(e) => setBdEnd(e.target.value)} />
               </div>
            </div>
            <div className="bgd-searchbox">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
               <input type="text" placeholder="Tìm kiếm ngân sách..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
         </div>
         <div className="bgd-filters-right">
            <div className="bgd-fsel">
               <span>Loại ngân sách:</span>
               <select><option>Tất cả</option></select>
            </div>
            <div className="bgd-fsel">
               <span>Sắp xếp:</span>
               <select><option>Tiến độ cao nhất</option></select>
            </div>
         </div>
      </div>

      {/* Main Budget List Grid (Actually a column of thick cards) */}
      <div className="bgd-list">
        {filteredPlans.map(plan => {
          const meta = getCatMeta(plan.category || "Khác");
          
          let statusText = "Bình thường";
          let statusColor = "#10b981"; // green
          let statusBg = "#d1fae5";
          
          if (Number(plan.progress || 0) >= 100) {
            statusText = "Vượt ngân sách";
            statusColor = "#ef4444";
            statusBg = "#fee2e2";
          } else if (Number(plan.progress || 0) >= 80) {
            statusText = "Sắp vượt";
            statusColor = "#f59e0b";
            statusBg = "#fef3c7";
          }

          return (
            <div key={plan.id} className="bgd-card" onClick={() => startEdit(plan)}>
               {/* Left: Icon & Name */}
               <div className="bgd-card-left">
                  <div className="bgd-card-icon" style={{background: meta.light, color: meta.bg}}>
                     <meta.SvgIcon size={24} />
                  </div>
                  <div className="bgd-card-info">
                     <h3>Ngân sách {plan.category || "Khác"}</h3>
                     <p>Theo dõi: {plan.category || "Khác"} • Theo kỳ lọc hiện tại</p>
                  </div>
               </div>

               {/* Middle: Progress Bar */}
               <div className="bgd-card-mid">
                  <div className="bgd-progress-labels">
                     <span className="spent">{currency(plan.spent || 0)}</span>
                     <span className="budget">/ {currency(plan.amount || 0)}</span>
                  </div>
                  <div className="bgd-progress-bar">
                     <div className="bgd-bar-fill" style={{width: `${Math.min(100, Math.max(0, Number(plan.progress || 0)))}%`, background: statusColor}}></div>
                  </div>
                  <div className="bgd-progress-rem">
                     Còn lại {currency(Math.max(0, Number(plan.remaining || 0)))} ({Math.max(0, 100 - Number(plan.progress || 0)).toFixed(0)}%)
                  </div>
               </div>

               {/* Right: Status & Actions */}
               <div className="bgd-card-right">
                  <div className="bgd-status-badge" style={{background: statusBg, color: statusColor}}>
                     <span className="dot" style={{background: statusColor}}></span> {statusText}
                  </div>
                  <button className="bgd-action-btn" onClick={(e) => { e.stopPropagation(); removePlan(plan.id); }}>
                     ×
                  </button>
               </div>
            </div>
          );
        })}
        {!filteredPlans.length && <div className="bgd-card">Chưa có ngân sách. Hãy bấm "Tạo ngân sách" để thêm mới.</div>}
      </div>

    </div>
  );
}
