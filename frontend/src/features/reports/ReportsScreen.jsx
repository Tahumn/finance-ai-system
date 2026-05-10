import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis as ReXAxis,
  YAxis as ReYAxis,
  CartesianGrid as ReCartesianGrid
} from "recharts";
import { colorFor } from "../../utils/colors.js";
import { currency, formatDateFull, percent } from "../../utils/format.js";
import { getCatMeta } from "../../utils/categoryIcons.jsx";
import "./reports.css";

const toD = (d) => d.toISOString().slice(0,10);
const fmt = (n) => {
  if (!n && n !== 0) return '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n/1e9).toFixed(1).replace(/.0$/,'') + 'T';
  if (abs >= 1e6) return (n/1e6).toFixed(1).replace(/.0$/,'') + 'M';
  if (abs >= 1e3) return (n/1e3).toFixed(0) + 'K';
  return String(n);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rpt-custom-tooltip">
        <p className="rpt-tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="rpt-tooltip-entry">
            <span className="rpt-tooltip-dot" style={{ backgroundColor: entry.color }}></span>
            <span className="rpt-tooltip-name">{entry.name}:</span>
            <span className="rpt-tooltip-value">{currency(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const calcDelta = (current, previous) => {
  const prev = Number(previous) || 0;
  if (!prev) return 0;
  return (Number(current || 0) - prev) / prev;
};

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const TrendUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const TrendDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
    <polyline points="17 18 23 18 23 12"/>
  </svg>
);

const WalletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
    <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>
  </svg>
);

const PercentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19"/>
    <circle cx="6.5" cy="6.5" r="2.5"/>
    <circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
);

