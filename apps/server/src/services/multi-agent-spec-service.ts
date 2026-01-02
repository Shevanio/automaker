/**
 * Multi-Agent Spec Service
 *
 * Deploys multiple specialized AI agents to analyze a feature from different
 * perspectives and collaboratively generate a comprehensive implementation spec.
 */

import type {
  Feature,
  SpecializationAgent,
  AgentAnalysis,
  MultiAgentAnalysis,
  CombinedSpecStep,
  CombinedSpecMetadata,
  AgentSpecialization,
  MultiAgentAnalysisRequest,
  ExecuteOptions,
} from '@automaker/types';
import { DEFAULT_AGENTS } from '@automaker/types';
import { buildMultiAgentAnalysisPrompt } from '@automaker/prompts';
import { createLogger } from '@automaker/utils';
import type { ClaudeProvider } from '../providers/claude-provider.js';
import { createCustomOptions, TOOL_PRESETS } from '../lib/sdk-options.js';

const logger = createLogger('MultiAgentSpecService');

export class MultiAgentSpecService {
  constructor(private claudeProvider: ClaudeProvider) {}

  /**
   * Analyzes a feature using multiple specialized agents
   */
  async analyzeFeature(
    feature: Feature,
    projectPath: string,
    request?: Partial<MultiAgentAnalysisRequest>
  ): Promise<MultiAgentAnalysis> {
    const startTime = Date.now();

    logger.info(`Starting multi-agent analysis for feature: ${feature.id}`);

    // Determine which agents to use
    const agents = this.selectAgents(request?.agents);

    // Get project context (can be enhanced with Memory Layer later)
    const projectContext = await this.getProjectContext(projectPath);

    // Run agents in parallel or sequentially
    const parallel = request?.parallel !== false; // Default to true
    const agentAnalyses = parallel
      ? await this.runAgentsParallel(feature, agents, projectContext, request?.model)
      : await this.runAgentsSequential(feature, agents, projectContext, request?.model);

    // Combine analyses into unified spec
    const combinedSteps = this.combineAnalyses(agentAnalyses);
    const metadata = this.calculateMetadata(agentAnalyses, combinedSteps);

    const endTime = Date.now();

    const analysis: MultiAgentAnalysis = {
      feature_id: feature.id,
      feature_title: feature.title || 'Untitled Feature',
      feature_description: feature.description || '',
      agents: agentAnalyses,
      combined_steps: combinedSteps,
      metadata,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      total_duration_ms: endTime - startTime,
    };

    logger.info(
      `Multi-agent analysis completed: ${agentAnalyses.length} agents, ${combinedSteps.length} tasks, ${Math.round((endTime - startTime) / 1000)}s`
    );

    return analysis;
  }

  /**
   * Runs all agents in parallel with concurrency limit
   * Limits concurrent SDK process spawns to avoid resource contention
   */
  private async runAgentsParallel(
    feature: Feature,
    agents: SpecializationAgent[],
    projectContext: string,
    model?: string
  ): Promise<AgentAnalysis[]> {
    const MAX_CONCURRENT_AGENTS = 3; // Limit concurrent agents to avoid spawn issues
    logger.info(
      `Running ${agents.length} agents in parallel (max ${MAX_CONCURRENT_AGENTS} concurrent)`
    );

    const results: AgentAnalysis[] = [];

    // Process agents in batches
    for (let i = 0; i < agents.length; i += MAX_CONCURRENT_AGENTS) {
      const batch = agents.slice(i, i + MAX_CONCURRENT_AGENTS);
      logger.info(
        `Processing batch ${Math.floor(i / MAX_CONCURRENT_AGENTS) + 1}: ${batch.map((a) => a.name).join(', ')}`
      );

      const batchPromises = batch.map((agent) =>
        this.runSingleAgent(feature, agent, projectContext, model)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      results.push(
        ...batchResults.map((result, idx) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            const error =
              result.reason instanceof Error ? result.reason : new Error(String(result.reason));
            logger.error(`Agent ${batch[idx].name} failed:`, error);
            return this.createFailedAnalysis(batch[idx], error);
          }
        })
      );
    }

