import { useMemo, useState } from "react";
import { currency, formatNumberInput, parseNumberInput } from "../../utils/format.js";
import "./accounts.css";

const WalletIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const UserIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const CreditCardIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;
const TrendIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
const BuildingIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>;
const BanknoteIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const EditIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const InfoIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ArrowRightIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

const COLOR_PALETTE = [
  "#ef4444", "#8b5cf6", "#3b82f6", "#06b6d4", 
  "#10b981", "#f59e0b", "#eab308", "#6b7280"
];

const emptyAccount = {
  name: "",
  type: "bank",
  provider: "",
  last4: "",
  balance: "",
  credit_limit: "",
  note: "",
  color: COLOR_PALETTE[2]
};

const PROVIDERS = {
  bank: [
    "Vietcombank", "Techcombank", "BIDV", "Agribank", "Vietinbank", 
    "MB Bank", "TPBank", "VPBank", "ACB", "OCB", "VIB"
  ],
  wallet: ["MoMo", "ZaloPay", "ShopeePay", "Viettel Money", "Moca"],
  credit: ["Visa", "Mastercard", "JCB", "American Express"]
};

const mask = (last4) => (last4 ? `**** ${last4}` : "----");

const getTypeIcon = (type) => {
  if (type === "cash") return <BanknoteIcon />;
  if (type === "bank") return <BuildingIcon />;
  if (type === "wallet") return <WalletIcon />;
  return <CreditCardIcon />;
};

const typeText = (type) => {
  if (type === "cash") return "Tiền mặt";
  if (type === "bank") return "Tài khoản";
  if (type === "wallet") return "Ví điện tử";
  return "Thẻ tín dụng";
};

