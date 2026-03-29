import { useEffect, useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "./api/client.js";
import {
  login,
  me,
  registerWithProfile,
  resetPasswordConfirm,
  resetPasswordStart,
  resetPasswordVerify,
  resendOtp,
  setPassword,
  verifyOtp
} from "./api/auth.js";
import {
  createCategory,
  createTransaction,
  deleteTransaction,
  getCategoryBreakdown,
  getSummary,
  listCategories,
  listTransactions,
  updateTransaction,
  getChartData
} from "./api/finance.js";
import { createTransactionFromText, parseTransaction, getAnomalies } from "./api/ai.js";
import BottomNav from "./components/BottomNav.jsx";
import SideMenu from "./components/SideMenu.jsx";
import DateRangeFilters from "./components/DateRangeFilters.jsx";
import StatusBanner from "./components/StatusBanner.jsx";
import AuthScreen from "./features/auth/AuthScreen.jsx";
import DashboardScreen from "./features/dashboard/DashboardScreen.jsx";
import CategoriesScreen from "./features/categories/CategoriesScreen.jsx";
import ReportsScreen from "./features/reports/ReportsScreen.jsx";
import TransactionsScreen from "./features/transactions/TransactionsScreen.jsx";
import OcrScreen from "./features/ocr/OcrScreen.jsx";
import BudgetsScreen from "./features/budgets/BudgetsScreen.jsx";
import TagsScreen from "./features/tags/TagsScreen.jsx";
import AccountsScreen from "./features/accounts/AccountsScreen.jsx";
import SettingsScreen from "./features/settings/SettingsScreen.jsx";
import { currency, toInputDate } from "./utils/format.js";
import { applyUiPrefs, getUiPrefs } from "./utils/uiPrefs.js";
import FloatingChatbot from "./components/FloatingChatbot.jsx";

// monthlySeries is now fetched from the backend

const getRangeFromPreset = (preset) => {
  const now = new Date();
  if (preset === "today") {
    const today = toInputDate(now);
    return { start: today, end: today };
  }
  if (preset === "week") {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    return { start: toInputDate(weekStart), end: toInputDate(now) };
  }
  if (preset === "year") {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return { start: toInputDate(yearStart), end: toInputDate(now) };
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toInputDate(monthStart), end: toInputDate(now) };
};

const defaultFilters = () => ({
  ...getRangeFromPreset("month"),
  type: "",
  categoryId: ""
});

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authState, setAuthState] = useState({ status: "checking", user: null });
  const [uiPrefs, setUiPrefs] = useState(() => getUiPrefs());
  const [view, setView] = useState("dashboard");
  const [rangePreset, setRangePreset] = useState("month");
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState({ items: [], total: 0, page: 1 });
  const [summary, setSummary] = useState({
    total_balance: 0,
    period_total_income: 0,
    period_total_expense: 0,
    period_net_flow: 0,
    total_income: 0,
    total_expense: 0,
    balance: 0
  });
  const [breakdown, setBreakdown] = useState([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState([]);
  const [monthlySeries, setMonthlySeries] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [filters, setFilters] = useState(defaultFilters());
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const prefs = getUiPrefs(authState.user?.email);
    setUiPrefs(prefs);
    applyUiPrefs(prefs);
  }, [authState.user?.email]);

  useEffect(() => {
    const handlePrefs = (event) => {
      if (!event?.detail) return;
      const currentEmail = authState.user?.email || "guest";
      if ((event.detail.email || "guest") !== currentEmail) return;
      const nextPrefs = event.detail.prefs || getUiPrefs(currentEmail);
      setUiPrefs(nextPrefs);
      applyUiPrefs(nextPrefs);
    };
    window.addEventListener("finance:ui-prefs", handlePrefs);
    window.addEventListener("finance:logout", handleLogout);
    return () => {
      window.removeEventListener("finance:ui-prefs", handlePrefs);
      window.removeEventListener("finance:logout", handleLogout);
    };
  }, [authState.user?.email]);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((item) => {
      map[item.id] = item.name;
    });
    return map;
  }, [categories]);

  const transactionsWithLabels = useMemo(
    () =>
      (transactions.items || []).map((item) => ({
        ...item,
        categoryLabel: item.category_id ? categoryMap[item.category_id] || "Khác" : "Khác"
      })),
    [transactions.items, categoryMap]
  );

  const breakdownWithShare = useMemo(() => {
    const total = breakdown.reduce((sum, item) => sum + item.spent, 0) || 1;
    return breakdown.map((item) => ({
      ...item,
      share: item.spent / total
    }));
  }, [breakdown]);

  const incomeBreakdownWithShare = useMemo(() => {
    const total = incomeBreakdown.reduce((sum, item) => sum + item.spent, 0) || 1;
    return incomeBreakdown.map((item) => ({
      ...item,
      share: item.spent / total
    }));
  }, [incomeBreakdown]);

  const handleLogout = () => {
    clearToken();
    setError("");
    setNotice("");
    setAuthState({ status: "guest", user: null });
    setView("dashboard");
  };

  const handleAuthSubmit = async ({
    full_name,
    username,
    phone,
    email,
    identifier,
    password,
    remember,
    mode
  }) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      if (mode === "register") {
        await registerWithProfile({
          full_name,
          username,
          phone: phone || null,
          email
        });
        return { next: "otp" };
      }
      const token = await login(identifier, password);
      setToken(token.access_token, remember);
      const user = await me();
      setAuthState({ status: "authed", user });
      return { next: "authed" };
    } catch (err) {
      setError(err.message || "Không thể xác thực. Vui lòng thử lại.");
      return { next: "error" };
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (email, code) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await verifyOtp(email, code);
      setNotice("Xác thực email thành công. Vui lòng tạo mật khẩu.");
      return result;
    } catch (err) {
      setError(err.message || "OTP không hợp lệ.");
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSetPassword = async (registrationToken, password) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      await setPassword(registrationToken, password);
      setNotice("Đã tạo mật khẩu. Bạn có thể đăng nhập.");
      return true;
    } catch (err) {
      setError(err.message || "Không thể tạo mật khẩu.");
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetStart = async (email) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      await resetPasswordStart(email);
      setNotice("Đã gửi OTP đặt lại mật khẩu.");
      return true;
    } catch (err) {
      setError(err.message || "Không thể gửi OTP.");
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetVerify = async (email, code) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await resetPasswordVerify(email, code);
      setNotice("OTP hợp lệ. Vui lòng tạo mật khẩu mới.");
      return result;
    } catch (err) {
      setError(err.message || "OTP không hợp lệ.");
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetConfirm = async (resetToken, password) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      await resetPasswordConfirm(resetToken, password);
      setNotice("Đã cập nhật mật khẩu. Bạn có thể đăng nhập.");
      return true;
    } catch (err) {
      setError(err.message || "Không thể cập nhật mật khẩu.");
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendOtp = async (email) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      await resendOtp(email);
      setNotice("Đã gửi lại OTP. Vui lòng kiểm tra email.");
    } catch (err) {
      setError(err.message || "Không thể gửi lại OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  const loadFinanceData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        start_date: filters.start,
        end_date: filters.end,
        category_id: filters.categoryId || undefined,
        transaction_type: filters.type || undefined,
        limit: 20,
        offset: 0
      };
      const [cats, txData, sum, catsBreakdown, incBreakdown, chart, alerts] = await Promise.all([
        listCategories(),
        listTransactions(params),
        getSummary({ start_date: filters.start, end_date: filters.end }),
        getCategoryBreakdown({ start_date: filters.start, end_date: filters.end, transaction_type: "expense" }),
        getCategoryBreakdown({ start_date: filters.start, end_date: filters.end, transaction_type: "income" }),
        getChartData({ limit_months: 6 }),
        getAnomalies()
      ]);
      setCategories(cats);
      setTransactions(txData);
      setSummary(sum);
      setBreakdown(catsBreakdown);
      setIncomeBreakdown(incBreakdown);
      setMonthlySeries(chart.series || []);
      setAnomalies(alerts.alerts || []);
    } catch (err) {
      if (err.status === 401) {
        handleLogout();
      } else {
        setError(err.message || "Không thể tải dữ liệu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTransactions = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const nextOffset = (transactions.items || []).length;
      const params = {
        start_date: filters.start,
        end_date: filters.end,
        category_id: filters.categoryId || undefined,
        transaction_type: filters.type || undefined,
        limit: 20,
        offset: nextOffset
      };
      const nextPage = await listTransactions(params);
      setTransactions(prev => ({
        ...nextPage,
        items: [...prev.items, ...nextPage.items]
      }));
    } catch (err) {
      setError(err.message || "Không thể tải thêm giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = getToken();
      if (!token) {
        setAuthState({ status: "guest", user: null });
        return;
      }
      try {
        const user = await me();
        setAuthState({ status: "authed", user });
      } catch {
        clearToken();
        setAuthState({ status: "guest", user: null });
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (authState.status === "authed") {
      loadFinanceData();
    }
  }, [authState.status, filters]);

  const handleCreateTransaction = async (payload) => {
    setLoading(true);
    setError("");
    try {
      await createTransaction(payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Không thể tạo giao dịch.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromText = async (text) => {
    setLoading(true);
    setError("");
    try {
      await createTransactionFromText(text);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Unable to create transaction from text.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleParseFromText = async (text) => {
    setLoading(true);
    setError("");
    try {
      return await parseTransaction(text, { auto_create_category: false });
    } catch (err) {
      setError(err.message || "Unable to parse text.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTransaction = async (transactionId, payload) => {
    setLoading(true);
    setError("");
    try {
      await updateTransaction(transactionId, payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Không thể cập nhật giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    setLoading(true);
    setError("");
    try {
      await deleteTransaction(transactionId);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Không thể xoá giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (name) => {
    setLoading(true);
    setError("");
    try {
      await createCategory(name);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Không thể tạo danh mục.");
    } finally {
      setLoading(false);
    }
  };

  const selectRangePreset = (preset) => {
    setRangePreset(preset);
    const nextRange = getRangeFromPreset(preset);
    setFilters((current) => ({ ...current, ...nextRange }));
  };

  const showDateFilters = ["dashboard", "transactions", "reports"].includes(view);

  if (authState.status !== "authed") {
    return (
      <div className="app">
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          onSubmit={handleAuthSubmit}
          onVerifyOtp={handleVerifyOtp}
          onResendOtp={handleResendOtp}
          onSetPassword={handleSetPassword}
          onResetStart={handleResetStart}
          onResetVerify={handleResetVerify}
          onResetConfirm={handleResetConfirm}
          loading={authLoading}
          error={error}
          notice={notice}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <SideMenu
        active={view}
        onChange={setView}
        onLogout={handleLogout}
        user={authState.user}
      />

      <main className="app-shell app-shell-topnav">
        {view === "dashboard" && (
          <>
            <header className="app-header">
              <div>
                <p className="eyebrow">Xin chào</p>
                <h1>{authState.user?.username || authState.user?.email || "Người dùng"}</h1>
              </div>
            </header>

            <section className={`balance-card ${summary.total_balance < 0 ? "negative" : ""}`}>
              <div>
                <p className="label">Số dư hiện tại</p>
                <h2>{currency(summary.total_balance)}</h2>
                {summary.total_balance < 0 && (
                  <p className="warning">⚠️ Cảnh báo: Chi tiêu vượt quá ngân quỹ</p>
                )}
              </div>
              <div className="balance-meta">
                <div>
                  <p>Biến động kỳ</p>
                  <strong>{currency(summary.period_net_flow)}</strong>
                </div>
                <div>
                  <p>Thu kỳ</p>
                  <strong>{currency(summary.period_total_income)}</strong>
                </div>
                <div>
                  <p>Chi kỳ</p>
                  <strong>{currency(summary.period_total_expense)}</strong>
                </div>
              </div>
            </section>
          </>
        )}

        {showDateFilters && (
          <DateRangeFilters
            start={filters.start}
            end={filters.end}
            onChange={(next) => {
              setRangePreset("custom");
              setFilters((current) => ({ ...current, ...next }));
            }}
          />
        )}

        <StatusBanner loading={loading} error={error} />

        {view === "dashboard" && (
          <DashboardScreen
            summary={summary}
            breakdown={breakdownWithShare}
            incomeBreakdown={incomeBreakdownWithShare}
            transactions={transactionsWithLabels}
            monthlySeries={monthlySeries}
            anomalies={anomalies}
            onGoTransactions={() => setView("transactions")}
            onGoOcr={() => setView("ocr")}
            onGoAddTransaction={() => setView("transactions")}
            onGoReports={() => setView("reports")}
            rangePreset={rangePreset}
            onSelectPreset={selectRangePreset}
          />
        )}

        {view === "transactions" && (
          <TransactionsScreen
            transactions={transactionsWithLabels}
            totalCount={transactions.total}
            categories={categories}
            filters={filters}
            onFiltersChange={setFilters}
            onCreate={handleCreateTransaction}
            onCreateFromText={handleCreateFromText}
            onParseFromText={handleParseFromText}
            onUpdate={handleUpdateTransaction}
            onDelete={handleDeleteTransaction}
            onCreateCategory={handleCreateCategory}
            userEmail={authState.user?.email}
            onCreateTransaction={handleCreateTransaction}
            onLoadMore={loadMoreTransactions}
            hasMore={transactionsWithLabels.length < transactions.total}
            onBack={() => setView("dashboard")}
            loading={loading}
          />
        )}

        {view === "categories" && (
          <CategoriesScreen
            categories={categories}
            onCreate={handleCreateCategory}
            onBack={() => setView("dashboard")}
            loading={loading}
          />
        )}

        {view === "tags" && <TagsScreen userEmail={authState.user?.email} />}

        {view === "reports" && (
          <ReportsScreen
            summary={summary}
            monthlySeries={monthlySeries}
            transactions={transactionsWithLabels}
            onBack={() => setView("dashboard")}
            reportLayout={uiPrefs.reportLayout}
          />
        )}

        {view === "budgets" && (
          <BudgetsScreen
            categories={categories}
            transactions={transactions}
            userEmail={authState.user?.email}
          />
        )}

        {view === "ocr" && (
          <OcrScreen
            categories={categories}
            onParseFromText={handleParseFromText}
            onCreateTransaction={handleCreateTransaction}
            loading={loading}
          />
        )}

        {view === "accounts" && <AccountsScreen userEmail={authState.user?.email} />}

        {view === "settings" && <SettingsScreen user={authState.user} />}

        <BottomNav active={view} onChange={setView} />
      </main>
      <FloatingChatbot
        isAuthed={authState.status === "authed"}
        userEmail={authState.user?.email}
      />
    </div>
  );
}
