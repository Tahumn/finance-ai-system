import { useState, useEffect } from "react";
import { toInputDate, parseCurrencyInput } from "../../utils/format.js";

const emptyParsedData = {
  date: "",
  merchant: "",
  total: 0,
  vat: 0,
  estimated: null,
  note: null,
  category_id: "" // Thêm trường category_id để dễ dàng tạo giao dịch
};

export default function OcrScreen({
  categories,
  onParseFromText, // Hàm để gọi API phân tích văn bản
  onCreateTransaction, // Hàm để tạo giao dịch sau khi phân tích
  loading // Trạng thái loading từ App.jsx
}) {
  const [ocrText, setOcrText] = useState("");
  const [parsedReceipt, setParsedReceipt] = useState(emptyParsedData);
  const [displayError, setDisplayError] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  // State cho các trường form, cho phép người dùng chỉnh sửa dữ liệu đã phân tích
  const [formFields, setFormFields] = useState(emptyParsedData);

  useEffect(() => {
    // Khi parsedReceipt thay đổi, cập nhật formFields
    setFormFields(prev => ({
      ...prev,
      ...parsedReceipt,
      // Đặt category_id mặc định nếu có categories và chưa được set
      category_id: parsedReceipt.category_id || (categories.length > 0 ? categories[0].id : "")
    }));
  }, [parsedReceipt, categories]);

  const handleParseReceipt = async () => {
    if (!ocrText.trim()) {
      setDisplayError("Vui lòng nhập văn bản hóa đơn.");
      return;
    }
    setIsParsing(true);
    setDisplayError("");
    try {
      const result = await onParseFromText(ocrText); // Gọi API thông qua App.jsx
      if (result) {
        // Xử lý và chuẩn hóa dữ liệu từ API
        const cleanedTotal = parseCurrencyInput(result.total);
        const formattedDate = result.date && result.date.match(/^\d{4}-\d{2}-\d{2}$/)
                               ? result.date
                               : toInputDate(new Date()); // Mặc định là ngày hôm nay nếu định dạng sai hoặc thiếu

        setParsedReceipt({
          date: formattedDate,
          merchant: result.merchant || "Không xác định",
          total: cleanedTotal,
          vat: result.vat || 0,
          estimated: result.estimated || null,
          note: result.note || null,
          category_id: "" // Reset category_id, sẽ được set lại trong useEffect
        });
      } else {
        setParsedReceipt(emptyParsedData);
        setDisplayError("Không thể phân tích hóa đơn. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Lỗi khi phân tích hóa đơn:", err);
      setDisplayError(err.message || "Đã xảy ra lỗi khi phân tích hóa đơn.");
      setParsedReceipt(emptyParsedData);
    } finally {
      setIsParsing(false);
    }
  };

  const handleCreateTransactionFromParsed = async () => {
    if (!formFields.total || formFields.total <= 0) {
      setDisplayError("Tổng số tiền phải lớn hơn 0.");
      return;
    }
    if (!formFields.date) {
      setDisplayError("Ngày giao dịch không được để trống.");
      return;
    }
    if (!formFields.category_id) {
        setDisplayError("Vui lòng chọn một danh mục cho giao dịch.");
        return;
    }

    const transactionPayload = {
      amount: formFields.total,
      date: formFields.date,
      description: `${formFields.merchant || "Biên lai OCR"} - ${formFields.note || ""}`.trim(),
      transaction_type: "expense", // Giả định biên lai OCR thường là chi tiêu
      category_id: formFields.category_id,
      // Các trường khác như account_id có thể được thêm vào nếu cần
    };

    try {
      await onCreateTransaction(transactionPayload);
      alert("Giao dịch đã được tạo thành công!");
      setOcrText("");
      setParsedReceipt(emptyParsedData);
      setDisplayError("");
    } catch (err) {
      console.error("Lỗi khi tạo giao dịch:", err);
      setDisplayError(err.message || "Không thể tạo giao dịch từ hóa đơn đã phân tích.");
    }
  };

  return (
    <section className="panel ocr-screen">
      <div className="panel-header">
        <h3>Nhập hóa đơn OCR</h3>
      </div>

      <div className="form">
        <label className="field">
          <span>Văn bản hóa đơn (hoặc dán ảnh)</span>
          <textarea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            placeholder="Dán văn bản từ hóa đơn hoặc mô tả hóa đơn..."
            rows="6"
          />
        </label>
        <button
          className="primary"
          onClick={handleParseReceipt}
          disabled={isParsing || loading || !ocrText.trim()}
        >
          {isParsing ? "Đang phân tích..." : "Phân tích hóa đơn"}
        </button>
      </div>

      {displayError && <p className="form-error">{displayError}</p>}

      {parsedReceipt.date && ( // Chỉ hiển thị dữ liệu đã phân tích nếu có kết quả
        <div className="parsed-data-display">
          <h4>Dữ liệu đã phân tích:</h4>
          <div className="form">
            <label className="field">
              <span>Ngày giao dịch (*)</span>
              <input type="date" value={formFields.date} onChange={(e) => setFormFields(prev => ({ ...prev, date: e.target.value }))} required />
            </label>
            <label className="field">
              <span>Cửa hàng</span>
              <input type="text" value={formFields.merchant} onChange={(e) => setFormFields(prev => ({ ...prev, merchant: e.target.value }))} />
            </label>
            <label className="field">
              <span>Tổng tiền (*)</span>
              <input type="number" value={formFields.total} onChange={(e) => setFormFields(prev => ({ ...prev, total: Number(e.target.value) }))} required />
            </label>
            <label className="field">
              <span>VAT</span>
              <input type="text" value={formFields.vat} onChange={(e) => setFormFields(prev => ({ ...prev, vat: e.target.value }))} />
            </label>
            <label className="field">
              <span>Ước tính</span>
              <input type="text" value={formFields.estimated || ""} onChange={(e) => setFormFields(prev => ({ ...prev, estimated: e.target.value }))} />
            </label>
            <label className="field">
              <span>Ghi chú</span>
              <textarea value={formFields.note || ""} onChange={(e) => setFormFields(prev => ({ ...prev, note: e.target.value }))} rows="2" />
            </label>
            <label className="field">
                <span>Danh mục (*)</span>
                <select value={formFields.category_id} onChange={(e) => setFormFields(prev => ({ ...prev, category_id: e.target.value }))}>
                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                </select>
            </label>
            <button className="primary" onClick={handleCreateTransactionFromParsed} disabled={loading || !formFields.total || !formFields.date || !formFields.category_id}>
              Tạo giao dịch
            </button>
          </div>
        </div>
      )}
    </section>
  );
}