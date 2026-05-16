import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
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
  createAccount,
  createTag,
  createTransaction,
  deleteAccount,
  deleteTag,
  deleteTransaction,
  getCategoryBreakdown,
  getSummary,
  listAccounts,
  listCategories,
  listTags,
  listTransactions,
  listBudgets,
  bootstrapFinance,
  createBudget,
  createSavingsGoal,
  updateAccount,
  updateBudget,
  updateSavingsGoal,
  deleteBudget,
  deleteSavingsGoal,
  updateTag,
  updateTransaction,
  getChartData,
  getReportsOverview,
  listSavingsGoals,
  listBills,
  createBill,
  updateBill,
  deleteBill
} from "./api/finance.js";
import { createTransactionFromText, parseTransaction, getAnomalies, getSavingsTips } from "./api/ai.js";
import SideMenu from "./components/SideMenu.jsx";
import TopBar from "./components/TopBar.jsx";
import DateRangeFilters from "./components/DateRangeFilters.jsx";
import StatusBanner from "./components/StatusBanner.jsx";
import AuthScreen from "./features/auth/AuthScreen.jsx";
import OnboardingScreen from "./features/onboarding/OnboardingScreen.jsx";
import DashboardScreen from "./features/dashboard/DashboardScreen.jsx";
import CategoriesScreen from "./features/categories/CategoriesScreen.jsx";
import ReportsScreen from "./features/reports/ReportsScreen.jsx";
import TransactionsScreen from "./features/transactions/TransactionsScreen.jsx";
import ChatScreen from "./features/chat/ChatScreen.jsx";
import OcrScreen from "./features/ocr/OcrScreen.jsx"; // Main OCR component
import BudgetsScreen from "./features/budgets/BudgetsScreen.jsx";
import GoalsScreen from "./features/goals/GoalsScreen.jsx";
import TagsScreen from "./features/tags/TagsScreen.jsx";
import AccountsScreen from "./features/accounts/AccountsScreen.jsx";
import SettingsScreen from "./features/settings/SettingsScreen.jsx";
import NotificationsScreen from "./features/notifications/NotificationsScreen.jsx";
import BillsScreen from "./features/bills/BillsScreen.jsx";
import FloatingChatbot from "./components/FloatingChatbot.jsx";
import BottomNav from "./components/BottomNav.jsx";
import { currency, toInputDate } from "./utils/format.js";
import { applyUiPrefs, getUiPrefs } from "./utils/uiPrefs.js";
import {
  applyUserPrefs,
  getUserPrefs,
  isOnboardingDone,
  setActiveUserEmail,
  setOnboardingDone
} from "./utils/userPrefs.js";
import { t } from "./utils/i18n.js";
import {
  buildNotificationsFromData,
  buildTransactionNotification,
  clearNotifications,
  getNotificationCounts,
  getNotifications,
  markAllRead,
  markNotificationRead,
  mergeNotifications,
  pushNotification
} from "./utils/notifications.js";

