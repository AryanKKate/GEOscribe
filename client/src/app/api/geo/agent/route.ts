import { NextRequest, NextResponse } from "next/server";

/**
 * GEO Agent API - Part 4 of the GEO Platform
 * 
 * This API endpoint:
 * 1. Forwards queries to the Flask backend /geo-agent endpoint
 * 2. The Flask backend runs the complete GEO Agent pipeline:
 *    - Generates AI answer
 *    - Extracts competitor URLs from the answer
 *    - Scrapes competitor content structure
 *    - Performs causal reasoning (why these pages were selected)
 *    - Generates GEO optimization recommendations
 *    - Creates a webpage draft following the recommendations
 * 
 * This is the full, end-to-end optimization pipeline.
 */

// Flask backend URL - connects to the GEO Agent service
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

/**
 * POST /api/geo/agent
 * 
 * Sends a query to the Flask backend to run the complete GEO Agent pipeline.
 * 
 * Request Body:
 * - query: The user's question to analyze
 * 
 * Returns:
 * - The complete GEO Agent analysis with recommendations and generated webpage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    // Validate query parameter
    if (!query) {
      return NextResponse.json(
        { error: "Missing required parameter: query" },
        { status: 400 }
      );
    }

    // Call Flask backend /geo-agent endpoint
    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/geo-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json().catch(() => ({}));
      console.error("[GEO Agent API] Flask error:", errorData);
      return NextResponse.json(
        { error: errorData.error || "Failed to run GEO agent pipeline" },
        { status: flaskResponse.status }
      );
    }

    // Parse Flask response
    // Expected format from Flask /geo-agent endpoint:
    // {
    //   query: string,
    //   ai_answer: string,
    //   referenced_urls: string[],
    //   recommendations: string,
    //   generated_webpage: object
    // }
    const flaskData = await flaskResponse.json();

    // Return the complete GEO Agent analysis
    return NextResponse.json({
      query: flaskData.query,
      ai_answer: flaskData.ai_answer,
      referenced_urls: flaskData.referenced_urls || [],
      causal_analysis: flaskData.causal_analysis,
      recommendations: flaskData.recommendations,
      generated_webpage: flaskData.generated_webpage
    });

  } catch (error) {
    console.error("[GEO Agent API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Make sure Flask backend is running on " + FLASK_BACKEND_URL },
      { status: 500 }
    );
  }
}
