import { GeoSynthesisScreen } from "@/components/geo/geo-synthesis-screen"

/**
 * GEO Platform - Generative Engine Optimization
 * 
 * This page contains the GEO analysis pipeline with 4 parts:
 * - Part 1: AI Answer Analysis - Generate and analyze AI responses
 * - Part 2: Competitor Scraping - Scrape and analyze competitor content structure
 * - Part 3: GEO Metrics Dashboard - Compare AI vs Competitor with read-only metrics
 * - Part 4: GEO Agent Pipeline - Complete AI-driven analysis with causal reasoning and recommendations
 */
export default function GeoPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GEO Analysis Platform</h1>
        <p className="text-muted-foreground">
          Generative Engine Optimization - Analyze AI responses and compare against competitor content
        </p>
      </div>

      {/* Main GEO Component with Tabs for Part 1, 2, and 3 */}
      <GeoSynthesisScreen />
    </div>
  )
}
