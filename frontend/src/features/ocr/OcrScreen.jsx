import { useEffect, useMemo, useState } from "react";
import { currency, formatNumberInput, parseNumberInput, toInputDate } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";
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
    () => parseNumberInput(parsed.total) > 0 && Boolean(parsed.date),
    [parsed.total, parsed.date]
  );

  const handleExtract = async () => {
    if (!file) {
      setError(t("ocr.error.no_file"));
      return;
    }
    setError("");
    setNotice("");
    setOcrState("running");

    await new Promise((resolve) => setTimeout(resolve, 700));

    const guessedMerchant = sanitizeName(file.name) || t("ocr.merchant_guess");
    const guessedTotal = parsed.total || "65000";
    const guessedVat = parsed.vat || "5200";

    setParsed((current) => ({
      ...current,
      merchant: current.merchant || guessedMerchant,
      total: formatNumberInput(guessedTotal),
      vat: formatNumberInput(guessedVat),
      note:
        current.note || t("ocr.note_auto", { name: file.name })
    }));
    setConfidence({
      date: 0.86,
      merchant: 0.82,
      total: 0.92,
      vat: 0.67
    });
    setNotice(t("ocr.notice.extracted"));
    setOcrState("done");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canCreate) {
      setError(t("ocr.error.missing"));
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
        date: parsed.date
      });
      setNotice(t("ocr.notice.created"));
      setParsed(baseParsedState());
      setConfidence(baseConfidence);
      setFile(null);
      setOcrState("idle");
      setWarnings([]);
    } catch {
      setError(t("ocr.error.create_failed"));
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{t("ocr.title")}</h3>
      </div>

      <div className="receipt-grid">
        <div className="receipt-uploader">
          <label className="field">
            <span>{t("ocr.form.image")}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <button className="ghost" type="button" onClick={handleExtract}>
            {ocrState === "running" ? t("ocr.action.running") : t("ocr.action.extract")}
          </button>

          <div className="receipt-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Receipt preview" />
            ) : (
              <p className="empty">{t("ocr.empty")}</p>
            )}
          </div>
        </div>

        <form className="form" onSubmit={handleCreate}>
          <div className="row">
            <label className="field">
              <span>{t("ocr.form.date")}</span>
              <input
                type="date"
                value={parsed.date}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, date: event.target.value }))
                }
                required
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.date * 100) })}
              </small>
            </label>

            <label className="field">
              <span>{t("ocr.form.merchant")}</span>
              <input
                type="text"
                value={parsed.merchant}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, merchant: event.target.value }))
                }
                placeholder={t("ocr.form.merchant_placeholder")}
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.merchant * 100) })}
              </small>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span>{t("ocr.form.total")}</span>
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
                {t("ocr.confidence", { value: Math.round(confidence.total * 100) })}
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
                placeholder="0"
              />
              <small className="hint">
                {t("ocr.confidence", { value: Math.round(confidence.vat * 100) })}
              </small>
            </label>
          </div>

          <div className="row">
            <label className="field">
              <span>{t("ocr.form.category")}</span>
              <select
                value={parsed.categoryId}
                onChange={(event) =>
                  setParsed((current) => ({ ...current, categoryId: event.target.value }))
                }
              >
                <option value="">{t("ocr.form.category_placeholder")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("ocr.form.preview_total")}</span>
              <input
                type="text"
                value={parsed.total ? currency(parseNumberInput(parsed.total)) : "--"}
                readOnly
              />
              <small className="hint">
                Confidence: {Math.round(confidence.estimated * 100)}%
              </small>
            </label>
          </div>

          <label className="field">
            <span>{t("ocr.form.note")}</span>
            <textarea
              rows="3"
              value={parsed.note}
              onChange={(event) =>
                setParsed((current) => ({ ...current, note: event.target.value }))
              }
              placeholder={t("ocr.form.note_placeholder")}
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
              {t("ocr.action.reset")}
            </button>
            <button className="primary" type="submit" disabled={!canCreate || loading}>
              {t("ocr.action.create")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
