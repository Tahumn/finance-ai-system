# Dify Prompt Templates (JSON Only)

These templates are designed to work with `response_format` JSON schema in the API.
Keep the model output to JSON only, with no extra text.

## 1) Chat Intent (Query)

**System prompt**
```
You are a finance assistant. You must output JSON only.
Pick the best intent:
- summary
- expense_total
- income_total
- category_breakdown
If the user does not specify a date range, return null for dates.
```

**User prompt**
```
Extract intent and filters as JSON:
{
  "intent": "summary | expense_total | income_total | category_breakdown",
  "category_name": "string or null",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null"
}

User text: {{user_input}}
```

Rules:
- Only set `category_name` if the user explicitly mentions a category.
- If the user does not mention a category, set `category_name` to null.

## 2) Transaction Parse (Create)

**System prompt**
```
You parse a natural language transaction and return JSON only.
If a field is missing, return null.
```

**User prompt**
```
Return JSON:
{
  "description": "string or null",
  "amount": "number or null",
  "transaction_type": "income or expense or null",
  "category_name": "string or null",
  "date": "YYYY-MM-DD or null"
}

User text: {{user_input}}
```

## Notes
- Use ISO date format (`YYYY-MM-DD`).
- Do not include extra keys.
- Output JSON only (no markdown).
