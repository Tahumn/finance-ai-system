import { useMemo, useState, useEffect } from "react";
import { currency } from "../../utils/format.js";
import { colorFor } from "../../utils/colors.js";
import "./bills.css";

// Icons
const SearchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const ReceiptIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17V7"/></svg>;
const FileTextIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const CheckCircleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const AlertCircleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const AlertTriangleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const UploadIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const PlusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

const getStatusDetails = (status) => {
  if (status === "confirmed") return { label: "Đã xác nhận", cls: "confirmed" };
  if (status === "pending") return { label: "Cần kiểm tra", cls: "pending" };
  return { label: "Thiếu thông tin", cls: "error" };
};

export default function BillsScreen({ bills = [], loading = false, onGoOcr }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bills.filter((b) => (b.merchant || "").toLowerCase().includes(q) || (b.bill_number && String(b.bill_number).toLowerCase().includes(q)));
  }, [bills, query]);

  const selected = filtered.find((x) => x.id === selectedId) || filtered[0] || null;
  const confirmed = bills.filter((b) => b.status === "confirmed").length;
  const pending = bills.filter((b) => b.status === "pending").length;
  const errors = bills.filter((b) => b.status === "error").length;

  return (
    <section className="bill-page">
      <header className="bill-header">
        <div className="bill-header-text">
          <h1>Hóa đơn</h1>
          <p>Quản lý các hóa đơn đã nhập từ OCR và theo dõi trạng thái xử lý.</p>
        </div>
        <div className="bill-header-actions">
          <button type="button" className="bill-btn secondary" onClick={onGoOcr}>
            <UploadIcon /> Nhập hóa đơn (tự động)
          </button>
          <button type="button" className="bill-btn primary">
            <PlusIcon /> Nhập thủ công
          </button>
        </div>
      </header>

      <section className="bill-kpis">
        <article className="bill-kpi-card">
          <div className="bill-kpi-icon"><ReceiptIcon /></div>
          <div className="bill-kpi-content">
            <span>Tổng hóa đơn</span>
            <strong>{bills.length}</strong>
          </div>
        </article>
        <article className="bill-kpi-card">
          <div className="bill-kpi-icon"><CheckCircleIcon /></div>
          <div className="bill-kpi-content">
            <span>Đã xác nhận</span>
            <strong>{confirmed}</strong>
          </div>
        </article>
        <article className="bill-kpi-card">
          <div className="bill-kpi-icon"><AlertCircleIcon /></div>
          <div className="bill-kpi-content">
            <span>Cần kiểm tra</span>
            <strong>{pending}</strong>
          </div>
        </article>
        <article className="bill-kpi-card">
          <div className="bill-kpi-icon"><AlertTriangleIcon /></div>
          <div className="bill-kpi-content">
            <span>OCR lỗi / Thiếu</span>
            <strong>{errors}</strong>
          </div>
        </article>
      </section>

      <div className="bill-main">
        <div className="bill-table-card">
          <div className="bill-toolbar">
            <div className="bill-search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Tìm kiếm hóa đơn..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select className="bill-filter">
              <option>Tất cả trạng thái</option>
              <option>Đã xác nhận</option>
              <option>Cần kiểm tra</option>
              <option>Lỗi / Thiếu thông tin</option>
            </select>
            <select className="bill-filter">
              <option>Tất cả danh mục</option>
              <option>Ăn uống</option>
              <option>Mua sắm</option>
            </select>
            <select className="bill-filter">
              <option>Tuần này</option>
              <option>Tháng này</option>
            </select>
          </div>

          <div className="bill-table-container">
            <table className="bill-table">
              <thead>
                <tr>
                  <th>Merchant / Mô tả</th>
                  <th>Ngày giao dịch</th>
                  <th>Danh mục (OCR)</th>
                  <th>Nguồn tiền</th>
                  <th>Tổng tiền</th>
                  <th>VAT</th>
                  <th>Độ tin cậy OCR</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{textAlign:"center", padding:"30px"}}>Đang tải dữ liệu...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="8" style={{textAlign:"center", padding:"30px"}}>Không có hóa đơn nào.</td></tr>
                ) : (
                  filtered.map((b) => {
                    const conf = Math.round((b.ocr_confidence || 0) * 100);
                    const status = getStatusDetails(b.status);
                    const confClass = conf >= 90 ? "" : conf >= 80 ? "warn" : "bad";
                    
                    return (
                      <tr 
                        key={b.id} 
                        className={selectedId === b.id ? "active" : ""}
                        onClick={() => setSelectedId(b.id)}
                      >
                        <td className="bill-merchant">
                          <div style={{display: "flex", flexDirection: "column"}}>
                            {b.merchant || "Hóa đơn OCR"}
                            <span style={{fontSize: "11px", color: "#9ca3af", fontWeight: "normal"}}>{b.bill_number}</span>
                          </div>
                        </td>
                        <td>{b.date}</td>
                        <td>{b.category || "Khác"}</td>
                        <td>{b.account_name || "Tài khoản thanh toán"}</td>
                        <td className="bill-money">{currency(b.total_amount)}</td>
                        <td className="bill-vat">{currency(b.vat_amount || 0)}</td>
                        <td>
                          <div>{conf}%</div>
                          <div className="bill-conf-bar">
                            <div className={`bill-conf-fill ${confClass}`} style={{ width: `${conf}%` }}></div>
                          </div>
                        </td>
                        <td>
                          <span className={`bill-status ${status.cls}`}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="bill-detail-card">
          <div className="bill-detail-header">
            <h3>Chi tiết hóa đơn</h3>
          </div>
          
          <div className="bill-detail-body">
            {!selected ? (
              <p style={{color: "#6b7280", textAlign: "center"}}>Vui lòng chọn một hóa đơn để xem chi tiết.</p>
            ) : (
              <>
                <div className="bill-receipt-img">
                  <FileTextIcon />
                  <p style={{marginTop: "12px", marginBottom: 0}}>Hình ảnh hóa đơn gốc</p>
                  <span style={{fontSize: "12px"}}>(Chưa có file đính kèm)</span>
                </div>

                <div className="bill-info-section">
                  <div className="bill-info-row">
                    <span className="bill-info-label">Merchant</span>
                    <span className="bill-info-value">{selected.merchant || "—"}</span>
                  </div>
                  <div className="bill-info-row">
                    <span className="bill-info-label">Ngày giao dịch</span>
                    <span className="bill-info-value">{selected.date}</span>
                  </div>
                  <div className="bill-info-row">
                    <span className="bill-info-label">Danh mục (OCR)</span>
                    <span className="bill-info-value">{selected.category || "Khác"}</span>
                  </div>
                  <div className="bill-info-row">
                    <span className="bill-info-label">Nguồn tiền</span>
                    <span className="bill-info-value">{selected.account_name || "Tài khoản thanh toán"}</span>
                  </div>
                  <div className="bill-info-row">
                    <span className="bill-info-label">Độ tin cậy OCR</span>
                    <span className="bill-info-value">{Math.round((selected.ocr_confidence || 0) * 100)}%</span>
                  </div>
                  <div className="bill-info-row">
                    <span className="bill-info-label">Mã hóa đơn</span>
                    <span className="bill-info-value" style={{color: "#6b7280"}}>{selected.bill_number || "—"}</span>
                  </div>
                  <div className="bill-info-row" style={{marginTop: "8px", borderTop: "2px solid #f3f4f6", paddingTop: "16px"}}>
                    <span className="bill-info-label" style={{fontWeight: "600", color: "#111827"}}>Tổng cộng</span>
                    <div style={{textAlign: "right"}}>
                      <div className="bill-info-value amount">{currency(selected.total_amount)}</div>
                      <div style={{fontSize: "11px", color: "#6b7280", marginTop: "2px"}}>Bao gồm VAT: {currency(selected.vat_amount || 0)}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {selected && (
            <div className="bill-detail-actions">
              <button type="button" className="primary">Xác nhận & Lưu</button>
              <button type="button" className="secondary">Chỉnh sửa hóa đơn</button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
