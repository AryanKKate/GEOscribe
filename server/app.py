import os
import re
import json
import requests
from flask import Flask, request, jsonify
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import numpy as np
from collections import Counter
from sklearn.cluster import KMeans
from keybert import KeyBERT
import math

# --------------------
# Initialization
# --------------------
load_dotenv()
app = Flask(__name__)

# --------------------
# Clients & Config
# --------------------
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY")
FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1/scrape"

SCRAPED_CONTENT_CACHE = {}

STOPWORDS = set([
    "the", "is", "and", "of", "to", "in", "for", "on", "with",
    "a", "an", "by", "as", "are", "that", "this"
])

semantic_model = SentenceTransformer("all-MiniLM-L6-v2")
kw_model = KeyBERT()

# =========================================================
# EXISTING FUNCTIONALITY
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
            messages=[{"role": "user", "content": query + " Generate in depth-ans, refer any sources if needed."}],
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
# CONTENT SCRAPING & STRUCTURE EXTRACTION
# =========================================================

def firecrawl_scrape(url: str) -> str:
    headers = {"Authorization": f"Bearer {FIRECRAWL_API_KEY}", "Content-Type": "application/json"}
    payload = {"url": url, "formats": ["markdown"], "onlyMainContent": True}
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
            current = {"heading": match.group(2).strip(), "level": f"H{len(match.group(1))}", "content": []}
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
    return {"sections": structured_sections, "metrics": metrics}

@app.route('/collect-structure', methods=['POST'])
def collect_structure():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid or empty JSON body", "hint": "Send JSON like { \"urls\": \"https://example.com\" }"}), 400
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
            results.append({"url": url, "content_id": content_id, "structure_fingerprint": structure, "timestamp": datetime.utcnow().isoformat()})
        except Exception as e:
            results.append({"url": url, "error": str(e)})
    return jsonify({"status": "success", "count": len(results), "results": results}), 200

# =========================================================
# SEMANTIC / NLP UTILITIES
# =========================================================

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

def extract_topics_from_text(text, top_k=20):
    words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
    filtered = [w for w in words if w not in STOPWORDS]
    return set([w for w, _ in Counter(filtered).most_common(top_k)])

def extract_topics_from_structure(structure):
    topics = set()
    for sec in structure["sections"]:
        words = re.findall(r"\b[a-zA-Z]{4,}\b", sec["heading"].lower())
        topics.update([w for w in words if w not in STOPWORDS])
    return topics

def topics_included(ai_text, competitor_topics):
    ai_topics = extract_topics_from_text(ai_text)
    return sorted(ai_topics & competitor_topics)

def topics_missing(ai_text, competitor_topics):
    ai_topics = extract_topics_from_text(ai_text)
    return sorted(competitor_topics - ai_topics)

def topics_weak(ai_text, competitor_topics, min_mentions=2):
    weak = []
    for topic in competitor_topics:
        count = len(re.findall(rf"\b{topic}\b", ai_text.lower()))
        if 0 < count < min_mentions:
            weak.append(topic)
    return weak

def structural_preferences(ai_struct, comp_structs):
    avg_comp = {
        "avg_words_per_section": sum(c["metrics"]["avg_words_per_section"] for c in comp_structs) / len(comp_structs),
        "bullet_ratio": sum(c["metrics"]["bullet_section_ratio"] for c in comp_structs) / len(comp_structs),
        "h2_density": sum(c["metrics"]["h2_count"] for c in comp_structs) / len(comp_structs)
    }
    ai = ai_struct["metrics"]
    return {
        "prefers_short_sections": ai["avg_words_per_section"] < avg_comp["avg_words_per_section"],
        "prefers_bullets": ai["bullet_section_ratio"] > avg_comp["bullet_ratio"],
        "heading_depth_bias": "deeper" if ai["h2_count"] > avg_comp["h2_density"] else "shallower"
    }

# =========================================================
# GEO EVALUATION (EXISTING)
# =========================================================

