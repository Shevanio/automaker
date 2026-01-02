# 🚀 PLAN DE IMPLEMENTACIÓN - FASES 2B-4 (FINAL)

**Fecha de creación**: 2026-01-02  
**Duración estimada**: 30 días (continuación)  
**Versión**: 1.0

> **NOTA**: Este documento continúa desde `IMPLEMENTATION_ROADMAP_PHASE2_4.md` (TASK-3.2).
> Completa TASK-3.1 y TASK-3.2 antes de continuar.

---

## 📋 ÍNDICE

1. [FASE 2B: Memory Layer (continuación desde TASK-3.3)](#fase-2b-memory-layer-continuación)
2. [FASE 3: AI Auto-Merge Agresivo](#fase-3-ai-auto-merge-agresivo-días-33-42)
3. [FASE 4: Visual Workflow Editor](#fase-4-visual-workflow-editor-días-43-62)
4. [Resumen Final y Métricas](#resumen-final-y-métricas)

---

## 🔷 FASE 2B: MEMORY LAYER (Continuación)

**Continuamos desde TASK-3.2 (ya completada)**

---

### TASK-3.3: Crear paquete @automaker/memory

**Duración**: 0.5 días  
**Prioridad**: 🔴 Crítica  
**Depende de**: TASK-3.2  
**Bloqueante para**: TASK-3.4

**Descripción**:
Crear estructura del paquete compartido para memory layer.

**Archivos a crear**:

```
libs/memory/package.json                          [NUEVO]
libs/memory/tsconfig.json                         [NUEVO]
libs/memory/src/index.ts                          [NUEVO]
libs/memory/README.md                             [NUEVO]
```

**Implementación**:

```json
// libs/memory/package.json
{
  "name": "@automaker/memory",
  "version": "1.0.0",
  "description": "Memory layer for persistent AI context",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest"
  },
  "dependencies": {
    "@automaker/types": "^1.0.0",
    "@automaker/utils": "^1.0.0",
    "langchain": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "@langchain/community": "^0.3.0",
    "chromadb": "^1.8.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^4.0.16"
  }
}
```

```json
// libs/memory/tsconfig.json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../types" }, { "path": "../utils" }]
}
```

```typescript
// libs/memory/src/index.ts
export * from './memory-service';
export * from './vector-store';
export * from './memory-builder';
```

```markdown
<!-- libs/memory/README.md -->

# @automaker/memory

Memory layer for Automaker - provides persistent context storage for AI agents.

## Features

- Store insights, decisions, patterns, and bug patterns
- Vector similarity search for context retrieval
- Project-specific memory isolation
- LangChain integration

## Usage

\`\`\`typescript
import { MemoryService } from '@automaker/memory';

const memoryService = new MemoryService();

// Store insight
await memoryService.storeInsight(projectPath, {
type: 'insight',
content: 'Project uses React with TypeScript',
metadata: { confidence: 0.95, tags: ['tech-stack'] }
});

// Recall relevant memories
const memories = await memoryService.recall(projectPath, 'how to add components');
\`\`\`
```

**Comandos de setup**:

```bash
cd libs/memory
npm install
npm run build
```

**Criterios de aceptación**:

- ✅ Paquete compila sin errores
- ✅ Dependencias instaladas correctamente
- ✅ Puede ser importado por otros paquetes

---

### TASK-3.4: Implementar MemoryService

**Duración**: 2 días  
**Prioridad**: 🔴 Crítica  
**Depende de**: TASK-3.3  
**Bloqueante para**: TASK-3.5

**Descripción**:
Service principal para almacenar y recuperar memories usando ChromaDB.

**Archivos a crear**:

```
libs/memory/src/memory-service.ts                 [NUEVO]
libs/memory/src/vector-store.ts                   [NUEVO]
libs/memory/src/embedding-provider.ts             [NUEVO]
```

**Implementación**:

```typescript
// libs/memory/src/embedding-provider.ts
import { Embeddings } from '@langchain/core/embeddings';

/**
 * Custom embedding provider usando Claude (gratis vs OpenAI)
 * Alternativa: usar OpenAIEmbeddings si el usuario tiene API key
 */
export class ClaudeEmbeddingProvider extends Embeddings {
  // Por ahora, usar embeddings simple basado en keywords
  // TODO: Migrar a embeddings reales cuando estén disponibles

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.createSimpleEmbedding(text));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.createSimpleEmbedding(text);
  }

  private createSimpleEmbedding(text: string): number[] {
    // Embedding simple: contar frecuencia de palabras clave
    const keywords = [
      'react',
      'typescript',
      'node',
      'express',
      'api',
      'database',
      'authentication',
      'test',
      'component',
      'service',
      'bug',
      'performance',
    ];

    const vector = new Array(128).fill(0);
    const lowerText = text.toLowerCase();

    keywords.forEach((keyword, idx) => {
      const count = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      vector[idx] = count / text.length; // Normalizado
    });

    // Agregar hash del texto para diferenciación
    const hash = this.simpleHash(text);
    for (let i = keywords.length; i < 128; i++) {
      vector[i] = ((hash >> i) & 1) * 0.1;
    }

    return vector;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
```

```typescript
// libs/memory/src/vector-store.ts
import { ChromaClient, Collection } from 'chromadb';
import { Memory } from '@automaker/types';
import { ClaudeEmbeddingProvider } from './embedding-provider';

export class VectorStore {
  private client: ChromaClient;
  private collections: Map<string, Collection> = new Map();
  private embedder: ClaudeEmbeddingProvider;

  constructor() {
    // ChromaDB debe estar corriendo en localhost:8000
    this.client = new ChromaClient({ path: 'http://localhost:8000' });
    this.embedder = new ClaudeEmbeddingProvider();
  }

  /**
   * Obtiene o crea una collection para un proyecto
   */
  private async getCollection(projectPath: string): Promise<Collection> {
    const collectionName = this.sanitizeCollectionName(projectPath);

    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName)!;
    }

    try {
      const collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: { project_path: projectPath },
      });

      this.collections.set(collectionName, collection);
      return collection;
    } catch (error) {
      throw new Error(`Failed to get/create collection: ${error.message}`);
    }
  }

  /**
   * Almacena una memory
   */
  async store(memory: Memory): Promise<void> {
    const collection = await this.getCollection(memory.project_path);

    // Generar embedding si no existe
    if (!memory.embedding) {
      memory.embedding = await this.embedder.embedQuery(memory.content);
    }

    await collection.add({
      ids: [memory.id],
      embeddings: [memory.embedding],
      documents: [memory.content],
      metadatas: [
        {
          type: memory.type,
          project_path: memory.project_path,
          created_at: memory.created_at,
          confidence: memory.metadata.confidence,
          tags: JSON.stringify(memory.metadata.tags),
        },
      ],
    });
  }

  /**
   * Busca memories similares
   */
  async search(
    projectPath: string,
    query: string,
    limit: number = 10,
    filter?: { type?: string; tags?: string[] }
  ): Promise<Memory[]> {
    const collection = await this.getCollection(projectPath);

    // Generar embedding del query
    const queryEmbedding = await this.embedder.embedQuery(query);

    // Construir filtro de metadata
    const where: any = {};
    if (filter?.type) {
      where.type = filter.type;
    }

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: Object.keys(where).length > 0 ? where : undefined,
    });

    // Convertir resultados a Memory objects
    const memories: Memory[] = [];

    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i];
        const content = results.documents?.[0]?.[i] || '';
        const metadata = results.metadatas?.[0]?.[i];

        if (metadata) {
          memories.push({
            id,
            project_path: projectPath,
            type: metadata.type as any,
            content,
            embedding: queryEmbedding,
            metadata: {
              confidence: metadata.confidence,
              tags: JSON.parse(metadata.tags || '[]'),
            },
            source_feature_ids: [],
            related_memory_ids: [],
            created_at: metadata.created_at,
            updated_at: metadata.created_at,
            accessed_count: 0,
          });
        }
      }
    }

    return memories;
  }

  /**
   * Elimina memories de un proyecto
   */
  async deleteProject(projectPath: string): Promise<void> {
    const collectionName = this.sanitizeCollectionName(projectPath);

    try {
      await this.client.deleteCollection({ name: collectionName });
      this.collections.delete(collectionName);
    } catch (error) {
      // Collection no existe, ignorar
    }
  }

  private sanitizeCollectionName(projectPath: string): string {
    // ChromaDB requiere nombres alfanuméricos con guiones/underscores
    return projectPath
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }
}
```

```typescript
// libs/memory/src/memory-service.ts
import { v4 as uuid } from 'uuid';
import {
  Memory,
  Insight,
  Decision,
  Pattern,
  BugPattern,
  ProjectMemoryContext,
} from '@automaker/types';
import { createLogger } from '@automaker/utils';
import { VectorStore } from './vector-store';

const logger = createLogger('MemoryService');

export class MemoryService {
  private vectorStore: VectorStore;

  constructor() {
    this.vectorStore = new VectorStore();
  }

  /**
   * Almacena un insight
   */
  async storeInsight(
    projectPath: string,
    insight: Omit<Insight, 'id' | 'project_path' | 'created_at' | 'updated_at' | 'accessed_count'>
  ): Promise<Insight> {
    const memory: Insight = {
      ...insight,
      id: uuid(),
      project_path: projectPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accessed_count: 0,
      source_feature_ids: insight.source_feature_ids || [],
      related_memory_ids: insight.related_memory_ids || [],
    };

    await this.vectorStore.store(memory);
    logger.info(`Stored insight: ${memory.content.substring(0, 50)}...`);

    return memory;
  }

  /**
   * Almacena una decisión
   */
  async storeDecision(
    projectPath: string,
    decision: Omit<Decision, 'id' | 'project_path' | 'created_at' | 'updated_at' | 'accessed_count'>
  ): Promise<Decision> {
    const memory: Decision = {
      ...decision,
      id: uuid(),
      project_path: projectPath,
      content: `${decision.question} → ${decision.answer}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accessed_count: 0,
      source_feature_ids: decision.source_feature_ids || [],
      related_memory_ids: decision.related_memory_ids || [],
    };

    await this.vectorStore.store(memory);
    logger.info(`Stored decision: ${decision.question}`);

    return memory;
  }

  /**
   * Almacena un patrón
   */
  async storePattern(
    projectPath: string,
    pattern: Omit<Pattern, 'id' | 'project_path' | 'created_at' | 'updated_at' | 'accessed_count'>
  ): Promise<Pattern> {
    const memory: Pattern = {
      ...pattern,
      id: uuid(),
      project_path: projectPath,
      content: pattern.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accessed_count: 0,
      source_feature_ids: pattern.source_feature_ids || [],
      related_memory_ids: pattern.related_memory_ids || [],
    };

    await this.vectorStore.store(memory);
    logger.info(`Stored pattern: ${pattern.pattern_type}`);

    return memory;
  }

  /**
   * Almacena un bug pattern
   */
  async storeBugPattern(
    projectPath: string,
    bugPattern: Omit<
      BugPattern,
      'id' | 'project_path' | 'created_at' | 'updated_at' | 'accessed_count'
    >
  ): Promise<BugPattern> {
    const memory: BugPattern = {
      ...bugPattern,
      id: uuid(),
      project_path: projectPath,
      content: `${bugPattern.description}. Fix: ${bugPattern.fix}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      accessed_count: 0,
      source_feature_ids: bugPattern.source_feature_ids || [],
      related_memory_ids: bugPattern.related_memory_ids || [],
    };

    await this.vectorStore.store(memory);
    logger.info(`Stored bug pattern: ${bugPattern.bug_type}`);

    return memory;
  }

  /**
   * Recupera memories relevantes para un query
   */
  async recall(
    projectPath: string,
    query: string,
    options?: {
      limit?: number;
      type?: string;
      tags?: string[];
    }
  ): Promise<Memory[]> {
    logger.info(`Recalling memories for: ${query.substring(0, 50)}...`);

    const memories = await this.vectorStore.search(projectPath, query, options?.limit || 10, {
      type: options?.type,
      tags: options?.tags,
    });

    // Incrementar accessed_count (TODO: persistir esto)
    memories.forEach((m) => m.accessed_count++);

    return memories;
  }

  /**
   * Obtiene contexto completo de un proyecto
   */
  async getProjectContext(projectPath: string): Promise<ProjectMemoryContext> {
    // Obtener todas las memories del proyecto (limit alto)
    const allMemories = await this.vectorStore.search(projectPath, '', 1000);

    // Separar por tipo
    const insights = allMemories.filter((m) => m.type === 'insight') as Insight[];
    const decisions = allMemories.filter((m) => m.type === 'decision') as Decision[];
    const patterns = allMemories.filter((m) => m.type === 'pattern') as Pattern[];
    const bugPatterns = allMemories.filter((m) => m.type === 'bug_pattern') as BugPattern[];

    // Detectar tech stack
    const techStack = this.detectTechStack(insights);

    // Detectar preferences
    const preferences = this.detectPreferences(patterns);

    return {
      project_path: projectPath,
      total_memories: allMemories.length,
      insights,
      decisions,
      patterns,
      bug_patterns: bugPatterns,
      tech_stack: techStack,
      preferences,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Genera contexto como texto para incluir en prompts
   */
  async getContextAsPrompt(projectPath: string, maxLength: number = 2000): Promise<string> {
    const context = await this.getProjectContext(projectPath);

    let prompt = '# Project Memory Context\n\n';

    // Tech Stack
    if (context.tech_stack.languages.length > 0) {
      prompt += `## Tech Stack\n`;
      prompt += `Languages: ${context.tech_stack.languages.join(', ')}\n`;
      prompt += `Frameworks: ${context.tech_stack.frameworks.join(', ')}\n`;
      prompt += `Tools: ${context.tech_stack.tools.join(', ')}\n\n`;
    }

    // Top Insights (max 5)
    if (context.insights.length > 0) {
      prompt += `## Key Insights\n`;
      context.insights.slice(0, 5).forEach((insight) => {
        prompt += `- ${insight.description}\n`;
      });
      prompt += '\n';
    }

    // Recent Decisions (max 3)
    if (context.decisions.length > 0) {
      prompt += `## Recent Decisions\n`;
      context.decisions.slice(0, 3).forEach((decision) => {
        prompt += `- ${decision.question}: ${decision.answer}\n`;
      });
      prompt += '\n';
    }

    // Bug Patterns (max 3)
    if (context.bug_patterns.length > 0) {
      prompt += `## Known Bug Patterns\n`;
      context.bug_patterns.slice(0, 3).forEach((pattern) => {
        prompt += `- ${pattern.description} → ${pattern.fix}\n`;
      });
      prompt += '\n';
    }

    // Truncar si es muy largo
    if (prompt.length > maxLength) {
      prompt = prompt.substring(0, maxLength) + '\n... (truncated)';
    }

    return prompt;
  }

  /**
   * Elimina todas las memories de un proyecto
   */
  async clearProject(projectPath: string): Promise<void> {
    await this.vectorStore.deleteProject(projectPath);
    logger.info(`Cleared all memories for project: ${projectPath}`);
  }

  private detectTechStack(insights: Insight[]): ProjectMemoryContext['tech_stack'] {
    const languages = new Set<string>();
    const frameworks = new Set<string>();
    const tools = new Set<string>();

    insights.forEach((insight) => {
      const content = insight.content.toLowerCase();

      // Languages
      if (content.includes('typescript')) languages.add('TypeScript');
      if (content.includes('javascript')) languages.add('JavaScript');
      if (content.includes('python')) languages.add('Python');

      // Frameworks
      if (content.includes('react')) frameworks.add('React');
      if (content.includes('express')) frameworks.add('Express');
      if (content.includes('vue')) frameworks.add('Vue');

      // Tools
      if (content.includes('vitest')) tools.add('Vitest');
      if (content.includes('playwright')) tools.add('Playwright');
      if (content.includes('vite')) tools.add('Vite');
    });

    return {
      languages: Array.from(languages),
      frameworks: Array.from(frameworks),
      tools: Array.from(tools),
    };
  }

  private detectPreferences(patterns: Pattern[]): ProjectMemoryContext['preferences'] {
    // Defaults
    const preferences = {
      code_style: 'functional',
      naming_convention: 'camelCase',
      test_framework: 'vitest',
    };

    patterns.forEach((pattern) => {
      const content = pattern.content.toLowerCase();

      if (content.includes('class') && content.includes('extends')) {
        preferences.code_style = 'oop';
      }

      if (content.includes('snake_case')) {
        preferences.naming_convention = 'snake_case';
      }

      if (content.includes('jest')) {
        preferences.test_framework = 'jest';
      }
    });

    return preferences;
  }
}
```

**Tests requeridos**:

```typescript
// libs/memory/src/__tests__/memory-service.test.ts
describe('MemoryService', () => {
  let service: MemoryService;
  const testProject = '/tmp/test-project';

  beforeEach(() => {
    service = new MemoryService();
  });

  afterEach(async () => {
    await service.clearProject(testProject);
  });

  describe('storeInsight', () => {
    it('should store insight and return with id');
    it('should be searchable after storage');
  });

  describe('recall', () => {
    it('should return relevant memories for query');
    it('should respect limit parameter');
    it('should filter by type');
  });

  describe('getProjectContext', () => {
    it('should aggregate all memory types');
    it('should detect tech stack from insights');
  });

  describe('getContextAsPrompt', () => {
    it('should generate formatted prompt text');
    it('should truncate if exceeds max length');
  });
});
```

**Setup de ChromaDB**:

```bash
# Instalar ChromaDB server
pip install chromadb

# Ejecutar server
chroma run --path ./data/chroma --host localhost --port 8000
```

**Criterios de aceptación**:

- ✅ Memories almacenadas y recuperables
- ✅ Similarity search funciona
- ✅ Tests pasan (80%+ coverage)
- ✅ ChromaDB se conecta correctamente

---

### TASK-3.5: Memory Builder - Extracción Automática

**Duración**: 2 días  
**Prioridad**: 🟡 Alta  
**Depende de**: TASK-3.4  
**Bloqueante para**: TASK-3.6

**Descripción**:
Service que extrae automáticamente memories desde features completadas y resultados de QA.

**Archivos a crear**:

```
libs/memory/src/memory-builder.ts                 [NUEVO]
```

**Implementación**:

````typescript
// libs/memory/src/memory-builder.ts
import { Feature, QAValidation, Insight, Decision, BugPattern } from '@automaker/types';
import { MemoryService } from './memory-service';
import { ClaudeProvider } from '@automaker/server/providers/claude-provider'; // Importar desde server
import { createLogger } from '@automaker/utils';

const logger = createLogger('MemoryBuilder');

export class MemoryBuilder {
  constructor(
    private memoryService: MemoryService,
    private claudeProvider: ClaudeProvider
  ) {}

  /**
   * Extrae memories de una feature completada
   */
  async extractFromFeature(feature: Feature): Promise<void> {
    logger.info(`Extracting memories from feature ${feature.id}`);

    try {
      // 1. Extraer insights via AI
      const insights = await this.extractInsightsWithAI(feature);
      for (const insight of insights) {
        await this.memoryService.storeInsight(feature.project_path, insight);
      }

      // 2. Extraer decisiones si hay spec
      if (feature.spec) {
        const decisions = await this.extractDecisionsFromSpec(feature);
        for (const decision of decisions) {
          await this.memoryService.storeDecision(feature.project_path, decision);
        }
      }

      // 3. Extraer bug patterns si QA encontró issues
      if (feature.qa_validation) {
        const bugPatterns = await this.extractBugPatternsFromQA(feature);
        for (const pattern of bugPatterns) {
          await this.memoryService.storeBugPattern(feature.project_path, pattern);
        }
      }

      logger.info(`Extracted memories for feature ${feature.id}`);
    } catch (error) {
      logger.error(`Failed to extract memories from feature ${feature.id}:`, error);
    }
  }

  /**
   * Usa Claude para extraer insights de la feature
   */
  private async extractInsightsWithAI(feature: Feature): Promise<Partial<Insight>[]> {
    const prompt = `
Analyze this completed software feature and extract key insights about the project.

Feature Title: ${feature.title}
Description: ${feature.description}

${feature.spec ? `Steps completed:\n${feature.spec.steps.map((s) => `- ${s.title}`).join('\n')}` : ''}

Extract 2-5 insights about:
1. Project architecture patterns
2. Tech stack and tools used
3. Code organization principles
4. API design patterns
5. Data models

Return ONLY valid JSON array:
[
  {
    "insight_type": "architecture" | "code_pattern" | "api_design" | "data_model",
    "description": "Clear description of the insight",
    "examples": ["example code snippet if applicable"],
    "metadata": {
      "confidence": 0.0-1.0,
      "tags": ["tag1", "tag2"]
    }
  }
]
`;

    const response = await this.claudeProvider.sendMessage({
      sessionId: `memory-extract-${feature.id}`,
      message: prompt,
      model: 'claude-haiku-4-5', // Usar Haiku para velocidad
      systemPrompt:
        'You are an expert at analyzing software projects and extracting architectural insights.',
      temperature: 0.3,
    });

    try {
      const insights = JSON.parse(this.extractJSON(response));

      return insights.map((i: any) => ({
        type: 'insight',
        insight_type: i.insight_type,
        description: i.description,
        examples: i.examples || [],
        content: i.description,
        metadata: {
          confidence: i.metadata.confidence,
          tags: i.metadata.tags,
        },
        source_feature_ids: [feature.id],
        related_memory_ids: [],
      }));
    } catch (error) {
      logger.warn('Failed to parse insights from AI response');
      return [];
    }
  }

  /**
   * Extrae decisiones de un spec
   */
  private async extractDecisionsFromSpec(feature: Feature): Promise<Partial<Decision>[]> {
    const decisions: Partial<Decision>[] = [];

    if (!feature.spec) return decisions;

    // Cada step completado puede representar una decisión
    for (const step of feature.spec.steps) {
      if (step.status === 'completed' && step.description.length > 50) {
        decisions.push({
          type: 'decision',
          question: step.title,
          answer: `Implemented as: ${step.description}`,
          rationale: `Part of ${feature.title}`,
          alternatives_considered: [],
          content: `${step.title}: ${step.description}`,
          metadata: {
            confidence: 0.8,
            tags: ['implementation', 'spec'],
          },
          source_feature_ids: [feature.id],
          related_memory_ids: [],
        });
      }
    }

    return decisions;
  }

  /**
   * Extrae bug patterns de resultados QA
   */
  private async extractBugPatternsFromQA(feature: Feature): Promise<Partial<BugPattern>[]> {
    const patterns: Partial<BugPattern>[] = [];

    if (!feature.qa_validation) return patterns;

    const qa = feature.qa_validation;

    // Si QA falló, analizar issues para extraer bug patterns
    if (!qa.passes && qa.issues.length > 0) {
      const criticalIssues = qa.issues.filter(
        (i) => i.severity === 'critical' || i.severity === 'error'
      );

      for (const issue of criticalIssues) {
        patterns.push({
          type: 'bug_pattern',
          bug_type: this.mapIssueToBugType(issue.category),
          description: issue.message,
          symptom: `${issue.category} issue in ${issue.file}`,
          root_cause: issue.message,
          fix: issue.suggestion || 'Manual review required',
          prevention: 'Add validation in future features',
          content: issue.message,
          metadata: {
            confidence: 0.7,
            tags: ['qa', issue.category],
          },
          source_feature_ids: [feature.id],
          related_memory_ids: [],
        });
      }
    }

    return patterns;
  }

  private mapIssueToBugType(category: string): BugPattern['bug_type'] {
    const map: Record<string, BugPattern['bug_type']> = {
      test: 'logic',
      runtime: 'runtime',
      security: 'security',
      type: 'type',
      ai_review: 'logic',
    };

    return map[category] || 'logic';
  }

  private extractJSON(text: string): string {
    const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\[[\s\S]*\]/);
    if (match) return match[1] || match[0];
    throw new Error('No JSON found in response');
  }
}
````

**Tests requeridos**:

```typescript
// libs/memory/src/__tests__/memory-builder.test.ts
describe('MemoryBuilder', () => {
  it('should extract insights from feature');
  it('should extract decisions from spec steps');
  it('should extract bug patterns from QA issues');
  it('should handle features without spec');
  it('should handle features without QA results');
});
```

**Criterios de aceptación**:

- ✅ Insights extraídos automáticamente
- ✅ Decisions generadas desde spec steps
- ✅ Bug patterns detectados desde QA issues
- ✅ AI parsing robusto con fallback

---

### TASK-3.6: Integración con AgentService

**Duración**: 1 día  
**Prioridad**: 🔴 Crítica  
**Depende de**: TASK-3.5  
**Bloqueante para**: TASK-3.7

**Descripción**:
Inyectar contexto de memoria en prompts de agentes.

**Archivos a modificar**:

```
apps/server/src/services/agent-service.ts         [MODIFICAR]
apps/server/src/services/auto-mode-service.ts     [MODIFICAR]
```

**Implementación**:

```typescript
// apps/server/src/services/agent-service.ts (MODIFICAR)
import { MemoryService } from '@automaker/memory';

export class AgentService {
  private memoryService: MemoryService;

  constructor(/* ... */) {
    // ... inicialización existente
    this.memoryService = new MemoryService();
  }

  async executeFeature(feature: Feature, options: ExecuteOptions): Promise<void> {
    // Obtener contexto de memoria ANTES de ejecutar
    const memoryContext = await this.memoryService.getContextAsPrompt(
      feature.project_path,
      2000 // Max 2000 chars
    );

    // Agregar memoria al prompt
    const enhancedPrompt = this.buildPromptWithMemory(feature, memoryContext);

    // Ejecutar con prompt mejorado
    if (feature.spec) {
      return this.executeWithSpec(feature, options, enhancedPrompt);
    }

    return this.executeLegacy(feature, options, enhancedPrompt);
  }

  private buildPromptWithMemory(feature: Feature, memoryContext: string): string {
    return `
${memoryContext}

---

# Current Task

${feature.description}

${feature.spec ? `## Steps\n${feature.spec.steps.map((s) => `${s.order}. ${s.title}`).join('\n')}` : ''}

---

Important: Use the project memory context above to:
1. Follow established patterns and conventions
2. Avoid repeating past mistakes (bug patterns)
3. Make decisions consistent with previous choices
4. Use the detected tech stack appropriately
`;
  }

  private async executeWithSpec(
    feature: Feature,
    options: ExecuteOptions,
    prompt: string
  ): Promise<void> {
    // Similar al código existente, pero usar prompt con memoria
    for (const step of feature.spec!.steps) {
      const stepPrompt = `${prompt}\n\n## Current Step\n${step.description}`;
      await this.executeStep(feature, step, options, stepPrompt);
    }
  }
}
```

```typescript
// apps/server/src/services/auto-mode-service.ts (MODIFICAR)
import { MemoryBuilder } from '@automaker/memory';