    return results;
  }

  /**
   * Runs agents sequentially (useful for debugging or rate limit management)
   */
  private async runAgentsSequential(
    feature: Feature,
    agents: SpecializationAgent[],
    projectContext: string,
    model?: string
  ): Promise<AgentAnalysis[]> {
    logger.info(`Running ${agents.length} agents sequentially`);

    const results: AgentAnalysis[] = [];

    for (const agent of agents) {
      try {
        const analysis = await this.runSingleAgent(feature, agent, projectContext, model);
        results.push(analysis);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`Agent ${agent.name} failed:`, err);
        results.push(this.createFailedAnalysis(agent, err));
      }
    }

    return results;
  }

  /**
   * Executes a single specialized agent using Claude's executeQuery
   */
  private async runSingleAgent(
    feature: Feature,
    agent: SpecializationAgent,
    projectContext: string,
    model?: string
  ): Promise<AgentAnalysis> {
    const startTime = Date.now();

    logger.info(`Running ${agent.name} (${agent.specialization})...`);

    // Build prompt for this agent
    const prompt = buildMultiAgentAnalysisPrompt({
      agentFocus: agent.focus,
      featureTitle: feature.title || 'Untitled Feature',
      featureDescription: feature.description || '',
      projectContext,
    });

    try {
      // Build SDK options using centralized factory (same pattern as AgentService)
      const sdkOptions = createCustomOptions({
        cwd: projectContext || process.cwd(),
        model: model || agent.model || 'claude-sonnet-4',
        systemPrompt: agent.systemPrompt,
        maxTurns: 1, // Single turn for analysis
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
        settingSources: sdkOptions.settingSources,
        sandbox: sdkOptions.sandbox,
      };

      // Call Claude using executeQuery generator
      const generator = this.claudeProvider.executeQuery(options);

      // Collect full response
      let fullResponse = '';
      for await (const providerMessage of generator) {
        if (providerMessage.type === 'assistant' && providerMessage.message) {
          for (const block of providerMessage.message.content) {
            if (block.type === 'text' && block.text) {
              fullResponse += block.text;
            }
          }
        }
      }

      // Parse response
      logger.info(`${agent.name} raw response length: ${fullResponse.length} chars`);
      logger.debug(`${agent.name} raw response: ${fullResponse.substring(0, 500)}...`);

      const parsed = this.parseAgentResponse(fullResponse);
      logger.info(`${agent.name} parsed tasks: ${parsed.tasks?.length || 0}`);

      const endTime = Date.now();

      // Convert to AgentAnalysis format
      const analysis: AgentAnalysis = {
        agent_name: agent.name,
        agent_icon: agent.icon,
        specialization: agent.specialization,
        status: 'completed',
        tasks_identified: parsed.tasks.map((t: any, idx: number) => ({
          id: `${agent.specialization}-task-${idx + 1}`,
          title: t.title,
          description: t.description,
          estimated_duration_mins: t.estimated_duration_mins || 30,
          priority: t.priority || 'medium',
          files_to_create: t.files_to_create || [],
          files_to_modify: t.files_to_modify || [],
          tests_required: t.tests_required || [],
          complexity: t.complexity || 5,
          agent_notes: t.agent_notes,
        })),
        insights: parsed.insights || [],
        warnings: parsed.warnings || [],
        dependencies: parsed.dependencies || [],
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date(endTime).toISOString(),
        duration_ms: endTime - startTime,
      };

      logger.info(
        `${agent.name} completed: ${analysis.tasks_identified.length} tasks, ${Math.round((endTime - startTime) / 1000)}s`
      );

      return analysis;
    } catch (error: any) {
      logger.error(`${agent.name} failed:`, error);
      throw error;
    }
  }

  /**
   * Combines analyses from all agents into ordered steps
   */
  private combineAnalyses(agentAnalyses: AgentAnalysis[]): CombinedSpecStep[] {
    const steps: CombinedSpecStep[] = [];
    let order = 1;

    // Execution order: Database → Backend → Frontend → Security → Testing → DevOps
    const executionOrder: AgentSpecialization[] = [
      'database',
      'backend',
      'frontend',
      'security',
      'testing',
      'devops',
    ];

    for (const specialization of executionOrder) {
      const agentAnalysis = agentAnalyses.find(
        (a) => a.specialization === specialization && a.status === 'completed'
      );

      if (agentAnalysis) {
        for (const task of agentAnalysis.tasks_identified) {
          const notes: string[] = [];

          if (task.agent_notes) {
            notes.push(task.agent_notes);
          }

          agentAnalysis.insights.forEach((i: string) => notes.push(`💡 ${i}`));
          agentAnalysis.warnings.forEach((w: string) => notes.push(`⚠️  ${w}`));

          steps.push({
            id: `step-${order}`,
            order: order++,
            title: task.title,
            description: task.description,
            estimated_duration_mins: task.estimated_duration_mins,
            files_to_create: task.files_to_create,
            files_to_modify: task.files_to_modify,
            tests_required: task.tests_required,
            agent_source: specialization,
            agent_notes: notes.filter(Boolean).join('\n\n'),
          });
        }
      }
    }

    return steps;
  }

  /**
   * Calculates metadata about the combined spec
   */
  private calculateMetadata(
    agentAnalyses: AgentAnalysis[],
    combinedSteps: CombinedSpecStep[]
  ): CombinedSpecMetadata {
    const successfulAgents = agentAnalyses.filter((a) => a.status === 'completed');
    const failedAgents = agentAnalyses.filter((a) => a.status === 'failed');

    const totalDuration = combinedSteps.reduce(
      (sum, step) => sum + (step.estimated_duration_mins || 0),
      0
    );

    // Complexity score: based on number of tasks and files
    const fileCount = combinedSteps.reduce(
      (sum, step) =>
        sum + (step.files_to_create?.length || 0) + (step.files_to_modify?.length || 0),
      0
    );

    const complexity = Math.min(10, Math.round(combinedSteps.length / 3 + fileCount / 10));

    // Risk level
    const hasSecurityTasks = combinedSteps.some((s) => s.agent_source === 'security');
    const hasDatabaseTasks = combinedSteps.some((s) => s.agent_source === 'database');
    const riskLevel =
      complexity >= 8 || (hasSecurityTasks && hasDatabaseTasks)
        ? 'high'
        : complexity >= 5 || hasSecurityTasks || hasDatabaseTasks
          ? 'medium'
          : 'low';

    return {
      total_tasks: combinedSteps.length,
      total_duration_mins: totalDuration,
      complexity_score: complexity,
      risk_level: riskLevel,
      agents_used: agentAnalyses.length,
      successful_agents: successfulAgents.length,
      failed_agents: failedAgents.length,
    };
  }

  /**
   * Creates a failed analysis object
   */
  private createFailedAnalysis(agent: SpecializationAgent, error: Error): AgentAnalysis {
    return {
      agent_name: agent.name,
      agent_icon: agent.icon,
      specialization: agent.specialization,
      status: 'failed',
      tasks_identified: [],
      insights: [],
      warnings: [],
      dependencies: [],
      error: error?.message || 'Unknown error',
    };
  }

  /**
   * Parses agent response JSON
   */
  private parseAgentResponse(response: string): any {
    // Try to extract JSON from markdown code block
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try to extract raw JSON
    const rawMatch = response.match(/\{[\s\S]*\}/);
    if (rawMatch) {
      return JSON.parse(rawMatch[0]);
    }

    throw new Error('No valid JSON found in agent response');
  }

  /**
   * Selects which agents to use
   */
  private selectAgents(requestedAgents?: AgentSpecialization[]): SpecializationAgent[] {
    if (requestedAgents && requestedAgents.length > 0) {
      return DEFAULT_AGENTS.filter((agent) => requestedAgents.includes(agent.specialization));
    }

    // Use all agents by default
    return DEFAULT_AGENTS;
  }

  /**
   * Gets project context (can be enhanced with Memory Layer)
   */
  private async getProjectContext(projectPath: string): Promise<string> {
    // TODO: Integrate with Memory Layer when available (Fase 2B)
    // For now, return basic context

    return `Project Path: ${projectPath}

Tech Stack (detected):
- Language: TypeScript
- Frontend: React 19, Vite 7, TanStack Router
- Backend: Node.js, Express 5
- Database: (to be determined based on project)
- Testing: Vitest, Playwright

Project Structure:
- Monorepo with apps/ and libs/
- apps/ui: React frontend
- apps/server: Express backend
- libs/*: Shared packages

Code Conventions:
- Use TypeScript strict mode
- Functional components with hooks (React)
- Use ES modules (import/export)
- Follow existing file organization patterns`;
  }
}
