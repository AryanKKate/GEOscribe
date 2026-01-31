import { NextRequest, NextResponse } from "next/server";

const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 1. Change 'url' to 'urls' to match what the Frontend is sending
    const { query, urls } = body;

    // 2. Validate using the correct plural key
    if (!query || !urls) {
      return NextResponse.json(
        { error: "Missing required parameters: query and urls" },
        { status: 400 }
      );
    }

    // 3. Call Flask backend /geo-evaluate
    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/geo-evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // 4. Forward as 'urls' to Flask
      body: JSON.stringify({ query, urls }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to get GEO metrics from backend" },
        { status: flaskResponse.status }
      );
    }

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