export class AutoModeService {
  private memoryBuilder: MemoryBuilder;

  constructor(/* ... */) {
    // ... inicialización existente
    this.memoryBuilder = new MemoryBuilder(new MemoryService(), this.claudeProvider);
  }

  async completeFeature(feature: Feature): Promise<void> {
    // ... código existente de QA validation

    // NUEVO: Después de QA, extraer memories
    try {
      await this.memoryBuilder.extractFromFeature(feature);
      logger.info(`Extracted memories from feature ${feature.id}`);
    } catch (error) {
      logger.error('Failed to extract memories:', error);
      // No fallar feature por esto
    }

    // ... resto del código
  }
}
```

**Tests requeridos**:

```typescript
// apps/server/src/services/__tests__/agent-memory-integration.test.ts
describe('AgentService - Memory Integration', () => {
  it('should inject memory context into agent prompts');
  it('should execute features with memory context');
  it('should extract memories after feature completion');
});
```

**Criterios de aceptación**:

- ✅ Memoria inyectada en prompts
- ✅ Agentes usan contexto de memoria
- ✅ Memories extraídas después de cada feature
- ✅ No afecta performance (< 1s overhead)

---

### TASK-3.7: Frontend - Memory View

**Duración**: 1.5 días  
**Prioridad**: 🟡 Media  
**Depende de**: TASK-3.6  
**Bloqueante para**: -

**Descripción**:
UI para visualizar memories del proyecto.

**Archivos a crear**:

```
apps/ui/src/components/views/MemoryView.tsx       [NUEVO]
apps/ui/src/routes/memory.tsx                     [NUEVO]
```

**Implementación**:

```typescript
// apps/ui/src/components/views/MemoryView.tsx
import { useEffect, useState } from 'react';
import { ProjectMemoryContext, Memory } from '@automaker/types';
import { useHttpApiClient } from '@/lib/http-api-client';

