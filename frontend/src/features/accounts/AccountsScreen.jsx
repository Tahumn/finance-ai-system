import { useEffect, useState } from "react";
import { currency, formatNumberInput, parseNumberInput } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";

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
      balance: parseNumberInput(form.balance)
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
      balance: formatNumberInput(account.balance)
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
        <h3>{t("accounts.title")}</h3>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label className="field">
            <span>{t("accounts.form.name")}</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("accounts.form.name_placeholder")}
              required
            />
          </label>

          <label className="field">
            <span>{t("accounts.form.type")}</span>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="cash">{t("accounts.type.cash")}</option>
              <option value="card">{t("accounts.type.card")}</option>
              <option value="wallet">{t("accounts.type.wallet")}</option>
              <option value="bank">{t("accounts.type.bank")}</option>
            </select>
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>{t("accounts.form.provider")}</span>
            <input
              type="text"
              value={form.provider}
              onChange={(event) =>
                setForm((current) => ({ ...current, provider: event.target.value }))
              }
              placeholder={t("accounts.form.provider_placeholder")}
            />
          </label>

          <label className="field">
            <span>{t("accounts.form.last4")}</span>
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
            <span>{t("accounts.form.balance")}</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.balance}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  balance: formatNumberInput(event.target.value)
                }))
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
              {t("accounts.action.cancel_edit")}
            </button>
          )}
          <button className="primary" type="submit">
            {editingId ? t("accounts.action.save") : t("accounts.action.add")}
          </button>
        </div>
      </form>

      <div className="list">
        {!accounts.length ? (
          <p className="empty">{t("accounts.empty")}</p>
        ) : (
          accounts.map((account) => (
            <article key={account.id} className="item-row account-row">
              <div>
                <p>
                  <strong>{account.name}</strong> - {t(`accounts.type.${account.type}`)}
                </p>
                <small>
                  {account.provider || t("accounts.no_provider")} - {mask(account.last4)}
                </small>
              </div>
              <div className="account-right">
                <p>{currency(account.balance || 0)}</p>
                <div className="row-actions">
                  <button className="ghost" type="button" onClick={() => startEdit(account)}>
                    {t("accounts.action.edit")}
                  </button>
                  <button
                    className="ghost danger"
                    type="button"
                    onClick={() => removeAccount(account.id)}
                  >
                    {t("accounts.action.delete")}
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
