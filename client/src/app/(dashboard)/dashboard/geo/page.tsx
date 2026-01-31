import { GeoSynthesisScreen } from "@/components/geo/geo-synthesis-screen"

/**
 * GEO Answers Synthesis Page - Step 4 of the GEO Platform
 * 
 * This page displays how a generative AI currently answers a given user query.
 * It is READ-ONLY and does NOT modify or optimize content.
 * 
 * Features:
 * - Target query display
 * - Raw AI-generated answer viewer
 * - Key concepts/entities as tags
 * - Answer format classification
 */
export default function GeoPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GEO Answers Synthesis</h1>
        <p className="text-muted-foreground">
          Understand how AI models respond to user queries. This is a read-only analysis view.
        </p>
      </div>

      {/* Main GEO Synthesis Component */}
      <GeoSynthesisScreen />
    </div>
  )
}
