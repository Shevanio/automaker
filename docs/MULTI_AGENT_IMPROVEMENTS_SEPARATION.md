# Multi-Agent Spec Analysis: Documentation & Improvements Separation

## Overview

This document describes the architectural improvement implemented to separate documentation from improvement proposals in the Multi-Agent Spec Analysis feature.

## Problem Statement

Previously, the multi-agent analysis generated a single output that mixed:

- ✅ Architectural documentation (what exists)
- ⚠️ Improvement proposals (what could be better)
- 💡 Architectural insights

This created confusion because:

1. **Component documentation included warnings**: Each component had all agent insights AND warnings appended to its notes, causing massive repetition
2. **No clear separation**: Users couldn't distinguish between "current state documentation" and "improvement opportunities"
3. **Warnings were duplicated**: If an agent generated 2 summaries, both had the same 4 warnings copied to each

## Solution Architecture

### Backend Changes

#### 1. Updated Agent Prompt Format (`libs/prompts/src/multi-agent-spec.ts`)

**Before**: Agents returned `tasks` array with implementation-focused fields

```json
{
  "tasks": [
    {
      "title": "...",
      "estimated_duration_mins": 30,
      "complexity": 7,
      "files_to_create": [],
      "files_to_modify": [],
      "agent_notes": "..."
    }
  ]
}
```

**After**: Agents return `architecture_summary` array with documentation focus

```json
{
  "architecture_summary": [
    {
      "title": "Authentication & Authorization System",
      "description": "Comprehensive 2-4 sentence summary...",
      "key_files": ["auth.ts", "middleware.ts"],
      "technologies": ["express@^5.0.0", "crypto"]
    }
  ],
  "insights": [...],
  "warnings": [...]
}
```

**Key changes**:

- Renamed `tasks` → `architecture_summary` (semantic clarity)
- Changed from "1-2 paragraphs" to "2-4 sentences" (more concise)
- Removed `estimated_duration_mins`, `complexity`, `priority` (not relevant for documentation)
- Changed `files_to_modify` → `key_files` (documentation context)
- Added `technologies` field (explicit dependency listing)
- Emphasized "ONLY 1-2 HIGH-LEVEL SUMMARIES" (reduced verbosity)

#### 2. Service Layer Changes (`apps/server/src/services/multi-agent-spec-service.ts`)

**A. Sequential Agent Execution**

```typescript
// Before: 3 agents in parallel (caused Claude CLI concurrency issues)
const MAX_CONCURRENT_AGENTS = 3;

// After: 1 agent at a time (stable execution)
const MAX_CONCURRENT_AGENTS = 1;
```

**Reason**: Running 3 agents simultaneously caused `Claude Code process exited with code 1` errors. Sequential execution is slower (~3-5 min) but reliable (6/6 agents complete).

**B. Response Parsing**

```typescript
// Support both old format (tasks) and new format (architecture_summary)
const summaries = parsed.architecture_summary || parsed.tasks || [];

tasks_identified: summaries.map((t: any, idx: number) => ({
  id: `${agent.specialization}-summary-${idx + 1}`, // Changed: task → summary
  estimated_duration_mins: 0, // Always 0 for documentation
  files_to_modify: t.key_files || t.files_to_modify || [], // Support both formats
  agent_notes: t.technologies?.join(', ') || t.agent_notes || '', // Use technologies
}));
```

**C. Removed Agent-Level Insights/Warnings from Component Notes**

**Before** (INCORRECT - caused massive duplication):

```typescript
const notes: string[] = [];
if (task.agent_notes) notes.push(task.agent_notes);

// ❌ This added ALL agent insights to EVERY component
agentAnalysis.insights.forEach((i: string) => notes.push(`💡 ${i}`));
agentAnalysis.warnings.forEach((w: string) => notes.push(`⚠️  ${w}`));

steps.push({
  agent_notes: notes.filter(Boolean).join('\n\n'), // Massive repetition!
});
```

**After** (CORRECT - only task-specific notes):

```typescript
const notes: string[] = [];
if (task.agent_notes) notes.push(task.agent_notes);

// ✅ Insights/warnings are in agentAnalysis.insights/warnings
// They will be rendered separately in "Agent Insights" section

steps.push({
  agent_notes: notes.filter(Boolean).join('\n\n'), // Clean, no duplication
});
```

