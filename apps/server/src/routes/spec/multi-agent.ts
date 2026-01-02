/**
 * Multi-Agent Spec Generation Routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { MultiAgentSpecService } from '../../services/multi-agent-spec-service.js';
import { ClaudeProvider } from '../../providers/claude-provider.js';
import { FeatureLoader } from '../../services/feature-loader.js';
import { createLogger } from '@automaker/utils';
import type { MultiAgentAnalysisRequest } from '@automaker/types';
import type { EventEmitter } from '../../lib/events.js';

const logger = createLogger('MultiAgentSpecRoute');

/**
 * Factory function to create multi-agent spec routes with event emitter
 */
export function createMultiAgentSpecRoutes(events: EventEmitter) {
  const router = Router();

  /**
   * POST /api/spec/multi-agent-analyze
   *
   * Analyzes a feature using multiple specialized AI agents
   *
   * Request body:
   * {
   *   featureId: string,
   *   projectPath: string,
   *   agents?: AgentSpecialization[],  // Optional: specific agents to use
   *   model?: string,                   // Optional: override default model
   *   parallel?: boolean                // Optional: run in parallel (default: true)
   * }
   */
  router.post('/multi-agent-analyze', async (req: Request, res: Response) => {
    const { featureId, projectPath, agents, model, parallel } = req.body;

    // Validate required fields
    if (!featureId) {
      return res.status(400).json({ error: 'featureId is required' });
    }

    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    logger.info(`Starting multi-agent analysis for feature: ${featureId}`);

    try {
      // Load feature
      const featureLoader = new FeatureLoader();
      const feature = await featureLoader.get(projectPath, featureId);

      if (!feature) {
        return res.status(404).json({ error: `Feature ${featureId} not found` });
      }

      // Emit started event
      events.emit('multi-agent:started', {
        featureId,
        projectPath,
        agentsCount: agents?.length || 6,
        timestamp: new Date().toISOString(),
      });

      // Create service and run analysis
      const claudeProvider = new ClaudeProvider();
      const multiAgentService = new MultiAgentSpecService(claudeProvider);

      const request: Partial<MultiAgentAnalysisRequest> = {
        agents,
        model,
        parallel,
      };

      // Run analysis
      const analysis = await multiAgentService.analyzeFeature(feature, projectPath, request);

      // Emit completed event
      events.emit('multi-agent:completed', {
        featureId,
        projectPath,
        totalSteps: analysis.combined_steps.length,
        totalDurationMins: analysis.metadata.total_duration_mins,
        complexityScore: analysis.metadata.complexity_score,
        riskLevel: analysis.metadata.risk_level,
        successfulAgents: analysis.metadata.successful_agents,
        failedAgents: analysis.metadata.failed_agents,
        timestamp: new Date().toISOString(),
      });

      logger.info(
        `Multi-agent analysis completed: ${analysis.combined_steps.length} steps, ${analysis.metadata.total_duration_mins}min estimated`
      );

      // Return analysis result
      res.json(analysis);
    } catch (error: any) {
      logger.error('Multi-agent analysis failed:', error);

      // Emit error event
      events.emit('multi-agent:error', {
        featureId,
        projectPath,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      res.status(500).json({
        error: 'Multi-agent analysis failed',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/spec/multi-agent-status/:featureId
   *
   * Gets the status of an ongoing multi-agent analysis
   * (Future: could track progress in-memory or Redis)
   */
  router.get('/multi-agent-status/:featureId', async (req: Request, res: Response) => {
    const { featureId } = req.params;

    // For now, return a simple status
    // TODO: Implement actual progress tracking
    res.json({
      featureId,
      status: 'unknown',
      message: 'Progress tracking not yet implemented',
    });
  });

  return router;
}

// Export default for backwards compatibility
export default function (events: EventEmitter) {
  return createMultiAgentSpecRoutes(events);
}
