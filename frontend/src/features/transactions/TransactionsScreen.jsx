import { useMemo, useState } from "react";
import TransactionRow from "../../components/TransactionRow.jsx";
import CategoriesScreen from "../categories/CategoriesScreen.jsx";
import TagsScreen from "../tags/TagsScreen.jsx";
import OcrScreen from "../ocr/OcrScreen.jsx";
import { toInputDate, currency } from "../../utils/format.js";

const parseMonthFromNL = (text) => {
  const match = text.toLowerCase().match(/thang\s*(\d{1,2})/);
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  const year = new Date().getFullYear();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: toInputDate(start),
    end: toInputDate(end)
  };
};

const toCsvRow = (item) =>
  [
    item.date,
    item.description,
    item.transaction_type,
    item.amount,
    item.categoryLabel || ""
  ]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
    .join(",");

const extractTags = (description) => {
  const matches = (description || "").match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return [];
  return matches.map((tag) => tag.toLowerCase());
};

export default function TransactionsScreen({
  transactions,
  totalCount,
  categories,
  filters,
  onFiltersChange,
  onCreate,
  onCreateFromText,
  onParseFromText,
  onUpdate,
  onDelete,
  onCreateCategory,
  onCreateTransaction,
  onLoadMore,
  hasMore,
  userEmail,
  onBack,
  loading
}) {
  const [editingTx, setEditingTx] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [nlQuery, setNlQuery] = useState("");
  const [nlpText, setNlpText] = useState("");
  const [nlpNotice, setNlpNotice] = useState("");
  const [nlpError, setNlpError] = useState("");
  const [nlpPreview, setNlpPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showOcr, setShowOcr] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  const displayTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchText =
        !searchText.trim() ||
        `${item.description} ${item.categoryLabel || ""}`
          .toLowerCase()
          .includes(searchText.toLowerCase());
      const amount = Number(item.amount || 0);
      const matchMin = !minAmount || amount >= Number(minAmount);
      const matchMax = !maxAmount || amount <= Number(maxAmount);
      return matchText && matchMin && matchMax;
    });
  }, [transactions, searchText, minAmount, maxAmount]);

  const handleCreate = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = form.get("category_id");
    onCreate({
      description: form.get("description"),
      amount: Number(form.get("amount")),
      transaction_type: form.get("transaction_type"),
      category_id: category ? Number(category) : null,
      date: form.get("date")
    });
    event.currentTarget.reset();
    setShowAddForm(false);
  };

  const handleUpdate = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = form.get("category_id");
    onUpdate(editingTx.id, {
      description: form.get("description"),
      amount: Number(form.get("amount")),
      transaction_type: form.get("transaction_type"),
      category_id: category ? Number(category) : null,
      date: form.get("date")
    });
    setEditingTx(null);
  };

  const toggleSelection = (transactionId) => {
    setSelectedIds((current) =>
      current.includes(transactionId)
        ? current.filter((id) => id !== transactionId)
        : [...current, transactionId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Xóa ${selectedIds.length} giao dịch đã chọn?`)) return;
    await Promise.all(selectedIds.map((id) => onDelete(id)));
    setSelectedIds([]);
  };

  const handleExportCsv = () => {
    const header = ["date", "description", "type", "amount", "category"];
    const lines = [header.join(","), ...displayTransactions.map(toCsvRow)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transactions-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyNlQuery = () => {
    const text = nlQuery.trim();
    if (!text) return;
    setSearchText(text);
    const monthRange = parseMonthFromNL(text);
    if (monthRange) {
      onFiltersChange({ ...filters, ...monthRange });
    }
  };

  const handleNlpCreate = async (event) => {
    event.preventDefault();
    const text = nlpText.trim();
    if (!text || !onCreateFromText) return;
    setNlpNotice("");
    setNlpError("");
    try {
      await onCreateFromText(text);
      setNlpNotice("Đã tạo giao dịch từ văn bản.");
      setNlpText("");
      setNlpPreview(null);
    } catch (err) {
      setNlpError(err.message || "Không thể tạo từ văn bản.");
    }
  };

  const handleNlpPreview = async () => {
    const text = nlpText.trim();
    if (!text || !onParseFromText) return;
    setNlpNotice("");
    setNlpError("");
    try {
      const preview = await onParseFromText(text);
      setNlpPreview(preview);
    } catch (err) {
      setNlpPreview(null);
      setNlpError(err.message || "Không thể xem trước.");
    }
  };

  return (
    <section className="panel transactions-page">
      <header className="transactions-header">
        <div>
          <p className="eyebrow">Quản lý giao dịch</p>
          <h2>Giao dịch ({totalCount})</h2>
        </div>
        <div className="transactions-actions">
          <button
            className="ghost"
            type="button"
            onClick={() => setShowOcr((current) => !current)}
          >
            {showOcr ? "Ẩn OCR" : "Nhập OCR"}
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => setShowAddForm((current) => !current)}
          >
            {showAddForm ? "Ẩn form" : "Thêm mới"}
          </button>
          <button className="ghost" onClick={onBack} type="button">
            Quay lại
          </button>
        </div>
      </header>

      <div className="transactions-crud-grid">
        <CategoriesScreen
          categories={categories}
          onCreate={onCreateCategory}
          loading={loading}
          embedded
        />
        <TagsScreen userEmail={userEmail} embedded />
      </div>

      {showOcr && (
        <div className="transactions-content-card">
          <OcrScreen
            categories={categories}
            onCreateTransaction={onCreateTransaction}
            loading={loading}
          />
        </div>
      )}

      <div className="transactions-content-card">
        <>
          <form className="form" onSubmit={handleNlpCreate} style={{ marginBottom: 16 }}>
            <div className="row">
              <input
                type="text"
                value={nlpText}
                onChange={(event) => setNlpText(event.target.value)}
                placeholder="NLP: hom nay chi 50k an sang"
              />
              <button
                className="ghost"
                type="button"
                onClick={handleNlpPreview}
                disabled={loading || !nlpText.trim()}
              >
                Xem trước
              </button>
              <button className="primary" type="submit" disabled={loading || !nlpText.trim()}>
                Nhập nhanh
              </button>
            </div>
            {nlpNotice && <p className="form-note">{nlpNotice}</p>}
            {nlpError && <p className="form-error">{nlpError}</p>}
            {nlpPreview && (
              <div className="list" style={{ marginTop: 10 }}>
                <div className="item-row preview-box">
                  <div>
                    <p className="eyebrow">Xem trước kết quả</p>
                    <p><strong>Mô tả:</strong> {nlpPreview.description}</p>
                    <p><strong>Loại:</strong> {nlpPreview.transaction_type === 'income' ? 'Thu' : 'Chi'}</p>
                    <p><strong>Số tiền:</strong> {currency(nlpPreview.amount || 0)}</p>
                    <p><strong>Ngày:</strong> {nlpPreview.date}</p>
                    <p><strong>Danh mục:</strong> {nlpPreview.category_name || "Mặc định"}</p>
                  </div>
                </div>
              </div>
            )}
          </form>

          <div className="filters compact">
            <div className="field">
              <label>Loại</label>
              <select
                value={filters.type}
                onChange={(event) =>
                  onFiltersChange({ ...filters, type: event.target.value })
                }
              >
                <option value="">Tất cả</option>
                <option value="income">Thu nhập</option>
                <option value="expense">Chi tiêu</option>
              </select>
            </div>
            <div className="field">
              <label>Danh mục</label>
              <select
                value={filters.categoryId}
                onChange={(event) =>
                  onFiltersChange({ ...filters, categoryId: event.target.value })
                }
              >
                <option value="">Tất cả</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tìm kiếm</label>
              <input
                type="text"
                value={searchText}
                placeholder="Mô tả..."
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Min</label>
              <input
                type="number"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Max</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
              />
            </div>
          </div>

          <div className="row" style={{ marginBottom: 14 }}>
            <input
              type="text"
              value={nlQuery}
              onChange={(event) => setNlQuery(event.target.value)}
              placeholder='Tìm nhanh: "cafe tháng 3"'
            />
            <button className="ghost" type="button" onClick={handleApplyNlQuery}>
              Áp dụng
            </button>
          </div>

          {showAddForm && (
            <form className="form" onSubmit={handleCreate} style={{ background: 'var(--bg-alt)', padding: 15, borderRadius: 8 }}>
              <input name="description" type="text" placeholder="Mô tả" required />
              <div className="row">
                <select name="transaction_type" defaultValue="expense">
                  <option value="expense">Chi tiêu</option>
                  <option value="income">Thu nhập</option>
                </select>
                <select name="category_id" defaultValue="">
                  <option value="">Không có danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <input name="amount" type="number" placeholder="Số tiền" required />
                <input name="date" type="date" required />
              </div>
              <button className="primary" type="submit" disabled={loading}>
                Lưu giao dịch
              </button>
            </form>
          )}

          <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <button
                className="ghost danger"
                type="button"
                disabled={!selectedIds.length}
                onClick={handleBulkDelete}
              >
                Xóa ({selectedIds.length})
              </button>
            </div>
            <button className="ghost" type="button" onClick={handleExportCsv}>
              Xuất CSV
            </button>
          </div>

          <div className="list">
            {!displayTransactions.length ? (
              <p className="empty">Không tìm thấy giao dịch nào.</p>
            ) : (
              displayTransactions.map((item) => (
                <div key={item.id} className="item-row">
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                    />
                  </label>
                  <TransactionRow item={item} categoryLabel={item.categoryLabel} />
                  <div className="row-actions">
                    <button className="ghost" type="button" onClick={() => setSelectedTx(item)}>
                      Chi tiết
                    </button>
                    <button className="ghost" onClick={() => setEditingTx(item)} type="button">
                      Sửa
                    </button>
                    <button
                      className="ghost danger"
                      onClick={() => onDelete(item.id)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {hasMore && (
            <div className="row-actions" style={{ justifyContent: "center", marginTop: 20 }}>
              <button
                className="ghost"
                type="button"
                onClick={onLoadMore}
                disabled={loading}
              >
                {loading ? "Đang tải..." : "Tải thêm giao dịch"}
              </button>
            </div>
          )}
        </>
      </div>

      {editingTx && (
        <div className="sheet">
          <div className="sheet-body">
            <h3>Chỉnh sửa giao dịch</h3>
            <form className="form" onSubmit={handleUpdate}>
              <input
                name="description"
                type="text"
                defaultValue={editingTx.description}
                required
              />
              <div className="row">
                <select name="transaction_type" defaultValue={editingTx.transaction_type}>
                  <option value="expense">Chi tiêu</option>
                  <option value="income">Thu nhập</option>
                </select>
                <select name="category_id" defaultValue={editingTx.category_id || ""}>
                  <option value="">Không có danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <input name="amount" type="number" defaultValue={editingTx.amount} required />
                <input name="date" type="date" defaultValue={editingTx.date} required />
              </div>
              <div className="row-actions">
                <button className="ghost" type="button" onClick={() => setEditingTx(null)}>
                  Hủy
                </button>
                <button className="primary" type="submit" disabled={loading}>
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTx && (
        <div className="sheet">
          <div className="sheet-body">
            <h3>Chi tiết giao dịch</h3>
            <div className="detail-grid">
              <div>
                <p className="eyebrow">Mô tả</p>
                <strong>{selectedTx.description}</strong>
              </div>
              <div>
                <p className="eyebrow">Ngày</p>
                <strong>{selectedTx.date}</strong>
              </div>
              <div>
                <p className="eyebrow">Loại</p>
                <strong>{selectedTx.transaction_type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</strong>
              </div>
              <div>
                <p className="eyebrow">Danh mục</p>
                <strong>{selectedTx.categoryLabel || "Không có"}</strong>
              </div>
              <div>
                <p className="eyebrow">Số tiền</p>
                <strong>{currency(selectedTx.amount)}</strong>
              </div>
            </div>
            <div className="row-actions">
              <button className="ghost" type="button" onClick={() => setSelectedTx(null)}>
                Đóng
              </button>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setEditingTx(selectedTx);
                  setSelectedTx(null);
                }}
              >
                Sửa giao dịch
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
