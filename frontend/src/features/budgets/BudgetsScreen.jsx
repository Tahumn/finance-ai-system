import { useEffect, useMemo, useState } from "react";
import { colorFor, onColor } from "../../utils/colors.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";

const emptyForm = () => ({
  name: "",
  categoryIds: [],
  amount: "",
  cycle: "monthly",
  startDate: toInputDate(new Date()),
  endDate: "",
  threshold: "80"
});

const storageKey = (email) => `finance_local_budgets:${email || "guest"}`;

const daysBetween = (from, to) => {
  const start = new Date(from);
  const end = new Date(to);
  const diff = Math.ceil((end - start) / 86400000);
  return diff + 1;
};

const estimatePeriodDays = (plan) => {
  if (plan.startDate && plan.endDate) {
    return Math.max(1, daysBetween(plan.startDate, plan.endDate));
  }
  if (plan.cycle === "weekly") return 7;
  if (plan.cycle === "yearly") return 365;
  return 30;
};

const computeSpent = (plan, transactions) => {
  return transactions
    .filter((item) => item.transaction_type === "expense")
    .filter((item) =>
      !plan.categoryIds.length ? true : plan.categoryIds.includes(String(item.category_id))
    )
    .filter((item) => (plan.startDate ? item.date >= plan.startDate : true))
    .filter((item) => (plan.endDate ? item.date <= plan.endDate : true))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
};

