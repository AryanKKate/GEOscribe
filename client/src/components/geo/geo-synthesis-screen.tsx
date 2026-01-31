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
  ArrowRight
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  geo_metrics: GeoMetric[]
  structural_preferences: StructuralPreferences
  timestamp: string
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
  
  // State for GEO Metrics (Combined Analysis)
  const [metricsQuery, setMetricsQuery] = useState<string>("")
  const [metricsUrl, setMetricsUrl] = useState<string>("")
  const [metricsResult, setMetricsResult] = useState<GeoMetricsResponse | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<"ai-answer" | "competitor" | "metrics">("ai-answer")

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
   * Fetch GEO Metrics - Combined AI vs Competitor analysis
   * This sends query + URL to Flask /geo-metrics endpoint
   */
  async function handleFetchMetrics(e: React.FormEvent) {
    e.preventDefault()
    
    if (!metricsQuery.trim() || !metricsUrl.trim()) return
    
    setIsLoadingMetrics(true)
    setMetricsError(null)
    
    try {
      const response = await fetch("/api/geo/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: metricsQuery.trim(),
          url: metricsUrl.trim()
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch GEO metrics")
      }
      
      const data = await response.json()
      setMetricsResult(data)
      
    } catch (err) {
      console.error("[GEO] Error fetching metrics:", err)
      setMetricsError(err instanceof Error ? err.message : "Failed to fetch GEO metrics")
    } finally {
      setIsLoadingMetrics(false)
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
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("ai-answer")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "ai-answer"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Answer Analysis
          </span>
        </button>
        <button
          onClick={() => setActiveTab("competitor")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "competitor"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Competitor Scraping
          </span>
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "metrics"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            GEO Metrics
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

              {/* Individual URL Results */}
              {scrapeResults.results.map((result, index) => (
                <Card key={index} className={result.error ? "border-destructive" : ""}>
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
                                <div className="text-lg font-bold">{result.structure_fingerprint.metrics.h1_count}</div>
                                <div className="text-xs text-muted-foreground">H1</div>
                              </div>
                              <div className="flex-1 text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{result.structure_fingerprint.metrics.h2_count}</div>
                                <div className="text-xs text-muted-foreground">H2</div>
                              </div>
                              <div className="flex-1 text-center p-2 bg-muted/50 rounded">
                                <div className="text-lg font-bold">{result.structure_fingerprint.metrics.h3_count}</div>
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
                                      <span className="font-medium text-sm">{section.heading}</span>
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
              ))}
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

      {/* GEO Metrics Tab Content */}
      {activeTab === "metrics" && (
        <>
          {/* Input Card for Query + URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                GEO Metrics Analysis
              </CardTitle>
              <CardDescription>
                Compare AI-generated content against competitor content to get optimization insights
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

          {/* Metrics Results */}
          {!isLoadingMetrics && metricsResult && metricsResult.geo_metrics?.length > 0 && (
            <div className="space-y-6">
              {metricsResult.geo_metrics.map((metric, index) => (
                <div key={index} className="space-y-6">
                  {/* URL Header */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Globe className="h-5 w-5 text-primary" />
                        Analysis for: {metric.url}
                      </CardTitle>
                      <CardDescription>
                        Analyzed at {formatTimestamp(metricsResult.timestamp)}
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  {/* Score Cards Grid */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Semantic Score */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          Semantic Score
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {(metric.semantic_score * 100).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          AI content similarity to competitor
                        </p>
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${metric.semantic_score * 100}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* PAWC Score */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                          <Percent className="h-4 w-4" />
                          PAWC Score
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {metric.pawc.toFixed(1)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Percentage AI Word Coverage
                        </p>
                      </CardContent>
                    </Card>

                    {/* Raw Word Coverage */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          Word Coverage
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {(metric.raw_word_coverage * 100).toFixed(2)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Raw word overlap ratio
                        </p>
                      </CardContent>
                    </Card>

                    {/* Citation Frequency */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Citations
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {metric.citation_frequency}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Citation frequency count
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Structural Depth Comparison */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LayoutList className="h-5 w-5" />
                        Structural Depth Comparison
                      </CardTitle>
                      <CardDescription>
                        AI content structure vs Competitor content structure
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* AI Structure */}
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            AI Content
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.ai.total_word_count}</div>
                              <div className="text-xs text-muted-foreground">Total Words</div>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.ai.section_count}</div>
                              <div className="text-xs text-muted-foreground">Sections</div>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.ai.h1_count}</div>
                              <div className="text-xs text-muted-foreground">H1 Tags</div>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.ai.h2_count}</div>
                              <div className="text-xs text-muted-foreground">H2 Tags</div>
                            </div>
                          </div>
                        </div>

                        {/* Competitor Structure */}
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Globe className="h-4 w-4 text-orange-500" />
                            Competitor Content
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.competitor.total_word_count}</div>
                              <div className="text-xs text-muted-foreground">Total Words</div>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.competitor.section_count}</div>
                              <div className="text-xs text-muted-foreground">Sections</div>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.competitor.h1_count}</div>
                              <div className="text-xs text-muted-foreground">H1 Tags</div>
                            </div>
                            <div className="p-2 bg-muted/50 rounded">
                              <div className="text-lg font-bold">{metric.structural_depth.competitor.h2_count}</div>
                              <div className="text-xs text-muted-foreground">H2 Tags</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Heading Difference */}
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-3">Heading Difference (AI - Competitor)</h4>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">H1:</span>
                            <Badge variant={metric.structural_depth.difference.h1_diff < 0 ? "destructive" : metric.structural_depth.difference.h1_diff > 0 ? "default" : "secondary"}>
                              {metric.structural_depth.difference.h1_diff > 0 ? "+" : ""}{metric.structural_depth.difference.h1_diff}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">H2:</span>
                            <Badge variant={metric.structural_depth.difference.h2_diff < 0 ? "destructive" : metric.structural_depth.difference.h2_diff > 0 ? "default" : "secondary"}>
                              {metric.structural_depth.difference.h2_diff > 0 ? "+" : ""}{metric.structural_depth.difference.h2_diff}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">H3:</span>
                            <Badge variant={metric.structural_depth.difference.h3_diff < 0 ? "destructive" : metric.structural_depth.difference.h3_diff > 0 ? "default" : "secondary"}>
                              {metric.structural_depth.difference.h3_diff > 0 ? "+" : ""}{metric.structural_depth.difference.h3_diff}
                            </Badge>
                          </div>
                        </div>
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
                      <CardDescription>
                        Topics covered, missing, and weak in AI content compared to competitor
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Included Topics */}
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Included Topics ({metric.topic_analysis.included_topics.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {metric.topic_analysis.included_topics.length > 0 ? (
                            metric.topic_analysis.included_topics.map((topic, i) => (
                              <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700">
                                {topic}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No topics included</span>
                          )}
                        </div>
                      </div>

                      {/* Missing Topics */}
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Missing Topics ({metric.topic_analysis.missing_topics.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {metric.topic_analysis.missing_topics.length > 0 ? (
                            metric.topic_analysis.missing_topics.map((topic, i) => (
                              <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700">
                                {topic}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No missing topics</span>
                          )}
                        </div>
                      </div>

                      {/* Weak Topics */}
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Weak Topics ({metric.topic_analysis.weak_topics.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {metric.topic_analysis.weak_topics.length > 0 ? (
                            metric.topic_analysis.weak_topics.map((topic, i) => (
                              <Badge key={i} variant="secondary" className="bg-yellow-500/10 text-yellow-700">
                                {topic}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No weak topics</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}

              {/* Structural Preferences */}
              {metricsResult.structural_preferences && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Structural Preferences
                    </CardTitle>
                    <CardDescription>
                      Detected content structure preferences based on analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Hash className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Heading Depth</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {metricsResult.structural_preferences.heading_depth_bias}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${metricsResult.structural_preferences.prefers_bullets ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                          <List className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Bullet Lists</p>
                          <p className="text-xs text-muted-foreground">
                            {metricsResult.structural_preferences.prefers_bullets ? "Preferred" : "Not preferred"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${metricsResult.structural_preferences.prefers_short_sections ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Section Length</p>
                          <p className="text-xs text-muted-foreground">
                            {metricsResult.structural_preferences.prefers_short_sections ? "Short sections preferred" : "Long sections preferred"}
                          </p>
                        </div>
                      </div>
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
                <h3 className="text-lg font-medium mb-2">No Metrics Analyzed Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Enter a query and competitor URL above to analyze GEO metrics and get optimization insights.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
