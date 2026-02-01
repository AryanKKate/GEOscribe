# GEO Agent Part 4 - Line-by-Line Changes Guide

## File 1: `/client/src/app/api/geo/agent/route.ts` (NEW FILE)
**Status:** ✨ CREATED
**Type:** Next.js API Route Handler
**Lines:** 1-79

### Purpose
- Handles POST requests from frontend with query parameter
- Forwards requests to Flask `/geo-agent` endpoint
- Validates response and returns agent result

### Key Functions
```typescript
export async function POST(request: NextRequest)
  - Validates { query } in request body
  - Calls FLASK_BACKEND_URL/geo-agent
  - Returns formatted response with timestamp
  - Error handling for failed requests
```

---

## File 2: `/client/src/components/geo/geo-agent-panel.tsx` (NEW FILE)
**Status:** ✨ CREATED
**Type:** React Component
**Lines:** 1-353

### Structure
```
Component: GeoAgentPanel
  Props: { result: GeoAgentResult }
  
  Rendered Sections:
  1. Query Display (Card)
  2. AI-Generated Answer (Scrollable Card)
  3. Referenced URLs (Link Card)
  4. GEO Recommendations (JSON/Text Card)
  5. Generated Webpage:
     - Metadata Card
     - Executive Summary Card
     - Page Sections Cards
     - FAQ Card
     - Internal Linking Card
     - Schema Hints Card
```

### Key Features
- Flexible JSON rendering function: `renderJSON()`
- Handles multiple data formats (string, object, array)
- Color-coded UI elements and badges
- Responsive grid layouts
- Null/undefined safety

---

## File 3: `/client/src/components/geo/geo-synthesis-screen.tsx`
**Status:** 📝 MODIFIED
**Type:** React Component (Main GEO Screen)

### Change 1: Add GeoAgentPanel Import
**Line:** 40 (after line 39)
```typescript
// ADDED:
import { GeoAgentPanel } from "./geo-agent-panel"
```
**Before:**
```typescript
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
```

**After:**
```typescript
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GeoAgentPanel } from "./geo-agent-panel"

/**
```

---

### Change 2: Add Missing Icons to Imports
**Line:** 37-39 (in lucide imports)
```typescript
// ADDED TO IMPORTS:
  Lightbulb,
  Zap
```

**Before:**
```typescript
  Minus,
  ArrowRight
} from "lucide-react"
```

**After:**
```typescript
  Minus,
  ArrowRight,
  Lightbulb,
  Zap
} from "lucide-react"
```

---

### Change 3: Add GEO Agent Type Definitions
**Line:** 173-210 (after GeoMetricsResponse interface)
```typescript
// ADDED TYPES:
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
```

---

### Change 4: Add State Variables for GEO Agent
**Line:** 255-260 (after metricsError state, before activeTab)
```typescript
// ADDED STATE:
const [agentQuery, setAgentQuery] = useState<string>("")
const [agentResult, setAgentResult] = useState<GeoAgentResponse | null>(null)
const [isLoadingAgent, setIsLoadingAgent] = useState(false)
const [agentError, setAgentError] = useState<string | null>(null)
```

---

### Change 5: Update activeTab Type Definition
**Line:** 263 (changed from line 257)
```typescript
// CHANGED FROM:
const [activeTab, setActiveTab] = useState<"ai-answer" | "competitor" | "metrics">("ai-answer")

// TO:
const [activeTab, setActiveTab] = useState<"ai-answer" | "competitor" | "metrics" | "agent">("ai-answer")
```

---

### Change 6: Add handleFetchAgent Function
**Line:** 458-494 (after handleFetchMetrics function)
```typescript
// ADDED FUNCTION:
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
```

---

### Change 7: Add Part 4 Tab Button to Navigation
**Line:** 566-578 (after Part 3 tab button)
```typescript
// ADDED TAB BUTTON:
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
```

---

### Change 8: Add Part 4 Tab Content Section
**Line:** 1573-1683 (after Part 3 tab content, before closing `</div>`)
```typescript
// ADDED ENTIRE SECTION:
{activeTab === "agent" && (
  <>
    {/* Alert Banner */}
    <Alert className="border-primary/20 bg-primary/5">
      <Sparkles className="h-4 w-4" />
      <AlertDescription>
        <span className="font-medium">Part 4: GEO Agent Pipeline</span> - ...
      </AlertDescription>
    </Alert>

    {/* Input Card */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Run GEO Agent Analysis
        </CardTitle>
        <CardDescription>
          Enter a query to run the complete GEO pipeline...
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

    {/* Error State */}
    {agentError && (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{agentError}</AlertDescription>
      </Alert>
    )}

    {/* Loading State */}
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

    {/* Results */}
    {!isLoadingAgent && agentResult && (
      <GeoAgentPanel result={agentResult} />
    )}

    {/* Empty State */}
    {!isLoadingAgent && !agentResult && !agentError && (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">GEO Agent Not Run Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            Enter a query above to run the complete GEO agent pipeline...
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
```

