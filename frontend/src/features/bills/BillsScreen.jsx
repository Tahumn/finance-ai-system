import { useMemo, useState } from "react";
import { currency } from "../../utils/format.js";
import { colorFor } from "../../utils/colors.js";
import "./bills.css";

const ocrConfidence = (tx) => {
  const text = String(tx.description || "").toLowerCase();
  if (text.includes("ocr")) return 0.92;
  return 0.82;
};

const billStatus = (tx) => {
  const conf = ocrConfidence(tx);
  if (conf >= 0.9) return { label: "Đã xác nhận", cls: "ok" };
  if (conf >= 0.8) return { label: "Cần kiểm tra", cls: "warn" };
  return { label: "Thiếu thông tin", cls: "bad" };
};

const sourceLabel = (tx) => {
  const labels = Array.isArray(tx.tagLabels) ? tx.tagLabels.map((x) => String(x || "").toLowerCase()) : [];
  if (labels.some((x) => x.includes("ví"))) return "Ví điện tử";
  if (labels.some((x) => x.includes("ngân hàng"))) return "Ngân hàng";
  return "Tiền mặt";
};

export default function BillsScreen({ transactions = [], categories = [] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const ocrBills = useMemo(() => {
    return transactions.filter((tx) => {
      const labels = Array.isArray(tx.tagLabels) ? tx.tagLabels.map((x) => String(x || "").toLowerCase()) : [];
      const text = String(tx.description || "").toLowerCase();
      return labels.some((x) => x.includes("ocr") || x.includes("hóa đơn")) || text.includes("hóa đơn") || text.includes("ocr");
    });
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ocrBills;
    return ocrBills.filter((tx) => {
      const cat = tx.categoryLabel || "Khác";
      return String(tx.description || "").toLowerCase().includes(q) || String(cat).toLowerCase().includes(q);
    });
  }, [ocrBills, query]);

  const selected = filtered.find((x) => x.id === selectedId) || filtered[0] || null;
  const total = filtered.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const confirmed = filtered.filter((tx) => ocrConfidence(tx) >= 0.9).length;
  const checking = filtered.filter((tx) => {
    const c = ocrConfidence(tx);
    return c >= 0.8 && c < 0.9;
  }).length;

  return (
    <section className="bill-page">
      <header className="bill-header">
        <div>
          <h1>Hóa đơn</h1>
          <p>Quản lý các hóa đơn đã nhập từ OCR và theo dõi trạng thái xử lý.</p>
        </div>
      </header>

      <section className="bill-kpis">
        <article><span>Tổng hóa đơn</span><strong>{filtered.length}</strong></article>
        <article><span>Đã xác nhận</span><strong>{confirmed}</strong></article>
        <article><span>Cần kiểm tra</span><strong>{checking}</strong></article>
        <article><span>Chi tiêu từ hóa đơn</span><strong>{currency(total)}</strong></article>
      </section>

      <div className="bill-main">
        <div className="bill-table-card">
          <div className="bill-toolbar">
            <input
              type="text"
              placeholder="Tìm theo merchant, mô tả, danh mục..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="bill-table">
            <div className="bill-row head">
              <span>Merchant / Mô tả</span>
              <span>Ngày giao dịch</span>
              <span>Danh mục</span>
              <span>Nguồn tiền</span>
              <span>Tổng tiền</span>
              <span>Độ tin cậy OCR</span>
              <span>Trạng thái</span>
            </div>
            {filtered.map((tx) => {
              const conf = Math.round(ocrConfidence(tx) * 100);
              const status = billStatus(tx);
              const cat = tx.categoryLabel || "Khác";
              return (
                <button
                  type="button"
                  key={tx.id}
                  className={`bill-row ${selected?.id === tx.id ? "active" : ""}`}
                  onClick={() => setSelectedId(tx.id)}
                >
                  <span className="bill-merchant">{tx.description || "Hóa đơn OCR"}</span>
                  <span>{tx.date}</span>
                  <span>
                    <i style={{ background: colorFor(cat, "bill") }} />
                    {cat}
                  </span>
                  <span>{sourceLabel(tx)}</span>
                  <span className="bill-money">{currency(Number(tx.amount || 0))}</span>
                  <span className="bill-conf">OCR {conf}%</span>
                  <span className={`bill-status ${status.cls}`}>{status.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="bill-detail-card">
          <h3>Chi tiết hóa đơn</h3>
          {!selected ? (
            <p className="muted">Chưa có hóa đơn OCR.</p>
          ) : (
            <>
              <div className="bill-receipt-preview">
                <strong>{selected.description || "Receipt OCR"}</strong>
                <span>{selected.date}</span>
                <span>{currency(Number(selected.amount || 0))}</span>
              </div>
              <div className="bill-detail-grid">
                <p><span>Merchant</span><strong>{selected.description || "—"}</strong></p>
                <p><span>Tổng tiền</span><strong>{currency(Number(selected.amount || 0))}</strong></p>
                <p><span>Danh mục (OCR)</span><strong>{selected.categoryLabel || "Khác"}</strong></p>
                <p><span>Nguồn tiền</span><strong>{sourceLabel(selected)}</strong></p>
                <p><span>Ngày giao dịch</span><strong>{selected.date}</strong></p>
                <p><span>Trạng thái</span><strong>{billStatus(selected).label}</strong></p>
              </div>
              <div className="bill-detail-actions">
                <button type="button" className="ghost">Xem chi tiết</button>
                <button type="button" className="ghost">Chỉnh sửa</button>
                <button type="button" className="primary">Tạo giao dịch</button>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
