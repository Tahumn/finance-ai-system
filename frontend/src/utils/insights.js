import { currency } from "./format.js";
import { t } from "./i18n.js";

const normalizeText = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const buildAiInsights = (summary, transactions, breakdown) => {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeBreakdown = Array.isArray(breakdown) ? breakdown : [];
  const insights = [];

  // 1. Top Category Insight
  const topCategory = safeBreakdown[0];
  if (topCategory) {
    insights.push({
      id: "top_category",
      type: "info",
      icon: "📊",
      title: t("dashboard.insight.title.top_category", null, "Phân tích Danh mục"),
      text: t("dashboard.insight.top_category", {
        category: topCategory.category,
        amount: currency(topCategory.spent)
      }),
      query: `Phân tích sâu hơn về danh mục ${topCategory.category} tháng này.`
    });
  }

  // 2. Trend Analysis (Coffee/Cafe example enhanced)
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;

  const spendingByMonth = safeTransactions
    .filter((item) => item.transaction_type === "expense")
    .reduce((acc, item) => {
      const key = String(item.date || "").slice(0, 7);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + Number(item.amount || 0);
      return acc;
    }, {});

  const currentTotal = spendingByMonth[currentKey] || 0;
  const previousTotal = spendingByMonth[previousKey] || 0;

  if (previousTotal > 0) {
    const delta = ((currentTotal - previousTotal) / previousTotal) * 100;
    if (Math.abs(delta) > 5) {
      insights.push({
        id: "spending_velocity",
        type: delta > 0 ? "warning" : "success",
        icon: delta > 0 ? "📈" : "📉",
        title: t("dashboard.insight.title.velocity", null, "Tốc độ chi tiêu"),
        text: delta > 0 
          ? `Chi tiêu tháng này đang cao hơn ${Math.round(delta)}% so với tháng trước.`
          : `Tuyệt vời! Bạn đang chi tiêu ít hơn ${Math.round(Math.abs(delta))}% so với tháng trước.`,
        query: "So sánh chi tiết chi tiêu tháng này và tháng trước."
      });
    }
  }

  // 3. Savings Potential
  const totalIncome = Number(summary?.total_income || 0);
  const totalExpense = Number(summary?.total_expense || 0);
  if (totalIncome > totalExpense) {
    const savings = totalIncome - totalExpense;
    const rate = (savings / totalIncome) * 100;
    insights.push({
      id: "savings_potential",
      type: "success",
      icon: "💰",
      title: t("dashboard.insight.title.savings", null, "Tiềm năng tích lũy"),
      text: `Bạn đã tiết kiệm được ${currency(savings)} (${Math.round(rate)}% thu nhập) trong kỳ này.`,
      query: "Gợi ý cách tối ưu hóa khoản tiết kiệm này."
    });
  } else if (totalExpense > totalIncome && totalIncome > 0) {
    insights.push({
      id: "budget_alert",
      type: "danger",
      icon: "⚠️",
      title: t("dashboard.insight.title.budget", null, "Cảnh báo ngân sách"),
      text: t("dashboard.insight.over_spend", null, "Chi tiêu đang vượt quá thu nhập. Cần thắt chặt chi tiêu!"),
      query: "Tìm các khoản chi có thể cắt giảm ngay lập tức."
    });
  }

  // Fallback
  if (!insights.length) {
    insights.push({
      id: "stable",
      type: "info",
      icon: "✨",
      title: t("dashboard.insight.title.stable", null, "Trạng thái ổn định"),
      text: t("dashboard.insight.stable", null, "Tài chính của bạn đang ở trạng thái cân bằng. Hãy tiếp tục duy trì!"),
      query: "Lập kế hoạch tài chính cho tháng tới."
    });
  }

  return insights.slice(0, 3);
};
