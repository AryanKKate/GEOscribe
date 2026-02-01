# GEO Agent (Part 4) - Changes Reference Guide

## Quick Overview
**Added:** A 4th component to the GEO platform that displays the complete AI-driven GEO Agent pipeline results including recommendations and optimized webpage drafting.

**New Endpoint Used:** `POST /api/geo/agent` → `POST http://localhost:5000/geo-agent`

---

## Files Changed - Details

### 1. ✨ NEW: `/client/src/app/api/geo/agent/route.ts`
**What:** Next.js API route that calls the Flask backend
**Why:** Bridges frontend requests to the Flask /geo-agent endpoint
**Key Code:**
```typescript
export async function POST(request: NextRequest) {
  // Accepts query parameter
  const { query } = body
  
  // Calls Flask backend
  const agentResponse = await fetch(`${FLASK_BACKEND_URL}/geo-agent`, {
    method: "POST",
    body: JSON.stringify({ query })
  })
  
  // Returns complete agent result
  return NextResponse.json({
    query, ai_answer, referenced_urls, recommendations, generated_webpage, timestamp
  })
}
```

---

### 2. ✨ NEW: `/client/src/components/geo/geo-agent-panel.tsx`
**What:** React component to display all GEO Agent results
**Why:** Renders the 4-part output (AI answer, URLs, recommendations, webpage)
**Key Sections:**
- Query Display
- AI Answer (scrollable)
- Referenced URLs (clickable links)
- GEO Recommendations (JSON/text rendering)
- Generated Webpage Structure:
  - Page metadata
  - Executive summary
  - Sections with content/bullets/definitions
  - FAQ items
  - Internal linking suggestions
  - Schema hints

---

### 3. 📝 MODIFIED: `/client/src/components/geo/geo-synthesis-screen.tsx`

#### Addition 3a: Import GeoAgentPanel
**Line:** After line 39
```typescript
import { GeoAgentPanel } from "./geo-agent-panel"
```

#### Addition 3b: Add missing icons to imports
**Line:** Added to lucide imports
```typescript
Lightbulb,
Zap
```

#### Addition 3c: Add type definitions for GEO Agent
**After line 170 (GeoMetricsResponse interface)**
```typescript
interface GeneratedWebpageSection { ... }
interface GeneratedWebpage { ... }
interface GeoAgentResponse { ... }
```

#### Addition 3d: Add state management
**Around line 257 (after metricsError state)**
```typescript
const [agentQuery, setAgentQuery] = useState<string>("")
const [agentResult, setAgentResult] = useState<GeoAgentResponse | null>(null)
const [isLoadingAgent, setIsLoadingAgent] = useState(false)
const [agentError, setAgentError] = useState<string | null>(null)
```

#### Addition 3e: Update activeTab type
**Changed from:**
```typescript
const [activeTab, setActiveTab] = useState<"ai-answer" | "competitor" | "metrics">("ai-answer")
```
**To:**
```typescript
const [activeTab, setActiveTab] = useState<"ai-answer" | "competitor" | "metrics" | "agent">("ai-answer")
```

#### Addition 3f: Add handler function
**After line 424 (after handleFetchMetrics)**
```typescript
async function handleFetchAgent(e: React.FormEvent) {
  // Handle form submission
  // Call /api/geo/agent endpoint
  // Update agentResult state
}
```

#### Addition 3g: Add Part 4 tab button to navigation
**After line 482 (after Part 3 tab button)**
```typescript
<button onClick={() => setActiveTab("agent")} ...>
  <Sparkles className="h-4 w-4" />
  Part 4: GEO Agent
</button>
```

#### Addition 3h: Add Part 4 tab content
**Before closing `</div>` at end of component**
```typescript
{activeTab === "agent" && (
  <>
    {/* Alert banner */}
    {/* Query input form */}
    {/* Error state */}
    {/* Loading state */}
    {/* Results with GeoAgentPanel */}
    {/* Empty state */}
  </>
)}
```

---

### 4. 📝 MODIFIED: `/client/src/app/(dashboard)/dashboard/geo/page.tsx`

#### Change 4a: Update JSDoc comment
**Line:** 5-11 (in the GeoPage JSDoc)
**Changed from:**
```typescript
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
```

