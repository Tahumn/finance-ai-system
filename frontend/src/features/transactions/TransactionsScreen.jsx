import { useEffect, useMemo, useRef, useState } from "react";
import TransactionRow from "../../components/TransactionRow.jsx";
import CategoriesScreen from "../categories/CategoriesScreen.jsx";
import TagsScreen from "../tags/TagsScreen.jsx";
import OcrScreen from "../ocr/OcrScreen.jsx";
import {
  formatDateFull,
  formatNumberInput,
  parseNumberInput,
  toInputDate,
  currency
} from "../../utils/format.js";
import { colorFor, onColor } from "../../utils/colors.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";

const parseMonthFromNL = (text) => {
  const match = text.toLowerCase().match(/thang\s*(\d{1,2})/);
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  const year = new Date().getFullYear();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: toInputDate(start),
    end: toInputDate(end),
  };
};

const toCsvRow = (item) =>
  [
    item.date,
    item.description,
    item.transaction_type,
    item.amount,
    item.categoryLabel || "",
  ]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
    .join(",");

const normalizeTag = (value) => value.trim().replace(/^#/, "");

const parseDateInput = (value) => {
  if (!value) return new Date();
  const [year, month, day] = String(value).split("-").map((part) => Number(part));
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
};

const toDateInput = (date) => toInputDate(date instanceof Date ? date : new Date(date));

export default function TransactionsScreen({
  transactions,
  totalCount,
  categories,
  tags = [],
  filters,
  onFiltersChange,
  onCreate,
  onCreateFromText,
  onParseFromText,
  onUpdate,
  onDelete,
  onCreateCategory,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onCreateTransaction,
  onLoadMore,
  hasMore,
  userEmail,
  onBack,
  loading,
}) {
  const [editingTx, setEditingTx] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [nlQuery, setNlQuery] = useState("");
  const [nlpText, setNlpText] = useState("");
  const [nlpNotice, setNlpNotice] = useState("");
  const [nlpError, setNlpError] = useState("");
  const [nlpPreview, setNlpPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [editTagIds, setEditTagIds] = useState([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [createType, setCreateType] = useState("expense");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createDate, setCreateDate] = useState(() => toInputDate(new Date()));
  const [createAmount, setCreateAmount] = useState("");
  const [createDesc, setCreateDesc] = useState("");

  const [showCategories, setShowCategories] = useState(true);
  const [showTags, setShowTags] = useState(true);

  const [visibleCount, setVisibleCount] = useState(20);
  const [dateMode, setDateMode] = useState(() =>
    filters.start && filters.end && String(filters.start) === String(filters.end) ? "single" : "range"
  );
  const [calendarPopup, setCalendarPopup] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(() =>
    parseDateInput(filters.end || filters.start || toInputDate(new Date()))
  );

  const categoryRef = useRef(null);
  const tagRef = useRef(null);
  const bulkCheckRef = useRef(null);

  const categoryPrefs = useMemo(() => getCategoryPrefs(userEmail), [userEmail]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchType = !filters.type || item.transaction_type === filters.type;
      const matchCategory =
        !filters.categoryId || String(item.category_id) === String(filters.categoryId);
      const matchTag =
        !filters.tagId ||
        (Array.isArray(item.tags) &&
          item.tags.some((tag) => String(tag.id) === String(filters.tagId)));
      const matchDate =
        (!filters.start || String(item.date) >= String(filters.start)) &&
        (!filters.end || String(item.date) <= String(filters.end));

      return matchType && matchCategory && matchTag && matchDate;
    });
  }, [transactions, filters.type, filters.categoryId, filters.tagId, filters.start, filters.end]);

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

  const allVisibleSelected =
    visibleTransactions.length > 0 &&
    visibleTransactions.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected = visibleTransactions.some((item) => selectedIds.includes(item.id));

  useEffect(() => {
    if (!bulkCheckRef.current) return;
    bulkCheckRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  const tagMap = useMemo(() => {
    const map = {};
    tags.forEach((tag) => {
      map[tag.id] = tag;
    });
    return map;
  }, [tags]);

  const tagNameMap = useMemo(() => {
    const map = {};
    tags.forEach((tag) => {
      if (tag?.name) {
        map[tag.name.toLowerCase()] = tag;
      }
    });
    return map;
  }, [tags]);

  useEffect(() => {
    setSelectedTagIds((current) => current.filter((id) => tagMap[id]));
    setEditTagIds((current) => current.filter((id) => tagMap[id]));
  }, [tagMap]);

  useEffect(() => {
    const nextMode =
      filters.start && filters.end && String(filters.start) === String(filters.end) ? "single" : "range";
    setDateMode((current) => (current === nextMode ? current : nextMode));
  }, [filters.start, filters.end]);

  useEffect(() => {
    const target = parseDateInput(filters.end || filters.start || toInputDate(new Date()));
    setCalendarCursor((current) => {
      if (
        current.getFullYear() === target.getFullYear() &&
        current.getMonth() === target.getMonth()
      ) {
        return current;
      }
      return target;
    });
  }, [filters.start, filters.end]);

  useEffect(() => {
    if (!editingTx) {
      setEditTagIds([]);
      setEditTagInput("");
      setEditAmount("");
      return;
    }

    const nextTags = Array.isArray(editingTx.tags)
      ? editingTx.tags.map((tag) => tag.id).filter(Boolean)
      : [];

    setEditTagIds(nextTags);
    setEditTagInput("");
    setEditAmount(formatNumberInput(editingTx.amount));
  }, [editingTx]);

  const handleCreate = (event) => {
    event.preventDefault();

    const parsedAmount = parseNumberInput(createAmount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const category = createCategoryId || "";
    const transactionType = createType;

    onCreate({
      description: createDesc,
      amount: parsedAmount,
      transaction_type: transactionType,
      category_id: category ? Number(category) : null,
      date: createDate,
      tag_ids: selectedTagIds,
    });

    setCreateDesc("");
    setCreateAmount("");
    setCreateDate(toInputDate(new Date()));
    setCreateCategoryId("");
    setSelectedTagIds([]);
    setTagInput("");
    setActiveModal(null);
  };

  const handleUpdate = (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const category = form.get("category_id");

    onUpdate(editingTx.id, {
      description: form.get("description"),
      amount: parseNumberInput(editAmount),
      transaction_type: form.get("transaction_type"),
      category_id: category ? Number(category) : null,
      date: form.get("date"),
      tag_ids: editTagIds,
    });

    setEditingTx(null);
  };

  const addTagByName = async (value) => {
    const normalized = normalizeTag(value);
    if (!normalized) return;

    const existing = tagNameMap[normalized.toLowerCase()];
    if (existing) {
      setSelectedTagIds((current) =>
        current.includes(existing.id) ? current : [...current, existing.id]
      );
      setTagInput("");
      return;
    }

    if (!onCreateTag) return;
    const created = await onCreateTag({ name: normalized, color: "#1565c0" });
    if (created?.id) {
      setSelectedTagIds((current) => [...current, created.id]);
    }
    setTagInput("");
  };

  const removeTag = (tagId) => {
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
  };

  const toggleSuggestedTag = (tagId) => {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
  };

  const addEditTagByName = async (value) => {
    const normalized = normalizeTag(value);
    if (!normalized) return;

    const existing = tagNameMap[normalized.toLowerCase()];
    if (existing) {
      setEditTagIds((current) =>
        current.includes(existing.id) ? current : [...current, existing.id]
      );
      setEditTagInput("");
      return;
    }

    if (!onCreateTag) return;
    const created = await onCreateTag({ name: normalized, color: "#1565c0" });
    if (created?.id) {
      setEditTagIds((current) => [...current, created.id]);
    }
    setEditTagInput("");
  };

  const removeEditTag = (tagId) => {
    setEditTagIds((current) => current.filter((id) => id !== tagId));
  };

  const toggleEditSuggestedTag = (tagId) => {
    setEditTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
  };

  const toggleSelection = (transactionId) => {
    setSelectedIds((current) =>
      current.includes(transactionId)
        ? current.filter((id) => id !== transactionId)
        : [...current, transactionId]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(t("transactions.delete_confirm", { count: selectedIds.length }))) return;

    await Promise.all(selectedIds.map((id) => onDelete(id)));
    setSelectedIds([]);
  };

  const handleExportCsv = () => {
    const header = ["date", "description", "type", "amount", "category"];
    const lines = [header.join(","), ...visibleTransactions.map(toCsvRow)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transactions-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      if (!visibleTransactions.length) return current;
      const visibleIds = visibleTransactions.map((item) => item.id);
      const allSelected = visibleIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !visibleIds.includes(id));
      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const txByDate = useMemo(() => {
    const map = new Map();
    transactions.forEach((item) => {
      const key = String(item.date || "").slice(0, 10);
      if (!key) return;
      const entry = map.get(key) || {
        incomeCount: 0,
        expenseCount: 0,
        incomeTotal: 0,
        expenseTotal: 0,
        count: 0
      };
      const amount = Math.max(0, Number(item.amount) || 0);
      entry.count += 1;
      if (item.transaction_type === "income") {
        entry.incomeCount += 1;
        entry.incomeTotal += amount;
      } else {
        entry.expenseCount += 1;
        entry.expenseTotal += amount;
      }
      map.set(key, entry);
    });
    return map;
  }, [transactions]);

  const selectedDay =
    filters.start && filters.end && String(filters.start) === String(filters.end) ? String(filters.start) : "";
  const selectedDayStats = selectedDay
    ? txByDate.get(selectedDay) || { incomeTotal: 0, expenseTotal: 0, count: 0 }
    : null;

  const monthStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const monthLabel = `${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`;
  const startWeekday = (monthStart.getDay() + 6) % 7; // Monday=0
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index - startWeekday + 1;
    const date = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), dayOffset);
    const inMonth = date.getMonth() === calendarCursor.getMonth();
    return { date, inMonth, key: toDateInput(date) };
  });

  return (
    <section className="panel transactions-page">
      <header className="transactions-header">
        <div>
          <p className="eyebrow">Finance Workspace</p>
          <h2>{t("transactions.title")}</h2>
        </div>

        <div className="transactions-actions">
          <button
            className="ghost"
            type="button"
            onClick={() => setActiveModal("ocr")}
          >
            {t("transactions.ocr_toggle_show", null, "Nhập hóa đơn (OCR)")}
          </button>

          <button
            className="ghost"
            type="button"
            onClick={() => {
              setCreateType(filters.type || "expense");
              setCreateCategoryId(filters.categoryId || "");
              setCreateDate(filters.end || toInputDate(new Date()));
              setCreateAmount("");
              setCreateDesc("");
              setSelectedTagIds([]);
              setTagInput("");
              setActiveModal("add");
            }}
          >
            {t("transactions.form_toggle_show", null, "Thêm giao dịch mới")}
          </button>

          <button className="ghost" onClick={onBack} type="button">
            {t("common.back")}
          </button>
        </div>
      </header>

      <div className="transactions-content-card transactions-calendar-card">
        <div className="calendar-header">
          <div>
            <p className="eyebrow">{t("transactions.calendar", null, "Lịch")}</p>
            <h3 className="calendar-title">{monthLabel}</h3>
          </div>
          <div className="calendar-actions">
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setCalendarPopup(null);
                setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
              }}
              aria-label={t("transactions.calendar_prev", null, "Tháng trước")}
            >
              ←
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setCalendarPopup(null);
                setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
              }}
              aria-label={t("transactions.calendar_next", null, "Tháng sau")}
            >
              →
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => {
                const today = toInputDate(new Date());
                setDateMode("single");
                setCalendarPopup(null);
                onFiltersChange({ ...filters, start: today, end: today });
              }}
            >
              {t("transactions.calendar_today", null, "Hôm nay")}
            </button>
          </div>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map(({ date, inMonth, key }) => {
            const info = txByDate.get(key);
            const hasIncome = Boolean(info?.incomeTotal);
            const hasExpense = Boolean(info?.expenseTotal);
            const hasBoth = hasIncome && hasExpense;
            const active = selectedDay && selectedDay === key;
            const isToday = key === toInputDate(new Date());
            return (
              <button
                key={key}
                type="button"
                className={`calendar-cell ${inMonth ? "" : "outside"} ${active ? "active" : ""} ${
                  isToday ? "today" : ""
                } ${info?.count ? "has-tx" : ""}`}
                onClick={() => {
                  setDateMode("single");
                  onFiltersChange({ ...filters, start: key, end: key });
                  if (info?.count) {
                    setCalendarPopup({
                      key,
                      incomeTotal: info.incomeTotal,
                      expenseTotal: info.expenseTotal,
                      count: info.count
                    });
                  } else {
                    setCalendarPopup(null);
                  }
                }}
                aria-label={
                  info?.count
                    ? `${key}: ${info.count} giao dịch (Thu ${currency(info.incomeTotal)}, Chi ${currency(
                        info.expenseTotal
                      )})`
                    : `${key}: Không có giao dịch`
                }
              >
                <span className="calendar-day">{date.getDate()}</span>
                {info?.count ? (
                  <span className={`calendar-metrics line-only ${hasBoth ? "dual" : "single"}`} aria-hidden="true">
                    <span className={`calendar-line ${hasBoth ? "dual" : hasIncome ? "income" : "expense"}`}>
                      {hasBoth ? (
                        <>
                          <span
                            className="calendar-line-seg income"
                            style={{ flex: Math.max(info.incomeTotal, 1) }}
                          />
                          <span
                            className="calendar-line-seg expense"
                            style={{ flex: Math.max(info.expenseTotal, 1) }}
                          />
                        </>
                      ) : (
                        <span className={`calendar-line-seg ${hasIncome ? "income" : "expense"}`} />
                      )}
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {selectedDayStats ? (
          <div className="calendar-summary-card" role="status" aria-live="polite">
            <p className="calendar-summary-date">{formatDateFull(selectedDay)}</p>
            <div className="calendar-summary-metrics">
              <p className="calendar-summary-item income">
                Thu: <strong>{currency(selectedDayStats.incomeTotal)}</strong>
              </p>
              <p className="calendar-summary-item expense">
                Chi: <strong>{currency(selectedDayStats.expenseTotal)}</strong>
              </p>
              <p className="calendar-summary-item count">{selectedDayStats.count} giao dịch</p>
            </div>
          </div>
        ) : null}
      </div>

      {calendarPopup ? (
        <div
          className="sheet calendar-popup-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t("transactions.calendar", null, "Lịch")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCalendarPopup(null);
          }}
        >
          <div className="sheet-body calendar-popup-body">
            <div className="sheet-header-row">
              <h3>{formatDateFull(calendarPopup.key)}</h3>
              <button className="ghost" type="button" onClick={() => setCalendarPopup(null)}>
                {t("common.close", null, "Đóng")}
              </button>
            </div>

            <div className="calendar-popup-content">
              <p className="calendar-tip-row income">
                ↗ Thu: +{formatNumberInput(calendarPopup.incomeTotal)}
              </p>
              <p className="calendar-tip-row expense">
                ↘ Chi: -{formatNumberInput(calendarPopup.expenseTotal)}
              </p>
              <div
                className={`calendar-tip-line ${
                  calendarPopup.incomeTotal > 0 && calendarPopup.expenseTotal > 0
                    ? "dual"
                    : calendarPopup.incomeTotal > 0
                    ? "income"
                    : "expense"
                }`}
              >
                {calendarPopup.incomeTotal > 0 && calendarPopup.expenseTotal > 0 ? (
                  <>
                    <span
                      className="calendar-line-seg income"
                      style={{ flex: Math.max(calendarPopup.incomeTotal, 1) }}
                    />
                    <span
                      className="calendar-line-seg expense"
                      style={{ flex: Math.max(calendarPopup.expenseTotal, 1) }}
                    />
                  </>
                ) : (
                  <span
                    className={`calendar-line-seg ${calendarPopup.incomeTotal > 0 ? "income" : "expense"}`}
                  />
                )}
              </div>
              <p className="calendar-popup-count">{calendarPopup.count} giao dịch</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="transactions-crud-grid">
        <div ref={categoryRef}>
          <CategoriesScreen
            categories={categories}
            onCreate={onCreateCategory}
            loading={loading}
            userEmail={userEmail}
            embedded
            collapsible
            collapsed={!showCategories}
            onToggle={() => setShowCategories((current) => !current)}
          />
        </div>

        <div ref={tagRef}>
          <TagsScreen
            tags={tags}
            onCreate={onCreateTag}
            onUpdate={onUpdateTag}
            onDelete={onDeleteTag}
            embedded
            loading={loading}
            collapsible
            collapsed={!showTags}
            onToggle={() => setShowTags((current) => !current)}
          />
        </div>
      </div>

      <div className="transactions-content-card">
        <div className="filters compact transactions-filters">
          <div className="field">
            <label>{t("transactions.filters.type")}</label>
            <select
              value={filters.type}
              onChange={(event) => onFiltersChange({ ...filters, type: event.target.value })}
            >
              <option value="">{t("filters.all", null, "Tất cả")}</option>
              <option value="income">{t("filters.income", null, "Thu nhập")}</option>
              <option value="expense">{t("filters.expense", null, "Chi tiêu")}</option>
            </select>
          </div>

          <div className="field">
            <label>{t("transactions.filters.category")}</label>
            <select
              value={filters.categoryId}
              onChange={(event) => onFiltersChange({ ...filters, categoryId: event.target.value })}
            >
              <option value="">{t("filters.all", null, "Tất cả")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>{t("transactions.filters.tags", null, "Nhãn")}</label>
            <select
              value={filters.tagId || ""}
              onChange={(event) => onFiltersChange({ ...filters, tagId: event.target.value })}
            >
              <option value="">{t("filters.all", null, "Tất cả")}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>{t("transactions.filters.time", null, "Thời gian")}</label>
            <div className="date-range-bar">
              <button
                className="date-mode-btn"
                type="button"
                onClick={() => {
                  const next = dateMode === "single" ? "range" : "single";
                  setDateMode(next);
                  if (next === "single") {
                    const base = filters.start || filters.end || toInputDate(new Date());
                    onFiltersChange({ ...filters, start: base, end: base });
                  } else {
                    const start = filters.start || toInputDate(new Date());
                    const end = filters.end && filters.end !== start ? filters.end : toInputDate(new Date());
                    onFiltersChange({ ...filters, start, end });
                  }
                }}
                aria-label={t("transactions.filters.time_mode", null, "Chế độ thời gian")}
              >
                {dateMode === "single"
                  ? t("transactions.filters.time_single", null, "1 ngày")
                  : t("transactions.filters.time_range", null, "Khoảng")}
              </button>

              <input
                type="date"
                value={filters.start || ""}
                onChange={(event) => {
                  const value = event.target.value || "";
                  if (dateMode === "single") onFiltersChange({ ...filters, start: value, end: value });
                  else onFiltersChange({ ...filters, start: value });
                }}
              />

              {dateMode === "range" ? (
                <>
                  <span className="date-range-sep" aria-hidden="true">
                    →
                  </span>
                  <input
                    type="date"
                    value={filters.end || ""}
                    onChange={(event) => onFiltersChange({ ...filters, end: event.target.value || "" })}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="row-actions tx-toolbar" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div className="bulk-actions">
              <label className="bulk-check" title={t("transactions.select_all", null, "Chọn tất cả")}>
                <input
                  ref={bulkCheckRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  aria-label={t("transactions.select_all", null, "Chọn tất cả")}
                />
              </label>
              <button
                className="ghost danger"
                type="button"
                disabled={!selectedIds.length}
                onClick={handleBulkDelete}
              >
                {t("transactions.bulk_delete")} ({selectedIds.length})
              </button>
            </div>
          </div>

          <button className="ghost" type="button" onClick={handleExportCsv}>
            {t("transactions.export")}
          </button>
        </div>

        <div className="list">
          {!visibleTransactions.length ? (
            <p className="empty">{t("transactions.empty")}</p>
          ) : (
            visibleTransactions.map((item) => (
              <div key={item.id} className="item-row tx-item">
                <div className="tx-item-top">
                  <label className="tx-select" title={t("transactions.select", null, "Chọn")}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      aria-label={t("transactions.select", null, "Chọn")}
                    />
                  </label>

                  <div className="tx-card-actions">
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => setSelectedTx(item)}
                      aria-label={t("transactions.detail", null, "Chi tiết")}
                      title={t("transactions.detail", null, "Chi tiết")}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          d="M12 5.5c1 0 1.8.8 1.8 1.8S13 9.1 12 9.1s-1.8-.8-1.8-1.8S11 5.5 12 5.5zm0 4.7c1 0 1.8.8 1.8 1.8S13 13.8 12 13.8s-1.8-.8-1.8-1.8.8-1.8 1.8-1.8zm0 4.7c1 0 1.8.8 1.8 1.8S13 18.5 12 18.5s-1.8-.8-1.8-1.8.8-1.8 1.8-1.8z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>

                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => setEditingTx(item)}
                      aria-label={t("transactions.edit", null, "Sửa")}
                      title={t("transactions.edit", null, "Sửa")}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          d="M4 20h4l11-11-4-4L4 16v4z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M13 6l4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    <button
                      className="icon-btn danger"
                      type="button"
                      onClick={() => onDelete(item.id)}
                      aria-label={t("transactions.delete", null, "Xóa")}
                      title={t("transactions.delete", null, "Xóa")}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                          d="M6 7h12M9 7V5.5c0-.8.7-1.5 1.5-1.5h3c.8 0 1.5.7 1.5 1.5V7m-8 0l1 14h8l1-14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <TransactionRow item={item} categoryLabel={item.categoryLabel} userEmail={userEmail} />
              </div>
            ))
          )}
        </div>

        {filteredTransactions.length > visibleCount && (
          <div className="row-actions" style={{ justifyContent: "center" }}>
            <button
              className="ghost"
              type="button"
              onClick={() => setVisibleCount((current) => current + 20)}
            >
              {t("transactions.view_more")}
            </button>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="row-actions" style={{ justifyContent: "center", marginTop: 20 }}>
          <button className="ghost" type="button" onClick={onLoadMore} disabled={loading}>
            {loading ? "Đang tải..." : "Tải thêm giao dịch"}
          </button>
        </div>
      )}

      {activeModal === "add" && (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t("transactions.add.title", null, "Thêm giao dịch")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveModal(null);
          }}
        >
          <div className="sheet-body sheet-body-wide">
            <div className="sheet-header-row">
              <h3>{t("transactions.add.title", null, "Thêm giao dịch")}</h3>
              <button className="ghost" type="button" onClick={() => setActiveModal(null)}>
                {t("common.close")}
              </button>
            </div>

            <form className="form" onSubmit={handleCreate}>
              <div className="tx-type-tabs">
                <button
                  className={`chip ${createType === "expense" ? "active" : ""}`}
                  type="button"
                  onClick={() => setCreateType("expense")}
                >
                  {t("filters.expense", null, "Chi tiêu")}
                </button>
                <button
                  className={`chip ${createType === "income" ? "active" : ""}`}
                  type="button"
                  onClick={() => setCreateType("income")}
                >
                  {t("filters.income", null, "Thu nhập")}
                </button>
              </div>

              <label className="field">
                <span>{t("transactions.field.desc")}</span>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(event) => setCreateDesc(event.target.value)}
                  placeholder={t("transactions.field.desc")}
                  required
                />
              </label>

              <div className="row">
                <label className="field">
                  <span>{t("transactions.field.amount")}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={createAmount}
                    onChange={(event) => setCreateAmount(formatNumberInput(event.target.value))}
                    placeholder="0"
                    required
                  />
                  <small className="hint">{currency(parseNumberInput(createAmount))}</small>
                </label>
                <label className="field">
                  <span>{t("transactions.field.date")}</span>
                  <input
                    type="date"
                    value={createDate}
                    onChange={(event) => setCreateDate(event.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="field">
                <span>{t("transactions.field.category")}</span>
                <div className="category-picker">
                  <button
                    type="button"
                    className={`category-pill ${!createCategoryId ? "selected" : ""}`}
                    onClick={() => setCreateCategoryId("")}
                    aria-pressed={!createCategoryId}
                  >
                    {t("transactions.none", null, "Không")}
                  </button>

                  {categories.map((category) => {
                    const bg = colorFor(category.name, userEmail);
                    const selected = String(createCategoryId) === String(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`category-pill color-pill ${selected ? "selected" : ""}`}
                        onClick={() => setCreateCategoryId(String(category.id))}
                        aria-pressed={selected}
                        style={{ "--pill-bg": bg, "--pill-fg": onColor(bg) }}
                      >
                        <span className="pill-icon" aria-hidden="true">
                          {categoryPrefs[category.name]?.icon || "🏷️"}
                        </span>
                        <span className="pill-text">{category.name}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="tag-section">
                <label className="field">
                  <span>{t("transactions.field.tags")}</span>
                  <div className="tag-input-row">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addTagByName(tagInput);
                        }
                      }}
                      placeholder={t("transactions.tags.placeholder", null, "Nhập nhãn và nhấn Enter")}
                    />
                    <button className="ghost" type="button" onClick={() => addTagByName(tagInput)}>
                      {t("transactions.tags.add", null, "Thêm nhãn")}
                    </button>
                  </div>
                </label>

                {tags.length ? (
                  <div className="tag-options">
                    {tags.map((tag) => {
                      const active = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id || tag.name}
                          type="button"
                          className={`tag-option color-pill ${active ? "active" : ""}`}
                          onClick={() => toggleSuggestedTag(tag.id)}
                          style={{ "--pill-bg": tag.color, "--pill-fg": onColor(tag.color) }}
                        >
                          <span className="pill-text">{tag.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="tag-selected">
                  {selectedTagIds.length ? (
                    selectedTagIds.map((tagId) => {
                      const tag = tagMap[tagId];
                      if (!tag) return null;
                      return (
                        <button
                          key={tagId}
                          type="button"
                          className="tag-chip removable color-pill"
                          onClick={() => removeTag(tagId)}
                          style={{ "--pill-bg": tag.color, "--pill-fg": onColor(tag.color) }}
                        >
                          <span className="pill-text">{tag.name}</span>
                          <span className="tag-remove">×</span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="muted">{t("transactions.tags.empty", null, "Chưa có nhãn nào")}</span>
                  )}
                </div>
              </div>

              <div className="row-actions">
                <button className="ghost" type="button" onClick={() => setActiveModal(null)}>
                  {t("common.back", null, "Quay lại")}
                </button>
                <button className="primary" type="submit" disabled={loading}>
                  {t("transactions.add.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === "ocr" && (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t("ocr.title", null, "Receipt OCR")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveModal(null);
          }}
        >
          <div className="sheet-body sheet-body-wide sheet-body-ocr">
            <div className="sheet-header-row">
              <h3>{t("transactions.ocr_toggle_show", null, "Nhập hóa đơn (OCR)")}</h3>
              <button className="ghost" type="button" onClick={() => setActiveModal(null)}>
                {t("common.close")}
              </button>
            </div>
            <OcrScreen
              categories={categories}
              tags={tags}
              userEmail={userEmail}
              onCreateTag={onCreateTag}
              onCreateTransaction={onCreateTransaction}
              loading={loading}
              embedded
            />
          </div>
        </div>
      )}

      {editingTx && (
        <div className="sheet">
          <div className="sheet-body">
            <h3>{t("transactions.edit_title")}</h3>
            <form className="form" onSubmit={handleUpdate}>
              <input
                name="description"
                type="text"
                defaultValue={editingTx.description}
                required
              />

              <div className="row">
                <select name="transaction_type" defaultValue={editingTx.transaction_type}>
                  <option value="expense">{t("filters.expense", null, "Chi tiêu")}</option>
                  <option value="income">{t("filters.income", null, "Thu nhập")}</option>
                </select>

                <select name="category_id" defaultValue={editingTx.category_id || ""}>
                  <option value="">{t("transactions.none")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="row">
                <input
                  name="amount"
                  type="text"
                  inputMode="numeric"
                  value={editAmount}
                  onChange={(event) => setEditAmount(formatNumberInput(event.target.value))}
                  required
                />
                <input name="date" type="date" defaultValue={editingTx.date} required />
              </div>

              <div className="tag-section">
                <label className="field">
                  <span>{t("transactions.field.tags")}</span>
                  <div className="tag-input-row">
                    <input
                      type="text"
                      value={editTagInput}
                      onChange={(event) => setEditTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addEditTagByName(editTagInput);
                        }
                      }}
                      placeholder={t(
                        "transactions.tags.placeholder",
                        null,
                        "Nhập nhãn và nhấn Enter"
                      )}
                    />
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => addEditTagByName(editTagInput)}
                    >
                      {t("transactions.tags.add", null, "Thêm nhãn")}
                    </button>
                  </div>
                </label>

                {tags.length ? (
                  <div className="tag-options">
                    {tags.map((tag) => {
                      const active = editTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id || tag.name}
                          type="button"
                          className={`tag-option color-pill ${active ? "active" : ""}`}
                          onClick={() => toggleEditSuggestedTag(tag.id)}
                          style={{ "--pill-bg": tag.color, "--pill-fg": onColor(tag.color) }}
                        >
                          <span className="pill-text">{tag.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="tag-selected">
                  {editTagIds.length ? (
                    editTagIds.map((tagId) => {
                      const tag = tagMap[tagId];
                      if (!tag) return null;
                      return (
                        <button
                          key={tagId}
                          type="button"
                          className="tag-chip removable color-pill"
                          onClick={() => removeEditTag(tagId)}
                          style={{ "--pill-bg": tag.color, "--pill-fg": onColor(tag.color) }}
                        >
                          <span className="pill-text">{tag.name}</span>
                          <span className="tag-remove">×</span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="muted">
                      {t("transactions.tags.empty", null, "Chưa có nhãn nào")}
                    </span>
                  )}
                </div>
              </div>

              <div className="row-actions">
                <button className="ghost" type="button" onClick={() => setEditingTx(null)}>
                  {t("common.close")}
                </button>
                <button className="primary" type="submit" disabled={loading}>
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTx && (
        <div className="sheet">
          <div className="sheet-body">
            <h3>{t("transactions.detail_title")}</h3>

            <div className="detail-grid">
              <div>
                <p className="eyebrow">{t("transactions.field.desc")}</p>
                <strong>{selectedTx.description}</strong>
              </div>

              <div>
                <p className="eyebrow">{t("transactions.field.date")}</p>
                <strong>{selectedTx.date}</strong>
              </div>

              <div>
                <p className="eyebrow">{t("transactions.field.type")}</p>
                <strong>{selectedTx.transaction_type}</strong>
              </div>

              <div>
                <p className="eyebrow">{t("transactions.field.category")}</p>
                <strong>{selectedTx.categoryLabel || t("transactions.none")}</strong>
              </div>

              <div>
                <p className="eyebrow">{t("transactions.field.amount")}</p>
                <strong>{selectedTx.amount}</strong>
              </div>

              <div>
                <p className="eyebrow">{t("transactions.field.tags")}</p>
                <div className="tag-row">
                  {selectedTx.tags?.length ? (
                    selectedTx.tags.map((tag) => (
                      <span
                        key={tag.id || tag.name}
                        className="tag-chip color-pill"
                        style={{
                          "--pill-bg": tag.color || "#1565c0",
                          "--pill-fg": onColor(tag.color || "#1565c0"),
                        }}
                      >
                        <span className="pill-text">{tag.name}</span>
                      </span>
                    ))
                  ) : (
                    <span className="muted">{t("transactions.none")}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="row-actions">
              <button className="ghost" type="button" onClick={() => setSelectedTx(null)}>
                {t("transactions.close")}
              </button>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setEditingTx(selectedTx);
                  setSelectedTx(null);
                }}
              >
                {t("transactions.edit_action")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