### Frontend Changes

#### 3. Spec Editor with Tabs (`apps/ui/src/components/views/spec-view/components/spec-editor.tsx`)

**Before**: Single editor for spec content

```tsx
<XmlSyntaxEditor value={value} onChange={onChange} />
```

**After**: Tabs for Documentation and Improvements

```tsx
<Tabs defaultValue="spec">
  <TabsList>
    <TabsTrigger value="spec">
      <FileText /> Documentation
    </TabsTrigger>
    <TabsTrigger value="improvements">
      <AlertTriangle /> Improvements
    </TabsTrigger>
  </TabsList>

  <TabsContent value="spec">
    <XmlSyntaxEditor value={specValue} onChange={onSpecChange} />
  </TabsContent>

  <TabsContent value="improvements">
    <XmlSyntaxEditor value={improvementsValue} onChange={onImprovementsChange} />
  </TabsContent>
</Tabs>
```

#### 4. Dual State Management (`apps/ui/src/components/views/spec-view.tsx`)

**Added**:

- `improvementsContent` state for improvements tab
- `formatAnalysisToImprovements()` utility function
- `handleSave()` wrapper that saves both files

**Apply Analysis Handler**:

```typescript
const handleApplyAnalysis = async (analysisResult: MultiAgentAnalysis) => {
  // Format documentation (without warnings)
  const formattedSpec = formatAnalysisToSpec(analysisResult);

  // Format improvements (only warnings)
  const formattedImprovements = formatAnalysisToImprovements(analysisResult);

  // Update both editors
  handleChange(formattedSpec);
  setImprovementsContent(formattedImprovements);

  setHasChanges(true);
};
```

**Save Handler**:

```typescript
const handleSave = async () => {
  await saveSpec(); // Save .automaker/app_spec.txt

  // Also save improvements if there's content
  if (currentProject && improvementsContent.trim()) {
    await api.writeFile(`${currentProject.path}/.automaker/improvements.md`, improvementsContent);
  }
};
```

#### 5. Formatting Functions (`apps/ui/src/components/views/spec-view/utils.ts`)

**A. `formatAnalysisToSpec()` - Documentation Only**

Generates:

```markdown
# App Specification Analysis

## Documentation Summary

- Components Documented: 13
- Analysis Coverage: 6/6 agents

## Architecture Components

### 1. File-Based JSON Storage 🗄️

**Documentation**: The application uses...
**Implementation Files**: ...
**Technical Notes**: ...

---

## Agent Insights

### 🗄️ Database Agent

**Architectural Insights**:

- 💡 Atomic file writes...
- 💡 Storage hierarchy...

**Current Dependencies**:

- Node.js fs/promises

## Analysis Metadata

- Started: ...
- Completed: ...
```

**Removed**:

- ❌ Complexity Score
- ❌ Risk Level
- ❌ Warnings from Agent Insights section

**B. `formatAnalysisToImprovements()` - Warnings Only**

Generates:

```markdown
# Proposed Improvements

Based on the architectural analysis of **App Specification Analysis**

## Summary

The multi-agent analysis identified **24 potential improvements** across 6 domain areas.

## Improvement Opportunities by Domain

### 🎨 Frontend Agent

1. The app-store.ts file exceeds 25000 tokens...
2. Session token is stored in memory...
3. WebSocket connections use query parameters...

### ⚙️ Backend Agent

1. API keys printed to console on startup...
2. Session tokens persist to disk without encryption...

---

## Analysis Metadata

- Generated: 2/1/2026, 20:49:35
- Agents Analyzed: 6/6
```

#### 6. Modal Cleanup (`apps/ui/src/components/views/spec-view/dialogs/multi-agent-analysis-modal.tsx`)

**Removed**:

- ❌ "Save Improvements" button (no longer needed - Apply Spec does both)
- ❌ `onSaveImprovements` prop
- ❌ Complexity Score and Risk Level from completion summary

**Updated**:

- "Total Tasks" → "Components Documented"
- "Estimated Duration" → Removed (always 0m for documentation)
- "X tasks • Y min" → "X summaries" (no duration)

## File Structure

After analysis, two files are created:

