import { useRef, useState } from "react";
import { getAnomalies, getForecast, getSavingsTips } from "../../api/ai.js";
import { colorFor } from "../../utils/colors.js";
import { currency, formatDateFull, percent } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";

const buildDonutItems = (breakdown, limit, otherLabel) => {
  if (!breakdown.length) return [];
  const sorted = [...breakdown].sort((a, b) => b.spent - a.spent);
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

const buildSmoothPath = (points) => {
  if (points.length <= 1) {
    return points.length ? `M ${points[0].x} ${points[0].y}` : "";
  }
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

const buildHeatmapData = (transactions, weeks = 6) => {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const totalDays = weeks * 7;
  const dates = safeTransactions.map((item) => item.date).filter(Boolean).sort();
  const end = dates.length ? new Date(dates[dates.length - 1]) : new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - (totalDays - 1));
  const dayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOffset);
  const cells = [];
  const valuesMap = {};
  safeTransactions
    .filter((item) => item.transaction_type === "expense")
    .forEach((item) => {
      if (!item.date) return;
      const key = item.date;
      valuesMap[key] = (valuesMap[key] || 0) + Number(item.amount || 0);
    });
  let max = 0;
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    const value = valuesMap[key] || 0;
    max = Math.max(max, value);
    cells.push({ date, value, key });
  }
  return { cells, max, weeks, start };
};

const buildTrendSource = (transactions, fallback) => {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  if (!safeTransactions.length) {
    return { series: fallback, mode: "month" };
  }
  const dates = safeTransactions.map((item) => item.date).filter(Boolean).sort();
  if (!dates.length) {
    return { series: fallback, mode: "month" };
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
      expense: values.expense,
      net: values.income - values.expense,
      value: values.income - values.expense
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return { series: series.length ? series : fallback, mode: useDaily ? "day" : "month" };
};

const formatCompactMoney = (value) => {
  const amount = Math.abs(Number(value) || 0);
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return `${Math.round(amount)}`;
};

const formatSeriesLabel = (value, mode = "month") => {
  const raw = String(value || "");
  if (mode === "day" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [, month, day] = raw.split("-");
    return `${day}/${month}`;
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [, month] = raw.split("-");
    return `T${Number(month)}`;
  }
  return raw.slice(-5) || raw;
};

const calcDelta = (current, previous) => {
  const prev = Number(previous) || 0;
  if (!prev) return 0;
  return (Number(current || 0) - prev) / prev;
};

const buildLineSeries = (items) => {
  const safe = Array.isArray(items) ? items : [];
  if (!safe.length) {
    return {
      width: 100,
      height: 62,
      paddingX: 6,
      paddingY: 8,
      gridLines: [],
      incomePoints: [],
      expensePoints: [],
      incomePath: "",
      expensePath: "",
      labels: [],
      maxValue: 1,
      items: []
    };
  }

  const width = 100;
  const height = 62;
  const paddingLeft = 8;
  const paddingRight = 3;
  const paddingTop = 7;
  const paddingBottom = 8;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(1, ...safe.flatMap((item) => [Number(item.income || 0), Number(item.expense || 0)]));
  const stepX = safe.length > 1 ? innerWidth / (safe.length - 1) : 0;
  const toY = (value) => paddingTop + (1 - Number(value || 0) / maxValue) * innerHeight;
  const incomePoints = safe.map((item, index) => ({
    x: paddingLeft + index * stepX,
    y: toY(item.income)
  }));
  const expensePoints = safe.map((item, index) => ({
    x: paddingLeft + index * stepX,
    y: toY(item.expense)
  }));
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      y: paddingTop + (1 - ratio) * innerHeight,
      value: ratio * maxValue
    };
  });

  return {
    width,
    height,
    paddingX: paddingLeft,
    paddingY: paddingTop,
    gridLines,
    incomePoints,
    expensePoints,
    incomePath: buildSmoothPath(incomePoints),
    expensePath: buildSmoothPath(expensePoints),
    labels: safe.map((item) => item.label),
    maxValue,
    items: safe
  };
};

