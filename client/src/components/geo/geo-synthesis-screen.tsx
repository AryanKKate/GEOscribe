"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Search, 
  FileText, 
  Tags, 
  LayoutList, 
  Sparkles,
  Clock,
  Cpu,
  AlertCircle,
  ChevronDown,
  Send,
  Loader2,
  History,
  Globe,
  Link,
  BarChart3,
  Hash,
  List,
  Type,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  BookOpen,
  AlertTriangle,
  Minus,
  ArrowRight,
  Lightbulb,
  Zap
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GeoAgentPanel } from "./geo-agent-panel"

/**
 * Type definitions for GEO API responses
 * These match the Flask backend response structure from Step 3
 */
interface QueryOption {
  id: string
  user_query: string
  model_name: string
  timestamp: string
}

interface GeoAnalysisResult {
  id: string
  user_query: string
  raw_ai_answer: string
  detected_entities: string[]
  answer_format: string
  model_name: string
  timestamp: string
  metadata?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    finish_reason?: string
  }
}

/**
 * Type definitions for Competitor Scraping (Step 2)
 * These match the Flask /collect-structure response structure
 */
interface ScrapedSection {
  heading: string
  level: string
  word_count: number
  has_bullets: boolean
  has_numbers: boolean
  has_definition: boolean
  content_snippet: string
}

interface ScrapedMetrics {
  total_word_count: number
  section_count: number
  avg_words_per_section: number
  bullet_section_ratio: number
  h1_count: number
  h2_count: number
  h3_count: number
}

interface ScrapedResult {
  url: string
  structure_fingerprint?: {
    sections: ScrapedSection[]
    metrics: ScrapedMetrics
  }
  timestamp?: string
  error?: string
}

interface ScrapeResponse {
  id: string
  status: string
  count: number
  results: ScrapedResult[]
  timestamp: string
}

/**
 * Type definitions for GEO Metrics (Combined Analysis)
 * These match the Flask /geo-metrics response structure
 */
interface StructuralDepth {
  ai: {
    total_word_count: number
    section_count: number
    avg_words_per_section: number
    bullet_section_ratio: number
    h1_count: number
    h2_count: number
    h3_count: number
  }
  competitor: {
    total_word_count: number
    section_count: number
    avg_words_per_section: number
    bullet_section_ratio: number
    h1_count: number
    h2_count: number
    h3_count: number
  }
  difference: {
    h1_diff: number
    h2_diff: number
    h3_diff: number
  }
}

interface TopicAnalysis {
  included_topics: string[]
  missing_topics: string[]
  weak_topics: string[]
}

interface GeoMetric {
  url: string
  semantic_score: number
  pawc: number
  raw_word_coverage: number
  citation_frequency: number
  structural_depth: StructuralDepth
  topic_analysis: TopicAnalysis
}

interface StructuralPreferences {
  heading_depth_bias: string
  prefers_bullets: boolean
  prefers_short_sections: boolean
}

interface GeoMetricsResponse {
  status: string
  query_used?: string
  ai_answer_preview?: string
  geo_metrics: GeoMetric[]
  structural_preferences: StructuralPreferences
  timestamp: string
}

/**
 * Type definitions for GEO Agent (Part 4 - Complete Pipeline)
 * Calls the Flask /geo-agent endpoint for the full pipeline
 */
interface GeneratedWebpageSection {
  heading: string
  summary: string
  content: string
  bullets?: string[]
  definition?: string
}

interface GeneratedWebpage {
  page_title?: string
  meta_description?: string
  executive_summary?: string
  sections?: GeneratedWebpageSection[]
  faq?: Array<{
    question: string
    answer: string
  }>
  internal_linking_suggestions?: string[]
  schema_hints?: {
    article?: boolean
    faq?: boolean
  }
  raw_text?: string
}

interface GeoAgentResponse {
  query: string
  ai_answer: string
  referenced_urls: string[]
  recommendations: string | object
  generated_webpage: GeneratedWebpage
  timestamp?: string
}