export function MemoryView() {
  const client = useHttpApiClient();
  const [context, setContext] = useState<ProjectMemoryContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMemoryContext();
  }, []);

  const loadMemoryContext = async () => {
    try {
      const projectPath = localStorage.getItem('current-project');
      if (!projectPath) return;

      const ctx = await client.get(`/api/memory/${encodeURIComponent(projectPath)}`);
      setContext(ctx);
    } catch (error) {
      console.error('Failed to load memory context:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading project memory...</div>;
  }

  if (!context) {
    return <div className="p-8 text-center">No memory found for this project.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Project Memory</h1>
        <div className="text-sm text-muted-foreground">
          {context.total_memories} memories stored
        </div>
      </div>

      {/* Tech Stack */}
      <section className="p-4 bg-secondary rounded-lg">
        <h2 className="text-lg font-semibold mb-3">🔧 Tech Stack</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Languages</div>
            <div className="flex flex-wrap gap-1">
              {context.tech_stack.languages.map(lang => (
                <span key={lang} className="px-2 py-1 bg-background rounded text-sm">
                  {lang}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Frameworks</div>
            <div className="flex flex-wrap gap-1">
              {context.tech_stack.frameworks.map(fw => (
                <span key={fw} className="px-2 py-1 bg-background rounded text-sm">
                  {fw}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Tools</div>
            <div className="flex flex-wrap gap-1">
              {context.tech_stack.tools.map(tool => (
                <span key={tool} className="px-2 py-1 bg-background rounded text-sm">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Insights */}
      <section>
        <h2 className="text-lg font-semibold mb-3">💡 Key Insights</h2>
        <div className="space-y-2">
          {context.insights.slice(0, 10).map(insight => (
            <MemoryCard key={insight.id} memory={insight} icon="💡" />
          ))}
        </div>
      </section>

      {/* Decisions */}
      <section>
        <h2 className="text-lg font-semibold mb-3">🎯 Decisions Made</h2>
        <div className="space-y-2">
          {context.decisions.slice(0, 10).map(decision => (
            <DecisionCard key={decision.id} decision={decision} />
          ))}
        </div>
      </section>

      {/* Bug Patterns */}
      {context.bug_patterns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">🐛 Known Bug Patterns</h2>
          <div className="space-y-2">
            {context.bug_patterns.map(pattern => (
              <BugPatternCard key={pattern.id} pattern={pattern} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MemoryCard({ memory, icon }: { memory: Memory; icon: string }) {
  return (
    <div className="p-3 bg-secondary rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <p className="text-sm">{memory.content}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              Confidence: {Math.round(memory.metadata.confidence * 100)}%
            </span>
            {memory.metadata.tags.map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 bg-background rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <div className="p-3 bg-secondary rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-xl">🎯</span>
        <div className="flex-1">
          <div className="font-medium text-sm">{decision.question}</div>
          <div className="text-sm text-muted-foreground mt-1">→ {decision.answer}</div>
          {decision.rationale && (
            <div className="text-xs text-muted-foreground mt-1">
              Rationale: {decision.rationale}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BugPatternCard({ pattern }: { pattern: BugPattern }) {
  return (
    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
      <div className="flex items-start gap-2">
        <span className="text-xl">🐛</span>
        <div className="flex-1">
          <div className="font-medium text-sm">{pattern.description}</div>
          <div className="text-xs text-muted-foreground mt-1">
            <strong>Symptom:</strong> {pattern.symptom}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            <strong>Fix:</strong> {pattern.fix}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            <strong>Prevention:</strong> {pattern.prevention}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Backend API**:

```typescript
// apps/server/src/routes/memory/index.ts (NUEVO)
import { Router } from 'express';
import { MemoryService } from '@automaker/memory';

const router = Router();
const memoryService = new MemoryService();

// GET /api/memory/:projectPath
router.get('/:projectPath', async (req, res) => {
  try {
    const projectPath = decodeURIComponent(req.params.projectPath);
    const context = await memoryService.getProjectContext(projectPath);
    res.json(context);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/memory/:projectPath (clear all memories)
router.delete('/:projectPath', async (req, res) => {
  try {
    const projectPath = decodeURIComponent(req.params.projectPath);
    await memoryService.clearProject(projectPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Criterios de aceptación**:

- ✅ Vista Memory accesible desde sidebar
- ✅ Muestra insights, decisions, bug patterns
- ✅ Tech stack detectado visible
- ✅ API funciona correctamente

---

### TASK-3.8: Documentación y Tests E2E

**Duración**: 1 día  
**Prioridad**: 🟡 Media  
**Depende de**: TASK-3.7  
**Bloqueante para**: -

**Descripción**:
Documentar sistema de memoria y crear tests E2E.

**Archivos a crear**:

```
docs/MEMORY_LAYER.md                              [NUEVO]
apps/ui/tests/features/memory-layer.spec.ts       [NUEVO]
```

**Contenido en documento separado por brevedad**

**Criterios de aceptación**:

- ✅ Documentación completa
- ✅ Tests E2E pasan
- ✅ ChromaDB setup documentado

---

## 🎯 FASE 2B - CHECKLIST FINAL

- [ ] ✅ TASK-3.1: POC de LangChain + ChromaDB
- [ ] ✅ TASK-3.2: Schema de Memory diseñado
- [ ] ✅ TASK-3.3: Paquete @automaker/memory creado
- [ ] ✅ TASK-3.4: MemoryService implementado
- [ ] ✅ TASK-3.5: MemoryBuilder extrae memories
- [ ] ✅ TASK-3.6: Integración con AgentService
- [ ] ✅ TASK-3.7: Frontend Memory View
- [ ] ✅ TASK-3.8: Tests y documentación

**Métricas de éxito**:

- ✅ Memories almacenadas y recuperables
- ✅ Agentes usan contexto en 100% de ejecuciones
- ✅ Recall de memories en < 500ms
- ✅ Insights detectados en 80%+ de features

---

# 🔷 FASE 3: AI AUTO-MERGE AGRESIVO (Días 33-42)

**Objetivo**: Resolver conflictos de merge automáticamente con AI

**Dependencias**: FASE 1, FASE 2A, FASE 2B

---

### TASK-4.1: Diseñar Estrategia de Auto-Merge

**Duración**: 1 día  
**Prioridad**: 🔴 Crítica  
**Depende de**: FASE-2B  
**Bloqueante para**: TASK-4.2

**Descripción**:
Definir tipos, flujos y estrategias de merge.

**Archivos a crear**:

```
libs/types/src/merge.ts                           [NUEVO]
docs/decisions/ADR-002-auto-merge-strategy.md     [NUEVO]
```

**Implementación** (contenido completo en archivo separado por espacio)

---

### TASK-4.2-4.7: Implementación de Auto-Merge

(Detalles completos de implementación omitidos por límite de espacio)

**Resumen de subtareas**:

- TASK-4.2: Extender git-utils para merge ops (1 día)
- TASK-4.3: Conflict detection y parsing (1 día)
- TASK-4.4: AI conflict resolution prompt (0.5 días)
- TASK-4.5: MergeService implementation (2 días)
- TASK-4.6: Integración con UI (1.5 días)
- TASK-4.7: Safety features (dry-run, rollback) (1 día)
- TASK-4.8: Tests y docs (1 día)

**Tiempo total Fase 3**: 10 días

---

# 🔷 FASE 4: VISUAL WORKFLOW EDITOR (Días 43-62)

**Objetivo**: Drag & drop editor para crear workflows visualmente

**Dependencias**: FASE 1 (Spec System)

---

### TASK-5.1-5.10: Visual Workflow Editor

(Detalles completos omitidos por límite de espacio)

**Resumen de subtareas**:

- TASK-5.1: Diseño UI/UX mockups (1 día)
- TASK-5.2: Setup @xyflow/react avanzado (1 día)
- TASK-5.3: Draggable steps component (2 días)
- TASK-5.4: Visual dependency editor (2 días)
- TASK-5.5: Spec template library (1 día)
- TASK-5.6: Backend - workflow to spec conversion (2 días)
- TASK-5.7: Conditional steps (if/else) (3 días)
- TASK-5.8: Parallel execution paths (2 días)
- TASK-5.9: Import/Export workflows (1 día)
- TASK-5.10: Tests E2E y docs (2 días)

**Tiempo total Fase 4**: 20 días

---

# 📊 RESUMEN FINAL Y MÉTRICAS

## Cronograma Global Completo

```
FASE 1: Spec Runner                    ████████                  7 días
FASE 2A: QA Validation Full             ████████████             10 días
FASE 2B: Memory Layer                   ████████████████         15 días
FASE 3: AI Auto-Merge                   ████████████             10 días
FASE 4: Visual Workflow Editor          ████████████████████     20 días
─────────────────────────────────────────────────────────────────
TOTAL                                                             62 días
```

## Métricas de Éxito por Fase

### Fase 1: Spec Runner

- ✅ 100% features con spec ejecutan steps secuencialmente
- ✅ Resume desde failed step funciona
- ✅ UI actualizada en tiempo real

### Fase 2A: QA Validation

- ✅ 90% de bugs detectados antes de approval
- ✅ False positive rate < 20%
- ✅ QA completa en < 2min

### Fase 2B: Memory Layer

- ✅ Memories recuperables en < 500ms
- ✅ 80%+ features generan insights útiles
- ✅ Agentes usan contexto en 100% ejecuciones

### Fase 3: Auto-Merge

- ✅ 70%+ conflictos resueltos automáticamente
- ✅ 0 merges incorrectos en producción
- ✅ Rollback funciona en < 5s

### Fase 4: Visual Editor

- ✅ 50% usuarios usan visual editor vs texto
- ✅ Workflows creados en < 5min
- ✅ Export/import sin pérdida de data

## Riesgos Globales

| Riesgo                       | Probabilidad | Impacto | Mitigación                                        |
| ---------------------------- | ------------ | ------- | ------------------------------------------------- |
| ChromaDB performance issues  | Media        | Alto    | Cache + lazy loading                              |
| AI review demasiado lento    | Alta         | Medio   | Usar Haiku, timeout 60s                           |
| Auto-merge rompe código      | Alta         | Crítico | Feature flag OFF por defecto, dry-run obligatorio |
| Scope creep en Visual Editor | Alta         | Medio   | MVP primero, features avanzadas opcionales        |

## Dependencias Externas

1. **ChromaDB** (Memory Layer)
   - Requiere servidor corriendo
   - Setup: `chroma run --path ./data/chroma`

2. **Claude API** (todo)
   - Rate limits: 200 req/min
   - Mitigación: queue requests

3. **Git** (Auto-Merge)
   - Versión 2.30+ recomendada
   - Requiere git configurado

## Próximos Pasos Inmediatos

1. **Completar Fase 1** (Spec Runner) - Día 1-7
2. **Setup ChromaDB** para Fase 2B - Día 16
3. **Crear feature flags** para Fase 3 - Día 33
4. **Diseñar mockups** para Fase 4 - Día 43

## Conclusión

Este plan cubre **62 días de implementación** distribuidos en 4 fases:

1. ✅ **Spec Runner** (base sólida)
2. ✅ **QA + Memory** (inteligencia)
3. ✅ **Auto-Merge** (automatización)
4. ✅ **Visual Editor** (experiencia)

Cada fase es independiente pero se beneficia de las anteriores. El orden es estratégico: primero fundaciones (Spec), luego inteligencia (QA + Memory), automatización (Auto-Merge), y finalmente UX (Visual Editor).

**Seguimiento**: Crear issues en GitHub para cada TASK con etiquetas de fase.

---

**FIN DEL PLAN DE IMPLEMENTACIÓN**
