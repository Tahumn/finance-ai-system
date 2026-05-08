import { useEffect, useMemo, useState } from "react";
import { extractOcr } from "../../api/ai.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { colorFor, onColor } from "../../utils/colors.js";
import { t } from "../../utils/i18n.js";
import { CAT_ICONS, getCatMeta } from "../../utils/categoryIcons.jsx";
import "./ocr.css";

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

// Simple UI Icons
const CameraIcon = ({size=20}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
const UploadIcon = ({size=20}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const SearchIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const RefreshIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const XIcon = ({size=20}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const SparkleIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;

export default function OcrScreen({
  categories,
  tags = [],
  accounts = [],
  userEmail,
  onCreateCategory,
  onCreateTag,
  onCreateTransaction,
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
  const [categoryQuery, setCategoryQuery] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [autoCreate, setAutoCreate] = useState(true);
  const [showAllTags, setShowAllTags] = useState(false);

  const tagMap = useMemo(() => {
    const map = {};
    tags.forEach((tag) => { map[tag.id] = tag; });
    return map;
  }, [tags]);

  const tagNameMap = useMemo(() => {
    const map = {};
    tags.forEach((tag) => { if (tag?.name) map[tag.name.toLowerCase()] = tag; });
    return map;
  }, [tags]);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
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
    if (!file) { setError(t("ocr.error.no_file", null, "Please select a receipt image first.")); return; }
    setError(""); setNotice(""); setOcrState("running");
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
        merchant: result.merchant ? 0.92 : 0.4,
        total: result.total ? 0.92 : 0.3,
        vat: result.vat ? 0.88 : 0.2,
        estimated: result.estimated ? 1.0 : 0.2
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
    if (event) event.preventDefault();
    if (!canCreate) return;
    setError(""); setNotice("");
    const descriptionParts = [parsed.merchant || t("ocr.default_desc"), referenceCode ? `Ref:${referenceCode}` : "", parsed.note].filter(Boolean).join(" - ");
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
        tag_ids: [...new Set([...selectedTagIds, ...(ocrTagId ? [ocrTagId] : [])])],
        account_id: fundingSourceId ? Number(fundingSourceId) : null
      });
      setNotice(t("ocr.notice.created", null, "Transaction created from OCR."));
      if (onClose) onClose();
    } catch { setError(t("ocr.error.create_failed", null, "Failed to create transaction from OCR.")); }
  };

  const toggleSuggestedTag = (tagId) => {
    setSelectedTagIds((current) => current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
  };

  const filteredCategories = useMemo(() => {
    const q = String(categoryQuery || "").trim().toLowerCase();
    if (!q) return categories.slice(0, 10);
    return categories.filter((c) => String(c.name || "").toLowerCase().includes(q));
  }, [categories, categoryQuery]);

  const Shell = embedded ? "div" : "section";

  return (
    <Shell className="ocr-layout-wrap">
      <div className="ocr-header-pro">
        <div className="ocr-title-area">
          <h2>Nhập hóa đơn (OCR)</h2>
          <p>Tự động trích xuất thông tin từ ảnh hóa đơn và cho phép chỉnh sửa trước khi lưu.</p>
        </div>
        <div className="ocr-header-actions">
           <button type="button" className="ocr-btn-outline" onClick={handleCreate} disabled={!canCreate || loading}>
             <SparkleIcon size={16}/> Tạo giao dịch từ hóa đơn
           </button>
        </div>
        {onClose && (
           <button type="button" className="ocr-close-btn-fixed" onClick={onClose} aria-label="Đóng">
             <XIcon size={24}/>
           </button>
        )}
      </div>

      <div className="ocr-grid-pro">
        <div className="ocr-col-left">
           <div className="ocr-card-pro">
              <div className="ocr-upload-nav">
                <button type="button" className="active"><UploadIcon size={16}/> Tải ảnh lên</button>
                <button type="button"><CameraIcon size={16}/> Camera</button>
              </div>
              <label className="ocr-drop-area">
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} hidden />
                <div className="ocr-drop-icon"><UploadIcon size={24}/></div>
                <div className="ocr-drop-text">
                  <p>Kéo & thả ảnh hóa đơn vào đây</p>
                  <span>Hỗ trợ JPG, PNG tối đa 10MB</span>
                </div>
                <button type="button" className="ocr-btn-select">Chọn ảnh từ máy</button>
              </label>
           </div>

           <div className="ocr-preview-section">
              <h4>Xem trước hóa đơn</h4>
              <div className="ocr-preview-box">
                {previewUrl ? <img src={previewUrl} alt="Receipt" /> : <p className="empty">Chưa có ảnh hóa đơn</p>}
              </div>
           </div>

           <div className="ocr-result-box">
              <h4>Kết quả OCR</h4>
              <div className="ocr-res-item">
                <label>Merchant</label>
                <strong>{parsed.merchant || "Chưa xác định"}</strong>
              </div>
              <div className="ocr-res-item">
                <label>Ngày giao dịch</label>
                <strong>{parsed.date?.split("-").reverse().join("/") || "--/--/----"}</strong>
              </div>
              <div className="ocr-res-item">
                <label>Tổng tiền</label>
                <strong>{parsed.total ? currency(parseNumberInput(parsed.total)) : "0 d"}</strong>
              </div>
              <div className="ocr-res-item">
                <label>Độ tin cậy</label>
                <div className="ocr-conf-badge">{Math.round(confidence.total * 100)}% ✓</div>
              </div>
              <button type="button" className="ocr-btn-retry" onClick={handleExtract} disabled={ocrState === "running"}>
                <RefreshIcon size={16}/> {ocrState === "running" ? "Đang xử lý..." : "Trích xuất lại OCR"}
              </button>
           </div>
        </div>

        <form className="ocr-col-right" onSubmit={handleCreate}>
           <div className="ocr-section-pro">
              <h3 className="ocr-sec-title">1. Thông tin giao dịch</h3>
              <div className="ocr-field-row">
                 <label className="ocr-input-field">
                   <span>Ngày giao dịch *</span>
                   <div className="ocr-input-wrap">
                      <input type="date" value={parsed.date} onChange={e => setParsed(p=>({...p, date: e.target.value}))} required />
                   </div>
                 </label>
                 <label className="ocr-input-field">
                   <span>Merchant *</span>
                   <div className="ocr-input-wrap">
                      <input type="text" value={parsed.merchant} onChange={e => setParsed(p=>({...p, merchant: e.target.value}))} placeholder="Vd: Circle K" />
                      <div className="ocr-input-badge">OCR {Math.round(confidence.merchant * 100)}%</div>
                   </div>
                 </label>
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
                 <div className="ocr-pill-nav scrollable">
                    {accounts.length ? accounts.map(acc => (
                      <button key={acc.id} type="button" className={String(fundingSourceId) === String(acc.id) ? "active" : ""} onClick={() => setFundingSourceId(String(acc.id))}>
                        {acc.name}
                      </button>
                    )) : (
                      <>
                        <button type="button" className="active">Tiền mặt</button>
                        <button type="button">Ngân hàng</button>
                      </>
                    )}
                 </div>
              </div>

              <div className="ocr-field-row tri">
                 <label className="ocr-input-field">
                   <span>Tổng tiền *</span>
                   <div className="ocr-input-wrap">
                      <input type="text" value={parsed.total} onChange={e => setParsed(p=>({...p, total: formatNumberInput(e.target.value)}))} required />
                      <div className="ocr-input-badge">OCR {Math.round(confidence.total * 100)}%</div>
                   </div>
                 </label>
                 <label className="ocr-input-field">
                   <span>VAT</span>
                   <div className="ocr-input-wrap">
                      <input type="text" value={parsed.vat} onChange={e => setParsed(p=>({...p, vat: formatNumberInput(e.target.value)}))} />
                      <div className="ocr-input-badge">OCR {Math.round(confidence.vat * 100)}%</div>
                   </div>
                 </label>
                 <label className="ocr-input-field">
                   <span>Giảm giá</span>
                   <div className="ocr-input-wrap">
                      <input type="text" value={parsed.estimated} onChange={e => setParsed(p=>({...p, estimated: formatNumberInput(e.target.value)}))} />
                      <div className="ocr-input-badge">OCR {Math.round(confidence.estimated * 100)}%</div>
                   </div>
                 </label>
              </div>

              <label className="ocr-input-field">
                 <span>Tạm tính</span>
                 <div className="ocr-input-wrap">
                    <input type="text" value={currency(computedSubTotal)} readOnly />
                    <div className="ocr-input-badge" style={{color: '#94a3b8'}}>Tự động tính</div>
                 </div>
              </label>
           </div>

           <div className="ocr-section-pro">
              <h3 className="ocr-sec-title">2. Danh mục</h3>
              <div className="ocr-ai-suggest">
                <SparkleIcon size={18} />
                <span>Gợi ý từ OCR: phù hợp nhất với danh mục <strong>Ăn uống</strong></span>
              </div>
              <div className="ocr-search-bar">
                 <SearchIcon size={16} className="ocr-search-icon" />
                 <input type="text" value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)} placeholder="Tìm danh mục..." />
              </div>
              <div className="ocr-category-grid">
                {filteredCategories.map(cat => {
                   const bg = colorFor(cat.name, userEmail);
                   const selected = String(parsed.categoryId) === String(cat.id);
                   const meta = getCatMeta(cat.name);
                   return (
                     <div key={cat.id} className={`ocr-cat-card ${selected ? "active" : ""}`} onClick={() => setParsed(p => ({...p, categoryId: String(cat.id)}))}>
                        <div className="ocr-cat-icon" style={{background: bg}}><meta.SvgIcon size={14} /></div>
                        <span className="ocr-cat-name">{cat.name}</span>
                     </div>
                   );
                })}
              </div>
           </div>

           <div className="ocr-section-pro">
              <h3 className="ocr-sec-title">3. Chi tiết bổ sung</h3>
              <div className="ocr-input-field" style={{marginBottom: 20}}>
                <span>Ghi chú</span>
                <div className="ocr-input-wrap">
                  <textarea rows="2" value={parsed.note} onChange={e => setParsed(p=>({...p, note: e.target.value}))} placeholder="Ghi chú thêm về hóa đơn..." />
                </div>
              </div>
              <div className="ocr-field-row">
                 <label className="ocr-input-field">
                   <span>Số hóa đơn / Mã tham chiếu</span>
                   <div className="ocr-input-wrap">
                      <input type="text" value={referenceCode} onChange={e => setReferenceCode(e.target.value)} placeholder="Vd: INV-12345" />
                   </div>
                 </label>
                 <label className="ocr-input-field">
                   <span>Đính kèm khác</span>
                   <button type="button" className="ocr-btn-retry"><UploadIcon size={16}/> Thêm tệp</button>
                 </label>
              </div>

              <div className="ocr-input-field" style={{marginTop: 20}}>
                <span>Nhãn (Tags)</span>
                <div className="ocr-pill-group wrap" style={{marginTop: 8}}>
                   {(showAllTags ? tags : tags.slice(0, 10)).map(tag => (
                      <button key={tag.id} type="button" className={`tag-option color-pill ${selectedTagIds.includes(tag.id) ? "active" : ""}`} onClick={() => toggleSuggestedTag(tag.id)} style={{"--pill-bg": tag.color, "--pill-fg": onColor(tag.color)}}>
                        {tag.name} {selectedTagIds.includes(tag.id) && "×"}
                      </button>
                   ))}
                   <button type="button" className="ocr-btn-retry" style={{width: 'auto', padding: '4px 12px', fontSize: 12}} onClick={() => setShowAllTags(!showAllTags)}>
                     {showAllTags ? "Thu gọn" : "Thêm thẻ..."}
                   </button>
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
                 <button type="button" className="ocr-btn-secondary" onClick={() => { setFile(null); setParsed(baseParsedState()); setOcrState("idle"); }}>
                    Làm mới
                 </button>
                 <button type="button" className="ocr-btn-secondary">Lưu nháp</button>
                 <button type="submit" className="ocr-btn-primary" disabled={!canCreate || loading || !autoCreate}>
                    {loading ? "Đang xử lý..." : "Hoàn tất & Lưu"}
                 </button>
              </div>
           </div>
        </form>
      </div>
    </Shell>
  );
}
