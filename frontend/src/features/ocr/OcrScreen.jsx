import { useEffect, useMemo, useState } from "react";
import { toInputDate } from "../../utils/format.js";
import { extractOcr } from "../../api/ai.js";

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

export default function OcrScreen({ categories, onCreateTransaction, loading }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [parsed, setParsed] = useState(baseParsedState);
  const [confidence, setConfidence] = useState(baseConfidence);
  const [ocrState, setOcrState] = useState("idle");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);

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
      setError("Please select a receipt image first.");
      return;
    }
    setError("");
    setNotice("");
    setOcrState("running");
    try {
      const result = await extractOcr(file);
      setParsed((current) => ({
        ...current,
        merchant: result.merchant || current.merchant || sanitizeName(file.name),
        total: result.total !== null && result.total !== undefined ? String(result.total) : current.total,
        vat: result.vat !== null && result.vat !== undefined ? String(result.vat) : current.vat,
        estimated:
          result.estimated !== null && result.estimated !== undefined
            ? String(result.estimated)
            : current.estimated,
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
      setNotice("OCR done. Review and confirm before creating transaction.");
      setOcrState("done");
    } catch (err) {
      setError(err.message || "OCR failed.");
      setOcrState("idle");
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canCreate) {
      setError("Missing required data: date and total amount.");
      return;
    }

    setError("");
    setNotice("");

    const descriptionParts = [parsed.merchant || "OCR receipt", parsed.note]
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
      setNotice("Transaction created from OCR.");
      setParsed(baseParsedState());
      setConfidence(baseConfidence);
      setFile(null);
      setOcrState("idle");
      setWarnings([]);
    } catch {
      setError("Failed to create transaction from OCR.");
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Receipt OCR</h3>
        <span className="badge">OCR + transaction</span>
      </div>

      <div className="receipt-grid">
        <div className="receipt-uploader">
          <label className="field">
            <span>Receipt image *</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <button className="ghost" type="button" onClick={handleExtract}>
            {ocrState === "running" ? "Processing..." : "Run OCR"}
          </button>

          <div className="receipt-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Receipt preview" />
            ) : (
              <p className="empty">No image selected.</p>
            )}
          </div>
        </div>

        <form className="form" onSubmit={handleCreate}>
          <div className="row">
            <label className="field">
              <span>Date *</span>
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
                placeholder="Example: Circle K"
              />
              <small className="hint">
                Confidence: {Math.round(confidence.merchant * 100)}%
              </small>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span>Total *</span>
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
              <span>Category</span>
              <select
                value={parsed.categoryId}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, categoryId: event.target.value }))
                }
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Estimated</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={parsed.estimated}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, estimated: event.target.value }))
                }
                placeholder="0"
              />
              <small className="hint">
                Confidence: {Math.round(confidence.estimated * 100)}%
              </small>
            </label>
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea
              rows="3"
              value={parsed.note}
              onChange={(event) =>
                setParsed((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="OCR text summary or custom note"
            />
          </label>

          {warnings.length > 0 && (
            <p className="form-error">{warnings.join(" ")}</p>
          )}
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
              }}
            >
              Reset
            </button>
            <button className="primary" type="submit" disabled={!canCreate || loading}>
              Create transaction
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
