import TransactionRow from "../../components/TransactionRow.jsx";
import { colorFor } from "../../utils/colors.js";
import { currency, percent } from "../../utils/format.js";

const buildDonutGradient = (breakdown) => {
  if (!breakdown.length) {
    return "conic-gradient(#e6edf6 0deg, #e6edf6 360deg)";
  }
  let start = 0;
  const parts = breakdown.map((item) => {
    const color = colorFor(item.category);
    const end = start + item.share * 360;
    const slice = `${color} ${start}deg ${end}deg`;
    start = end;
    return slice;
  });
  return `conic-gradient(${parts.join(", ")})`;
};

export default function DashboardScreen({
  summary,
  breakdown,
  transactions,
  monthlySeries,
  onViewTransactions
}) {
  const maxAbs = Math.max(1, ...monthlySeries.map((item) => Math.abs(item.value)));
  const slicedTransactions = transactions.slice(0, 4);

  return (
    <>
      <section className="grid">
        <div className="panel">
          <h3>Dòng tiền 6 tháng</h3>
          <div className="bars">
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
          <h3>Chi tiêu theo danh mục</h3>
          <div
            className="donut"
            style={{
              background: buildDonutGradient(breakdown)
            }}
          >
            <div>
              <strong>{currency(summary.total_expense)}</strong>
              <span>Tổng chi</span>
            </div>
          </div>
          <div className="legend">
            {breakdown.map((item) => (
              <div key={item.category}>
                <span className="dot" style={{ background: colorFor(item.category) }} />
                <div>
                  <p>{item.category}</p>
                  <small>{percent(item.share)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel list">
        <div className="panel-header">
          <h3>Giao dịch gần đây</h3>
          <button className="ghost" onClick={onViewTransactions} type="button">
            Xem tất cả
          </button>
        </div>
        {slicedTransactions.length === 0 ? (
          <p className="empty">Chưa có giao dịch nào.</p>
        ) : (
          slicedTransactions.map((item) => (
            <TransactionRow
              key={item.id}
              item={item}
              categoryLabel={item.categoryLabel}
            />
          ))
        )}
      </section>
    </>
  );
}
