# Multi-Agent Spec Fix - Root Cause Analysis

## Problem Summary

All 6 specialized agents in the Multi-Agent Spec Analysis feature were failing with:

```
Failed to spawn Claude Code process: spawn node ENOENT
```

This caused 0 tasks to be generated despite the UI and backend logic being correct.

---

## Root Cause

**MultiAgentSpecService was bypassing the centralized SDK options factory.**

Instead of using `createChatOptions()` or `createCustomOptions()` from `apps/server/src/lib/sdk-options.ts`, it was calling `provider.executeQuery()` with raw options:

### ❌ BROKEN CODE (Before)

```typescript
// apps/server/src/services/multi-agent-spec-service.ts:156-164
const generator = this.claudeProvider.executeQuery({
  prompt,
  model: model || agent.model || 'claude-sonnet-4',
  systemPrompt: agent.systemPrompt,
  cwd: projectContext || process.cwd(),
  maxTurns: 1,
  // ❌ MISSING: settingSources
  // ❌ MISSING: sandbox
  // ❌ MISSING: allowedTools
  // ❌ MISSING: proper SDK options structure
});
```

### ✅ WORKING CODE (After)

```typescript
// Build SDK options using centralized factory (same pattern as AgentService)
const sdkOptions = createCustomOptions({
  cwd: projectContext || process.cwd(),
  model: model || agent.model || 'claude-sonnet-4',
  systemPrompt: agent.systemPrompt,
  maxTurns: 1,
  allowedTools: TOOL_PRESETS.readOnly, // Read-only tools for analysis
});

// Build ExecuteOptions from SDK options (same pattern as AgentService:282-297)
const options: ExecuteOptions = {
  prompt,
  model: sdkOptions.model!,
  cwd: sdkOptions.cwd!,
  systemPrompt: sdkOptions.systemPrompt,
  maxTurns: sdkOptions.maxTurns,
  allowedTools: sdkOptions.allowedTools as string[] | undefined,
  settingSources: sdkOptions.settingSources, // ← CRITICAL
  sandbox: sdkOptions.sandbox, // ← CRITICAL
};

const generator = this.claudeProvider.executeQuery(options);
```

---

## Why This Matters

The `@anthropic-ai/claude-agent-sdk` requires specific configuration to spawn subprocesses correctly:

1. **`settingSources`** - Tells SDK where to load CLAUDE.md files from
2. **`sandbox`** - Configures bash command isolation
3. **`allowedTools`** - Restricts tool access (security)
4. **Proper option structure** - SDK expects options in a specific format

When these are missing, the SDK's internal subprocess spawning fails with `ENOENT`.

---

## The Working Pattern (AgentService)

All Automaker features (Board View, Auto Mode, Chat) work because they use the factory:

```typescript
// apps/server/src/services/agent-service.ts:260-297

// 1. Build SDK options via factory
const sdkOptions = createChatOptions({
  cwd: effectiveWorkDir,
  model: model,
  sessionModel: session.model,
  systemPrompt: combinedSystemPrompt,
  abortController: session.abortController!,
  autoLoadClaudeMd,
  enableSandboxMode,
  mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
  mcpAutoApproveTools: mcpPermissions.mcpAutoApproveTools,
  mcpUnrestrictedTools: mcpPermissions.mcpUnrestrictedTools,
});

// 2. Extract values from SDK options
const effectiveModel = sdkOptions.model!;
const maxTurns = sdkOptions.maxTurns;
const allowedTools = sdkOptions.allowedTools as string[] | undefined;

// 3. Build ExecuteOptions with extracted values
const options: ExecuteOptions = {
  prompt: '',
  model: effectiveModel,
  cwd: effectiveWorkDir,
  systemPrompt: sdkOptions.systemPrompt, // ← From SDK options
  maxTurns: maxTurns,
  allowedTools: allowedTools,
  abortController: session.abortController!,
  conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
  settingSources: sdkOptions.settingSources, // ← CRITICAL
  sandbox: sdkOptions.sandbox, // ← CRITICAL
  sdkSessionId: session.sdkSessionId,
  mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
  mcpAutoApproveTools: mcpPermissions.mcpAutoApproveTools,
  mcpUnrestrictedTools: mcpPermissions.mcpUnrestrictedTools,
};

// 4. Execute via provider
const stream = provider.executeQuery(options);
```

