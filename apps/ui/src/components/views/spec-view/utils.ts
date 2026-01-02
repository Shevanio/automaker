/**
 * Utilities for spec view formatting and transformations
 */

import type { MultiAgentAnalysis } from '@automaker/types';

/**
 * Formats a multi-agent analysis result into a comprehensive spec markdown
 */
export function formatAnalysisToSpec(analysis: MultiAgentAnalysis): string {
  const sections: string[] = [];

  // Title and overview
  sections.push(`# ${analysis.feature_title || 'Application Specification'}\n`);

  if (analysis.feature_description) {
    sections.push(`## Overview\n\n${analysis.feature_description}\n`);
  }

  // Summary metadata
  sections.push(`## Documentation Summary\n`);
  sections.push(`- **Total Components**: ${analysis.metadata.total_tasks}`);
  sections.push(`- **Complexity Score**: ${analysis.metadata.complexity_score}/10`);
  sections.push(`- **Risk Level**: ${analysis.metadata.risk_level.toUpperCase()}`);
  sections.push(
    `- **Successful Agents**: ${analysis.metadata.successful_agents}/${analysis.metadata.agents_used}`
  );
  sections.push(``);

  // Architecture Components & Systems
  if (analysis.combined_steps && analysis.combined_steps.length > 0) {
    sections.push(`## Architecture Components\n`);
    sections.push(
      `The following ${analysis.combined_steps.length} components and systems document the current application architecture:\n`
    );

    analysis.combined_steps.forEach((step) => {
      const agentIcon = getAgentIcon(step.agent_source);
      sections.push(`### ${step.order}. ${step.title} ${agentIcon}`);
      sections.push(``);
      sections.push(`**Documentation**: ${step.description}\n`);

      if (step.files_to_modify && step.files_to_modify.length > 0) {
        sections.push(`**Implementation Files**:`);
        step.files_to_modify.forEach((file) => sections.push(`- \`${file}\``));
        sections.push(``);
      }

      if (step.tests_required && step.tests_required.length > 0) {
        sections.push(`**Test Files**:`);
        step.tests_required.forEach((test) => sections.push(`- \`${test}\``));
        sections.push(``);
      }

      if (step.agent_notes) {
        sections.push(`**Technical Notes**:\n${step.agent_notes}\n`);
      }

      sections.push(`---\n`);
    });
  }

  // Agent-specific insights
  sections.push(`## Agent Insights\n`);
  sections.push(`Detailed analysis from each specialized agent:\n`);

  analysis.agents.forEach((agent) => {
    if (agent.status === 'completed') {
      sections.push(`### ${agent.agent_icon} ${agent.agent_name}`);
      sections.push(``);

      if (agent.insights && agent.insights.length > 0) {
        sections.push(`**Architectural Insights**:`);
        agent.insights.forEach((insight) => sections.push(`- 💡 ${insight}`));
        sections.push(``);
      }

      if (agent.warnings && agent.warnings.length > 0) {
        sections.push(`**Known Limitations**:`);
        agent.warnings.forEach((warning) => sections.push(`- ⚠️ ${warning}`));
        sections.push(``);
      }

      if (agent.dependencies && agent.dependencies.length > 0) {
        sections.push(`**Current Dependencies**:`);
        agent.dependencies.forEach((dep) => sections.push(`- ${dep}`));
        sections.push(``);
      }

      sections.push(``);
    }
  });

  // Analysis metadata
  sections.push(`## Analysis Metadata\n`);
  sections.push(`- **Started**: ${new Date(analysis.started_at).toLocaleString()}`);
  sections.push(`- **Completed**: ${new Date(analysis.completed_at).toLocaleString()}`);
  sections.push(`- **Total Duration**: ${Math.round(analysis.total_duration_ms / 1000)} seconds`);
  sections.push(``);

  return sections.join('\n');
}

/**
 * Get the icon for an agent specialization
 */
function getAgentIcon(specialization: string): string {
  const icons: Record<string, string> = {
    frontend: '🎨',
    backend: '⚙️',
    database: '🗄️',
    security: '🔒',
    testing: '🧪',
    devops: '🚀',
  };
  return icons[specialization] || '🤖';
}
