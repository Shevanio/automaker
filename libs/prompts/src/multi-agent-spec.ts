/**
 * Prompts for Multi-Agent Spec Generation
 */

/**
 * Builds the analysis prompt for a specialized agent
 */
export function buildMultiAgentAnalysisPrompt(params: {
  agentFocus: string;
  featureTitle: string;
  featureDescription: string;
  projectContext?: string;
}): string {
  const { agentFocus, featureTitle, featureDescription, projectContext } = params;

  return `# Application Documentation Request

You are documenting an existing software application from the perspective of: **${agentFocus}**

${projectContext ? `## Project Context\n${projectContext}\n` : ''}

## Application to Document

**Title**: ${featureTitle}

**Scope**:
${featureDescription}

## Your Task

As a ${agentFocus} expert, DOCUMENT and ANALYZE the current state of this application from your domain perspective.

**CRITICAL WORKFLOW**:
1. **Explore** (5-10 tool calls max): Use Glob/Read/Grep to understand current architecture and implementation
2. **Analyze** (mentally): Based on what you found, understand the current system design and patterns
3. **Respond** (immediately): Output the JSON documenting what EXISTS (not what should be built)

⚠️ **BE EFFICIENT**: You have limited turns. Focus on understanding WHAT IS ALREADY IMPLEMENTED, not what needs to be built.

### For Each Section, Provide:

1. **title**: Descriptive title of an existing component/feature/pattern (e.g., "User Authentication System")
2. **description**: Documentation of HOW IT CURRENTLY WORKS, including file locations, architecture patterns, and key implementation details
3. **estimated_duration_mins**: Set to 0 (this is documentation, not implementation tasks)
4. **priority**: Always 'medium' (this is documentation, not prioritized tasks)
5. **files_to_create**: LEAVE EMPTY (we're documenting existing code)
6. **files_to_modify**: Array of existing files that implement this feature (for reference)
7. **tests_required**: Array of existing test files (for reference)
8. **complexity**: Score from 1-10 indicating current system complexity (1=simple, 10=very complex)
9. **agent_notes**: Important architectural decisions, patterns used, or notable implementation details

### Also Provide:

- **insights**: Array of 2-4 KEY ARCHITECTURAL INSIGHTS about how the current system works (not suggestions for improvement, but important design decisions that were made)
- **warnings**: Array of 2-4 NOTABLE LIMITATIONS or technical debt in the current implementation (document existing issues, don't propose solutions)
- **dependencies**: Array of external libraries or services that ARE CURRENTLY USED in this domain

### Guidelines:

- Document what EXISTS, not what should be built
- Focus on CURRENT architecture, patterns, and implementation
- Be specific about actual file names, paths, and technical details found in the code
- Describe HOW things currently work, not how they should work
- Document existing error handling, validation, and logging approaches
- If something doesn't exist yet, simply don't include it (don't create tasks for it)

## Output Format

You MUST respond with ONLY a JSON code block in this exact format (nothing before, nothing after):

\`\`\`json
{
  "tasks": [
    {
      "title": "Authentication System",
      "description": "The application uses a dual authentication system: API keys for Electron mode (stored in DATA_DIR/.api-key with 0o600 permissions) and session cookies for web mode (HTTP-only cookies). Session tokens are persisted to disk in DATA_DIR/.sessions. The auth middleware (apps/server/src/middleware/auth.ts) validates requests using timing-safe comparison. WebSocket connections use short-lived connection tokens (5-minute expiry) generated via createWsConnectionToken().",
      "estimated_duration_mins": 0,
      "priority": "medium",
      "files_to_create": [],
      "files_to_modify": ["apps/server/src/middleware/auth.ts", "apps/server/src/lib/auth-utils.ts"],
      "tests_required": ["apps/server/tests/unit/middleware/auth.test.ts"],
      "complexity": 7,
      "agent_notes": "The dual-mode architecture (Electron vs Web) creates complexity - Electron uses IPC header-based auth while web mode uses traditional HTTP cookies"
    }
  ],
  "insights": [
    "The authentication system separates API key generation (crypto.randomBytes) from session management, allowing different lifetime policies for different auth methods",
    "Session persistence to disk (instead of memory-only) enables session recovery across server restarts, but creates security considerations for multi-user deployments"
  ],
  "warnings": [
    "API keys are currently printed to console on startup (suppressible via AUTOMAKER_HIDE_API_KEY env var) which could leak credentials in production logs",
    "When ALLOWED_ROOT_DIRECTORY is not configured, the system allows unrestricted filesystem access - this is a critical security issue for production deployments"
  ],
  "dependencies": [
    "express@^5.0.0",
    "cookie-parser@^1.4.6",
    "ws@^8.18.0"
  ]
}
\`\`\`

CRITICAL RULES:
1. Your response must START with \`\`\`json and END with \`\`\`
2. Do NOT add any text before or after the JSON code block
3. Use the Read, Glob, and Grep tools to analyze the EXISTING code EFFICIENTLY (5-10 tool calls max)
4. The JSON must be valid and parseable
5. Include 2-5 sections in the tasks array documenting EXISTING major components/systems (NOT implementation tasks)
6. Each "task" title should describe what EXISTS (e.g., "API Rate Limiting System") not what should be built (e.g., "Implement rate limiting")
7. Set estimated_duration_mins to 0 for all entries (this is documentation, not work to be done)
8. Include 2-4 insights about KEY ARCHITECTURAL DECISIONS in the current system
9. Include 2-4 warnings about EXISTING LIMITATIONS or technical debt (document problems, don't propose solutions)`;
}

/**
 * Builds a prompt for combining multiple agent analyses into a single spec
 */
export function buildSpecCombinationPrompt(params: {
  featureTitle: string;
  featureDescription: string;
  agentAnalyses: Array<{
    agent_name: string;
    tasks: Array<{ title: string; description: string }>;
    insights: string[];
  }>;
}): string {
  const { featureTitle, featureDescription, agentAnalyses } = params;

  const analysesText = agentAnalyses
    .map(
      (analysis) => `
### ${analysis.agent_name}

Tasks identified:
${analysis.tasks.map((t, idx) => `${idx + 1}. ${t.title}`).join('\n')}

Key insights:
${analysis.insights.map((i) => `- ${i}`).join('\n')}
`
    )
    .join('\n---\n');

  return `# Spec Combination Task

You need to combine multiple specialized agent analyses into a single, coherent implementation spec.

## Feature

**Title**: ${featureTitle}
**Description**: ${featureDescription}

## Agent Analyses

${analysesText}

## Your Task

Create a logical execution order for all tasks, considering:

1. **Dependencies**: Database changes before backend, backend before frontend
2. **Risk**: High-risk tasks should be identified
3. **Parallelization**: Tasks that can run in parallel
4. **Logical flow**: Natural implementation sequence

Return the tasks in execution order with these fields:
- order: Sequential number (1, 2, 3...)
- task_id: Reference to original task
- agent_source: Which agent identified this
- parallel_group: Tasks with same number can run in parallel (optional)

Output JSON:
\`\`\`json
{
  "execution_order": [
    {
      "order": 1,
      "task_id": "database-task-1",
      "agent_source": "Database Agent",
      "parallel_group": null
    }
  ],
  "estimated_total_hours": 12.5,
  "complexity_score": 7,
  "risk_level": "medium"
}
\`\`\``;
}
