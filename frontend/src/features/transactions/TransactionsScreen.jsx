import { useEffect, useMemo, useRef, useState } from "react";
import TransactionRow from "../../components/TransactionRow.jsx";
import CategoriesScreen from "../categories/CategoriesScreen.jsx";
import TagsScreen from "../tags/TagsScreen.jsx";
import OcrScreen from "../ocr/OcrScreen.jsx";
import { formatNumberInput, parseNumberInput, toInputDate, currency } from "../../utils/format.js";
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
  const [showOcr, setShowOcr] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [editTagIds, setEditTagIds] = useState([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const [showCategories, setShowCategories] = useState(true);
  const [showTags, setShowTags] = useState(true);

  const [amountValue, setAmountValue] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  const categoryRef = useRef(null);
  const tagRef = useRef(null);
  const ocrRef = useRef(null);
  const formRef = useRef(null);

  const filteredTransactions = useMemo(() => {
    const parsedAmount = parseNumberInput(amountValue);

    return transactions.filter((item) => {
      const amount = Number(item.amount || 0);
      const matchAmount = !amountValue || amount >= parsedAmount;

      const matchType = !filters.type || item.transaction_type === filters.type;
      const matchCategory =
        !filters.categoryId || String(item.category_id) === String(filters.categoryId);

      return matchAmount && matchType && matchCategory;
    });
  }, [transactions, amountValue, filters.type, filters.categoryId]);

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

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

    const parsedAmount = parseNumberInput(amountValue);
    if (!parsedAmount || parsedAmount <= 0) return;

    const form = new FormData(event.currentTarget);
    const category = filters.categoryId || form.get("category_id");
    const transactionType = filters.type || form.get("transaction_type");

    if (!transactionType) return;

    onCreate({
      description: form.get("description"),
      amount: parsedAmount,
      transaction_type: transactionType,
      category_id: category ? Number(category) : null,
      date: form.get("date"),
      tag_ids: selectedTagIds,
    });

    event.currentTarget.reset();
    setAmountValue("");
    setSelectedTagIds([]);
    setTagInput("");
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

  const scrollToRef = (ref) => {
    if (!ref?.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scheduleScroll = (ref) => setTimeout(() => scrollToRef(ref), 80);

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
            onClick={() => {
              setShowCategories(true);
              scheduleScroll(categoryRef);
            }}
          >
            {t("categories.title")}
          </button>

          <button
            className="ghost"
            type="button"
            onClick={() => {
              setShowTags(true);
              scheduleScroll(tagRef);
            }}
          >
            {t("tags.title")}
          </button>

          <button
            className="ghost"
            type="button"
            onClick={() =>
              setShowOcr((current) => {
                const next = !current;
                if (!current) scheduleScroll(ocrRef);
                return next;
              })
            }
          >
            {showOcr ? t("transactions.ocr_toggle_hide") : t("transactions.ocr_toggle_show")}
          </button>

          <button
            className="ghost"
            type="button"
            onClick={() =>
              setShowAddForm((current) => {
                const next = !current;
                if (!current) scheduleScroll(formRef);
                return next;
              })
            }
          >
            {showAddForm ? t("transactions.form_toggle_hide") : t("transactions.form_toggle_show")}
          </button>

          <button className="ghost" onClick={onBack} type="button">
            {t("common.back")}
          </button>
        </div>
      </header>

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

      {showOcr && (
        <div className="transactions-content-card" ref={ocrRef}>
          <OcrScreen
            categories={categories}
            onCreateTransaction={onCreateTransaction}
            loading={loading}
          />
        </div>
      )}

      <div className="transactions-content-card" ref={formRef}>
        <div className="filters compact">
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
            <label>{t("transactions.field.amount")}</label>
            <input
              type="text"
              inputMode="numeric"
              min="0"
              value={amountValue}
              onChange={(event) => setAmountValue(formatNumberInput(event.target.value))}
            />
          </div>
        </div>

        <button className="ghost" type="button" onClick={handleExportCsv}>
          Xuất CSV
        </button>

        {showAddForm && (
          <form className="form" onSubmit={handleCreate}>
            <input
              name="description"
              type="text"
              placeholder={t("transactions.field.desc")}
              required
            />

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
                    placeholder={t(
                      "transactions.tags.placeholder",
                      null,
                      "Nhập nhãn và nhấn Enter"
                    )}
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
                        className={`tag-option ${active ? "active" : ""}`}
                        onClick={() => toggleSuggestedTag(tag.id)}
                      >
                        <span className="dot" style={{ background: tag.color }} />
                        <span>{tag.name}</span>
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
                        className="tag-chip removable"
                        onClick={() => removeTag(tagId)}
                      >
                        <span className="dot" style={{ background: tag.color }} />
                        <span>{tag.name}</span>
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

            <div className="row">
              <input name="date" type="date" required />
            </div>

            <button className="primary" type="submit" disabled={loading}>
              {t("transactions.add.submit")}
            </button>
          </form>
        )}

        <div className="row-actions" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <button
              className="ghost danger"
              type="button"
              disabled={!selectedIds.length}
              onClick={handleBulkDelete}
            >
              {t("transactions.bulk_delete")} ({selectedIds.length})
            </button>
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
              <div key={item.id} className="item-row">
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelection(item.id)}
                  />
                  <span className="eyebrow">{t("transactions.select", null, "Chọn")}</span>
                </label>

                <TransactionRow item={item} categoryLabel={item.categoryLabel} />

                <div className="row-actions">
                  <button className="ghost" type="button" onClick={() => setSelectedTx(item)}>
                    {t("transactions.detail")}
                  </button>

                  <button className="ghost" onClick={() => setEditingTx(item)} type="button">
                    {t("transactions.edit")}
                  </button>

                  <button className="ghost danger" onClick={() => onDelete(item.id)} type="button">
                    {t("transactions.delete")}
                  </button>
                </div>
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
                          className={`tag-option ${active ? "active" : ""}`}
                          onClick={() => toggleEditSuggestedTag(tag.id)}
                        >
                          <span className="dot" style={{ background: tag.color }} />
                          <span>{tag.name}</span>
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
                          className="tag-chip removable"
                          onClick={() => removeEditTag(tagId)}
                        >
                          <span className="dot" style={{ background: tag.color }} />
                          <span>{tag.name}</span>
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
                      <span key={tag.id || tag.name} className="tag-chip">
                        <span
                          className="dot"
                          style={{ background: tag.color || "var(--primary)" }}
                        />
                        {tag.name}
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
