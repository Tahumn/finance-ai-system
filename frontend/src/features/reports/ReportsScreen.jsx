import { currency } from "../../utils/format.js";

export default function ReportsScreen({ summary, monthlySeries, onBack }) {
  const maxAbs = Math.max(1, ...monthlySeries.map((item) => Math.abs(item.value)));

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Báo cáo</h3>
        <button className="ghost" onClick={onBack} type="button">
          Quay lại
        </button>
      </div>
      <div className="report-grid">
        <div className="report-card">
          <p>Tổng thu</p>
          <strong>{currency(summary.total_income)}</strong>
          <span className="badge">Theo giai đoạn</span>
        </div>
        <div className="report-card">
          <p>Tổng chi</p>
          <strong>{currency(summary.total_expense)}</strong>
          <span className="badge">Theo giai đoạn</span>
        </div>
        <div className="report-card">
          <p>Số dư</p>
          <strong>{currency(summary.balance)}</strong>
          <span className="badge">Cập nhật realtime</span>
        </div>
      </div>
      <div className="panel">
        <h3>Biểu đồ thu chi</h3>
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
    </section>
  );
}
