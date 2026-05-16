import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from "recharts";
import TransactionRow from "../../components/TransactionRow.jsx";
import { colorFor } from "../../utils/colors.js";
import { currency, percent } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";

const buildDonutItems = (breakdown, limit, otherLabel) => {
  const safeBreakdown = Array.isArray(breakdown) ? breakdown : [];
  if (!safeBreakdown.length) return [];
  const sorted = [...safeBreakdown].sort((a, b) => b.spent - a.spent);
  const primary = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const restSpent = rest.reduce((sum, item) => sum + item.spent, 0);
  const total = sorted.reduce((sum, item) => sum + item.spent, 0) || 1;
  const items = primary.map((item) => ({
    category: item.category,
    spent: item.spent,
    share: item.spent / total
  }));
  if (restSpent > 0) {
    items.push({
      category: otherLabel,
      spent: restSpent,
      share: restSpent / total,
      isOther: true
    });
  }
  return items;
};

const buildLineSeries = (series) => {
  const safeSeries = Array.isArray(series) ? series : [];
  const length = safeSeries.length;
  if (!length) {
    return {
      width: 100,
      height: 60,
      income: [],
      expense: [],
      incomePath: "",
      expensePath: "",
      labels: []
    };
  }
  const income = safeSeries.map((item) => Number(item.income || 0));
  const expense = safeSeries.map((item) => Number(item.expense || 0));
  const values = [...income, ...expense, 0];
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const width = 100;
  const height = 60;
  const padding = 6;
  const scaleX = (index) =>
    length === 1 ? width / 2 : padding + (index / (length - 1)) * (width - padding * 2);
  const scaleY = (value) => height - padding - ((value - min) / range) * (height - padding * 2);
  const mapPoints = (valuesList) =>
    valuesList.map((value, index) => ({
      x: scaleX(index),
      y: scaleY(value),
      value
    }));
  const buildSmoothPath = (points) => {
    if (points.length <= 1) return points.length ? `M ${points[0].x} ${points[0].y}` : "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const current = points[i];
      const midX = (prev.x + current.x) / 2;
      const midY = (prev.y + current.y) / 2;
      d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  };

  const incomePoints = mapPoints(income);
  const expensePoints = mapPoints(expense);
  if (incomePoints.length === 1) incomePoints.push({ ...incomePoints[0], x: incomePoints[0].x + 1 });
  if (expensePoints.length === 1) expensePoints.push({ ...expensePoints[0], x: expensePoints[0].x + 1 });

  return {
    width,
    height,
    income: incomePoints,
    expense: expensePoints,
    incomePath: buildSmoothPath(incomePoints),
    expensePath: buildSmoothPath(expensePoints),
    labels: safeSeries.map((item) => item.month.slice(5))
  };
};

