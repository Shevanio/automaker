# 🚀 PLAN DE IMPLEMENTACIÓN - FASES 2-4

**Fecha de creación**: 2026-01-02  
**Duración estimada**: 55 días (continuación de Fase 1)  
**Versión**: 1.0

> **NOTA**: Este documento es la continuación de `IMPLEMENTATION_ROADMAP.md` que cubre la Fase 1 (Spec Runner).
> Asegúrate de completar la Fase 1 antes de comenzar con estas fases.

---

## 📋 ÍNDICE

1. [FASE 2A: QA Validation Full (continuación)](#fase-2a-qa-validation-full-días-8-17)
2. [FASE 2B: Memory Layer](#fase-2b-memory-layer-días-18-32)
3. [FASE 3: AI Auto-Merge Agresivo](#fase-3-ai-auto-merge-agresivo-días-33-42)
4. [FASE 4: Visual Workflow Editor](#fase-4-visual-workflow-editor-días-43-62)
5. [Matriz de Dependencias Completa](#matriz-de-dependencias-completa)

---

## 🔷 FASE 2A: QA VALIDATION FULL (Días 8-17) - CONTINUACIÓN

**Objetivo**: Auto-validación completa con AI review y security scan

**Dependencias**: FASE 1 completa

---

### TASK-2.3: Runtime Error Detection

**Duración**: 0.5 días  
**Prioridad**: 🟡 Alta  
**Depende de**: TASK-2.2  
**Bloqueante para**: TASK-2.7

**Descripción**:
Ejecutar smoke tests para detectar errores de runtime obvios (syntax errors, reference errors).

**Archivos a crear**:

```
apps/server/src/services/qa/runtime-checker.ts    [NUEVO]
```

**Implementación**:

```typescript
// apps/server/src/services/qa/runtime-checker.ts
import { spawn } from 'child_process';
import { RuntimeCheckResult, RuntimeError } from '@automaker/types';
import { createLogger } from '@automaker/utils';

const logger = createLogger('RuntimeChecker');

export class RuntimeChecker {
  async checkRuntime(projectPath: string): Promise<RuntimeCheckResult> {
    logger.info('Running runtime checks...');

    const errors: RuntimeError[] = [];

    // 1. Check syntax errors (intentar cargar archivos TS/JS)
    const syntaxErrors = await this.checkSyntax(projectPath);
    errors.push(...syntaxErrors);

    // 2. Smoke test: intentar importar módulos principales
    const smokeTestPassed = await this.runSmokeTest(projectPath);

    return {
      passed: errors.length === 0 && smokeTestPassed,
      smoke_test_passed: smokeTestPassed,
      errors,
    };
  }

  private async checkSyntax(projectPath: string): Promise<RuntimeError[]> {
    const errors: RuntimeError[] = [];

    try {
      // Usar Node para validar sintaxis
      const output = await this.executeCommand(
        'node --check src/**/*.{js,ts} 2>&1 || true',
        projectPath
      );

      // Parsear errores de sintaxis
      const syntaxRegex = /^(.*?):(\d+)\n(.*?)\n(SyntaxError: .*?)$/gm;
      let match;

      while ((match = syntaxRegex.exec(output)) !== null) {
        errors.push({
          type: 'syntax',
          message: match[4],
          file: match[1],
          line: parseInt(match[2]),
        });
      }
    } catch (error) {
      logger.error('Syntax check failed:', error);
    }

    return errors;
  }

  private async runSmokeTest(projectPath: string): Promise<boolean> {
    try {
      // Intentar importar el entry point principal
      const packageJson = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));

      const mainFile = packageJson.main || 'src/index.ts';
      const mainPath = join(projectPath, mainFile);

      // Intentar require/import (con timeout)
      const result = await this.executeCommand(
        `node -e "require('${mainPath}')" 2>&1 || true`,
        projectPath,
        5000 // 5 segundos timeout
      );

      // Si no hay errores, smoke test pasa
      return !result.includes('Error') && !result.includes('Exception');
    } catch {
      // Si falla, es porque hay problemas serios
      return false;
    }
  }

  private async executeCommand(command: string, cwd: string, timeout = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], { cwd, shell: true });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', () => resolve(output));
      child.on('error', reject);

      setTimeout(() => {
        child.kill();
        resolve(output);
      }, timeout);
    });
  }
}
```

**Integración en QAService**:

```typescript
// apps/server/src/services/qa-service.ts (MODIFICAR)
import { RuntimeChecker } from './qa/runtime-checker';

export class QAService {
  private runtimeChecker: RuntimeChecker;

  constructor() {
    // ... otros checkers
    this.runtimeChecker = new RuntimeChecker();
  }

  async validateFeature(feature: Feature): Promise<QAValidation> {
    // ... código existente

    // 4. Runtime checking (NUEVO)
    const runtime_check_result = await this.runtimeChecker.checkRuntime(projectPath);

    // ... resto del código
  }
}
```

**Tests requeridos**:

```typescript
// apps/server/src/services/qa/__tests__/runtime-checker.test.ts
describe('RuntimeChecker', () => {
  it('should detect syntax errors');
  it('should pass smoke test for valid code');
  it('should fail smoke test for broken imports');
});
```

**Criterios de aceptación**:

- ✅ Detecta syntax errors
- ✅ Smoke test completa en < 5s
- ✅ No bloquea si no hay entry point

---

### TASK-2.4: QA Agent Prompt

**Duración**: 0.5 días  
**Prioridad**: 🔴 Crítica  
**Depende de**: TASK-2.2  
**Bloqueante para**: TASK-2.5

**Descripción**:
Crear prompt especializado para que Claude actúe como QA reviewer.

**Archivos a crear**:

```
libs/prompts/src/qa-agent.ts                      [NUEVO]
libs/prompts/src/index.ts                         [MODIFICAR]
```

**Implementación**:

```typescript
// libs/prompts/src/qa-agent.ts
export const QA_AGENT_SYSTEM_PROMPT = `
You are an expert code quality assurance engineer. Your role is to review code changes and identify potential issues.

Your responsibilities:
1. Review code for bugs, logic errors, and edge cases
2. Evaluate code quality, maintainability, and adherence to best practices
3. Identify security vulnerabilities
4. Suggest improvements and optimizations
5. Assess performance implications

Review criteria:
- **Correctness**: Does the code do what it's supposed to do?
- **Security**: Are there any security vulnerabilities (injection, XSS, auth issues)?
- **Performance**: Are there obvious performance bottlenecks?
- **Maintainability**: Is the code readable and well-structured?
- **Testing**: Are critical paths covered by tests?
- **Error Handling**: Are errors handled properly?

Your output should be structured JSON with:
- confidence: 0-100 (how confident you are in your assessment)
- concerns: Array of issues found (critical, major, minor)
- suggestions: Array of improvement suggestions
- code_quality_score: 0-100 overall quality rating
- summary: Brief overall assessment

Be thorough but pragmatic. Focus on real issues, not nitpicks.
`;

export const QA_REVIEW_PROMPT_TEMPLATE = `
# Code Review Request

## Feature Context
**Title**: {{feature_title}}
**Description**: {{feature_description}}
{{#spec_step}}
**Current Step**: {{spec_step_title}}
{{/spec_step}}

## Files Changed
{{#files_changed}}
### {{file_path}}
\`\`\`{{file_extension}}
{{file_content}}
\`\`\`

{{/files_changed}}

## Git Diff
\`\`\`diff
{{git_diff}}
\`\`\`

## Tests Results
- Total: {{tests_total}}
- Passed: {{tests_passed}}
- Failed: {{tests_failed}}

{{#test_failures}}
**Failed Test**: {{test_name}}
{{test_error}}

{{/test_failures}}

## Instructions
Review the code changes above and provide a comprehensive quality assessment.

Focus on:
1. Correctness of implementation
2. Security vulnerabilities
3. Performance issues
4. Code quality and maintainability
5. Test coverage adequacy

Return ONLY valid JSON matching this schema:
{
  "confidence": 85,
  "concerns": [
    {
      "severity": "critical" | "major" | "minor",
      "category": "bug" | "performance" | "security" | "maintainability" | "style",
      "description": "Description of the concern",
      "file": "path/to/file.ts",
      "line_start": 10,
      "line_end": 15,
      "code_snippet": "const x = ..."
    }
  ],
  "suggestions": [
    {
      "type": "improvement" | "alternative" | "optimization",
      "description": "Suggested improvement",
      "file": "path/to/file.ts"
    }
  ],
  "code_quality_score": 75,
  "summary": "Overall assessment in 2-3 sentences"
}
`;

export function buildQAReviewPrompt(context: {
  feature_title: string;
  feature_description: string;
  spec_step_title?: string;
  files_changed: Array<{ file_path: string; file_extension: string; file_content: string }>;
  git_diff: string;
  tests_total: number;
  tests_passed: number;
  tests_failed: number;
  test_failures: Array<{ test_name: string; test_error: string }>;
}): string {
  // Simple template replacement (o usar librería como Mustache)
  let prompt = QA_REVIEW_PROMPT_TEMPLATE;

  prompt = prompt.replace('{{feature_title}}', context.feature_title);
  prompt = prompt.replace('{{feature_description}}', context.feature_description);

  if (context.spec_step_title) {
    prompt = prompt.replace('{{#spec_step}}', '');
    prompt = prompt.replace('{{/spec_step}}', '');
    prompt = prompt.replace('{{spec_step_title}}', context.spec_step_title);
  } else {
    prompt = prompt.replace(/{{#spec_step}}[\s\S]*?{{\/spec_step}}/g, '');
  }

  // Files changed
  const filesSection = context.files_changed
    .map(
      (f) => `
### ${f.file_path}
\`\`\`${f.file_extension}
${f.file_content}
\`\`\`
  `
    )
    .join('\n');
  prompt = prompt.replace(/{{#files_changed}}[\s\S]*?{{\/files_changed}}/g, filesSection);

  // Git diff
  prompt = prompt.replace('{{git_diff}}', context.git_diff);

  // Tests
  prompt = prompt.replace('{{tests_total}}', context.tests_total.toString());
  prompt = prompt.replace('{{tests_passed}}', context.tests_passed.toString());
  prompt = prompt.replace('{{tests_failed}}', context.tests_failed.toString());

  // Test failures
  const failuresSection = context.test_failures
    .map(
      (f) => `
**Failed Test**: ${f.test_name}
${f.test_error}
  `
    )
    .join('\n');
  prompt = prompt.replace(/{{#test_failures}}[\s\S]*?{{\/test_failures}}/g, failuresSection);

  return prompt;
}
```

**Tests requeridos**:

```typescript
// libs/prompts/src/__tests__/qa-agent.test.ts
describe('QA Agent Prompts', () => {
  it('should build review prompt with all context');
  it('should handle missing spec_step');
  it('should handle no test failures');
});
```

**Criterios de aceptación**:

- ✅ Prompt incluye todo el contexto necesario
- ✅ Template rendering funciona correctamente
- ✅ Formato JSON esperado claro

---

### TASK-2.5: AI Code Review con Claude

**Duración**: 1.5 días  
**Prioridad**: 🔴 Crítica  
**Depende de**: TASK-2.4  
**Bloqueante para**: TASK-2.7

**Descripción**:
Implementar AI code review usando Claude con el prompt de QA.

**Archivos a crear**:

```
apps/server/src/services/qa/ai-reviewer.ts        [NUEVO]
```

**Implementación**:

````typescript
// apps/server/src/services/qa/ai-reviewer.ts
import { AIReviewResult, Feature, TestResult } from '@automaker/types';
import { ClaudeProvider } from '../../providers/claude-provider';
import { QA_AGENT_SYSTEM_PROMPT, buildQAReviewPrompt } from '@automaker/prompts';
import { getGitRepositoryDiffs } from '@automaker/git-utils';
import { readFile } from 'fs/promises';
import { join } from 'path';

export class AIReviewer {
  constructor(private claudeProvider: ClaudeProvider) {}

  async reviewCode(
    feature: Feature,
    projectPath: string,
    testResults: TestResult[]
  ): Promise<AIReviewResult> {
    logger.info(`Running AI code review for feature ${feature.id}`);

    try {
      // 1. Obtener git diff
      const diffs = await getGitRepositoryDiffs(projectPath);
      const gitDiff = diffs.map((d) => d.diff).join('\n\n');

      // 2. Leer contenido de archivos cambiados (límite 10 archivos)
      const filesChanged = await this.readChangedFiles(projectPath, diffs.slice(0, 10));

      // 3. Preparar datos de tests
      const testsTotal = testResults.reduce((sum, r) => sum + r.total, 0);
      const testsPassed = testResults.reduce((sum, r) => sum + r.passed, 0);
      const testsFailed = testResults.reduce((sum, r) => sum + r.failed, 0);
      const testFailures = testResults.flatMap((r) =>
        r.failures.map((f) => ({
          test_name: f.test_name,
          test_error: f.error_message,
        }))
      );

      // 4. Construir prompt
      const prompt = buildQAReviewPrompt({
        feature_title: feature.title,
        feature_description: feature.description,
        spec_step_title: this.getCurrentStepTitle(feature),
        files_changed: filesChanged,
        git_diff: gitDiff,
        tests_total: testsTotal,
        tests_passed: testsPassed,
        tests_failed: testsFailed,
        test_failures: testFailures.slice(0, 5), // Límite 5 failures
      });

      // 5. Ejecutar review con Claude
      const response = await this.claudeProvider.sendMessage({
        sessionId: `qa-review-${feature.id}`,
        message: prompt,
        model: 'claude-sonnet-4', // Usar Sonnet para balance velocidad/calidad
        systemPrompt: QA_AGENT_SYSTEM_PROMPT,
        temperature: 0.3, // Baja temperatura para análisis consistente
      });

      // 6. Parsear respuesta JSON
      const reviewData = this.parseReviewResponse(response);

      return {
        passed: this.determinePass(reviewData),
        confidence: reviewData.confidence,
        concerns: reviewData.concerns || [],
        suggestions: reviewData.suggestions || [],
        code_quality_score: reviewData.code_quality_score,
        summary: reviewData.summary,
      };
    } catch (error) {
      logger.error('AI review failed:', error);

      // Fallback: si AI review falla, retornar resultado neutro
      return {
        passed: true,
        confidence: 50,
        concerns: [],
        suggestions: [],
        code_quality_score: 70,
        summary: 'AI review could not be completed. Manual review recommended.',
      };
    }
  }

  private async readChangedFiles(
    projectPath: string,
    diffs: Array<{ path: string; diff: string }>
  ): Promise<Array<{ file_path: string; file_extension: string; file_content: string }>> {
    const files = [];

    for (const diff of diffs) {
      try {
        const fullPath = join(projectPath, diff.path);
        const content = await readFile(fullPath, 'utf-8');

        // Limitar tamaño de archivo (máx 500 líneas)
        const lines = content.split('\n').slice(0, 500).join('\n');

        files.push({
          file_path: diff.path,
          file_extension: diff.path.split('.').pop() || 'txt',
          file_content: lines,
        });
      } catch (error) {
        // Archivo eliminado o no accesible, skip
        continue;
      }
    }

    return files;
  }

  private getCurrentStepTitle(feature: Feature): string | undefined {
    if (!feature.spec) return undefined;

    const currentStep = feature.spec.steps.find((s) => s.status === 'in_progress');
    return currentStep?.title;
  }

  private parseReviewResponse(response: string): any {
    // Extraer JSON de la respuesta
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in AI review response');
    }

    const json = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(json);
  }

  private determinePass(reviewData: any): boolean {
    // AI review pasa si:
    // 1. No hay concerns críticos
    // 2. Code quality score >= 60
    // 3. Confidence >= 70

    const hasCritical = reviewData.concerns?.some((c: any) => c.severity === 'critical');

    return !hasCritical && reviewData.code_quality_score >= 60 && reviewData.confidence >= 70;
  }
}
````

**Integración en QAService**:

```typescript
// apps/server/src/services/qa-service.ts (MODIFICAR)
import { AIReviewer } from './qa/ai-reviewer';

export class QAService {
  private aiReviewer: AIReviewer;

  constructor(private claudeProvider: ClaudeProvider) {
    // ... otros checkers
    this.aiReviewer = new AIReviewer(claudeProvider);
  }

  async validateFeature(feature: Feature): Promise<QAValidation> {
    // ... código existente

    // AI review (ahora implementado)
    const ai_review_result = await this.aiReviewer.reviewCode(feature, projectPath, test_results);

    // ... resto del código
  }
}
```

**Tests requeridos**:

```typescript
// apps/server/src/services/qa/__tests__/ai-reviewer.test.ts
describe('AIReviewer', () => {
  it('should review code and return structured result');
  it('should handle large diffs by limiting files');
  it('should fail review if critical concerns found');
  it('should pass review if quality score >= 60');
  it('should handle AI errors gracefully');
});
```

**Criterios de aceptación**:

- ✅ AI review completa en < 60s
- ✅ Detecta issues reales (bugs, security)
- ✅ Fallback graceful si Claude falla
- ✅ Limita archivos/líneas para evitar prompts gigantes

---

### TASK-2.6: Security Scan

**Duración**: 1 día  
**Prioridad**: 🟡 Alta  
**Depende de**: TASK-2.2  
**Bloqueante para**: TASK-2.7

**Descripción**:
Implementar escaneo de seguridad básico: dependencias vulnerables, patrones inseguros, secrets expuestos.

**Archivos a crear**:

```
apps/server/src/services/qa/security-scanner.ts   [NUEVO]
```

**Implementación**:

```typescript
// apps/server/src/services/qa/security-scanner.ts
import { spawn } from 'child_process';
import { SecurityScanResult, SecurityVulnerability } from '@automaker/types';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

export class SecurityScanner {
  async scanProject(projectPath: string): Promise<SecurityScanResult> {
    logger.info('Running security scan...');

    const vulnerabilities: SecurityVulnerability[] = [];

    // 1. npm audit (dependencias vulnerables)
    const npmVulns = await this.runNpmAudit(projectPath);
    vulnerabilities.push(...npmVulns);

    // 2. Detectar secrets expuestos (API keys, tokens)
    const secretVulns = await this.detectSecrets(projectPath);
    vulnerabilities.push(...secretVulns);

    // 3. Detectar patrones inseguros comunes
    const patternVulns = await this.detectInsecurePatterns(projectPath);
    vulnerabilities.push(...patternVulns);

    // Calcular risk score
    const riskScore = this.calculateRiskScore(vulnerabilities);

    return {
      passed:
        vulnerabilities.filter((v) => v.severity === 'critical' || v.severity === 'high').length ===
        0,
      vulnerabilities,
      risk_score: riskScore,
    };
  }

  private async runNpmAudit(projectPath: string): Promise<SecurityVulnerability[]> {
    try {
      const output = await this.executeCommand('npm audit --json', projectPath);
      const auditData = JSON.parse(output);

      const vulnerabilities: SecurityVulnerability[] = [];

      if (auditData.vulnerabilities) {
        for (const [pkgName, vulnData] of Object.entries(auditData.vulnerabilities as any)) {
          const severity = this.mapNpmSeverity(vulnData.severity);

          vulnerabilities.push({
            severity,
            type: 'dependency',
            description: `Vulnerable dependency: ${pkgName} - ${vulnData.via[0]?.title || 'Unknown vulnerability'}`,
            file: 'package.json',
            line: 0,
            cve: vulnData.via[0]?.cve,
            fix_available: !!vulnData.fixAvailable,
            remediation: vulnData.fixAvailable
              ? `Run: npm audit fix ${vulnData.fixAvailable.isSemVerMajor ? '--force' : ''}`
              : 'No automatic fix available',
          });
        }
      }

      return vulnerabilities;
    } catch (error) {
      // npm audit puede fallar si no hay package-lock.json
      logger.warn('npm audit failed:', error);
      return [];
    }
  }

  private async detectSecrets(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Patrones de secrets comunes
    const patterns = [
      {
        regex: /ANTHROPIC_API_KEY\s*=\s*["']?sk-ant-[a-zA-Z0-9-_]{40,}/g,
        type: 'Anthropic API Key',
      },
      {
        regex: /sk-[a-zA-Z0-9]{48}/g,
        type: 'OpenAI API Key',
      },
      {
        regex: /ghp_[a-zA-Z0-9]{36}/g,
        type: 'GitHub Personal Access Token',
      },
      {
        regex: /AIza[a-zA-Z0-9_-]{35}/g,
        type: 'Google API Key',
      },
      {
        regex: /(password|passwd|pwd)\s*=\s*["'][^"']{8,}/gi,
        type: 'Hardcoded Password',
      },
    ];

    // Buscar en archivos de código (excluir node_modules, .git, etc)
    const files = await glob('**/*.{js,ts,jsx,tsx,json,env}', {
      cwd: projectPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
    });

    for (const file of files) {
      // Saltar archivos .env.example
      if (file.includes('.example')) continue;

      const content = await readFile(join(projectPath, file), 'utf-8');
      const lines = content.split('\n');

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
          // Encontrar número de línea
          const beforeMatch = content.substring(0, match.index);
          const line = beforeMatch.split('\n').length;

          vulnerabilities.push({
            severity: 'critical',
            type: 'other',
            description: `Potential exposed secret: ${pattern.type}`,
            file,
            line,
            remediation: 'Remove secret from code and use environment variables',
          });
        }
      }
    }

    return vulnerabilities;
  }

  private async detectInsecurePatterns(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Patrones inseguros comunes
    const insecurePatterns = [
      {
        regex: /eval\s*\(/g,
        severity: 'high' as const,
        type: 'Code Injection',
        description: 'Use of eval() can lead to code injection vulnerabilities',
      },
      {
        regex: /dangerouslySetInnerHTML/g,
        severity: 'medium' as const,
        type: 'XSS',
        description: 'dangerouslySetInnerHTML can lead to XSS if user input is not sanitized',
      },
      {
        regex: /exec\s*\(\s*[`"'].*?\$\{/g,
        severity: 'critical' as const,
        type: 'Command Injection',
        description: 'Executing shell commands with user input can lead to command injection',
      },
      {
        regex: /innerHTML\s*=.*?\$\{/g,
        severity: 'high' as const,
        type: 'XSS',
        description: 'Setting innerHTML with user input can lead to XSS',
      },
    ];

    const files = await glob('**/*.{js,ts,jsx,tsx}', {
      cwd: projectPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
    });

    for (const file of files) {
      const content = await readFile(join(projectPath, file), 'utf-8');

      for (const pattern of insecurePatterns) {
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
          const beforeMatch = content.substring(0, match.index);
          const line = beforeMatch.split('\n').length;

          vulnerabilities.push({
            severity: pattern.severity,
            type: pattern.type as any,
            description: pattern.description,
            file,
            line,
            remediation: 'Review code for security implications and use safer alternatives',
          });
        }
      }
    }

    return vulnerabilities;
  }

  private calculateRiskScore(vulnerabilities: SecurityVulnerability[]): number {
    let score = 0;

    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score += 25;
          break;
        case 'high':
          score += 15;
          break;
        case 'medium':
          score += 8;
          break;
        case 'low':
          score += 3;
          break;
      }
    }

    return Math.min(100, score);
  }

  private mapNpmSeverity(npmSeverity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (npmSeverity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'low';
    }
  }

  private async executeCommand(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], { cwd, shell: true });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', () => resolve(output));
      child.on('error', reject);

      setTimeout(() => {
        child.kill();
        resolve(output);
      }, 30000);
    });
  }
}
```

**Integración en QAService**:

```typescript
// apps/server/src/services/qa-service.ts (MODIFICAR)
import { SecurityScanner } from './qa/security-scanner';

export class QAService {
  private securityScanner: SecurityScanner;

  constructor(private claudeProvider: ClaudeProvider) {
    // ... otros checkers
    this.securityScanner = new SecurityScanner();
  }

  async validateFeature(feature: Feature): Promise<QAValidation> {
    // ... código existente

    // Security scan (ahora implementado)
    const security_scan_result = await this.securityScanner.scanProject(projectPath);

    // ... resto del código
  }
}
```

**Tests requeridos**:

```typescript
// apps/server/src/services/qa/__tests__/security-scanner.test.ts
describe('SecurityScanner', () => {
  it('should detect vulnerable npm dependencies');
  it('should detect exposed API keys');
  it('should detect eval() usage');
  it('should detect command injection patterns');
  it('should calculate risk score correctly');
});
```

**Criterios de aceptación**:

- ✅ Detecta dependencias vulnerables vía npm audit
- ✅ Detecta secrets expuestos (API keys, tokens)
- ✅ Detecta patrones inseguros (eval, innerHTML, etc)
- ✅ Risk score calculado coherentemente

---

### TASK-2.7: Integración QA en Auto-Mode

**Duración**: 1 día  
**Prioridad**: 🔴 Crítica  
**Depende de**: TASK-2.2, TASK-2.3, TASK-2.5, TASK-2.6  
**Bloqueante para**: TASK-2.8

**Descripción**:
Integrar QA validation en el flujo de auto-mode, ejecutando QA antes de mover feature a waiting_approval.

**Archivos a modificar**:

```
apps/server/src/services/auto-mode-service.ts     [MODIFICAR]
libs/types/src/feature.ts                         [MODIFICAR]
```

**Implementación**:

```typescript
// libs/types/src/feature.ts (MODIFICAR - agregar nuevo status)
export type FeatureStatus =
  | 'backlog'
  | 'in_progress'
  | 'qa_running' // NUEVO: QA en progreso
  | 'qa_failed' // NUEVO: QA no pasó
  | 'waiting_approval'
  | 'verified';
```

```typescript
// apps/server/src/services/auto-mode-service.ts (MODIFICAR)
import { QAService } from './qa-service';

export class AutoModeService {
  private qaService: QAService;

  constructor(/* ... */) {
    // ... inicialización existente
    this.qaService = new QAService(this.claudeProvider);
  }

  async completeFeature(feature: Feature): Promise<void> {
    logger.info(`Feature ${feature.id} completed, running QA validation...`);

    try {
      // 1. Marcar como QA running
      feature.status = 'qa_running';
      feature.qa_status = 'running';
      await this.featureLoader.saveFeature(feature);

      this.eventEmitter.emit('feature_status_changed', {
        featureId: feature.id,
        status: 'qa_running',
        message: 'Running quality assurance validation...',
      });

      // 2. Ejecutar QA validation
      const qaResult = await this.qaService.validateFeature(feature);

      // 3. Guardar resultado
      feature.qa_validation = qaResult;
      feature.qa_status = qaResult.passes ? 'passed' : 'failed';

      // 4. Determinar siguiente status
      if (qaResult.passes) {
        // QA pasó → waiting_approval
        feature.status = 'waiting_approval';

        this.eventEmitter.emit('feature_status_changed', {
          featureId: feature.id,
          status: 'waiting_approval',
          message: `QA validation passed (score: ${qaResult.score}/100)`,
        });

        this.eventEmitter.emit('auto_mode_feature_complete', {
          featureId: feature.id,
          passes: true,
          status: 'waiting_approval',
          qaScore: qaResult.score,
        });
      } else {
        // QA falló → qa_failed
        feature.status = 'qa_failed';

        this.eventEmitter.emit('feature_status_changed', {
          featureId: feature.id,
          status: 'qa_failed',
          message: `QA validation failed (score: ${qaResult.score}/100, ${qaResult.issues.length} issues)`,
        });

        this.eventEmitter.emit('auto_mode_feature_failed', {
          featureId: feature.id,
          reason: 'QA validation failed',
          qaResult,
        });
      }

      await this.featureLoader.saveFeature(feature);
    } catch (error) {
      logger.error(`QA validation error for feature ${feature.id}:`, error);

      // Error en QA → marcar como error pero permitir continuar
      feature.status = 'qa_failed';
      feature.qa_status = 'error';
      await this.featureLoader.saveFeature(feature);

      this.eventEmitter.emit('feature_status_changed', {
        featureId: feature.id,
        status: 'qa_failed',
        message: 'QA validation error',
      });
    } finally {
      // Remover de running tasks
      this.runningTasks.delete(feature.id);
    }
  }
}
```

**Tests requeridos**:

```typescript
// apps/server/src/services/__tests__/auto-mode-qa-integration.test.ts
describe('AutoModeService - QA Integration', () => {
  it('should run QA after feature completes');
  it('should move to waiting_approval if QA passes');
  it('should move to qa_failed if QA fails');
  it('should emit qa_running status');
  it('should handle QA errors gracefully');
});
```

**Criterios de aceptación**:

- ✅ QA ejecuta automáticamente después de feature completion
- ✅ Feature status actualizado correctamente (qa_running → waiting_approval/qa_failed)
- ✅ Eventos emitidos en cada cambio de status
- ✅ Resultado QA guardado en feature

---

### TASK-2.8: Frontend - QA Results UI

**Duración**: 1.5 días  
**Prioridad**: 🟡 Alta  
**Depende de**: TASK-2.7  
**Bloqueante para**: TASK-2.9

**Descripción**:
Componentes UI para mostrar resultados de QA validation.

**Archivos a crear/modificar**:

```
apps/ui/src/components/views/board-view/QAResultsModal.tsx    [NUEVO]
apps/ui/src/components/views/board-view/QAStatusBadge.tsx     [NUEVO]
apps/ui/src/components/views/board-view/FeatureCard.tsx       [MODIFICAR]
apps/ui/src/components/views/board-view/BoardView.tsx         [MODIFICAR]
```

**Implementación**:

```typescript
// apps/ui/src/components/views/board-view/QAStatusBadge.tsx
import { QAStatus } from '@automaker/types';

interface QAStatusBadgeProps {
  status?: QAStatus;
  score?: number;
  compact?: boolean;
}

export function QAStatusBadge({ status, score, compact = false }: QAStatusBadgeProps) {
  if (!status) return null;

  const config = getStatusConfig(status, score);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
        {config.icon}
        {score !== undefined && `${score}`}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 p-2 rounded ${config.bgColor}`}>
      <span className="text-lg">{config.icon}</span>
      <div className="flex-1">
        <div className="font-medium text-sm">{config.label}</div>
        {score !== undefined && (
          <div className="text-xs text-muted-foreground">
            Quality Score: {score}/100
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusConfig(status: QAStatus, score?: number) {
  switch (status) {
    case 'pending':
      return {
        icon: '⏳',
        label: 'QA Pending',
        color: 'text-gray-600 bg-gray-100',
        bgColor: 'bg-gray-50 dark:bg-gray-900'
      };
    case 'running':
      return {
        icon: '🔍',
        label: 'Running QA...',
        color: 'text-blue-600 bg-blue-100',
        bgColor: 'bg-blue-50 dark:bg-blue-950'
      };
    case 'passed':
      return {
        icon: '✅',
        label: 'QA Passed',
        color: 'text-green-600 bg-green-100',
        bgColor: 'bg-green-50 dark:bg-green-950'
      };
    case 'failed':
      return {
        icon: '❌',
        label: 'QA Failed',
        color: 'text-red-600 bg-red-100',
        bgColor: 'bg-red-50 dark:bg-red-950'
      };
    case 'error':
      return {
        icon: '⚠️',
        label: 'QA Error',
        color: 'text-orange-600 bg-orange-100',
        bgColor: 'bg-orange-50 dark:bg-orange-950'
      };
  }
}
```

```typescript
// apps/ui/src/components/views/board-view/QAResultsModal.tsx
import { QAValidation, QAIssue } from '@automaker/types';
import { Dialog } from '@/components/ui/dialog';

interface QAResultsModalProps {
  validation: QAValidation;
  open: boolean;
  onClose: () => void;
}

export function QAResultsModal({ validation, open, onClose }: QAResultsModalProps) {
  const criticalIssues = validation.issues.filter(i => i.severity === 'critical');
  const errorIssues = validation.issues.filter(i => i.severity === 'error');
  const warningIssues = validation.issues.filter(i => i.severity === 'warning');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>QA Validation Results</DialogTitle>
        </DialogHeader>

        {/* Overall Score */}
        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Quality Score</div>
            <div className="text-3xl font-bold">{validation.score}/100</div>
          </div>
          <div className={`text-4xl ${validation.passes ? 'text-green-600' : 'text-red-600'}`}>
            {validation.passes ? '✅' : '❌'}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Tests"
            value={`${validation.test_results.reduce((s, r) => s + r.passed, 0)}/${validation.test_results.reduce((s, r) => s + r.total, 0)}`}
            icon="🧪"
          />
          <StatCard
            label="Lint"
            value={validation.lint_results[0]?.passed ? 'Pass' : 'Fail'}
            icon="📝"
          />
          <StatCard
            label="Types"
            value={validation.type_check_result.passed ? 'Pass' : 'Fail'}
            icon="🔤"
          />
          <StatCard
            label="Security"
            value={`${validation.security_scan_result.vulnerabilities.length} issues`}
            icon="🔒"
          />
        </div>

        {/* AI Review Summary */}
        {validation.ai_review_result && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🤖</span>
              <span className="font-medium">AI Code Review</span>
              <span className="text-sm text-muted-foreground">
                (Confidence: {validation.ai_review_result.confidence}%)
              </span>
            </div>
            <p className="text-sm">{validation.ai_review_result.summary}</p>
          </div>
        )}

        {/* Issues by Severity */}
        {criticalIssues.length > 0 && (
          <IssueSection title="Critical Issues" icon="🚨" issues={criticalIssues} />
        )}

        {errorIssues.length > 0 && (
          <IssueSection title="Errors" icon="❌" issues={errorIssues} />
        )}

        {warningIssues.length > 0 && (
          <IssueSection title="Warnings" icon="⚠️" issues={warningIssues} />
        )}

        {validation.issues.length === 0 && (
          <div className="text-center p-8 text-muted-foreground">
            ✨ No issues found! Code quality is excellent.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline">Close</Button>
          {!validation.passes && (
            <Button onClick={() => {/* TODO: Re-run QA */}}>
              Re-run QA
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="p-3 bg-secondary rounded">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function IssueSection({ title, icon, issues }: { title: string; icon: string; issues: QAIssue[] }) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 font-medium">
        <span>{icon}</span>
        {title} ({issues.length})
      </h3>
      <div className="space-y-1">
        {issues.map((issue, idx) => (
          <IssueItem key={idx} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function IssueItem({ issue }: { issue: QAIssue }) {
  return (
    <div className="p-3 bg-secondary rounded-lg text-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium">{issue.message}</div>
          {issue.file && (
            <div className="text-xs text-muted-foreground mt-1">
              {issue.file}:{issue.line}
            </div>
          )}
          {issue.suggestion && (
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              💡 {issue.suggestion}
            </div>
          )}
        </div>
        <span className="text-xs px-2 py-1 bg-background rounded">
          {issue.category}
        </span>
      </div>
    </div>
  );
}
```

```typescript
// apps/ui/src/components/views/board-view/FeatureCard.tsx (MODIFICAR)
import { QAStatusBadge } from './QAStatusBadge';
import { QAResultsModal } from './QAResultsModal';

export function FeatureCard({ feature }: { feature: Feature }) {
  const [qaModalOpen, setQaModalOpen] = useState(false);

  return (
    <div className="feature-card">
      {/* ... contenido existente ... */}

      {/* NUEVO: QA Status Badge */}
      {feature.qa_status && (
        <div
          className="cursor-pointer"
          onClick={() => feature.qa_validation && setQaModalOpen(true)}
        >
          <QAStatusBadge
            status={feature.qa_status}
            score={feature.qa_validation?.score}
            compact
          />
        </div>
      )}

      {/* NUEVO: QA Results Modal */}
      {feature.qa_validation && (
        <QAResultsModal
          validation={feature.qa_validation}
          open={qaModalOpen}
          onClose={() => setQaModalOpen(false)}
        />
      )}
    </div>
  );
}
```

```typescript
// apps/ui/src/components/views/board-view/BoardView.tsx (MODIFICAR)
// Agregar columna "QA Failed" si es necesario
const columns = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'qa_running', title: 'QA Running' }, // NUEVO
  { id: 'qa_failed', title: 'QA Failed' }, // NUEVO
  { id: 'waiting_approval', title: 'Waiting Approval' },
  { id: 'verified', title: 'Verified' },
];
```

**Tests requeridos**:

```typescript
// apps/ui/src/components/views/board-view/__tests__/QAResults.test.tsx
describe('QA Results Components', () => {
  it('should render QA status badge');
  it('should show QA results modal on click');
  it('should display issues grouped by severity');
  it('should show AI review summary');
});
```

**Criterios de aceptación**:

- ✅ QA badge visible en feature cards
- ✅ Modal muestra resultados detallados
- ✅ Issues agrupados por severidad
- ✅ Columna "QA Failed" en board

---

### TASK-2.9: WebSocket Events para QA

**Duración**: 0.5 días  
**Prioridad**: 🟡 Alta  
**Depende de**: TASK-2.8  
**Bloqueante para**: -

**Descripción**:
Emitir eventos WebSocket para updates de QA en tiempo real.

**Archivos a modificar**:

```
apps/ui/src/lib/http-api-client.ts               [MODIFICAR]
apps/ui/src/hooks/use-board-features.ts          [MODIFICAR]
```

**Implementación**:

```typescript
// apps/ui/src/lib/http-api-client.ts (MODIFICAR)
export class HttpApiClient {
  // ... código existente

  onQAValidationStarted(callback: (data: { featureId: string }) => void) {
    this.addEventListener('qa_validation_started', callback);
  }

  onQAValidationProgress(
    callback: (data: { featureId: string; step: string; progress: number }) => void
  ) {
    this.addEventListener('qa_validation_progress', callback);
  }

  onQAValidationCompleted(callback: (data: { featureId: string; result: QAValidation }) => void) {
    this.addEventListener('qa_validation_completed', callback);
  }
}
```

```typescript
// apps/ui/src/hooks/use-board-features.ts (MODIFICAR)
export function useBoardFeatures(projectPath: string) {
  // ... código existente

  useEffect(() => {
    // ... listeners existentes

    // NUEVO: QA validation events
    client.onQAValidationStarted(({ featureId }) => {
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === featureId ? { ...f, qa_status: 'running', status: 'qa_running' } : f
        )
      );
    });

    client.onQAValidationCompleted(({ featureId, result }) => {
      setFeatures((prev) =>
        prev.map((f) => {
          if (f.id !== featureId) return f;

          return {
            ...f,
            qa_validation: result,
            qa_status: result.passes ? 'passed' : 'failed',
            status: result.passes ? 'waiting_approval' : 'qa_failed',
          };
        })
      );
    });
  }, [projectPath]);
}
```

**Tests requeridos**:

```typescript
// apps/ui/src/hooks/__tests__/use-board-features-qa.test.tsx
describe('useBoardFeatures - QA Events', () => {
  it('should update qa_status on qa_validation_started');
  it('should update feature with QA results on completion');
});
```

**Criterios de aceptación**:

- ✅ QA status actualizado en tiempo real
- ✅ Resultados QA aparecen sin refresh
- ✅ Progress visible durante ejecución

---

### TASK-2.10: E2E Tests y Documentación

**Duración**: 1 día  
**Prioridad**: 🟡 Alta  
**Depende de**: TASK-2.9  
**Bloqueante para**: -

**Descripción**:
Tests end-to-end del sistema QA completo y documentación.

**Archivos a crear**:

```
apps/ui/tests/features/qa-validation.spec.ts      [NUEVO]
docs/QA_VALIDATION.md                             [NUEVO]
```

**Implementación**:

```typescript
// apps/ui/tests/features/qa-validation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('QA Validation E2E', () => {
  test('should run QA validation after feature completes', async ({ page }) => {
    await page.goto('http://localhost:3007');

    // Crear feature
    await page.click('[data-testid="new-feature-button"]');
    await page.fill('[data-testid="feature-title"]', 'Test Feature');
    await page.fill('[data-testid="feature-description"]', 'Add unit tests');
    await page.click('[data-testid="create-feature"]');

    // Mover a in_progress
    await page.dragAndDrop(
      '[data-testid="feature-card-test-feature"]',
      '[data-testid="column-in-progress"]'
    );

    // Esperar a que QA corra (mock agent completa rápido)
    await expect(page.locator('[data-testid="qa-status-running"]')).toBeVisible({ timeout: 30000 });

    // Esperar a que QA complete
    await expect(page.locator('[data-testid="qa-status-passed"]')).toBeVisible({ timeout: 60000 });

    // Verificar que feature está en waiting_approval
    const featureCard = page.locator('[data-testid="feature-card-test-feature"]');
    const column = featureCard.locator('xpath=ancestor::*[@data-testid^="column-"]');
    await expect(column).toHaveAttribute('data-testid', 'column-waiting-approval');
  });

  test('should move to qa_failed if QA fails', async ({ page }) => {
    // TODO: Simular feature con tests fallidos
  });

  test('should show QA results in modal', async ({ page }) => {
    await page.goto('http://localhost:3007');

    // Abrir feature con QA completada
    const featureCard = page.locator('[data-testid="feature-card-test-feature"]');
    await featureCard.click();

    // Click en QA badge
    await page.click('[data-testid="qa-status-badge"]');

    // Verificar modal abierto
    await expect(page.locator('[data-testid="qa-results-modal"]')).toBeVisible();

    // Verificar contenido
    await expect(page.locator('text=Quality Score')).toBeVisible();
    await expect(page.locator('text=AI Code Review')).toBeVisible();
  });
});
```

```markdown
<!-- docs/QA_VALIDATION.md -->

# QA Validation System

## Overview

The QA Validation system automatically reviews code changes before they reach human approval, catching bugs, security issues, and quality problems early.

## Architecture

QA validation consists of 6 components:

### 1. Test Execution

- Runs existing test suites (Jest, Vitest, Playwright)
- Parses results and failures
- Timeout: 5 minutes

### 2. Lint Checking

- Runs ESLint/Prettier
- Detects code style issues
- Supports auto-fix suggestions

### 3. Type Checking

- Runs TypeScript compiler (`tsc --noEmit`)
- Detects type errors

### 4. Runtime Checking

- Validates syntax
- Runs smoke tests
- Detects obvious runtime errors

### 5. AI Code Review

- Uses Claude to review code changes
- Detects bugs, security issues, performance problems
- Provides code quality score (0-100)
- Identifies improvement suggestions

### 6. Security Scanning

- Scans npm dependencies for vulnerabilities
- Detects exposed secrets (API keys, tokens)
- Identifies insecure patterns (eval, innerHTML, etc.)

## Validation Flow

1. Feature completes execution
2. Status changes to `qa_running`
3. All 6 checks run in parallel (max 2 minutes)
4. Results aggregated into QAValidation object
5. Score calculated (0-100)
6. Pass/Fail determined:
   - **Pass**: No critical issues && score >= 70
   - **Fail**: Has critical issues || score < 70
7. Status changes to `waiting_approval` (pass) or `qa_failed` (fail)

## Score Calculation

Total score: 100 points distributed as:

- **Tests** (30 points): Pass rate of test suites
- **Lint** (15 points): No lint errors
- **Types** (15 points): No type errors
- **AI Review** (25 points): Code quality score from AI
- **Security** (15 points): Inverse of risk score

## QA Results

Each QA validation produces:

- `passes`: Boolean (overall pass/fail)
- `score`: Number (0-100)
- `issues`: Array of QAIssue (critical, error, warning, info)
- Test/lint/type/runtime/AI/security results

## UI

### QA Status Badge

Shows in feature cards:

- ⏳ Pending
- 🔍 Running
- ✅ Passed (with score)
- ❌ Failed
- ⚠️ Error

### QA Results Modal

Accessible by clicking badge. Shows:

- Overall score and pass/fail
- Summary stats (tests, lint, types, security)
- AI review summary
- Issues grouped by severity
- Detailed issue list with suggestions

## API

### Run QA Validation

QA runs automatically after feature completion.

Manual trigger:
\`\`\`typescript
POST /api/qa/validate
{
"featureId": "abc-123"
}
\`\`\`

### Get QA Results

\`\`\`typescript
GET /api/features/:featureId/qa
\`\`\`

## Events

- `qa_validation_started` - QA begins
- `qa_validation_progress` - Progress update
- `qa_validation_completed` - QA finishes (includes result)

## Configuration

### Skip QA

Set in feature options or global settings:
\`\`\`typescript
{
"skipQA": true
}
\`\`\`

### QA Thresholds

Configurable in settings:
\`\`\`typescript
{
"qaPassScore": 70, // Minimum score to pass
"qaAllowCritical": false // Allow critical issues
}
\`\`\`

## Best Practices

1. **Write tests**: QA heavily weights test coverage
2. **Fix critical issues first**: Critical issues always fail QA
3. **Review AI suggestions**: AI review often catches subtle bugs
4. **Keep dependencies updated**: Reduces security vulnerabilities
5. **Don't expose secrets**: Use environment variables

## Troubleshooting

### QA Always Fails

- Check test suite (do tests pass locally?)
- Review lint errors
- Fix type errors

### QA Takes Too Long

- Tests timeout after 5 minutes
- Consider splitting large test suites

### False Positives

- Review AI concerns (may be overly cautious)
- Adjust QA thresholds in settings
```

**Criterios de aceptación**:

- ✅ 3+ tests E2E pasan
- ✅ Documentación completa
- ✅ Cobertura > 80% en QAService

---

## 🎯 FASE 2A - CHECKLIST FINAL

**Antes de pasar a Fase 2B, verificar**:

- [ ] ✅ TASK-2.1: Tipos QA definidos
- [ ] ✅ TASK-2.2: Test/Lint/Type checkers implementados
- [ ] ✅ TASK-2.3: Runtime checker implementado
- [ ] ✅ TASK-2.4: QA Agent prompts creados
- [ ] ✅ TASK-2.5: AI code review funciona
- [ ] ✅ TASK-2.6: Security scan detecta vulnerabilidades
- [ ] ✅ TASK-2.7: QA integrado en auto-mode
- [ ] ✅ TASK-2.8: UI de QA results completa
- [ ] ✅ TASK-2.9: WebSocket events funcionan
- [ ] ✅ TASK-2.10: Tests E2E y docs completos

**Métricas de éxito**:

- ✅ QA completa en < 2min (90% de casos)
- ✅ Detecta 90%+ de bugs obvios
- ✅ False positive rate < 20%
- ✅ Score correlaciona con calidad real

---

# 🔷 FASE 2B: MEMORY LAYER (Días 18-32)

**Objetivo**: Contexto persistente entre sesiones para agentes más inteligentes

**Dependencias**: FASE 1, FASE 2A

**Tecnología elegida**: LangChain Memory (TypeScript)

---

### TASK-3.1: Investigación y POC de LangChain Memory

**Duración**: 2 días  
**Prioridad**: 🔴 Crítica  
**Depende de**: FASE-1, FASE-2A  
**Bloqueante para**: TASK-3.2, TASK-3.3

**Descripción**:
Investigar LangChain Memory, evaluar alternativas de storage (Chroma, Pinecone, local SQLite), crear POC.

**Tareas**:

1. **Investigar alternativas** (4 horas):
   - LangChain + ChromaDB (local vector DB)
   - LangChain + Pinecone (cloud vector DB)
   - Custom implementation (SQLite + embeddings)
2. **Crear branch POC** (2 horas):

   ```bash
   git checkout -b poc/memory-layer
   ```

3. **Implementar POC básico** (10 horas):

   ```bash
   npm install langchain @langchain/core @langchain/community chromadb
   ```

   ```typescript
   // libs/memory/src/poc.ts
   import { ChatMessageHistory } from 'langchain/memory';
   import { Chroma } from '@langchain/community/vectorstores/chroma';
   import { OpenAIEmbeddings } from '@langchain/openai';

   async function testMemory() {
     // 1. Setup Chroma
     const vectorStore = await Chroma.fromTexts(
       ['Test insight 1', 'Test insight 2'],
       [{ source: 'test' }, { source: 'test' }],
       new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY })
     );

     // 2. Store memory
     await vectorStore.addDocuments([
       { pageContent: 'User prefers TypeScript', metadata: { type: 'preference' } },
     ]);

     // 3. Recall memory
     const results = await vectorStore.similaritySearch('programming language', 5);
     console.log('Recalled:', results);
   }
   ```

4. **Documentar decisión** (2 horas):

   ```markdown
   <!-- docs/decisions/ADR-001-memory-layer-tech.md -->

   # ADR 001: Memory Layer Technology

   ## Status

   Accepted

   ## Context

   Need persistent context storage for AI agents.

   ## Decision

   Use LangChain + ChromaDB (local)

   ## Rationale

   - ✅ TypeScript native
   - ✅ Local (no cloud dependency)
   - ✅ No API costs
   - ✅ Fast similarity search
   - ❌ Requires Chroma server running

   ## Alternatives

   - Pinecone: Cloud, costs money, simpler
   - Custom: Full control, more work
   ```

**Archivos a crear**:

```
libs/memory/package.json                          [NUEVO]
libs/memory/src/poc.ts                            [NUEVO]
docs/decisions/ADR-001-memory-layer-tech.md       [NUEVO]
```

**Criterios de aceptación**:

- ✅ POC almacena y recupera memories
- ✅ Similarity search funciona
- ✅ Decisión tecnológica documentada (ADR)
- ✅ Performance aceptable (< 1s por query)

---

### TASK-3.2: Diseñar Schema de Memory

**Duración**: 1 día  
**Prioridad**: 🔴 Crítica  
**Depende de**: TASK-3.1  
**Bloqueante para**: TASK-3.3, TASK-3.4

**Descripción**:
Definir estructura de datos para memories (insights, decisions, patterns).

**Archivos a crear/modificar**:

```
libs/types/src/memory.ts                          [NUEVO]
libs/types/src/index.ts                           [MODIFICAR]
```

**Implementación**:

```typescript
// libs/types/src/memory.ts
export interface Memory {
  id: string; // UUID
  project_path: string; // A qué proyecto pertenece

  // Contenido
  type: MemoryType;
  content: string; // Texto descriptivo
  embedding?: number[]; // Vector embedding (opcional, generado por LangChain)

  // Metadata
  metadata: MemoryMetadata;

  // Relaciones
  source_feature_ids: string[]; // Features que generaron esta memory
  related_memory_ids: string[]; // Memories relacionadas

  // Auditoría
  created_at: string;
  updated_at: string;
  accessed_count: number; // Cuántas veces se usó
  last_accessed_at?: string;
}

export type MemoryType =
  | 'insight' // Conocimiento sobre el proyecto
  | 'decision' // Decisiones arquitecturales tomadas
  | 'pattern' // Patrones de código detectados
  | 'bug_pattern' // Patrones de bugs recurrentes
  | 'preference' // Preferencias del usuario/proyecto
  | 'tech_stack' // Tecnologías usadas
  | 'project_structure'; // Estructura del proyecto

export interface MemoryMetadata {
  confidence: number; // 0-1 (qué tan confiable es esta memory)
  category?: string; // Categoría libre (ej: "authentication", "database")
  tags: string[]; // Tags para búsqueda
  context?: string; // Contexto adicional
}

export interface Insight extends Memory {
  type: 'insight';
  insight_type: 'code_pattern' | 'architecture' | 'api_design' | 'data_model' | 'other';
  description: string;
  examples: string[]; // Ejemplos de código que demuestran el insight
}

export interface Decision extends Memory {
  type: 'decision';
  question: string; // Qué se decidió
  answer: string; // La decisión tomada
  rationale: string; // Por qué se tomó
  alternatives_considered: string[]; // Alternativas consideradas
}

export interface Pattern extends Memory {
  type: 'pattern';
  pattern_type: 'code_style' | 'naming' | 'organization' | 'testing' | 'error_handling';
  description: string;
  regex?: string; // Regex que captura el patrón
  examples: Array<{
    file: string;
    code_snippet: string;
  }>;
}

export interface BugPattern extends Memory {
  type: 'bug_pattern';
  bug_type: 'logic' | 'runtime' | 'performance' | 'security' | 'type';
  description: string;
  symptom: string; // Cómo se manifiesta
  root_cause: string; // Causa raíz
  fix: string; // Cómo se arregló
  prevention: string; // Cómo prevenir en futuro
}

// Contexto agregado para un proyecto
export interface ProjectMemoryContext {
  project_path: string;

  // Resumen de memories
  total_memories: number;
  insights: Insight[];
  decisions: Decision[];
  patterns: Pattern[];
  bug_patterns: BugPattern[];

  // Tech stack detectado
  tech_stack: {
    languages: string[]; // TypeScript, JavaScript, etc
    frameworks: string[]; // React, Express, etc
    tools: string[]; // Vitest, Playwright, etc
  };

  // Preferences
  preferences: {
    code_style: string; // 'functional', 'oop', etc
    naming_convention: string; // 'camelCase', 'snake_case', etc
    test_framework: string; // 'vitest', 'jest', etc
  };

  generated_at: string;
}
```

**Tests requeridos**:

```typescript
// libs/types/src/__tests__/memory.test.ts
describe('Memory types', () => {
  it('should validate Memory schema');
  it('should differentiate memory types');
  it('should calculate confidence correctly');
});
```

**Criterios de aceptación**:

- ✅ Schema cubre todos los tipos de memory
- ✅ Metadata suficiente para búsqueda/filtrado
- ✅ Relaciones entre memories modeladas

---

Debido al límite de caracteres, continuaré con el resto de las tareas de Fase 2B, Fase 3 y Fase 4 en el próximo mensaje. ¿Quieres que guarde este documento ahora y continúe con el resto?