---

## File 4: `/client/src/app/(dashboard)/dashboard/geo/page.tsx`
**Status:** 📝 MODIFIED
**Type:** React Page Component

### Change 1: Update JSDoc Comment
**Line:** 3-10
```typescript
// CHANGED FROM:
/**
 * GEO Platform - Generative Engine Optimization
 * 
 * This page contains the GEO analysis pipeline with 3 parts:
 * - Part 1: AI Answer Analysis - Generate and analyze AI responses
 * - Part 2: Competitor Scraping - Scrape and analyze competitor content structure
 * - Part 3: GEO Metrics Dashboard - Compare AI vs Competitor with read-only metrics
 * 
 * Part 4 (Recommendations) is handled separately.
 */

// TO:
/**
 * GEO Platform - Generative Engine Optimization
 * 
 * This page contains the GEO analysis pipeline with 4 parts:
 * - Part 1: AI Answer Analysis - Generate and analyze AI responses
 * - Part 2: Competitor Scraping - Scrape and analyze competitor content structure
 * - Part 3: GEO Metrics Dashboard - Compare AI vs Competitor with read-only metrics
 * - Part 4: GEO Agent Pipeline - Complete AI-driven analysis with causal reasoning and recommendations
 */
```

---

## Summary of Changes

### Statistics
- **Files Created:** 2
  - `/client/src/app/api/geo/agent/route.ts` (79 lines)
  - `/client/src/components/geo/geo-agent-panel.tsx` (353 lines)
  
- **Files Modified:** 2
  - `/client/src/components/geo/geo-synthesis-screen.tsx` (8 changes)
  - `/client/src/app/(dashboard)/dashboard/geo/page.tsx` (1 change)

- **Total New Lines:** ~600 lines
- **Total Modified Lines:** ~15 lines

### Change Categories
| Category | Count |
|----------|-------|
| Imports Added | 2 |
| Type Definitions Added | 3 |
| State Variables Added | 4 |
| Functions Added | 1 |
| UI Elements Added | 1 main section (111 lines) |
| Documentation Updated | 1 |

---

## Testing Each Change

### 1. Test API Route (`/client/src/app/api/geo/agent/route.ts`)
```bash
# Make POST request
curl -X POST http://localhost:3000/api/geo/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "What is machine learning?"}'
```
**Expected:** Returns agent result with all fields

### 2. Test Component Display (`/client/src/components/geo/geo-agent-panel.tsx`)
```typescript
// In browser console
import { GeoAgentPanel } from '@/components/geo/geo-agent-panel'
// Should load without errors
```

### 3. Test Synthesis Screen Updates (`/client/src/components/geo/geo-synthesis-screen.tsx`)
- Navigate to `/dashboard/geo`
- Verify Part 4 tab appears
- Click Part 4 tab
- Verify all UI elements load correctly

### 4. Test Page Documentation
- Check JSDoc in page.tsx file
- Verify 4 parts are documented

---

## Deployment Checklist

- [ ] Both new files created in correct locations
- [ ] All imports added to synthesis screen
- [ ] All type definitions added
- [ ] All state variables initialized
- [ ] Handler function works correctly
- [ ] Tab navigation button appears
- [ ] Tab content renders properly
- [ ] Error states handled
- [ ] Loading states work
- [ ] Results display with GeoAgentPanel
- [ ] Empty state shows when no results
- [ ] Documentation updated
- [ ] Test end-to-end flow
- [ ] Verify Flask backend integration works

---

## Rollback Instructions

If you need to revert these changes:

1. Delete new files:
   ```bash
   rm /client/src/app/api/geo/agent/route.ts
   rm /client/src/components/geo/geo-agent-panel.tsx
   ```

2. Revert synthesis screen changes:
   - Remove GeoAgentPanel import
   - Remove Lightbulb and Zap from lucide imports
   - Remove GeoAgent type definitions
   - Remove agentQuery, agentResult, isLoadingAgent, agentError state
   - Revert activeTab to 3-tab version
   - Remove handleFetchAgent function
   - Remove Part 4 tab button
   - Remove Part 4 tab content section

3. Revert page documentation:
   - Change "4 parts" back to "3 parts"
   - Remove Part 4 description

---

## Notes

- **No backend changes required** - Flask endpoint already exists
- **Environment variables** - Uses existing FLASK_BACKEND_URL config
- **Dependencies** - No new packages needed
- **Compatibility** - Works with existing 3-part GEO system
