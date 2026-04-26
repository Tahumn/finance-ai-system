# ĐỀ CƯƠNG ÔN TẬP TOÁN CAO CẤP (TRỌNG ĐIỂM)

## 📊 Cấu trúc điểm: 2 - 2 - 3 - 3

---

## Câu 1: Giới hạn (Limit) - [2.0 điểm]
Tập trung vào các dạng vô định khi $x \to 0$ và $x \to \infty$.

### 1. Khi $x \to 0$ (Sử dụng Vô cùng bé - VCB)
Thay thế các biểu thức phức tạp bằng các VCB tương đương để đơn giản hóa biểu thức:
* $\sin x \sim x$
* $\ln(1+x) \sim x$
* $e^x - 1 \sim x$
* $1 - \cos x \sim \frac{x^2}{2}$
* $(1+x)^\alpha - 1 \sim \alpha x$

### 2. Khi $x \to \infty$ (Ngắt bỏ Vô cùng lớn bậc thấp)
* Chỉ giữ lại số hạng có lũy thừa cao nhất ở tử và mẫu.
* **Dạng $1^\infty$:** Sử dụng công thức $e^L$ với $L = \lim_{x \to \infty} [f(x)-1] \cdot g(x)$.

---

## Câu 2: Tính liên tục, Đạo hàm, Vi phân & Xấp xỉ - [2.0 điểm]

### 1. Tính liên tục
* Hàm số liên tục tại $x_0$ nếu: $\lim_{x \to x_0^+} f(x) = \lim_{x \to x_0^-} f(x) = f(x_0)$.
* Thường gặp dạng bài: "Tìm $m$ để hàm số liên tục tại điểm $x = a$".

### 2. Đạo hàm và Vi phân
* **Quy tắc đạo hàm:** Nắm chắc đạo hàm hàm hợp $u(v(x))$.
* **Vi phân:** $dy = f'(x)dx$.

### 3. Xấp xỉ tuyến tính
* Công thức: $f(x) \approx f(x_0) + f'(x_0)(x - x_0)$.
* Ứng dụng: Tính gần đúng các giá trị như $\sqrt{4.01}$, $\ln(1.02)$,...

---

## Câu 3: Tích phân - [3.0 điểm]

### Ý 1: Tích phân lượng giác & Đổi biến hữu tỉ
* **Phương pháp:** Đặt $t$ thích hợp để đưa về tích phân hàm phân thức hữu tỉ.
* **Phép thế vạn năng:** Đặt $t = \tan(x/2)$.
    * $\sin x = \frac{2t}{1+t^2}$
    * $\cos x = \frac{1-t^2}{1+t^2}$
    * $dx = \frac{2dt}{1+t^2}$

### Ý 2: Tích phân suy rộng Loại I (Cận vô cực)
* Dạng: $\int_{a}^{+\infty} f(x)dx$.
* **Tiêu chuẩn hội tụ:** $\int_{a}^{+\infty} \frac{1}{x^\alpha} dx$ hội tụ nếu $\alpha > 1$, phân kỳ nếu $\alpha \le 1$.

### Ý 3: Tích phân suy rộng Loại II (Hàm không xác định tại cận)
* Dạng: $\int_{a}^{b} f(x)dx$ với $f(x) \to \infty$ khi $x \to a$ hoặc $x \to b$.
* **Tiêu chuẩn hội tụ:** $\int_{a}^{b} \frac{1}{(b-x)^\alpha} dx$ hội tụ nếu $\alpha < 1$, phân kỳ nếu $\alpha \ge 1$.

---

## Câu 4: Chuỗi số & Chuỗi lũy thừa - [3.0 điểm]

### Ý 1: Khảo sát tính hội tụ của chuỗi số
Sử dụng các tiêu chuẩn phổ biến:
* **D'Alembert:** $D = \lim_{n \to \infty} \left| \frac{a_{n+1}}{a_n} \right|$. (D < 1: Hội tụ).
* **Cauchy:** $C = \lim_{n \to \infty} \sqrt[n]{|a_n|}$. (C < 1: Hội tụ).
* **So sánh:** So sánh với chuỗi $\sum \frac{1}{n^\alpha}$.

### Ý 2: Tìm miền hội tụ của chuỗi lũy thừa $\sum a_n(x-x_0)^n$
1.  **Tính bán kính hội tụ (R):** $R = \lim_{n \to \infty} \left| \frac{a_n}{a_{n+1}} \right|$.
2.  **Xác định khoảng hội tụ:** $(x_0 - R, x_0 + R)$.
3.  **Xét tại hai đầu mút:** Thay $x = x_0 - R$ và $x = x_0 + R$ vào chuỗi ban đầu để xem tại đó chuỗi hội tụ hay phân kỳ. Kết luận miền hội tụ cuối cùng (có thể là $[...)$, $(...]$, hoặc $[...]$).