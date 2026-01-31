import { NextRequest, NextResponse } from "next/server";

/**
 * GEO Metrics API - Step 4 of the GEO Platform
 * 
 * This API endpoint fetches GEO metrics from the Flask backend.
 * It calls the /geo-metrics endpoint which computes:
 * - Semantic score (AI vs competitor content similarity)
 * - PAWC (Percentage AI Word Coverage)
 * - Raw word coverage
 * - Citation frequency
 * - Structural depth comparison (AI vs competitor)
 * - Topic analysis (included, missing, weak topics)
 * - Structural preferences
 */

// Flask backend URL
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

/**
 * POST /api/geo/metrics
 * 
 * Fetches GEO metrics by sending query and competitor URL to Flask backend
 * 
 * Request Body:
 * - query: The user query that was sent to AI
 * - url: The competitor URL to compare against
 * 
 * Returns:
 * - geo_metrics: Array of metric objects per URL
 * - structural_preferences: Overall structural preferences
 * - timestamp: When the analysis was performed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, url } = body;

    // Validate parameters
    if (!query || !url) {
      return NextResponse.json(
        { error: "Missing required parameters: query and url" },
        { status: 400 }
      );
    }

    // Call Flask backend /geo-metrics endpoint
    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/geo-evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, url }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to get GEO metrics from backend" },
        { status: flaskResponse.status }
      );
    }

    // Parse and return Flask response
    const metricsData = await flaskResponse.json();

    return NextResponse.json(metricsData);

  } catch (error) {
    console.error("[GEO Metrics API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Make sure Flask backend is running on " + FLASK_BACKEND_URL },
      { status: 500 }
    );
  }
}