export default function ReportsScreen({
  summary,
  monthlySeries,
  breakdown = [],
  transactions = [],
  userEmail,
  onBack
}) {
  const safeMonthly = Array.isArray(monthlySeries) ? monthlySeries : [];
  const safeBreakdown = Array.isArray(breakdown) ? breakdown : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeSummary = {
    total_income: Number(summary?.total_income || 0),
    total_expense: Number(summary?.total_expense || 0),
    balance: Number(summary?.balance || 0)
  };
  const [showForecast, setShowForecast] = useState(false);
  const [showSavingTips, setShowSavingTips] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);
  const [trendRange, setTrendRange] = useState("month");
  const [forecastLoading, setForecastLoading] = useState(false);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [savingsError, setSavingsError] = useState("");
  const [anomalyError, setAnomalyError] = useState("");
  const [forecastData, setForecastData] = useState(null);
  const [savingsData, setSavingsData] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [donutTooltip, setDonutTooltip] = useState(null);
  const [trendHoverIndex, setTrendHoverIndex] = useState(null);
  const donutRef = useRef(null);
  const prevMonthly = safeMonthly[safeMonthly.length - 2] || safeMonthly[safeMonthly.length - 1] || {};
  const currentMonthly = safeMonthly[safeMonthly.length - 1] || {};
  const currentNet = Number(currentMonthly.income || safeSummary.balance || 0) - Number(currentMonthly.expense || 0);
  const prevNet = Number(prevMonthly.income || safeSummary.balance || 0) - Number(prevMonthly.expense || 0);
  const currentSavingsRate =
    Number(currentMonthly.income || safeSummary.total_income || 0) > 0
      ? currentNet / Number(currentMonthly.income || safeSummary.total_income || 1)
      : 0;
  const prevSavingsRate =
    Number(prevMonthly.income || safeSummary.total_income || 0) > 0
      ? prevNet / Number(prevMonthly.income || safeSummary.total_income || 1)
      : 0;

  const kpiCards = [
    {
      label: t("reports.total_income", null, "Tổng thu"),
      value: currency(safeSummary.total_income),
      delta: calcDelta(currentMonthly.income || safeSummary.total_income || 0, prevMonthly.income || 0),
      icon: "↑",
      tone: "income"
    },
    {
      label: t("reports.total_expense", null, "Tổng chi"),
      value: currency(safeSummary.total_expense),
      delta: calcDelta(currentMonthly.expense || safeSummary.total_expense || 0, prevMonthly.expense || 0),
      icon: "↓",
      tone: "expense"
    },
    {
      label: t("reports.balance", null, "Tiết kiệm ròng"),
      value: currency(safeSummary.balance),
      delta: calcDelta(currentNet, prevNet),
      icon: "▣",
      tone: "balance"
    },
    {
      label: t("reports.savings_rate", null, "Tỷ lệ tiết kiệm"),
      value: `${(currentSavingsRate * 100).toFixed(2)}%`,
      delta: currentSavingsRate - prevSavingsRate,
      icon: "%",
      tone: "rate"
    }
  ];
  const donutItems = buildDonutItems(safeBreakdown, 5, t("reports.other", null, "Khác"));
  const donutTotal = donutItems.reduce((sum, item) => sum + item.spent, 0);
  const topCategories = [...safeBreakdown].sort((a, b) => b.spent - a.spent).slice(0, 6);
  const budgetRows = topCategories.slice(0, 5).map((item, index) => {
    const targetFactor = [1.3, 1.24, 1.18, 1.1, 1.04][index] || 1.2;
    const target = Math.max(1, Math.round(item.spent * targetFactor));
    const ratio = target ? item.spent / target : 0;
    return { ...item, target, ratio };
  });

  const { series: trendSource, mode: trendMode } = buildTrendSource(safeTransactions, safeMonthly);
  const trendLimit = trendRange === "week" ? 7 : trendRange === "month" ? 8 : 12;
  const trendItems = trendSource.slice(-trendLimit).map((item) => ({
    ...item,
    label: formatSeriesLabel(item.month, trendMode)
  }));
  const trendLine = buildLineSeries(trendItems);
  const trendLabelStep = trendLine.labels.length > 8 ? Math.ceil(trendLine.labels.length / 6) : 1;

  const heatmap = buildHeatmapData(safeTransactions);
  const heatmapMonthLabels = Array.from({ length: heatmap.weeks }).map((_, column) => {
    const cell = heatmap.cells[column * 7];
    return cell ? `T${cell.date.getMonth() + 1}` : "";
  });

  const monthlyBars = safeMonthly.slice(-6).map((item) => ({
    label: formatSeriesLabel(item.month, "month"),
    income: Number(item.income || 0),
    expense: Number(item.expense || 0),
    net: Number(item.income || 0) - Number(item.expense || 0)
  }));
  const maxMonthlyBar = Math.max(1, ...monthlyBars.flatMap((item) => [item.income, item.expense]));
  const netSeries = monthlyBars;
  const maxNetAbs = Math.max(1, ...netSeries.map((item) => Math.abs(item.net)));
  const netAverage = netSeries.length
    ? netSeries.reduce((sum, item) => sum + item.net, 0) / netSeries.length
    : 0;
  const bestNet = netSeries.reduce((best, item) => (item.net > best.net ? item : best), {
    label: "-",
    net: 0
  });
  const worstNet = netSeries.reduce((worst, item) => (item.net < worst.net ? item : worst), {
    label: "-",
    net: 0
  });

  const largestTransactions = [...safeTransactions]
    .filter((item) => item.transaction_type === "expense")
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5);

  const weekLabels = [
    t("reports.weekday.mon", null, "T2"),
    t("reports.weekday.tue", null, "T3"),
    t("reports.weekday.wed", null, "T4"),
    t("reports.weekday.thu", null, "T5"),
    t("reports.weekday.fri", null, "T6"),
    t("reports.weekday.sat", null, "T7"),
    t("reports.weekday.sun", null, "CN")
  ];
  const handleDonutMove = (event, item) => {
    if (!donutRef.current) return;
    const rect = donutRef.current.getBoundingClientRect();
    setDonutTooltip({
      item,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const handleTrendMove = (event) => {
    if (!trendLine.items.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.min(
      trendLine.items.length - 1,
      Math.max(0, Math.round(ratio * (trendLine.items.length - 1)))
    );
    setTrendHoverIndex(index);
  };

  const loadForecast = async () => {
    if (forecastLoading) return;
    setForecastError("");
    setForecastLoading(true);
    try {
      const data = await getForecast();
      setForecastData(data || null);
    } catch (err) {
      setForecastError(err?.message || t("reports.ai_error", null, "Không thể tải AI Insights. Vui lòng thử lại."));
    } finally {
      setForecastLoading(false);
    }
  };

  const loadSavingsTips = async () => {
    if (savingsLoading) return;
    setSavingsError("");
    setSavingsLoading(true);
    try {
      const data = await getSavingsTips();
      setSavingsData(data || null);
    } catch (err) {
      setSavingsError(err?.message || t("reports.ai_error", null, "Không thể tải AI Insights. Vui lòng thử lại."));
    } finally {
      setSavingsLoading(false);
    }
  };

  const loadAnomalies = async () => {
    if (anomalyLoading) return;
    setAnomalyError("");
    setAnomalyLoading(true);
    try {
      const data = await getAnomalies();
      const items = Array.isArray(data) ? data : data?.alerts || data?.items || data || [];
      setAnomalyData(Array.isArray(items) ? items : []);
    } catch (err) {
      setAnomalyError(err?.message || t("reports.ai_error", null, "Không thể tải AI Insights. Vui lòng thử lại."));
    } finally {
      setAnomalyLoading(false);
    }
  };

  const riskLabel = (risk) => {
    if (risk === "high") return t("reports.risk.high", null, "Cao");
    if (risk === "medium") return t("reports.risk.medium", null, "Trung bình");
    return t("reports.risk.low", null, "Thấp");
  };

  return (
    <section className="panel report-page reports-premium">
      <header className="transactions-header" style={{ marginBottom: 14 }}>
        <div>
          <p className="eyebrow">Finance Workspace</p>
          <h2>{t("reports.title")}</h2>
        </div>

        <div className="transactions-actions">
          <button className="ghost" onClick={onBack} type="button">
            {t("common.back")}
          </button>
        </div>
      </header>
      <div className="report-kpi-grid">
        {kpiCards.map((card) => {
          const up = card.delta >= 0;
          return (
            <article key={card.label} className={`report-kpi-card ${card.tone}`}>
              <span className="report-kpi-icon" aria-hidden="true">
                {card.icon}
              </span>
              <div>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
                <small className={up ? "up" : "down"}>
                  {up ? "+" : ""}
                  {(Math.abs(card.delta) * 100).toFixed(1)}% so với kỳ trước
                </small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="report-premium-row report-premium-main">
        <article className="report-surface report-trend-surface">
          <div className="report-surface-head">
            <h3>{t("reports.net_trend", null, "Xu hướng dòng tiền")}</h3>
            <div className="report-range-tabs">
              {[
                { key: "week", label: "Week" },
                { key: "month", label: "Month" },
                { key: "year", label: "Year" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={trendRange === item.key ? "active" : ""}
                  onClick={() => {
                    setTrendRange(item.key);
                    setTrendHoverIndex(null);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="report-legend-inline">
            <span className="legend-swatch income" />
            <span>{t("reports.income", null, "Thu nhập")}</span>
            <span className="legend-swatch expense" />
            <span>{t("reports.expense", null, "Chi tiêu")}</span>
          </div>

          {trendLine.items.length ? (
            <div
              className="premium-line-chart"
              onMouseMove={handleTrendMove}
              onMouseLeave={() => setTrendHoverIndex(null)}
            >
              <svg viewBox={`0 0 ${trendLine.width} ${trendLine.height}`} aria-hidden="true">
                {trendLine.gridLines.map((tick, index) => (
                  <g key={`line-grid-${index}`}>
                    <line
                      className="premium-line-grid"
                      x1={trendLine.paddingX}
                      x2={trendLine.width - 2}
                      y1={tick.y}
                      y2={tick.y}
                    />
                    <text className="premium-line-y-label" x="0.6" y={tick.y + 1.8}>
                      {formatCompactMoney(tick.value)}
                    </text>
                  </g>
                ))}
                <path className="premium-line income" d={trendLine.incomePath} />
                <path className="premium-line expense" d={trendLine.expensePath} />
                {trendLine.incomePoints.map((point, index) => (
                  <circle key={`income-point-${index}`} className="premium-line-dot income" cx={point.x} cy={point.y} r="1.2" />
                ))}
                {trendLine.expensePoints.map((point, index) => (
                  <circle
                    key={`expense-point-${index}`}
                    className="premium-line-dot expense"
                    cx={point.x}
                    cy={point.y}
                    r="1.2"
                  />
                ))}
                {trendHoverIndex !== null && trendLine.items[trendHoverIndex] ? (
                  <line
                    className="premium-line-cursor"
                    x1={trendLine.incomePoints[trendHoverIndex].x}
                    x2={trendLine.incomePoints[trendHoverIndex].x}
                    y1={trendLine.paddingY - 1}
                    y2={trendLine.height - 7}
                  />
                ) : null}
              </svg>
              {trendHoverIndex !== null && trendLine.items[trendHoverIndex] ? (
                <div
                  className="premium-line-tooltip"
                  style={{
                    left: `${(trendLine.incomePoints[trendHoverIndex].x / trendLine.width) * 100}%`,
                    top: `${(Math.min(
                      trendLine.incomePoints[trendHoverIndex].y,
                      trendLine.expensePoints[trendHoverIndex].y
                    ) / trendLine.height) * 100}%`
                  }}
                >
                  <strong>{trendLine.items[trendHoverIndex].label}</strong>
                  <span className="income">Thu: {currency(trendLine.items[trendHoverIndex].income)}</span>
                  <span className="expense">Chi: {currency(trendLine.items[trendHoverIndex].expense)}</span>
                </div>
              ) : null}
              <div className="premium-line-labels">
                {trendLine.labels.map((label, index) => (
                  <span key={`${label}-${index}`}>{index % trendLabelStep === 0 ? label : ""}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">{t("reports.empty", null, "Chưa có dữ liệu.")}</p>
          )}
        </article>

        <article className="report-surface report-donut-surface">
          <div className="report-surface-head">
            <h3>{t("reports.category_split", null, "Cơ cấu chi tiêu")}</h3>
            <span className="badge">6 tháng gần nhất</span>
          </div>
          {donutItems.length ? (
            <>
              <div className="donut-chart" ref={donutRef} onMouseLeave={() => setDonutTooltip(null)}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="donut-bg" cx="60" cy="60" r="46" />
                  {(() => {
                    let offset = 0;
                    return donutItems.map((item) => {
                      const length = item.share * 2 * Math.PI * 46;
                      const dash = `${length} ${2 * Math.PI * 46 - length}`;
                      const segment = (
                        <circle
                          key={item.category}
                          className="donut-segment"
                          cx="60"
                          cy="60"
                          r="46"
                          stroke={item.isOther ? "#9aa1b2" : colorFor(item.category, userEmail)}
                          strokeDasharray={dash}
                          strokeDashoffset={-offset}
                          onMouseMove={(event) => handleDonutMove(event, item)}
                        />
                      );
                      offset += length;
                      return segment;
                    });
                  })()}
                </svg>
                <div className="donut-center">
                  <span>{t("reports.total_expense", null, "Tổng chi")}</span>
                  <strong>{currency(safeSummary.total_expense || donutTotal)}</strong>
                </div>
                {donutTooltip ? (
                  <div className="donut-tooltip" style={{ left: donutTooltip.x, top: donutTooltip.y }}>
                    <strong>{donutTooltip.item.category}</strong>
                    <span>{currency(donutTooltip.item.spent)}</span>
                    <small>{percent(donutTooltip.item.share)}</small>
                  </div>
                ) : null}
              </div>
              <div className="donut-legend">
                {donutItems.map((item) => (
                  <div key={item.category} className="donut-legend-item">
                    <div className="donut-legend-label">
                      <span
                        className="dot"
                        style={{ background: item.isOther ? "#9aa1b2" : colorFor(item.category, userEmail) }}
                      />
                      <span>{item.category}</span>
                    </div>
                    <div className="donut-legend-meta">
                      <span>{percent(item.share)}</span>
                      <strong>{currency(item.spent)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty">{t("reports.empty_breakdown", null, "Chưa có dữ liệu chi tiêu")}</p>
          )}
        </article>
      </div>

      <div className="report-premium-row report-premium-mid">
        <article className="report-surface">
          <div className="report-surface-head">
            <h3>Thu - Chi theo tháng</h3>
            <span className="badge">6 tháng gần nhất</span>
          </div>
          <div className="report-legend-inline">
            <span className="legend-swatch income" />
            <span>Thu</span>
            <span className="legend-swatch expense" />
            <span>Chi</span>
          </div>
          <div className="premium-column-chart">
            {monthlyBars.map((item) => (
              <div key={item.label} className="premium-column-group">
                <div className="premium-column-stack">
                  <span className="bar-income" style={{ height: `${(item.income / maxMonthlyBar) * 100}%` }} />
                  <span className="bar-expense" style={{ height: `${(item.expense / maxMonthlyBar) * 100}%` }} />
                </div>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="report-surface">
          <div className="report-surface-head">
            <h3>Ngân sách theo danh mục</h3>
            <span className="badge">{formatSeriesLabel(currentMonthly.month || "", "month") || "Tháng này"}</span>
          </div>
          {budgetRows.length ? (
            <div className="premium-budget-list">
              {budgetRows.map((item) => (
                <div key={item.category} className="premium-budget-item">
                  <div className="premium-budget-row">
                    <div className="premium-budget-label">
                      <span className="dot" style={{ background: colorFor(item.category, userEmail) }} />
                      <span>{item.category}</span>
                    </div>
                    <strong>
                      {currency(item.spent)} / {currency(item.target)}
                    </strong>
                  </div>
                  <div className="premium-budget-track">
                    <span
                      className="premium-budget-fill"
                      style={{
                        width: `${Math.min(item.ratio * 100, 125)}%`,
                        background: colorFor(item.category, userEmail)
                      }}
                    />
                  </div>
                  <small className={item.ratio > 1 ? "expense" : "muted"}>
                    {(item.ratio * 100).toFixed(0)}%
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">{t("reports.empty_breakdown", null, "Chưa có dữ liệu chi tiêu")}</p>
          )}
        </article>

        <article className="report-surface">
          <div className="report-surface-head">
            <h3>Top giao dịch lớn nhất</h3>
            <span className="badge">{formatSeriesLabel(currentMonthly.month || "", "month") || "Tháng này"}</span>
          </div>
          {largestTransactions.length ? (
            <div className="premium-top-list">
              {largestTransactions.map((item) => (
                <div key={item.id || `${item.date}-${item.amount}-${item.description}`} className="premium-top-item">
                  <span
                    className="premium-top-icon"
                    style={{
                      background: `${colorFor(item.categoryLabel || item.description || "Khác", userEmail)}22`,
                      color: colorFor(item.categoryLabel || item.description || "Khác", userEmail)
                    }}
                  >
                    {(item.categoryLabel || item.description || "G").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="premium-top-meta">
                    <strong>{item.description || item.categoryLabel || "Giao dịch"}</strong>
                    <small>{formatDateFull(item.date)}</small>
                  </div>
                  <strong className="premium-top-amount">-{currency(Math.abs(Number(item.amount || 0)))}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">{t("reports.empty", null, "Chưa có dữ liệu.")}</p>
          )}
        </article>
      </div>

      <div className="report-premium-row report-premium-bottom">
        <article className="report-surface">
          <div className="report-surface-head">
            <h3>{t("reports.heatmap_spend", null, "Heatmap chi tiêu")}</h3>
            <span className="badge">6 tháng gần nhất</span>
          </div>
          <div className="premium-heatmap-top">
            <span />
            {heatmapMonthLabels.map((label, index) => (
              <span key={`month-${index}`}>{label}</span>
            ))}
          </div>
          <div className="heatmap">
            <div className="heatmap-labels">
              {weekLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="heatmap-grid">
              {Array.from({ length: heatmap.weeks }).map((_, column) => (
                <div key={`week-${column}`} className="heatmap-column">
                  {Array.from({ length: 7 }).map((__, row) => {
                    const index = column * 7 + row;
                    const cell = heatmap.cells[index];
                    if (!cell) return <span key={`cell-${column}-${row}`} className="heatmap-cell empty" />;
                    const intensity = heatmap.max ? cell.value / heatmap.max : 0;
                    const alpha = 0.12 + intensity * 0.7;
                    return (
                      <span
                        key={cell.key}
                        className="heatmap-cell"
                        style={{ background: `rgba(240, 113, 103, ${alpha})` }}
                        title={`${cell.key} • ${currency(cell.value)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="heatmap-legend">
              <span>{t("reports.heatmap_low", null, "Thấp")}</span>
              <div className="heatmap-scale">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={`scale-${index}`}
                    style={{ background: `rgba(240, 113, 103, ${0.12 + (index / 5) * 0.72})` }}
                  />
                ))}
              </div>
              <span>{t("reports.heatmap_high", null, "Cao")}</span>
            </div>
          </div>
        </article>

        <article className="report-surface">
          <div className="report-surface-head">
            <h3>Tiết kiệm ròng theo tháng</h3>
            <span className="badge">6 tháng gần nhất</span>
          </div>
          <div className="premium-net-layout">
            <div className="premium-net-chart">
              <div className="premium-net-bars">
                {netSeries.map((item) => (
                  <div key={item.label} className="premium-net-bar-item">
                    <span
                      className={`premium-net-bar ${item.net >= 0 ? "income" : "expense"}`}
                      style={{ height: `${(Math.abs(item.net) / maxNetAbs) * 100}%` }}
                    />
                    <small>{item.label}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="premium-net-stats">
              <div>
                <span>Trung bình tiết kiệm</span>
                <strong>{currency(netAverage)} / tháng</strong>
              </div>
              <div>
                <span>Tháng cao nhất</span>
                <strong>{currency(bestNet.net)}</strong>
                <small>{bestNet.label}</small>
              </div>
              <div>
                <span>Tháng thấp nhất</span>
                <strong>{currency(worstNet.net)}</strong>
                <small>{worstNet.label}</small>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className="panel">
        <h3>{t("reports.ai_title", null, "AI Insights")}</h3>
        <div className="row-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setShowForecast((v) => {
                const next = !v;
                if (next && !forecastData) loadForecast();
                return next;
              });
            }}
          >
            {t("reports.ai_forecast", null, "Dự đoán xu hướng chi tiêu")}
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setShowSavingTips((v) => {
                const next = !v;
                if (next && !savingsData) loadSavingsTips();
                return next;
              });
            }}
          >
            {t("reports.ai_saving", null, "Gợi ý tiết kiệm / cắt giảm")}
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setShowAnomaly((v) => {
                const next = !v;
                if (next && !anomalyData) loadAnomalies();
                return next;
              });
            }}
          >
            {t("reports.ai_anomaly", null, "Phát hiện bất thường chi tiêu")}
          </button>
        </div>

        {showForecast && (
          <div className="insight-card">
            <h4>{t("reports.forecast_title", null, "Xu hướng 3 tháng tới")}</h4>
            {forecastLoading && <p className="muted">{t("common.loading", null, "Đang tải...")}</p>}
            {!forecastLoading && forecastError && <p className="status error">{forecastError}</p>}
            {!forecastLoading && !forecastError && forecastData && (
              <>
                {forecastData.summary && <p className="muted">{forecastData.summary}</p>}
                {Array.isArray(forecastData.points) && forecastData.points.length > 0 && (
                  <ul>
                    {forecastData.points.map((point) => (
                      <li key={point.month || `${point.predicted_expense}`}>
                        <strong>{point.month}</strong>: {currency(point.predicted_expense || 0)}
                        {point.note ? ` • ${point.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {Array.isArray(forecastData.top_growing_categories) &&
                  forecastData.top_growing_categories.length > 0 && (
                    <p className="hint">
                      {t("reports.top_growing", null, "Danh mục nổi bật")}:{" "}
                      {forecastData.top_growing_categories.join(", ")}
                    </p>
                  )}
                {forecastData.risk_level && (
                  <p className="hint">
                    {t("reports.risk", null, "Mức rủi ro")}: {riskLabel(forecastData.risk_level)}
                  </p>
                )}
                {Array.isArray(forecastData.tips) && forecastData.tips.length > 0 && (
                  <>
                    <p className="hint">{t("reports.recommend", null, "Gợi ý")}</p>
                    <ul>
                      {forecastData.tips.map((tip, index) => (
                        <li key={`forecast-tip-${index}`}>{tip}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {showSavingTips && (
          <div className="insight-card">
            <h4>{t("reports.saving_title", null, "Gợi ý tiết kiệm")}</h4>
            {savingsLoading && <p className="muted">{t("common.loading", null, "Đang tải...")}</p>}
            {!savingsLoading && savingsError && <p className="status error">{savingsError}</p>}
            {!savingsLoading && !savingsError && savingsData && (
              <>
                {savingsData.summary && <p className="muted">{savingsData.summary}</p>}
                {Array.isArray(savingsData.tips) && savingsData.tips.length > 0 ? (
                  <ul>
                    {savingsData.tips.map((tip) => (
                      <li key={`${tip.category}-${tip.suggested_limit}`}>
                        <strong>{tip.category}</strong>: {currency(tip.current_spend || 0)} →{" "}
                        {currency(tip.suggested_limit || 0)}
                        {typeof tip.potential_saving === "number"
                          ? ` (${t("reports.potential_save", null, "tiết kiệm")}: ${currency(
                              tip.potential_saving
                            )})`
                          : ""}
                        {tip.tip ? ` • ${tip.tip}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">{t("reports.empty", null, "Chưa có dữ liệu.")}</p>
                )}
                {typeof savingsData.total_potential_saving === "number" && (
                  <p className="hint">
                    {t("reports.total_potential", null, "Tổng tiết kiệm tiềm năng")}:{" "}
                    {currency(savingsData.total_potential_saving)}
                  </p>
                )}
                {Array.isArray(savingsData.general_advice) && savingsData.general_advice.length > 0 && (
                  <>
                    <p className="hint">{t("reports.general_advice", null, "Lời khuyên chung")}</p>
                    <ul>
                      {savingsData.general_advice.map((item, index) => (
                        <li key={`advice-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {showAnomaly && (
          <div className="insight-card">
            <h4>{t("reports.anomaly_title", null, "Phát hiện bất thường")}</h4>
            {anomalyLoading && <p className="muted">{t("common.loading", null, "Đang tải...")}</p>}
            {!anomalyLoading && anomalyError && <p className="status error">{anomalyError}</p>}
            {!anomalyLoading && !anomalyError && Array.isArray(anomalyData) && (
              <>
                {anomalyData.length ? (
                  <ul>
                    {anomalyData.slice(0, 10).map((item) => (
                      <li key={item.id || `${item.date}-${item.amount}`}>
                        {item.description || t("reports.anomaly_item", null, "Phát hiện bất thường")}
                        {item.reason ? ` • ${item.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty">{t("reports.anomaly_none", null, "Chưa phát hiện bất thường.")}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
