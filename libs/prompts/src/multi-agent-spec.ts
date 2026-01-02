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

  return `# Feature Analysis Request

You are analyzing a software feature from the perspective of: **${agentFocus}**

${projectContext ? `## Project Context\n${projectContext}\n` : ''}

## Feature to Analyze

**Title**: ${featureTitle}

**Description**:
${featureDescription}

## Your Task

As a ${agentFocus} expert, identify ALL tasks needed in your domain to implement this feature successfully.

**CRITICAL WORKFLOW**:
1. **Explore** (5-10 tool calls max): Use Glob/Read/Grep to understand relevant code structure
2. **Analyze** (mentally): Based on what you found, identify the key tasks needed
3. **Respond** (immediately): Output the JSON with your findings

⚠️ **BE EFFICIENT**: You have limited turns. Don't over-analyze - find the key files, understand the patterns, and respond with your JSON. Quality over quantity.

### For Each Task, Provide:

1. **title**: Clear, action-oriented title (e.g., "Create user profile component")
2. **description**: Detailed instructions on how to implement this task
3. **estimated_duration_mins**: Realistic time estimate (15-120 minutes per task)
4. **priority**: 'low', 'medium', or 'high'
5. **files_to_create**: Array of new file paths (if applicable)
6. **files_to_modify**: Array of existing files to modify (if applicable)
7. **tests_required**: Array of test files needed (if applicable)
8. **complexity**: Score from 1-10 (1=trivial, 10=very complex)
9. **agent_notes**: Any additional context or considerations

### Also Provide:

- **insights**: Array of 2-4 CRITICAL insights only (not obvious facts, but important non-obvious considerations)
- **warnings**: Array of 2-4 HIGH-PRIORITY warnings only (critical risks that could cause serious problems)
- **dependencies**: Array of external libraries or services that might be needed (if any)

### Guidelines:

- Break down complex work into atomic, focused tasks
- Each task should be completable independently when possible
- Be specific about file names, paths, and technical details
- Consider edge cases and error scenarios
- Think about maintainability and future extensibility
- Don't forget about error handling, validation, and logging

## Output Format

You MUST respond with ONLY a JSON code block in this exact format (nothing before, nothing after):

\`\`\`json
{
  "tasks": [
    {
      "title": "Specific task title",
      "description": "Detailed implementation instructions with code examples if helpful",
      "estimated_duration_mins": 30,
      "priority": "high",
      "files_to_create": ["src/components/NewComponent.tsx"],
      "files_to_modify": ["src/App.tsx", "src/routes/index.ts"],
      "tests_required": ["src/components/__tests__/NewComponent.test.tsx"],
      "complexity": 5,
      "agent_notes": "Remember to handle loading and error states"
    }
  ],
  "insights": [
    "Consider using existing authentication context rather than creating new one",
    "This feature will increase bundle size by ~50KB, consider code splitting"
  ],
  "warnings": [
    "API endpoint changes will require database migration - coordinate with backend team",
    "Breaking change for existing users - need migration strategy"
  ],
  "dependencies": [
    "react-hook-form@^7.0.0",
    "zod@^3.0.0"
  ]
}
\`\`\`

CRITICAL RULES:
1. Your response must START with \`\`\`json and END with \`\`\`
2. Do NOT add any text before or after the JSON code block
3. Use the Read, Glob, and Grep tools to analyze the project EFFICIENTLY (5-10 tool calls max)
4. The JSON must be valid and parseable
5. Include 2-5 tasks in the tasks array (focus on the MOST IMPORTANT tasks)
6. Include 2-4 insights (only non-obvious, critical insights - not basic facts)
7. Include 2-4 warnings (only high-priority risks - not minor issues)`;
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
