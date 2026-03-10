import { useMemo, useState } from "react";
import { currency } from "../../utils/format.js";

export default function ReportsScreen({
  summary,
  monthlySeries,
  transactions = [],
  onBack,
  reportLayout = "cards"
}) {
  const maxAbs = Math.max(1, ...monthlySeries.map((item) => Math.abs(item.value)));
  const [showForecast, setShowForecast] = useState(false);
  const [showSavingTips, setShowSavingTips] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);

  const expenseTransactions = useMemo(
    () => transactions.filter((item) => item.transaction_type === "expense"),
    [transactions]
  );
  const expenseByMonth = useMemo(() => {
    const buckets = {};
    expenseTransactions.forEach((item) => {
      const key = item.date.slice(0, 7);
      if (!buckets[key]) buckets[key] = 0;
      buckets[key] += Number(item.amount || 0);
    });
    return Object.entries(buckets)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [expenseTransactions]);
  const forecast = useMemo(() => {
    if (!expenseByMonth.length) return null;
    const last = expenseByMonth.slice(-3);
    const avg = last.reduce((sum, item) => sum + item.total, 0) / last.length;
    return Math.round(avg);
  }, [expenseByMonth]);
  const topCategories = useMemo(() => {
    const buckets = {};
    expenseTransactions.forEach((item) => {
      const label = item.categoryLabel || "Other";
      if (!buckets[label]) buckets[label] = 0;
      buckets[label] += Number(item.amount || 0);
    });
    return Object.entries(buckets)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [expenseTransactions]);
  const anomalies = useMemo(() => {
    if (!expenseTransactions.length) return [];
    const values = expenseTransactions.map((item) => Number(item.amount || 0));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const stdev = Math.sqrt(variance) || 1;
    return expenseTransactions
      .filter((item) => (Number(item.amount || 0) - mean) / stdev > 2)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [expenseTransactions]);

  const summaryRows = useMemo(
    () => [
      {
        label: "Total income",
        value: currency(summary.total_income),
        meta: "Selected range"
      },
      {
        label: "Total expense",
        value: currency(summary.total_expense),
        meta: "Selected range"
      },
      {
        label: "Balance",
        value: currency(summary.balance),
        meta: "Realtime"
      }
    ],
    [summary]
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Reports</h3>
        <button className="ghost" onClick={onBack} type="button">
          Back
        </button>
      </div>
      {reportLayout === "table" ? (
        <table className="summary-table">
          <tbody>
            {summaryRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  <strong>{row.value}</strong>
                  <span className="muted" style={{ marginLeft: 8 }}>
                    {row.meta}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : reportLayout === "charts" ? (
        <div className="summary-strip">
          {summaryRows.map((row) => (
            <div key={row.label} className="summary-item">
              <span className="muted">{row.label}</span>
              <strong>{row.value}</strong>
              <small className="muted">{row.meta}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="report-grid">
          {summaryRows.map((row) => (
            <div key={row.label} className="report-card">
              <p>{row.label}</p>
              <strong>{row.value}</strong>
              <span className="badge">{row.meta}</span>
            </div>
          ))}
        </div>
      )}
      <div className="panel">
        <h3>Cashflow chart</h3>
        <div className="bars tall">
          {monthlySeries.map((item) => (
            <div key={item.month} className="bar">
              <span
                style={{
                  height: `${(Math.abs(item.value) / maxAbs) * 100}%`
                }}
                className={item.value >= 0 ? "positive" : "negative"}
              />
              <small>{item.month.slice(5)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>AI Insights</h3>
        <div className="row-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="ghost" type="button" onClick={() => setShowForecast((v) => !v)}>
            Forecast expense
          </button>
          <button className="ghost" type="button" onClick={() => setShowSavingTips((v) => !v)}>
            Saving tips
          </button>
          <button className="ghost" type="button" onClick={() => setShowAnomaly((v) => !v)}>
            Anomaly detection
          </button>
        </div>

        {showForecast && (
          <div className="insight-card">
            <h4>Next month forecast</h4>
            {!forecast ? (
              <p>No expense history yet.</p>
            ) : (
              <ul>
                <li>Estimated expense: {currency(forecast)}</li>
                <li>Based on last 3 months average.</li>
              </ul>
            )}
          </div>
        )}

        {showSavingTips && (
          <div className="insight-card">
            <h4>Top spending categories</h4>
            {!topCategories.length ? (
              <p>No expense data yet.</p>
            ) : (
              <ul>
                {topCategories.map((item) => (
                  <li key={item.category}>
                    {item.category}: {currency(item.total)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showAnomaly && (
          <div className="insight-card">
            <h4>Potential anomalies</h4>
            {!anomalies.length ? (
              <p>No anomalies detected.</p>
            ) : (
              <ul>
                {anomalies.map((item) => (
                  <li key={`${item.id}-${item.amount}`}>
                    {item.description}: {currency(item.amount)} ({item.date})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
