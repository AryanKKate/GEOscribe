import requests

url = "http://127.0.0.1:5000/geo-metrics"

ai_answer = """
Ajit Pawar is an Indian politician and senior leader of the Nationalist Congress Party.
He has served multiple times as the Deputy Chief Minister of Maharashtra.
He is known for his influence in state politics and his role in the 2023 NCP split.
"""

payload = {
    "ai_answer": ai_answer,
    "urls": [
        "https://en.wikipedia.org/wiki/Ajit_Pawar"
    ]
}

response = requests.post(url, json=payload)

print("Status Code:", response.status_code)
data = response.json()

print("\n=== GEO METRICS ===")
print(data)
