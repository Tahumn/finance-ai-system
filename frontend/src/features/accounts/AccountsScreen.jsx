import { useEffect, useState } from "react";
import { currency } from "../../utils/format.js";

const storageKey = (email) => `finance_local_accounts:${email || "guest"}`;

const emptyAccount = {
  name: "",
  type: "cash",
  provider: "",
  last4: "",
  balance: ""
};

const mask = (last4) => (last4 ? `****${last4}` : "--");

export default function AccountsScreen({ userEmail }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyAccount);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(userEmail));
    if (!raw) {
      setAccounts([]);
      return;
    }
    try {
      setAccounts(JSON.parse(raw));
    } catch {
      setAccounts([]);
    }
  }, [userEmail]);

  useEffect(() => {
    localStorage.setItem(storageKey(userEmail), JSON.stringify(accounts));
  }, [accounts, userEmail]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    const payload = {
      id: editingId || `account-${Date.now()}`,
      name,
      type: form.type,
      provider: form.provider.trim(),
      last4: form.last4.trim().slice(-4),
      balance: form.balance ? Number(form.balance) : 0
    };

    setAccounts((current) => {
      if (!editingId) return [payload, ...current];
      return current.map((item) => (item.id === editingId ? payload : item));
    });

    setEditingId(null);
    setForm(emptyAccount);
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      provider: account.provider,
      last4: account.last4,
      balance: String(account.balance)
    });
  };

  const removeAccount = (id) => {
    setAccounts((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyAccount);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Tài khoản & Phương thức</h3>
        <span className="badge">UI local</span>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label className="field">
            <span>Tên tài khoản *</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ví dụ: Ví tiền mặt"
              required
            />
          </label>

          <label className="field">
            <span>Loại</span>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="cash">Tiền mặt</option>
              <option value="card">Thẻ</option>
              <option value="wallet">Ví điện tử</option>
              <option value="bank">Tài khoản ngân hàng</option>
            </select>
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>Nhà cung cấp</span>
            <input
              type="text"
              value={form.provider}
              onChange={(event) =>
                setForm((current) => ({ ...current, provider: event.target.value }))
              }
              placeholder="Visa / Momo / VCB"
            />
          </label>

          <label className="field">
            <span>4 số cuối</span>
            <input
              type="text"
              maxLength="4"
              value={form.last4}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  last4: event.target.value.replace(/\D/g, "")
                }))
              }
              placeholder="1234"
            />
          </label>

          <label className="field">
            <span>Số dư hiện tại</span>
            <input
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(event) =>
                setForm((current) => ({ ...current, balance: event.target.value }))
              }
            />
          </label>
        </div>

        <div className="row-actions">
          {editingId && (
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyAccount);
              }}
            >
              Hủy sửa
            </button>
          )}
          <button className="primary" type="submit">
            {editingId ? "Lưu tài khoản" : "Thêm tài khoản"}
          </button>
        </div>
      </form>

      <div className="list">
        {!accounts.length ? (
          <p className="empty">Chưa có tài khoản/phương thức thanh toán nào.</p>
        ) : (
          accounts.map((account) => (
            <article key={account.id} className="item-row account-row">
              <div>
                <p>
                  <strong>{account.name}</strong> - {account.type}
                </p>
                <small>
                  {account.provider || "Không có provider"} - {mask(account.last4)}
                </small>
              </div>
              <div className="account-right">
                <p>{currency(account.balance || 0)}</p>
                <div className="row-actions">
                  <button className="ghost" type="button" onClick={() => startEdit(account)}>
                    Sửa
                  </button>
                  <button
                    className="ghost danger"
                    type="button"
                    onClick={() => removeAccount(account.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
