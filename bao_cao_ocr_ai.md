# CẬP NHẬT NỘI DUNG ĐỒ ÁN: TÍNH NĂNG OCR & AI INTELLIGENCE

## 3.5. Tính năng OCR hóa đơn/chứng từ thông minh

### 3.5.1. Mục tiêu tính năng
Tự động hóa quy trình nhập liệu tài chính từ các hóa đơn giấy (siêu thị, nhà hàng, xăng dầu...). Hệ thống tập trung vào việc trích xuất chính xác dữ liệu từ các ảnh chụp có điều kiện không lý tưởng (nhăn, bóng đổ, font chữ đặc thù) nhằm tối ưu trải nghiệm người dùng.

### 3.5.2. Dữ liệu đầu vào và đầu ra
*   **Dữ liệu đầu vào (Input):** Hình ảnh hóa đơn (JPEG, PNG) được chụp trực tiếp từ camera hoặc tải lên từ thư viện thiết bị.
*   **Dữ liệu đầu ra (Output):**
    *   **Thông tin cốt lõi:** Tên cửa hàng (Merchant), Tổng số tiền thanh toán (Total Amount), Ngày hóa đơn.
    *   **Phân loại tự động:** Tự động đề xuất danh mục chi tiêu (Category) dựa trên nội dung hóa đơn.
    *   **Dữ liệu cấu trúc:** Trích xuất thông tin dưới dạng JSON để đồng bộ trực tiếp vào hệ thống quản lý giao dịch.

### 3.5.3. Mô hình và công cụ sử dụng
*   **OpenCV:** Sử dụng cho các thuật toán tiền xử lý ảnh (Xử lý nhiễu, cân bằng ánh sáng, xoay ảnh tự động).
*   **Tesseract OCR (v5.0):** Công cụ nhận diện ký tự quang học mã nguồn mở để chuyển đổi hình ảnh thành văn bản thô.
*   **Gemini 1.5 Flash (AI Refiner):** Đóng vai trò là "bộ não" xử lý ngữ nghĩa. LLM này chịu trách nhiệm hiệu đính văn bản thô từ Tesseract, sửa lỗi chính tả và cấu trúc hóa dữ liệu một cách logic.

### 3.5.4. Pipeline xử lý đa tầng (Hybrid Pipeline)
Để đảm bảo độ chính xác cao nhất, hệ thống thực hiện qua các bước sau:
1.  **Tiền xử lý (Computer Vision):** Sử dụng OpenCV để chuyển ảnh sang hệ màu xám (Grayscale), khử nhiễu (Denoising) và phân ngưỡng nhị phân (Adaptive Thresholding) để tách biệt chữ viết khỏi nền ảnh.
2.  **Nhận diện thô (Raw OCR):** Tesseract thực hiện quét các vùng văn bản trên ảnh đã xử lý để lấy dữ liệu ký tự.
3.  **Hậu xử lý AI (Semantic Refining):** Văn bản thô được đưa vào hệ thống Prompt Engineering của Gemini để:
    *   Sửa lỗi mất ký tự hoặc sai font chữ từ quá trình OCR.
    *   **Suy luận thông minh:** Nếu hóa đơn bị rách phần tổng tiền, AI sẽ tự động tính toán lại dựa trên danh sách các mặt hàng (Line Items) đã đọc được.

---

## 3.6. Đánh giá chất lượng xử lý AI/NLP và OCR
*   **Về NLP:** Hệ thống đạt tỷ lệ nhận diện ý định (Intent Recognition) tốt với các câu lệnh tiếng Việt tự nhiên nhờ sự kết hợp giữa LLM và bộ quy tắc nghiệp vụ (Rule-based).
*   **Về OCR:** Hiệu quả vượt trội nhờ cơ chế **Fallback**. Khi Tesseract gặp khó khăn với bố cục phức tạp, lớp AI Refiner sẽ sử dụng kiến thức ngữ cảnh để bù đắp thông tin thiếu sót.

---

## 3.7. Chi phí, hiệu năng và rủi ro
*   **Hiệu năng:** Thời gian xử lý trung bình từ 2-4 giây cho mỗi hóa đơn, phù hợp với nhu cầu sử dụng thực tế của người dùng cá nhân.
*   **Chi phí:** Việc ưu tiên dòng model **Flash** giúp hệ thống vận hành với chi phí thấp (tối ưu hơn 10 lần so với dòng Pro) nhưng vẫn duy trì được khả năng xử lý ngôn ngữ phức tạp.
*   **Rủi ro & Giải pháp:** Rủi ro lớn nhất là AI đưa ra thông tin sai lệch (Hallucination). Hệ thống giải quyết triệt để bằng cơ chế **Human-in-the-loop**: Dữ liệu sau khi OCR luôn hiển thị ở trạng thái chờ xác nhận, cho phép người dùng kiểm tra và chỉnh sửa trước khi lưu chính thức.

---

## 3.8. Hạn chế và Phần nhóm tự xây dựng
*   **Hạn chế:** Hệ thống hiện tại chưa hỗ trợ tốt các loại hóa đơn viết tay có nét chữ quá mờ hoặc bố cục phi cấu trúc quá mức.
*   **Phần tự xây dựng (Key Contributions):**
    *   **Bộ lọc OpenCV tùy chỉnh:** Thiết kế riêng để xử lý các loại hóa đơn nhiệt đặc thù tại Việt Nam (thường có độ tương phản thấp).
    *   **Prompt Engineering đa tầng:** Xây dựng các kịch bản AI phức tạp để tự động phân bổ giao dịch vào đúng nguồn tiền (Ví/Ngân hàng) dựa trên dấu hiệu nhận biết từ hóa đơn.
    *   **AI Intelligence Dashboard:** Hệ thống Dashboard thông minh hiển thị xu hướng tài chính và cảnh báo biến động bằng giao diện **Premium Midnight Glass** hiện đại.
