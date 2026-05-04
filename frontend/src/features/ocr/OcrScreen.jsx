import { useEffect, useMemo, useState } from "react";

import { extractOcr } from "../../api/ai.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { colorFor, onColor } from "../../utils/colors.js";
import { t } from "../../utils/i18n.js";
import { CAT_ICONS, getCatMeta } from "../../utils/categoryIcons.jsx";
import "./ocr.css";

const getConfClass = (score) => {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "med";
  return "low";
};

const baseParsedState = () => ({
  date: toInputDate(new Date()),
  merchant: "",
  total: "",
  subtotal: "",
  vat: "",
  discount: "",
  categoryId: "",
  note: "",
  paymentSource: "",
  imagePath: ""
});

const baseConfidence = {
  date: 0,
  merchant: 0,
  total: 0,
  subtotal: 0,
  vat: 0,
  discount: 0,
  paymentSource: 0,
  category: 0,
  tags: 0
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
  onCreateBill,
  onNavigate,
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
    const discount = parseNumberInput(parsed.discount);
    // Formula: subtotal = total - vat + discount
    return Math.max(0, total - vat + discount);
  }, [parsed.total, parsed.vat, parsed.discount]);

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
        const { data, confidence: conf } = result;
        
        setParsed((current) => ({
          ...current,
          merchant: (data.merchant || "").trim() || current.merchant || sanitizeName(file.name),
          total: toFormattedNumber(data.final_total, current.total),
          subtotal: toFormattedNumber(data.subtotal_before_tax, current.subtotal),
          vat: toFormattedNumber(data.vat_amount, current.vat),
          discount: toFormattedNumber(data.discount_amount, current.discount),
          note: data.suggested_note || current.note,
          date: data.transaction_date || current.date,
          categoryId: data.category ? (categories.find(c => c.name.toLowerCase() === data.category.toLowerCase())?.id || current.categoryId) : current.categoryId,
          paymentSource: data.payment_source || current.paymentSource,
          imagePath: data.image_path || ""
        }));

        setConfidence({
          date: conf.transaction_date || 0,
          merchant: conf.merchant || 0,
          total: conf.final_total || 0,
          subtotal: conf.subtotal_before_tax || 0,
          vat: conf.vat_amount || 0,
          discount: conf.discount_amount || 0,
          paymentSource: conf.payment_source || 0,
          category: conf.category || 0,
          tags: conf.tags || 0
        });

        if (data.tags && data.tags.length) {
          const foundIds = data.tags
            .map(tName => tagNameMap[tName.toLowerCase()]?.id)
            .filter(Boolean);
          setSelectedTagIds(prev => [...new Set([...prev, ...foundIds])]);
        }

        if (data.payment_source) {
          const sourceTag = paymentTagCandidates.find(t => 
            t.name.toLowerCase().includes(data.payment_source.toLowerCase()) ||
            data.payment_source.toLowerCase().includes(t.name.toLowerCase())
          );
          if (sourceTag) setFundingSourceId(sourceTag.id);
        }

        setWarnings(result.warnings || []);
        setNotice(t("ocr.notice.extracted", null, "OCR hoàn tất! Hệ thống đã trích xuất được thông tin. Vui lòng kiểm tra và bấm Lưu."));
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

      if (autoCreate) {
        await onCreateTransaction({
          description: descriptionParts,
          amount: parseNumberInput(parsed.total),
          transaction_type: txType,
          category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
          account_id: parsed.accountId ? Number(parsed.accountId) : null,
          date: parsed.date,
          tag_ids: [...new Set([...(fundingSourceId ? [fundingSourceId] : []), ...selectedTagIds, ...(ocrTagId ? [ocrTagId] : [])])],
          ocr_confidence: confidence.total,
          notes: parsed.note,
          image_path: parsed.imagePath
        });
        setNotice(t("ocr.notice.created", null, "Đã tạo giao dịch thành công!"));
      } else {
        console.log("DEBUG: onCreateBill prop is:", onCreateBill);
        if (typeof onCreateBill !== "function") {
          setError(`Lỗi: Chức năng lưu hóa đơn chưa được khởi tạo (Type: ${typeof onCreateBill}).`);
          return;
        }
        await onCreateBill({
          merchant: parsed.merchant,
          total_amount: parseNumberInput(parsed.total),
          vat_amount: parseNumberInput(parsed.vat),
          date: parsed.date,
          category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
          account_id: parsed.accountId ? Number(parsed.accountId) : null,
          bill_number: referenceCode,
          ocr_confidence: confidence.total,
          status: "pending",
          notes: parsed.note,
          image_path: parsed.imagePath
        });
        setNotice(t("ocr.notice.bill_created", null, "Đã lưu hóa đơn thành công!"));
        if (onNavigate) {
          setTimeout(() => onNavigate("bills"), 500);
        }
      }

      if (autoCreate && onNavigate) {
         setTimeout(() => onNavigate("transactions"), 500);
      }

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

      <div className={`receipt-grid ocr-layout ${ocrState === "running" ? "running" : ""}`}>
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

          <div className="receipt-preview preview-container">
            <div className="scanner-line"></div>
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
            <label className="field-pro">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Ngày giao dịch *</span>
                <div className="confidence-text" style={{ color: `var(--conf-${getConfClass(confidence.date)})`, position: 'static' }}>
                  {Math.round(confidence.date * 100)}% Tin cậy
                </div>
              </div>
              <div className="input-wrapper-pro">
                <input
                  type="date"
                  className="input-pro"
                  value={parsed.date}
                  onChange={(event) =>
                    setParsed((current) => ({ ...current, date: event.target.value }))
                  }
                  required
                />
              </div>
            </label>

            <label className="field-pro">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Merchant *</span>
                <div className="confidence-text" style={{ color: `var(--conf-${getConfClass(confidence.merchant)})`, position: 'static' }}>
                  {Math.round(confidence.merchant * 100)}% Tin cậy
                </div>
              </div>
              <div className="input-wrapper-pro">
                <input
                  type="text"
                  className="input-pro"
                  value={parsed.merchant}
                  onChange={(event) =>
                    setParsed((current) => ({ ...current, merchant: event.target.value }))
                  }
                  placeholder="Ví dụ: Circle K"
                />
              </div>
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
            <label className="field-pro">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Tổng tiền *</span>
                <div className="confidence-text" style={{ color: `var(--conf-${getConfClass(confidence.total)})`, position: 'static' }}>
                  {Math.round(confidence.total * 100)}% Tin cậy
                </div>
              </div>
              <div className="input-wrapper-pro">
                <input
                  type="text"
                  className="input-pro"
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
              </div>
              <small style={{ color: 'var(--muted)', textAlign: 'right', display: 'block' }}>
                {parsed.total ? currency(parseNumberInput(parsed.total)) : "--"}
              </small>
            </label>

            <label className="field-pro">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>VAT</span>
                <div className="confidence-text" style={{ color: `var(--conf-${getConfClass(confidence.vat)})`, position: 'static' }}>
                  {Math.round(confidence.vat * 100)}% Tin cậy
                </div>
              </div>
              <div className="input-wrapper-pro">
                <input
                  type="text"
                  className="input-pro"
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
              </div>
            </label>
            <label className="field-pro">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Giảm giá</span>
                <div className="confidence-text" style={{ color: `var(--conf-${getConfClass(confidence.discount)})`, position: 'static' }}>
                  {Math.round(confidence.discount * 100)}% Tin cậy
                </div>
              </div>
              <div className="input-wrapper-pro">
                <input
                  type="text"
                  className="input-pro"
                  inputMode="numeric"
                  value={parsed.discount}
                  onChange={(event) =>
                    setParsed((current) => ({
                      ...current,
                      discount: formatNumberInput(event.target.value)
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </label>
          </div>

          <div className="confidence-legend">
            <div className="legend-item">
              <span className="dot high"></span> &gt;90% Tin cậy cao
            </div>
            <div className="legend-item">
              <span className="dot med"></span> 70-89% Khá tin cậy
            </div>
            <div className="legend-item">
              <span className="dot low"></span> &lt;70% Cần kiểm tra
            </div>
          </div>

          <label className="field">
            <span>Tiền hàng (trước VAT)</span>
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
          {/* Removed Invoice Number and Attachments as per user request */}

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
                setOcrState("idle");
              }}
            >
              Làm lại
            </button>
            <button 
              className="primary" 
              type="submit" 
              style={{ flex: 1 }} 
              disabled={ocrState === "running" || loading}
              onClick={() => {
                if (!canCreate) {
                  setError("Vui lòng nhập đầy đủ Tổng tiền và Ngày hóa đơn.");
                }
              }}
            >
              {loading ? "Đang xử lý..." : autoCreate ? "Xác nhận & Lưu Giao Dịch" : "Lưu vào Hóa đơn"}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
