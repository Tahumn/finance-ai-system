import { useState } from "react";
import TransactionRow from "../../components/TransactionRow.jsx";
import { colorFor } from "../../utils/colors.js";
import { currency, percent } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";
import { buildAiInsights } from "../../utils/insights.js";

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
  rangePreset,
  onSelectPreset,
  userEmail
}) {
  const [actionsOpen, setActionsOpen] = useState(true);
  const safeMonthly = Array.isArray(monthlySeries) ? monthlySeries : [];
  const maxVal = Math.max(1, ...safeMonthly.flatMap((item) => [item.income, item.expense]));
  const slicedTransactions = (Array.isArray(transactions) ? transactions : []).slice(0, 4);
  const insights = buildAiInsights(summary || {}, transactions, breakdown);
  const donutItems = buildDonutItems(breakdown, 4, t("reports.other", null, "Khác"));
  const donutTotal = donutItems.reduce((sum, item) => sum + item.spent, 0);
  const { series: waveSource } = buildWaveSeries(transactions, monthlySeries);
  const trendSeries = buildLineSeries(waveSource);
  const labelStep = trendSeries.labels.length > 10 ? Math.ceil(trendSeries.labels.length / 6) : 1;

  return (
    <>
      <section className="panel dashboard-actions">
        <div className="panel-header">
          <div className="dashboard-actions-header">
            <h3>{t("dashboard.quick_actions")}</h3>
            <button
              className="chevron-btn"
              type="button"
              aria-label={t("common.toggle", null, "Toggle")}
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((value) => !value)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="range-selector">
            {["today", "week", "month", "year"].map((preset) => (
              <button
                key={preset}
                className={preset === rangePreset ? "active" : ""}
                type="button"
                onClick={() => onSelectPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        {actionsOpen && (
          <div className="quick-actions quick-actions-dashboard">
            <button className="ghost qa-add" type="button" onClick={onGoAddTransaction}>
              {t("dashboard.add_tx")}
            </button>
            <button className="ghost qa-reports" type="button" onClick={onGoReports}>
              {t("dashboard.reports")}
            </button>
            <button className="ghost qa-ocr" type="button" onClick={onGoOcr}>
              📸 {t("dashboard.ocr", null, "Nhập hóa đơn AI")}
            </button>
          </div>
        )}
      </section>

      {Array.isArray(anomalies) && anomalies.length > 0 && (
        <section className="panel anomalies">
          <div className="panel-header">
            <h3 style={{ color: "var(--danger)" }}>⚠️ Cảnh báo chi tiêu (Anomaly)</h3>
          </div>
          <div className="anomaly-list">
            {anomalies.map((alert) => (
              <div key={alert.id} className={`anomaly-item ${alert.severity}`}>
                <div className="anomaly-info">
                  <strong>{alert.description}</strong>
                  <p>{alert.reason}</p>
                </div>
                <div className="anomaly-amount">{currency(alert.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid">
        <div className="panel">
          <div className="panel-header">
            <h3>{t("reports.category_split", null, "Cơ cấu chi tiêu")}</h3>
            <span className="badge">{t("reports.badge.expense", null, "Danh mục")}</span>
          </div>
          {donutItems.length ? (
            <>
              <div className="donut-chart">
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
                        />
                      );
                      offset += length;
                      return segment;
                    });
                  })()}
                </svg>
                <div className="donut-center">
                  <span>{t("dashboard.total_expense")}</span>
                  <strong>{currency(summary?.total_expense || donutTotal)}</strong>
                </div>
              </div>
              <div className="donut-legend">
                {donutItems.map((item) => (
                  <div key={item.category} className="donut-legend-item">
                    <div className="donut-legend-label">
                      <span
                        className="dot"
                        style={{
                          background: item.isOther ? "#9aa1b2" : colorFor(item.category, userEmail)
                        }}
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

        <div className="panel">
          <div className="panel-header">
            <h3>{t("reports.net_trend", null, "Xu hướng dòng tiền")}</h3>
            <span className="badge">{t("reports.badge.monthly", null, "6 tháng gần nhất")}</span>
          </div>
          {trendSeries.labels.length ? (
            <div className="line-chart compact wave">
              <div className="line-legend">
                <span className="legend-swatch income" />
                <span>{t("reports.income", null, "Thu nhập")}</span>
                <span className="legend-swatch expense" />
                <span>{t("reports.expense", null, "Chi tiêu")}</span>
              </div>
              <svg viewBox={`0 0 ${trendSeries.width} ${trendSeries.height}`} aria-hidden="true">
                <polyline
                  className="line-poly income"
                  points={trendSeries.income.map((point) => `${point.x},${point.y}`).join(" ")}
                />
                <polyline
                  className="line-poly expense"
                  points={trendSeries.expense.map((point) => `${point.x},${point.y}`).join(" ")}
                />
                <path className="line-path income" d={trendSeries.incomePath} />
                <path className="line-path expense" d={trendSeries.expensePath} />
              </svg>
              <div className="line-labels">
                {trendSeries.labels.map((label, index) => (
                  <span key={`${label}-${index}`}>{index % labelStep === 0 ? label : ""}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">{t("reports.empty")}</p>
          )}
        </div>
      </section>

      <section className="panel insights-section">
        <div className="panel-header">
          <h3>{t("dashboard.ai_hints", null, "Trợ lý Phân tích AI")}</h3>
          <span className="badge ai-badge">AI Powered</span>
        </div>
        <div className="insight-grid">
          {insights.map((insight) => (
            <button 
              key={insight.id} 
              className={`insight-card ${insight.type}`}
              onClick={() => onGoChat(insight.query)}
              type="button"
            >
              <div className="insight-icon">{insight.icon}</div>
              <div className="insight-content">
                <h4>{insight.title}</h4>
                <p>{insight.text}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="panel list">
        <div className="panel-header">
          <h3>{t("dashboard.recent")}</h3>
          <button className="ghost" onClick={onViewTransactions} type="button">
            {t("dashboard.view_all")}
          </button>
        </div>
        {slicedTransactions.length === 0 ? (
          <p className="empty">{t("dashboard.empty_tx")}</p>
        ) : (
          slicedTransactions.map((item) => (
            <TransactionRow
              key={item.id}
              item={item}
              categoryLabel={item.categoryLabel}
              userEmail={userEmail}
            />
          ))
        )}
      </section>
    </>
  );
}
