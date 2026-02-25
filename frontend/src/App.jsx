import { useEffect, useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "./api/client.js";
import {
  login,
  me,
  registerWithProfile,
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
  updateTransaction
} from "./api/finance.js";
import BottomNav from "./components/BottomNav.jsx";
import DateRangeFilters from "./components/DateRangeFilters.jsx";
import StatusBanner from "./components/StatusBanner.jsx";
import AuthScreen from "./features/auth/AuthScreen.jsx";
import DashboardScreen from "./features/dashboard/DashboardScreen.jsx";
import CategoriesScreen from "./features/categories/CategoriesScreen.jsx";
import ReportsScreen from "./features/reports/ReportsScreen.jsx";
import TransactionsScreen from "./features/transactions/TransactionsScreen.jsx";
import { currency, toInputDate } from "./utils/format.js";

const buildMonthlySeries = (transactions) => {
  const buckets = {};
  transactions.forEach((item) => {
    const key = item.date.slice(0, 7);
    if (!buckets[key]) buckets[key] = { income: 0, expense: 0 };
    if (item.transaction_type === "income") buckets[key].income += item.amount;
    if (item.transaction_type === "expense") buckets[key].expense += item.amount;
  });
  return Object.entries(buckets)
    .map(([month, values]) => ({
      month,
      value: values.income - values.expense
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
};

const defaultFilters = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    start: toInputDate(start),
    end: toInputDate(today),
    type: "",
    categoryId: ""
  };
};

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authState, setAuthState] = useState({ status: "checking", user: null });
  const [view, setView] = useState("dashboard");
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    total_income: 0,
    total_expense: 0,
    balance: 0
  });
  const [breakdown, setBreakdown] = useState([]);
  const [filters, setFilters] = useState(defaultFilters());
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((item) => {
      map[item.id] = item.name;
    });
    return map;
  }, [categories]);

  const transactionsWithLabels = useMemo(
    () =>
      transactions.map((item) => ({
        ...item,
        categoryLabel: item.category_id ? categoryMap[item.category_id] || "Khác" : "Khác"
      })),
    [transactions, categoryMap]
  );

  const breakdownWithShare = useMemo(() => {
    const total = breakdown.reduce((sum, item) => sum + item.spent, 0) || 1;
    return breakdown.map((item) => ({
      ...item,
      share: item.spent / total
    }));
  }, [breakdown]);

  const monthlySeries = useMemo(() => buildMonthlySeries(transactions), [transactions]);

  const handleLogout = () => {
    clearToken();
    setError("");
    setNotice("");
    setAuthState({ status: "guest", user: null });
    setView("dashboard");
  };

  const handleAuthSubmit = async ({
    first_name,
    last_name,
    phone,
    email,
    password,
    mode
  }) => {
    setAuthLoading(true);
    setError("");
    setNotice("");
    try {
      if (mode === "register") {
        await registerWithProfile({ first_name, last_name, phone, email });
        return { next: "otp" };
      }
      const token = await login(email, password);
      setToken(token.access_token);
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
        transaction_type: filters.type || undefined
      };
      const [cats, txs, sum, catsBreakdown] = await Promise.all([
        listCategories(),
        listTransactions(params),
        getSummary({ start_date: filters.start, end_date: filters.end }),
        getCategoryBreakdown({ start_date: filters.start, end_date: filters.end })
      ]);
      setCategories(cats);
      setTransactions(txs);
      setSummary(sum);
      setBreakdown(catsBreakdown);
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
      } catch (err) {
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
          loading={authLoading}
          error={error}
          notice={notice}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <main className="app-shell">
        <header className="app-header">
          <div>
            <p className="eyebrow">Xin chào</p>
            <h1>{authState.user?.email || "Người dùng"}</h1>
          </div>
          <button className="ghost" onClick={handleLogout} type="button">
            Đăng xuất
          </button>
        </header>

        <section className="balance-card">
          <div>
            <p className="label">Số dư hiện tại</p>
            <h2>{currency(summary.balance)}</h2>
          </div>
          <div className="balance-meta">
            <div>
              <p>Thu</p>
              <strong>{currency(summary.total_income)}</strong>
            </div>
            <div>
              <p>Chi</p>
              <strong>{currency(summary.total_expense)}</strong>
            </div>
          </div>
        </section>

        <DateRangeFilters
          start={filters.start}
          end={filters.end}
          onChange={(next) => setFilters({ ...filters, ...next })}
        />

        <StatusBanner loading={loading} error={error} />

        {view === "dashboard" && (
          <DashboardScreen
            summary={summary}
            breakdown={breakdownWithShare}
            transactions={transactionsWithLabels}
            monthlySeries={monthlySeries}
            onViewTransactions={() => setView("transactions")}
          />
        )}

        {view === "transactions" && (
          <TransactionsScreen
            transactions={transactionsWithLabels}
            categories={categories}
            filters={filters}
            onFiltersChange={setFilters}
            onCreate={handleCreateTransaction}
            onUpdate={handleUpdateTransaction}
            onDelete={handleDeleteTransaction}
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

        {view === "reports" && (
          <ReportsScreen
            summary={summary}
            monthlySeries={monthlySeries}
            onBack={() => setView("dashboard")}
          />
        )}

        <BottomNav active={view} onChange={setView} />
      </main>
    </div>
  );
}
