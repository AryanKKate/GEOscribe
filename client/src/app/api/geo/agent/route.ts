import { NextRequest, NextResponse } from "next/server";

/**
 * GEO Agent API - Part 4: Complete GEO Agent Pipeline
 * 
 * This endpoint calls the Flask /geo-agent endpoint which runs the complete pipeline:
 * 1. AI Answer Generation - Get AI response to query
 * 2. URL Extraction - Extract referenced URLs from the answer
 * 3. Competitor Scraping - Scrape and analyze competitor content structure
 * 4. Causal Reasoning - Analyze WHY these pages were selected
 * 5. GEO Recommendations - Generate recommendations for improvement
 * 6. Webpage Generation - Generate an optimized webpage draft
 * 
 * Input: { query: string }
 * Output: { 
 *   query: string,
 *   ai_answer: string,
 *   referenced_urls: string[],
 *   recommendations: string,
 *   generated_webpage: object
 * }
 */

const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    // Validate required parameters
    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: "Missing required parameter: query" },
        { status: 400 }
      );
    }

    // Call Flask /geo-agent endpoint
    console.log("[GEO Agent API] Calling Flask /geo-agent with query:", query);

    const agentResponse = await fetch(`${FLASK_BACKEND_URL}/geo-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    });

    if (!agentResponse.ok) {
      const errorData = await agentResponse.json().catch(() => ({}));
      console.error("[GEO Agent API] Flask error:", errorData);
      return NextResponse.json(
        { error: errorData.error || "Failed to call GEO agent from backend" },
        { status: agentResponse.status }
      );
    }

    const agentData = await agentResponse.json();

    console.log("[GEO Agent API] Agent response received. Keys:", Object.keys(agentData));

    // Return the complete agent response
    return NextResponse.json({
      query: agentData.query,
      ai_answer: agentData.ai_answer,
      referenced_urls: agentData.referenced_urls || [],
      recommendations: agentData.recommendations,
      generated_webpage: agentData.generated_webpage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[GEO Agent API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Make sure Flask backend is running on " + FLASK_BACKEND_URL },
      { status: 500 }
    );
  }
}
