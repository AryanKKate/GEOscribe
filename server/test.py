import requests
import json

FLASK_BASE = "http://127.0.0.1:5000"

# --------------------
# Step 1: Ask AI for answer
# --------------------
query = "WHo is Ajit Pawar"

ask_payload = {"query": query}

try:
    resp = requests.post(f"{FLASK_BASE}/ask", json=ask_payload)
    resp.raise_for_status()
    ai_answer = resp.json()["raw_answer"]
    print("✅ AI Answer generated.")
except Exception as e:
    print(f"Failed to get AI answer: {e}")
    exit(1)

# --------------------
# Step 2: Collect competitor structure
# --------------------
competitor_urls = [
"https://en.wikipedia.org/wiki/Ajit_Pawar"
]

collect_payload = {"urls": competitor_urls}

try:
    resp = requests.post(f"{FLASK_BASE}/collect-structure", json=collect_payload)
    resp.raise_for_status()
    collect_results = resp.json()["results"]

    competitors = []
    for comp in collect_results:
        if "error" in comp:
            print(f"⚠ Error collecting {comp['url']}: {comp['error']}")
            continue
        competitors.append({
            "url": comp["url"],
            "content_id": comp["content_id"],
            "structure_fingerprint": comp["structure_fingerprint"]
        })

    if not competitors:
        print("No valid competitors scraped.")
        exit(1)
    print("✅ Competitor structure collected.")

except Exception as e:
    print(f"Failed to collect competitor structure: {e}")
    exit(1)

# --------------------
# Step 3: Request GEO recommendations
# --------------------
recommendation_payload = {
    "ai_answer": ai_answer,
    "competitors": competitors
}

try:
    resp = requests.post(f"{FLASK_BASE}/geo-recommendations", json=recommendation_payload)
    resp.raise_for_status()
    recommendations = resp.json()
    print("✅ GEO Recommendations received:")
    print(json.dumps(recommendations, indent=2))
except Exception as e:
    print(f"Failed to get GEO recommendations: {e}")
