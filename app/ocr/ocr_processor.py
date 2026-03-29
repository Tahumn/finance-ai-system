import cv2
import numpy as np
import pytesseract
from PIL import Image
import os

# Cấu hình đường dẫn Tesseract nếu bạn đang dùng Windows
# Ví dụ: pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def preprocess_invoice_image(image_path):
    """
    Hàm tiền xử lý ảnh hóa đơn để tối ưu hóa kết quả OCR.
    
    Args:
        image_path (str): Đường dẫn đến file ảnh hóa đơn.
        
    Returns:
        numpy.ndarray: Ảnh đã qua xử lý (trắng trắng đen đen sắc nét).
    """
    # Đọc ảnh từ đường dẫn
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Không thể mở hoặc tìm thấy ảnh tại: {image_path}")

    # Bước 1: Chuyển sang thang độ xám (Grayscale)
    # Loại bỏ thông tin màu sắc không cần thiết, giảm độ phức tạp khi xử lý
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Bước 2: Khử nhiễu (Denoising)
    # Sử dụng Fast Non-Local Means Denoising để khử nhiễu vân giấy (grain) 
    # trong khi vẫn giữ lại các cạnh của chữ. Đây là bản nâng cao hơn Gaussian Blur.
    denoised = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)

    # Bước 3: Phân ngưỡng thích nghi (Adaptive Thresholding)
    # Chuyển ảnh sang dạng nhị phân (trắng đen hoàn toàn).
    # Adaptive threshold giúp xử lý các vùng ánh sáng không đều (cháy sáng hoặc bóng đổ).
    # Ta sử dụng cv2.THRESH_BINARY_INV để chữ thành màu trắng (255) và nền thành đen (0) 
    # nhằm phục vụ cho các phép toán hình thái học ở bước sau.
    thresh = cv2.adaptiveThreshold(
        denoised, 
        255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 
        11, 
        2
    )

    # Bước 4: Phép toán hình thái học (Morphology)
    # Tạo nhân (kernel) để xử lý
    kernel = np.ones((2, 2), np.uint8)
    
    # Dilate: "Nở" các điểm trắng (chữ). Giúp nối lại các nét chữ bị đứt quãng.
    # Erode: "Thu" các điểm trắng. Giúp làm gọn nét chữ nếu bị nhòe sau khi Dilate.
    # Tùy vào độ mờ của hóa đơn, ta có thể điều chỉnh số lần lặp (iterations).
    processed = cv2.dilate(thresh, kernel, iterations=1)
    processed = cv2.erode(processed, kernel, iterations=1)

    # Cuối cùng: Đảo ngược lại để có chữ đen trên nền trắng (định dạng chuẩn cho OCR)
    final_image = cv2.bitwise_not(processed)

    return final_image

def read_ocr_after_preprocessing(processed_image, ocr_engine='tesseract'):
    """
    Sử dụng OCR Engine để đọc văn bản từ ảnh đã tiền xử lý.
    
    Args:
        processed_image (numpy.ndarray): Ảnh đã qua xử lý.
        ocr_engine (str): Tên engine OCR (hiện hỗ trợ 'tesseract').
        
    Returns:
        str: Nội dung văn bản nhận diện được.
    """
    if ocr_engine.lower() == 'tesseract':
        # Chuyển đổi từ mảng Numpy sang định dạng Image của PIL
        pil_img = Image.fromarray(processed_image)
        
        # Gọi pytesseract để nhận diện
        # Cấu hình '--psm 6' giả định ảnh là một khối văn bản thống nhất
        config = '--psm 6'
        text = pytesseract.image_to_string(pil_img, lang='vie+eng', config=config)
        return text
    else:
        return "Engine không hỗ trợ hoặc cần cấu hình Google Vision API."

# --- MÃ NGUỒN MẪU ĐỂ SỬ DỤNG ---
if __name__ == "__main__":
    # Thay thế đường dẫn này bằng file ảnh thực tế của bạn
    sample_path = "invoice_sample.jpg" 
    
    if os.path.exists(sample_path):
        try:
            print("Đang tiền xử lý ảnh...")
            processed = preprocess_invoice_image(sample_path)
            
            # Lưu ảnh kết quả để kiểm tra trực quan
            cv2.imwrite("processed_invoice.jpg", processed)
            print("Đã lưu ảnh đã xử lý tại: processed_invoice.jpg")
            
            print("Đang chạy OCR...")
            result_text = read_ocr_after_preprocessing(processed)
            
            print("\n----- KẾT QUẢ Nhận DIỆN -----\n")
            print(result_text)
            print("\n----------------------------")
            
        except Exception as e:
            print(f"Lỗi: {e}")
    else:
        print(f"Vui lòng chuẩn bị file {sample_path} để chạy thử nghiệm.")
        print("Hoặc bạn có thể gọi hàm preprocess_invoice_image(path) trong code của mình.")
