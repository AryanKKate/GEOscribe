# GEO Agent Recommendations with Reference Links

## Overview
The recommendations section in the GEO Agent (Part 4) should include reference links/URLs to support each recommendation. The frontend now displays recommendations as-is from the backend via `renderJSON()`, so the structure of recommendations needs to be properly formatted in the Flask backend.

## Current Issue
- **Frontend**: Displays recommendations correctly but needs reference links included
- **Backend**: Should generate recommendations with associated URLs/references

## Recommended Backend Response Format

### Option 1: Array of Recommendation Objects (Recommended)
```json
{
  "query": "What is machine learning?",
  "ai_answer": "...",
  "referenced_urls": ["https://...", "https://..."],
  "recommendations": [
    {
      "title": "Add Technical Definitions",
      "description": "Include formal definitions of key ML concepts",
      "reference_url": "https://example.com/ml-definitions",
      "impact": "high",
      "sections": [
        "Introduction should define supervised learning",
        "Explain neural networks in detail"
      ]
    },
    {
      "title": "Include Real-World Examples",
      "description": "Provide practical use cases for each concept",
      "reference_url": "https://example.com/ml-examples",
      "impact": "high",
      "examples": [
        "Email spam filtering",
        "Image recognition systems"
      ]
    },
    {
      "title": "Add Code Snippets",
      "description": "Include Python examples for key algorithms",
      "reference_url": "https://github.com/examples/ml-snippets",
      "impact": "medium",
      "languages": ["Python", "JavaScript"]
    }
  ],
  "generated_webpage": { ... }
}
```

### Option 2: Nested Structure with References
```json
{
  "recommendations": {
    "content_improvements": [
      {
        "id": "technical_depth",
        "title": "Increase Technical Depth",
        "description": "Add more technical concepts and explanations",
        "reference_urls": [
          "https://arxiv.org/abs/...",
          "https://research.google.com/pubs/..."
        ],
        "implementation": "Add 2-3 advanced sections"
      }
    ],
    "structural_improvements": [
      {
        "id": "faq_section",
        "title": "Add FAQ Section",
        "description": "Answer common questions about the topic",
        "reference_url": "https://stackoverflow.com/questions/tagged/machine-learning",
        "questions": [
          "What is the difference between ML and AI?",
          "How do I start learning ML?"
        ]
      }
    ],
    "content_formats": [
      {
        "format": "Code Examples",
        "description": "Add working code snippets",
        "reference_url": "https://github.com/trending?spoken_language_code=&sort=stars",
        "priority": "high"
      }
    ]
  }
}
```

### Option 3: Enhanced String Format with Markdown Links
```json
{
  "recommendations": "**Structure Improvements:**\n1. **Add Clear Sections** - Organize content with H2-H3 hierarchies. Reference: https://example.com/structure\n2. **Include Examples** - Add real-world use cases. Reference: https://github.com/examples\n\n**Content Formats:**\n- **Code Snippets**: https://codepen.io/examples\n- **Diagrams**: https://github.com/diagrams/examples"
}
```

## Frontend Rendering Behavior

The frontend `renderJSON()` function:
- Renders objects as nested key-value pairs
- Renders arrays as bulleted lists
- Renders strings as plain text (supports Markdown if desired)
- Renders URLs as clickable links (if detected)
- Provides scrollable container for large content

## Implementation Steps in Backend

### Step 1: Update `/geo-agent` Route
```python
@app.route('/geo-agent', methods=['POST'])
def geo_agent():
    query = request.json.get('query')
    
    # ... existing AI answer generation code ...
    
    # Generate recommendations with references
    recommendations = generate_recommendations_with_urls(
        query=query,
        ai_answer=ai_answer,
        referenced_urls=referenced_urls
    )
    
    return jsonify({
        'query': query,
        'ai_answer': ai_answer,
        'referenced_urls': referenced_urls,
        'recommendations': recommendations,  # Include reference URLs
        'generated_webpage': generated_webpage
    })
```

### Step 2: Create `generate_recommendations_with_urls()` Function
```python
def generate_recommendations_with_urls(query, ai_answer, referenced_urls):
    """
    Generate recommendations for improving the AI answer with reference links
    
    Args:
        query: Original user query
        ai_answer: Generated AI answer
        referenced_urls: List of URLs used in the answer
    
    Returns:
        List of recommendation objects with reference URLs
    """
    recommendations = []
    
    # Analyze content gaps
    content_gaps = analyze_content_gaps(ai_answer)
    for gap in content_gaps:
        recommendations.append({
            'title': gap['title'],
            'description': gap['description'],
            'reference_url': find_supporting_url(gap, referenced_urls),
            'impact': gap['priority'],
            'details': gap['details']
        })
    
    return recommendations
```

### Step 3: Add URL Resolution Logic
```python
def find_supporting_url(recommendation, available_urls):
    """
    Find the most relevant URL from available URLs for a recommendation
    """
    # Use keyword matching or semantic similarity
    for url in available_urls:
        if is_relevant_to_recommendation(url, recommendation):
            return url
    
    # Return None if no suitable URL found
    return None
```

## Expected Frontend Output

When recommendations include `reference_url` fields, the frontend will display them with the recommendation text. The scrollable container ensures large recommendation lists remain accessible.

## Testing

1. **Flask Backend**: Ensure `/geo-agent` returns recommendations with `reference_url` fields
2. **Frontend**: Navigate to Part 4, enter a query, verify recommendations show with associated links
3. **Link Validation**: Click reference URLs to verify they're correct and accessible

## Files Affected

- **Backend**: `/server/app.py` - Update `/geo-agent` route
- **Frontend**: `/client/src/components/geo/geo-agent-panel.tsx` - Already supports reference URLs via `renderJSON()`
- **No changes needed**: `/client/src/app/api/geo/agent/route.ts` - Simply passes backend response through

## Migration Notes

The frontend is ready to display reference links. Just update the backend to include them in the recommendations structure. The `renderJSON()` function will automatically render them in the appropriate format.
