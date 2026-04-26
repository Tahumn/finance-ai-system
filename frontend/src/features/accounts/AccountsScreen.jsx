import { useMemo, useState } from "react";
import { currency, formatNumberInput, parseNumberInput } from "../../utils/format.js";
import "./accounts.css";

const emptyAccount = {
  name: "",
  type: "bank",
  provider: "",
  last4: "",
  balance: "",
  note: "",
  color: "#ec4899"
};

const mask = (last4) => (last4 ? `•••• ${last4}` : "--");
const typeText = (type) => {
  if (type === "cash") return "Tiền mặt";
  if (type === "bank") return "Ngân hàng";
  if (type === "wallet") return "Ví điện tử";
  return "Thẻ tín dụng";
};
const typeClass = (type) => {
  if (type === "cash") return "cash";
  if (type === "bank") return "bank";
  if (type === "wallet") return "wallet";
  return "credit";
};

export default function AccountsScreen({
  accounts = [],
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  loading
}) {
  const [form, setForm] = useState(emptyAccount);
  const [editingId, setEditingId] = useState(null);
  const [activeType, setActiveType] = useState("all");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    const payload = {
      name,
      type: form.type,
      provider: form.provider.trim(),
      last4: form.last4.trim().slice(-4),
      balance: parseNumberInput(form.balance),
      note: form.note.trim(),
      color: form.color
    };
    if (editingId) await onUpdateAccount?.(editingId, payload);
    else await onCreateAccount?.(payload);

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
      balance: formatNumberInput(account.balance),
      note: account.note || "",
      color: account.color || "#ec4899"
    });
  };

  const removeAccount = async (id) => {
    await onDeleteAccount?.(id);
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyAccount);
    }
  };

  const filteredAccounts = useMemo(() => {
    if (activeType === "all") return accounts;
    return accounts.filter((item) => item.type === activeType);
  }, [accounts, activeType]);

  const totalBalance = filteredAccounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const walletCount = filteredAccounts.filter((item) => item.type === "wallet").length;
  const cardCount = filteredAccounts.filter((item) => item.type === "credit").length;

  return (
    <section className="acc-page">
      <header className="acc-header">
        <h1>Thẻ & Tài khoản</h1>
        <p>Quản lý thủ công các tài khoản thanh toán, ví điện tử và thẻ để theo dõi số dư và ghi nhận giao dịch.</p>
      </header>

      <div className="acc-grid">
        <div className="acc-left">
          <section className="acc-kpis">
            <article><span>Tổng số dư</span><strong>{currency(totalBalance)}</strong></article>
            <article><span>Tài khoản đang quản lý</span><strong>{filteredAccounts.length}</strong></article>
            <article><span>Thẻ đang lưu</span><strong>{cardCount}</strong></article>
            <article><span>Ví điện tử</span><strong>{walletCount}</strong></article>
          </section>

          <section className="acc-list-card">
            <div className="acc-tabs">
              {[
                { id: "all", label: "Tất cả" },
                { id: "bank", label: "Tài khoản" },
                { id: "credit", label: "Thẻ" },
                { id: "wallet", label: "Ví điện tử" },
                { id: "cash", label: "Tiền mặt" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeType === tab.id ? "active" : ""}
                  onClick={() => setActiveType(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="acc-list">
              {!filteredAccounts.length ? (
                <p className="empty">Chưa có tài khoản nào.</p>
              ) : (
                filteredAccounts.map((account) => (
                  <article key={account.id} className="acc-item">
                    <div className="acc-item-main">
                      <div className={`acc-type-dot ${typeClass(account.type)}`} />
                      <div>
                        <strong>{account.name}</strong>
                        <p>{account.provider || "Không có nhà cung cấp"} · {mask(account.last4)}</p>
                      </div>
                    </div>
                    <div className="acc-item-right">
                      <span className={`acc-badge ${typeClass(account.type)}`}>{typeText(account.type)}</span>
                      <strong>{currency(account.balance || 0)}</strong>
                      <div className="acc-item-actions">
                        <button type="button" onClick={() => startEdit(account)}>Sửa</button>
                        <button type="button" className="danger" onClick={() => removeAccount(account.id)}>Xóa</button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="acc-form-card">
          <h3>Thêm tài khoản / thẻ thủ công</h3>
          <form className="acc-form" onSubmit={handleSubmit}>
            <label>
              Tên tài khoản / thẻ *
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ví dụ: Tài khoản lương, Thẻ Visa..."
                required
              />
            </label>

            <label>
              Loại *
              <select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank">Ngân hàng</option>
                <option value="wallet">Ví điện tử</option>
                <option value="credit">Thẻ tín dụng</option>
              </select>
            </label>

            <label>
              Nhà cung cấp
              <input
                type="text"
                value={form.provider}
                onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
                placeholder="Ví dụ: Vietcombank, MoMo"
              />
            </label>

            <div className="acc-row-2">
              <label>
                4 số cuối
                <input
                  type="text"
                  maxLength="4"
                  value={form.last4}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, last4: event.target.value.replace(/\D/g, "") }))
                  }
                  placeholder="1234"
                />
              </label>
              <label>
                Số dư hiện tại
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.balance}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, balance: formatNumberInput(event.target.value) }))
                  }
                  placeholder="0"
                />
              </label>
            </div>

            <label>
              Màu sắc
              <input
                type="color"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
              />
            </label>

            <label>
              Ghi chú
              <textarea
                rows={3}
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Nhập ghi chú..."
              />
            </label>

            <div className="acc-form-actions">
              {editingId ? (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyAccount);
                  }}
                >
                  Hủy
                </button>
              ) : null}
              <button className="primary" type="submit" disabled={loading}>
                {loading ? "Đang lưu..." : editingId ? "Lưu tài khoản" : "Thêm tài khoản"}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </section>
  );
}
