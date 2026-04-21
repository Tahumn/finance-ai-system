import { useEffect, useState } from "react";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";
import * as api from "../../api/recurring.js";

const emptySub = { name: "", amount: "", startDate: toInputDate(new Date()) };
const emptyDebt = { name: "", amount: "", dueDate: toInputDate(new Date()) };

export default function RecurringScreen({ userEmail }) {
  const [subs, setSubs] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subForm, setSubForm] = useState(emptySub);
  const [debtForm, setDebtForm] = useState(emptyDebt);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([api.listSubscriptions(), api.listDebts()]);
      setSubs(s);
      setDebts(d);
    } catch (err) {
      console.error("Failed to load recurring data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSub = async (e) => {
    e.preventDefault();
    if (!subForm.name || !subForm.amount) return;
    try {
      await api.createSubscription({
        name: subForm.name,
        amount: parseNumberInput(subForm.amount),
        start_date: subForm.startDate
      });
      setSubForm(emptySub);
      loadData();
    } catch (err) {
      alert(t("common.error"));
    }
  };

  const handleAddDebt = async (e) => {
    e.preventDefault();
    if (!debtForm.name || !debtForm.amount) return;
    try {
      await api.createDebt({
        name: debtForm.name,
        amount: parseNumberInput(debtForm.amount),
        due_date: debtForm.dueDate
      });
      setDebtForm(emptyDebt);
      loadData();
    } catch (err) {
      alert(t("common.error"));
    }
  };

  const handleDeleteSub = async (id) => {
    if (!window.confirm(t("recurring.action.delete") + "?")) return;
    try {
      await api.deleteSubscription(id);
      loadData();
    } catch (err) {
      alert(t("common.error"));
    }
  };

  const handleDeleteDebt = async (id) => {
    if (!window.confirm(t("recurring.action.delete") + "?")) return;
    try {
      await api.deleteDebt(id);
      loadData();
    } catch (err) {
      alert(t("common.error"));
    }
  };

  return (
    <div className="recurring-page">
      <header className="transactions-header" style={{ marginBottom: 20 }}>
        <div>
          <p className="eyebrow">Finance Workspace</p>
          <h2>{t("recurring.title")}</h2>
        </div>
      </header>

      <div className="grid-2">
        {/* Debts Section */}
        <section className="panel">
          <div className="panel-header">
            <h3>{t("recurring.debts.title")}</h3>
          </div>
          
          <form className="form" onSubmit={handleAddDebt}>
            <div className="row">
              <label className="field">
                <span>{t("recurring.form.name")}</span>
                <input
                  type="text"
                  value={debtForm.name}
                  onChange={(e) => setDebtForm({ ...debtForm, name: e.target.value })}
                  placeholder="Vay bạn bè..."
                  required
                />
              </label>
              <label className="field">
                <span>{t("recurring.form.amount")}</span>
                <input
                  type="text"
                  value={debtForm.amount}
                  onChange={(e) => setDebtForm({ ...debtForm, amount: formatNumberInput(e.target.value) })}
                  placeholder="0"
                  required
                />
              </label>
            </div>
            <div className="row">
              <label className="field">
                <span>{t("recurring.form.date")}</span>
                <input
                  type="date"
                  value={debtForm.dueDate}
                  onChange={(e) => setDebtForm({ ...debtForm, dueDate: e.target.value })}
                />
              </label>
              <div className="row-actions" style={{ marginTop: 'auto', paddingBottom: 8 }}>
                <button className="primary" type="submit">{t("recurring.debts.add")}</button>
              </div>
            </div>
          </form>

          <div className="list" style={{ marginTop: 20 }}>
            {debts.length === 0 ? (
              <p className="empty">{t("recurring.debts.empty")}</p>
            ) : (
              debts.map((d) => (
                <article key={d.id} className="item-row">
                  <div>
                    <strong>{d.name}</strong>
                    <p className="muted">{d.due_date || "--"}</p>
                  </div>
                  <div className="row-right">
                    <span className="amount expense">{currency(d.amount)}</span>
                    <button className="ghost danger icon-btn-small" onClick={() => handleDeleteDebt(d.id)}>
                      &times;
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* Subscriptions Section */}
        <section className="panel">
          <div className="panel-header">
            <h3>{t("recurring.subs.title")}</h3>
          </div>

          <form className="form" onSubmit={handleAddSub}>
            <div className="row">
              <label className="field">
                <span>{t("recurring.form.name")}</span>
                <input
                  type="text"
                  value={subForm.name}
                  onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                  placeholder="Netflix, Spotify..."
                  required
                />
              </label>
              <label className="field">
                <span>{t("recurring.form.amount")}</span>
                <input
                  type="text"
                  value={subForm.amount}
                  onChange={(e) => setSubForm({ ...subForm, amount: formatNumberInput(e.target.value) })}
                  placeholder="0"
                  required
                />
              </label>
            </div>
            <div className="row">
              <label className="field">
                <span>{t("recurring.form.date")}</span>
                <input
                  type="date"
                  value={subForm.startDate}
                  onChange={(e) => setSubForm({ ...subForm, startDate: e.target.value })}
                />
              </label>
              <div className="row-actions" style={{ marginTop: 'auto', paddingBottom: 8 }}>
                <button className="primary" type="submit">{t("recurring.subs.add")}</button>
              </div>
            </div>
          </form>

          <div className="list" style={{ marginTop: 20 }}>
            {subs.length === 0 ? (
              <p className="empty">{t("recurring.subs.empty")}</p>
            ) : (
              subs.map((s) => (
                <article key={s.id} className="item-row">
                  <div>
                    <strong>{s.name}</strong>
                    <p className="muted">{s.start_date || "--"}</p>
                  </div>
                  <div className="row-right">
                    <span className="amount expense">{currency(s.amount)}</span>
                    <button className="ghost danger icon-btn-small" onClick={() => handleDeleteSub(s.id)}>
                      &times;
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
