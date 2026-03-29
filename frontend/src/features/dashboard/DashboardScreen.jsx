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
  const scaleY = (value) =>
    height - padding - ((value - min) / range) * (height - padding * 2);
  const mapPoints = (valuesList) =>
    valuesList.map((value, index) => ({
      x: scaleX(index),
      y: scaleY(value),
      value
    }));
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
  const incomePoints = mapPoints(income);
  const expensePoints = mapPoints(expense);
  if (incomePoints.length === 1) {
    incomePoints.push({ ...incomePoints[0], x: incomePoints[0].x + 1 });
  }
  if (expensePoints.length === 1) {
    expensePoints.push({ ...expensePoints[0], x: expensePoints[0].x + 1 });
  }
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
  const insights = [];

  const topCategory = breakdown[0];
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

  const coffeeSpendingByMonth = transactions
    .filter((item) => item.transaction_type === "expense")
    .filter((item) => {
      const text = normalizeText(item.description || "");
      return text.includes("coffee") || text.includes("cafe") || text.includes("ca phe");
    })
    .reduce((acc, item) => {
      const key = item.date.slice(0, 7);
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

  if (summary.total_expense > summary.total_income) {
    insights.push(t("dashboard.insight.over_spend"));
  }

  if (!insights.length) {
    insights.push(t("dashboard.insight.stable"));
  }

  return insights.slice(0, 3);
};

export default function DashboardScreen({
  summary,
  breakdown = [],
  transactions = [],
  monthlySeries = [],
  onViewTransactions,
  onGoOcr,
  onGoChat,
  onGoAddTransaction,
  onGoReports,
  rangePreset,
  onSelectPreset,
  userEmail
}) {
  const slicedTransactions = transactions.slice(0, 4);
  const insights = buildAiInsights(summary, transactions, breakdown);
  const donutItems = buildDonutItems(breakdown, 4, t("reports.other", null, "Khác"));
  const donutTotal = donutItems.reduce((sum, item) => sum + item.spent, 0);
  const { series: waveSource } = buildWaveSeries(transactions, monthlySeries);
  const trendSeries = buildLineSeries(waveSource);
  const labelStep = trendSeries.labels.length > 10 ? Math.ceil(trendSeries.labels.length / 6) : 1;

  return (
    <>
      <section className="panel dashboard-actions">
        <div className="panel-header">
          <h3>{t("dashboard.quick_actions")}</h3>
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
        <div className="quick-actions">
          <button className="ghost" type="button" onClick={onGoAddTransaction}>
            {t("dashboard.add_tx")}
          </button>
          <button className="ghost" type="button" onClick={onGoOcr}>
            {t("dashboard.ocr")}
          </button>
          <button className="ghost" type="button" onClick={onGoChat}>
            {t("dashboard.chat")}
          </button>
          <button className="ghost" type="button" onClick={onGoReports}>
            {t("dashboard.reports")}
          </button>
        </div>
      </section>

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
                  <strong>{currency(summary.total_expense || donutTotal)}</strong>
                </div>
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
                {trendSeries.income.map((point, index) => (
                  <circle
                    key={`income-${index}`}
                    className="line-dot income base"
                    cx={point.x}
                    cy={point.y}
                    r="1.8"
                  />
                ))}
                {trendSeries.expense.map((point, index) => (
                  <circle
                    key={`expense-${index}`}
                    className="line-dot expense base"
                    cx={point.x}
                    cy={point.y}
                    r="1.8"
                  />
                ))}
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

      <section className="panel list">
        <div className="panel-header">
          <h3>{t("dashboard.ai_hints")}</h3>
        </div>
        {insights.map((insight) => (
          <p key={insight} className="insight-item">
            {insight}
          </p>
        ))}
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
            <TransactionRow key={item.id} item={item} categoryLabel={item.categoryLabel} />
          ))
        )}
      </section>
    </>
  );
}
