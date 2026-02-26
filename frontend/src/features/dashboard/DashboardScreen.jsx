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
      `Danh mục chi cao nhất hiện tại: ${topCategory.category} (${currency(topCategory.spent)}).`
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
      `Chi cà phê tháng này tăng ${Math.round(delta)}% so với tháng trước (${currency(
        previousCoffee
      )} -> ${currency(currentCoffee)}).`
    );
  }

  if (summary.total_expense > summary.total_income) {
    insights.push("Chi tiêu đang vượt thu nhập trong kỳ hiện tại. Nên rà soát danh mục không thiết yếu.");
  }

  if (!insights.length) {
    insights.push("Dữ liệu hiện ổn định. Bạn có thể tạo thêm ngân sách để theo dõi chủ động hơn.");
  }

  return insights.slice(0, 3);
};

export default function DashboardScreen({
  summary,
  breakdown,
  transactions,
  monthlySeries,
  onViewTransactions,
  onGoOcr,
  onGoChat,
  onGoAddTransaction,
  onGoReports,
  rangePreset,
  onSelectPreset
}) {
  const maxAbs = Math.max(1, ...monthlySeries.map((item) => Math.abs(item.value)));
  const slicedTransactions = transactions.slice(0, 4);
  const insights = buildAiInsights(summary, transactions, breakdown);

  return (
    <>
      <section className="panel dashboard-actions">
        <div className="panel-header">
          <h3>Điều khiển nhanh</h3>
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
            Thêm giao dịch
          </button>
          <button className="ghost" type="button" onClick={onGoOcr}>
            Nhập hóa đơn OCR
          </button>
          <button className="ghost" type="button" onClick={onGoChat}>
            Chat NLP
          </button>
          <button className="ghost" type="button" onClick={onGoReports}>
            Xem báo cáo
          </button>
        </div>
      </section>

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
          <h3>Gợi ý AI</h3>
          <span className="badge">summary mode</span>
        </div>
        {insights.map((insight) => (
          <p key={insight} className="insight-item">
            {insight}
          </p>
        ))}
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
            <TransactionRow key={item.id} item={item} categoryLabel={item.categoryLabel} />
          ))
        )}
      </section>
    </>
  );
}
