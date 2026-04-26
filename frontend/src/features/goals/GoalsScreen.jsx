import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { currency } from "../../utils/format.js";
import "./goals.css";

const defaultForm = {
  name: "",
  goal_type: "Du lịch",
  funding_source: "Ngân hàng",
  priority: "medium",
  note: "",
  image_url: "",
  target_amount: "",
  saved_amount: "",
  monthly_contribution: "",
  start_date: "",
  target_date: "",
  auto_deposit: true,
  auto_transfer: true
};

const PIE_COLORS = ["#7c3aed", "#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#64748b"];

const fmt = (value) => currency(Number(value || 0));

export default function GoalsScreen({
  goals = [],
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  loading
}) {
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const normalizedGoals = useMemo(
    () =>
      (goals || []).map((item) => ({
        ...item,
        progress: Number(item.progress || 0),
        remaining: Math.max(0, Number(item.target_amount || 0) - Number(item.saved_amount || 0))
      })),
    [goals]
  );

  const totalTarget = normalizedGoals.reduce((sum, item) => sum + Number(item.target_amount || 0), 0);
  const totalSaved = normalizedGoals.reduce((sum, item) => sum + Number(item.saved_amount || 0), 0);
  const totalMonthly = normalizedGoals.reduce((sum, item) => sum + Number(item.monthly_contribution || 0), 0);
  const activeGoals = normalizedGoals.filter((item) => (item.status || "active") === "active");
  const doneGoals = normalizedGoals.filter((item) => Number(item.progress || 0) >= 1).length;
  const savedRatio = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const monthlyContributionData = normalizedGoals.slice(0, 6).map((item) => ({
    name: item.name,
    monthly: Number(item.monthly_contribution || 0),
    target: Number(item.target_amount || 0) / 8
  }));

  const progressTrendData = normalizedGoals.slice(0, 6).map((item, index) => ({
    month: `M${index + 1}`,
    value: Number(item.saved_amount || 0) / 1_000_000
  }));

  const pieData = normalizedGoals
    .slice(0, 6)
    .map((item) => ({ name: item.name, value: Number(item.saved_amount || 0), progress: item.progress }))
    .filter((item) => item.value > 0);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      target_amount: Number(form.target_amount || 0),
      saved_amount: Number(form.saved_amount || 0),
      monthly_contribution: Number(form.monthly_contribution || 0)
    };
    if (editingId) await onUpdateGoal(editingId, payload);
    else await onCreateGoal(payload);
    resetForm();
  };

  const startEdit = (goal) => {
    setEditingId(goal.id);
    setShowForm(true);
    setForm({
      name: goal.name || "",
      goal_type: goal.goal_type || "Du lịch",
      funding_source: goal.funding_source || "Ngân hàng",
      priority: goal.priority || "medium",
      note: goal.note || "",
      image_url: goal.image_url || "",
      target_amount: String(goal.target_amount || ""),
      saved_amount: String(goal.saved_amount || ""),
      monthly_contribution: String(goal.monthly_contribution || ""),
      start_date: goal.start_date || "",
      target_date: goal.target_date || "",
      auto_deposit: Boolean(goal.auto_deposit),
      auto_transfer: Boolean(goal.auto_transfer)
    });
  };

  return (
    <section className="goal-page">
      <header className="goal-header modern">
        <div>
          <h1>Mục tiêu tiết kiệm</h1>
          <p>Theo dõi tiến độ và xây dựng các kế hoạch tài chính của bạn.</p>
        </div>
        <button
          type="button"
          className="bgd-btn-add"
          onClick={() => {
            setShowForm((s) => !s);
            if (!showForm) setEditingId(null);
          }}
        >
          + {showForm ? "Đóng form" : "Tạo mục tiêu"}
        </button>
      </header>

      <section className="goal-kpi-banner modern">
        <div className="kpi-item">
          <span>Tổng tiền đang tiết kiệm</span>
          <strong>{fmt(totalSaved)}</strong>
          <small>↑ {savedRatio.toFixed(1)}% so với mục tiêu tổng</small>
        </div>
        <div className="kpi-item">
          <span>Đang hoạt động</span>
          <strong>{activeGoals.length}</strong>
          <small>{normalizedGoals.length} mục tiêu</small>
        </div>
        <div className="kpi-item">
          <span>Đã hoàn thành</span>
          <strong>{doneGoals}</strong>
          <small>Tổng {fmt(normalizedGoals.filter((g) => g.progress >= 1).reduce((s, g) => s + Number(g.saved_amount || 0), 0))}</small>
        </div>
        <div className="kpi-item">
          <span>Đóng góp tháng này</span>
          <strong>{fmt(totalMonthly)}</strong>
          <small>↑ {(totalMonthly > 0 ? (totalMonthly / Math.max(1, totalSaved)) * 100 : 0).toFixed(1)}% trên tổng đã tiết kiệm</small>
        </div>
        <div className="kpi-jar" aria-hidden="true">🏺</div>
      </section>

      <div className={`goal-main-grid ${showForm ? "with-form" : "without-form"}`}>
        {showForm ? (
          <article className="goal-panel">
            <div className="goal-panel-head">
              <h3>{editingId ? "Chỉnh sửa mục tiêu" : "Tạo / Chỉnh sửa mục tiêu"}</h3>
            </div>
            <form className="goal-form" onSubmit={handleSubmit}>
              <label>
                Tên mục tiêu
                <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} required />
              </label>
              <label>
                Số tiền mục tiêu
                <input type="number" value={form.target_amount} onChange={(e) => setForm((s) => ({ ...s, target_amount: e.target.value }))} required />
              </label>
              <label>
                Đã tiết kiệm
                <input type="number" value={form.saved_amount} onChange={(e) => setForm((s) => ({ ...s, saved_amount: e.target.value }))} />
              </label>
              <label>
                Đóng góp hàng tháng
                <input type="number" value={form.monthly_contribution} onChange={(e) => setForm((s) => ({ ...s, monthly_contribution: e.target.value }))} />
              </label>
              <label>
                Loại mục tiêu
                <select value={form.goal_type} onChange={(e) => setForm((s) => ({ ...s, goal_type: e.target.value }))}>
                  <option>Du lịch</option>
                  <option>Quỹ khẩn cấp</option>
                  <option>Mua sắm</option>
                  <option>Giáo dục</option>
                  <option>Nhà cửa</option>
                </select>
              </label>
              <label>
                Nguồn tiền đóng góp
                <select value={form.funding_source} onChange={(e) => setForm((s) => ({ ...s, funding_source: e.target.value }))}>
                  <option>Ngân hàng</option>
                  <option>Tiền mặt</option>
                  <option>Ví điện tử</option>
                </select>
              </label>
              <label>
                Ngày bắt đầu
                <input type="date" value={form.start_date || ""} onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))} />
              </label>
              <label>
                Hạn hoàn thành
                <input type="date" value={form.target_date || ""} onChange={(e) => setForm((s) => ({ ...s, target_date: e.target.value }))} />
              </label>
              <label className="goal-form-wide">
                Ghi chú
                <textarea rows={2} value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} />
              </label>
              <div className="goal-form-switches">
                <label><input type="checkbox" checked={form.auto_deposit} onChange={(e) => setForm((s) => ({ ...s, auto_deposit: e.target.checked }))} /> Nhắc đóng góp hàng tháng</label>
                <label><input type="checkbox" checked={form.auto_transfer} onChange={(e) => setForm((s) => ({ ...s, auto_transfer: e.target.checked }))} /> Tự động tạo giao dịch tiết kiệm</label>
              </div>
              <div className="goal-form-actions">
                {editingId ? <button type="button" className="ghost" onClick={resetForm}>Hủy</button> : null}
                <button type="submit" className="bgd-btn-add" disabled={loading}>{editingId ? "Lưu mục tiêu" : "Thêm mục tiêu"}</button>
              </div>
            </form>
          </article>
        ) : null}

        {showForm ? (
          <aside className="goal-side">
            <article className="goal-panel">
              <div className="goal-panel-head">
                <h3>Tiến độ mục tiêu</h3>
              </div>
              <div className="goal-progress-list">
                {normalizedGoals.slice(0, 6).map((item) => (
                  <div key={item.id} className="goal-progress-item">
                    <span>{item.name}</span>
                    <strong>{Math.round(item.progress * 100)}%</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="goal-panel ai-panel">
              <div className="goal-panel-head">
                <h3>Gợi ý từ AI</h3>
              </div>
              <p>Bạn đang tiến gần mục tiêu lớn nhất. Tăng đóng góp thêm 10% để rút ngắn thời gian hoàn thành.</p>
            </article>
          </aside>
        ) : (
          <div className="goal-side-inline">
            <article className="goal-panel">
              <div className="goal-panel-head">
                <h3>Tiến độ mục tiêu</h3>
              </div>
              <div className="goal-progress-list">
                {normalizedGoals.slice(0, 6).map((item) => (
                  <div key={item.id} className="goal-progress-item">
                    <span>{item.name}</span>
                    <strong>{Math.round(item.progress * 100)}%</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="goal-panel ai-panel">
              <div className="goal-panel-head">
                <h3>Gợi ý từ AI</h3>
              </div>
              <p>Bạn đang tiến gần mục tiêu lớn nhất. Tăng đóng góp thêm 10% để rút ngắn thời gian hoàn thành.</p>
            </article>
          </div>
        )}
      </div>

      <article className="goal-panel">
        <div className="goal-panel-head">
          <h3>Danh sách mục tiêu</h3>
        </div>
        <div className="goal-table-wrap">
          <table className="goal-table">
            <thead>
              <tr>
                <th>Mục tiêu</th>
                <th>Mục tiêu</th>
                <th>Đã tiết kiệm</th>
                <th>Tiến độ</th>
                <th>Đóng góp/tháng</th>
                <th>Hạn hoàn thành</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {normalizedGoals.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{fmt(item.target_amount)}</td>
                  <td>{fmt(item.saved_amount)}</td>
                  <td>
                    <div className="goal-mini-progress">
                      <span style={{ width: `${Math.max(2, item.progress * 100)}%` }} />
                    </div>
                  </td>
                  <td>{fmt(item.monthly_contribution)}</td>
                  <td>{item.target_date || "—"}</td>
                  <td>{item.status || "active"}</td>
                  <td className="goal-actions-cell">
                    <button type="button" onClick={() => startEdit(item)}>Sửa</button>
                    <button type="button" className="danger" onClick={() => onDeleteGoal(item.id)}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="goal-charts-grid">
        <article className="goal-panel">
          <div className="goal-panel-head"><h3>Đóng góp theo tháng</h3></div>
          <div className="goal-chart">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthlyContributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(value) => fmt(value)} />
                <Legend />
                <Bar dataKey="monthly" name="Đã đóng góp" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="target" name="Mục tiêu" fill="#f472b6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="goal-panel">
          <div className="goal-panel-head"><h3>Lịch sử tiết kiệm</h3></div>
          <div className="goal-chart">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={progressTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" name="Tiền tiết kiệm (triệu)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="goal-panel">
          <div className="goal-panel-head"><h3>Phân bổ tiết kiệm</h3></div>
          <div className="goal-chart">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={3}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => fmt(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </section>
  );
}

