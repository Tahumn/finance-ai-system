import { useEffect, useMemo, useState } from "react";
import { currency, toInputDate } from "../../utils/format.js";

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
    const amount = Number(form.amount);
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
      amount: String(plan.amount),
      cycle: plan.cycle,
      startDate: plan.startDate,
      endDate: plan.endDate,
      threshold: String(plan.threshold)
    });
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Kế hoạch / Ngân sách</h3>
        <span className="badge">UI local + dự báo AI-lite</span>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="row">
          <label className="field">
            <span>Tên kế hoạch *</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ví dụ: Kiểm soát ăn uống"
              required
            />
          </label>

          <label className="field">
            <span>Ngân sách *</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="0"
              required
            />
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>Danh mục liên quan *</span>
            <select
              multiple
              value={form.categoryIds}
              onChange={(event) => {
                const next = Array.from(event.target.selectedOptions).map((option) => option.value);
                setForm((current) => ({ ...current, categoryIds: next }));
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Chu kỳ *</span>
            <select
              value={form.cycle}
              onChange={(event) => setForm((current) => ({ ...current, cycle: event.target.value }))}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </label>
        </div>

        <div className="row">
          <label className="field">
            <span>Ngày bắt đầu</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Ngày kết thúc</span>
            <input
              type="date"
              value={form.endDate}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Cảnh báo (%)</span>
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
              Hủy sửa
            </button>
          )}
          <button className="primary" type="submit">
            {editingId ? "Lưu thay đổi" : "Tạo kế hoạch"}
          </button>
        </div>
      </form>

      <div className="list">
        {!plansWithStats.length ? (
          <p className="empty">Chưa có kế hoạch ngân sách. Tạo mới để theo dõi tiến độ.</p>
        ) : (
          plansWithStats.map((plan) => (
            <article key={plan.id} className="item-row budget-card">
              <div className="panel-header">
                <div>
                  <h4>{plan.name}</h4>
                  <p className="budget-meta">
                    {currency(plan.spent)} / {currency(plan.budget)} - {plan.cycle}
                  </p>
                </div>
                <span className={`badge ${plan.status === "paused" ? "muted" : ""}`}>
                  {plan.status}
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
                  Dự báo cuối kỳ: <strong>{currency(plan.forecast)}</strong>
                </p>
                <p>
                  {plan.willOverrun
                    ? "AI cảnh báo: có khả năng vượt ngân sách nếu giữ tốc độ chi hiện tại."
                    : "AI dự báo: đang trong ngưỡng kiểm soát."}
                </p>
              </div>

              <div className="row-actions">
                <button className="ghost" type="button" onClick={() => startEdit(plan)}>
                  Chỉnh sửa
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
                <button
                  className="ghost"
                  type="button"
                  onClick={() => updateStatus(plan.id, "completed")}
                >
                  Hoàn thành
                </button>
                <button className="ghost danger" type="button" onClick={() => removePlan(plan.id)}>
                  Xóa
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
