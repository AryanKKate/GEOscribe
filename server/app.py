import os
from flask import Flask, request, jsonify
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

@app.route('/ask', methods=['POST'])
def geo_answer_generation():
    data = request.get_json()
    query = data.get("query")

    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        # 1. Query the generative model
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": query}]
        )

        # 2. Capture and Store (Simulating user intent response)
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

        # In a real GEO project, you might write this to a database or JSON file here
        return jsonify(geo_answer), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)