const buildMonthlySeries = (transactions) => {
  const buckets = {};
  transactions.forEach((item) => {
    const key = item.date.slice(0, 7);
    if (!buckets[key]) buckets[key] = { income: 0, expense: 0 };
    if (item.transaction_type === "income") buckets[key].income += Number(item.amount || 0);
    if (item.transaction_type === "expense") buckets[key].expense += Number(item.amount || 0);
  });
  return Object.entries(buckets)
    .map(([month, values]) => {
      const net = values.income - values.expense;
      return {
        month,
        income: values.income,
        expense: values.expense,
        net,
        value: net
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
};

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
  categoryId: "",
  tagId: ""
});

const getSocketBase = () => {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/api\/v1$/, "");
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/v1$/, "");
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8005`;
};

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authState, setAuthState] = useState({ status: "checking", user: null });
  const [uiPrefs, setUiPrefs] = useState(() => getUiPrefs());
  const [view, setView] = useState("dashboard");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState(null);
  const [rangePreset, setRangePreset] = useState("month");
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [transactions, setTransactions] = useState({ items: [], total: 0 });
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
  const [budgets, setBudgets] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [reportsOverview, setReportsOverview] = useState({
    daily_series: [],
    monthly_series: [],
    category_spending: [],
    payment_breakdown: [],
    weekday_heatmap: [],
    top_expenses: [],
    goals: []
  });
  const [anomalies, setAnomalies] = useState([]);
  const [savingsTips, setSavingsTips] = useState([]);
  const [filters, setFilters] = useState(defaultFilters());
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [languageVersion, setLanguageVersion] = useState(0);
  const [notifications, setNotifications] = useState(() => getNotifications());
  const loadFinanceRef = useRef(null);
  const authStatusRef = useRef(authState.status);
  const authUserIdRef = useRef(null);
  const needsOnboardingRef = useRef(needsOnboarding);
  const refreshTimerRef = useRef(null);
  const bootstrapTriedRef = useRef(false);

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
    const handleRefresh = (event) => {
      if (authState.status !== "authed") return;
      const range = event?.detail;
      if (range?.startDate && range?.endDate) {
        const start = filters.start;
        const end = filters.end;
        if (start && end && (range.startDate < start || range.endDate > end)) {
          const dateLabel =
            range.startDate === range.endDate
              ? range.startDate
              : `${range.startDate} - ${range.endDate}`;
          setNotice(
            `Giao dich vua luu ngay ${dateLabel}. Bo loc hien tai (${start} -> ${end}) khong hien thi. Hay doi pham vi neu can.`
          );
        }
      }
      loadFinanceData();
    };
    window.addEventListener("finance:ui-prefs", handlePrefs);
    window.addEventListener("finance:logout", handleLogout);
    window.addEventListener("finance:refresh", handleRefresh);
    return () => {
      window.removeEventListener("finance:ui-prefs", handlePrefs);
      window.removeEventListener("finance:logout", handleLogout);
      window.removeEventListener("finance:refresh", handleRefresh);
    };
  }, [authState.user?.email, authState.status, filters]);

  useEffect(() => {
    const prefs = getUserPrefs(authState.user?.email);
    applyUserPrefs(prefs);
  }, [authState.user?.email]);

  useEffect(() => {
    authStatusRef.current = authState.status;
  }, [authState.status]);

  useEffect(() => {
    authUserIdRef.current = authState.user?.id || null;
  }, [authState.user?.id]);

  useEffect(() => {
    needsOnboardingRef.current = needsOnboarding;
  }, [needsOnboarding]);

  useEffect(() => {
    const handleUserPrefs = (event) => {
      if (!event?.detail) return;
      const currentEmail = authState.user?.email || "guest";
      if ((event.detail.email || "guest") !== currentEmail) return;
      const nextPrefs = event.detail.prefs || getUserPrefs(currentEmail);
      applyUserPrefs(nextPrefs);
      setLanguageVersion((current) => current + 1);
    };
    window.addEventListener("finance:user-prefs", handleUserPrefs);
    return () => window.removeEventListener("finance:user-prefs", handleUserPrefs);
  }, [authState.user?.email]);

  useEffect(() => {
    const email = authState.user?.email || "guest";
    setNotifications(getNotifications(email));
  }, [authState.user?.email]);

  useEffect(() => {
    const handleNotifications = (event) => {
      if (!event?.detail) return;
      const currentEmail = authState.user?.email || "guest";
      if ((event.detail.email || "guest") !== currentEmail) return;
      setNotifications(event.detail.items || []);
    };
    window.addEventListener("finance:notifications", handleNotifications);
    return () => window.removeEventListener("finance:notifications", handleNotifications);
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
        categoryLabel: item.category_id ? categoryMap[item.category_id] || t("transactions.none") : t("transactions.none"),
        tagLabels: (item.tags || []).map(tag => tag.name)
      })),
    [transactions, categoryMap, languageVersion]
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
    setActiveUserEmail("guest");
    setNeedsOnboarding(false);
    setNotifications(getNotifications("guest"));
    setCategories([]);
    setTags([]);
    setTransactions({ items: [], total: 0 });
  };

  const isAuthed = authState.status === "authed";

  const handleAccountAction = () => {
    if (isAuthed) {
      handleLogout();
      return;
    }
    setAuthMode("login");
    setView("auth");
  };

  const handleChangeView = (nextView) => {
    const mappedView = nextView === "reminders" ? "notifications" : nextView;
    if (view === "onboarding") return;
    if (!isAuthed && !["dashboard", "settings"].includes(mappedView)) {
      setAuthMode("login");
      setView("auth");
      return;
    }
    if (!isAuthed && mappedView === "settings") {
      setAuthMode("login");
      setView("auth");
      return;
    }
    setView(mappedView);
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
        // Force first-time setup for newly registered accounts (even if this email was used before on this device).
        setOnboardingDone(email, false);
        return { next: "otp" };
      }
      const token = await login(identifier, password);
      setToken(token.access_token, remember);
      const user = await me();
      setAuthState({ status: "authed", user });
      setActiveUserEmail(user?.email || "guest");
      const hasOnboarded = isOnboardingDone(user?.email);
      setNeedsOnboarding(!hasOnboarded);
      setView(hasOnboarded ? "dashboard" : "onboarding");
      return { next: "authed" };
    } catch (err) {
      setError(err.message || t("auth.error.generic"));
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
      setNotice(t("auth.notice.verified"));
      return result;
    } catch (err) {
      setError(err.message || t("auth.error.otp_invalid"));
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
      setNotice(t("auth.notice.password_set"));
      return true;
    } catch (err) {
      setError(err.message || t("auth.error.password_set"));
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
      setNotice(t("auth.notice.reset_otp_sent"));
      return true;
    } catch (err) {
      setError(err.message || t("auth.error.reset_otp_sent"));
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
      setNotice(t("auth.notice.reset_otp_valid"));
      return result;
    } catch (err) {
      setError(err.message || t("auth.error.otp_invalid"));
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
      setNotice(t("auth.notice.password_reset"));
      return true;
    } catch (err) {
      setError(err.message || t("auth.error.password_reset"));
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
      setNotice(t("auth.notice.otp_resent", null, "Mã OTP đã được gửi lại"));
    } catch (err) {
      setError(err.message || t("auth.error.otp_resend", null, "Không thể gửi lại mã OTP"));
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
      const safeFetch = async (promise, fallback) => {
        try {
          return await promise;
        } catch (err) {
          console.error("Fetch failed:", err);
          return fallback;
        }
      };

      const [
        cats,
        tagsList,
        txs,
        sum,
        expenseBreakdown,
        incomeBreakdownData,
        chartData,
        budgetsData,
        accountsData,
        billsData,
        goalsData,
        anomalyData,
        tipsData,
        overviewData
      ] = await Promise.all([
        safeFetch(listCategories(), []),
        safeFetch(listTags(), []),
        safeFetch(listTransactions(params), { items: [], total: 0 }),
        safeFetch(getSummary({ start_date: filters.start, end_date: filters.end }), { income: 0, expense: 0, balance: 0 }),
        safeFetch(getCategoryBreakdown({ start_date: filters.start, end_date: filters.end, transaction_type: "expense" }), []),
        safeFetch(getCategoryBreakdown({ start_date: filters.start, end_date: filters.end, transaction_type: "income" }), []),
        safeFetch(getChartData({ limit_months: 6 }), { series: [] }),
        safeFetch(listBudgets({ start_date: filters.start, end_date: filters.end }), []),
        safeFetch(listAccounts(), []),
        safeFetch(listBills(), []),
        safeFetch(listSavingsGoals(), []),
        safeFetch(getAnomalies(), { alerts: [] }),
        safeFetch(getSavingsTips(), []),
        safeFetch(getReportsOverview({ start_date: filters.start, end_date: filters.end }), null)
      ]);
      setCategories(cats);
      setTags(tagsList);
      setTransactions(txs || { items: [], total: 0 });
      setSummary(sum);
      setBreakdown(expenseBreakdown);
      setIncomeBreakdown(incomeBreakdownData);
      setMonthlySeries(chartData?.series || []);
      setBudgets(Array.isArray(budgetsData) ? budgetsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setSavingsGoals(Array.isArray(goalsData) ? goalsData : []);
      setBills(Array.isArray(billsData) ? billsData : []);
      setAnomalies(anomalyData?.alerts || []);
      setSavingsTips(tipsData || []);
      setReportsOverview(overviewData || {
        daily_series: [],
        monthly_series: [],
        category_spending: [],
        payment_breakdown: [],
        weekday_heatmap: [],
        top_expenses: [],
        goals: []
      });
      if ((!cats || cats.length === 0) && !bootstrapTriedRef.current) {
        bootstrapTriedRef.current = true;
        await bootstrapFinance();
        await loadFinanceData();
        return;
      }
      const email = authState.user?.email || "guest";
      await mergeNotifications(
        email,
        buildNotificationsFromData({
          email,
          summary: sum,
          breakdown: expenseBreakdown,
          transactions: txs?.items || []
        })
      );
    } catch (err) {
      if (err.status === 401) {
        handleLogout();
      } else {
        setError(err.message || t("finance.error.load"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreTransactions = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const currentCount = transactions.items.length;
      const params = {
        start_date: filters.start,
        end_date: filters.end,
        category_id: filters.categoryId || undefined,
        transaction_type: filters.type || undefined,
        limit: 20,
        offset: currentCount
      };
      const moreTxs = await listTransactions(params);
      setTransactions((prev) => ({
        items: [...prev.items, ...moreTxs.items],
        total: moreTxs.total
      }));
    } catch (err) {
      console.error("Failed to load more transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const scheduleRefresh = useCallback((delay = 250) => {
    if (authStatusRef.current !== "authed" || needsOnboardingRef.current) return;
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      loadFinanceRef.current?.();
    }, delay);
  }, []);

  useEffect(() => {
    loadFinanceRef.current = loadFinanceData;
  }, [loadFinanceData]);

  useEffect(() => {
    const socket = io(getSocketBase(), {
      path: "/ws/socket.io/",
      transports: ["websocket", "polling"]
    });
    socket.on("finance:update", (payload) => {
      const currentUserId = authUserIdRef.current;
      if (payload?.user_id && currentUserId && payload.user_id !== currentUserId) return;
      scheduleRefresh();
    });
    return () => {
      socket.disconnect();
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    const handleFocus = () => scheduleRefresh(0);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh(0);
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [scheduleRefresh]);

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
        setActiveUserEmail(user?.email || "guest");
        const hasOnboarded = isOnboardingDone(user?.email);
        setNeedsOnboarding(!hasOnboarded);
        if (!hasOnboarded) setView("onboarding");
      } catch {
        clearToken();
        setAuthState({ status: "guest", user: null });
        setActiveUserEmail("guest");
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (authState.status === "guest" && view !== "auth") {
      setView("auth");
      setAuthMode("login");
    }
  }, [authState.status, view]);

  useEffect(() => {
    if (authState.status === "authed" && !needsOnboarding) {
      loadFinanceData();
    }
  }, [authState.status, filters, needsOnboarding]);

  const handleCreateBill = useCallback(async (payload) => {
    setLoading(true);
    setError("");
    try {
      const created = await createBill(payload);
      setNewlyCreatedId(created.id);
      setTimeout(() => setNewlyCreatedId(null), 5000);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Failed to create bill.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFinanceData]);

  const handleUpdateBill = async (billId, payload) => {
    setLoading(true);
    setError("");
    try {
      await updateBill(billId, payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Failed to update bill.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBill = async (billId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa hóa đơn này?")) return;
    setLoading(true);
    setError("");
    try {
      await deleteBill(billId);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Failed to delete bill.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (payload) => {
    setLoading(true);
    setError("");
    try {
      const created = await createTransaction(payload);
      setNewlyCreatedId(created.id);
      setTimeout(() => setNewlyCreatedId(null), 5000);
      const email = authState.user?.email || "guest";
      await pushNotification(email, buildTransactionNotification(created));
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("finance.error.create_tx"));
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
      setError(err.message || t("finance.error.update_tx"));
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
      setError(err.message || t("finance.error.delete_tx"));
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
      setError(err.message || t("finance.error.create_category"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (payload) => {
    setLoading(true);
    setError("");
    try {
      const created = await createTag(payload);
      await loadFinanceData();
      return created;
    } catch (err) {
      setError(err.message || t("common.error"));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTag = async (tagId, payload) => {
    setLoading(true);
    setError("");
    try {
      await updateTag(tagId, payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagId) => {
    setLoading(true);
    setError("");
    try {
      await deleteTag(tagId);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async (payload) => {
    setLoading(true);
    setError("");
    try {
      await createBudget(payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBudget = async (budgetId, payload) => {
    setLoading(true);
    setError("");
    try {
      await updateBudget(budgetId, payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    setLoading(true);
    setError("");
    try {
      await deleteBudget(budgetId);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSavingsGoal = async (payload) => {
    setLoading(true);
    setError("");
    try {
      await createSavingsGoal(payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSavingsGoal = async (goalId, payload) => {
    setLoading(true);
    setError("");
    try {
      await updateSavingsGoal(goalId, payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSavingsGoal = async (goalId) => {
    setLoading(true);
    setError("");
    try {
      await deleteSavingsGoal(goalId);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (payload) => {
    setLoading(true);
    setError("");
    try {
      await createAccount(payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccount = async (accountId, payload) => {
    setLoading(true);
    setError("");
    try {
      await updateAccount(accountId, payload);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    setLoading(true);
    setError("");
    try {
      await deleteAccount(accountId);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || t("common.error"));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const selectRangePreset = (preset) => {
    setRangePreset(preset);
    const nextRange = getRangeFromPreset(preset);
    setFilters((current) => ({ ...current, ...nextRange }));
  };

  const showDateFilters = isAuthed && view === "dashboard";
  const notificationCounts = getNotificationCounts(notifications);

  // --- RENDER LOGIC ---
  if (authState.status === "checking") {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>{t("status.loading", null, "Đang khởi tạo hệ thống...")}</p>
      </div>
    );
  }

  if (authState.status === "guest" || view === "auth") {
    return (
      <div className="app">
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          onSubmit={handleAuthSubmit}
          onVerifyOtp={handleVerifyOtp}
          onResendOtp={handleResendOtp}
          onSetPassword={handleSetPassword}
          onResetPasswordStart={handleResetStart}
          onResetPasswordVerify={handleResetVerify}
          onResetPasswordConfirm={handleResetConfirm}
          onGoOnboarding={() => setView("onboarding")}
          loading={authLoading}
          error={error}
          notice={notice}
        />
      </div>
    );
  }

  if (needsOnboarding || view === "onboarding") {
    return (
      <div className="app">
        <OnboardingScreen
          userEmail={authState.user?.email}
          currentUiPrefs={uiPrefs}
          onComplete={() => {
            setOnboardingDone(authState.user?.email, true);
            setNeedsOnboarding(false);
            setView("dashboard");
            loadFinanceData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <SideMenu
        active={view}
        onChange={handleChangeView}
        onLogout={handleAccountAction}
        user={isAuthed ? authState.user : null}
        notificationsCount={notificationCounts.unread}
      />

      <div className="main-wrapper">
        <TopBar
           user={authState.user}
           notificationsCount={notificationCounts.unread}
           onChange={handleChangeView}
        />

        <main className={`app-content${view === "reports" ? " app-content-reports" : ""}`}>
          {view === "dashboard" && (
            <>
              <header className="page-header">
                <div>
                  {isAuthed && <p className="eyebrow">{t("dashboard.greeting")}</p>}
                  <h1>
                    {isAuthed
                      ? authState.user?.username || authState.user?.email || t("user.default")
                      : t("nav.overview")}
                  </h1>
                </div>
              </header>


            </>
          )}

        {showDateFilters && view !== "dashboard" && (
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
            savingsGoals={savingsGoals}
            budgets={budgets}
            onViewTransactions={() => handleChangeView("transactions")}
            onGoOcr={() => handleChangeView("ocr")}
            onGoChat={() => handleChangeView("chat")}
            onGoReports={() => handleChangeView("reports")}
            onGoAddTransaction={() => {}}
            onGoBudgets={() => handleChangeView("budgets")}
            rangePreset={rangePreset}
            onSelectPreset={selectRangePreset}
            filters={filters}
            onFiltersChange={setFilters}
            userEmail={authState.user?.email}
          />
        )}

        {view === "transactions" && (
          <TransactionsScreen
            transactions={transactionsWithLabels}
            newlyCreatedId={newlyCreatedId}
            totalCount={transactions.total}
            hasMore={transactions.items.length < transactions.total}
            onLoadMore={handleLoadMoreTransactions}
            categories={categories}
            accounts={accounts}
            tags={tags}
            filters={filters}
            anomalies={anomalies}
            onFiltersChange={setFilters}
            onCreate={handleCreateTransaction}
            onCreateFromText={handleCreateFromText}
            onParseFromText={handleParseFromText}
            onUpdate={handleUpdateTransaction}
            onDelete={handleDeleteTransaction}
            onCreateCategory={handleCreateCategory}
            onCreateTag={handleCreateTag}
            onUpdateTag={handleUpdateTag}
            onDeleteTag={handleDeleteTag}
            userEmail={authState.user?.email}
            onCreateTransaction={handleCreateTransaction}
            onCreateBill={handleCreateBill}
            aiSuggestions={savingsTips}
            monthlySeries={monthlySeries}
            onBack={() => handleChangeView("dashboard")}
            loading={loading}
          />
        )}

        {view === "categories" && (
          <CategoriesScreen
            categories={categories}
            onCreate={handleCreateCategory}
            onBack={() => handleChangeView("dashboard")}
            loading={loading}
            userEmail={authState.user?.email}
          />
        )}

        {view === "tags" && (
          <TagsScreen
            tags={tags}
            onCreate={handleCreateTag}
            onUpdate={handleUpdateTag}
            onDelete={handleDeleteTag}
            loading={loading}
          />
        )}

        {view === "reports" && (
          <ReportsScreen
            summary={summary}
            monthlySeries={monthlySeries}
            breakdown={breakdownWithShare}
            transactions={transactionsWithLabels}
            reportsOverview={reportsOverview}
            userEmail={authState.user?.email}
            onBack={() => handleChangeView("dashboard")}
          />
        )}

        {view === "budgets" && (
          <BudgetsScreen
            categories={categories}
            transactions={transactionsWithLabels}
            budgets={budgets}
            filters={filters}
            onCreateBudget={handleCreateBudget}
            onUpdateBudget={handleUpdateBudget}
            onDeleteBudget={handleDeleteBudget}
            onFiltersChange={setFilters}
            loading={loading}
            userEmail={authState.user?.email}
          />
        )}

        {view === "goals" && (
          <GoalsScreen
            goals={savingsGoals}
            aiSuggestions={savingsTips}
            onCreateGoal={handleCreateSavingsGoal}
            onUpdateGoal={handleUpdateSavingsGoal}
            onDeleteGoal={handleDeleteSavingsGoal}
            loading={loading}
          />
        )}

        {view === "ocr" && (
          <OcrScreen
            categories={categories}
            accounts={accounts}
            tags={tags}
            userEmail={authState.user?.email}
            onCreateCategory={handleCreateCategory}
            onCreateTag={handleCreateTag}
            onCreateTransaction={handleCreateTransaction}
            onCreateBill={handleCreateBill}
            onNavigate={handleChangeView}
            loading={loading}
            onClose={() => handleChangeView("dashboard")}
          />
        )}

        {view === "accounts" && (
          <AccountsScreen
            accounts={accounts}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount}
            loading={loading}
          />
        )}

        {view === "settings" && <SettingsScreen user={authState.user} />}

        {view === "chat" && <ChatScreen userEmail={authState.user?.email} />}

        {view === "notifications" && (
          <NotificationsScreen
            notifications={notifications}
            onBack={() => handleChangeView("dashboard")}
            onMarkRead={(id) => markNotificationRead(authState.user?.email || "guest", id)}
            onMarkAllRead={() => markAllRead(authState.user?.email || "guest")}
            onClearAll={() => clearNotifications(authState.user?.email || "guest")}
          />
        )}

        {view === "bills" && (
          <BillsScreen
            bills={bills}
            categories={categories}
            accounts={accounts}
            newlyCreatedId={newlyCreatedId}
            loading={loading}
            onGoOcr={() => handleChangeView("ocr")}
            onCreateTransaction={handleCreateTransaction}
            onUpdateBill={handleUpdateBill}
            onDeleteBill={handleDeleteBill}
          />
        )}
      </main>
      </div>
      <FloatingChatbot
        isAuthed={authState.status === "authed"}
        userEmail={authState.user?.email}
        onCreateTransaction={handleCreateTransaction}
      />
      {view !== "auth" && view !== "onboarding" && (
        <div className="mobile-nav-wrapper">
          <BottomNav active={view} onChange={handleChangeView} notificationsCount={notificationCounts.unread} />
        </div>
      )}
    </div>
  );
}