**To:**
```typescript
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

## Backend Reference (No Changes - Already Exists)

### Flask: `server/app.py`
**Existing endpoint:** `POST /geo-agent`

**Already implements:**
- Node 1: `node_ai_answer()` - AI answer generation
- Node 2: `node_extract_refs()` - URL extraction
- Node 3: `node_collect_structure()` - Competitor scraping
- Node 4: `node_causal_reasoning()` - Causal analysis
- Node 5: `node_recommendations()` - Recommendation generation
- Node 6: `node_generate_webpage()` - Webpage draft generation

**No backend changes needed** - Everything is already implemented!

---

## User Interface Changes

### Tab Navigation
**Before (3 tabs):**
```
Part 1: AI Answer | Part 2: Competitor Scraping | Part 3: GEO Metrics
```

**After (4 tabs):**
```
Part 1: AI Answer | Part 2: Competitor Scraping | Part 3: GEO Metrics | Part 4: GEO Agent
```

### Part 4 Content Structure
```
Alert Banner (explaining Part 4)
↓
Query Input Form
  - Text input for query
  - "Run Agent Pipeline" button
↓
[Results Display - One of these:]
  1. Loading State (skeleton loaders)
  2. Error State (error message)
  3. Results (GeoAgentPanel component)
  4. Empty State (no results yet)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Part 4: GEO Agent Tab (Frontend)                               │
├─────────────────────────────────────────────────────────────────┤
│ User enters query → Click "Run Agent Pipeline"                 │
│                    ↓                                             │
│                 handleFetchAgent()                              │
│                 setIsLoadingAgent(true)                         │
│                    ↓                                             │
└─────────────────────────────────────────────────────────────────┘
                     ↓ POST request
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/geo/agent (Next.js Route Handler)                    │
├─────────────────────────────────────────────────────────────────┤
│ Parse request body { query }                                    │
│ Forward to Flask backend                                        │
│ Validate response                                               │
│ Return result                                                   │
└─────────────────────────────────────────────────────────────────┘
                     ↓ POST request
┌─────────────────────────────────────────────────────────────────┐
│ POST /geo-agent (Flask Backend)                                │
├─────────────────────────────────────────────────────────────────┤
│ Step 1: Call /ask → Generate AI answer                         │
│ Step 2: Extract URLs from answer (regex)                       │
│ Step 3: Call /collect-structure → Scrape competitors           │
│ Step 4: Call LLM for causal reasoning                          │
│ Step 5: Call LLM for recommendations                           │
│ Step 6: Call LLM to generate webpage draft                     │
│ Return: { query, ai_answer, urls, recommendations, webpage }   │
└─────────────────────────────────────────────────────────────────┘
                     ↓ Response
┌─────────────────────────────────────────────────────────────────┐
│ Response Handler (Next.js)                                      │
├─────────────────────────────────────────────────────────────────┤
│ Parse JSON response                                             │
│ setAgentResult(data)                                            │
│ setIsLoadingAgent(false)                                        │
└─────────────────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ Display Results (GeoAgentPanel Component)                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Query display card                                           │
│ 2. AI answer card (scrollable)                                  │
│ 3. Referenced URLs (clickable links)                            │
│ 4. Recommendations (JSON formatted)                             │
│ 5. Generated webpage sections                                   │
│    - Page metadata                                              │
│    - Executive summary                                          │
│    - Content sections                                           │
│    - FAQ items                                                  │
│    - Internal linking suggestions                               │
│    - Schema hints                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Testing Checklist

- [ ] Start Flask backend (`python server/app.py`)
- [ ] Start Next.js frontend (`npm run dev`)
- [ ] Navigate to `/dashboard/geo`
- [ ] Click "Part 4: GEO Agent" tab
- [ ] Enter a test query (e.g., "What is machine learning?")
- [ ] Click "Run Agent Pipeline" button
- [ ] Verify loading state appears
- [ ] Wait for results
- [ ] Verify all sections display:
  - [ ] Query display
  - [ ] AI answer
  - [ ] Referenced URLs
  - [ ] Recommendations
  - [ ] Generated webpage structure
- [ ] Test error handling (disable backend, try again)

---

## Summary of Changes

| Component | Change Type | What Added/Modified |
|-----------|------------|-------------------|
| API Route | ✨ NEW | `/client/src/app/api/geo/agent/route.ts` |
| Display Component | ✨ NEW | `/client/src/components/geo/geo-agent-panel.tsx` |
| Synthesis Screen | 📝 MODIFIED | Added Part 4 tab, state, handler, imports |
| GEO Page | 📝 MODIFIED | Updated documentation comment |

**Total Lines Added:** ~600 lines of new code
**Total Files Created:** 2 files
**Total Files Modified:** 2 files
