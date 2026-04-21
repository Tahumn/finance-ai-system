import { useEffect, useMemo, useState } from "react";
import { colorFor, onColor } from "../../utils/colors.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";
import * as api from "../../api/planning.js";

const emptyForm = () => ({
  name: "",
  categoryIds: [],
  amount: "",
  cycle: "monthly",
  startDate: toInputDate(new Date()),
  endDate: "",
  threshold: "80"
});

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
  const catIds = (plan.category_ids || "").split(",").filter(Boolean);
  return transactions
    .filter((item) => item.transaction_type === "expense")
    .filter((item) =>
      !catIds.length ? true : catIds.includes(String(item.category_id))
    )
    .filter((item) => (plan.start_date ? item.date >= plan.start_date : true))
    .filter((item) => (plan.end_date ? item.date <= plan.end_date : true))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
};

export default function BudgetsScreen({ categories, transactions, userEmail }) {
  const [form, setForm] = useState(emptyForm);
  const [plans, setPlans] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const categoryPrefs = useMemo(() => getCategoryPrefs(userEmail), [userEmail]);
  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((category) => {
      map[String(category.id)] = category.name;
    });
    return map;
  }, [categories]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await api.listBudgets();
      setPlans(data);
    } catch (err) {
      console.error("Failed to load budgets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const plansWithStats = useMemo(() => {
    return plans.map((plan) => {
      const spent = computeSpent(plan, transactions);
      const budget = Number(plan.amount) || 0;
      const progress = budget > 0 ? spent / budget : 0;
      const periodDays = estimatePeriodDays({
        startDate: plan.start_date,
        endDate: plan.end_date,
        cycle: plan.cycle
      });
      const elapsedDays = plan.start_date
        ? Math.max(1, Math.min(periodDays, daysBetween(plan.start_date, toInputDate(new Date()))))
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = parseNumberInput(form.amount);
    const threshold = Number(form.threshold);
    if (!form.name.trim()) return;
    if (!(amount > 0)) return;
    
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        category_ids: form.categoryIds.join(","),
        amount,
        cycle: form.cycle,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        threshold
      };

      if (editingId) {
        await api.updateBudget(editingId, payload);
      } else {
        await api.createBudget(payload);
      }
      
      setForm(emptyForm());
      setEditingId(null);
      await loadPlans();
    } catch (err) {
      alert(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (planId, status) => {
    try {
      await api.updateBudget(planId, { status });
      await loadPlans();
    } catch (err) {
      alert(t("common.error"));
    }
  };

  const removePlan = async (planId) => {
    if (!window.confirm(t("budgets.action.delete") + "?")) return;
    try {
      await api.deleteBudget(planId);
      await loadPlans();
    } catch (err) {
      alert(t("common.error"));
    }
  };

  const startEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name || "",
      categoryIds: (plan.category_ids || "").split(",").filter(Boolean),
      amount: formatNumberInput(plan.amount),
      cycle: plan.cycle || "monthly",
      startDate: plan.start_date || "",
      endDate: plan.end_date || "",
      threshold: String(plan.threshold || 80)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
                ? `${form.categoryIds.length} danh mục đã chọn`
                : "Chọn 1 hoặc nhiều danh mục"}
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
            <span>{t("budgets.form.threshold")} (%)</span>
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
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "..." : (editingId ? t("budgets.action.save_changes") : t("budgets.action.create"))}
          </button>
        </div>
      </form>

      <div className="list" style={{ marginTop: 30 }}>
        {!plansWithStats.length ? (
          <p className="empty">{loading ? "Đang tải..." : "Chưa có kế hoạch ngân sách. Tạo mới để theo dõi tiến độ."}</p>
        ) : (
          plansWithStats.map((plan) => {
            const planCategories = (plan.category_ids || "")
              .split(",")
              .map((id) => categoryMap[id])
              .filter(Boolean);
            return (
              <article key={plan.id} className="item-row budget-card" style={{ padding: '20px', marginBottom: '15px' }}>
                <div className="panel-header" style={{ marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', margin: '0 0 5px 0' }}>{plan.name || "Kế hoạch không tên"}</h4>
                    <p className="budget-meta" style={{ opacity: 0.8 }}>
                      {currency(plan.spent)} / {currency(plan.budget)} -{" "}
                      {t(`budgets.cycle.${plan.cycle === "one-time" ? "one_time" : plan.cycle}`)}
                    </p>
                    <div className="budget-tags" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {planCategories.length ? (
                        planCategories.map((label) => (
                          <span key={label} className="budget-tag" style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                            <span className="dot" style={{ background: colorFor(label, userEmail), display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '5px' }} />
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="budget-tag muted">Tất cả danh mục</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                     <span className={`badge ${plan.status === "paused" ? "muted" : "success"}`} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                        {t(`budgets.status.${plan.status || 'active'}`)}
                      </span>
                  </div>
                </div>

                <div className="progress" style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                  <div
                    style={{ 
                      width: `${Math.min(100, Math.max(2, plan.progress * 100))}%`,
                      height: '100%',
                      background: plan.progress >= 1 ? '#ff4d4d' : (plan.progress >= (plan.threshold/100) ? '#ffcc00' : '#00cc66'),
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>

                <div className="budget-insights" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '20px' }}>
                  <p>
                    {t("budgets.forecast")}: <strong>{currency(plan.forecast)}</strong>
                  </p>
                  <p style={{ color: plan.willOverrun ? '#ff4d4d' : '#00cc66', fontWeight: 'bold' }}>
                    {plan.willOverrun
                      ? "⚠️ Dự báo sẽ vượt định mức"
                      : "✅ Đang trong tầm kiểm soát"}
                  </p>
                </div>

                <div className="row-actions" style={{ display: 'flex', gap: '10px' }}>
                  <button className="ghost" type="button" onClick={() => startEdit(plan)}>
                    Sửa
                  </button>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() =>
                      updateStatus(plan.id, plan.status === "paused" ? "active" : "paused")
                    }
                  >
                    {plan.status === "paused" ? "Tiếp tục" : "Tạm dừng"}
                  </button>
                  <button className="ghost danger" type="button" onClick={() => removePlan(plan.id)}>
                    Xóa
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
