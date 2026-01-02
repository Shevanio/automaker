# Multi-Agent Spec Generation - Debugging Guide

## Problem Statement

The multi-agent spec generation feature was returning empty or very short responses from AI agents. All 6 specialized agents (Frontend, Backend, Database, Security, Testing, DevOps) would spawn successfully but return 0-102 character responses instead of comprehensive analysis.

## Root Causes Fixed

### 1. Invalid `cwd` Parameter ✅ FIXED (commit 3b4b5f4)

**Symptom**: `spawn /path/to/claude ENOENT`

- **Cause**: Passing `projectContext` (formatted string) as `cwd` instead of `projectPath` (directory path)
- **Fix**: Pass `projectPath` parameter through all agent execution functions

### 2. Invalid Model String ✅ FIXED (commits 5e1f935, 2a2d889)

**Symptom**: `Claude Code process exited with code 1`

- **Cause**: `'claude-sonnet-4'` treated as complete model but missing date suffix
- **Fix**: Updated model resolver to validate full model strings and added partial model aliases

### 3. maxTurns Compatibility ✅ INVESTIGATED (commits 8614a7d, 7f283ad)

**Issue**: SDK tried passing `--max-turns` to CLI that doesn't support it

- **Resolution**: Made maxTurns optional in createCustomOptions, defaults to SDK behavior

### 4. Empty Agent Responses ⚠️ IN PROGRESS (commit df74f0a)

**Symptom**: Agents return 0-102 characters instead of full JSON analysis

- **Likely causes**:
  - Agents not using Read/Glob/Grep tools to explore codebase
  - Confusing prompt about output format (said "no markdown" but showed markdown example)
  - Model not clear on what to do
  - maxTurns too restrictive or too permissive

## Changes Made (Commit df74f0a)

### Improved Logging

Added detailed diagnostics to `multi-agent-spec-service.ts`:

```typescript
- Count messages received
- Count text blocks extracted
- Log message types and content block types
- Detect error messages in stream
- Throw clear error on empty response
- Warn when no tasks found even with response
```

### Improved Prompts

Updated `libs/prompts/src/multi-agent-spec.ts`:

````typescript
**CRITICAL FIRST STEP**: Before analyzing, you MUST:
1. Use the **Glob** tool to find relevant files
2. Use the **Read** tool to examine existing code structure
3. Use the **Grep** tool to search for related patterns

CRITICAL RULES:
1. Your response must START with ```json and END with ```
2. Do NOT add any text before or after the JSON code block
3. Use the Read, Glob, and Grep tools to analyze the project before responding
4. The JSON must be valid and parseable
5. Include at least 2-5 tasks in the tasks array
````

### Model & Turn Configuration

```typescript
- Changed default from 'claude-sonnet-4' to 'sonnet' (cheaper, faster)
- Added maxTurns: 50 (enough for analysis, not excessive)
- Still using TOOL_PRESETS.readOnly: ['Read', 'Glob', 'Grep']
```

## How to Test

### Manual Test via API

```bash
curl -X POST http://localhost:3008/api/spec/multi-agent-analyze \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "description": "Add user authentication with JWT tokens",
    "model": "sonnet",
    "parallel": false
  }'
```

### Test via UI

1. Start server: `npm run dev:server`
2. Start UI: `npm run dev:web`
3. Navigate to Spec view
4. Click "🤖 Analizar Automáticamente"
5. Check browser console and server logs

### Expected Behavior (Success)

```
[MultiAgentSpecService] Running Frontend Agent...
[MultiAgentSpecService] Frontend Agent received 15 messages, 8 text blocks
[MultiAgentSpecService] Frontend Agent raw response length: 2456 chars
[MultiAgentSpecService] Frontend Agent parsed tasks: 5
[MultiAgentSpecService] Frontend Agent completed: 5 tasks, 12s
```

### Expected Behavior (Failure - Before Fix)

```
[MultiAgentSpecService] Running Frontend Agent...
[MultiAgentSpecService] Frontend Agent received 3 messages, 1 text blocks
[MultiAgentSpecService] Frontend Agent raw response length: 0 chars
[MultiAgentSpecService] Frontend Agent returned EMPTY response - no text content received
Error: Agent returned empty response...
```

