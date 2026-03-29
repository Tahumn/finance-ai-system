import cv2
import numpy as np
import pytesseract
import os
import platform
from scipy import stats

# Cấu hình đường dẫn Tesseract linh hoạt
if platform.system() == "Windows":
    # Đường dẫn trên máy Windows của bạn
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
else:
    # Trên Docker (Linux), Tesseract thường nằm trong PATH nên không cần set cứng, 
    # hoặc set về /usr/bin/tesseract nếu cần.
    # Thông thường chỉ cần gọi luôn vì đã được cài vào hệ thống.
    pass

class OCRProcessor:
    """
    Universal OCR Pipeline (Đường ống xử lý OCR Vạn Năng).
    Được thiết kế để giải quyết toàn diện các chướng ngại vật trong nhận diện quang học (OCR) cho tài liệu.
    Mục tiêu: Xử lý hiệu quả ảnh bóng đổ, ảnh chụp nghiêng, và ảnh có độ phân giải thấp.
    """
    def __init__(self):
        pass

    def remove_shadows(self, image):
        """
        Khử bóng đổ cục bộ (Local Shadow Removal) do ánh sáng môi trường không đồng đều.
        
        Logic toán học & xử lý ảnh:
        1. Chuyển từ không gian màu cấu trúc RGB/BGR sang LAB. Tại đây, kênh L (Lightness)
           chỉ lưu cường độ chiếu sáng, tách biệt hoàn toàn với màu sắc (A, B).
        2. Dùng phép giãn nở (Dilate) với kernel kích thước lớn trên kênh L để xóa bỏ 
           các nét chữ (vật thể nhỏ màu tối), hệ quả sẽ tạo ra một bức ảnh chỉ chứa
           nền giấy (Background Illumination). Phép Median Blur giúp làm mượt nền này.
        3. Sử dụng phép chia ma trận cv2.divide(L, Nền) để chuẩn hóa độ sáng. Ở các
           vùng bóng đổ, cả L và Nền đều nhỏ, phép chia sẽ kéo tỷ số về gần 1 (màu trắng).
        
        Args:
            image (numpy.ndarray): Ảnh đầu vào (BGR hoặc Grayscale).
        """
        if len(image.shape) == 3:
            # Chuyển đổi sang không gian màu LAB
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l_channel, a, b = cv2.split(lab)
        else:
            l_channel = image.copy()

        # Dùng Kernel lớn (ví dụ 25x25) để giãn nở các pixel sáng, lấp đầy chữ màu đen.
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
        background = cv2.dilate(l_channel, kernel)
        
        # Làm mượt (smooth) nền để các ranh giới bóng đổ không bị gắt
        background = cv2.medianBlur(background, 21)

        # Cân bằng sáng bằng phép chia giá trị pixel (Scaling lên dải 0-255)
        # L_new(x,y) = 255 * ( L(x,y) / bg(x,y) )
        normalized_l = cv2.divide(l_channel, background, scale=255)

        if len(image.shape) == 3:
            # Nếu là ảnh màu, ghép lại với các kênh màu gốc
            merged_lab = cv2.merge((normalized_l, a, b))
            result = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
            return result
        else:
            return normalized_l

    def correct_skew(self, image):
        """
        Tự động cân bằng góc nghiêng của ảnh chụp (Deskewing).
        
        Logic toán học & xử lý ảnh:
        1. Sử dụng thuật toán Canny Edge Detection để tìm các đoạn thẳng có cường độ 
           sáng biến thiên mạnh (ví dụ viền chữ, nét thẳng của bảng biểu).
        2. Chạy thuật toán Nội Suy Hough (HoughLinesP) để chuyển hóa phân bố điểm ảnh 
           thành các véc-tơ đường thẳng hữu hạn toán học trong tọa độ cực (r, theta).
        3. Tính toán góc lượng giác (arctan2) của các đoạn thẳng dài trong ảnh.
        4. Sử dụng Mode (giá trị xuất hiện nhiều nhất) thông qua scipy.stats.mode để 
           vứt bỏ biên độ nhiễu và lấy đúng góc nghiêng tổng thể của dòng văn bản.
        5. Nhân với Ma trận xoay cv2.getRotationMatrix2D để bù trừ góc.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
            
        # 1. Tìm viền (edges) bằng Canny
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        
        # 2. Tìm các line segments
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=50, maxLineGap=10)
        
        if lines is None:
            return image
            
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            # 3. Tính góc bằng hàm arctan2 theo trục ngang (x)
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            
            # Chỉ lấy các đường kẻ ngang có góc nghiêng trong khoảng giới hạn (-45 đến 45 độ)
            # Không lấy các đường kẻ dọc của bảng biểu
            if -45 < angle < 45:
                angles.append(angle)
                
        if not angles:
            return image
            
        # 4. Tìm góc chủ đạo bằng Yếu Vị (Mode) sau khi làm tròn
        angles_rounded = np.round(angles, decimals=1)
        mode_result = stats.mode(angles_rounded, keepdims=True)
        median_angle = float(mode_result.mode[0]) # Ép kiểu float
        
        # 5. Tâm quay (center) và Ma trận biến đổi Affine
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        
        # Thay vì sinh ra viền đen (Border Constant), ta sao chép viền bằng BORDER_REPLICATE
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return rotated

    def optimize_for_ocr(self, image):
        """
        Tăng cường hình thái ký tự, bao gồm Resizing để nâng DPI, lọc nhiễu bảo đảm 
        sắc nét đường viền và phân ngưỡng cực đoan.
        
        Logic toán học & xử lý ảnh:
        1. Resizing: Mở rộng ảnh (Scale) sử dụng nội suy bậc 3 (INTER_CUBIC Interpolation) 
           để tính toán mướt các pixel mọc thêm, giúp nét chữ chống vỡ hạt nhòe gồ ghề.
        2. Khử nhiễu không hướng (Bilateral Filter): Thay vì dùng Gaussian làm nhòe mọi thứ,
           Bilateral so sánh khoảng cách không gian VÀ sự chênh lệch màu sắc (intensity).
           Pixel ở viền chữ đổi màu đột ngột sẽ không bị làm mờ chéo đi.
        3. Phân ngưỡng hình Sin (Adaptive Gaussian): Thuật toán gán 255 hoặc 0 bằng cách
           áp một kernel có phân phối xác suất Gaussian lướt qua để so sánh với điểm ảnh khu vực.
        """
        # 1. Tăng gấp đôi độ phân giải ảnh để Tesseract nhận dạng nét thanh tốt hơn
        (h, w) = image.shape[:2]
        resized = cv2.resize(image, (w*2, h*2), interpolation=cv2.INTER_CUBIC)
        
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized
            
        # 2. Lọc Bilateral (d=9: đường kính ảnh hưởng, sigmaColor=75, sigmaSpace=75)
        filtered = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)
        
        # 3. Phân ngưỡng Adaptive Thresholding
        binary = cv2.adaptiveThreshold(
            filtered, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 
            blockSize=31, C=15 # blockSize tăng do ảnh đã phình to x2
        )
        return binary

    def auto_crop(self, image):
        """
        Định vị biên lai hóa đơn và Cắt phẳng (Perspective Transform).
        
        Logic toán học & xử lý ảnh:
        1. Tìm tập hợp điểm biên bao quanh (Contours). Sắp xếp diện tích giảm dần.
        2. Sử dụng chuỗi Đa giác xấp xỉ cv2.approxPolyDP để ép contour vòng cung thành tứ giác.
        3. Bóc tách và sắp xếp lại 4 đỉnh: Trái-Trên (TL), Kéo-Trên (TR), Dưới-Phải (BR), Dưới-Trái (BL).
        4. Trải ma trận biến đổi phối cảnh 3x3 để dàn phẳng bề mặt bị bóp méo hình thang. 
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
            
        # Hỗ trợ tìm contour với cạnh cứng
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 75, 200)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
        
        receipt_contour = None
        (h, w) = image.shape[:2]
        
        for c in contours:
            peri = cv2.arcLength(c, True)
            # Chấp nhận sai số nội suy 2% để bao khép kín thành đa giác
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            
            # Điều kiện: Contour lớn (trên 10% bề mặt ảnh) và có 4 cạnh
            if len(approx) == 4 and cv2.contourArea(c) > (h * w * 0.1):
                receipt_contour = approx
                break
                
        if receipt_contour is None:
            return image # Không tìm thấy mép giấy, giữ nguyên ảnh
            
        # Ép phẳng ma trận 3D về 2D (4, 2) tọa độ x, y
        pts = receipt_contour.reshape(4, 2)
        rect = np.zeros((4, 2), dtype="float32")
        
        # Top-Left có tổng tọa độ (x+y) nhỏ nhất, Bottom-Right có tổng lớn nhất
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)] 
        rect[2] = pts[np.argmax(s)] 
        
        # Top-Right có hiệu (y-x) nhỏ nhất, Bottom-Left có hiệu lớn nhất
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)] 
        rect[3] = pts[np.argmax(diff)] 
        
        (tl, tr, br, bl) = rect
        
        # Đo chiều cao và chiều ngang lớn nhất mới có thể có
        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))
        
        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))
        
        # Hình chữ nhật phẳng muốn nhận
        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]], dtype="float32")
            
        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
        
        return warped

    def process(self, image_input):
        """
        Trái tim hệ thống - Kết hợp nối tiếp toàn bộ các phương án tiền xử lý (Pipeline).
        Dòng chảy: Loại Khử Bóng -> Xoay Cân Bằng -> (Cắt Viền nếu có thẻ) -> Nâng Cấp Ký Tự
        """
        if isinstance(image_input, str):
            image = cv2.imread(image_input)
            if image is None:
                raise ValueError(f"CRITICAL: Không thể đọc ảnh. Kiểm tra lại đường dẫn: {image_input}")
        else:
            image = image_input
            
        # 1. Triệt tiêu vùng bóng đen cục bộ
        img_shadow_free = self.remove_shadows(image)
        
        # 2. Xoay chỉnh thẳng nếu chụp xiên véo
        img_deskewed = self.correct_skew(img_shadow_free)
        
        # 3. Phối cảnh cắt thẳng lấy phần hình chữ nhật hóa đơn
        img_cropped = self.auto_crop(img_deskewed)
        
        # 4. Filter Bilateral, Resize DPI và Tách nền chữ
        img_final = self.optimize_for_ocr(img_cropped)
        
        return img_final


# =============================================================================
# KHU VỰC THỬ NGHIỆM VÀ KHỞI CHẠY (TESTING AREA)
# =============================================================================
if __name__ == "__main__":
    # Điền ảnh test của bạn
    sample_path = "test_invoice.jpg" 
    
    try:
        # Khởi tạo mô hình
        print("====== KHỞI ĐỘNG HỆ THỐNG UNIVERSAL OCR PIPELINE ======")
        ocr_bot = OCRProcessor()
        
        print("[1] Bắt đầu xử lý tính toán điểm ảnh (Shadows, Deskew, Crop, Resize)...")
        ready_img = ocr_bot.process(sample_path)
        
        print("[2] Ảnh đã sẵn sàng. Chuyển giao về Engine Tesseract...")
        custom_config = r'--oem 3 --psm 6'
        result_text = pytesseract.image_to_string(ready_img, lang='vie+eng', config=custom_config)
        
        print("\n\n======== KẾT QUẢ VĂN BẢN TRÍCH XUẤT ========")
        print(result_text)
        print("============================================")
        
    except Exception as e:
        print(f"Xảy ra lỗi hạ tầng: {e}")