export default function BudgetsScreen({ categories, transactions, userEmail }) {
  const [form, setForm] = useState(emptyForm);
  const [plans, setPlans] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const categoryPrefs = useMemo(() => getCategoryPrefs(userEmail), [userEmail]);
  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((category) => {
      map[String(category.id)] = category.name;
    });
    return map;
  }, [categories]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(userEmail));
    if (!raw) {
      setPlans([]);
      return;
    }
    try {
      setPlans(JSON.parse(raw));
    } catch {
      setPlans([]);
    }
  }, [userEmail]);

  useEffect(() => {
    localStorage.setItem(storageKey(userEmail), JSON.stringify(plans));
  }, [plans, userEmail]);

  const plansWithStats = useMemo(() => {
    return plans.map((plan) => {
      const spent = computeSpent(plan, transactions);
      const budget = Number(plan.amount) || 0;
      const progress = budget > 0 ? spent / budget : 0;
      const periodDays = estimatePeriodDays(plan);
      const elapsedDays = plan.startDate
        ? Math.max(1, Math.min(periodDays, daysBetween(plan.startDate, toInputDate(new Date()))))
        : Math.ceil(periodDays / 2);
      const forecast = elapsedDays > 0 ? (spent / elapsedDays) * periodDays : spent;
      return {
        ...plan,
        spent,
        budget,
        progress,
        forecast,
        willOverrun: budget > 0 && forecast > budget
      };
    });
  }, [plans, transactions]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const amount = parseNumberInput(form.amount);
    const threshold = Number(form.threshold);
    if (!form.name.trim()) return;
    if (!(amount > 0)) return;
    if (!(threshold > 0 && threshold <= 100)) return;

    const payload = {
      id: editingId || `plan-${Date.now()}`,
      name: form.name.trim(),
      categoryIds: form.categoryIds,
      amount,
      cycle: form.cycle,
      startDate: form.startDate || "",
      endDate: form.endDate || "",
      threshold,
      status: "active"
    };

    setPlans((current) => {
      if (!editingId) return [payload, ...current];
      return current.map((plan) => (plan.id === editingId ? { ...plan, ...payload } : plan));
    });

    setForm(emptyForm());
    setEditingId(null);
  };

  const updateStatus = (planId, status) => {
    setPlans((current) =>
      current.map((plan) => (plan.id === planId ? { ...plan, status } : plan))
    );
  };

  const removePlan = (planId) => {
    setPlans((current) => current.filter((plan) => plan.id !== planId));
    if (editingId === planId) {
      setEditingId(null);
      setForm(emptyForm());
    }
  };

  const startEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      categoryIds: plan.categoryIds,
      amount: formatNumberInput(plan.amount),
      cycle: plan.cycle,
      startDate: plan.startDate,
      endDate: plan.endDate,
      threshold: String(plan.threshold)
    });
  };

  const toggleCategory = (categoryId) => {
    setForm((current) => {
      const exists = current.categoryIds.includes(categoryId);
      const next = exists
        ? current.categoryIds.filter((item) => item !== categoryId)
        : [...current.categoryIds, categoryId];
      return { ...current, categoryIds: next };
    });
  };

  return (
    <section className="panel budgets-page">
      <header className="transactions-header" style={{ marginBottom: 14 }}>
        <div>
          <p className="eyebrow">Finance Workspace</p>
          <h2>{t("budgets.title")}</h2>
        </div>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label className="field">
            <span>{t("budgets.form.name")}</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("budgets.form.name_placeholder")}
              required
            />
          </label>

          <label className="field">
            <span>{t("budgets.form.amount")}</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: formatNumberInput(event.target.value) }))
              }
              placeholder="0"
              required
            />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>{t("budgets.form.categories")}</span>
            <div className="category-picker">
              {!categories.length ? (
                <p className="empty">{t("budgets.empty_categories", null, "Chưa có danh mục nào")}</p>
              ) : (
                categories.map((category) => {
                  const id = String(category.id);
                  const active = form.categoryIds.includes(id);
                  const bg = colorFor(category.name, userEmail);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`category-pill color-pill ${active ? "active" : ""}`}
                      onClick={() => toggleCategory(id)}
                      aria-pressed={active}
                      style={{ "--pill-bg": bg, "--pill-fg": onColor(bg) }}
                    >
                      <span className="pill-icon" aria-hidden="true">
                        {categoryPrefs[category.name]?.icon || "🏷️"}
                      </span>
                      <span className="pill-text">{category.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <small className="hint">
              {form.categoryIds.length
                ? t("budgets.form.categories_selected", { count: form.categoryIds.length }, `${form.categoryIds.length} danh mục đã chọn`)
                : t("budgets.form.categories_hint", null, "Chọn 1 hoặc nhiều danh mục")}
            </small>
          </label>

          <label className="field">
            <span>{t("budgets.form.cycle")}</span>
            <select
              value={form.cycle}
              onChange={(event) => setForm((current) => ({ ...current, cycle: event.target.value }))}
            >
              <option value="weekly">{t("budgets.cycle.weekly")}</option>
              <option value="monthly">{t("budgets.cycle.monthly")}</option>
              <option value="yearly">{t("budgets.cycle.yearly")}</option>
              <option value="one-time">{t("budgets.cycle.one_time")}</option>
            </select>
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>{t("budgets.form.start")}</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>{t("budgets.form.end")}</span>
            <input
              type="date"
              value={form.endDate}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>{t("budgets.form.threshold")}</span>
            <input
              type="number"
              min="1"
              max="100"
              value={form.threshold}
              onChange={(event) =>
                setForm((current) => ({ ...current, threshold: event.target.value }))
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
                setForm(emptyForm());
              }}
            >
              {t("budgets.action.cancel_edit")}
            </button>
          )}
          <button className="primary" type="submit">
            {editingId ? t("budgets.action.save_changes") : t("budgets.action.create")}
          </button>
        </div>
      </form>

      <div className="list">
        {!plansWithStats.length ? (
          <p className="empty">{t("budgets.empty")}</p>
        ) : (
          plansWithStats.map((plan) => {
            const planCategories = plan.categoryIds
              .map((id) => categoryMap[id])
              .filter(Boolean);
            return (
              <article key={plan.id} className="item-row budget-card">
                <div className="panel-header">
                  <div>
                    <h4>{plan.name}</h4>
                    <p className="budget-meta">
                      {currency(plan.spent)} / {currency(plan.budget)} -{" "}
                      {t(`budgets.cycle.${plan.cycle === "one-time" ? "one_time" : plan.cycle}`)}
                    </p>
                    <div className="budget-tags">
                      {planCategories.length ? (
                        planCategories.map((label) => (
                          <span key={label} className="budget-tag">
                            <span className="dot" style={{ background: colorFor(label, userEmail) }} />
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="budget-tag muted">
                          {t("budgets.tag.all", null, "Tất cả danh mục")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`badge ${plan.status === "paused" ? "muted" : ""}`}>
                    {t(`budgets.status.${plan.status}`)}
                  </span>
                </div>

              <div className="progress">
                <span
                  style={{ width: `${Math.min(100, Math.max(2, plan.progress * 100))}%` }}
                  className={plan.progress >= 1 ? "danger" : ""}
                />
              </div>

              <div className="budget-insights">
                <p>
                  {t("budgets.forecast")}: <strong>{currency(plan.forecast)}</strong>
                </p>
                <p>
                  {plan.willOverrun
                    ? t("budgets.ai_overrun")
                    : t("budgets.ai_ok")}
                </p>
              </div>

              <div className="row-actions">
                <button className="ghost" type="button" onClick={() => startEdit(plan)}>
                  {t("budgets.action.edit")}
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() =>
                    updateStatus(plan.id, plan.status === "paused" ? "active" : "paused")
                  }
                >
                  {plan.status === "paused" ? t("budgets.action.resume") : t("budgets.action.pause")}
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => updateStatus(plan.id, "completed")}
                >
                  {t("budgets.action.complete")}
                </button>
                <button className="ghost danger" type="button" onClick={() => removePlan(plan.id)}>
                  {t("budgets.action.delete")}
                </button>
              </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
