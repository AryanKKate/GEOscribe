import os
import re
import requests
from flask import Flask, request, jsonify
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# --------------------
# Clients & Config
# --------------------
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1/scrape"


# =========================================================
# EXISTING FUNCTIONALITY (UNCHANGED)
# =========================================================
@app.route('/ask', methods=['POST'])
def geo_answer_generation():
    data = request.get_json()
    query = data.get("query")

    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": query}]
        )

        geo_answer = {
            "query_used": query,
            "raw_answer": completion.choices[0].message.content,
            "metadata": {
                "id": completion.id,
                "model": completion.model,
                "timestamp": datetime.utcnow().isoformat(),
                "usage": {
                    "prompt_tokens": completion.usage.prompt_tokens,
                    "completion_tokens": completion.usage.completion_tokens,
                    "total_tokens": completion.usage.total_tokens
                },
                "finish_reason": completion.choices[0].finish_reason
            }
        }

        return jsonify(geo_answer), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# NEW: CONTENT & COMPETITOR SIGNAL COLLECTION (GEO LAYER)
# =========================================================

def firecrawl_scrape(url: str) -> str:
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": True
    }

    response = requests.post(FIRECRAWL_BASE_URL, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()["data"]["markdown"]


def extract_structure(markdown: str) -> dict:
    heading_pattern = re.compile(r"^(#{1,3})\s+(.*)", re.MULTILINE)
    lines = markdown.split("\n")

    sections = []
    current = None

    for line in lines:
        match = heading_pattern.match(line)
        if match:
            if current:
                sections.append(current)
            current = {
                "heading": match.group(2).strip(),
                "level": f"H{len(match.group(1))}",
                "content": []
            }
        elif current:
            current["content"].append(line)

    if current:
        sections.append(current)

    structured_sections = []
    total_words = 0
    bullet_sections = 0

    for sec in sections:
        content_text = "\n".join(sec["content"]).strip()
        word_count = len(content_text.split())
        total_words += word_count

        has_bullets = bool(re.search(r"^[-*•]\s+", content_text, re.MULTILINE))
        has_numbers = bool(re.search(r"^\d+\.\s+", content_text, re.MULTILINE))
        has_definition = bool(re.search(r"\bis defined as\b|\brefers to\b", content_text, re.I))

        if has_bullets:
            bullet_sections += 1

        structured_sections.append({
            "heading": sec["heading"],
            "level": sec["level"],
            "word_count": word_count,
            "has_bullets": has_bullets,
            "has_numbers": has_numbers,
            "has_definition": has_definition,
            "content_snippet": " ".join(content_text.split()[:60])
        })

    metrics = {
        "total_word_count": total_words,
        "section_count": len(structured_sections),
        "avg_words_per_section": total_words / max(len(structured_sections), 1),
        "bullet_section_ratio": bullet_sections / max(len(structured_sections), 1),
        "h1_count": sum(1 for s in structured_sections if s["level"] == "H1"),
        "h2_count": sum(1 for s in structured_sections if s["level"] == "H2"),
        "h3_count": sum(1 for s in structured_sections if s["level"] == "H3"),
    }

    return {
        "sections": structured_sections,
        "metrics": metrics
    }


# =========================================================
# NEW ENDPOINT: Accept 1 or More URLs
# =========================================================
@app.route('/collect-structure', methods=['POST'])
def collect_structure():
    data = request.get_json(force=True, silent=True)

    if not data:
        return jsonify({
            "error": "Invalid or empty JSON body",
            "hint": "Send JSON like { \"urls\": \"https://example.com\" }"
        }), 400

    urls = data.get("urls")

    if not urls:
        return jsonify({"error": "No URLs provided"}), 400

    if isinstance(urls, str):
        urls = [urls]

    results = []

    for url in urls:
        try:
            markdown = firecrawl_scrape(url)
            structure = extract_structure(markdown)

            results.append({
                "url": url,
                "structure_fingerprint": structure,
                "timestamp": datetime.utcnow().isoformat()
            })

        except Exception as e:
            results.append({
                "url": url,
                "error": str(e)
            })

    return jsonify({
        "status": "success",
        "count": len(results),
        "results": results
    }), 200



# =========================================================
# RUN
# =========================================================
if __name__ == '__main__':
    app.run(debug=True)