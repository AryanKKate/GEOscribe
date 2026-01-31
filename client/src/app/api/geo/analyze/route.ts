import { NextRequest, NextResponse } from "next/server";

/**
 * GEO Answers Synthesis API - Step 4 of the GEO Platform
 * 
 * This API endpoint:
 * 1. Forwards queries to the Flask backend (Step 3) to get AI-generated answers
 * 2. Extracts key concepts/entities from the answer
 * 3. Classifies the answer format (Paragraph, Bullet list, Step-by-step, Definition/Summary)
 * 
 * This is a READ-ONLY analysis endpoint that does not modify or optimize content.
 */

// Flask backend URL - connects to the Step 3 AI answer generation service
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || "http://localhost:5000";

// In-memory storage for generated answers (simulating database storage from Step 3)
// In production, this would be replaced with actual database queries
interface StoredAnswer {
  id: string;
  user_query: string;
  raw_ai_answer: string;
  model_name: string;
  timestamp: string;
  metadata?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    finish_reason?: string;
  };
}

// Global storage that persists during server runtime
const storedAnswers: Map<string, StoredAnswer> = new Map();

/**
 * Extracts key concepts and entities from the AI answer text
 * Uses a simple keyword extraction approach based on:
 * - Noun phrase patterns
 * - Term frequency
 * - Capitalized phrases (proper nouns)
 * 
 * @param text - The raw AI answer text
 * @returns Array of detected entities/concepts
 */
function extractKeyEntities(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "to", "of", "in", "for", "on", "with",
    "at", "by", "from", "as", "into", "through", "during", "before", "after",
    "above", "below", "between", "under", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all", "each", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "just", "and", "but", "if",
    "or", "because", "until", "while", "this", "that", "these", "those",
    "it", "its", "they", "them", "their", "what", "which", "who", "whom",
    "your", "you", "we", "our", "us", "i", "me", "my", "he", "she", "his",
    "her", "about", "also", "like", "well", "get", "make", "go", "see",
    "take", "use", "used", "using"
  ]);

  // Clean the text and split into words
  const cleanText = text
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  
  const words = cleanText.split(" ").filter(word => 
    word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)
  );

  // Count word frequency
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Extract capitalized phrases (potential proper nouns/technical terms)
  const capitalizedPhrases: string[] = [];
  const capitalizedRegex = /\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g;
  const matches = text.match(capitalizedRegex) || [];
  matches.forEach(match => {
    if (match.length > 2 && !["The", "A", "An", "In", "On", "At", "To", "For", "It", "This", "That"].includes(match)) {
      capitalizedPhrases.push(match);
    }
  });

  // Extract technical terms (words with specific patterns)
  const technicalTerms: string[] = [];
  const technicalPatterns = [
    /\b[A-Za-z]+-[A-Za-z]+\b/g,  // Hyphenated terms
    /\b[A-Z]{2,}\b/g,            // Acronyms
  ];
  technicalPatterns.forEach(pattern => {
    const termMatches = text.match(pattern) || [];
    technicalTerms.push(...termMatches);
  });

  // Get top frequent words (excluding very common ones)
  const sortedWords = Object.entries(wordFreq)
    .filter(([word]) => word.length > 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  // Combine and deduplicate entities
  const allEntities = [
    ...capitalizedPhrases,
    ...technicalTerms,
    ...sortedWords.map(w => w.charAt(0).toUpperCase() + w.slice(1))
  ];

  // Deduplicate and limit to top entities
  const uniqueEntities = [...new Set(allEntities)]
    .filter(entity => entity.length > 1)
    .slice(0, 10);

  return uniqueEntities;
}

/**
 * Classifies the format of the AI answer based on its structure
 * 
 * Classification rules:
 * - If text contains numbered steps (1., 2., etc.) → "Step-by-step"
 * - If text contains bullet symbols (-, *, •) at line starts → "Bullet list"
 * - If first sentence defines a term (contains "is a", "is the", "refers to") → "Definition / Summary"
 * - Otherwise → "Paragraph"
 * 
 * @param text - The raw AI answer text
 * @returns The detected format type
 */
function classifyAnswerFormat(text: string): string {
  // Check for numbered steps pattern
  const numberedStepsPattern = /^\s*\d+[\.\)]\s+/m;
  const hasNumberedSteps = numberedStepsPattern.test(text);
  const numberedCount = (text.match(/^\s*\d+[\.\)]\s+/gm) || []).length;
  
  if (hasNumberedSteps && numberedCount >= 2) {
    return "Step-by-step";
  }

  // Check for bullet list pattern
  const bulletPattern = /^\s*[-*•]\s+/m;
  const hasBullets = bulletPattern.test(text);
  const bulletCount = (text.match(/^\s*[-*•]\s+/gm) || []).length;
  
  if (hasBullets && bulletCount >= 2) {
    return "Bullet list";
  }

  // Check for definition pattern in the first sentence
  const firstSentence = text.split(/[.!?]/)[0].toLowerCase();
  const definitionPatterns = [
    " is a ",
    " is the ",
    " is an ",
    " refers to ",
    " means ",
    " defined as ",
    " can be defined ",
    " represents "
  ];
  
  const isDefinition = definitionPatterns.some(pattern => 
    firstSentence.includes(pattern)
  );
  
  if (isDefinition) {
    return "Definition / Summary";
  }

  // Default to paragraph
  return "Paragraph";
}