## Debug Checklist

When agent returns empty/short responses:

1. **Check logs for tool usage**
   - Did agent use Glob to find files?
   - Did agent use Read to examine code?
   - Did agent use Grep to search patterns?
   - If NO tools used → prompt clarity issue

2. **Check message types**
   - How many messages received?
   - How many text blocks found?
   - Any error messages?
   - If 0 messages → SDK/provider issue
   - If messages but no text blocks → response format issue

3. **Check model behavior**
   - Is model hitting rate limits? (check for rate limit errors)
   - Is model hitting token limits? (check response truncation)
   - Is model interpreting prompt correctly? (check first few responses)

4. **Check prompt understanding**
   - Try with single agent in sequential mode (easier to debug)
   - Try with simpler feature description
   - Try with explicit example in system prompt

5. **Check SDK options**
   - Verify cwd is correct directory
   - Verify model resolves correctly (check ModelResolver logs)
   - Verify allowedTools includes Read, Glob, Grep
   - Verify maxTurns is reasonable (50 should be enough)

## Next Steps

### If Agents Still Return Empty Responses

1. **Test Single Agent in Isolation**

   ```typescript
   const request = {
     agents: ['frontend'], // Only one agent
     parallel: false, // Sequential for easier debugging
     model: 'sonnet',
   };
   ```

2. **Add Tool Usage Logging**
   - Log each tool_use block received in stream
   - Verify agents are actually calling Read/Glob/Grep
   - If not using tools → strengthen prompt requirements

3. **Test with Different Models**

   ```typescript
   model: 'haiku'; // Faster, might be more compliant
   model: 'opus'; // Smarter, better at complex instructions
   ```

4. **Simplify Prompt Progressively**
   - Remove complex formatting requirements
   - Test if agent responds at all with simple "Analyze this feature"
   - Add requirements back incrementally

5. **Check for Silent Errors**
   - Add try-catch around JSON parsing
   - Log full error objects, not just messages
   - Check for SDK errors that aren't being surfaced

### If Agents Return Responses but No Tasks

1. **Validate JSON Parsing**

   ```typescript
   logger.info('Raw response:', fullResponse);
   logger.info('JSON match:', jsonMatch);
   logger.info('Parsed object:', parsed);
   ```

2. **Check Response Format**
   - Is agent wrapping JSON in markdown correctly?
   - Is agent adding extra text before/after JSON?
   - Is JSON structure matching expected schema?

3. **Improve Schema Validation**
   - Add schema validation before parsing
   - Provide better error messages about what's missing
   - Consider using zod for runtime validation

## Success Criteria

✅ Each agent should:

- Execute 3-10 tool calls (Glob, Read, Grep)
- Return 1500-3000 character response
- Include 2-5 tasks in JSON
- Include insights and warnings arrays
- Complete within 10-30 seconds

✅ Multi-agent system should:

- Handle 6 agents in 3 batches (2 agents per batch)
- Combine all tasks into ordered execution plan
- Calculate metadata (complexity, risk, duration)
- Return comprehensive analysis within 60-180 seconds

## Related Files

- `apps/server/src/services/multi-agent-spec-service.ts` - Main service logic
- `libs/prompts/src/multi-agent-spec.ts` - Agent prompts
- `libs/types/src/multi-agent-spec.ts` - Type definitions and agent configs
- `apps/server/src/routes/spec/multi-agent.ts` - API endpoint
- `apps/server/src/lib/sdk-options.ts` - SDK configuration
- `libs/model-resolver/src/resolver.ts` - Model string resolution

## Reference Issues

- Bug #1: Invalid cwd (commit 3b4b5f4)
- Bug #2: Invalid model string (commits 5e1f935, 2a2d889)
- Bug #3: maxTurns compatibility (commits 8614a7d, 7f283ad)
- Enhancement: Concurrency limit (commit 3f21d1c)
- Enhancement: Better logging and prompts (commit df74f0a)
