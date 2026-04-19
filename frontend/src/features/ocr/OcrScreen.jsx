import { useEffect, useMemo, useState } from "react";

import { extractOcr } from "../../api/ai.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { colorFor, onColor } from "../../utils/colors.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";

const baseParsedState = () => ({
  date: toInputDate(new Date()),
  merchant: "",
  total: "",
  vat: "",
  estimated: "",
  categoryId: "",
  note: ""
});

const baseConfidence = {
  date: 0,
  merchant: 0,
  total: 0,
  vat: 0,
  estimated: 0
};

const sanitizeName = (name) =>
  name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

const toFormattedNumber = (value, fallback = "") => {
  if (value === null || value === undefined || value === "") return fallback;
  return formatNumberInput(String(value));
};

const normalizeTag = (value) => String(value || "").trim().replace(/^#/, "");
const normalizeCategoryKey = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export default function OcrScreen({
  categories,
  tags = [],
  userEmail,
  onCreateTag,
  onCreateTransaction,
  loading,
  embedded = false
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsed, setParsed] = useState(baseParsedState);
  const [confidence, setConfidence] = useState(baseConfidence);
  const [ocrState, setOcrState] = useState("idle");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [tagInput, setTagInput] = useState("");

  const categoryPrefs = useMemo(() => getCategoryPrefs(userEmail), [userEmail]);

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
      if (tag?.name) map[tag.name.toLowerCase()] = tag;
    });
    return map;
  }, [tags]);

  const categoryNameMap = useMemo(() => {
    const map = {};
    categories.forEach((category) => {
      map[normalizeCategoryKey(category.name)] = category;
    });
    return map;
  }, [categories]);

  useEffect(() => {
    setSelectedTagIds((current) => current.filter((id) => tagMap[id]));
  }, [tagMap]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const canCreate = useMemo(
    () => parseNumberInput(parsed.total) > 0 && Boolean(parsed.date),
    [parsed.total, parsed.date]
  );

  const handleExtract = async () => {
    if (!file) {
      setError(t("ocr.error.no_file", null, "Please select a receipt image first."));
      return;
    }

    setError("");
    setNotice("");
    setOcrState("running");

    try {
      const result = await extractOcr(file);
      const parsedResult = result?.parsed || result || {};
      const rawText = result?.raw_text || result?.text || "";
      const suggestedCategory = parsedResult.suggested_category || "";
      const suggestedCategoryId = suggestedCategory
        ? categoryNameMap[normalizeCategoryKey(suggestedCategory)]?.id || ""
        : "";
      setParsed((current) => ({
        ...current,
        merchant:
          parsedResult.merchant || current.merchant || sanitizeName(file.name) || t("ocr.merchant_guess"),
        total: parsedResult.total == null ? "" : toFormattedNumber(parsedResult.total, current.total),
        vat: parsedResult.vat == null ? "" : toFormattedNumber(parsedResult.vat, current.vat),
        estimated: parsedResult.estimated == null ? "" : toFormattedNumber(parsedResult.estimated, current.estimated),
        note: parsedResult.note || (rawText ? `OCR: ${rawText.slice(0, 200)}` : current.note),
        date: parsedResult.date || current.date,
        categoryId: suggestedCategoryId || current.categoryId
      }));
      setConfidence({
        date: parsedResult.date_confidence ?? (parsedResult.date ? 0.8 : 0.3),
        merchant: parsedResult.merchant_confidence ?? (parsedResult.merchant ? 0.8 : 0.3),
        total: parsedResult.total_confidence ?? (parsedResult.total ? 0.9 : 0.3),
        vat: parsedResult.vat_confidence ?? (parsedResult.vat ? 0.7 : 0.2),
        estimated: parsedResult.estimated_confidence ?? (parsedResult.estimated ? 0.6 : 0.2)
      });
      const nextWarnings = [...(result.warnings || [])];
      if (result.provider) {
        nextWarnings.unshift(
          `OCR provider: ${result.provider}${result.fallback_used ? " (fallback Tesseract)" : ""}.`
        );
      }
      if (suggestedCategory && !suggestedCategoryId) {
        nextWarnings.push(`Gợi ý danh mục: "${suggestedCategory}" chưa khớp với danh mục hiện có.`);
      }
      setWarnings(nextWarnings);
      const confidencePct = Math.round((result.ocr_confidence || 0) * 100);
      setNotice(
        `${t("ocr.notice.extracted", null, "OCR done. Review and confirm before creating transaction.")} (${confidencePct}%)`
      );
      setOcrState("done");
    } catch (err) {
      setError(err.message || t("ocr.error.extract_failed", null, "OCR failed."));
      if (err.code) {
        setWarnings([
          `Error code: ${err.code}${err.trace_id ? ` (trace: ${err.trace_id})` : ""}.`,
          ...(err.details ? [JSON.stringify(err.details)] : [])
        ]);
      }
      setOcrState("idle");
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canCreate) {
      setError(t("ocr.error.missing", null, "Missing required data: date and total amount."));
      return;
    }

    setError("");
    setNotice("");

    const descriptionParts = [parsed.merchant || t("ocr.default_desc"), parsed.note]
      .filter(Boolean)
      .join(" - ");

    try {
      await onCreateTransaction({
        description: descriptionParts,
        amount: parseNumberInput(parsed.total),
        transaction_type: "expense",
        category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
        date: parsed.date,
        tag_ids: selectedTagIds
      });
      setNotice(t("ocr.notice.created", null, "Transaction created from OCR."));
      setParsed(baseParsedState());
      setConfidence(baseConfidence);
      setFile(null);
      setOcrState("idle");
      setWarnings([]);
      setSelectedTagIds([]);
      setTagInput("");
    } catch {
      setError(t("ocr.error.create_failed", null, "Failed to create transaction from OCR."));
    }
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

  const toggleSuggestedTag = (tagId) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };

  const removeTag = (tagId) => setSelectedTagIds((current) => current.filter((id) => id !== tagId));

  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={embedded ? "ocr-embedded" : "panel"}>
      {!embedded && (
        <div className="panel-header">
          <h3>{t("ocr.title", null, "Receipt OCR")}</h3>
        </div>
      )}

      <div className="receipt-grid">
        <div className="receipt-uploader">
          <label className="field">
            <span>{t("ocr.form.image", null, "Receipt image")}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <button className="ghost" type="button" onClick={handleExtract}>
            {ocrState === "running"
              ? t("ocr.action.running", null, "Processing...")
              : t("ocr.action.extract", null, "Run OCR")}
          </button>

          <div className="receipt-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Receipt preview" />
            ) : (
              <p className="empty">{t("ocr.empty", null, "No image selected.")}</p>
            )}
          </div>
        </div>

        <form className="form" onSubmit={handleCreate}>
          <div className="row">
            <label className="field">
              <span>{t("ocr.form.date", null, "Date")}</span>
              <input
                type="date"
                value={parsed.date}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, date: event.target.value }))
                }
                required
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.date * 100) }, `Confidence: ${
                  Math.round(confidence.date * 100)
                }%`)}
              </small>
            </label>

            <label className="field">
              <span>{t("ocr.form.merchant", null, "Merchant")}</span>
              <input
                type="text"
                value={parsed.merchant}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, merchant: event.target.value }))
                }
                placeholder={t("ocr.form.merchant_placeholder", null, "Example: Circle K")}
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.merchant * 100) }, `Confidence: ${
                  Math.round(confidence.merchant * 100)
                }%`)}
              </small>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span>{t("ocr.form.total", null, "Total")}</span>
              <input
                type="text"
                inputMode="numeric"
                value={parsed.total}
                onChange={(event) =>
                  setParsed((current) => ({
                    ...current,
                    total: formatNumberInput(event.target.value)
                  }))
                }
                placeholder="0"
                required
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.total * 100) }, `Confidence: ${
                  Math.round(confidence.total * 100)
                }%`)}
              </small>
            </label>

            <label className="field">
              <span>VAT</span>
              <input
                type="text"
                inputMode="numeric"
                value={parsed.vat}
                onChange={(event) =>
                  setParsed((current) => ({
                    ...current,
                    vat: formatNumberInput(event.target.value)
                  }))
                }
                placeholder="--"
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.vat * 100) }, `Confidence: ${
                  Math.round(confidence.vat * 100)
                }%`)}
              </small>
            </label>
          </div>

          <label className="field">
            <span>{t("ocr.form.category", null, "Category")}</span>
            <div className="category-picker">
              <button
                type="button"
                className={`category-pill ${!parsed.categoryId ? "selected" : ""}`}
                onClick={() => setParsed((current) => ({ ...current, categoryId: "" }))}
                aria-pressed={!parsed.categoryId}
              >
                {t("transactions.none", null, "Không")}
              </button>
              {categories.map((category) => {
                const bg = colorFor(category.name, userEmail);
                const selected = String(parsed.categoryId) === String(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`category-pill color-pill ${selected ? "selected" : ""}`}
                    onClick={() => setParsed((current) => ({ ...current, categoryId: String(category.id) }))}
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

          <div className="row">
            <label className="field">
              <span>{t("ocr.form.preview_total", null, "Preview total")}</span>
              <input
                type="text"
                value={parsed.total ? currency(parseNumberInput(parsed.total)) : "--"}
                readOnly
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.estimated * 100) }, `Confidence: ${
                  Math.round(confidence.estimated * 100)
                }%`)}
              </small>
            </label>
          </div>

          <label className="field">
            <span>{t("ocr.form.note", null, "Notes")}</span>
            <textarea
              rows="3"
              value={parsed.note}
              onChange={(event) =>
                setParsed((current) => ({ ...current, note: event.target.value }))
              }
              placeholder={t("ocr.form.note_placeholder", null, "OCR text summary or custom note")}
            />
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

          {warnings.length > 0 && <p className="form-error">{warnings.join(" ")}</p>}
          {notice && <p className="form-note">{notice}</p>}
          {error && <p className="form-error">{error}</p>}

          <div className="row-actions">
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setFile(null);
                setParsed(baseParsedState());
                setConfidence(baseConfidence);
                setNotice("");
                setError("");
                setWarnings([]);
                setSelectedTagIds([]);
                setTagInput("");
              }}
            >
              {t("ocr.action.reset", null, "Reset")}
            </button>
            <button className="primary" type="submit" disabled={!canCreate || loading}>
              {t("ocr.action.create", null, "Create transaction")}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