```
.automaker/
├── app_spec.txt          # Documentation tab content
│   ├── Architecture Components
│   ├── Agent Insights (💡 only)
│   └── Analysis Metadata
│
└── improvements.md       # Improvements tab content
    ├── Summary (total warnings count)
    ├── Improvement Opportunities (⚠️ by domain)
    └── Analysis Metadata
```

## Benefits

### 1. **Clarity**: Clear separation between "what exists" and "what to improve"

- Documentation is clean, professional, suitable for sharing with stakeholders
- Improvements are actionable, organized by domain (Frontend, Backend, Security, etc.)

### 2. **No Duplication**: Each warning appears once, not repeated in every component

- Before: 2 components × 4 warnings = 8 repetitions
- After: 4 warnings listed once in Improvements tab

### 3. **Better UX**: Tabs make it easy to switch context

- Documentation tab: Understanding the system
- Improvements tab: Planning technical debt reduction

### 4. **Flexible Output**: Can share files independently

- Share `app_spec.txt` with new developers for onboarding
- Share `improvements.md` with tech leads for roadmap planning
- Both together for comprehensive project documentation

## Technical Decisions

### Why Sequential Agent Execution?

Running 3 agents in parallel caused Claude CLI to fail with exit code 1. Root cause appears to be concurrency limits in Claude CLI process spawning. Sequential execution (1 agent at a time) is slower but 100% reliable.

### Why Not Remove Insights/Warnings from Backend Response?

The `agentAnalysis.insights` and `agentAnalysis.warnings` arrays are still populated and sent to frontend. We simply stopped duplicating them into each component's `agent_notes`. This allows:

- Modal to show full preview (insights + warnings)
- Frontend to format differently for Documentation vs Improvements tabs
- Backward compatibility if we need the data structure later

### Why Two Files Instead of One with Sections?

Separating into two files allows users to:

- Share documentation without exposing technical debt
- Use improvements.md as a backlog/roadmap independently
- Version control each separately (e.g., docs stable, improvements evolving)

## Testing

Manual testing verified:

1. ✅ All 6 agents complete (Frontend, Backend, Database, Security, Testing, DevOps)
2. ✅ Documentation tab has NO warnings
3. ✅ Improvements tab has 24 warnings organized by domain
4. ✅ Both files save correctly on "Save" click
5. ✅ No duplication of insights/warnings in component notes

## Future Enhancements

Potential improvements:

1. Add "Export to PDF" for documentation
2. Add "Create Issues from Improvements" feature
3. Add diff view to see changes between analyses
4. Add filtering/sorting for improvements by priority
5. Add progress tracking for improvements addressed

## Migration Notes

Existing analysis results in the old format will still work:

- Backend parser checks `architecture_summary || tasks` (backward compatible)
- Frontend handles missing improvements gracefully (empty state)
- No database migration needed (file-based storage)

## Related Files

### Backend

- `apps/server/src/services/multi-agent-spec-service.ts` - Main service, agent execution
- `apps/server/src/routes/spec/multi-agent.ts` - API endpoints
- `libs/prompts/src/multi-agent-spec.ts` - Agent prompt templates

### Frontend

- `apps/ui/src/components/views/spec-view.tsx` - Main view, dual state
- `apps/ui/src/components/views/spec-view/components/spec-editor.tsx` - Tabs UI
- `apps/ui/src/components/views/spec-view/utils.ts` - Formatting functions
- `apps/ui/src/components/views/spec-view/dialogs/multi-agent-analysis-modal.tsx` - Preview modal

## Performance Impact

- **Analysis time**: Increased from ~90s (3 parallel) to ~3-5min (sequential)
  - Trade-off: Slower but 100% reliable (no agent failures)
- **UI rendering**: Minimal impact
  - Tabs are lazy-loaded
  - Markdown rendering is the same

- **Storage**: ~2x file size (two files instead of one)
  - Documentation: ~50-100KB
  - Improvements: ~10-30KB
  - Total: Negligible for modern systems

## Conclusion

This improvement successfully separates architectural documentation from improvement proposals, providing:

- ✅ Cleaner, more professional documentation output
- ✅ Actionable, organized improvement suggestions
- ✅ Flexible file structure for different use cases
- ✅ Better user experience with clear context switching via tabs

The implementation maintains backward compatibility while providing a foundation for future enhancements to the multi-agent analysis system.
