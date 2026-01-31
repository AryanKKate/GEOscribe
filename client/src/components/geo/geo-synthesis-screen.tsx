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
  Target,
  Percent,
  BookOpen,
  AlertTriangle
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Type definitions for GEO API responses
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
  semantic_score?: number
  pawc?: number
  raw_word_coverage?: number
  citation_frequency?: number
  structural_depth?: StructuralDepth
  topic_analysis?: TopicAnalysis
  error?: string // Added to handle backend failure items
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

export function GeoSynthesisScreen() {
  const [queryInput, setQueryInput] = useState<string>("")
  const [availableQueries, setAvailableQueries] = useState<QueryOption[]>([])
  const [selectedQueryId, setSelectedQueryId] = useState<string>("")
  const [analysisResult, setAnalysisResult] = useState<GeoAnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [urlInput, setUrlInput] = useState<string>("")
  const [scrapeResults, setScrapeResults] = useState<ScrapeResponse | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  
  const [metricsQuery, setMetricsQuery] = useState<string>("")
  const [metricsUrl, setMetricsUrl] = useState<string>("")
  const [metricsResult, setMetricsResult] = useState<GeoMetricsResponse | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  
  const [activeTab, setActiveTab] = useState<"ai-answer" | "competitor" | "metrics">("ai-answer")

  useEffect(() => {
    async function fetchQueries() {
      try {
        const response = await fetch("/api/geo/analyze", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" })
        })
        const data = await response.json()
        if (data.queries) setAvailableQueries(data.queries)
      } catch (err) {
        console.error("[GEO] Error fetching queries:", err)
      }
    }
    fetchQueries()
  }, [])

  useEffect(() => {
    if (!selectedQueryId) return
    async function fetchAnalysis() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/geo/analyze?query_id=${selectedQueryId}`)
        if (!response.ok) throw new Error("Failed to fetch analysis")
        const data = await response.json()
        setAnalysisResult(data)
      } catch (err) {
        setError("Failed to load analysis results")
      } finally {
        setIsLoading(false)
      }
    }
    fetchAnalysis()
  }, [selectedQueryId])

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
      const newQuery: QueryOption = {
        id: data.id,
        user_query: data.user_query,
        model_name: data.model_name,
        timestamp: data.timestamp
      }
      setAvailableQueries(prev => [newQuery, ...prev])
      setSelectedQueryId(data.id)
      setQueryInput("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI response")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleScrapeUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!urlInput.trim()) return
    setIsScraping(true)
    setScrapeError(null)
    try {
      const urls = urlInput.includes(",") 
        ? urlInput.split(",").map(u => u.trim()).filter(Boolean)
        : [urlInput.trim()]
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
      setUrlInput("")
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Failed to scrape URL")
    } finally {
      setIsScraping(false)
    }
  }

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
          urls: [metricsUrl.trim()] 
        })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch GEO metrics")
      }
      const data = await response.json()
      setMetricsResult(data)
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : "Failed to fetch GEO metrics")
    } finally {
      setIsLoadingMetrics(false)
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "Step-by-step": return <LayoutList className="h-4 w-4" />
      case "Bullet list": return <LayoutList className="h-4 w-4" />
      case "Definition / Summary": return <FileText className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("ai-answer")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "ai-answer" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI Answer Analysis</span>
        </button>
        <button
          onClick={() => setActiveTab("competitor")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "competitor" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> Competitor Scraping</span>
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "metrics" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> GEO Metrics</span>
        </button>
      </div>

      {activeTab === "ai-answer" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Ask AI a Question</CardTitle>
              <CardDescription>Enter a query to get an AI-generated answer and see its analysis</CardDescription>
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
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="ml-2">Generate</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {availableQueries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Previous Queries</CardTitle>
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
                      <option key={query.id} value={query.id}>{query.user_query}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {(isLoading || isSubmitting) && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent><Skeleton className="h-32 w-full" /></CardContent>
              </Card>
            </div>
          )}

          {!isLoading && !isSubmitting && analysisResult && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg"><Search className="h-5 w-5 text-primary" /> Target Query</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium">{analysisResult.user_query}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Cpu className="h-4 w-4" /> {analysisResult.model_name}</span>
                      <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {formatTimestamp(analysisResult.timestamp)}</span>
                      {analysisResult.metadata?.total_tokens && <span className="text-xs">({analysisResult.metadata.total_tokens} tokens)</span>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Raw AI-Generated Answer</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full overflow-y-auto rounded-md border p-4 bg-muted/30">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{analysisResult.raw_ai_answer}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Key Concepts</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.detected_entities.length > 0 ? (
                        analysisResult.detected_entities.map((entity, index) => (
                          <Badge key={index} variant="secondary" className="text-sm">{entity}</Badge>
                        ))
                      ) : <p className="text-sm text-muted-foreground">No key concepts detected</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><LayoutList className="h-5 w-5" /> Answer Format</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {getFormatIcon(analysisResult.answer_format)}
                      </div>
                      <div>
                        <p className="font-medium">{analysisResult.answer_format}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "competitor" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Scrape Competitor Content</CardTitle>
              <CardDescription>Enter a URL to scrape and analyze competitor content structure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScrapeUrl} className="flex gap-3">
                <Input type="text" placeholder="URL(s) separated by commas" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} disabled={isScraping} className="flex-1" />
                <Button type="submit" disabled={isScraping || !urlInput.trim()}>
                  {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                  <span className="ml-2">Scrape</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {scrapeError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{scrapeError}</AlertDescription></Alert>}

          {isScraping && (
            <Card><CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
          )}

          {!isScraping && scrapeResults && (
            <div className="space-y-6">
              {scrapeResults.results.map((result, index) => (
                <Card key={index} className={result.error ? "border-destructive" : ""}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {result.error ? <XCircle className="h-5 w-5 text-destructive" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
                      <span className="truncate">{result.url}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : result.structure_fingerprint && (
                      <div className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-1 space-y-4">
                          <div className="p-2 bg-muted/50 rounded flex justify-between"><span>Words</span><Badge>{result.structure_fingerprint.metrics.total_word_count}</Badge></div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "metrics" && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> GEO Metrics Analysis</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleFetchMetrics} className="space-y-4">
                <div className="space-y-2"><label className="text-sm font-medium">Query</label><Input value={metricsQuery} onChange={(e) => setMetricsQuery(e.target.value)} disabled={isLoadingMetrics} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Competitor URL</label><Input value={metricsUrl} onChange={(e) => setMetricsUrl(e.target.value)} disabled={isLoadingMetrics} /></div>
                <Button type="submit" disabled={isLoadingMetrics || !metricsQuery.trim() || !metricsUrl.trim()} className="w-full">
                  {isLoadingMetrics ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />} Analyze GEO Metrics
                </Button>
              </form>
            </CardContent>
          </Card>

          {metricsError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{metricsError}</AlertDescription></Alert>}

          {isLoadingMetrics && <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>}

          {!isLoadingMetrics && metricsResult && (
            <div className="space-y-6">
              {metricsResult.geo_metrics.map((metric, index) => (
                <div key={index} className="space-y-6">
                  {metric.error ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Failed to analyze {metric.url}: {metric.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Globe className="h-5 w-5 text-primary" /> Analysis for: {metric.url}</CardTitle></CardHeader>
                      </Card>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                          <CardHeader className="pb-2"><CardDescription>Semantic Score</CardDescription></CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {metric.semantic_score !== undefined ? (metric.semantic_score * 100).toFixed(1) : "0.0"}%
                            </div>
                            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${(metric.semantic_score || 0) * 100}%` }} />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2"><CardDescription>PAWC Score</CardDescription></CardHeader>
                          <CardContent><div className="text-2xl font-bold">{metric.pawc?.toFixed(1) || "0.0"}</div></CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2"><CardDescription>Word Coverage</CardDescription></CardHeader>
                          <CardContent><div className="text-2xl font-bold">{metric.raw_word_coverage ? (metric.raw_word_coverage * 100).toFixed(2) : "0.00"}%</div></CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2"><CardDescription>Citations</CardDescription></CardHeader>
                          <CardContent><div className="text-2xl font-bold">{metric.citation_frequency || 0}</div></CardContent>
                        </Card>
                      </div>

                      {metric.structural_depth && (
                        <Card>
                          <CardHeader><CardTitle>Structural Comparison</CardTitle></CardHeader>
                          <CardContent>
                            <div className="grid gap-6 md:grid-cols-2">
                              <div className="space-y-3">
                                <h4 className="font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI</h4>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-muted/50 rounded"><div className="font-bold">{metric.structural_depth.ai.total_word_count}</div><div className="text-xs">Words</div></div>
                                  <div className="p-2 bg-muted/50 rounded"><div className="font-bold">{metric.structural_depth.ai.section_count}</div><div className="text-xs">Sections</div></div>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <h4 className="font-medium flex items-center gap-2"><Globe className="h-4 w-4 text-orange-500" /> Competitor</h4>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-muted/50 rounded"><div className="font-bold">{metric.structural_depth.competitor.total_word_count}</div><div className="text-xs">Words</div></div>
                                  <div className="p-2 bg-muted/50 rounded"><div className="font-bold">{metric.structural_depth.competitor.section_count}</div><div className="text-xs">Sections</div></div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {metric.topic_analysis && (
                        <Card>
                          <CardHeader><CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Topic Analysis</CardTitle></CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Included</h4>
                              <div className="flex flex-wrap gap-2">{metric.topic_analysis.included_topics?.map((t, i) => <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700">{t}</Badge>)}</div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" /> Missing</h4>
                              <div className="flex flex-wrap gap-2">{metric.topic_analysis.missing_topics?.map((t, i) => <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700">{t}</Badge>)}</div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              ))}

              {metricsResult.structural_preferences && (
                <Card>
                  <CardHeader><CardTitle>Structural Preferences</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium">Heading Depth</p>
                        <p className="text-xs text-muted-foreground capitalize">{metricsResult.structural_preferences.heading_depth_bias}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}