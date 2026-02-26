import { useEffect, useMemo, useState } from "react";
import { currency, toInputDate } from "../../utils/format.js";

const baseParsedState = () => ({
  date: toInputDate(new Date()),
  merchant: "",
  total: "",
  vat: "",
  categoryId: "",
  note: ""
});

const baseConfidence = {
  date: 0,
  merchant: 0,
  total: 0,
  vat: 0
};

const sanitizeName = (name) =>
  name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

export default function OcrScreen({ categories, onCreateTransaction, loading }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsed, setParsed] = useState(baseParsedState);
  const [confidence, setConfidence] = useState(baseConfidence);
  const [ocrState, setOcrState] = useState("idle");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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
    () => Number(parsed.total) > 0 && Boolean(parsed.date),
    [parsed.total, parsed.date]
  );

  const handleExtract = async () => {
    if (!file) {
      setError("Vui lòng chọn ảnh hóa đơn trước khi trích xuất.");
      return;
    }
    setError("");
    setNotice("");
    setOcrState("running");

    await new Promise((resolve) => setTimeout(resolve, 700));

    const guessedMerchant = sanitizeName(file.name) || "Merchant từ OCR";
    const guessedTotal = parsed.total || "65000";
    const guessedVat = parsed.vat || "5200";

    setParsed((current) => ({
      ...current,
      merchant: current.merchant || guessedMerchant,
      total: guessedTotal,
      vat: guessedVat,
      note:
        current.note || `OCR demo: tự động parse từ file ${file.name}`
    }));
    setConfidence({
      date: 0.86,
      merchant: 0.82,
      total: 0.92,
      vat: 0.67
    });
    setNotice("Đã trích xuất OCR (demo). Bạn có thể chỉnh sửa trước khi tạo giao dịch.");
    setOcrState("done");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canCreate) {
      setError("Thiếu dữ liệu bắt buộc: ngày giao dịch và tổng tiền > 0.");
      return;
    }

    setError("");
    setNotice("");

    const descriptionParts = [parsed.merchant || "Hoa don OCR", parsed.note]
      .filter(Boolean)
      .join(" - ");

    try {
      await onCreateTransaction({
        description: descriptionParts,
        amount: Number(parsed.total),
        transaction_type: "expense",
        category_id: parsed.categoryId ? Number(parsed.categoryId) : null,
        date: parsed.date
      });
      setNotice("Tạo giao dịch từ hóa đơn thành công.");
      setParsed(baseParsedState());
      setConfidence(baseConfidence);
      setFile(null);
      setOcrState("idle");
    } catch {
      setError("Không thể tạo giao dịch từ hóa đơn.");
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Nhập hóa đơn (OCR)</h3>
        <span className="badge">UI + API giao dịch</span>
      </div>

      <div className="receipt-grid">
        <div className="receipt-uploader">
          <label className="field">
            <span>Ảnh hóa đơn *</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <button className="ghost" type="button" onClick={handleExtract}>
            {ocrState === "running" ? "Đang OCR..." : "Trích xuất OCR"}
          </button>

          <div className="receipt-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Receipt preview" />
            ) : (
              <p className="empty">Chưa có ảnh. Hỗ trợ camera/file từ thiết bị.</p>
            )}
          </div>
        </div>

        <form className="form" onSubmit={handleCreate}>
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
              <small className="hint">Confidence: {Math.round(confidence.date * 100)}%</small>
            </label>

            <label className="field">
              <span>Merchant</span>
              <input
                type="text"
                value={parsed.merchant}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, merchant: event.target.value }))
                }
                placeholder="Ví dụ: Circle K"
              />
              <small className="hint">
                Confidence: {Math.round(confidence.merchant * 100)}%
              </small>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span>Tổng tiền *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={parsed.total}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, total: event.target.value }))
                }
                placeholder="0"
                required
              />
              <small className="hint">Confidence: {Math.round(confidence.total * 100)}%</small>
            </label>

            <label className="field">
              <span>VAT</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={parsed.vat}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, vat: event.target.value }))
                }
                placeholder="0"
              />
              <small className="hint">Confidence: {Math.round(confidence.vat * 100)}%</small>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span>Danh mục</span>
              <select
                value={parsed.categoryId}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, categoryId: event.target.value }))
                }
              >
                <option value="">Chọn danh mục</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tạm tính giao dịch</span>
              <input
                type="text"
                value={parsed.total ? currency(Number(parsed.total)) : "--"}
                readOnly
              />
            </label>
          </div>

          <label className="field">
            <span>Ghi chú</span>
            <textarea
              rows="3"
              value={parsed.note}
              onChange={(event) =>
                setParsed((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="OCR map fields, bạn có thể chỉnh sửa trước khi lưu"
            />
          </label>

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
              }}
            >
              Làm mới
            </button>
            <button className="primary" type="submit" disabled={!canCreate || loading}>
              Tạo giao dịch từ hóa đơn
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
