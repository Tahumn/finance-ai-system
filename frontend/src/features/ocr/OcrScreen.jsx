import { useEffect, useMemo, useState, useRef } from "react";
import { extractOcr } from "../../api/ai.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { colorFor, onColor } from "../../utils/colors.js";
import { getCategoryPrefs } from "../../utils/userPrefs.js";
import { t } from "../../utils/i18n.js";
import "./ocr.css";

const baseParsedState = () => ({
  date: toInputDate(new Date()),
  merchant: "",
  total: "",
  subtotal: "",
  vat: "",
  categoryId: "",
  note: ""
});

const baseConfidence = {
  date: 0,
  merchant: 0,
  total: 0,
  subtotal: 0,
  vat: 0
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

export default function OcrScreen({
  categories,
  tags = [],
  userEmail,
  onCreateTag,
  onCreateTransaction,
  onSuccess,
  loading,
  embedded = false
}) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsed, setParsed] = useState(baseParsedState);
  const [confidence, setConfidence] = useState(baseConfidence);
  const [ocrState, setOcrState] = useState("idle");
  const [isDragging, setIsDragging] = useState(false);
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
      setError(t("ocr.error.no_file", null, "Vui lòng chọn hoặc kéo thả ảnh hóa đơn trước."));
      return;
    }

    setError("");
    setNotice("");
    setOcrState("running");

    try {
      const result = await extractOcr(file);
      setParsed((current) => ({
        ...current,
        merchant: result.merchant || current.merchant || t("ocr.merchant_guess"),
        total: result.total ? formatNumberInput(String(result.total)) : current.total,
        subtotal: result.estimated ? formatNumberInput(String(result.estimated)) : "",
        vat: result.vat ? formatNumberInput(String(result.vat)) : "",
        note: result.note || current.note,
        date: result.date || current.date,
        categoryId: result.category ? (categories.find(c => c.name.toLowerCase() === result.category.toLowerCase())?.id || "") : current.categoryId
      }));

      setConfidence({
        date: result.date ? 0.9 : 0.4,
        merchant: result.merchant_confidence || (result.merchant ? 0.85 : 0.4),
        total: result.total ? 0.95 : 0.3,
        subtotal: result.estimated ? 0.9 : 0,
        vat: result.vat ? 0.9 : 0
      });

      setNotice(t("ocr.notice.extracted", null, "Đã trích xuất xong. Vui lòng kiểm tra lại số liệu."));
      setOcrState("done");
    } catch (err) {
      setError(err.message || t("ocr.error.extract_failed", null, "Không thể trích xuất dữ liệu."));
      setOcrState("idle");
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canCreate) {
      setError("Vui lòng nhập đầy đủ Tổng tiền và Ngày hóa đơn.");
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
      
      setNotice(t("ocr.notice.created", null, "Giao dịch đã được tạo thành công!"));
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1000);
      } else {
        setParsed(baseParsedState());
        setConfidence(baseConfidence);
        setFile(null);
        setOcrState("idle");
        setWarnings([]);
        setSelectedTagIds([]);
        setTagInput("");
      }
    } catch (err) {
      setError(err.message || t("ocr.error.create_failed", null, "Không thể tạo giao dịch."));
    }
  };

  const getConfClass = (val) => {
    if (val >= 0.8) return "high";
    if (val >= 0.5) return "med";
    return "low";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      setFile(f);
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
    <Shell className={`${embedded ? "ocr-embedded" : "panel"} ocr-container-pro ${ocrState === "running" ? "running" : ""}`}>
      {!embedded && (
        <div className="panel-header">
          <h3>{t("ocr.title", null, "Receipt OCR")}</h3>
        </div>
      )}

      <div className="ocr-grid-pro">
        <div className="ocr-uploader-card">
          <div
            className={`dropzone-pro ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span className="dropzone-icon">📷</span>
            <p>{file ? file.name : "Kéo thả hoặc bấm để chọn ảnh hóa đơn"}</p>
          </div>

          {previewUrl && (
            <div className="preview-container">
              <div className="scanner-line"></div>
              <img src={previewUrl} alt="Receipt preview" />
            </div>
          )}

          <button
            className="extract-btn-pro glow-effect"
            onClick={handleExtract}
            disabled={!file || ocrState === "running" || loading}
          >
            {ocrState === "running" ? (
              <><span>🌀</span> Đang quét...</>
            ) : (
              <><span>✨</span> Trích xuất dữ liệu AI</>
            )}
          </button>
        </div>

        <form className="ocr-form-card" onSubmit={handleCreate}>
          <div className="form-section-title">Thông tin giao dịch</div>

          <div className="confidence-legend">
             <div className="legend-item">
               <span className="dot high"></span> Tốt
             </div>
             <div className="legend-item">
               <span className="dot med"></span> Trung bình
             </div>
             <div className="legend-item">
               <span className="dot low"></span> Cần kiểm tra
             </div>
           </div>

          <div className="field-pro">
            <label>Cửa hàng (Merchant)</label>
            <div className="input-wrapper-pro">
              <input
                className="input-pro"
                value={parsed.merchant}
                onChange={(e) => setParsed(p => ({ ...p, merchant: e.target.value }))}
                placeholder="VD: Lotte Mart, Highland Coffee..."
              />
              <div className={`confidence-dot ${getConfClass(confidence.merchant)}`} title="Độ tin cậy của AI"></div>
            </div>
            {confidence.merchant > 0 && (
              <div className="confidence-score-text">
                Độ tin cậy AI: <span className={`score ${getConfClass(confidence.merchant)}`}>{(confidence.merchant * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>

            <div className="field-pro">
              <label>Ngày hóa đơn</label>
              <div className="input-wrapper-pro">
                <input
                  type="date"
                  className="input-pro"
                  value={parsed.date}
                  onChange={(e) => setParsed(p => ({ ...p, date: e.target.value }))}
                />
                <div className={`confidence-dot ${getConfClass(confidence.date)}`}></div>
              </div>
            </div>


          <div className="field-pro">
            <label>Tạm tính (Subtotal)</label>
            <div className="input-wrapper-pro">
              <input
                className="input-pro"
                value={parsed.subtotal}
                onChange={(e) => setParsed(p => ({ ...p, subtotal: formatNumberInput(e.target.value) }))}
                placeholder="0"
              />
              <div className={`confidence-dot ${getConfClass(confidence.subtotal)}`}></div>
            </div>
          </div>

          <div className="field-pro">
            <label>Thuế (VAT)</label>
            <div className="input-wrapper-pro">
              <input
                className="input-pro"
                value={parsed.vat}
                onChange={(e) => setParsed(p => ({ ...p, vat: formatNumberInput(e.target.value) }))}
                placeholder="0"
              />
              <div className={`confidence-dot ${getConfClass(confidence.vat)}`}></div>
            </div>
          </div>

          <div className="field-pro">
            <label>TỔNG THANH TOÁN (Grand Total)</label>
            <div className="input-wrapper-pro">
              <input
                className="input-pro"
                style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}
                value={parsed.total}
                onChange={(e) => setParsed(p => ({ ...p, total: formatNumberInput(e.target.value) }))}
                placeholder="0"
                required
              />
              <div className={`confidence-dot ${getConfClass(confidence.total)}`} style={{ width: '12px', height: '12px' }}></div>
            </div>
            <small style={{ color: 'var(--muted)', textAlign: 'right', display: 'block' }}>
              {parsed.total ? currency(parseNumberInput(parsed.total)) : "--"}
            </small>
          </div>

          <div className="field-pro">
            <label>Ghi chú (Note)</label>
            <div className="input-wrapper-pro">
              <textarea
                className="input-pro"
                rows="2"
                value={parsed.note}
                onChange={(e) => setParsed(p => ({ ...p, note: e.target.value }))}
                placeholder="Nhập ghi chú thêm nếu cần..."
              />
            </div>
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


          {notice && <p style={{ color: '#27ae60', fontSize: '14px', margin: '10px 0' }}>{notice}</p>}
          {error && <p style={{ color: '#e74c3c', fontSize: '14px', margin: '10px 0' }}>{error}</p>}

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
              disabled={ocrState === "running"}
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
              {loading ? "Đang xử lý..." : "Xác nhận & Lưu Giao Dịch"}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
