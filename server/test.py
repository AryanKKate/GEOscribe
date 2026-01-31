import requests
import json

# 1️⃣ API endpoint
url = "http://127.0.0.1:5000/collect-structure"

# 2️⃣ JSON body (single URL)
payload = {
    "urls": "https://en.wikipedia.org/wiki/Ajit_Pawar"
}

# 3️⃣ Headers
headers = {
    "Content-Type": "application/json"
}

# 4️⃣ POST request
response = requests.post(url, json=payload, headers=headers)

# 5️⃣ Parse JSON
data = response.json()

# 6️⃣ Pretty print
print(json.dumps(data, indent=4))
