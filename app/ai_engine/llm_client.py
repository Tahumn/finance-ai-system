# Chức năng: sinh phản hồi tự nhiên, trích xuất entity bằng AI
import json
import os
from openai import OpenAI

client = OpenAI()


def is_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def generate_text(prompt: str, model: str = "gpt-4o-mini") -> str:
    response = client.responses.create(
        model=model,
        input=prompt,
    )
    return (response.output_text or "").strip()


def extract_with_llm(text: str, model: str = "gpt-4o-mini") -> dict:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Trích xuất dữ liệu tài chính thành JSON theo schema."},
            {"role": "user", "content": text},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "transaction_extract",
                "schema": {
                    "type": "object",
                    "properties": {
                        "amount": {"type": "number"},
                        "type": {"type": "string", "enum": ["income", "expense"]},
                        "category": {"type": "string"},
                        "date": {"type": "string"},
                        "note": {"type": "string"},
                    },
                    "required": ["amount", "type", "category", "date", "note"],
                    "additionalProperties": False,
                },
            },
            "strict": True,
        },
    )
    content = response.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {}
