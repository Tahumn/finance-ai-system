import { useMemo, useState } from "react";
import { currency } from "../../utils/format.js";

export default function ReportsScreen({ summary, monthlySeries, onBack, reportLayout = "cards" }) {
  const maxAbs = Math.max(1, ...monthlySeries.map((item) => Math.abs(item.value)));
  const [showForecast, setShowForecast] = useState(false);
  const [showSavingTips, setShowSavingTips] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);
  const summaryRows = useMemo(
    () => [
      {
        label: "Tổng thu",
        value: currency(summary.total_income),
        meta: "Theo giai đoạn"
      },
      {
        label: "Tổng chi",
        value: currency(summary.total_expense),
        meta: "Theo giai đoạn"
      },
      {
        label: "Số dư",
        value: currency(summary.balance),
        meta: "Cập nhật realtime"
      }
    ],
    [summary]
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Báo cáo</h3>
        <button className="ghost" onClick={onBack} type="button">
          Quay lại
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

      <div className="panel">
        <h3>AI Insights</h3>
        <div className="row-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="ghost" type="button" onClick={() => setShowForecast((v) => !v)}>
            Dự đoán xu hướng chi tiêu
          </button>
          <button className="ghost" type="button" onClick={() => setShowSavingTips((v) => !v)}>
            Gợi ý tiết kiệm / cắt giảm
          </button>
          <button className="ghost" type="button" onClick={() => setShowAnomaly((v) => !v)}>
            Phát hiện bất thường chi tiêu
          </button>
        </div>

        {showForecast && (
          <div className="insight-card">
            <h4>Xu hướng 3 tháng tới</h4>
            <ul>
              <li>Chi tiêu dự kiến tăng nhẹ 8–12% nếu giữ thói quen hiện tại.</li>
              <li>Đỉnh chi tiêu dự kiến rơi vào tuần cuối tháng.</li>
              <li>Nhóm danh mục tăng mạnh: ăn uống, di chuyển.</li>
            </ul>
          </div>
        )}

        {showSavingTips && (
          <div className="insight-card">
            <h4>Gợi ý tiết kiệm</h4>
            <ul>
              <li>Giới hạn ngân sách ăn uống ở mức 1.5tr/tháng.</li>
              <li>Gộp mua sắm vào 1–2 lần/tuần để giảm phát sinh.</li>
              <li>Ưu tiên thanh toán một ví để dễ kiểm soát.</li>
            </ul>
          </div>
        )}

        {showAnomaly && (
          <div className="insight-card">
            <h4>Phát hiện bất thường</h4>
            <ul>
              <li>Giao dịch “Cà phê” tuần này tăng 2.1x so với tuần trước.</li>
              <li>Chi phí di chuyển tăng đột biến trong 3 ngày gần nhất.</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
