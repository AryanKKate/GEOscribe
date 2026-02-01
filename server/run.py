import requests
import json

GEO_AGENT_URL = "http://127.0.0.1:5000/geo-agent"

payload = {
    "query": "What is Generative Engine Optimization (GEO) and how is it different from SEO?"
}

headers = {
    "Content-Type": "application/json"
}

def test_geo_agent():
    print("🚀 Sending request to GEO Agent...\n")

    response = requests.post(
        GEO_AGENT_URL,
        headers=headers,
        json=payload,
        timeout=300  # GEO agent can take time (scraping + LLM)
    )

    print("Status Code:", response.status_code)
    print("-" * 80)

    if response.status_code != 200:
        print("❌ Error response:")
        print(response.text)
        return

    data = response.json()

    print("✅ QUERY")
    print(data.get("query"))
    print("\n" + "=" * 80)

    print("🧠 AI ANSWER (TRUNCATED)")
    print(data.get("ai_answer", "")[:1000])
    print("\n" + "=" * 80)

    print("🔗 REFERENCED URLS")
    for url in data.get("referenced_urls", []):
        print("-", url)
    print("\n" + "=" * 80)

    print("📌 GEO RECOMMENDATIONS")
    print(data.get("recommendations"))
    print("\n" + "=" * 80)

    print("🌐 GENERATED WEBPAGE (STRUCTURED)")
    generated = data.get("generated_webpage")
    print(json.dumps(generated, indent=2) if generated else "None")

if __name__ == "__main__":
    test_geo_agent()
