import os
import re
import requests
from flask import Flask, request, jsonify
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import numpy as np

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
SCRAPED_CONTENT_CACHE = {}

@app.route('/ask', methods=['POST'])
def geo_answer_generation():
    data = request.get_json()
    query = data.get("query")

    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": query+ "Generate in depth-ans, refer any sources if needed."}],
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
            content_id = f"{url}_{int(datetime.utcnow().timestamp())}"

            SCRAPED_CONTENT_CACHE[content_id] = markdown
            structure = extract_structure(markdown)

            results.append({
                "url": url,
                "content_id": content_id,
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
# NEW: SEMANTIC SIMILARITY SCORING

semantic_model = SentenceTransformer("all-MiniLM-L6-v2")

def semantic_score(text_a: str, text_b: str) -> float:
    embeddings = semantic_model.encode([text_a, text_b])
    a, b = embeddings[0], embeddings[1]
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def raw_word_coverage(ai_text: str, competitor_text: str) -> float:
    ai_words = set(re.findall(r"\b\w+\b", ai_text.lower()))
    comp_words = set(re.findall(r"\b\w+\b", competitor_text.lower()))

    if not comp_words:
        return 0.0

    return len(ai_words & comp_words) / len(comp_words)

def citation_frequency(ai_text: str, url: str) -> int:
    domain = re.sub(r"https?://(www\.)?", "", url).split("/")[0]
    return len(re.findall(domain, ai_text, re.IGNORECASE))

def pawc(ai_text: str, competitor_text: str) -> float:
    ai_sentences = re.split(r'(?<=[.!?])\s+', ai_text)
    total = 0.0

    for idx, sent in enumerate(ai_sentences):
        if any(word in sent.lower() for word in competitor_text.lower().split()[:50]):
            weight = np.exp(-idx)
            total += len(sent.split()) * weight

    return round(total, 3)

def structural_depth_diff(ai_struct: dict, comp_struct: dict) -> dict:
    return {
        "h1_diff": ai_struct["metrics"]["h1_count"] - comp_struct["metrics"]["h1_count"],
        "h2_diff": ai_struct["metrics"]["h2_count"] - comp_struct["metrics"]["h2_count"],
        "h3_diff": ai_struct["metrics"]["h3_count"] - comp_struct["metrics"]["h3_count"]
    }

@app.route('/geo-evaluate', methods=['POST'])
def geo_evaluate_reused():
    data = request.get_json(force=True)

    ai_answer = data.get("ai_answer")
    competitors = data.get("competitors")

    if not ai_answer or not competitors:
        return jsonify({
            "error": "ai_answer and competitors required"
        }), 400

    ai_structure = extract_structure(ai_answer)

    results = []

    for comp in competitors:
        try:
            url = comp["url"]
            content_id = comp["content_id"]
            markdown = SCRAPED_CONTENT_CACHE.get(content_id, "")

            comp_structure = comp.get("structure_fingerprint")

            evaluation = {
                "url": url,
                "semantic_score": semantic_score(ai_answer, markdown),
                "pawc": pawc(ai_answer, markdown),
                "raw_word_coverage": raw_word_coverage(ai_answer, markdown),
                "citation_frequency": citation_frequency(ai_answer, url),
                "structural_depth": {
                    "ai": ai_structure["metrics"],
                    "competitor": comp_structure["metrics"],
                    "difference": structural_depth_diff(
                        ai_structure,
                        comp_structure
                    )
                }
            }

            results.append(evaluation)

        except Exception as e:
            results.append({
                "url": comp.get("url"),
                "error": str(e)
            })

    return jsonify({
        "status": "success",
        "geo_metrics": results,
        "timestamp": datetime.utcnow().isoformat()
    }), 200


# =========================================================
# RUN
# =========================================================
if __name__ == '__main__':
    app.run(debug=True)