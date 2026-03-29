import os
import sys

# Ensure app is in path
sys.path.insert(0, os.path.abspath("."))

from app.ai_agent.service import _parse_amount, _extract_total_from_lines, _extract_merchant_from_lines

text3 = """CÔNG TY CỔNG VÀNG
HÓA ĐƠN XUẤT HÓA ĐƠN CHO:
Hóa đơn #12345 TRình Thanh Hương
Ngày 16/06/2025 SĐT: +84 912 345 678
Tổng trước thuế: 12.000.000đ
Thuế: 0đ
Tổng cộng: 12.000.000đ"""
lines3 = text3.split('\n')
print("Lines 3 Total:", _extract_total_from_lines(lines3))
print("Lines 3 Merchant:", _extract_merchant_from_lines(lines3))

text2 = "Hồ sơ thanh toán\n \nTổng tiền: 550.000.000\nThuế VAT: 50.000.000"
lines2 = text2.split('\n')
print("Lines 2 Total:", _extract_total_from_lines(lines2))

print("Parse 12.000.000đ:", _parse_amount("12.000.000đ"))
print("Parse 550.000.000:", _parse_amount("550.000.000"))
