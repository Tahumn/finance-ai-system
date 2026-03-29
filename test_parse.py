import re

UNIT_MULTIPLIER = {
    "k": 1_000, "nghin": 1_000, "ngan": 1_000,
    "tr": 1_000_000, "trieu": 1_000_000, "m": 1_000_000,
    "million": 1_000_000, "ty": 1_000_000_000, "ti": 1_000_000_000,
}
AMOUNT_REGEX = re.compile(
    r"(?P<num>\d+(?:[.,]\d+)*)\s*(?P<unit>k|nghin|ngan|tr|trieu|m|million|ty|ti)?\b"
)

def _parse_amount(text: str):
    # Print the input for debugging
    # Fix Tesseract spacing issue in numbers
    text = re.sub(r"(?<=\d)\s*([.,])\s*(?=\d)", r"\1", text)
    text = re.sub(r"(?<=\d)\s+(?=\d{3}(?:\b|\s|$))", "", text)
    text = re.sub(r"(?<=\d)\s+(?=\d{3}(?:\b|\s|$))", "", text) # run twice for multiple groups

    # Remove dots and commas acting as thousand separators ONLY if they group 3 digits
    text = re.sub(r"\b\d{1,3}(?:\.\d{3})+\b", lambda m: m.group(0).replace(".", ""), text)
    text = re.sub(r"\b\d{1,3}(?:,\d{3})+\b", lambda m: m.group(0).replace(",", ""), text)
    
    matches = []
    for match in AMOUNT_REGEX.finditer(text):
        raw_num = match.group("num")
        value = float(raw_num.replace(",", "."))
        unit = match.group("unit")
        if unit:
            value *= UNIT_MULTIPLIER.get(unit, 1)
        matches.append(value)
    return max(matches) if matches else None

print("Phone:", _parse_amount("+84 912 345 678"))
print("Correct:", _parse_amount("12.000.000d"))
print("Space:", _parse_amount("12 000 000 d"))
print("Space dot:", _parse_amount("12 . 000 . 000 d"))
print("VAT:", _parse_amount("330 000"))
print("Big:", _parse_amount("550. 000 .000"))
print("Comma:", _parse_amount("550,000,000"))
print("Dots:", _parse_amount("550.000.000"))
