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
  accounts = [],
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
        categoryId: data.category ? (categories.find(c => c.name && data.category && c.name.toLowerCase() === data.category.toLowerCase())?.id || current.categoryId) : current.categoryId,
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
        const sourceLower = String(data.payment_source).toLowerCase();
        const matchedAccount = accounts.find(acc => {
          const accName = String(acc.name || "").toLowerCase();
          return accName.includes(sourceLower) || sourceLower.includes(accName);
        });
        if (matchedAccount) setFundingSourceId(matchedAccount.id);
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
    setOcrState("running");

    try {
      // 1. Always create the bill
      const billPayload = {
        merchant: parsed.merchant,
        total_amount: parseNumberInput(parsed.total),
        vat_amount: parseNumberInput(parsed.vat),
        date: parsed.date,
        category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
        account_id: fundingSourceId ? Number(fundingSourceId) : null,
        bill_number: referenceCode,
        ocr_confidence: confidence.total,
        status: autoCreate ? "confirmed" : "pending",
        notes: parsed.note,
        image_path: parsed.imagePath
      };

      if (typeof onCreateBill !== "function") {
        setError(`Lỗi: Chức năng lưu hóa đơn chưa được khởi tạo (Type: ${typeof onCreateBill}).`);
        setOcrState("idle");
        return;
      }

      await onCreateBill(billPayload);

      // 2. If checked, also create the transaction
      if (autoCreate) {
        if (typeof onCreateTransaction !== "function") {
          setError("Lỗi: Chức năng lưu giao dịch chưa được khởi tạo.");
          setOcrState("idle");
          return;
        }

        const ocrTagId = tagNameMap["hóa đơn ocr"]?.id || tagNameMap["hoa don ocr"]?.id;

        await onCreateTransaction({
          description: `${parsed.merchant || t("ocr.default_desc")}${parsed.note ? " - " + parsed.note : ""}`,
          amount: parseNumberInput(parsed.total),
          transaction_type: txType,
          category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
          account_id: fundingSourceId ? Number(fundingSourceId) : null,
          date: parsed.date,
          tag_ids: [...new Set([...selectedTagIds, ...(ocrTagId ? [ocrTagId] : [])])],
          notes: parsed.note,
          image_path: parsed.imagePath
        });

        setNotice(t("ocr.notice.created_both", null, "Đã tạo cả hóa đơn và giao dịch thành công!"));
      } else {
        setNotice(t("ocr.notice.bill_created", null, "Đã lưu hóa đơn thành công!"));
      }

      if (onNavigate) {
        setTimeout(() => onNavigate("bills"), 1500);
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
    <Shell className={embedded ? "ocr-embedded" : "ocr-layout-wrap"}>
      {!embedded && (
        <div className="ocr-header-pro">
          <div className="ocr-title-area">
            <h2>{t("ocr.title", null, "Nhập hóa đơn (OCR)")}</h2>
            <p>{t("ocr.subtitle", null, "Tự động trích xuất thông tin từ ảnh hóa đơn và cho phép chỉnh sửa trước khi lưu.")}</p>
          </div>
          <div className="ocr-header-actions">
            <button
              type="button"
              className="ocr-btn-outline"
              onClick={handleCreate}
              disabled={!canCreate || loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              {t("ocr.header_save", null, "Tạo giao dịch từ hóa đơn")}
            </button>
            {onClose && (
              <button type="button" className="ocr-close-btn-fixed" onClick={onClose} aria-label="Đóng">×</button>
            )}
            {onNavigate && !onClose && (
              <button type="button" className="ocr-close-btn-fixed" onClick={() => onNavigate("transactions")} aria-label="Đóng">×</button>
            )}
          </div>
        </div>
      )}

      <div className="ocr-grid-pro">
        <div className="ocr-col-left">
          <div className="ocr-card-pro">
            <div className="ocr-upload-nav">
              <button type="button" className="active">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                Tải ảnh lên
              </button>
              <button type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                Camera
              </button>
            </div>

            <label className="ocr-drop-area">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
              <div className="ocr-drop-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              </div>
              <div className="ocr-drop-text">
                <p>Kéo & thả ảnh hóa đơn vào đây</p>
                <span>Hỗ trợ JPG, PNG tối đa 10MB</span>
              </div>
              <button type="button" className="ocr-btn-select" onClick={(e) => e.currentTarget.parentElement.click()}>Chọn ảnh từ máy</button>
            </label>
          </div>

          <div className="ocr-preview-section">
            <h4>Xem trước hóa đơn</h4>
            <div className="ocr-preview-box">
              {previewUrl ? <img src={previewUrl} alt="Receipt" /> : <p className="empty">Xem trước hóa đơn</p>}
            </div>
          </div>

          <div className="ocr-result-box">
            <h4>Kết quả OCR</h4>
            <div className="ocr-res-item">
              <label>Merchant</label>
              <strong>{parsed.merchant || "--"}</strong>
            </div>
            <div className="ocr-res-item">
              <label>Ngày giao dịch</label>
              <strong>{parsed.date || "--"}</strong>
            </div>
            <div className="ocr-res-item">
              <label>Tổng tiền</label>
              <strong>{parsed.total ? currency(parseNumberInput(parsed.total)) : "--"}</strong>
            </div>
            <div className="ocr-res-item">
              <label>Độ tin cậy</label>
              <div className="ocr-conf-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                {Math.round(confidence.total * 100)}%
              </div>
            </div>
            <button className="ocr-btn-retry" type="button" onClick={handleExtract} disabled={ocrState === "running"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L21 10M3 14l2.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              {ocrState === "running" ? "Đang trích xuất..." : "Trích xuất lại OCR"}
            </button>
          </div>
        </div>

        {/* --- RIGHT COLUMN: Form Edit --- */}
        <div className="ocr-col-right">
          <div className="ocr-section-pro">
            <h4 className="ocr-sec-title">1. Thông tin giao dịch</h4>
            <div className="ocr-field-row">
              <div className="ocr-input-field">
                <span>Ngày giao dịch *</span>
                <div className="ocr-input-wrap">
                  <input type="date" value={parsed.date} onChange={e => setParsed(p => ({ ...p, date: e.target.value }))} />
                  <div className="ocr-input-badge" style={{ color: `var(--conf-${getConfClass(confidence.date)})` }}>
                    OCR {Math.round(confidence.date * 100)}%
                  </div>
                </div>
              </div>
              <div className="ocr-input-field">
                <span>Merchant *</span>
                <div className="ocr-input-wrap">
                  <input type="text" value={parsed.merchant} onChange={e => setParsed(p => ({ ...p, merchant: e.target.value }))} />
                  <div className="ocr-input-badge" style={{ color: `var(--conf-${getConfClass(confidence.merchant)})` }}>
                    OCR {Math.round(confidence.merchant * 100)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="ocr-pill-group">
              <span>Loại giao dịch</span>
              <div className="ocr-pill-nav">
                <button type="button" className={txType === "expense" ? "active" : ""} onClick={() => setTxType("expense")}>Chi tiêu</button>
                <button type="button" className={txType === "income" ? "active" : ""} onClick={() => setTxType("income")}>Thu nhập</button>
              </div>
            </div>

            <div className="ocr-pill-group">
              <span>Nguồn tiền *</span>
              <div className="ocr-pill-nav">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    className={fundingSourceId === acc.id ? "active" : ""}
                    onClick={() => setFundingSourceId(acc.id)}
                  >{acc.name}</button>
                ))}
              </div>
            </div>

            <div className="ocr-field-row tri">
              <div className="ocr-input-field">
                <span>Tổng tiền *</span>
                <div className="ocr-input-wrap">
                  <input type="text" value={parsed.total} onChange={e => setParsed(p => ({ ...p, total: formatNumberInput(e.target.value) }))} />
                  <div className="ocr-input-badge" style={{ color: `var(--conf-${getConfClass(confidence.total)})` }}>
                    OCR {Math.round(confidence.total * 100)}%
                  </div>
                </div>
              </div>
              <div className="ocr-input-field">
                <span>VAT</span>
                <div className="ocr-input-wrap">
                  <input type="text" value={parsed.vat} onChange={e => setParsed(p => ({ ...p, vat: formatNumberInput(e.target.value) }))} />
                  <div className="ocr-input-badge" style={{ color: `var(--conf-${getConfClass(confidence.vat)})` }}>
                    OCR {Math.round(confidence.vat * 100)}%
                  </div>
                </div>
              </div>
              <div className="ocr-input-field">
                <span>Giảm giá</span>
                <div className="ocr-input-wrap">
                  <input type="text" value={parsed.discount} onChange={e => setParsed(p => ({ ...p, discount: formatNumberInput(e.target.value) }))} />
                  <div className="ocr-input-badge" style={{ color: `var(--conf-${getConfClass(confidence.discount)})` }}>
                    OCR {Math.round(confidence.discount * 100)}%
                  </div>
                </div>
              </div>
            </div>
            <div className="ocr-input-field" style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Tạm tính</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 18, color: '#475569' }}>{currency(computedSubTotal)}</strong>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Tự động tính</span>
              </div>
            </div>
          </div>

          <div className="ocr-section-pro">
            <h4 className="ocr-sec-title">2. Danh mục</h4>
            <div className="ocr-ai-suggest">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              <span>Gợi ý từ OCR: phù hợp nhất với danh mục <strong>{categories.find(c => String(c.id) === String(parsed.categoryId))?.name || "Ăn uống"}</strong></span>
            </div>
            <div className="ocr-search-bar">
              <svg className="ocr-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input type="text" placeholder="Tìm danh mục..." value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)} />
            </div>
            <div className="ocr-category-grid">
              {filteredCategories.slice(0, 10).map(cat => {
                const active = String(parsed.categoryId) === String(cat.id);
                const meta = getCatMeta(cat.name);
                return (
                  <div
                    key={cat.id}
                    className={`ocr-cat-card ${active ? "active" : ""}`}
                    onClick={() => setParsed(p => ({ ...p, categoryId: String(cat.id) }))}
                    style={active ? { background: meta.light, borderColor: meta.bg } : {}}
                  >
                    <div className="ocr-cat-icon" style={{ background: active ? meta.bg : meta.light, color: active ? "white" : meta.bg }}>
                      <meta.SvgIcon size={16} />
                    </div>
                    <span className="ocr-cat-name" style={active ? { color: meta.bg } : {}}>{cat.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ocr-section-pro">
            <h4 className="ocr-sec-title">3. Chi tiết bổ sung</h4>
            <div className="ocr-field-row">
              <div className="ocr-input-field" style={{ gridColumn: 'span 2' }}>
                <span>Ghi chú</span>
                <div className="ocr-input-wrap">
                  <textarea rows="2" value={parsed.note} onChange={e => setParsed(p => ({ ...p, note: e.target.value }))} placeholder="Ghi chú thêm..." />
                </div>
              </div>
            </div>
            <div className="ocr-field-row">
              <div className="ocr-input-field">
                <span>Số hóa đơn / Mã tham chiếu</span>
                <div className="ocr-input-wrap">
                  <input type="text" value={referenceCode} onChange={e => setReferenceCode(e.target.value)} placeholder="Ví dụ: CK260426..." />
                </div>
              </div>
              <div className="ocr-input-field">
                <span>Đính kèm khác</span>
                <div className="ocr-input-wrap">
                  <button type="button" className="ocr-btn-retry" style={{ margin: 0, padding: '8px 12px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                    Thêm tệp
                  </button>
                </div>
              </div>
            </div>
            <div className="ocr-input-field" style={{ marginTop: 12 }}>
              <span>Thẻ</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {selectedTagIds.map(tid => {
                  const tag = tagMap[tid];
                  if (!tag) return null;
                  return (
                    <span key={tid} className="tag-chip removable color-pill" style={{ "--pill-bg": tag.color, "--pill-fg": onColor(tag.color), display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600 }} onClick={() => removeTag(tid)}>
                      {tag.name} <span className="tag-remove" style={{ marginLeft: 4, opacity: 0.7 }}>×</span>
                    </span>
                  );
                })}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTagByName(tagInput);
                      }
                    }}
                    placeholder="Thêm thẻ..."
                    style={{ fontSize: 13, padding: '4px 12px', borderRadius: 8, border: '1px dashed #cbd5e1', width: 120, background: 'transparent' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="ocr-footer-actions">
            <div className="ocr-toggle-create">
              <label className="ocr-switch">
                <input type="checkbox" checked={autoCreate} onChange={e => setAutoCreate(e.target.checked)} />
                <span className="ocr-slider"></span>
              </label>
              <div>
                <strong>Tạo giao dịch từ hóa đơn</strong>
                <span>Khi bật, hệ thống sẽ tạo giao dịch mới từ thông tin trên.</span>
              </div>
            </div>
            <div className="ocr-footer-btns">
              <button type="button" className="ocr-btn-secondary" onClick={() => {
                setParsed(baseParsedState());
                setConfidence(baseConfidence);
                setFile(null);
                setOcrState("idle");
                setWarnings([]);
                setSelectedTagIds([]);
                setFundingSourceId("");
                setReferenceCode("");
                setPreviewUrl("");
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 6 }}><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L21 10M3 14l2.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                Làm mới
              </button>
              <button type="button" className="ocr-btn-secondary" onClick={handleCreate}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 6 }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                Lưu nháp
              </button>
              <button type="button" className="ocr-btn-primary" onClick={handleCreate} disabled={!canCreate || loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ verticalAlign: 'middle', marginRight: 6 }}><path d="M12 5v14M5 12h14" /></svg>
                {autoCreate ? "Tạo giao dịch từ hóa đơn" : "Lưu hóa đơn"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
