import re

def test_parse_amount(text):
    # Optimized parser for Vietnamese Currency (VND).
    normalized = text.lower()
    # Repair Tesseract spacing issues
    normalized = re.sub(r"(?<=\d)\s*([.,])\s*(?=\d)", r"\1", normalized)
    
    # VND Specific: In 99% of receipts, any dot/comma followed by exactly 3 digits is a thousand separator.
    # This is the critical fix for "35,000" vs "35.0"
    normalized = re.sub(r"([.,])(?=\d{3}(?:\D|$))", "", normalized)
    
    print(f"Input: {text} -> Cleaned: {normalized}")
    
    # Simple regex for finding numbers
    matches = re.findall(r"\d+", normalized)
    if not matches:
        return None
        
    values = [float(m) for m in matches]
    # Filter out small quantities like "1", "2" if there are larger numbers
    large_values = [v for v in values if v >= 1000]
    if large_values:
        return max(large_values)
    return max(values) if values else None

test_cases = [
    "31,500",
    "35.000",
    "1 item(s) 11.000",
    "Total: 1.250.000 VND",
    "Cash: 202,000",
    "Change: 170,500",
    "1 DC 9,500"
]

for tc in test_cases:
    print(f"Result: {test_parse_amount(tc)}")
