import { useState } from "react";
import TransactionRow from "../../components/TransactionRow.jsx";

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

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Giao dịch</h3>
        <button className="ghost" onClick={onBack} type="button">
          Quay lại
        </button>
      </div>

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

      <div className="list">
        {transactions.length === 0 ? (
          <p className="empty">Chưa có giao dịch nào trong giai đoạn này.</p>
        ) : (
          transactions.map((item) => (
            <div key={item.id} className="item-row">
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
