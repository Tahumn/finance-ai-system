import { useMemo, useState } from "react";
import TransactionRow from "../../components/TransactionRow.jsx";
import { currency, toInputDate } from "../../utils/format.js";

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

const tabs = [
  { key: "all", label: "All" },
  { key: "categories", label: "Categories" },
  { key: "tags", label: "Tags" }
];

const extractTags = (description) => {
  const matches = (description || "").match(/#[a-zA-Z0-9_]+/g);
  if (!matches) return [];
  return matches.map((tag) => tag.toLowerCase());
};

export default function TransactionsScreen({
  transactions,
  categories,
  filters,
  onFiltersChange,
  onCreate,
  onUpdate,
  onDelete,
  onBack,
  loading
}) {
  const [editingTx, setEditingTx] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [nlQuery, setNlQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  const filteredTransactions = useMemo(() => {
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

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

  const categorySummary = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc, item) => {
      const key = item.categoryLabel || "Uncategorized";
      if (!acc[key]) {
        acc[key] = { name: key, amount: 0, count: 0 };
      }
      acc[key].amount += Number(item.amount || 0);
      acc[key].count += 1;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  const tagsSummary = useMemo(() => {
    const grouped = filteredTransactions.reduce((acc, item) => {
      const tags = extractTags(item.description);
      tags.forEach((tag) => {
        if (!acc[tag]) {
          acc[tag] = { name: tag, amount: 0, count: 0 };
        }
        acc[tag].amount += Number(item.amount || 0);
        acc[tag].count += 1;
      });
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }, [filteredTransactions]);

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
    const lines = [header.join(","), ...filteredTransactions.map(toCsvRow)];
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

  return (
    <section className="panel transactions-page">
      <header className="transactions-header">
        <div>
          <p className="eyebrow">Finance Workspace</p>
          <h2>Transactions</h2>
        </div>
        <button className="ghost" onClick={onBack} type="button">
          Quay lại
        </button>
      </header>

      <div className="transactions-tabs" role="tablist" aria-label="Transactions subview tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeTab === item.key}
            className={`transactions-tab ${activeTab === item.key ? "active" : ""}`}
            onClick={() => setActiveTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="transactions-content-card">
        {activeTab === "all" && (
          <>
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
                <label>Từ khóa</label>
                <input
                  type="text"
                  value={searchText}
                  placeholder="Mô tả, danh mục..."
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Min amount</label>
                <input
                  type="number"
                  min="0"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Max amount</label>
                <input
                  type="number"
                  min="0"
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
                placeholder='Tôi chi bao nhiêu cà phê tháng 12'
              />
              <button className="ghost" type="button" onClick={handleApplyNlQuery}>
                Áp dụng query NL
              </button>
            </div>

            <form className="form" onSubmit={handleCreate}>
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
                Thêm giao dịch
              </button>
            </form>

            <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <button
                  className="ghost danger"
                  type="button"
                  disabled={!selectedIds.length}
                  onClick={handleBulkDelete}
                >
                  Xóa đã chọn ({selectedIds.length})
                </button>
              </div>
              <button className="ghost" type="button" onClick={handleExportCsv}>
                Export CSV
              </button>
            </div>

            <div className="list">
              {!visibleTransactions.length ? (
                <p className="empty">Chưa có giao dịch nào trong giai đoạn này.</p>
              ) : (
                visibleTransactions.map((item) => (
                  <div key={item.id} className="item-row">
                    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                      />
                      <span className="eyebrow">Chọn</span>
                    </label>
                    <TransactionRow item={item} categoryLabel={item.categoryLabel} />
                    <div className="row-actions">
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

            {filteredTransactions.length > visibleCount && (
              <div className="row-actions" style={{ justifyContent: "center" }}>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => setVisibleCount((current) => current + 20)}
                >
                  Xem thêm
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "categories" && (
          <>
            <p className="transactions-helper-text">
              Category subview hiển thị tổng hợp dựa trên giao dịch hiện tại.
            </p>
            <div className="transactions-summary-row">
              {!categorySummary.length ? (
                <p className="empty">Không có dữ liệu category trong bộ lọc hiện tại.</p>
              ) : (
                categorySummary.map((item) => (
                  <article key={item.name} className="transactions-summary-card">
                    <p>{item.name}</p>
                    <strong>{currency(item.amount)}</strong>
                    <small>{item.count} giao dịch</small>
                  </article>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "tags" && (
          <>
            <p className="transactions-helper-text">
              Tags subview dùng hashtag trong mô tả (ví dụ: #coffee, #work).
            </p>
            <div className="transactions-summary-row">
              {!tagsSummary.length ? (
                <p className="empty">Chưa có tag nào trong mô tả giao dịch.</p>
              ) : (
                tagsSummary.map((item) => (
                  <article key={item.name} className="transactions-summary-card">
                    <p>{item.name}</p>
                    <strong>{currency(item.amount)}</strong>
                    <small>{item.count} lần xuất hiện</small>
                  </article>
                ))
              )}
            </div>
          </>
        )}
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
    </section>
  );
}