export default function AccountsScreen({
  accounts = [],
  history = [],
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  loading
}) {
  const [form, setForm] = useState(emptyAccount);
  const [editingId, setEditingId] = useState(null);
  const [activeType, setActiveType] = useState("all");
  const [showForm, setShowForm] = useState(false);

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
      credit_limit: parseNumberInput(form.credit_limit) || null,
      note: form.note.trim(),
      color: form.color
    };
    if (editingId) await onUpdateAccount?.(editingId, payload);
    else await onCreateAccount?.(payload);

    setEditingId(null);
    setForm(emptyAccount);
    setShowForm(false);
  };

  const startEdit = (account) => {
    setEditingId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      provider: account.provider || "",
      last4: account.last4 || "",
      balance: formatNumberInput(account.balance),
      credit_limit: account.credit_limit ? formatNumberInput(account.credit_limit) : "",
      note: account.note || "",
      color: account.color || COLOR_PALETTE[2]
    });
    setShowForm(true);
  };

  const removeAccount = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa tài khoản này không?")) return;
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

  const totalBalance = accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const bankCount = accounts.filter(i => i.type === "bank").length;
  const cardCount = accounts.filter((item) => item.type === "credit").length;
  // Mock monthly change for display purposes
  const monthlyChange = -18750000;

  return (
    <section className="acc-page">
      <header className="acc-header">
        <div className="acc-header-icon"><WalletIcon /></div>
        <div className="acc-header-text">
          <h1>Ví & Tài khoản</h1>
        </div>
        <button className="acc-mobile-add-btn" onClick={() => { setForm(emptyAccount); setEditingId(null); setShowForm(true); }}>
          <PlusIcon />
        </button>
      </header>

      <section className="acc-kpis">
        <article className="acc-kpi-card">
          <div className="acc-kpi-top">
            <div className="acc-kpi-icon"><WalletIcon /></div>
          </div>
          <div className="acc-kpi-content">
            <span>Tổng số dư</span>
            <strong>{currency(totalBalance)}</strong>
          </div>
        </article>
        <article className="acc-kpi-card">
          <div className="acc-kpi-top">
            <div className="acc-kpi-icon"><UserIcon /></div>
          </div>
          <div className="acc-kpi-content">
            <span>Tài khoản đang quản lý</span>
            <strong>{bankCount}</strong>
          </div>
        </article>
        <article className="acc-kpi-card">
          <div className="acc-kpi-top">
            <div className="acc-kpi-icon"><CreditCardIcon /></div>
          </div>
          <div className="acc-kpi-content">
            <span>Thẻ đang lưu</span>
            <strong>{cardCount}</strong>
          </div>
        </article>
        <article className="acc-kpi-card">
          <div className="acc-kpi-top">
            <div className="acc-kpi-icon"><TrendIcon /></div>
          </div>
          <div className="acc-kpi-content">
            <span>Biến động tháng này</span>
            <strong className="red">{currency(monthlyChange)}</strong>
          </div>
        </article>
      </section>

      <div className="acc-grid">
        <div className="acc-left">
          <section className="acc-list-card">
            <div className="acc-list-header">
              <div className="acc-tabs">
                {[
                  { id: "all", label: "Tất cả" },
                  { id: "bank", label: "Tài khoản" },
                  { id: "credit", label: "Thẻ" },
                  { id: "wallet", label: "Ví điện tử" }
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
              <div className="acc-list-actions">
                <select defaultValue="newest">
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
                <button type="button">Lọc</button>
              </div>
            </div>

            <div className="acc-list">
              {!filteredAccounts.length ? (
                <p className="empty" style={{textAlign: "center", color: "#6b7280", padding: "20px 0"}}>Chưa có tài khoản nào.</p>
              ) : (
                filteredAccounts.map((account) => (
                  <article key={account.id} className="acc-item">
                    <div className="acc-item-main">
                      <div className="acc-item-icon" style={{ color: account.color || "#3b82f6" }}>
                        {getTypeIcon(account.type)}
                      </div>
                      <div>
                        <strong>{account.name}</strong>
                        <p>{account.provider || typeText(account.type)}</p>
                      </div>
                    </div>
                    
                    <div className="acc-item-number">
                      {account.type !== "cash" ? mask(account.last4) : "----"}
                    </div>

                    <div className="acc-item-balance">
                      <span>{account.type === "credit" ? "Dư nợ / Hạn mức" : "Số dư"}</span>
                      <strong>{currency(account.balance || 0)}</strong>
                    </div>

                    <div>
                      <span className={`acc-badge ${account.type}`}>{typeText(account.type)}</span>
                    </div>

                    <div className="acc-item-actions">
                      <button type="button" onClick={() => startEdit(account)} title="Sửa"><EditIcon /></button>
                      <button type="button" onClick={() => removeAccount(account.id)} title="Xóa"><TrashIcon /></button>
                    </div>
                  </article>
                ))
              )}
            </div>
            {filteredAccounts.length > 0 && (
              <div className="acc-list-footer">
                Hiển thị {filteredAccounts.length} trên {accounts.length} mục
              </div>
            )}
          </section>

          <section className="acc-history-card">
            <h3>Lịch sử cập nhật số dư</h3>
            <table className="acc-history-table">
              <thead>
                <tr>
                  <th>Hoạt động</th>
                  <th>Mục</th>
                  <th>Thay đổi</th>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {!history || history.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Chưa có lịch sử hoạt động.</td></tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="history-action">
                          <div className={`history-icon ${item.action}`}>
                            {item.action === "create" ? <PlusIcon /> : <EditIcon width={12} height={12} />}
                          </div> 
                          {item.action === "create" ? "Thêm tài khoản" : "Cập nhật số dư"}
                        </div>
                      </td>
                      <td>{item.item_name}</td>
                      <td className={`history-val ${item.change_amount >= 0 ? "pos" : "neg"}`}>
                        {item.change_amount >= 0 ? "+" : ""}{currency(item.change_amount || 0)}
                      </td>
                      <td>{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                      <td>{item.performer}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <a href="#" className="acc-history-more" onClick={(e) => e.preventDefault()}>Xem tất cả hoạt động &rarr;</a>
          </section>
        </div>

        {/* Form Container: Modal on mobile, Sidebar on desktop */}
        <div className={`acc-form-container ${showForm ? "show" : ""}`}>
           <aside className="acc-form-card">
              <div className="acc-form-header">
                <div className="acc-form-header-icon"><PlusIcon /></div>
                <h3>{editingId ? "Sửa tài khoản" : "Thêm tài khoản mới"}</h3>
                <button type="button" className="acc-modal-close" onClick={() => setShowForm(false)}><PlusIcon style={{transform:'rotate(45deg)'}} /></button>
              </div>

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
               <div className="acc-type-selector">
                 <div className={`acc-type-btn ${form.type === "cash" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "cash", provider: "" })}>
                   <BanknoteIcon /> Tiền mặt
                 </div>
                 <div className={`acc-type-btn ${form.type === "bank" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "bank", provider: "" })}>
                   <BuildingIcon /> Ngân hàng
                 </div>
                 <div className={`acc-type-btn ${form.type === "wallet" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "wallet", provider: "" })}>
                   <WalletIcon /> Ví điện tử
                 </div>
                 <div className={`acc-type-btn ${form.type === "credit" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "credit", provider: "" })}>
                   <CreditCardIcon /> Thẻ tín dụng
                 </div>
               </div>
             </label>

            {form.type !== "cash" && (
              <label>
                Nhà cung cấp
                <select
                  value={form.provider}
                  onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
                >
                  <option value="">Chọn nhà cung cấp</option>
                  {(PROVIDERS[form.type] || []).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}

            {form.type !== "cash" && (
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
                    placeholder="Ví dụ: 1234"
                  />
                </label>
                <label>
                  Số dư hiện tại *
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.balance}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, balance: formatNumberInput(event.target.value) }))
                    }
                    placeholder="0 đ"
                    required
                  />
                </label>
              </div>
            )}

            {form.type === "cash" && (
              <label>
                Số dư hiện tại *
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.balance}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, balance: formatNumberInput(event.target.value) }))
                  }
                  placeholder="0 đ"
                  required
                />
              </label>
            )}

            {form.type !== "cash" && (
              <label>
                Hạn mức (nếu có)
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.credit_limit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, credit_limit: formatNumberInput(event.target.value) }))
                  }
                  placeholder="0 đ"
                />
              </label>
            )}

            <label>
              Màu sắc
              <div className="acc-color-selector">
                {COLOR_PALETTE.map(color => (
                  <button 
                    key={color}
                    type="button" 
                    className={`acc-color-circle ${form.color === color ? "active" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm({ ...form, color })}
                  >
                    {form.color === color && <CheckIcon />}
                  </button>
                ))}
              </div>
            </label>

            <label>
              Ghi chú (tùy chọn)
              <textarea
                rows={2}
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Nhập ghi chú cho tài khoản này..."
              />
            </label>

            <div className="acc-form-actions">
              <button className="primary" type="submit" disabled={loading}>
                {loading ? "Đang lưu..." : editingId ? "Lưu tài khoản" : "Lưu tài khoản"}
              </button>
              {editingId && (
                <button
                  className="ghost"
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyAccount);
                  }}
                >
                  Hủy chỉnh sửa
                </button>
              )}
            </div>
          </form>

          <div className="acc-info-box">
            <InfoIcon />
            <div>Số dư được lưu nội bộ để cập nhật khi tạo giao dịch. Không liên kết ngân hàng tự động.</div>
          </div>
           </aside>
        </div>
      </div>
    </section>
  );
}
