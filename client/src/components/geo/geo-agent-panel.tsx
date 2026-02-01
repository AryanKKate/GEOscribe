"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GeoRecommendationsPanel } from "./geo-recommendations-panel"
import {
  FileText,
  Link,
  Lightbulb,
  Zap,
  AlertCircle,
  BookOpen,
  List,
  Type,
  Globe
} from "lucide-react"

interface RecommendationSection {
  title: string;
  url?: string;
  structure?: {
    Introduction: string;
    [key: string]: string;
  };
  clarity?: number;
  sections?: number;
  bullets?: number;
  definitions?: number;
}

interface GeneratedSection {
  heading: string;
  summary: string;
  content: string;
  bullets?: string[];
  definition?: string;
}

interface GeneratedWebpage {
  page_title?: string;
  meta_description?: string;
  executive_summary?: string;
  sections?: GeneratedSection[];
  faq?: Array<{
    question: string;
    answer: string;
  }>;
  internal_linking_suggestions?: string[];
  schema_hints?: {
    article?: boolean;
    faq?: boolean;
  };
  raw_text?: string;
}

interface GeoAgentResult {
  query: string;
  ai_answer: string;
  referenced_urls: string[];
  recommendations: string | RecommendationSection[] | object;
  generated_webpage: GeneratedWebpage;
  timestamp?: string;
}

interface GeoAgentPanelProps {
  result: GeoAgentResult;
}

/**
 * Component to display the GEO Agent pipeline results (Part 4)
 * Shows AI answer, referenced URLs, recommendations, and generated webpage structure
 */
export function GeoAgentPanel({ result }: GeoAgentPanelProps) {
  // Parse recommendations if it's a JSON string
  let recommendationsData: any = result.recommendations;
  if (typeof result.recommendations === 'string') {
    try {
      recommendationsData = JSON.parse(result.recommendations);
    } catch (e) {
      recommendationsData = { raw_text: result.recommendations };
    }
  }

  // Helper to render JSON/object data
  const renderJSON = (data: any, depth = 0): ReactNode => {
    if (data === null || data === undefined) return <span className="text-muted-foreground">null</span>;
    if (typeof data === 'string') return <span>{data}</span>;
    if (typeof data === 'number' || typeof data === 'boolean') return <span>{String(data)}</span>;
    
    if (Array.isArray(data)) {
      return (
        <ul className="list-disc list-inside space-y-1 ml-4">
          {data.map((item, i) => (
            <li key={i} className="text-sm">{renderJSON(item, depth + 1)}</li>
          ))}
        </ul>
      );
    }
    
    if (typeof data === 'object') {
      return (
        <div className="space-y-2 ml-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium text-sm">{key}:</span>
              <div className="ml-2">{renderJSON(value, depth + 1)}</div>
            </div>
          ))}
        </div>
      );
    }
    
    return <span>{String(data)}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Query Display */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Query Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base font-medium">{result.query}</p>
        </CardContent>
      </Card>

      {/* AI Answer Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI-Generated Answer
          </CardTitle>
          <CardDescription>
            Complete response from the AI model with references
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full overflow-y-auto rounded-md border p-4 bg-muted/30">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {result.ai_answer || "No answer generated"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referenced URLs Section */}
      {result.referenced_urls && result.referenced_urls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Referenced URLs
            </CardTitle>
            <CardDescription>
              Sources extracted from the AI answer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.referenced_urls.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline break-all group"
                >
                  <Globe className="h-4 w-4 flex-shrink-0 group-hover:text-primary" />
                  {url}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GEO Recommendations Section - Structured Display */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          AI Answer Improvement Recommendations
        </h3>
        <GeoRecommendationsPanel recommendations={recommendationsData} />
      </div>

      {/* Generated Webpage Structure */}
      {result.generated_webpage && (
        <div className="space-y-4">
          {/* Page Metadata */}
          {(result.generated_webpage.page_title || result.generated_webpage.meta_description) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" />
                  Page Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.generated_webpage.page_title && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Page Title</p>
                    <p className="text-sm font-semibold">{result.generated_webpage.page_title}</p>
                  </div>
                )}
                {result.generated_webpage.meta_description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Meta Description</p>
                    <p className="text-sm">{result.generated_webpage.meta_description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Executive Summary */}
          {result.generated_webpage.executive_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">
                  {result.generated_webpage.executive_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Generated Sections */}
          {result.generated_webpage.sections && result.generated_webpage.sections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Type className="h-4 w-4" />
                  Page Sections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {result.generated_webpage.sections.map((section, index) => (
                    <div key={index} className="border-l-4 border-primary/30 pl-4 py-2">
                      <h4 className="font-semibold text-sm mb-1">{section.heading}</h4>
                      {section.summary && (
                        <p className="text-xs text-muted-foreground mb-2">{section.summary}</p>
                      )}
                      {section.content && (
                        <p className="text-sm leading-relaxed mb-2">{section.content}</p>
                      )}
                      {section.bullets && section.bullets.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 ml-2 mb-2">
                          {section.bullets.map((bullet, bIndex) => (
                            <li key={bIndex} className="text-sm text-muted-foreground">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}
                      {section.definition && (
                        <p className="text-xs italic text-muted-foreground bg-muted/50 p-2 rounded">
                          <span className="font-medium">Definition:</span> {section.definition}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* FAQ Section */}
          {result.generated_webpage.faq && result.generated_webpage.faq.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <List className="h-4 w-4" />
                  Generated FAQ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.generated_webpage.faq.map((item, index) => (
                    <div key={index} className="border-b pb-4 last:border-b-0">
                      <h5 className="font-medium text-sm mb-2">{item.question}</h5>
                      <p className="text-sm text-muted-foreground">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Internal Linking Suggestions */}
          {result.generated_webpage.internal_linking_suggestions && 
           result.generated_webpage.internal_linking_suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link className="h-4 w-4" />
                  Internal Linking Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {result.generated_webpage.internal_linking_suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Schema Hints */}
          {result.generated_webpage.schema_hints && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schema Hints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.generated_webpage.schema_hints.article && (
                    <Badge variant="secondary">Article Schema</Badge>
                  )}
                  {result.generated_webpage.schema_hints.faq && (
                    <Badge variant="secondary">FAQ Schema</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