/**
 * POST /api/geo/analyze
 * 
 * Sends a query to the Flask backend to get AI-generated answer,
 * then analyzes and stores the result.
 * 
 * Request Body:
 * - query: The user's question to send to the AI
 * 
 * Returns:
 * - The analysis result with entities and format classification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, action } = body;

    // If action is "list", return all stored queries
    if (action === "list") {
      const queries = Array.from(storedAnswers.values()).map(answer => ({
        id: answer.id,
        user_query: answer.user_query,
        model_name: answer.model_name,
        timestamp: answer.timestamp
      }));
      return NextResponse.json({ queries });
    }

    // Validate query parameter for generating new answer
    if (!query) {
      return NextResponse.json(
        { error: "Missing required parameter: query" },
        { status: 400 }
      );
    }

    // Call Flask backend /ask endpoint to get AI-generated answer
    const flaskResponse = await fetch(`${FLASK_BACKEND_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!flaskResponse.ok) {
      const errorData = await flaskResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || "Failed to get AI answer from backend" },
        { status: flaskResponse.status }
      );
    }

    // Parse Flask response
    // Expected format from Flask /ask endpoint:
    // {
    //   query_used: string,
    //   raw_answer: string,
    //   metadata: { id, model, timestamp, usage, finish_reason }
    // }
    const flaskData = await flaskResponse.json();

    // Generate a unique ID for this query
    const queryId = flaskData.metadata?.id || `query-${Date.now()}`;

    // Store the answer (simulating database storage)
    const storedAnswer: StoredAnswer = {
      id: queryId,
      user_query: flaskData.query_used,
      raw_ai_answer: flaskData.raw_answer,
      model_name: flaskData.metadata?.model || "Unknown",
      timestamp: flaskData.metadata?.timestamp || new Date().toISOString(),
      metadata: {
        prompt_tokens: flaskData.metadata?.usage?.prompt_tokens,
        completion_tokens: flaskData.metadata?.usage?.completion_tokens,
        total_tokens: flaskData.metadata?.usage?.total_tokens,
        finish_reason: flaskData.metadata?.finish_reason,
      }
    };

    storedAnswers.set(queryId, storedAnswer);

    // Extract key entities from the answer text
    const detectedEntities = extractKeyEntities(storedAnswer.raw_ai_answer);

    // Classify the answer format
    const answerFormat = classifyAnswerFormat(storedAnswer.raw_ai_answer);

    // Return the analysis results
    return NextResponse.json({
      id: storedAnswer.id,
      user_query: storedAnswer.user_query,
      raw_ai_answer: storedAnswer.raw_ai_answer,
      detected_entities: detectedEntities,
      answer_format: answerFormat,
      model_name: storedAnswer.model_name,
      timestamp: storedAnswer.timestamp,
      metadata: storedAnswer.metadata
    });

  } catch (error) {
    console.error("[GEO API] Error processing query:", error);
    return NextResponse.json(
      { error: "Internal server error. Make sure Flask backend is running on " + FLASK_BACKEND_URL },
      { status: 500 }
    );
  }
}

/**
 * GET /api/geo/analyze
 * 
 * Fetches and analyzes a stored AI answer by query_id
 * 
 * Query Parameters:
 * - query_id: The ID of the stored query to analyze
 * 
 * Returns:
 * - user_query: The original user query
 * - raw_ai_answer: The AI-generated answer text
 * - detected_entities: Array of key concepts/entities
 * - answer_format: The classified format type
 * - model_name: The AI model used
 * - timestamp: When the answer was generated
 */
export async function GET(request: NextRequest) {
  try {
    // Extract query_id from URL parameters
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get("query_id");

    // Validate query_id parameter
    if (!queryId) {
      return NextResponse.json(
        { error: "Missing required parameter: query_id" },
        { status: 400 }
      );
    }

    // Fetch the stored AI answer
    const storedAnswer = storedAnswers.get(queryId);

    if (!storedAnswer) {
      return NextResponse.json(
        { error: "Query not found", query_id: queryId },
        { status: 404 }
      );
    }

    // Extract key entities from the answer text
    const detectedEntities = extractKeyEntities(storedAnswer.raw_ai_answer);

    // Classify the answer format
    const answerFormat = classifyAnswerFormat(storedAnswer.raw_ai_answer);

    // Return the analysis results
    return NextResponse.json({
      id: storedAnswer.id,
      user_query: storedAnswer.user_query,
      raw_ai_answer: storedAnswer.raw_ai_answer,
      detected_entities: detectedEntities,
      answer_format: answerFormat,
      model_name: storedAnswer.model_name,
      timestamp: storedAnswer.timestamp,
      metadata: storedAnswer.metadata
    });

  } catch (error) {
    console.error("[GEO API] Error analyzing query:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =========================================================
// COMPETITOR SCRAPING ENDPOINT (Step 2 Integration)
// =========================================================

/**
 * Type definition for scraped competitor content structure
 * Matches the Flask /collect-structure response format
 */
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

// In-memory storage for scraped competitor content
const storedScrapedContent: Map<string, ScrapedResult> = new Map();