export default function ReportsScreen({
  summary,
  monthlySeries,
  breakdown = [],
  transactions = [],
  reportsOverview,
  userEmail,
  onBack,
  savingsGoals = [],
  filters,
  onFiltersChange,
}) {
  const [activeTab, setActiveTab] = useState("30 ngày");
  const [paymentPage, setPaymentPage] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedHeatmap, setSelectedHeatmap] = useState(null);
  const PAYMENT_PER_PAGE = 3;


  const safeMonthly = Array.isArray(monthlySeries) ? monthlySeries : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const overview = reportsOverview || {};

  const dailySeries = Array.isArray(overview.daily_series) ? overview.daily_series : [];
  const monthlyOverviewSeries = Array.isArray(overview.monthly_series) ? overview.monthly_series : [];
  const categorySpending = Array.isArray(overview.category_spending) ? overview.category_spending : [];
  const paymentBreakdown = Array.isArray(overview.payment_breakdown) ? overview.payment_breakdown : [];
  const weekdayHeatmap = Array.isArray(overview.weekday_heatmap) ? overview.weekday_heatmap : [];
  const topExpenses = Array.isArray(overview.top_expenses) ? overview.top_expenses : [];
  const goalProgress = Array.isArray(overview.goals) ? overview.goals : [];

  const currentMonthly = safeMonthly[safeMonthly.length - 1] || {};
  const prevMonthly = safeMonthly[safeMonthly.length - 2] || safeMonthly[safeMonthly.length - 1] || {};

  const currentNet = Number(currentMonthly.income || summary?.balance || 0) - Number(currentMonthly.expense || 0);
  const prevNet = Number(prevMonthly.income || summary?.balance || 0) - Number(prevMonthly.expense || 0);

  const currentSavingsRate = savingsGoals.length > 0 
    ? savingsGoals.reduce((s, g) => s + (g.current_amount || 0), 0) / savingsGoals.reduce((s, g) => s + (g.target_amount || 1), 0)
    : 0;

  const prevSavingsRate = Number(prevMonthly.income || summary?.total_income || 0) > 0
    ? Math.max(0, prevNet) / Number(prevMonthly.income || summary?.total_income || 1)
    : 0;

  const getKPI = () => {
    const dInc = calcDelta(currentMonthly.income || summary?.total_income || 0, prevMonthly.income || 0);
    const dExp = calcDelta(currentMonthly.expense || summary?.total_expense || 0, prevMonthly.expense || 0);
    const dNet = calcDelta(currentNet, prevNet);
    const dSav = currentSavingsRate - prevSavingsRate;
    return { dInc, dExp, dNet, dSav };
  };
  const { dInc, dExp, dNet, dSav } = getKPI();

  const donutTotal = categorySpending.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const donutItems = useMemo(() => {
    const sorted = [...categorySpending].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    
    if (others.length === 0) return top5.map(item => ({ ...item, share: Number(item.share || 0) || Number(item.amount || 0) / (donutTotal || 1) }));

    const othersAmount = others.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const total = (donutTotal || 1);
    
    return [
      ...top5.map(item => ({ ...item, share: Number(item.share || 0) || Number(item.amount || 0) / total })),
      { category: "Khác", amount: othersAmount, share: othersAmount / total }
    ];
  }, [categorySpending, donutTotal]);

  const donutChartData = donutItems.map((i) => ({ name: i.category, value: i.amount, share: i.share }));
  const donutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent: p, name }) => {
    if ((p||0) < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {Math.round((p||0)*100)}%
      </text>
    );
  };

  const trendSeries = dailySeries.slice(-30).map((item) => ({
    label: item.label || "",
    income: Number(item.income || 0),
    expense: Number(item.expense || 0),
  }));

  const fallbackMonthly = (Array.isArray(monthlySeries) ? monthlySeries : []).map((m) => ({
    label: String(m.month || "").slice(-5).replace("-", "/") || "N/A",
    income: Number(m.income || 0),
    expense: Number(m.expense || 0),
  }));
  const monthlyBarsRaw = monthlyOverviewSeries.slice(-6).map((m) => ({
    label: String(m.label || "").slice(-5).replace("-", "/") || "N/A",
    income: Number(m.income || 0),
    expense: Number(m.expense || 0),
  }));
  const monthlyBars = monthlyBarsRaw.length >= 3 ? monthlyBarsRaw : fallbackMonthly.slice(-6);

  const heatmapMax = Math.max(1, ...weekdayHeatmap.map((cell) => Number(cell.total || 0)));
  const heatmapValue = (weekIndex, weekDay) =>
    Number(weekdayHeatmap.find((cell) => cell.week_index === weekIndex && cell.week_day === weekDay)?.total || 0);

  const topTransactions = topExpenses.length
    ? topExpenses
    : [...safeTransactions]
        .filter((t) => t.transaction_type === "expense")
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 5);

  const topCategory = donutItems[0];
  const aiTipText = topCategory
    ? `Danh mục ${topCategory.category} đang chiếm ${percent(topCategory.share)} tổng chi trong kỳ. Bạn có thể giảm 10-15% nhóm này để cải thiện tiết kiệm ròng.`
    : "Chưa đủ dữ liệu để tạo gợi ý AI. Hãy thêm giao dịch để nhận khuyến nghị chính xác hơn.";

  const handleApplyRange = (start, end) => {
    onFiltersChange(prev => ({ ...prev, start, end }));
    setShowDatePicker(false);
  };

  const handlePresetClick = (preset) => {
    setActiveTab(preset);
    const d = new Date();
    const end = toD(d);
    let start = end;
    if(preset==="7 ngày") { d.setDate(d.getDate()-7); start = toD(d); }
    else if(preset==="30 ngày") { d.setDate(d.getDate()-30); start = toD(d); }
    else if(preset==="3 tháng") { d.setMonth(d.getMonth()-3); start = toD(d); }
    else if(preset==="6 tháng") { d.setMonth(d.getMonth()-6); start = toD(d); }
    handleApplyRange(start, end);
  };

  return (
    <div className="rpt-container">
      <div className="rpt-header-top">
        <div className="rpt-title-block">
          <h1 className="rpt-title">Báo cáo & Phân tích</h1>
        </div>
        <div className="rpt-header-actions">
          <div className="rpt-tx-date-filter">
             <button className="rpt-date-range-btn" onClick={() => setShowDatePicker(!showDatePicker)}>
                <CalendarIcon />
                <span>{activeTab === "Tùy chỉnh" ? `${formatDateFull(filters.start)} - ${formatDateFull(filters.end)}` : activeTab}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
             </button>
             
             {showDatePicker && (
               <div className="rpt-date-picker-dropdown">
                  <div className="rpt-picker-presets">
                    {["7 ngày","30 ngày","3 tháng","6 tháng"].map(t => (
                      <button key={t} className={`rpt-picker-preset ${activeTab===t?"active":""}`} onClick={() => handlePresetClick(t)}>{t}</button>
                    ))}
                  </div>
                  <div className="rpt-picker-custom">
                     <div className="rpt-picker-field">
                        <label>Từ ngày</label>
                        <input type="date" value={filters.start} onChange={e => { onFiltersChange(p=>({...p, start: e.target.value})); setActiveTab("Tùy chỉnh"); }} />
                     </div>
                     <div className="rpt-picker-field">
                        <label>Đến ngày</label>
                        <input type="date" value={filters.end} onChange={e => { onFiltersChange(p=>({...p, end: e.target.value})); setActiveTab("Tùy chỉnh"); }} />
                     </div>
                     <button className="rpt-picker-apply" onClick={() => setShowDatePicker(false)}>Áp dụng</button>
                  </div>
               </div>
             )}
          </div>
          <button className="rpt-btn-export">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Xuất báo cáo
          </button>
        </div>
      </div>

      <div className="rpt-kpi-row">
        <div className="rpt-kpi-card">
          <div className="rpt-kpi-icon income"><TrendUpIcon/></div>
          <div className="rpt-kpi-text">
             <label>Tổng thu nhập</label>
             <h3 className="income">{currency(summary?.total_income || 0)}</h3>
             <div className={`rpt-kpi-delta ${dInc >= 0 ? "up" : "down"}`}>
               {dInc >= 0 ? '↑' : '↓'} {(Math.abs(dInc * 100)).toFixed(1)}% <span className="muted">với tháng trước</span>
             </div>
          </div>
        </div>

        <div className="rpt-kpi-card">
          <div className="rpt-kpi-icon expense"><TrendDownIcon/></div>
          <div className="rpt-kpi-text">
             <label>Tổng chi tiêu</label>
             <h3 className="expense">{currency(summary?.total_expense || 0)}</h3>
             <div className={`rpt-kpi-delta ${dExp > 0 ? "down" : "up"}`}>
               {dExp > 0 ? '↓' : '↑'} {(Math.abs(dExp * 100)).toFixed(1)}% <span className="muted">với tháng trước</span>
             </div>
          </div>
        </div>

        <div className="rpt-kpi-card">
          <div className="rpt-kpi-icon savings"><WalletIcon/></div>
          <div className="rpt-kpi-text">
             <label>Tiết kiệm</label>
             <h3 className="savings">{currency(currentNet || 0)}</h3>
             <div className={`rpt-kpi-delta ${dSav >= 0 ? "up" : "down"}`}>
               {dSav >= 0 ? '↑' : '↓'} {(Math.abs(dSav * 100)).toFixed(1)}% <span className="muted">với tháng trước</span>
             </div>
          </div>
        </div>

        <div className="rpt-kpi-card">
          <div className="rpt-kpi-icon savings"><PercentIcon/></div>
          <div className="rpt-kpi-text">
             <label>Tỷ lệ tiết kiệm</label>
             <h3 className="savings">{(currentSavingsRate * 100).toFixed(1)}%</h3>
             <div className={`rpt-kpi-delta ${dSav >= 0 ? "up" : "down"}`}>
               {dSav >= 0 ? "↑" : "↓"} {(Math.abs(dSav * 100)).toFixed(1)}% <span className="muted">với tháng trước</span>
             </div>
          </div>
        </div>

        <div className="rpt-kpi-card">
          <div className="rpt-kpi-icon income"><CalendarIcon/></div>
          <div className="rpt-kpi-text">
             <label>Ngân sách đã dùng</label>
             <h3 className="expense">
               {summary?.total_income ? `${Math.min(999, ((summary?.total_expense || 0) / (summary?.total_income || 1) * 100)).toFixed(1)}%` : "0%"}
             </h3>
             <div className="rpt-kpi-delta up">
               Theo kỳ lọc hiện tại
             </div>
          </div>
        </div>
      </div>

      <div className="rpt-body-cols">
         <div className="rpt-col-left">
            <div className="rpt-card">
               <div className="rpt-card-header">
                  <h3>Biến động thu chi</h3>
                  <div className="rpt-legend">
                     <div className="rpt-legend-item"><span className="dot income"/> Thu nhập</div>
                     <div className="rpt-legend-item"><span className="dot expense"/> Chi tiêu</div>
                  </div>
               </div>
               
               <div className="trend-area-chart">
                 <ResponsiveContainer width="100%" height={280}>
                   <AreaChart data={trendSeries}>
                     <defs>
                       <linearGradient id="repInc" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                         <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                       </linearGradient>
                       <linearGradient id="repExp" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                         <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                       </linearGradient>
                     </defs>
                     <ReCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <ReXAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                     <ReYAxis width={65} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={fmt} />
                     <ReTooltip content={<CustomTooltip />} />
                     <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#repInc)" strokeWidth={3} animationDuration={1000} />
                     <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#repExp)" strokeWidth={3} animationDuration={1000} />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="rpt-analytics-grid">
              <div className="rpt-card">
               <div className="rpt-card-header">
                  <h3>Chi tiêu theo danh mục</h3>
               </div>
               <div className="donut-container">
                  <div className="donut-svg-wrapper">
                     <ResponsiveContainer width="100%" height={220}>
                       <PieChart>
                         <Pie
                           data={donutChartData}
                           dataKey="value"
                           nameKey="name"
                           innerRadius={65}
                           outerRadius={95}
                           paddingAngle={4}
                           labelLine={false}
                           label={donutLabel}
                           animationDuration={800}
                         >
                           {donutItems.map((item) => (
                             <Cell key={item.category} fill={colorFor(item.category, userEmail)} stroke="none" />
                           ))}
                         </Pie>
                         <ReTooltip content={<CustomTooltip />} />
                       </PieChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="donut-footer-text">
                     <span>Tổng chi tiêu trong kỳ</span>
                     <strong>{currency(donutTotal)}</strong>
                  </div>
               </div>

              </div>

              <div className="rpt-card">
                <div className="rpt-card-header">
                  <h3>Phân bổ nguồn tiền</h3>
                  <div className="rpt-pagination">
                    <button disabled={paymentPage === 0} onClick={() => setPaymentPage(p => p - 1)}>‹</button>
                    <button disabled={(paymentPage + 1) * PAYMENT_PER_PAGE >= paymentBreakdown.length} onClick={() => setPaymentPage(p => p + 1)}>›</button>
                  </div>
                </div>
                <div className="rpt-source-bars">
                  {paymentBreakdown.length ? paymentBreakdown.slice(paymentPage * PAYMENT_PER_PAGE, (paymentPage + 1) * PAYMENT_PER_PAGE).map((item) => (
                    <div className="rpt-source-item" key={item.source}>
                      <div className="rpt-source-head">
                        <span>{item.source}</span>
                        <strong>{currency(item.amount)}</strong>
                      </div>
                      <div className="rpt-source-track">
                        <div className="rpt-source-fill" style={{ width: `${Math.max(4, (item.share || 0) * 100)}%` }} />
                      </div>
                    </div>
                  )) : <p className="muted">Chưa có dữ liệu nguồn tiền.</p>}
                </div>
              </div>

              <div className="rpt-card">
                <div className="rpt-card-header">
                  <h3>Tỷ lệ tiết kiệm theo tháng</h3>
                </div>
                <div className="rpt-month-bars">
                  {monthlyBars.map((item) => {
                    const rate = item.income > 0 ? (item.income - item.expense) / item.income : 0;
                    return (
                      <div className="rpt-month-bar-item" key={item.label}>
                        <span>{item.label}</span>
                        <div className="rpt-month-bar-track">
                          <div className={`rpt-month-bar-fill ${rate >= 0 ? "up" : "down"}`} style={{ width: `${Math.min(100, Math.abs(rate) * 100)}%` }} />
                        </div>
                        <strong>{(rate * 100).toFixed(1)}%</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rpt-analytics-grid">
              <div className="rpt-card">
                <div className="rpt-card-header">
                  <h3>Giao dịch theo ngày trong tuần</h3>
                </div>
                <div className="rpt-heatmap-header">
                  <p className="rpt-heatmap-tip">{selectedHeatmap ? `Ngày: ${selectedHeatmap.day}, Chi: ${currency(selectedHeatmap.val)}` : "Bấm vào ô để xem chi tiết"}</p>
                </div>
                <div className="rpt-heatmap">
                  {[0, 1, 2, 3, 4].map((w) => (
                    <div key={`week-${w}`} className="rpt-heatmap-col">
                      {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                        const val = heatmapValue(w, d);
                        const opacity = val > 0 ? Math.max(0.15, val / heatmapMax) : 0.05;
                        const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
                        return (
                          <span 
                            key={`cell-${w}-${d}`} 
                            style={{ opacity, cursor: 'pointer' }} 
                            title={currency(val)} 
                            onClick={() => setSelectedHeatmap({ day: `Tuần ${w+1}, ${dayNames[d]}`, val })}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

              </div>

              <div className="rpt-card">
                <div className="rpt-card-header">
                  <h3>Top danh mục chi tiêu</h3>
                </div>
                <div className="rpt-top-category-list">
                  {categorySpending.slice(0, 6).map((item) => (
                    <div key={item.category} className="rpt-top-category-item">
                      <span>{item.category}</span>
                      <div className="rpt-top-category-track">
                        <div className="rpt-top-category-fill" style={{ width: `${Math.max(5, (item.share || 0) * 100)}%` }} />
                      </div>
                      <strong>{currency(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rpt-card">
                <div className="rpt-card-header">
                  <h3>Tiến độ mục tiêu tiết kiệm</h3>
                </div>
                <div className="rpt-goal-list">
                  {goalProgress.length ? goalProgress.map((goal) => (
                    <div key={goal.name} className="rpt-goal-item">
                      <div className="rpt-goal-head">
                        <span>{goal.name}</span>
                        <strong>{Math.round((goal.progress || 0) * 100)}%</strong>
                      </div>
                      <div className="rpt-goal-track">
                        <div className="rpt-goal-fill" style={{ width: `${Math.max(2, (goal.progress || 0) * 100)}%` }} />
                      </div>
                      <p>{currency(goal.saved_amount)} / {currency(goal.target_amount)}</p>
                    </div>
                  )) : <p className="muted">Chưa có mục tiêu tiết kiệm.</p>}
                </div>
              </div>
            </div>
         </div>

         <div className="rpt-col-right">
            <div className="rpt-ai-card">
               <div className="rpt-ai-header">
                  <div className="ai-icon">✨</div>
                  <h3>Gợi ý AI <span className="ai-badge">Mới</span></h3>
               </div>
               <p className="ai-desc">{aiTipText}</p>
               <button className="ai-btn-view">Xem chi tiết</button>
            </div>

            <div className="rpt-card">
               <div className="rpt-card-header">
                  <h3>Các khoản chi lớn nhất</h3>
                  <a href="#" className="rpt-view-all">Xem tất cả</a>
               </div>
               <div className="rpt-tx-list">
                  {topTransactions.length > 0 ? topTransactions.map((tx, idx) => {
                     const txCategory = tx.category || tx.categoryLabel || "Khác";
                     const catMeta = getCatMeta(txCategory);
                     return (
                        <div key={idx} className="rpt-tx-item">
                           <div className="rpt-tx-icon" style={{background: `${catMeta.bg}22`, color: catMeta.bg}}>
                              <catMeta.SvgIcon size={18} />
                           </div>
                           <div className="rpt-tx-info">
                              <span className="rpt-tx-title">{tx.description || txCategory}</span>
                              <span className="rpt-tx-cat">{txCategory} · {formatDateFull(tx.date)}</span>
                           </div>
                           <div className="rpt-tx-amount">
                              -{currency(Math.abs(tx.amount))}
                           </div>
                        </div>
                     );
                  }) : <p className="muted" style={{fontSize: 13}}>Không có giao dịch lớn nào.</p>}
               </div>
            </div>

            <div className="rpt-card">
              <div className="rpt-card-header">
                <h3>Xu hướng ngân sách</h3>
              </div>
              <div className="trend-area-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyBars}>
                    <ReCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <ReXAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <ReYAxis width={65} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={fmt} />
                    <ReTooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                    <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
         </div>
      </div>

    </div>
  );
}
