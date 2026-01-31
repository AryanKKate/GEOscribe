import requests
import json

BASE_URL = "http://127.0.0.1:5000"

QUERY = "Who is Ajit Pawar"
COMPETITOR_URLS = [
    "https://en.wikipedia.org/wiki/Ajit_Pawar"
]

# -----------------------------
# STEP 1: ASK (AI Answer)
# -----------------------------
print("\n[1] Calling /ask ...")

ask_res = requests.post(
    f"{BASE_URL}/ask",
    json={"query": QUERY}
)

ask_res.raise_for_status()
ask_data = ask_res.json()

ai_answer = ask_data["raw_answer"]
print("✔ AI answer received")

# -----------------------------
# STEP 2: COLLECT STRUCTURE
# -----------------------------
print("\n[2] Calling /collect-structure ...")

collect_res = requests.post(
    f"{BASE_URL}/collect-structure",
    json={"urls": COMPETITOR_URLS}
)

collect_res.raise_for_status()
collect_data = collect_res.json()

competitors = []
for result in collect_data["results"]:
  competitors.append({
    "url": result["url"],
    "content_id": result["content_id"],
    "structure_fingerprint": result["structure_fingerprint"]
})



print(f"✔ Collected structure for {len(competitors)} competitors")

# -----------------------------
# STEP 3: GEO EVALUATION
# -----------------------------
print("\n[3] Calling /geo-evaluate ...")

geo_payload = {
    "ai_answer": ai_answer,
    "competitors": competitors
}

geo_res = requests.post(
    f"{BASE_URL}/geo-evaluate",
    json=geo_payload
)

geo_res.raise_for_status()
geo_data = geo_res.json()

print("\n✅ GEO Evaluation Result:\n")
print(json.dumps(geo_data, indent=2))
