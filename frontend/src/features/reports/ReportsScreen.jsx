import { useRef, useState } from "react";
import { colorFor } from "../../utils/colors.js";
import { currency, percent } from "../../utils/format.js";
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

const buildComboSeries = (series) => {
  const safeSeries = Array.isArray(series) ? series : [];
  const length = safeSeries.length;
  if (!length) {
    return {
      width: 100,
      height: 70,
      padding: 6,
      baseline: 35,
      bars: [],
      netPoints: [],
      cumulativePoints: [],
      netPath: "",
      cumulativePath: "",
      labels: [],
      items: []
    };
  }
  const width = 100;
  const height = 70;
  const padding = 6;
  const baseline = height / 2;
  const gap = (width - padding * 2) / length;
  const barWidth = gap * 0.6;
  const items = [];
  let cumulative = 0;
  const incomeValues = [];
  const expenseValues = [];
  safeSeries.forEach((item) => {
    const income = Number(item.income || 0);
    const expense = Number(item.expense || 0);
    const net = income - expense;
    cumulative += net;
    items.push({
      label: item.month.slice(5),
      income,
      expense,
      net,
      cumulative
    });
    incomeValues.push(income);
    expenseValues.push(expense);
  });
  const maxBar = Math.max(1, ...incomeValues, ...expenseValues);
  const maxLine = Math.max(
    1,
    ...items.map((item) => Math.abs(item.net)),
    ...items.map((item) => Math.abs(item.cumulative))
  );
  const barHeightMax = baseline - padding;
  const bars = items.map((item, index) => {
    const x = padding + index * gap + (gap - barWidth) / 2;
    const incomeHeight = (item.income / maxBar) * barHeightMax;
    const expenseHeight = (item.expense / maxBar) * barHeightMax;
    return {
      x,
      incomeHeight,
      expenseHeight,
      incomeY: baseline - incomeHeight,
      expenseY: baseline,
      width: barWidth
    };
  });
  const netPoints = items.map((item, index) => ({
    x: padding + index * gap + gap / 2,
    y: baseline - (item.net / maxLine) * barHeightMax,
    value: item.net
  }));
  const cumulativePoints = items.map((item, index) => ({
    x: padding + index * gap + gap / 2,
    y: baseline - (item.cumulative / maxLine) * barHeightMax,
    value: item.cumulative
  }));
  return {
    width,
    height,
    padding,
    baseline,
    bars,
    netPoints,
    cumulativePoints,
    netPath: buildSmoothPath(netPoints),
    cumulativePath: buildSmoothPath(cumulativePoints),
    labels: items.map((item) => item.label),
    items
  };
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
  if (!transactions.length) {
    return { series: fallback, mode: "month" };
  }
  const dates = transactions.map((item) => item.date).filter(Boolean).sort();
  if (!dates.length) {
    return { series: fallback, mode: "month" };
  }
  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const useDaily = diffDays <= 45;
  const buckets = {};
  transactions.forEach((item) => {
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

export default function ReportsScreen({
  summary,
  monthlySeries,
  breakdown = [],
  transactions = [],
  userEmail,
  onBack
}) {
  const maxValue = Math.max(
    1,
    ...monthlySeries.map((item) => Math.max(item.income || 0, item.expense || 0))
  );
  const calcHeight = (value) => (value > 0 ? (value / maxValue) * 100 : 2);
  const [showForecast, setShowForecast] = useState(false);
  const [showSavingTips, setShowSavingTips] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);
  const [donutTooltip, setDonutTooltip] = useState(null);
  const [trendHoverIndex, setTrendHoverIndex] = useState(null);
  const donutRef = useRef(null);
  const ratioTotal = summary.total_income + summary.total_expense;
  const incomeRatio = ratioTotal > 0 ? summary.total_income / ratioTotal : 0;
  const expenseRatio = ratioTotal > 0 ? summary.total_expense / ratioTotal : 0;
  const savingsRate = summary.total_income > 0 ? (summary.total_income - summary.total_expense) / summary.total_income : 0;
  const savingsLabel = savingsRate >= 0 ? percent(savingsRate) : `-${percent(Math.abs(savingsRate))}`;
  const summaryRows = [
    {
      label: t("reports.total_income", null, "Tổng thu"),
      value: currency(summary.total_income),
      meta: t("reports.meta_period", null, "Theo giai đoạn")
    },
    {
      label: t("reports.total_expense", null, "Tổng chi"),
      value: currency(summary.total_expense),
      meta: t("reports.meta_period", null, "Theo giai đoạn")
    },
    {
      label: t("reports.balance", null, "Số dư"),
      value: currency(summary.balance),
      meta: t("reports.meta_period", null, "Theo giai đoạn")
    },
    {
      label: t("reports.savings_rate", null, "Tỷ lệ tiết kiệm"),
      value: savingsLabel,
      meta: t("reports.meta_period", null, "Theo giai đoạn")
    }
  ];
  const donutItems = buildDonutItems(breakdown, 5, t("reports.other", null, "Khác"));
  const donutTotal = donutItems.reduce((sum, item) => sum + item.spent, 0);
  const topCategories = [...breakdown].sort((a, b) => b.spent - a.spent).slice(0, 5);
  const { series: trendSource, mode: trendMode } = buildTrendSource(transactions, monthlySeries);
  const comboSeries = buildComboSeries(trendSource);
  const trendBadge =
    trendMode === "day"
      ? t("reports.badge.daily", null, "Theo ngày")
      : t("reports.badge.monthly", null, "6 tháng gần nhất");
  const heatmap = buildHeatmapData(transactions);
  const burnRate = summary.total_income > 0 ? summary.total_expense / summary.total_income : 0;
  const burnLabel = percent(burnRate);
  const weekLabels = [
    t("reports.weekday.mon", null, "T2"),
    t("reports.weekday.tue", null, "T3"),
    t("reports.weekday.wed", null, "T4"),
    t("reports.weekday.thu", null, "T5"),
    t("reports.weekday.fri", null, "T6"),
    t("reports.weekday.sat", null, "T7"),
    t("reports.weekday.sun", null, "CN")
  ];
  const labelStep = comboSeries.labels.length > 12 ? Math.ceil(comboSeries.labels.length / 6) : 1;
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
    if (!comboSeries.labels.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.min(
      comboSeries.labels.length - 1,
      Math.max(0, Math.round(ratio * (comboSeries.labels.length - 1)))
    );
    setTrendHoverIndex(index);
  };

  return (
    <section className="panel report-page">
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
      <div className="report-grid report-grid-summary">
        {summaryRows.map((row) => (
          <div key={row.label} className="report-card">
            <p>{row.label}</p>
            <strong>{row.value}</strong>
            <span className="muted">{row.meta}</span>
          </div>
        ))}
      </div>

      <div className="report-row report-row-two">
        <div className="panel chart-card">
          <div className="panel-header">
            <h3>{t("reports.chart_title", null, "Biểu đồ thu chi")}</h3>
            <span className="badge">{t("reports.badge.monthly", null, "6 tháng gần nhất")}</span>
          </div>
          <div className="chart-legend">
            <div>
              <span className="legend-swatch income" />
              <span>{t("reports.income", null, "Thu nhập")}</span>
            </div>
            <div>
              <span className="legend-swatch expense" />
              <span>{t("reports.expense", null, "Chi tiêu")}</span>
            </div>
          </div>
          <div className="dual-bars tall">
            {monthlySeries.map((item) => (
              <div key={item.month} className="dual-bar">
                <div className="dual-bar-stack">
                  <span className="bar-income" style={{ height: `${calcHeight(item.income)}%` }} />
                  <span className="bar-expense" style={{ height: `${calcHeight(item.expense)}%` }} />
                </div>
                <div className="dual-bar-label">
                  <small>{item.month.slice(5)}</small>
                  <small className={item.net >= 0 ? "income" : "expense"}>{currency(item.net)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel chart-card">
          <div className="panel-header">
            <h3>{t("reports.category_split", null, "Cơ cấu chi tiêu")}</h3>
            <span className="badge">{t("reports.badge.expense", null, "Danh mục")}</span>
          </div>
          {donutItems.length ? (
            <>
              <div
                className="donut-chart"
                ref={donutRef}
                onMouseLeave={() => setDonutTooltip(null)}
              >
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
                  <strong>{currency(summary.total_expense || donutTotal)}</strong>
                </div>
                {donutTooltip && (
                  <div
                    className="donut-tooltip"
                    style={{ left: donutTooltip.x, top: donutTooltip.y }}
                  >
                    <strong>{donutTooltip.item.category}</strong>
                    <span>{currency(donutTooltip.item.spent)}</span>
                    <small>{percent(donutTooltip.item.share)}</small>
                  </div>
                )}
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
        </div>
      </div>

      <div className="report-row report-row-three">
        <div className="panel chart-card">
          <div className="panel-header">
            <h3>{t("reports.ratio_title")}</h3>
          </div>
          <div className="ratio-bar">
            <span className="ratio income" style={{ width: `${incomeRatio * 100}%` }} />
            <span className="ratio expense" style={{ width: `${expenseRatio * 100}%` }} />
          </div>
          <div className="ratio-legend">
            <div>
              <span className="legend-swatch income" />
              <span>{t("reports.income", null, "Thu nhập")}</span>
              <strong>{currency(summary.total_income)}</strong>
            </div>
            <div>
              <span className="legend-swatch expense" />
              <span>{t("reports.expense", null, "Chi tiêu")}</span>
              <strong>{currency(summary.total_expense)}</strong>
            </div>
          </div>
        </div>

        <div className="panel chart-card">
          <div className="panel-header">
            <h3>{t("reports.top_categories")}</h3>
            <span className="badge">{t("reports.badge.expense", null, "Danh mục")}</span>
          </div>
          {topCategories.length ? (
            <div className="category-bars">
              {topCategories.map((item) => {
                const share = summary.total_expense > 0 ? item.spent / summary.total_expense : 0;
                return (
                  <div key={item.category} className="category-bar-row">
                    <div className="category-bar-label">
                      <span className="dot" style={{ background: colorFor(item.category, userEmail) }} />
                      <span>{item.category}</span>
                    </div>
                    <div className="category-bar-track">
                      <span
                        className="category-bar-fill"
                        style={{ width: `${share * 100}%`, background: colorFor(item.category, userEmail) }}
                      />
                    </div>
                    <div className="category-bar-value">
                      <strong>{currency(item.spent)}</strong>
                      <small>{percent(share)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">{t("reports.empty_breakdown", null, "Chưa có dữ liệu chi tiêu")}</p>
          )}
        </div>

        <div className="panel chart-card">
          <div className="panel-header">
            <h3>{t("reports.net_trend")}</h3>
            <span className="badge">{trendBadge}</span>
          </div>
          {comboSeries.labels.length ? (
            <div
              className="combo-chart"
              onMouseMove={handleTrendMove}
              onMouseLeave={() => setTrendHoverIndex(null)}
            >
              <div className="combo-legend">
                <span className="legend-swatch income" />
                <span>{t("reports.income", null, "Thu nhập")}</span>
                <span className="legend-swatch expense" />
                <span>{t("reports.expense", null, "Chi tiêu")}</span>
              </div>
              <svg viewBox={`0 0 ${comboSeries.width} ${comboSeries.height}`} aria-hidden="true">
                <line
                  className="combo-zero"
                  x1={comboSeries.padding}
                  x2={comboSeries.width - comboSeries.padding}
                  y1={comboSeries.baseline}
                  y2={comboSeries.baseline}
                />
                {comboSeries.bars.map((bar, index) => (
                  <g key={`bar-${index}`}>
                    <rect
                      className="combo-bar income"
                      x={bar.x}
                      y={bar.incomeY}
                      width={bar.width}
                      height={bar.incomeHeight}
                    />
                    <rect
                      className="combo-bar expense"
                      x={bar.x}
                      y={bar.expenseY}
                      width={bar.width}
                      height={bar.expenseHeight}
                    />
                  </g>
                ))}
                <path className="combo-line net" d={comboSeries.netPath} />
                <path className="combo-line cumulative" d={comboSeries.cumulativePath} />
                {comboSeries.netPoints.map((point, index) => (
                  <circle key={`net-${index}`} className="combo-dot net" cx={point.x} cy={point.y} r="1.6" />
                ))}
                {comboSeries.cumulativePoints.map((point, index) => (
                  <circle
                    key={`cum-${index}`}
                    className="combo-dot cumulative"
                    cx={point.x}
                    cy={point.y}
                    r="1.6"
                  />
                ))}
                {trendHoverIndex !== null && (
                  <>
                    <circle
                      className="combo-dot net active"
                      cx={comboSeries.netPoints[trendHoverIndex].x}
                      cy={comboSeries.netPoints[trendHoverIndex].y}
                      r="2.6"
                    />
                    <circle
                      className="combo-dot cumulative active"
                      cx={comboSeries.cumulativePoints[trendHoverIndex].x}
                      cy={comboSeries.cumulativePoints[trendHoverIndex].y}
                      r="2.6"
                    />
                  </>
                )}
              </svg>
              {trendHoverIndex !== null && comboSeries.items[trendHoverIndex] && (
                <div
                  className="combo-tooltip"
                  style={{
                    left: `${(comboSeries.netPoints[trendHoverIndex].x / comboSeries.width) * 100}%`,
                    top: `${(Math.min(
                      comboSeries.netPoints[trendHoverIndex].y,
                      comboSeries.cumulativePoints[trendHoverIndex].y
                    ) / comboSeries.height) * 100}%`
                  }}
                >
                  <strong>{comboSeries.items[trendHoverIndex].label}</strong>
                  <span>
                    {t("reports.income", null, "Thu nhập")}: {currency(comboSeries.items[trendHoverIndex].income)}
                  </span>
                  <span>
                    {t("reports.expense", null, "Chi tiêu")}: {currency(comboSeries.items[trendHoverIndex].expense)}
                  </span>
                </div>
              )}
              <div className="combo-labels">
                {comboSeries.labels.map((label, index) => (
                  <span key={`${label}-${index}`}>{index % labelStep === 0 ? label : ""}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">{t("reports.empty")}</p>
          )}
        </div>
      </div>

      <div className="report-row report-row-two">
        <div className="panel chart-card">
          <div className="panel-header">
            <h3>{t("reports.burn_rate", null, "Tốc độ chi tiêu")}</h3>
            <span className={`badge ${burnRate > 0.9 ? "danger" : burnRate > 0.7 ? "warn" : ""}`}>
              {burnLabel}
            </span>
          </div>
          <div className="burn-bar">
            <span
              className={`burn-fill ${burnRate > 0.9 ? "danger" : burnRate > 0.7 ? "warn" : "safe"}`}
              style={{ width: `${Math.min(burnRate, 1) * 100}%` }}
            />
          </div>
          <div className="burn-meta">
            <span>{t("reports.burn_desc", null, "Chi tiêu / Thu nhập trong kỳ")}</span>
            <strong>{currency(summary.total_expense)} / {currency(summary.total_income)}</strong>
          </div>
        </div>

        <div className="panel chart-card">
          <div className="panel-header">
            <h3>{t("reports.heatmap_spend", null, "Heatmap chi tiêu")}</h3>
            <span className="badge">{t("reports.badge.expense", null, "Danh mục")}</span>
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
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={`scale-${index}`}
                    style={{ background: `rgba(240, 113, 103, ${0.12 + (index / 4) * 0.7})` }}
                  />
                ))}
              </div>
              <span>{t("reports.heatmap_high", null, "Cao")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>{t("reports.ai_title", null, "AI Insights")}</h3>
        <div className="row-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="ghost" type="button" onClick={() => setShowForecast((v) => !v)}>
            {t("reports.ai_forecast", null, "Dự đoán xu hướng chi tiêu")}
          </button>
          <button className="ghost" type="button" onClick={() => setShowSavingTips((v) => !v)}>
            {t("reports.ai_saving", null, "Gợi ý tiết kiệm / cắt giảm")}
          </button>
          <button className="ghost" type="button" onClick={() => setShowAnomaly((v) => !v)}>
            {t("reports.ai_anomaly", null, "Phát hiện bất thường chi tiêu")}
          </button>
        </div>

        {showForecast && (
          <div className="insight-card">
            <h4>{t("reports.forecast_title", null, "Xu hướng 3 tháng tới")}</h4>
            <ul>
              <li>{t("reports.forecast_1", null, "Chi tiêu dự kiến tăng nhẹ 8–12% nếu giữ thói quen hiện tại.")}</li>
              <li>{t("reports.forecast_2", null, "Đỉnh chi tiêu dự kiến rơi vào tuần cuối tháng.")}</li>
              <li>{t("reports.forecast_3", null, "Nhóm danh mục tăng mạnh: ăn uống, di chuyển.")}</li>
            </ul>
          </div>
        )}

        {showSavingTips && (
          <div className="insight-card">
            <h4>{t("reports.saving_title", null, "Gợi ý tiết kiệm")}</h4>
            <ul>
              <li>{t("reports.saving_1", null, "Giới hạn ngân sách ăn uống ở mức 1.5tr/tháng.")}</li>
              <li>{t("reports.saving_2", null, "Gộp mua sắm vào 1–2 lần/tuần để giảm phát sinh.")}</li>
              <li>{t("reports.saving_3", null, "Ưu tiên thanh toán một ví để dễ kiểm soát.")}</li>
            </ul>
          </div>
        )}

        {showAnomaly && (
          <div className="insight-card">
            <h4>{t("reports.anomaly_title", null, "Phát hiện bất thường")}</h4>
            <ul>
              <li>{t("reports.anomaly_1", null, "Giao dịch “Cà phê” tuần này tăng 2.1x so với tuần trước.")}</li>
              <li>{t("reports.anomaly_2", null, "Chi phí di chuyển tăng đột biến trong 3 ngày gần nhất.")}</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
