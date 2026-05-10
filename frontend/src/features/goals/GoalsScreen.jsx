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
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart
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

const PIE_COLORS = ["#8b5cf6", "#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#64748b"];

const fmt = (value) => currency(Number(value || 0));

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="goal-custom-tooltip">
        <p className="goal-tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="goal-tooltip-item">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="goal-tooltip-value">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function GoalsScreen({
  goals = [],
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  loading,
  aiSuggestions = []
}) {
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [contributeAmount, setContributeAmount] = useState("");

  const normalizedGoals = useMemo(
    () =>
      (goals || []).map((item) => ({
        ...item,
        progress: Number(item.progress || 0),
        remaining: Math.max(0, Number(item.target_amount || 0) - Number(item.saved_amount || 0))
      })),
    [goals]
  );

  const selectedGoal = useMemo(
    () => normalizedGoals.find(g => g.id === selectedGoalId),
    [normalizedGoals, selectedGoalId]
  );

  // Mock savings history for selected goal
  const savingsHistory = useMemo(() => {
    if (!selectedGoalId) return [];
    return [
      { id: 101, date: "2024-03-01", amount: 500000, description: "Tiết kiệm tháng 3", source: "Ngân hàng" },
      { id: 102, date: "2024-02-15", amount: 200000, description: "Tiền thưởng dự án", source: "Tiền mặt" },
      { id: 103, date: "2024-02-01", amount: 500000, description: "Tiết kiệm tháng 2", source: "Ngân hàng" },
    ];
  }, [selectedGoalId]);

  const totalTarget = normalizedGoals.reduce((sum, item) => sum + Number(item.target_amount || 0), 0);
  const totalSaved = normalizedGoals.reduce((sum, item) => sum + Number(item.saved_amount || 0), 0);
  const totalMonthly = normalizedGoals.reduce((sum, item) => sum + Number(item.monthly_contribution || 0), 0);
  const activeGoalsCount = normalizedGoals.filter((item) => (item.status || "active") === "active").length;
  const doneGoals = normalizedGoals.filter((item) => Number(item.progress || 0) >= 1).length;
  const savedRatio = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const monthlyContributionData = normalizedGoals.slice(0, 6).map((item) => ({
    name: item.name,
    monthly: Number(item.monthly_contribution || 0),
    target: Number(item.target_amount || 0) / 12
  }));

  const progressTrendData = normalizedGoals.slice(0, 6).map((item, index) => ({
    month: `Kỳ ${index + 1}`,
    value: Number(item.saved_amount || 0)
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

  const handleQuickContribute = async (e) => {
    e.preventDefault();
    if (!selectedGoal || !contributeAmount) return;
    const amount = Number(contributeAmount);
    const payload = {
      ...selectedGoal,
      saved_amount: Number(selectedGoal.saved_amount) + amount
    };
    await onUpdateGoal(selectedGoal.id, payload);
    setContributeAmount("");
  };

  const startEdit = (e, goal) => {
    e.stopPropagation();
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

  const handleDelete = (e, id) => {
    e.stopPropagation();
    onDeleteGoal(id);
    if (selectedGoalId === id) setSelectedGoalId(null);
  };

  return (
    <section className="goal-page">
      <header className="goal-header modern">
        <div>
          <h1>Mục tiêu tiết kiệm</h1>
        </div>
        <button
          type="button"
          className="bgd-btn-add"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setSelectedGoalId(null);
          }}
        >
          + Tạo mục tiêu mới
        </button>
      </header>

      <section className="goal-kpi-banner modern">
        <div className="kpi-item">
          <span>Tổng đã tích lũy</span>
          <strong>{fmt(totalSaved)}</strong>
          <small>↑ {savedRatio.toFixed(1)}% mục tiêu tổng</small>
        </div>
        <div className="kpi-item">
          <span>Mục tiêu đang chạy</span>
          <strong>{activeGoalsCount}</strong>
          <small>{normalizedGoals.length} mục tiêu hiện có</small>
        </div>
        <div className="kpi-item">
          <span>Đã hoàn tất</span>
          <strong>{doneGoals}</strong>
          <small>Tài chính vững vàng</small>
        </div>
        <div className="kpi-item">
          <span>Kế hoạch tháng này</span>
          <strong>{fmt(totalMonthly)}</strong>
          <small>Đóng góp dự kiến</small>
        </div>
        <div className="kpi-jar" aria-hidden="true">💰</div>
      </section>

      <div className="goal-content-layout full-width">
        <div className="goal-main-content">
          <article className="goal-panel list-panel">
            <div className="goal-panel-head">
              <h3>Danh sách mục tiêu chi tiết</h3>
            </div>
            <div className="goal-table-wrap">
              <table className="goal-table modern">
                <thead>
                  <tr>
                    <th>Mục tiêu</th>
                    <th>Số tiền đích</th>
                    <th>Đã tích lũy</th>
                    <th>Tiến độ</th>
                    <th>Hàng tháng</th>
                    <th>Hạn định</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedGoals.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedGoalId(item.id)} className={selectedGoalId === item.id ? "selected-row" : ""}>
                      <td className="goal-name-cell">
                        <div className="goal-icon-mini">{item.goal_type?.charAt(0) || "G"}</div>
                        <div>
                          <p>{item.name}</p>
                          <span>{item.goal_type}</span>
                        </div>
                      </td>
                      <td>{fmt(item.target_amount)}</td>
                      <td className="saved-amount">{fmt(item.saved_amount)}</td>
                      <td>
                        <div className="goal-mini-progress">
                          <span style={{ width: `${Math.max(2, item.progress * 100)}%` }} />
                        </div>
                        <small className="progress-text">{Math.round(item.progress * 100)}%</small>
                      </td>
                      <td>{fmt(item.monthly_contribution)}</td>
                      <td>{item.target_date || "—"}</td>
                      <td className="goal-actions-cell">
                        <button type="button" className="btn-edit" onClick={(e) => startEdit(e, item)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" className="btn-delete" onClick={(e) => handleDelete(e, item.id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>

      <div className="goal-charts-grid-4">
        <article className="goal-panel ai-panel">
          <div className="goal-panel-head">
            <h3>✨ Chiến lược từ AI</h3>
          </div>
          <div className="ai-tips-list">
            {aiSuggestions.length ? aiSuggestions.slice(0, 3).map((tip, idx) => (
              <div key={idx} className="ai-tip-card">
                <p>{tip.suggestion || tip.message || tip}</p>
              </div>
            )) : (
              <div className="ai-tip-card">
                <p>Dựa trên thu nhập tháng này, bạn có thể trích thêm <strong>1,200,000 đ</strong> để hoàn thành sớm mục tiêu du lịch.</p>
              </div>
            )}
          </div>
        </article>

        <article className="goal-panel">
          <div className="goal-panel-head"><h3>Phân bổ tài sản</h3></div>
          <div className="goal-chart-mini">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={4} animationDuration={1000}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <ReTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="goal-panel">
          <div className="goal-panel-head"><h3>Phân bổ đóng góp</h3></div>
          <div className="goal-chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyContributionData}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary, #8b5cf6)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--primary, #8b5cf6)" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <ReTooltip content={<CustomTooltip />} />
                <Bar dataKey="monthly" name="Thực tế" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="Kế hoạch" fill="#f472b6" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="goal-panel">
          <div className="goal-panel-head"><h3>Tiến trình tích lũy</h3></div>
          <div className="goal-chart">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={progressTrendData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary, #8b5cf6)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary, #8b5cf6)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={fmt} />
                <ReTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="Tiền tích lũy" stroke="var(--primary, #8b5cf6)" strokeWidth={3} fill="url(#areaGrad)" dot={{r: 4, fill: 'var(--primary, #8b5cf6)', strokeWidth: 2, stroke: '#fff'}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      {/* MODAL OVERLAYS */}
      {(showForm || selectedGoalId) && (
        <div className="goal-modal-overlay" onClick={() => { setShowForm(false); setSelectedGoalId(null); }}>
          <div className="goal-modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowForm(false); setSelectedGoalId(null); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            {showForm && (
              <div className="modal-content">
                <div className="modal-head">
                  <h3>{editingId ? "Chỉnh sửa mục tiêu" : "Thiết lập mục tiêu mới"}</h3>
                  <p>Điền các thông số để AI giúp bạn tối ưu kế hoạch đóng góp.</p>
                </div>
                <form className="goal-form" onSubmit={handleSubmit}>
                  <label className="goal-form-wide">
                    Tên mục tiêu
                    <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} required placeholder="Ví dụ: Tiết kiệm mua Macbook" />
                  </label>
                  <label>
                    Loại mục tiêu
                    <select value={form.goal_type} onChange={(e) => setForm((s) => ({ ...s, goal_type: e.target.value }))}>
                      <option>Du lịch</option><option>Quỹ khẩn cấp</option><option>Mua sắm</option><option>Giáo dục</option><option>Nhà cửa</option>
                    </select>
                  </label>
                  <label>
                    Mức độ ưu tiên
                    <select value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}>
                      <option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option>
                    </select>
                  </label>
                  <label>
                    Số tiền cần đạt
                    <input type="number" value={form.target_amount} onChange={(e) => setForm((s) => ({ ...s, target_amount: e.target.value }))} required placeholder="0" />
                  </label>
                  <label>
                    Số tiền hiện có
                    <input type="number" value={form.saved_amount} onChange={(e) => setForm((s) => ({ ...s, saved_amount: e.target.value }))} placeholder="0" />
                  </label>
                  <label>
                    Đóng góp dự kiến / tháng
                    <input type="number" value={form.monthly_contribution} onChange={(e) => setForm((s) => ({ ...s, monthly_contribution: e.target.value }))} placeholder="0" />
                  </label>
                  <label>
                    Nguồn trích tiền
                    <select value={form.funding_source} onChange={(e) => setForm((s) => ({ ...s, funding_source: e.target.value }))}>
                      <option>Ngân hàng</option><option>Tiền mặt</option><option>Ví điện tử</option>
                    </select>
                  </label>
                  <label>
                    Ngày bắt đầu
                    <input type="date" value={form.start_date || ""} onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))} />
                  </label>
                  <label>
                    Hạn định hoàn thành
                    <input type="date" value={form.target_date || ""} onChange={(e) => setForm((s) => ({ ...s, target_date: e.target.value }))} />
                  </label>
                  <label className="goal-form-wide">
                    Ghi chú bổ sung
                    <textarea rows={3} value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} placeholder="Mô tả ngắn gọn kế hoạch của bạn..." />
                  </label>
                  <div className="goal-form-actions modal-footer">
                    <button type="button" className="ghost" onClick={() => setShowForm(false)}>Hủy bỏ</button>
                    <button type="submit" className="bgd-btn-add" disabled={loading}>{editingId ? "Cập nhật" : "Tạo mục tiêu"}</button>
                  </div>
                </form>
              </div>
            )}

            {selectedGoal && !showForm && (
              <div className="modal-content">
                <div className="modal-head">
                  <div className="head-with-badge">
                    <h3>{selectedGoal.name}</h3>
                    <span className={`status-badge ${selectedGoal.status}`}>{selectedGoal.status === 'active' ? 'Đang tích lũy' : 'Đã hoàn thành'}</span>
                  </div>
                  <p>Tiến trình thực hiện kế hoạch {selectedGoal.goal_type.toLowerCase()}.</p>
                </div>
                
                <div className="goal-detail-summary">
                  <div className="summary-item">
                    <div className="large-progress">
                      <div className="bar" style={{ width: `${Math.max(3, selectedGoal.progress * 100)}%` }} />
                      <strong>{Math.round(selectedGoal.progress * 100)}%</strong>
                    </div>
                  </div>
                  
                  <div className="summary-grid">
                    <div className="s-card">
                      <label>Số tiền mục tiêu</label>
                      <p>{fmt(selectedGoal.target_amount)}</p>
                    </div>
                    <div className="s-card highlight">
                      <label>Đã tích lũy</label>
                      <p>{fmt(selectedGoal.saved_amount)}</p>
                    </div>
                    <div className="s-card danger">
                      <label>Còn thiếu</label>
                      <p>{fmt(selectedGoal.remaining)}</p>
                    </div>
                  </div>
                </div>

                <div className="quick-contribute-section">
                  <h4>Đóng góp nhanh cho mục tiêu</h4>
                  <form className="quick-form-modern" onSubmit={handleQuickContribute}>
                    <div className="input-with-symbol">
                      <input type="number" placeholder="0" value={contributeAmount} onChange={(e) => setContributeAmount(e.target.value)} />
                      <span>đ</span>
                    </div>
                    <button type="submit" disabled={!contributeAmount || loading}>Đóng góp</button>
                  </form>
                </div>

                <div className="savings-history-modern">
                  <h4>Nhật ký tích lũy</h4>
                  <div className="history-list-modern">
                    {savingsHistory.length ? savingsHistory.map(h => (
                      <div key={h.id} className="history-item-modern">
                        <div className="h-dot"></div>
                        <div className="h-main">
                          <p>{h.description}</p>
                          <span>{h.date} • {h.source}</span>
                        </div>
                        <div className="h-val">+{fmt(h.amount)}</div>
                      </div>
                    )) : (
                      <p className="no-history">Chưa có giao dịch tích lũy nào.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