/**
 * GEO Answers Synthesis Screen Component
 * 
 * This component displays a read-only insights screen showing:
 * - Input field to enter queries and get AI-generated answers
 * - The target query at the top
 * - A scrollable container with the raw AI-generated answer
 * - Key concepts section with detected entities as tags/chips
 * - Answer format section showing the detected format
 * 
 * It connects to the Flask backend (Step 3) to get real AI-generated answers.
 * 
 * It does NOT:
 * - Compare AI output with competitor content
 * - Show missing topics
 * - Provide optimization suggestions
 */
export function GeoSynthesisScreen() {
  // State for query input
  const [queryInput, setQueryInput] = useState<string>("")
  
  // State for available queries (history) and selected query
  const [availableQueries, setAvailableQueries] = useState<QueryOption[]>([])
  const [selectedQueryId, setSelectedQueryId] = useState<string>("")
  
  // State for analysis results
  const [analysisResult, setAnalysisResult] = useState<GeoAnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State for competitor scraping (Step 2)
  const [urlInput, setUrlInput] = useState<string>("")
  const [scrapeResults, setScrapeResults] = useState<ScrapeResponse | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [selectedScrapedIndex, setSelectedScrapedIndex] = useState<number>(0)
  
  // State for GEO Metrics (Part 3 - performs full pipeline: AI answer + scraping + metrics)
  const [metricsQuery, setMetricsQuery] = useState<string>("")
  const [metricsUrl, setMetricsUrl] = useState<string>("")
  const [metricsResult, setMetricsResult] = useState<GeoMetricsResponse | null>(null)
  const [selectedMetricIndex, setSelectedMetricIndex] = useState<number>(0)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  // State for GEO Agent (Part 4 - complete pipeline with recommendations)
  const [agentQuery, setAgentQuery] = useState<string>("")
  const [agentResult, setAgentResult] = useState<GeoAgentResponse | null>(null)
  const [isLoadingAgent, setIsLoadingAgent] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<"ai-answer" | "competitor" | "metrics" | "agent">("ai-answer")

  /**
   * Fetch available queries (history) on component mount
   * These represent the stored AI answers from previous queries
   */
  useEffect(() => {
    async function fetchQueries() {
      try {
        const response = await fetch("/api/geo/analyze", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" })
        })
        const data = await response.json()
        
        if (data.queries) {
          setAvailableQueries(data.queries)
        }
      } catch (err) {
        console.error("[GEO] Error fetching queries:", err)
      }
    }
    
    fetchQueries()
  }, [])

  /**
   * Fetch analysis when a query is selected from history
   * This calls the GEO API to get entity extraction and format classification
   */
  useEffect(() => {
    if (!selectedQueryId) return

    async function fetchAnalysis() {
      setIsLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/geo/analyze?query_id=${selectedQueryId}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch analysis")
        }
        
        const data = await response.json()
        setAnalysisResult(data)
      } catch (err) {
        console.error("[GEO] Error fetching analysis:", err)
        setError("Failed to load analysis results")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchAnalysis()
  }, [selectedQueryId])

  /**
   * Submit a new query to the Flask backend
   * This sends the query to the AI and gets back the analysis
   */
  async function handleSubmitQuery(e: React.FormEvent) {
    e.preventDefault()
    
    if (!queryInput.trim()) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch("/api/geo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryInput.trim() })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to get AI response")
      }
      
      const data = await response.json()
      setAnalysisResult(data)
      
      // Add to history and select it
      const newQuery: QueryOption = {
        id: data.id,
        user_query: data.user_query,
        model_name: data.model_name,
        timestamp: data.timestamp
      }
      setAvailableQueries(prev => [newQuery, ...prev])
      setSelectedQueryId(data.id)
      
      // Clear input
      setQueryInput("")
      
    } catch (err) {
      console.error("[GEO] Error submitting query:", err)
      setError(err instanceof Error ? err.message : "Failed to get AI response")
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Submit URLs for competitor scraping
   * This sends the URLs to Flask /collect-structure endpoint
   */
  async function handleScrapeUrl(e: React.FormEvent) {
    e.preventDefault()
    
    if (!urlInput.trim()) return
    
    setIsScraping(true)
    setScrapeError(null)
    
    try {
      // Parse URLs - support comma-separated or single URL
      const urls = urlInput.includes(",") 
        ? urlInput.split(",").map(u => u.trim()).filter(Boolean)
        : urlInput.trim()
      
      const response = await fetch("/api/geo/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to scrape URL")
      }
      
      const data = await response.json()
      setScrapeResults(data)
      setSelectedScrapedIndex(0) // 👈 ADD THIS

      // Clear input on success
      setUrlInput("")

      
    } catch (err) {
      console.error("[GEO] Error scraping URL:", err)
      setScrapeError(err instanceof Error ? err.message : "Failed to scrape URL")
    } finally {
      setIsScraping(false)
    }
  }

  /**
   * Fetch GEO Metrics - Performs full pipeline (AI answer + scraping + metrics)
   * This sends query and URL to the evaluate endpoint which handles everything
   */
  async function handleFetchMetrics(e: React.FormEvent) {
    e.preventDefault()
    
    if (!metricsQuery.trim() || !metricsUrl.trim()) return
    
    setIsLoadingMetrics(true)
    setMetricsError(null)
    
    try {
      const urls = metricsUrl.includes(",")
      ? metricsUrl.split(",").map(u => u.trim()).filter(Boolean)
      : [metricsUrl.trim()]

      const response = await fetch("/api/geo/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: metricsQuery.trim(),
          urls
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch GEO metrics")
      }
      
      const data = await response.json()
      setMetricsResult(data)
      setSelectedMetricIndex(0) 
      
    } catch (err) {
      console.error("[GEO] Error fetching metrics:", err)
      setMetricsError(err instanceof Error ? err.message : "Failed to fetch GEO metrics")
    } finally {
      setIsLoadingMetrics(false)
    }
  }

  /**
   * Fetch GEO Agent Results - Complete pipeline with recommendations and generated webpage
   * This sends query to the agent endpoint which handles all steps and generates recommendations
   */
  async function handleFetchAgent(e: React.FormEvent) {
    e.preventDefault()
    
    if (!agentQuery.trim()) return
    
    setIsLoadingAgent(true)
    setAgentError(null)
    
    try {
      const response = await fetch("/api/geo/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: agentQuery.trim()
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch GEO agent results")
      }
      
      const data = await response.json()
      setAgentResult(data)
      
    } catch (err) {
      console.error("[GEO] Error fetching agent results:", err)
      setAgentError(err instanceof Error ? err.message : "Failed to fetch GEO agent results")
    } finally {
      setIsLoadingAgent(false)
    }
  }

  /**
   * Get appropriate icon for answer format
   */
  const getFormatIcon = (format: string) => {
    switch (format) {
      case "Step-by-step":
        return <LayoutList className="h-4 w-4" />
      case "Bullet list":
        return <LayoutList className="h-4 w-4" />
      case "Definition / Summary":
        return <FileText className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Parts 1, 2, and 3 */}
      <div className="flex gap-1 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab("ai-answer")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "ai-answer"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Part 1: AI Answer
          </span>
        </button>
        <button
          onClick={() => setActiveTab("competitor")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "competitor"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Part 2: Competitor Scraping
          </span>
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "metrics"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Part 3: GEO Metrics
          </span>
        </button>
        <button
          onClick={() => setActiveTab("agent")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "agent"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Part 4: GEO Agent
          </span>
        </button>
      </div>

      {/* AI Answer Tab Content */}
      {activeTab === "ai-answer" && (
        <>
          {/* Query Input Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Ask AI a Question
              </CardTitle>
              <CardDescription>
                Enter a query to get an AI-generated answer and see its analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitQuery} className="flex gap-3">
                <Input
                  type="text"
                  placeholder="e.g., What is machine learning?"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <Button type="submit" disabled={isSubmitting || !queryInput.trim()}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">Generate</span>
                </Button>
              </form>
            </CardContent>
          </Card>

      {/* Query History Selector */}
      {availableQueries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Previous Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <select 
                value={selectedQueryId} 
                onChange={(e) => setSelectedQueryId(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none cursor-pointer"
              >
                <option value="" disabled>Select a previous query...</option>
                {availableQueries.map((query) => (
                  <option key={query.id} value={query.id}>
                    {query.user_query}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {(isLoading || isSubmitting) && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Results */}
      {!isLoading && !isSubmitting && analysisResult && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Raw AI Answer */}
          <div className="lg:col-span-2 space-y-4">
            {/* Target Query Display */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5 text-primary" />
                  Target Query
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">{analysisResult.user_query}</p>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-4 w-4" />
                    {analysisResult.model_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatTimestamp(analysisResult.timestamp)}
                  </span>
                  {analysisResult.metadata?.total_tokens && (
                    <span className="text-xs">
                      ({analysisResult.metadata.total_tokens} tokens)
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Raw AI Answer Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Raw AI-Generated Answer
                </CardTitle>
                <CardDescription>
                  The complete response generated by the AI model
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full overflow-y-auto rounded-md border p-4 bg-muted/30">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {analysisResult.raw_ai_answer}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Analysis Results */}
          <div className="space-y-4">
            {/* Key Concepts Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  Key Concepts
                </CardTitle>
                <CardDescription>
                  Detected entities and concepts from the AI answer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.detected_entities.length > 0 ? (
                    analysisResult.detected_entities.map((entity, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary"
                        className="text-sm"
                      >
                        {entity}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No key concepts detected
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Answer Format Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutList className="h-5 w-5" />
                  Answer Format
                </CardTitle>
                <CardDescription>
                  The detected structure of the AI response
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {getFormatIcon(analysisResult.answer_format)}
                  </div>
                  <div>
                    <p className="font-medium">{analysisResult.answer_format}</p>
                    <p className="text-xs text-muted-foreground">
                      {analysisResult.answer_format === "Step-by-step" && "Numbered sequential instructions"}
                      {analysisResult.answer_format === "Bullet list" && "Itemized points or features"}
                      {analysisResult.answer_format === "Definition / Summary" && "Explanatory definition format"}
                      {analysisResult.answer_format === "Paragraph" && "Flowing prose text"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Read-Only View</p>
                  <p>
                    This screen is for understanding AI behavior only. 
                    No content modifications or optimizations are performed here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isSubmitting && !analysisResult && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Query Analyzed Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Enter a question above to get an AI-generated answer and view its GEO synthesis analysis.
            </p>
          </CardContent>
        </Card>
      )}
        </>
      )}

      {/* Competitor Scraping Tab Content */}
      {activeTab === "competitor" && (
        <>
          {/* URL Input Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Scrape Competitor Content
              </CardTitle>
              <CardDescription>
                Enter a URL to scrape and analyze competitor content structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScrapeUrl} className="flex gap-3">
                <Input
                  type="text"
                  placeholder="e.g., https://en.wikipedia.org/wiki/Machine_learning"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isScraping}
                  className="flex-1"
                />
                <Button type="submit" disabled={isScraping || !urlInput.trim()}>
                  {isScraping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                  <span className="ml-2">Scrape</span>
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                Tip: You can enter multiple URLs separated by commas
              </p>
            </CardContent>
          </Card>

          {/* Scrape Error State */}
          {scrapeError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{scrapeError}</AlertDescription>
            </Alert>
          )}

          {/* Scraping Loading State */}
          {isScraping && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Scrape Results */}
          {!isScraping && scrapeResults && (
            <div className="space-y-6">
              {/* Results Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Scrape Results
                  </CardTitle>
                  <CardDescription>
                    {scrapeResults.count} URL(s) scraped at {formatTimestamp(scrapeResults.timestamp)}
                  </CardDescription>
                </CardHeader>
              </Card>
              {/* Scraped URL Selector */}
              {scrapeResults.results.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <List className="h-4 w-4" />
                      Select Scraped URL
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <select
                        value={selectedScrapedIndex}
                        onChange={(e) => setSelectedScrapedIndex(Number(e.target.value))}
                        className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none cursor-pointer"
                      >
                        {scrapeResults.results.map((result, index) => (
                          <option key={index} value={index}>
                            {result.url}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                    </div>
                  </CardContent>
                </Card>
              )}


              {/* Individual URL Results */}
              {scrapeResults.results[selectedScrapedIndex] && (() => {
                const result = scrapeResults.results[selectedScrapedIndex]

                return (
                  <Card className={result.error ? "border-destructive" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {result.error ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        <span className="truncate">{result.url}</span>
                      </CardTitle>
                      {result.timestamp && (
                        <CardDescription>
                          Scraped at {formatTimestamp(result.timestamp)}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent>
                      {result.error ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{result.error}</AlertDescription>
                        </Alert>
                      ) : result.structure_fingerprint && (
                        <div className="grid gap-6 lg:grid-cols-3">
                          {/* Metrics Overview */}
                          <div className="lg:col-span-1 space-y-4">
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Content Metrics
                              </h4>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                  <span className="text-sm text-muted-foreground">Total Words</span>
                                  <Badge variant="secondary">
                                    {result.structure_fingerprint.metrics.total_word_count.toLocaleString()}
                                  </Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                  <span className="text-sm text-muted-foreground">Sections</span>
                                  <Badge variant="secondary">
                                    {result.structure_fingerprint.metrics.section_count}
                                  </Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                  <span className="text-sm text-muted-foreground">Avg Words/Section</span>
                                  <Badge variant="secondary">
                                    {Math.round(result.structure_fingerprint.metrics.avg_words_per_section)}
                                  </Badge>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                  <span className="text-sm text-muted-foreground">Bullet Ratio</span>
                                  <Badge variant="secondary">
                                    {(result.structure_fingerprint.metrics.bullet_section_ratio * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Heading Counts */}
                            <div>
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Hash className="h-4 w-4" />
                                Heading Structure
                              </h4>
                              <div className="flex gap-2">
                                <div className="flex-1 text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">
                                    {result.structure_fingerprint.metrics.h1_count}
                                  </div>
                                  <div className="text-xs text-muted-foreground">H1</div>
                                </div>
                                <div className="flex-1 text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">
                                    {result.structure_fingerprint.metrics.h2_count}
                                  </div>
                                  <div className="text-xs text-muted-foreground">H2</div>
                                </div>
                                <div className="flex-1 text-center p-2 bg-muted/50 rounded">
                                  <div className="text-lg font-bold">
                                    {result.structure_fingerprint.metrics.h3_count}
                                  </div>
                                  <div className="text-xs text-muted-foreground">H3</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Sections List */}
                          <div className="lg:col-span-2">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <List className="h-4 w-4" />
                              Content Sections ({result.structure_fingerprint.sections.length})
                            </h4>
                            <div className="h-[400px] overflow-y-auto rounded-md border">
                              <div className="divide-y">
                                {result.structure_fingerprint.sections.map((section, sectionIndex) => (
                                  <div key={sectionIndex} className="p-3 hover:bg-muted/30">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={section.level === "H1" ? "default" : "outline"}
                                          className="text-xs"
                                        >
                                          {section.level}
                                        </Badge>
                                        <span className="font-medium text-sm">
                                          {section.heading}
                                        </span>
                                      </div>
                                      <Badge variant="secondary" className="text-xs shrink-0">
                                        {section.word_count} words
                                      </Badge>
                                    </div>

                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {section.content_snippet || "No content preview available"}
                                    </p>

                                    <div className="flex gap-2 mt-2">
                                      {section.has_bullets && (
                                        <Badge variant="outline" className="text-xs">
                                          <List className="h-3 w-3 mr-1" />
                                          Bullets
                                        </Badge>
                                      )}
                                      {section.has_numbers && (
                                        <Badge variant="outline" className="text-xs">
                                          <Hash className="h-3 w-3 mr-1" />
                                          Numbered
                                        </Badge>
                                      )}
                                      {section.has_definition && (
                                        <Badge variant="outline" className="text-xs">
                                          <Type className="h-3 w-3 mr-1" />
                                          Definition
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })()}
            </div>
          )}

          {/* Empty State for Competitor Tab */}
          {!isScraping && !scrapeResults && !scrapeError && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Content Scraped Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Enter a competitor URL above to scrape and analyze their content structure.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* GEO Metrics Tab Content - Part 3: Analysis Layer */}
      {activeTab === "metrics" && (
        <>
          {/* Part 3 Header */}
          <Alert className="border-primary/20 bg-primary/5">
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Part 3: GEO Metrics Dashboard</span> - This is a read-only analysis layer that compares AI-generated content against competitor content. No recommendations are provided here.
            </AlertDescription>
          </Alert>

          {/* Input Card for Query + URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Analyze GEO Metrics
              </CardTitle>
              <CardDescription>
                Enter a query and competitor URL to compute coverage scores, structural comparisons, and topic analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFetchMetrics} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Query</label>
                  <Input
                    type="text"
                    placeholder="e.g., Who is Ajit Pawar?"
                    value={metricsQuery}
                    onChange={(e) => setMetricsQuery(e.target.value)}
                    disabled={isLoadingMetrics}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Competitor URL</label>
                  <Input
                    type="text"
                    placeholder="e.g., https://en.wikipedia.org/wiki/Ajit_Pawar"
                    value={metricsUrl}
                    onChange={(e) => setMetricsUrl(e.target.value)}
                    disabled={isLoadingMetrics}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoadingMetrics || !metricsQuery.trim() || !metricsUrl.trim()}
                  className="w-full"
                >
                  {isLoadingMetrics ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Target className="h-4 w-4 mr-2" />
                  )}
                  Analyze GEO Metrics
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Metrics Error State */}
          {metricsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{metricsError}</AlertDescription>
            </Alert>
          )}

          {/* Metrics Loading State */}
          {isLoadingMetrics && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Metrics Results - Part 3 Output */}
          {!isLoadingMetrics && metricsResult && metricsResult.geo_metrics?.length > 0 && (
            <div className="space-y-6">
              {/* Analysis Summary Header */}
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Target className="h-5 w-5 text-primary" />
                      GEO Analysis Results
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      Read-only Insights
                    </Badge>
                  </div>
                  <CardDescription>
                    Analyzed at {formatTimestamp(metricsResult.timestamp)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Query:</span> {metricsResult.query_used || "N/A"}
                  </div>
                </CardContent>
              </Card>

              {/* Competitor Selector */}
              {metricsResult.geo_metrics.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <List className="h-4 w-4" />
                      Select Competitor URL
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <select
                        value={selectedMetricIndex}
                        onChange={(e) => setSelectedMetricIndex(Number(e.target.value))}
                        className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer"
                      >
                        {metricsResult.geo_metrics.map((metric, index) => (
                          <option key={index} value={index}>
                            {metric.url}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                    </div>
                  </CardContent>
                </Card>
              )}


              {metricsResult.geo_metrics[selectedMetricIndex] && (() => {
                const metric = metricsResult.geo_metrics[selectedMetricIndex]

                return (
                  <div className="space-y-6">
                    {/* Competitor URL Header */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Globe className="h-5 w-5 text-orange-500" />
                          Competitor:{" "}
                          <span className="text-muted-foreground font-normal truncate">
                            {metric.url}
                          </span>
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    {/* Coverage Scores Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Percent className="h-5 w-5" />
                          Coverage Scores
                        </CardTitle>
                        <CardDescription>
                          Metrics measuring how well AI content covers competitor topics
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Semantic Score Gauge */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1">
                              <Target className="h-4 w-4 text-primary" />
                              Semantic Score
                            </span>
                            <span className="text-2xl font-bold">
                              {(metric.semantic_score * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all rounded-full"
                              style={{ width: `${metric.semantic_score * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Semantic relevance to competitor content
                          </p>
                        </div>

                          {/* PAWC Score */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1">
                              <Percent className="h-4 w-4 text-blue-500" />
                              PAWC
                            </span>
                            <span className="text-2xl font-bold">
                              {metric.pawc.toFixed(1)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Partial Answer Word Coverage - weighted word overlap score
                          </p>
                        </div>

                          {/* Raw Word Coverage Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1">
                              <BookOpen className="h-4 w-4 text-green-500" />
                              Word Coverage
                            </span>
                            <span className="text-2xl font-bold">
                              {(metric.raw_word_coverage * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all rounded-full"
                              style={{ width: `${Math.min(metric.raw_word_coverage * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Raw word overlap ratio with competitor
                          </p>
                        </div>

                          {/* Citation Frequency */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1">
                              <FileText className="h-4 w-4 text-orange-500" />
                              Citations
                            </span>
                            <span className="text-2xl font-bold">
                              {metric.citation_frequency}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Times competitor domain is referenced
                          </p>
                        </div>
                      </div>
                      </CardContent>
                    </Card>

                    {/* Structural Depth Comparison */}
                    <Card>
                      <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LayoutList className="h-5 w-5" />
                        Structural Comparison
                      </CardTitle>
                      <CardDescription>
                        AI vs Competitor content structure analysis (headings and depth)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Comparison Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 font-medium">Metric</th>
                              
                              <th className="text-center py-2 px-3 font-medium">
                                <span className="flex items-center justify-center gap-1">
                                  <Globe className="h-4 w-4 text-orange-500" />
                                  Competitor
                                </span>
                              </th>
                              
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="py-2 px-3 text-muted-foreground">Total Words</td>
                              
                              <td className="py-2 px-3 text-center font-medium">{metric.structural_depth.competitor.total_word_count.toLocaleString()}</td>
                              <td className="py-2 px-3 text-center">
                                
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 px-3 text-muted-foreground">Sections</td>
                              
                              <td className="py-2 px-3 text-center font-medium">{metric.structural_depth.competitor.section_count}</td>
                              <td className="py-2 px-3 text-center">
                                
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 px-3 text-muted-foreground">H1 Headings</td>
                              
                              <td className="py-2 px-3 text-center font-medium">{metric.structural_depth.competitor.h1_count}</td>
                              <td className="py-2 px-3 text-center">
                                
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-2 px-3 text-muted-foreground">H2 Headings</td>
                              
                              <td className="py-2 px-3 text-center font-medium">{metric.structural_depth.competitor.h2_count}</td>
                              <td className="py-2 px-3 text-center">
                                
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 text-muted-foreground">H3 Headings</td>
                              
                              <td className="py-2 px-3 text-center font-medium">{metric.structural_depth.competitor.h3_count}</td>
                              <td className="py-2 px-3 text-center">
                                
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                    </Card>

                    {/* Topic Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Tags className="h-5 w-5" />
                          Topic Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <h4 className="font-medium mb-2">Included</h4>
                            {metric.topic_analysis.included_topics.map((t, i) => (
                              <Badge key={i} variant="secondary" className="mr-1 mb-1">
                                {t}
                              </Badge>
                            ))}
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Missing</h4>
                            {metric.topic_analysis.missing_topics.map((t, i) => (
                              <Badge key={i} variant="destructive" className="mr-1 mb-1">
                                {t}
                              </Badge>
                            ))}
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Weak</h4>
                            {metric.topic_analysis.weak_topics.map((t, i) => (
                              <Badge key={i} variant="outline" className="mr-1 mb-1">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}


              {/* Structural Preferences - Preferred Content Style */}
              {metricsResult.structural_preferences && (
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Preferred Content Style
                    </CardTitle>
                    <CardDescription>
                      Inferred preferences based on competitor content analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Heading Depth Bias */}
                      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Hash className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Heading Depth</p>
                          <p className="text-sm text-muted-foreground capitalize flex items-center gap-1">
                            {metricsResult.structural_preferences.heading_depth_bias === "deeper" ? (
                              <TrendingDown className="h-4 w-4 text-blue-500" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-orange-500" />
                            )}
                            {metricsResult.structural_preferences.heading_depth_bias}
                          </p>
                        </div>
                      </div>

                      {/* Bullet Preference */}
                      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${metricsResult.structural_preferences.prefers_bullets ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                          <List className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Bullet Lists</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            {metricsResult.structural_preferences.prefers_bullets ? (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                Preferred
                              </>
                            ) : (
                              <>
                                <Minus className="h-4 w-4" />
                                Not preferred
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Section Length Preference */}
                      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${metricsResult.structural_preferences.prefers_short_sections ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'}`}>
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Section Length</p>
                          <p className="text-sm text-muted-foreground">
                            {metricsResult.structural_preferences.prefers_short_sections ? "Short sections" : "Long sections"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Read-only note */}
                    <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
                      This is a read-only analysis view. Recommendations are available in Part 4.
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Empty State for Metrics Tab */}
          {!isLoadingMetrics && !metricsResult && !metricsError && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">GEO Metrics Not Computed Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Enter a query and competitor URL above to compute GEO metrics. This will automatically generate an AI answer, scrape the competitor content, and compute the comparison metrics.
                </p>
                <div className="grid gap-2 text-sm text-muted-foreground max-w-md">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span>Coverage scores (PAWC, semantic score, word coverage)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <LayoutList className="h-4 w-4 text-primary" />
                    <span>Structural comparison (AI vs Competitor headings)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-primary" />
                    <span>Topic analysis (included, missing, weak topics)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>Preferred content style inferences</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* GEO Agent Tab Content - Part 4: Complete Pipeline with Recommendations */}
      {activeTab === "agent" && (
        <>
          {/* Part 4 Header */}
          <Alert className="border-primary/20 bg-primary/5">
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Part 4: GEO Agent Pipeline</span> - Complete AI-driven analysis with causal reasoning, recommendations, and optimized webpage generation
            </AlertDescription>
          </Alert>

          {/* Input Card for Query */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Run GEO Agent Analysis
              </CardTitle>
              <CardDescription>
                Enter a query to run the complete GEO pipeline: AI answer generation, URL extraction, competitor scraping, causal reasoning, and recommendation generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFetchAgent} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Query</label>
                  <Input
                    type="text"
                    placeholder="e.g., What is Generative Engine Optimization?"
                    value={agentQuery}
                    onChange={(e) => setAgentQuery(e.target.value)}
                    disabled={isLoadingAgent}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isLoadingAgent || !agentQuery.trim()}
                  className="w-full"
                >
                  {isLoadingAgent ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Run Agent Pipeline
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Agent Error State */}
          {agentError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{agentError}</AlertDescription>
            </Alert>
          )}

          {/* Agent Loading State */}
          {isLoadingAgent && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Agent Results - Part 4 Output */}
          {!isLoadingAgent && agentResult && (
            <GeoAgentPanel result={agentResult} />
          )}

          {/* Empty State for Agent Tab */}
          {!isLoadingAgent && !agentResult && !agentError && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">GEO Agent Not Run Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  Enter a query above to run the complete GEO agent pipeline. This will generate AI answers, extract references, scrape competitors, analyze causally, and generate recommendations.
                </p>
                <div className="grid gap-2 text-sm text-muted-foreground max-w-md">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>AI-generated answer with references</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link className="h-4 w-4 text-primary" />
                    <span>Referenced URLs extraction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <span>Causal reasoning and recommendations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Optimized webpage draft generation</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
