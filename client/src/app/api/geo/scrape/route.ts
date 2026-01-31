import { NextRequest, NextResponse } from "next/server";

/**
 * GEO Competitor Scraping API - Step 2 Integration
 * 
 * This API endpoint forwards URL scraping requests to the Flask backend
 * which uses Firecrawl to scrape competitor content and extract structure.
 * 
 * Returns:
 * - Scraped content structure (headings, word counts, etc.)
 * - Content metrics (total words, section count, bullet ratios)
 */

// Flask backend URL
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

// In-memory storage for scraped content
interface ScrapedSection {
  heading: string;
  level: string;
  word_count: number;
  has_bullets: boolean;
  has_numbers: boolean;
  has_definition: boolean;
  content_snippet: string;
}

interface ScrapedMetrics {
  total_word_count: number;
  section_count: number;
  avg_words_per_section: number;
  bullet_section_ratio: number;
  h1_count: number;
  h2_count: number;
  h3_count: number;
}

interface ScrapedResult {
  url: string;
  structure_fingerprint?: {
    sections: ScrapedSection[];
    metrics: ScrapedMetrics;
  };
  timestamp?: string;
  error?: string;
}

// Storage for scraped results
const storedScrapedContent: Map<string, ScrapedResult[]> = new Map();
let scrapeHistory: Array<{ id: string; urls: string[]; timestamp: string }> = [];

/**
 * POST /api/geo/scrape
 * 
 * Sends URLs to Flask backend for scraping competitor content
 * 
 * Request Body:
 * - urls: Single URL string or array of URLs to scrape
 * - action: Optional "list" to get scrape history
 * 
 * Returns:
 * - Scraped content structure and metrics for each URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, action } = body;

    // If action is "list", return scrape history
    if (action === "list") {
      return NextResponse.json({ 
        history: scrapeHistory,
        storedResults: Object.fromEntries(storedScrapedContent)
      });
    }

    // Validate URLs parameter
    if (!urls) {
      return NextResponse.json(
        { error: "Missing required parameter: urls" },
        { status: 400 }
      );
    }

    // Call Flask backend /collect-structure endpoint
    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/collect-structure`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to scrape content from backend" },
        { status: flaskResponse.status }
      );
    }

    // Parse Flask response
    // Expected format:
    // {
    //   status: "success",
    //   count: number,
    //   results: Array<{
    //     url: string,
    //     structure_fingerprint: { sections, metrics },
    //     timestamp: string,
    //     error?: string
    //   }>
    // }
    const flaskData = await flaskResponse.json();

    // Generate unique ID for this scrape batch
    const scrapeId = `scrape-${Date.now()}`;
    const urlList = Array.isArray(urls) ? urls : [urls];

    // Store the results
    storedScrapedContent.set(scrapeId, flaskData.results);
    
    // Add to history
    scrapeHistory.unshift({
      id: scrapeId,
      urls: urlList,
      timestamp: new Date().toISOString()
    });

    // Keep only last 20 scrapes in history
    if (scrapeHistory.length > 20) {
      const oldId = scrapeHistory.pop()?.id;
      if (oldId) storedScrapedContent.delete(oldId);
    }

    return NextResponse.json({
      id: scrapeId,
      status: flaskData.status,
      count: flaskData.count,
      results: flaskData.results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[GEO Scrape API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Make sure Flask backend is running on " + FLASK_BACKEND_URL },
      { status: 500 }
    );
  }
}

/**
 * GET /api/geo/scrape
 * 
 * Fetches stored scraped content by scrape_id
 * 
 * Query Parameters:
 * - scrape_id: The ID of the stored scrape results
 * 
 * Returns:
 * - Stored scraped content structure and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scrapeId = searchParams.get("scrape_id");

    if (!scrapeId) {
      // Return all history if no ID specified
      return NextResponse.json({ 
        history: scrapeHistory 
      });
    }

    const storedResults = storedScrapedContent.get(scrapeId);

    if (!storedResults) {
      return NextResponse.json(
        { error: "Scrape results not found", scrape_id: scrapeId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: scrapeId,
      results: storedResults
    });

  } catch (error) {
    console.error("[GEO Scrape API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