const buildWaveSeries = (transactions, fallbackSeries) => {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  if (!safeTransactions.length) {
    return { series: Array.isArray(fallbackSeries) ? fallbackSeries : [], mode: "month" };
  }
  const dates = safeTransactions.map((item) => item.date).filter(Boolean).sort();
  if (!dates.length) {
    return { series: Array.isArray(fallbackSeries) ? fallbackSeries : [], mode: "month" };
  }
  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const useDaily = diffDays <= 45;
  const buckets = {};
  safeTransactions.forEach((item) => {
    if (!item.date) return;
    const key = useDaily ? item.date : item.date.slice(0, 7);
    if (!buckets[key]) buckets[key] = { income: 0, expense: 0 };
    if (item.transaction_type === "income") buckets[key].income += Number(item.amount || 0);
    if (item.transaction_type === "expense") buckets[key].expense += Number(item.amount || 0);
  });
  const series = Object.entries(buckets)
    .map(([key, values]) => ({
      month: key,
      income: values.income,
      expense: values.expense
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return { series, mode: useDaily ? "day" : "month" };
};

const normalizeText = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const buildAiInsights = (summary, transactions, breakdown) => {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeBreakdown = Array.isArray(breakdown) ? breakdown : [];
  const insights = [];

  const topCategory = safeBreakdown[0];
  if (topCategory) {
    insights.push(
      t("dashboard.insight.top_category", {
        category: topCategory.category,
        amount: currency(topCategory.spent)
      })
    );
  }

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;

  const coffeeSpendingByMonth = safeTransactions
    .filter((item) => item.transaction_type === "expense")
    .filter((item) => {
      const text = normalizeText(item.description || "");
      return text.includes("coffee") || text.includes("cafe") || text.includes("ca phe");
    })
    .reduce((acc, item) => {
      const key = String(item.date || "").slice(0, 7);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});

  const currentCoffee = coffeeSpendingByMonth[currentKey] || 0;
  const previousCoffee = coffeeSpendingByMonth[previousKey] || 0;
  if (previousCoffee > 0 && currentCoffee > previousCoffee) {
    const delta = ((currentCoffee - previousCoffee) / previousCoffee) * 100;
    insights.push(
      t("dashboard.insight.coffee_up", {
        delta: Math.round(delta),
        prev: currency(previousCoffee),
        current: currency(currentCoffee)
      })
    );
  }

  if ((summary?.total_expense || 0) > (summary?.total_income || 0)) {
    insights.push(t("dashboard.insight.over_spend"));
  }

  if (!insights.length) insights.push(t("dashboard.insight.stable"));
  return insights.slice(0, 3);
};

export default function DashboardScreen({
  summary,
  breakdown = [],
  incomeBreakdown,
  transactions = [],
  monthlySeries = [],
  anomalies = [],
  onViewTransactions,
  onGoOcr,
  onGoChat,
  onGoAddTransaction,
  onGoReports,
  onGoBudgets,
  onGoGoals,
  rangePreset,
  onSelectPreset,
  userEmail,
  savingsGoals = [],
  budgets = [],
  filters = { start: "", end: "" },
  onFiltersChange
}) {
  const safeMonthly = Array.isArray(monthlySeries) ? monthlySeries : [];
  const slicedTransactions = (Array.isArray(transactions) ? transactions : []).slice(0, 5);
  const insights = buildAiInsights(summary || {}, transactions, breakdown);
  const donutItems = buildDonutItems(breakdown, 6, t("reports.other", null, "Khác"));
  const donutTotal = donutItems.reduce((sum, item) => sum + item.spent, 0);
  const { series: waveSource } = buildWaveSeries(transactions, monthlySeries);
  const trendSeries = buildLineSeries(waveSource);
  const trendChartDataRaw = waveSource.map((item) => ({
    label: String(item.month || "").slice(5).replace("-", "/"),
    income: Number(item.income || 0),
    expense: Number(item.expense || 0)
  }));
  const trendChartData = trendChartDataRaw.length >= 2
    ? trendChartDataRaw
    : (Array.isArray(monthlySeries) ? monthlySeries : []).map((item) => ({
      label: String(item.month || "").slice(5).replace("-", "/"),
      income: Number(item.income || 0),
      expense: Number(item.expense || 0)
    }));

  const [showBalance, setShowBalance] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  const formatDateSafe = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString('vi-VN');
  };

  const dateRangeLabel = rangePreset === "thisMonth" ? "Tháng này" :
    rangePreset === "lastMonth" ? "Tháng trước" :
      rangePreset === "last7days" ? "7 ngày qua" :
        rangePreset === "last30days" ? "30 ngày qua" :
          rangePreset === "last90days" ? "90 ngày qua" :
            rangePreset === "thisYear" ? "Năm nay" :
              rangePreset === "all" ? "Tất cả" :
                `${formatDateSafe(filters.start)} - ${formatDateSafe(filters.end)}`;

  const PRESETS = [
    { label: "7 ngày qua", value: "last7days" },
    { label: "30 ngày qua", value: "last30days" },
    { label: "Tháng này", value: "thisMonth" },
    { label: "Tháng trước", value: "lastMonth" },
    { label: "Năm nay", value: "thisYear" },
    { label: "Tùy chỉnh", value: "custom" },
    { label: "Tất cả", value: "all" },
  ];

  const budgetRows = (Array.isArray(budgets) ? budgets : []).slice(0, 4).map((item) => {
    const spent = Number(item.spent || 0);
    const total = Number(item.amount || 0) || Math.max(spent, 1);
    const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
    return {
      label: item.category,
      percent: Math.min(100, Math.max(0, pct)),
      spent,
      total,
      color: colorFor(item.category, userEmail),
      status: item.status || (pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'normal')
    };
  });

  return (
    <div className="dashboard-container">
      {/* Date Filter Bar */}
      <div className="dashboard-filter-bar">
        <button className="db-date-btn" onClick={() => setShowDateModal(!showDateModal)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span>{dateRangeLabel}</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {showDateModal && (
          <div className="db-date-dropdown">
            {PRESETS.map(p => (
              <button key={p.value} className={rangePreset === p.value ? "active" : ""} onClick={() => {
                if (p.value !== 'custom') {
                  onSelectPreset(p.value);
                  setShowDateModal(false);
                } else {
                  onSelectPreset('custom');
                }
              }}>
                {p.label}
              </button>
            ))}
            {rangePreset === 'custom' && (
              <div className="db-custom-range">
                <input type="date" value={filters.start} onChange={e => onFiltersChange({ ...filters, start: e.target.value })} />
                <input type="date" value={filters.end} onChange={e => onFiltersChange({ ...filters, end: e.target.value })} />
                <button className="db-apply-btn" onClick={() => setShowDateModal(false)}>Áp dụng</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. Full-width Balance Card */}
      <section className="dashboard-balance-card">
        <div className="dbc-content">
          <div className="dbc-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p>Số dư hiện tại</p>
            <button
              className="icon-btn"
              onClick={() => setShowBalance(!showBalance)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex', opacity: 0.8 }}
              title={showBalance ? "Ẩn số dư" : "Hiện số dư"}
            >
              {showBalance ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              )}
            </button>
          </div>
          <h2>{showBalance ? currency(summary?.balance || 0) : '****** đ'}</h2>
          <p className="dbc-update">Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
          <button className="dbc-btn-add" onClick={onGoAddTransaction} style={{ marginTop: '16px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Thêm giao dịch
          </button>
        </div>
        <div className="dbc-graphic">
          <svg viewBox="0 0 24 24" width="80" height="80" fill="white" opacity="0.8">
            <path d="M20 12V22H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16v5" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M20 12a2 2 0 0 0-2 2 2 2 0 0 0 2 2h4v-4z" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="16" cy="14" r="1" />
          </svg>
        </div>
        <div className="dbc-inline-metrics">
          <div className="metric-card compact">
            <div className="mc-icon green">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            </div>
            <div className="mc-info">
              <p>Tổng thu nhập</p>
              <h3>{currency(summary?.total_income || 0)}</h3>
            </div>
          </div>
          <div className="metric-card compact">
            <div className="mc-icon red">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </div>
            <div className="mc-info">
              <p>Tổng chi tiêu</p>
              <h3>{currency(summary?.total_expense || 0)}</h3>
            </div>
          </div>
          <div className="metric-card compact">
            <div className="mc-icon purple">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 12V22H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16v5" /><path d="M20 12a2 2 0 0 0-2 2 2 2 0 0 0 2 2h4v-4z" /><circle cx="16" cy="14" r="1" /></svg>
            </div>
            <div className="mc-info">
              <p>Tiết kiệm ước tính</p>
              <h3>{currency((summary?.total_income || 0) - (summary?.total_expense || 0))}</h3>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Charts Row */}
      <section className="dashboard-charts-row">
        <div className="dashboard-panel chart-cashflow">
          <div className="dp-header">
            <h3>Dòng tiền trong tháng <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg></h3>
            <div className="dp-legend">
              <span className="legend-dot green"></span> Thu nhập
              <span className="legend-dot pink"></span> Chi tiêu
            </div>
          </div>
          <div className="dp-body">
            {trendChartData.length ? (
              <div className="line-chart compact wave">
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="dashIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dashExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(v) => currency(v)} />
                    <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#dashIncome)" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="expense" stroke="#ec4899" fill="url(#dashExpense)" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="empty">Chưa có dữ liệu</p>}
          </div>
          <div className="dp-footer-metrics">
            <div className="fm-item">
              <div className="fm-icon green"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg></div>
              <div>
                <p>Tổng thu nhập</p>
                <strong>{currency(summary?.total_income || 0)}</strong>
              </div>
            </div>
            <div className="fm-item">
              <div className="fm-icon red"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></div>
              <div>
                <p>Tổng chi tiêu</p>
                <strong>{currency(summary?.total_expense || 0)}</strong>
              </div>
            </div>
            <div className="fm-item">
              <div className="fm-icon purple"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12h16M4 6h16M4 18h16" /></svg></div>
              <div>
                <p>Dòng tiền ròng</p>
                <strong>{currency((summary?.total_income || 0) - (summary?.total_expense || 0))}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-panel chart-structure">
          <div className="dp-header">
            <h3>Cơ cấu chi tiêu <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg></h3>
          </div>
          <div className="dp-body split-donut">
            <div className="donut-chart-container">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutItems.map((item) => ({ name: item.category, value: item.spent, share: item.share, isOther: item.isOther }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {donutItems.map((item) => (
                      <Cell key={item.category} fill={item.isOther ? "#cbd5e1" : colorFor(item.category, userEmail)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center-text">
                <strong>{(donutTotal / 1000000).toFixed(2).replace('.', ',')}</strong>
                <span>triệu đ</span>
              </div>
            </div>
            <div className="donut-legend-list">
              {donutItems.map((item) => (
                <div key={item.category} className="dll-item">
                  <span className="dll-dot" style={{ background: item.isOther ? "#cbd5e1" : colorFor(item.category, userEmail) }}></span>
                  <span className="dll-label">{item.category}</span>
                  <span className="dll-value">{currency(item.spent)}</span>
                  <span className="dll-pct">{percent(item.share)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dp-footer-link">
            <button onClick={onGoReports}>Xem chi tiết báo cáo <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg></button>
          </div>
        </div>
      </section>

      {/* 4. Bottom Row */}
      <section className="dashboard-bottom-row">
        <div className="dashboard-panel dp-budgets">
          <div className="dp-header">
            <h3>Tiến độ ngân sách tháng <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg></h3>
          </div>
          <div className="dp-body">
            {budgetRows.length ? budgetRows.map(b => (
              <div key={b.label} className="budget-progress-item">
                <div className="bpi-header">
                  <div className="bpi-icon" style={{ color: b.status === 'exceeded' ? '#ef4444' : b.status === 'warning' ? '#f59e0b' : b.color }}><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg></div>
                  <span className="bpi-label">{b.label}</span>
                  <span className="bpi-pct" style={{ color: b.status === 'exceeded' ? '#ef4444' : b.status === 'warning' ? '#f59e0b' : b.color }}>{b.percent}%</span>
                </div>
                <div className="bpi-bar-bg">
                  <div className="bpi-bar-fill" style={{ width: `${b.percent}%`, background: b.status === 'exceeded' ? '#ef4444' : b.status === 'warning' ? '#f59e0b' : b.color }}></div>
                </div>
                <div className="bpi-amounts">
                  <span className="bpi-spent">{currency(b.spent)}</span>
                  <span className="bpi-total">/ {currency(b.total)}</span>
                  {b.status === 'exceeded' && <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '4px' }}>⚠ Vượt</span>}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p className="empty">Chưa có ngân sách nào.</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Thiết lập ngân sách để theo dõi chi tiêu.</p>
              </div>
            )}
          </div>
          <div className="dp-footer-link">
            <button onClick={onGoBudgets}>Xem tất cả ngân sách <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg></button>
          </div>
        </div>

        <div className="dashboard-panel dp-transactions">
          <div className="dp-header">
            <h3>Giao dịch gần đây</h3>
            <button className="ghost-link" onClick={onViewTransactions}>Xem tất cả</button>
          </div>
          <div className="dp-body tx-list">
            {slicedTransactions.length ? slicedTransactions.map(item => (
              <div key={item.id} className="tx-item">
                <div className="txi-icon" style={{ background: item.transaction_type === 'income' ? '#ecfdf5' : '#fef2f2', color: item.transaction_type === 'income' ? '#10b981' : '#ef4444' }}>
                  {item.transaction_type === 'income' ?
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" /></svg> :
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                  }
                </div>
                <div className="txi-main">
                  <div className="txi-info">
                    <strong>{item.description || item.categoryLabel}</strong>
                    <span>{item.categoryLabel}</span>
                  </div>
                  <div className="txi-meta">
                    <span>{(item.date || "").split("-").reverse().join("/") || "—"}</span>
                    <span>{(item.tags?.map(t => t.name) || []).join(", ") || "Tiền mặt"}</span>
                  </div>
                </div>
                <div className={`txi-amount ${item.transaction_type}`}>
                  {item.transaction_type === 'income' ? '+' : '-'}{currency(item.amount)}
                </div>
              </div>
            )) : <p className="empty">Không có giao dịch</p>}
          </div>
        </div>

        <div className="dp-right-col">
          <div className="dashboard-panel dp-ai-hints">
            <div className="dp-header">
              <h3>Gợi ý từ AI <span className="badge-new">Mới</span></h3>
            </div>
            <div className="dp-body">
              {insights.map((message, index) => (
                <div className="ai-hint-card" key={`${message}-${index}`}>
                  <div className={`ai-icon ${index % 2 === 0 ? "purple" : "orange"}`}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg></div>
                  <div className="ai-text">
                    <p>{message}</p>
                    <span>Dữ liệu được cập nhật theo giao dịch trong kỳ đã chọn.</span>
                  </div>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#cbd5e1" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-panel dp-goals">
            <div className="dp-header">
              <h3>Mục tiêu tiết kiệm</h3>
              <button className="ghost-link" onClick={onGoGoals}>Xem tất cả</button>
            </div>
            <div className="dp-body dp-goals-body">
              {savingsGoals.length ? savingsGoals.slice(0, 4).map((goal, idx) => {
                const pct = Math.min(100, Math.round(
                  ((goal.saved_amount || goal.current_amount || 0) / Math.max(1, goal.target_amount || 1)) * 100
                ));
                const saved = goal.saved_amount || goal.current_amount || 0;
                const goalColors = [
                  { grad: "linear-gradient(90deg,#8b5cf6,#c084fc)", light: "#f3e8ff", text: "#7c3aed" },
                  { grad: "linear-gradient(90deg,#3b82f6,#60a5fa)", light: "#dbeafe", text: "#2563eb" },
                  { grad: "linear-gradient(90deg,#10b981,#34d399)", light: "#d1fae5", text: "#059669" },
                  { grad: "linear-gradient(90deg,#f59e0b,#fcd34d)", light: "#fef3c7", text: "#d97706" },
                ];
                const clr = goalColors[idx % goalColors.length];
                return (
                  <div key={goal.id} className="dp-goal-card">
                    <div className="dp-goal-top">
                      <div className="dp-goal-icon" style={{ background: clr.light, color: clr.text }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                      </div>
                      <div className="dp-goal-info">
                        <span className="dp-goal-name">{goal.name}</span>
                        <span className="dp-goal-pct" style={{ color: clr.text }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="dp-goal-bar-bg">
                      <div className="dp-goal-bar-fill" style={{ width: `${pct}%`, background: clr.grad }} />
                    </div>
                    <div className="dp-goal-amounts">
                      <span style={{ color: clr.text, fontWeight: 600 }}>{currency(saved)}</span>
                      <span style={{ color: "#94a3b8" }}>/ {currency(goal.target_amount)}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="dp-goals-empty">
                  <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎯</div>
                  <p>Chưa có mục tiêu tiết kiệm nào.</p>
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>Thiết lập mục tiêu để theo dõi tiến độ tiết kiệm của bạn.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
