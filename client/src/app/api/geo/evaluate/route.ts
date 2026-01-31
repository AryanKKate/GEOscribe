import { NextRequest, NextResponse } from "next/server";

/**
 * GEO Evaluate API - Part 3: GEO Metrics Dashboard
 * 
 * This endpoint performs the full pipeline:
 * 1. Calls Flask /ask to get AI answer (same as Part 1)
 * 2. Calls Flask /collect-structure to scrape competitor (same as Part 2)
 * 3. Calls Flask /geo-evaluate to compute metrics
 * 
 * Input: { query: string, url: string }
 * Output: GEO metrics matching the expected JSON structure
 */

const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, url } = body;

    // Validate required parameters
    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: "Missing required parameter: query" },
        { status: 400 }
      );
    }

    if (!url || !url.trim()) {
      return NextResponse.json(
        { error: "Missing required parameter: url" },
        { status: 400 }
      );
    }

    // Step 1: Get AI answer from Flask /ask
    console.log("[GEO Evaluate] Step 1: Getting AI answer for query:", query);
    const askResponse = await fetch(`${FLASK_BACKEND_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    });

    if (!askResponse.ok) {
      const errorData = await askResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to get AI answer from backend" },
        { status: askResponse.status }
      );
    }

    const askData = await askResponse.json();
    // Flask /ask returns "raw_answer" not "raw_ai_answer"
    const aiAnswer = askData.raw_answer;

    if (!aiAnswer) {
      console.log("[GEO Evaluate] askData received:", JSON.stringify(askData));
      return NextResponse.json(
        { error: "No AI answer received from backend. Check Flask /ask endpoint." },
        { status: 500 }
      );
    }

    console.log("[GEO Evaluate] Step 1 complete. AI answer length:", aiAnswer.length);

    // Step 2: Scrape competitor content from Flask /collect-structure
    console.log("[GEO Evaluate] Step 2: Scraping competitor URL:", url);
    const scrapeResponse = await fetch(`${FLASK_BACKEND_URL}/collect-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: url.trim() }),
    });

    if (!scrapeResponse.ok) {
      const errorData = await scrapeResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to scrape competitor URL" },
        { status: scrapeResponse.status }
      );
    }

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeData.results || scrapeData.results.length === 0) {
      return NextResponse.json(
        { error: "No content scraped from competitor URL" },
        { status: 500 }
      );
    }

    console.log("[GEO Evaluate] Step 2 complete. Scraped results:", scrapeData.results.length);

    // Step 3: Format competitors and call Flask /geo-evaluate
    // IMPORTANT: Use the content_id returned from /collect-structure for cache lookup
    console.log("[GEO Evaluate] Step 3: Computing GEO metrics");
    const competitors = scrapeData.results.map((result: {
      url: string;
      content_id: string;
      structure_fingerprint?: object;
    }) => ({
      url: result.url,
      content_id: result.content_id, // Use the actual content_id from scrape, not URL
      structure_fingerprint: result.structure_fingerprint || {}
    }));
    
    console.log("[GEO Evaluate] Competitors formatted:", JSON.stringify(competitors.map((c: { url: string; content_id: string }) => ({ url: c.url, content_id: c.content_id }))));

    const evaluateResponse = await fetch(`${FLASK_BACKEND_URL}/geo-evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai_answer: aiAnswer,
        competitors: competitors
      }),
    });

    if (!evaluateResponse.ok) {
      const errorData = await evaluateResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to compute GEO metrics" },
        { status: evaluateResponse.status }
      );
    }

    const metricsData = await evaluateResponse.json();

    console.log("[GEO Evaluate] Step 3 complete. Metrics computed successfully.");

    // Return metrics with additional context
    return NextResponse.json({
      ...metricsData,
      query_used: query.trim(),
      ai_answer_preview: aiAnswer.substring(0, 200) + (aiAnswer.length > 200 ? "..." : "")
    });

  } catch (error) {
    console.error("[GEO Evaluate API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Make sure Flask backend is running on " + FLASK_BACKEND_URL },
      { status: 500 }
    );
  }
}
