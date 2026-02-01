"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, CheckCircle, AlertCircle, Plus, Zap } from "lucide-react"

interface RecommendationItem {
  section?: string
  title?: string
  description?: string
  priority?: "high" | "medium" | "low"
  items?: string[]
  format?: string
}

interface GeoRecommendationsProps {
  recommendations: any
}

/**
 * Structured display for GEO recommendations
 * Converts raw JSON into organized, card-based UI
 */
export function GeoRecommendationsPanel({ recommendations }: GeoRecommendationsProps) {
  // Parse recommendations if needed
  let parsedRecommendations: any = recommendations
  if (typeof recommendations === "string") {
    try {
      parsedRecommendations = JSON.parse(recommendations)
    } catch {
      parsedRecommendations = { raw_text: recommendations }
    }
  }

  // Handle array format (from backend)
  if (Array.isArray(parsedRecommendations)) {
    parsedRecommendations = { items: parsedRecommendations }
  }

  return (
    <div className="space-y-4">
      {/* Missing Sections - for AI Answer improvements */}
      {parsedRecommendations.suggested_improvements && (
        <Card className="border-amber-100 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-100">
              <Plus className="h-4 w-4" />
              Missing Elements in AI Answer
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-200">
              Add these sections to make your answer more comprehensive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {parsedRecommendations.suggested_improvements.map(
                (improvement: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-2 rounded bg-white dark:bg-slate-900">
                    <div className="pt-0.5">
                      <Plus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                        {improvement.section || improvement.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {improvement.description}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Format Recommendations */}
      {parsedRecommendations.content_formats && (
        <Card className="border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-blue-900 dark:text-blue-100">
              <Zap className="h-4 w-4" />
              Recommended Content Formats
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-200">
              Enhance your answer with these content types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {parsedRecommendations.content_formats.map(
                (format: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                  >
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {format.title || format}
                    </p>
                    {format.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {format.description}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structural Improvements */}
      {parsedRecommendations.structural_improvements && (
        <Card className="border-green-100 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-green-900 dark:text-green-100">
              <CheckCircle className="h-4 w-4" />
              Structural Improvements
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-200">
              Improve readability and organization of your answer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parsedRecommendations.structural_improvements.map(
                (improvement: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-white dark:bg-slate-900">
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {improvement.title || improvement}
                    </p>
                    {improvement.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {improvement.description}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Metrics */}
      {parsedRecommendations.quality_metrics && (
        <Card className="border-purple-100 bg-purple-50 dark:border-purple-900 dark:bg-purple-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-purple-900 dark:text-purple-100">
              <Lightbulb className="h-4 w-4" />
              Quality Metrics & Guidelines
            </CardTitle>
            <CardDescription className="text-purple-700 dark:text-purple-200">
              Target metrics for optimal AI engine optimization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {Object.entries(parsedRecommendations.quality_metrics).map(
                ([key, value]: [string, any]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900"
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {key.replace(/_/g, " ")}
                    </span>
                    <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </Badge>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generic recommendation items */}
      {parsedRecommendations.items && Array.isArray(parsedRecommendations.items) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parsedRecommendations.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded bg-slate-50 dark:bg-slate-900">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="text-sm text-slate-700 dark:text-slate-300">{item}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback for unstructured recommendations */}
      {!parsedRecommendations.suggested_improvements &&
        !parsedRecommendations.content_formats &&
        !parsedRecommendations.structural_improvements &&
        !parsedRecommendations.quality_metrics &&
        !parsedRecommendations.items && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4" />
                Raw Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded overflow-auto max-h-96">
                {JSON.stringify(parsedRecommendations, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