@app.route('/geo-evaluate', methods=['POST'])
def geo_evaluate_reused():
    data = request.get_json(force=True)
    ai_answer = data.get("ai_answer")
    competitors = data.get("competitors")
    if not ai_answer or not competitors:
        return jsonify({"error": "ai_answer and competitors required"}), 400
    ai_structure = extract_structure(ai_answer)
    ai_topics = extract_topics_from_text(ai_answer)
    results = []
    competitor_structures = []
    for comp in competitors:
        try:
            url = comp["url"]
            content_id = comp["content_id"]
            markdown = SCRAPED_CONTENT_CACHE.get(content_id, "")
            comp_structure = comp.get("structure_fingerprint")
            competitor_structures.append(comp_structure)
            comp_topics = extract_topics_from_structure(comp_structure)
            evaluation = {
                "url": url,
                "semantic_score": semantic_score(ai_answer, markdown),
                "pawc": pawc(ai_answer, markdown),
                "raw_word_coverage": raw_word_coverage(ai_answer, markdown),
                "citation_frequency": citation_frequency(ai_answer, url),
                "structural_depth": {
                    "ai": ai_structure["metrics"],
                    "competitor": comp_structure["metrics"],
                    "difference": structural_depth_diff(ai_structure, comp_structure)
                },
                "topic_analysis": {
                    "included_topics": topics_included(ai_answer, comp_topics),
                    "missing_topics": topics_missing(ai_answer, comp_topics),
                    "weak_topics": topics_weak(ai_answer, comp_topics)
                }
            }
            results.append(evaluation)
        except Exception as e:
            results.append({"url": comp.get("url"), "error": str(e)})
    return jsonify({
        "status": "success",
        "geo_metrics": results,
        "structural_preferences": structural_preferences(ai_structure, competitor_structures),
        "timestamp": datetime.utcnow().isoformat()
    }), 200

# =========================================================
# NLP PREPROCESSING UTILITIES FOR LLM RECOMMENDATIONS
# =========================================================

def clean_text(text):
    return re.sub(r"\s+", " ", text).strip()

def summarize_answer(answer, max_words=300):
    if len(answer.split()) <= max_words:
        return answer
    # Use Groq LLM for summarization if needed
    completion = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": f"Summarize this text in under {max_words} words:\n{answer}"}]
    )
    return completion.choices[0].message.content

def cluster_answer_sentences(answer, n_clusters=5):
    sentences = re.split(r'(?<=[.!?]) +', answer)
    embeddings = semantic_model.encode(sentences)
    kmeans = KMeans(n_clusters=min(n_clusters, len(sentences)), random_state=42)
    labels = kmeans.fit_predict(embeddings)
    clustered = []
    for i in range(max(labels)+1):
        idxs = [j for j, l in enumerate(labels) if l == i]
        representative = sentences[idxs[0]]
        clustered.append(representative)
    return clustered

def highlight_weak_topics(answer, competitor_topics):
    weak = topics_weak(answer, competitor_topics)
    if weak:
        return answer + "\n\n# Weakly covered topics: " + ", ".join(weak)
    return answer

# =========================================================
# NEW ENDPOINT: GEO RECOMMENDATIONS
# =========================================================

def parse_llm_json(llm_text):
    """
    Extracts JSON from LLM output even if wrapped in ```json ... ```
    """
    # Remove code fences if present
    llm_text = re.sub(r"```json|```", "", llm_text, flags=re.IGNORECASE).strip()
    try:
        return json.loads(llm_text)
    except json.JSONDecodeError as e:
        # fallback: return raw text if parsing fails
        return {"raw_text": llm_text, "error": str(e)}

@app.route('/geo-recommendations', methods=['POST'])
def geo_recommendations():
    data = request.get_json(force=True)
    ai_answer = data.get("ai_answer")
    competitors = data.get("competitors")
    if not ai_answer or not competitors:
        return jsonify({"error": "ai_answer and competitors required"}), 400

    recommendations = []

    for comp in competitors:
        try:
            url = comp["url"]
            content_id = comp["content_id"]
            markdown = SCRAPED_CONTENT_CACHE.get(content_id, "")
            comp_structure = comp.get("structure_fingerprint")
            comp_topics = extract_topics_from_structure(comp_structure)

            # NLP preprocessing on AI answer
            processed_answer = clean_text(ai_answer)
            processed_answer = summarize_answer(processed_answer)
            processed_answer = " ".join(cluster_answer_sentences(processed_answer))
            processed_answer = highlight_weak_topics(processed_answer, comp_topics)

            prompt = f"""
            You are a GEO optimization assistant.
            Website content:
            {markdown[:4000]}

            AI-generated answer:
            {processed_answer[:4000]}

            Competitor topics:
            {', '.join(comp_topics)}

            Provide structured recommendations for this website to improve:
            1. Missing Sections or Concepts
            2. Recommended Content Formats (FAQ, Steps, Glossary)
            3. Structural Improvements (headings, bullets, summaries)
            Explain why each recommendation is helpful for generative AI.
            Return output as JSON with keys: type, details, why.
            """

            completion = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}]
            )

            recommendation_json = completion.choices[0].message.content
            parsed_recommendations = parse_llm_json(recommendation_json)

            recommendations.append({"url": url, "recommendations": parsed_recommendations})

        except Exception as e:
            recommendations.append({"url": comp.get("url"), "error": str(e)})

    return jsonify({"status": "success", "recommendations": recommendations, "timestamp": datetime.utcnow().isoformat()}), 200

# =========================================================
# RUN SERVER
# =========================================================
if __name__ == '__main__':
    app.run(debug=True)
