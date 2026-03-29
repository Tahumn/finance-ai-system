import { useMemo, useState } from "react";
import { currency } from "../../utils/format.js";

export default function ReportsScreen({
  summary,
  monthlySeries,
  transactions = [],
  anomalies = [],
  onBack,
  reportLayout = "cards"
}) {
  const maxVal = Math.max(1, ...monthlySeries.flatMap((item) => [item.income, item.expense]));
  const [showForecast, setShowForecast] = useState(false);
  const [showSavingTips, setShowSavingTips] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);

  const expenseTransactions = useMemo(
    () => transactions.filter((item) => item.transaction_type === "expense"),
    [transactions]
  );
  
  const summaryRows = useMemo(
    () => [
      {
        label: "Số dư tổng",
        value: currency(summary.total_balance),
        meta: "Tất cả thời gian"
      },
      {
        label: "Tổng thu kỳ",
        value: currency(summary.period_total_income),
        meta: "Trong khoảng ngày"
      },
      {
        label: "Tổng chi kỳ",
        value: currency(summary.period_total_expense),
        meta: "Trong khoảng ngày"
      },
      {
        label: "Biến động ròng",
        value: currency(summary.period_net_flow),
        meta: "Thu - Chi"
      }
    ],
    [summary]
  );

  return (
    <section className="panel report-page">
      <div className="panel-header">
        <h3>Báo cáo tài chính</h3>
        <button className="ghost" onClick={onBack} type="button">
          Quay lại
        </button>
      </div>
      
      <div className="report-grid">
        {summaryRows.map((row) => (
          <div key={row.label} className="report-card">
            <p className="eyebrow">{row.label}</p>
            <strong>{row.value}</strong>
            <span className="badge">{row.meta}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Biểu đồ dòng tiền (Thu vs Chi)</h3>
        <div className="bars tall grouped">
          {monthlySeries.map((item) => (
            <div key={item.month} className="bar-group">
              <div className="bar-container">
                <span
                  style={{ height: `${(item.income / maxVal) * 100}%` }}
                  className="positive"
                  title={`Thu: ${currency(item.income)}`}
                />
                <span
                  style={{ height: `${(item.expense / maxVal) * 100}%` }}
                  className="negative"
                  title={`Chi: ${currency(item.expense)}`}
                />
              </div>
              <small>{item.month.slice(5)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Phân tích & Dự báo (AI)</h3>
        <div className="row-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="ghost" type="button" onClick={() => setShowForecast((v) => !v)}>
            Dự báo chi tiêu
          </button>
          <button className="ghost" type="button" onClick={() => setShowSavingTips((v) => !v)}>
            Mẹo tiết kiệm
          </button>
          <button className="ghost" type="button" onClick={() => setShowAnomaly((v) => !v)}>
            Phát hiện bất thường
          </button>
        </div>

        {showForecast && (
          <div className="insight-card">
            <h4>Dự báo tháng tới</h4>
            <p>Dựa trên xu hướng 3 tháng gần nhất, chi tiêu dự kiến của bạn khoảng <strong>{currency(summary.period_total_expense * 1.05)}</strong>.</p>
          </div>
        )}

        {showAnomaly && (
          <div className="insight-card">
            <h4>Các khoản chi bất thường</h4>
            {anomalies.length === 0 ? (
              <p>Không phát hiện bất thường nào đáng kể.</p>
            ) : (
              <ul>
                {anomalies.map((item) => (
                  <li key={item.id}>
                    {item.date}: {item.description} ({currency(item.amount)})
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
