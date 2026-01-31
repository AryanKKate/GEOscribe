import os
import re
import json
from urllib import response
import requests
from typing import Dict, Any, List

from langgraph.graph import StateGraph
from langchain_core.messages import HumanMessage

from langchain_groq import ChatGroq

# ======================================================
# CONFIG
# ======================================================

FLASK_BASE_URL = "http://127.0.0.1:5000"

GROQ_API_KEY = "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"
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not set")

llm = ChatGroq(
    groq_api_key=GROQ_API_KEY,
    model_name="llama-3.1-8b-instant",
    temperature=0.2
)

# ======================================================
# SHARED STATE
# ======================================================

class GEOState(dict):
    """
    Keys:
    - query
    - ai_answer
    - referenced_urls
    - competitor_structures
    - causal_analysis
    - recommendations
    """
    pass

# ======================================================
# NODE 1 — AI ANSWER (uses /ask)
# ======================================================

def ai_answer_node(state: GEOState) -> GEOState:
    resp = requests.post(
        f"{FLASK_BASE_URL}/ask",
        json={"query": state["query"]}
    )
    resp.raise_for_status()

    state["ai_answer"] = resp.json()["raw_answer"]
    return state

# ======================================================
# NODE 2 — EXTRACT REFERENCED URLS
# ======================================================

def reference_extraction_node(state: GEOState) -> GEOState:
    text = state["ai_answer"]

    urls = re.findall(r"https?://[^\s,\)\]]+", text)
    state["referenced_urls"] = list(set(urls))

    return state

# ======================================================
# NODE 3 — COLLECT STRUCTURE (uses /collect-structure)
# ======================================================

def structure_collection_node(state: GEOState) -> GEOState:
    urls = state.get("referenced_urls", [])

    if not urls:
        state["competitor_structures"] = []
        return state

    resp = requests.post(
        f"{FLASK_BASE_URL}/collect-structure",
        json={"urls": urls}
    )
    resp.raise_for_status()

    results = resp.json()["results"]

    structures = []
    for r in results:
        if "error" not in r:
            structures.append({
                "url": r["url"],
                "structure": r["structure_fingerprint"]
            })

    state["competitor_structures"] = structures
    return state

# ======================================================
# NODE 4 — CAUSAL REASONING AGENT
# WHY did the LLM choose these pages?
# ======================================================

def causal_reasoning_node(state: GEOState) -> GEOState:
    prompt = f"""
You are a Generative Engine Optimization (GEO) analyst.

AI Answer:
{state["ai_answer"][:3000]}

Referenced page structures:
{json.dumps(state["competitor_structures"], indent=2)[:4000]}

Task:
Explain WHY a generative AI would rely on these pages.

Focus ONLY on:
- Structural clarity
- Presence of definitions
- Timelines
- Bullet lists
- Section depth
- Headings
- FAQ or glossary style content

Return STRICT JSON:
[
  {{
    "url": "https://example.com",
    "causal_signals": [
      "Clear H2 sections defining core concepts",
      "Bullet-point summaries usable for answer synthesis"
    ]
  }}
]
"""

    response = llm.invoke([HumanMessage(content=prompt)])
    text = response.content


    text = re.sub(r"```json|```", "", text).strip()
    try:
        state["causal_analysis"] = json.loads(text)
    except Exception:
        state["causal_analysis"] = {"raw": text}

    return state

# ======================================================
# NODE 5 — GEO RECOMMENDATION AGENT
# What should OUR site add/modify?
# ======================================================

def recommendation_node(state: GEOState) -> GEOState:
    prompt = f"""
You are a GEO optimization assistant.

AI Answer:
{state["ai_answer"][:2000]}

Causal signals from referenced pages:
{json.dumps(state["causal_analysis"], indent=2)[:3000]}

Question:
"What should be added to or modified on OUR website
so that generative AI engines can better understand,
extract, and reuse this content?"

Rules:
- Focus on clarity, structure, completeness
- Do NOT suggest keyword stuffing
- Recommendations must be actionable

Return STRICT JSON:
[
  {{
    "type": "Missing Sections or Concepts",
    "details": ["...", "..."],
    "why": "..."
  }},
  {{
    "type": "Recommended Content Formats",
    "details": ["FAQ", "Steps", "Glossary"],
    "why": "..."
  }},
  {{
    "type": "Structural Improvements",
    "details": ["...", "..."],
    "why": "..."
  }}
]
"""

    response = llm.invoke([HumanMessage(content=prompt)])
    text = response.content
    

    text = re.sub(r"```json|```", "", text).strip()
    try:
        state["recommendations"] = json.loads(text)
    except Exception:
        state["recommendations"] = {"raw": text}

    return state

# ======================================================
# BUILD LANGGRAPH
# ======================================================
def init_state_node(state: dict) -> dict:
    # The incoming state IS the initial state
    return state

def build_geo_agent():
    graph = StateGraph(dict)

    graph.add_node("init", init_state_node)
    graph.add_node("ai_answer", ai_answer_node)
    graph.add_node("extract_refs", reference_extraction_node)
    graph.add_node("collect_structure", structure_collection_node)
    graph.add_node("causal_reasoning", causal_reasoning_node)
    graph.add_node("recommendations", recommendation_node)

    graph.set_entry_point("init")

    graph.add_edge("init", "ai_answer")
    graph.add_edge("ai_answer", "extract_refs")
    graph.add_edge("extract_refs", "collect_structure")
    graph.add_edge("collect_structure", "causal_reasoning")
    graph.add_edge("causal_reasoning", "recommendations")
    graph.add_edge("recommendations", "__end__")

    return graph.compile()


# ======================================================
# RUN SCRIPT
# ======================================================

if __name__ == "__main__":
    geo_agent = build_geo_agent()



    initial_state = {
        "query": "Who is Ajit Pawar and what is his political significance?"
    }

    result = geo_agent.invoke(initial_state)


    print("\n================ AI ANSWER ================\n")
    print(result["ai_answer"])

    print("\n================ REFERENCED URLS ================\n")
    print(result["referenced_urls"])

    print("\n================ CAUSAL ANALYSIS ================\n")
    print(json.dumps(result["causal_analysis"], indent=2))

    print("\n================ GEO RECOMMENDATIONS ================\n")
    print(json.dumps(result["recommendations"], indent=2))