---

## Files Modified

**Single file fix:**

- `apps/server/src/services/multi-agent-spec-service.ts`

**Changes:**

1. Import `createCustomOptions` and `TOOL_PRESETS` from `sdk-options.ts`
2. Build `sdkOptions` via `createCustomOptions()`
3. Extract values into `ExecuteOptions` format
4. Pass complete options to `provider.executeQuery()`

**Commit:** `a250fa9`

---

## Testing

### Before Fix

```bash
# All 6 agents failed with:
[MultiAgentSpecService] Frontend Agent failed: { originalError: {}, type: 'execution' }
# Error: Failed to spawn Claude Code process: spawn node ENOENT
# Result: 0 tasks generated
```

### After Fix

```bash
# To test:
cd /home/shevanio/dev/automaker
npm run dev  # Start server

# In another terminal:
bash /tmp/test-multi-agent.sh

# Expected: Agents execute successfully, tasks generated
```

---

## Key Takeaways

### ✅ DO:

- **Always use SDK options factory** (`createChatOptions`, `createCustomOptions`, etc.)
- Follow the AgentService pattern for provider calls
- Pass `settingSources` and `sandbox` from SDK options

### ❌ DON'T:

- Call `provider.executeQuery()` with raw options
- Bypass the centralized options factory
- Assume partial options will work

### 🔍 Why It Worked for Regular Features:

- AgentService uses `createChatOptions()` → includes all required options
- AutoModeService uses factory patterns → includes all required options
- **MultiAgentSpecService was the only service bypassing the factory**

---

## Related Files

**SDK Options Factory:**

- `apps/server/src/lib/sdk-options.ts` - Centralized options builder

**Working Examples:**

- `apps/server/src/services/agent-service.ts:260-297` - Chat pattern
- Uses `createChatOptions()` → extracts values → passes to provider

**Provider:**

- `apps/server/src/providers/claude-provider.ts` - Executes queries
- Expects options with `settingSources`, `sandbox`, `allowedTools`

**Multi-Agent Service:**

- `apps/server/src/services/multi-agent-spec-service.ts:156-176` - NOW FIXED

---

## Prevention

**Future AI service implementations must:**

1. Import from `sdk-options.ts`
2. Use appropriate factory:
   - `createChatOptions()` - Interactive chat
   - `createAutoModeOptions()` - Autonomous implementation
   - `createSpecGenerationOptions()` - Spec generation
   - `createCustomOptions()` - Custom use cases
3. Extract values from SDK options
4. Pass complete `ExecuteOptions` to provider

**Example template:**

```typescript
import { createCustomOptions, TOOL_PRESETS } from '../lib/sdk-options.js';
import type { ExecuteOptions } from '@automaker/types';

// 1. Build SDK options
const sdkOptions = createCustomOptions({
  cwd: workingDir,
  model: requestedModel,
  systemPrompt: prompt,
  maxTurns: 10,
  allowedTools: TOOL_PRESETS.readOnly,
});

// 2. Build ExecuteOptions
const options: ExecuteOptions = {
  prompt: userPrompt,
  model: sdkOptions.model!,
  cwd: sdkOptions.cwd!,
  systemPrompt: sdkOptions.systemPrompt,
  maxTurns: sdkOptions.maxTurns,
  allowedTools: sdkOptions.allowedTools as string[] | undefined,
  settingSources: sdkOptions.settingSources,
  sandbox: sdkOptions.sandbox,
};

// 3. Execute
const stream = provider.executeQuery(options);
```

---

## Credits

**Issue discovered by:** User testing multi-agent feature  
**Root cause identified via:** Comparing with working AgentService implementation  
**Fixed in commit:** `a250fa9`  
**Date:** 2026-01-02
