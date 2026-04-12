import { useEffect, useMemo, useState, useRef } from "react";
import { extractOcr } from "../../api/ai.js";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";
import "./ocr.css";

const baseParsedState = () => ({
  date: toInputDate(new Date()),
  merchant: "",
  total: "",
  vat: "",
  subtotal: "",
  categoryId: "",
  invoice_id: "",
  note: ""
});

const baseConfidence = {
  date: 0,
  merchant: 0,
  total: 0,
  vat: 0,
  subtotal: 0
};

export default function OcrScreen({ categories, onCreateTransaction, loading: globalLoading }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsed, setParsed] = useState(baseParsedState);
  const [confidence, setConfidence] = useState(baseConfidence);
  const [ocrState, setOcrState] = useState("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

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
        vat: result.vat ? formatNumberInput(String(result.vat)) : current.vat,
        subtotal: result.subtotal ? formatNumberInput(String(result.subtotal)) : current.subtotal,
        invoice_id: result.invoice_id || "",
        note: result.text ? `ID: ${result.invoice_id || '---'}` : current.note,
        date: result.date || current.date,
        categoryId: result.category ? (categories.find(c => c.name.toLowerCase() === result.category.toLowerCase())?.id || "") : current.categoryId
      }));
      
      setConfidence({
        date: result.date ? 0.9 : 0.4,
        merchant: result.merchant ? 0.85 : 0.4,
        total: result.total ? 0.95 : 0.3,
        vat: result.vat ? 0.8 : 0.2,
        subtotal: result.subtotal ? 0.8 : 0.2
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
    if (!canCreate) return;

    setError("");
    setNotice("");

    const descriptionParts = [parsed.merchant || t("ocr.default_desc"), parsed.invoice_id]
      .filter(Boolean)
      .join(" - ");

    try {
      await onCreateTransaction({
        description: descriptionParts,
        amount: parseNumberInput(parsed.total),
        transaction_type: "expense",
        category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
        date: parsed.date,
        note: parsed.note
      });
      setNotice(t("ocr.notice.created", null, "Giao dịch đã được tạo thành công!"));
      setParsed(baseParsedState());
      setConfidence(baseConfidence);
      setFile(null);
      setOcrState("idle");
    } catch {
      setError(t("ocr.error.create_failed", null, "Không thể tạo giao dịch."));
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

  return (
    <div className={`ocr-container-pro ${ocrState}`}>
      <div className="ocr-header-pro">
        <h1>{t("ocr.title", null, "Nhập Hóa Đơn AI")}</h1>
        <div className="badge-pro">BETA V4 (Auditor)</div>
      </div>

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
            disabled={!file || ocrState === "running" || globalLoading}
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
          
          <div className="field-pro">
            <label>Cửa hàng (Merchant)</label>
            <div className="input-wrapper-pro">
              <input 
                className="input-pro" 
                value={parsed.merchant}
                onChange={(e) => setParsed(p => ({...p, merchant: e.target.value}))}
                placeholder="VD: Lotte Mart, Highland Coffee..."
              />
              <div className={`confidence-dot ${getConfClass(confidence.merchant)}`} title="Độ tin cậy của AI"></div>
            </div>
          </div>

          <div className="grid two" style={{gap: '15px'}}>
            <div className="field-pro">
              <label>Ngày hóa đơn</label>
              <div className="input-wrapper-pro">
                <input 
                  type="date"
                  className="input-pro" 
                  value={parsed.date}
                  onChange={(e) => setParsed(p => ({...p, date: e.target.value}))}
                />
                <div className={`confidence-dot ${getConfClass(confidence.date)}`}></div>
              </div>
            </div>
            <div className="field-pro">
              <label>Mã hóa đơn / ID</label>
              <div className="input-wrapper-pro">
                <input 
                  className="input-pro" 
                  value={parsed.invoice_id}
                  onChange={(e) => setParsed(p => ({...p, invoice_id: e.target.value}))}
                  placeholder="Mã số từ hóa đơn..."
                />
              </div>
            </div>
          </div>

          <div className="form-section-title">Kiểm toán tài chính</div>

          <div className="grid two" style={{gap: '15px'}}>
            <div className="field-pro">
              <label>Tạm tính (Subtotal)</label>
              <div className="input-wrapper-pro">
                <input 
                  className="input-pro" 
                  value={parsed.subtotal}
                  onChange={(e) => setParsed(p => ({...p, subtotal: formatNumberInput(e.target.value)}))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="field-pro">
              <label>Thuế (VAT)</label>
              <div className="input-wrapper-pro">
                <input 
                  className="input-pro" 
                  value={parsed.vat}
                  onChange={(e) => setParsed(p => ({...p, vat: formatNumberInput(e.target.value)}))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="field-pro">
            <label>TỔNG THANH TOÁN (Grand Total)</label>
            <div className="input-wrapper-pro">
              <input 
                className="input-pro" 
                style={{fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)'}}
                value={parsed.total}
                onChange={(e) => setParsed(p => ({...p, total: formatNumberInput(e.target.value)}))}
                placeholder="0"
                required
              />
              <div className={`confidence-dot ${getConfClass(confidence.total)}`} style={{width: '12px', height: '12px'}}></div>
            </div>
            <small style={{color: 'var(--muted)', textAlign: 'right', display: 'block'}}>
              {parsed.total ? currency(parseNumberInput(parsed.total)) : "--"}
            </small>
          </div>

          <div className="field-pro">
            <label>Danh mục dự đoán</label>
            <select
              className="input-pro"
              value={parsed.categoryId}
              onChange={(e) => setParsed(p => ({...p, categoryId: e.target.value}))}
            >
              <option value="">-- Chọn danh mục --</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {notice && <p style={{color: '#27ae60', fontSize: '14px', margin: '10px 0'}}>{notice}</p>}
          {error && <p style={{color: '#e74c3c', fontSize: '14px', margin: '10px 0'}}>{error}</p>}

          <div className="row-actions" style={{marginTop: '20px'}}>
             <button 
              className="ghost" 
              type="button"
              onClick={() => {
                setFile(null);
                setParsed(baseParsedState());
                setConfidence(baseConfidence);
                setNotice("");
                setError("");
              }}
              disabled={ocrState === "running"}
            >
              Làm lại
            </button>
            <button className="primary" type="submit" style={{flex: 1}} disabled={!canCreate || ocrState === "running" || globalLoading}>
              {globalLoading ? "Đang xử lý..." : "Xác nhận & Lưu Giao Dịch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
