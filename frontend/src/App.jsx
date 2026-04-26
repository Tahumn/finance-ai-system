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
  createTag,
  createTransaction,
  deleteTag,
  deleteTransaction,
  getCategoryBreakdown,
  getSummary,
  listCategories,
  listTags,
  listTransactions,
  updateTag,
  updateTransaction,
  getChartData
} from "./api/finance.js";
import { createTransactionFromText, parseTransaction, getAnomalies } from "./api/ai.js";
import SideMenu from "./components/SideMenu.jsx";
import DateRangeFilters from "./components/DateRangeFilters.jsx";
import StatusBanner from "./components/StatusBanner.jsx";
import AuthScreen from "./features/auth/AuthScreen.jsx";
import OnboardingScreen from "./features/onboarding/OnboardingScreen.jsx";
import DashboardScreen from "./features/dashboard/DashboardScreen.jsx";
import CategoriesScreen from "./features/categories/CategoriesScreen.jsx";
import ReportsScreen from "./features/reports/ReportsScreen.jsx";
import TransactionsScreen from "./features/transactions/TransactionsScreen.jsx";
import ChatScreen from "./features/chat/ChatScreen.jsx";
import OcrScreen from "./features/ocr/OcrScreen.jsx";
import BudgetsScreen from "./features/budgets/BudgetsScreen.jsx";
import TagsScreen from "./features/tags/TagsScreen.jsx";
import AccountsScreen from "./features/accounts/AccountsScreen.jsx";
import SettingsScreen from "./features/settings/SettingsScreen.jsx";
import NotificationsScreen from "./features/notifications/NotificationsScreen.jsx";
import FloatingChatbot from "./components/FloatingChatbot.jsx";
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
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000`;
};

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authState, setAuthState] = useState({ status: "checking", user: null });
  const [uiPrefs, setUiPrefs] = useState(() => getUiPrefs());
  const [view, setView] = useState("dashboard");
  const [initialChatQuery, setInitialChatQuery] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [rangePreset, setRangePreset] = useState("month");
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [transactions, setTransactions] = useState([]);
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
  const [globalRecentTransactions, setGlobalRecentTransactions] = useState([]);
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
        categoryLabel: item.category_id ? categoryMap[item.category_id] || t("transactions.none") : t("transactions.none")
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
    setTransactions([]);
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

  const handleChangeView = (nextView, query = null) => {
    if (view === "onboarding") return;
    if (!isAuthed && !["dashboard", "settings"].includes(nextView)) {
      setAuthMode("login");
      setView("auth");
      return;
    }
    if (!isAuthed && nextView === "settings") {
      setAuthMode("login");
      setView("auth");
      return;
    }
    setView(nextView);
    if ((nextView === "chat" || nextView === "dashboard") && query) {
      setInitialChatQuery(query);
    }
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
      setNotice(t("auth.notice.otp_resent"));
    } catch (err) {
      setError(err.message || t("auth.error.otp_resent"));
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
      const [
        cats, 
        tagsList, 
        txs, 
        sum, 
        catsBreakdown, 
        incBreakdown, 
        charts, 
        anomalyList,
        allTxs
      ] = await Promise.all([
        listCategories(),
        listTags(),
        listTransactions(params),
        getSummary({ start_date: filters.start, end_date: filters.end }),
        getCategoryBreakdown({ start_date: filters.start, end_date: filters.end, transaction_type: "expense" }),
        getCategoryBreakdown({ start_date: filters.start, end_date: filters.end, transaction_type: "income" }),
        getChartData({ limit_months: 6 }),
        getAnomalies(),
        listTransactions({ limit: 10, offset: 0 })
      ]);

      setCategories(cats);
      setTags(tagsList);
      setTransactions(txs);
      setSummary(sum);
      setBreakdown(catsBreakdown);
      setIncomeBreakdown(incBreakdown);
      setMonthlySeries(charts?.series || []);
      setAnomalies(anomalyList || []);
      const catMap = {};
      cats.forEach((c) => { catMap[c.id] = c.name; });

      setGlobalRecentTransactions(
        (allTxs?.items || []).map((item) => ({
          ...item,
          categoryLabel: item.category_id ? catMap[item.category_id] || t("transactions.none") : t("transactions.none")
        }))
      );

      const email = authState.user?.email || "guest";
      await mergeNotifications(
        email,
        buildNotificationsFromData({
          email,
          summary: sum,
          breakdown: catsBreakdown,
          transactions: txs
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
      path: "/ws/socket.io",
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
    if (authState.status === "authed" && !needsOnboarding) {
      loadFinanceData();
    }
  }, [authState.status, filters, needsOnboarding]);

  const handleCreateTransaction = async (payload) => {
    setLoading(true);
    setError("");
    try {
      const created = await createTransaction(payload);
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

  const selectRangePreset = (preset) => {
    setRangePreset(preset);
    const nextRange = getRangeFromPreset(preset);
    setFilters((current) => ({ ...current, ...nextRange }));
  };

  const showDateFilters = isAuthed && view === "dashboard";
  const notificationCounts = getNotificationCounts(notifications);

  if (!isAuthed && view === "auth") {
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

  if (isAuthed && view === "onboarding") {
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
    <div className="app">
      <SideMenu
        active={view}
        onChange={handleChangeView}
        onLogout={handleAccountAction}
        user={isAuthed ? authState.user : null}
        notificationsCount={notificationCounts.unread}
      />

      <main className="app-shell app-shell-topnav">
        {view === "dashboard" && (
          <>
            <header className="app-header">
              <div>
                {isAuthed && <p className="eyebrow">{t("dashboard.greeting")}</p>}
                <h1>
                  {isAuthed
                    ? authState.user?.username || authState.user?.email || t("user.default")
                    : t("nav.overview")}
                </h1>
              </div>
            </header>

            <section className={`balance-card ${summary.total_balance < 0 ? "negative" : ""}`}>
              <div>
                <p className="label">{t("dashboard.balance")}</p>
                <h2>{currency(summary.balance)}</h2>
              </div>
              <div className="balance-meta">
                <div>
                  <p>{t("dashboard.income")}</p>
                  <strong>{currency(summary.total_income)}</strong>
                </div>
                <div>
                  <p>{t("dashboard.expense")}</p>
                  <strong>{currency(summary.total_expense)}</strong>
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
            recentTransactions={globalRecentTransactions}
            monthlySeries={monthlySeries}
            onViewTransactions={() => handleChangeView("transactions")}
            onGoOcr={() => handleChangeView("ocr")}
            onGoChat={() => handleChangeView("chat")}
            onGoAddTransaction={() => handleChangeView("transactions")}
            onGoReports={() => handleChangeView("reports")}
            rangePreset={rangePreset}
            onSelectPreset={selectRangePreset}
            userEmail={authState.user?.email}
          />
        )}

        {view === "transactions" && (
          <TransactionsScreen
            transactions={transactionsWithLabels}
            totalCount={transactions.total}
            categories={categories}
            tags={tags}
            filters={filters}
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
            transactions={transactions}
            userEmail={authState.user?.email}
            onBack={() => handleChangeView("dashboard")}
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
            tags={tags}
            userEmail={authState.user?.email}
            onCreateTag={handleCreateTag}
            onCreateTransaction={handleCreateTransaction}
            loading={loading}
          />
        )}

        {view === "accounts" && <AccountsScreen userEmail={authState.user?.email} />}

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

      </main>
      <FloatingChatbot
        isAuthed={authState.status === "authed"}
        userEmail={authState.user?.email}
        summary={summary}
        transactions={transactionsWithLabels}
        breakdown={breakdownWithShare}
        initialQuery={initialChatQuery}
        onClearInitialQuery={() => setInitialChatQuery(null)}
      />
    </div>
  );
}
