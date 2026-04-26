import { useEffect, useMemo, useState } from "react";

import { extractOcr } from "../../api/ai.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { colorFor, onColor } from "../../utils/colors.js";
import { t } from "../../utils/i18n.js";
import { CAT_ICONS, getCatMeta } from "../../utils/categoryIcons.jsx";

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
const hexWithAlpha = (hex, alpha) => {
  const value = String(hex || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return value || "#94a3b8";
  return `${value}${alpha}`;
};

const getOcrCategoryTheme = (name, fallbackColor) => {
  if (CAT_ICONS[name]) {
    const meta = getCatMeta(name);
    return { meta, bg: meta.light, fg: meta.bg, dot: meta.bg };
  }
  const color = fallbackColor || "#94a3b8";
  const meta = { ...getCatMeta(name), bg: color, light: hexWithAlpha(color, "1A") };
  return { meta, bg: meta.light, fg: meta.bg, dot: meta.bg };
};

export default function OcrScreen({
  categories,
  tags = [],
  userEmail,
  onCreateCategory,
  onCreateTag,
  onCreateTransaction,
  loading,
  embedded = false,
  onClose
}) {
  const paymentTagCandidates = useMemo(
    () =>
      tags.filter((tag) => {
        const value = String(tag.name || "").toLowerCase();
        return (
          value.includes("tiền mặt") ||
          value.includes("ngân hàng") ||
          value.includes("ví") ||
          value.includes("momo")
        );
      }),
    [tags]
  );
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
  const [txType, setTxType] = useState("expense");
  const [fundingSourceId, setFundingSourceId] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [autoCreate, setAutoCreate] = useState(true);

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
  const computedSubTotal = useMemo(() => {
    const total = parseNumberInput(parsed.total);
    const vat = parseNumberInput(parsed.vat);
    const discount = parseNumberInput(parsed.estimated);
    return Math.max(0, total + vat - discount);
  }, [parsed.total, parsed.vat, parsed.estimated]);

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
      setParsed((current) => ({
        ...current,
        merchant: result.merchant || current.merchant || sanitizeName(file.name) || t("ocr.merchant_guess"),
        total: toFormattedNumber(result.total, current.total),
        vat: toFormattedNumber(result.vat, current.vat),
        estimated: toFormattedNumber(result.estimated, current.estimated),
        note: result.note || (result.text ? `OCR: ${result.text.slice(0, 200)}` : current.note),
        date: result.date || current.date
      }));
      setConfidence({
        date: result.date ? 0.8 : 0.3,
        merchant: result.merchant ? 0.8 : 0.3,
        total: result.total ? 0.9 : 0.3,
        vat: result.vat ? 0.7 : 0.2,
        estimated: result.estimated ? 0.6 : 0.2
      });
      setWarnings(result.warnings || []);
      setNotice(t("ocr.notice.extracted", null, "OCR done. Review and confirm before creating transaction."));
      setOcrState("done");
    } catch (err) {
      setError(err.message || t("ocr.error.extract_failed", null, "OCR failed."));
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

    const descriptionParts = [
      parsed.merchant || t("ocr.default_desc"),
      referenceCode ? `Ref:${referenceCode}` : "",
      parsed.note
    ]
      .filter(Boolean)
      .join(" - ");

    try {
      let ocrTagId = tagNameMap["hóa đơn ocr"]?.id || tagNameMap["hoa don ocr"]?.id;
      if (!ocrTagId && onCreateTag) {
        const createdOcrTag = await onCreateTag({ name: "Hóa đơn OCR", color: "#ec4899" });
        ocrTagId = createdOcrTag?.id;
      }
      await onCreateTransaction({
        description: descriptionParts,
        amount: parseNumberInput(parsed.total),
        transaction_type: txType,
        category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
        date: parsed.date,
        tag_ids: [...new Set([...(fundingSourceId ? [fundingSourceId] : []), ...selectedTagIds, ...(ocrTagId ? [ocrTagId] : [])])]
      });
      setNotice(t("ocr.notice.created", null, "Transaction created from OCR."));
      setParsed(baseParsedState());
      setConfidence(baseConfidence);
      setFile(null);
      setOcrState("idle");
      setWarnings([]);
      setSelectedTagIds([]);
      setFundingSourceId("");
      setTxType("expense");
      setTagInput("");
      setReferenceCode("");
      setAutoCreate(true);
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
  const filteredCategories = useMemo(() => {
    const q = String(categoryQuery || "").trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => String(c.name || "").toLowerCase().includes(q));
  }, [categories, categoryQuery]);
  const handleQuickCreateCategory = async () => {
    const value = String(newCategoryName || "").trim();
    if (!value || !onCreateCategory) return;
    await onCreateCategory(value);
    setShowAddCategory(false);
    setNewCategoryName("");
  };

  const Shell = embedded ? "div" : "section";

  return (
    <Shell className={embedded ? "ocr-embedded" : "panel"}>
      {!embedded && (
        <div className="panel-header">
          <h3>{t("ocr.title", null, "Receipt OCR")}</h3>
          {onClose && (
            <button type="button" className="ocr-close-btn" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          )}
        </div>
      )}

      <div className="receipt-grid ocr-layout">
        <div className="receipt-uploader ocr-left-col">
          <div className="ocr-upload-switch">
            <button type="button" className="active">Tải ảnh lên</button>
            <button type="button">Camera</button>
          </div>
          <label className="field ocr-dropzone">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <div>
              <p>Kéo & thả ảnh hóa đơn hoặc chọn tệp</p>
              <span>Ảnh JPG/PNG, rõ nét để OCR chính xác hơn</span>
            </div>
          </label>

          <button className="ghost ocr-extract-btn" type="button" onClick={handleExtract}>
            {ocrState === "running" ? "Đang trích xuất OCR..." : "Trích xuất lại OCR"}
          </button>

          <div className="receipt-preview">
            {previewUrl ? <img src={previewUrl} alt="Receipt preview" /> : <p className="empty">Xem trước hóa đơn</p>}
          </div>

          <div className="ocr-result-card">
            <h4>Kết quả OCR</h4>
            <div className="ocr-result-grid">
              <span>Merchant</span>
              <strong>{parsed.merchant || "--"}</strong>
              <span>Ngày giao dịch</span>
              <strong>{parsed.date || "--"}</strong>
              <span>Tổng tiền</span>
              <strong>{parsed.total ? currency(parseNumberInput(parsed.total)) : "--"}</strong>
              <span>Độ tin cậy</span>
              <strong>{Math.round(confidence.total * 100)}%</strong>
            </div>
          </div>
        </div>

        <form className="form ocr-form-panel ocr-form-modern" onSubmit={handleCreate}>
          <h4>1. Thông tin giao dịch</h4>
          <div className="row">
            <label className="field">
              <span>Ngày giao dịch *</span>
              <input
                type="date"
                value={parsed.date}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, date: event.target.value }))
                }
                required
              />
            </label>

            <label className="field">
              <span>Merchant *</span>
              <input
                type="text"
                value={parsed.merchant}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, merchant: event.target.value }))
                }
                placeholder="Ví dụ: Circle K"
              />
            </label>
          </div>

          <div className="ocr-pill-row">
            <span>Loại giao dịch</span>
            <div className="ocr-inline-pills">
              <button type="button" className={txType === "expense" ? "active" : ""} onClick={() => setTxType("expense")}>Chi tiêu</button>
              <button type="button" className={txType === "income" ? "active" : ""} onClick={() => setTxType("income")}>Thu nhập</button>
            </div>
          </div>

          {!!paymentTagCandidates.length && (
            <div className="ocr-pill-row">
              <span>Nguồn tiền *</span>
              <div className="ocr-inline-pills wrap">
                {paymentTagCandidates.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={fundingSourceId === tag.id ? "active" : ""}
                    onClick={() => setFundingSourceId(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="row">
            <label className="field">
              <span>Tổng tiền *</span>
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
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>Giảm giá</span>
              <input
                type="text"
                inputMode="numeric"
                value={parsed.estimated}
                onChange={(event) =>
                  setParsed((current) => ({
                    ...current,
                    estimated: formatNumberInput(event.target.value)
                  }))
                }
                placeholder="0"
              />
            </label>
          </div>

          <label className="field">
            <span>Tạm tính</span>
            <input type="text" value={currency(computedSubTotal)} readOnly />
          </label>

          <h4 className="ocr-section-title ocr-section-inline">
            <span>2. Danh mục</span>
            <button
              type="button"
              className="ghost ocr-add-category-btn"
              onClick={() => setShowAddCategory((s) => !s)}
            >
              + Thêm danh mục
            </button>
          </h4>
          {showAddCategory && (
            <div className="ocr-inline-create">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nhập tên danh mục mới..."
              />
              <button type="button" className="primary" onClick={handleQuickCreateCategory}>
                Lưu
              </button>
            </div>
          )}
          <label className="field">
            <span>Chọn danh mục</span>
            <input
              type="text"
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              placeholder="Tìm danh mục..."
            />
            <div className="category-picker">
              <button
                type="button"
                className={`category-pill ${!parsed.categoryId ? "selected" : ""}`}
                onClick={() => setParsed((current) => ({ ...current, categoryId: "" }))}
                aria-pressed={!parsed.categoryId}
              >
                {t("transactions.none", null, "Không")}
              </button>
              {filteredCategories.map((category) => {
                const bg = colorFor(category.name, userEmail);
                const selected = String(parsed.categoryId) === String(category.id);
                const theme = getOcrCategoryTheme(category.name, bg);
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`category-pill ocr-category-pill ${selected ? "selected" : ""}`}
                    onClick={() => setParsed((current) => ({ ...current, categoryId: String(category.id) }))}
                    aria-pressed={selected}
                    style={{ "--pill-bg": theme.bg, "--pill-fg": theme.fg, "--pill-dot": theme.dot }}
                  >
                    <span className="pill-icon" aria-hidden="true">
                      <theme.meta.SvgIcon size={14} />
                    </span>
                    <span className="pill-text">{category.name}</span>
                  </button>
                );
              })}
            </div>
          </label>

          <h4 className="ocr-section-title">3. Chi tiết bổ sung</h4>
          <label className="field">
            <span>Ghi chú</span>
            <textarea
              rows="3"
              value={parsed.note}
              onChange={(event) =>
                setParsed((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="OCR map fields, bạn có thể chỉnh sửa trước khi lưu."
            />
          </label>
          <div className="row">
            <label className="field">
              <span>Số hóa đơn / Mã tham chiếu</span>
              <input
                type="text"
                value={referenceCode}
                onChange={(event) => setReferenceCode(event.target.value)}
                placeholder="Ví dụ: CK260426-00123"
              />
            </label>
            <label className="field">
              <span>Đính kèm khác</span>
              <button type="button" className="ghost ocr-attach-btn">+ Đính kèm tệp</button>
            </label>
          </div>

          <div className="tag-section ocr-tag-section">
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

          <label className="ocr-auto-create">
            <input
              type="checkbox"
              checked={autoCreate}
              onChange={(event) => setAutoCreate(event.target.checked)}
            />
            <div>
              <strong>Tạo giao dịch từ hóa đơn</strong>
              <span>Dữ liệu trích xuất có thể chỉnh sửa trước khi lưu giao dịch.</span>
            </div>
          </label>

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
                setFundingSourceId("");
                setTxType("expense");
                setTagInput("");
                setReferenceCode("");
                setAutoCreate(true);
              }}
            >
              Làm mới
            </button>
            <button className="primary" type="submit" disabled={!canCreate || loading || !autoCreate}>
              Tạo giao dịch từ hóa đơn
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
