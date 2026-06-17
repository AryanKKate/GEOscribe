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
from keybert import KeyBERT
from langgraph.graph import StateGraph
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from typing import TypedDict, List, Optional, Any
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


def generate_ai_answer(query: str):
    completion = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": query +
                " Generate in depth-ans, refer any sources if needed."
            }
        ]
    )

    return completion.choices[0].message.content


def collect_structure_internal(urls):
    if isinstance(urls, str):
        urls = [urls]

    results = []

    for url in urls:
        try:
            markdown = firecrawl_scrape(url)

            content_id = (
                f"{url}_{int(datetime.utcnow().timestamp())}"
            )

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

    return results


semantic_model = None
kw_model = None

def get_semantic_model():
    global semantic_model

    if semantic_model is None:
        semantic_model = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

    return semantic_model

def get_kw_model():
    global kw_model

    if kw_model is None:
        kw_model = KeyBERT()

    return kw_model

geo_llm = ChatGroq(
    api_key=os.environ.get("GROQ_API_KEY"),
    model="llama-3.1-8b-instant",
    temperature=0.2
)

# --------------------
# Helper: safe node wrapper
# --------------------
def safe_node(fn):
    def wrapper(state):
        try:
            return fn(state)
        except KeyError as e:
            key = e.args[0]
            state[key] = None
            return state
        except Exception as e:
            state["error"] = str(e)
            return state
    return wrapper

# =========================================================
# EXISTING /ask
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
# Scraping & Structure
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
        if has_bullets:
            bullet_sections += 1
        structured_sections.append({
            "heading": sec["heading"],
            "level": sec["level"],
            "word_count": word_count,
            "has_bullets": has_bullets,
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
        return jsonify({"error": "Invalid or empty JSON"}), 400
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

def semantic_score(text_a: str, text_b: str) -> float:
    model = get_semantic_model()
    embeddings = model.encode([text_a, text_b])
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
# GEO Agent Nodes
# =========================================================
class GEOState(TypedDict, total=False):
    query: str
    ai_answer: str
    urls: List[str]
    competitors: list
    causal_analysis: str
    recommendations: dict   # 🔥 FIX
    generated_page: dict    # 🔥 FIX
    error: str
def node_finalize(state: GEOState):
    return state

def node_ai_answer(state: GEOState):
    query = state.get("query")

    if not query:
        state["ai_answer"] = "No query provided"
        return state

    try:
        state["ai_answer"] = generate_ai_answer(query)

    except Exception as e:
        state["ai_answer"] = ""
        state["error"] = str(e)

    return state




@safe_node
def node_extract_refs(state: GEOState):
    state["urls"] = list(set(re.findall(r"https?://[^\s,\]]+", state.get("ai_answer", ""))))
    return state

@safe_node

def node_collect_structure(state: GEOState):

    if not state.get("urls"):
        state["competitors"] = []
        return state

    state["competitors"] = collect_structure_internal(
        state["urls"]
    )

    return state


@safe_node
def node_causal_reasoning(state: GEOState):
    prompt = f"""
AI Answer:
{state.get('ai_answer','')[:3000]}

Competitor structures:
{json.dumps(state.get('competitors', []), indent=2)[:4000]}

Explain WHY these pages were selected by a generative AI.
Focus on:
- Structure
- Clarity
- Section hierarchy
- Bullets
- Definitions

Return JSON.
"""
    res = geo_llm.invoke([HumanMessage(content=prompt)])
    state["causal_analysis"] = res.content
    return state

@safe_node
def node_recommendations(state: GEOState):
    prompt = f"""
Causal Analysis:
{state.get('causal_analysis','')}

What should OUR website add or improve to be reused by AI engines?

Focus on:
- Missing sections
- Content formats
- Structural improvements

Return STRICT JSON in this format:
{{
  "competitor_analysis": [...],
  "missing_sections": ["..."],
  "content_formats": ["..."],
  "structural_improvements": ["..."],
  "final_summary": "..."
}}
"""
    res = geo_llm.invoke([HumanMessage(content=prompt)])
    raw = res.content.strip()

    try:
        parsed = json.loads(re.sub(r"```json|```", "", raw))
        state["recommendations"] = {
            "structured": parsed,
            "raw_text": raw
        }
    except Exception:
        state["recommendations"] = {
            "structured": None,
            "raw_text": raw
        }

    return state

@app.route("/health")
def health():
    return jsonify({
        "status": "healthy"
    }), 200

@safe_node
def node_generate_webpage(state: GEOState):
    prompt = f"""
You are a Generative Engine Optimization (GEO) content architect.

AI Answer:
{state.get('ai_answer','')[:2000]}

GEO Recommendations:
{json.dumps(state.get('recommendations',{}), indent=2)[:3000]}

Generate a COMPLETE, STRUCTURED webpage.

Return STRICT JSON in this format:
{{
  "page_title": "...",
  "meta_description": "...",
  "executive_summary": "...",
  "sections": [
    {{
      "heading": "H2 ...",
      "summary": "...",
      "content": "...",
      "bullets": ["..."],
      "definition": null
    }}
  ],
  "faq": [
    {{ "question": "...", "answer": "..." }}
  ],
  "internal_linking_suggestions": ["..."],
  "schema_hints": {{
    "article": true,
    "faq": true
  }}
}}
"""
    res = geo_llm.invoke([HumanMessage(content=prompt)])
    raw = res.content.strip()

    try:
        parsed = json.loads(re.sub(r"```json|```", "", raw))
        state["generated_page"] = parsed
    except Exception:
        state["generated_page"] = {"raw_text": raw}

    return state


# =========================================================
# Build the GEO Agent Graph
# =========================================================
def build_geo_agent():
    g = StateGraph(GEOState)

    g.add_node("ai", node_ai_answer)
    g.add_node("refs", node_extract_refs)
    g.add_node("struct", node_collect_structure)
    g.add_node("cause", node_causal_reasoning)
    g.add_node("reco", node_recommendations)
    g.add_node("generate_page", node_generate_webpage)
    g.add_node("final", node_finalize)

    g.set_entry_point("ai")

    g.add_edge("ai", "refs")
    g.add_edge("refs", "struct")
    g.add_edge("struct", "cause")
    g.add_edge("cause", "reco")
    g.add_edge("reco", "generate_page")
    g.add_edge("generate_page", "final")

    g.set_finish_point("final")

    return g.compile()





geo_agent = build_geo_agent()

# =========================================================
# New /geo-agent endpoint
# =========================================================
@app.route("/geo-agent", methods=["POST"])
def geo_agent_endpoint():
    data = request.get_json(force=True)
    query = data.get("query")
    if not query:
        return jsonify({"error": "query required"}), 400

    # Add query to initial state
    initial_state = {"query": query + " Give references to urls you used to answer."}

    # Debug print
    print("[GEO] Initial state:", initial_state)

    result = geo_agent.invoke({
    "query": query + " Give references to urls you used to answer."
})


    if result is None:
        return jsonify({
            "query": query,
            "ai_answer": None,
            "referenced_urls": [],
            "recommendations": None,
            "generated_webpage": None,
            "error": "GEO agent returned None"
        }), 500

    return jsonify({
        "query": query,
        "ai_answer": result.get("ai_answer"),
        "referenced_urls": result.get("urls"),
        "recommendations": result.get("recommendations"),
        "generated_webpage": result.get("generated_page")
    }), 200




# =========================================================
# RUN SERVER
# =========================================================
if __name__ == "__main__":
    port = int(
        os.environ.get("PORT", 5000)
    )

    app.run(
        host="0.0.0.0",
        port=port
    )
