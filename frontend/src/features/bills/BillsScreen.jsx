import { useMemo, useState, useEffect } from "react";
import { currency, formatNumberInput, parseNumberInput } from "../../utils/format.js";
import { colorFor } from "../../utils/colors.js";
import { getBaseUrl } from "../../api/client.js";
import "./bills.css";

// Icons
const SearchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const ReceiptIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17V7" /></svg>;
const FileTextIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>;
const CheckCircleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
const AlertCircleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
const AlertTriangleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const UploadIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
const PlusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>;

const getStatusDetails = (status) => {
  if (status === "confirmed") return { label: "Đã xác nhận", cls: "confirmed" };
  if (status === "pending") return { label: "Cần kiểm tra", cls: "pending" };
  return { label: "Thiếu thông tin", cls: "error" };
};

export default function BillsScreen({
  bills = [],
  categories = [],
  accounts = [],
  loading = false,
  onGoOcr,
  onCreateTransaction,
  onUpdateBill,
  onDeleteBill,
  newlyCreatedId
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bills
      .filter((b) => {
        const matchesQuery = (b.merchant || "").toLowerCase().includes(q) || (b.bill_number && String(b.bill_number).toLowerCase().includes(q));
        const matchesStatus = statusFilter === "all" || b.status === statusFilter;
        const matchesCat = categoryFilter === "all" || b.category_name === categoryFilter;
        return matchesQuery && matchesStatus && matchesCat;
      })
      .sort((a, b) => b.id - a.id); // Newest ID first
  }, [bills, query, statusFilter, categoryFilter]);

  const selected = filtered.find((x) => x.id === selectedId) || filtered[0] || null;

  // Reset edit mode when selected item changes
  useEffect(() => {
    setIsEditing(false);
    setEditData(null);
    setFormError("");
  }, [selectedId]);

  const confirmed = bills.filter((b) => b.status === "confirmed");
  const pending = bills.filter((b) => b.status === "pending");
  const errors = bills.filter((b) => b.status === "error");

  const confirmedSum = confirmed.reduce((acc, b) => acc + (b.total_amount || 0), 0);
  const pendingSum = pending.reduce((acc, b) => acc + (b.total_amount || 0), 0);
  const errorsSum = errors.reduce((acc, b) => acc + (b.total_amount || 0), 0);
  const totalSum = bills.reduce((acc, b) => acc + (b.total_amount || 0), 0);

  const handleConfirm = async () => {
    if (!selected || !onUpdateBill) return;
    
    try {
      await onUpdateBill(selected.id, { status: "confirmed" });
    } catch (err) {
      console.error("Failed to confirm bill:", err);
    }
  };

  const handleStartEdit = () => {
    if (!selected) return;
    setEditData({
      merchant: selected.merchant || "",
      date: selected.date || "",
      category_id: selected.category_id || "",
      account_id: selected.account_id || "",
      total_amount: selected.total_amount || 0,
      vat_amount: selected.vat_amount || 0,
      bill_number: selected.bill_number || "",
      notes: selected.notes || ""
    });
    setFormError("");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!onUpdateBill || !selected || !editData) return;

    // Validation
    if (!editData.merchant.trim()) return setFormError("Vui lòng nhập tên nhà hàng/merchant.");
    if (!editData.date) return setFormError("Vui lòng chọn ngày giao dịch.");
    if (!editData.category_id) return setFormError("Vui lòng chọn danh mục.");
    if (!editData.account_id) return setFormError("Vui lòng chọn nguồn tiền.");
    if (editData.total_amount <= 0) return setFormError("Số tiền phải lớn hơn 0.");

    setFormError("");
    try {
      await onUpdateBill(selected.id, editData);
      setIsEditing(false);
      setEditData(null);
    } catch (err) {
      setFormError(err.message || "Không thể cập nhật hóa đơn.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(null);
  };

  return (
    <>
      <section className="bill-page">
        <header className="bill-header">
          <div className="bill-header-text">
            <h1>Hóa đơn</h1>
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
              <span>Tổng hóa đơn ({bills.length})</span>
              <strong>{currency(totalSum)}</strong>
            </div>
          </article>
          <article className="bill-kpi-card">
            <div className="bill-kpi-icon"><CheckCircleIcon /></div>
            <div className="bill-kpi-content">
              <span>Đã xác nhận ({confirmed.length})</span>
              <strong>{currency(confirmedSum)}</strong>
            </div>
          </article>
          <article className="bill-kpi-card">
            <div className="bill-kpi-icon"><AlertCircleIcon /></div>
            <div className="bill-kpi-content">
              <span>Cần kiểm tra ({pending.length})</span>
              <strong>{currency(pendingSum)}</strong>
            </div>
          </article>
          <article className="bill-kpi-card">
            <div className="bill-kpi-icon"><AlertTriangleIcon /></div>
            <div className="bill-kpi-content">
              <span>OCR lỗi / Thiếu ({errors.length})</span>
              <strong>{currency(errorsSum)}</strong>
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
              <select
                className="bill-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="pending">Cần kiểm tra</option>
                <option value="error">Lỗi / Thiếu thông tin</option>
              </select>
              <select
                className="bill-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">Tất cả danh mục</option>
                {Array.from(new Set(bills.map(b => b.category_name).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
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
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "30px" }}>Đang tải dữ liệu...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: "center", padding: "30px" }}>Không có hóa đơn nào.</td></tr>
                  ) : (
                    filtered.map((b) => {
                      const conf = Math.round((b.ocr_confidence || 0) * 100);
                      const status = getStatusDetails(b.status);
                      const confClass = conf >= 90 ? "" : conf >= 80 ? "warn" : "bad";

                      return (
                        <tr
                          key={b.id}
                          className={`${selectedId === b.id ? "active" : ""} ${newlyCreatedId === b.id ? "new-item-flash" : ""}`}
                          onClick={() => setSelectedId(b.id)}
                        >
                          <td className="bill-merchant">
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: "600", color: "#1e293b" }}>{b.merchant || "Hóa đơn OCR"}</span>
                              {b.notes && (
                                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
                                  {b.notes}
                                </span>
                              )}
                              {b.bill_number && (
                                <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: "normal" }}>
                                  Ref: {b.bill_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>{b.date}</td>
                          <td>{b.category_name || "Khác"}</td>
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
              {isEditing && <span className="bill-edit-badge">Đang chỉnh sửa</span>}
            </div>

            <div className="bill-detail-body">
              {!selected ? (
                <p style={{ color: "#6b7280", textAlign: "center" }}>Vui lòng chọn một hóa đơn để xem chi tiết.</p>
              ) : (
                <>
                  <div className="bill-receipt-img" onClick={() => selected.image_path && setIsModalOpen(true)}>
                    {selected.image_path ? (
                      <>
                        <img
                          src={`${getBaseUrl()}${selected.image_path}`}
                          alt="Hóa đơn"
                        />
                        {!isEditing && (
                          <div className="bill-img-overlay">
                            <span>Nhấn để phóng to</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <FileTextIcon />
                        <p style={{ marginTop: "12px", marginBottom: 0 }}>Hình ảnh hóa đơn gốc</p>
                        <span style={{ fontSize: "12px" }}>(Chưa có file đính kèm)</span>
                      </>
                    )}
                  </div>

                  <div className="bill-info-section">
                    {isEditing ? (
                      <div className="bill-edit-form">
                        {formError && (
                          <div className="bill-form-error">
                            <AlertTriangleIcon />
                            <span>{formError}</span>
                          </div>
                        )}
                        <div className="bill-edit-group">
                          <label className="bill-edit-label">Merchant / Tên nhà hàng</label>
                          <input
                            type="text"
                            className="bill-edit-input"
                            placeholder="Nhập tên cửa hàng..."
                            value={editData.merchant}
                            onChange={(e) => {
                              setEditData({ ...editData, merchant: e.target.value });
                              if (formError) setFormError("");
                            }}
                          />
                        </div>

                        <div className="bill-edit-row-2">
                          <div className="bill-edit-group">
                            <label className="bill-edit-label">Ngày giao dịch</label>
                            <input
                              type="date"
                              className="bill-edit-input"
                              value={editData.date}
                              onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                            />
                          </div>
                          <div className="bill-edit-group">
                            <label className="bill-edit-label">Mã hóa đơn</label>
                            <input
                              type="text"
                              className="bill-edit-input"
                              placeholder="VD: HD001"
                              value={editData.bill_number}
                              onChange={(e) => setEditData({ ...editData, bill_number: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="bill-edit-row-2">
                          <div className="bill-edit-group">
                            <label className="bill-edit-label">Danh mục chi tiêu</label>
                            <select
                              className="bill-edit-input"
                              value={editData.category_id || ""}
                              onChange={(e) => setEditData({ ...editData, category_id: e.target.value ? parseInt(e.target.value) : null })}
                            >
                              <option value="">Chọn danh mục</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="bill-edit-group">
                            <label className="bill-edit-label">Nguồn tiền</label>
                            <select
                              className="bill-edit-input"
                              value={editData.account_id || ""}
                              onChange={(e) => setEditData({ ...editData, account_id: e.target.value ? parseInt(e.target.value) : null })}
                            >
                              <option value="">Chọn tài khoản</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="bill-edit-group">
                          <label className="bill-edit-label">Ghi chú / Nội dung</label>
                          <textarea
                            className="bill-edit-input"
                            rows="2"
                            style={{ resize: "vertical" }}
                            placeholder="Nhập nội dung ghi chú..."
                            value={editData.notes || ""}
                            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                          />
                        </div>

                        <div className="bill-edit-amount-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <label className="bill-edit-label" style={{ color: "#e11d48" }}>Tổng thanh toán</label>
                              <span style={{ fontSize: "12px", color: "#6b7280", paddingLeft: "4px" }}>(Đơn vị: VND)</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <input
                                type="text"
                                className="bill-edit-input amount"
                                value={formatNumberInput(editData.total_amount)}
                                onChange={(e) => setEditData({ ...editData, total_amount: parseNumberInput(e.target.value) })}
                              />
                              <span style={{ fontSize: "20px", fontWeight: "800", color: "#e11d48" }}>₫</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ffe4e6", paddingTop: "8px" }}>
                            <label className="bill-edit-label">Trong đó VAT</label>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "140px" }}>
                              <input
                                type="text"
                                className="bill-edit-input small"
                                value={formatNumberInput(editData.vat_amount)}
                                onChange={(e) => setEditData({ ...editData, vat_amount: parseNumberInput(e.target.value) })}
                              />
                              <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>₫</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bill-info-row">
                          <span className="bill-info-label">Merchant</span>
                          <span className="bill-info-value" style={{ fontWeight: "600", color: "#0f172a" }}>{selected.merchant || "—"}</span>
                        </div>
                        <div className="bill-info-row">
                          <span className="bill-info-label">Ngày giao dịch</span>
                          <span className="bill-info-value">{selected.date}</span>
                        </div>
                        <div className="bill-info-row">
                          <span className="bill-info-label">Danh mục</span>
                          <span className="bill-info-value">{selected.category_name || "Khác"}</span>
                        </div>
                        <div className="bill-info-row">
                          <span className="bill-info-label">Nguồn tiền</span>
                          <span className="bill-info-value">{selected.account_name || "Tài khoản thanh toán"}</span>
                        </div>
                        <div className="bill-info-row">
                          <span className="bill-info-label">Mã hóa đơn</span>
                          <span className="bill-info-value" style={{ color: "#6b7280" }}>{selected.bill_number || "—"}</span>
                        </div>
                        <div className="bill-info-row">
                          <span className="bill-info-label">Ghi chú</span>
                          <span className="bill-info-value" style={{ fontStyle: selected.notes ? "normal" : "italic", color: selected.notes ? "#1e293b" : "#94a3b8" }}>{selected.notes || "Không có ghi chú"}</span>
                        </div>
                        <div className="bill-info-row">
                          <span className="bill-info-label">Độ tin cậy OCR</span>
                          <span className="bill-info-value">{Math.round((selected.ocr_confidence || 0) * 100)}%</span>
                        </div>

                        <div className="bill-info-row" style={{ marginTop: "8px", borderTop: "2px solid #f3f4f6", paddingTop: "16px" }}>
                          <span className="bill-info-label" style={{ fontWeight: "600", color: "#111827" }}>Tổng cộng</span>
                          <div style={{ textAlign: "right" }}>
                            <div className="bill-info-value amount">{currency(selected.total_amount)}</div>
                            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Bao gồm VAT: {currency(selected.vat_amount || 0)}</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {selected && (
              <div className="bill-detail-actions">
                {isEditing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                    <button type="button" className="primary" onClick={handleSaveEdit}>Lưu thay đổi</button>
                    <button type="button" className="secondary" onClick={handleCancelEdit}>Hủy bỏ</button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="primary"
                      onClick={handleConfirm}
                      disabled={selected.status === "confirmed"}
                    >
                      {selected.status === "confirmed" ? "Đã xác nhận" : "Xác nhận & Lưu"}
                    </button>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <button type="button" className="secondary" style={{ flex: 1 }} onClick={handleStartEdit}>Chỉnh sửa</button>
                      <button
                        type="button"
                        className="bill-btn-delete"
                        onClick={() => onDeleteBill && onDeleteBill(selected.id)}
                        title="Xóa hóa đơn"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>
      {isModalOpen && selected?.image_path && (
        <div className="bill-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="bill-modal-content" onClick={e => e.stopPropagation()}>
            <button className="bill-modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            <img
              src={`${getBaseUrl()}${selected.image_path}`}
              alt="Hóa đơn phóng lớn"
            />
          </div>
        </div>
      )}
    </>
  );
}
