# TASK-0.1: Multi-Agent Spec Generation

**Estado**: 🚧 En Desarrollo  
**Duración estimada**: 3 días  
**Prioridad**: 🔴 Crítica  
**Fecha inicio**: 2026-01-02

---

## ✅ Progreso Actual

### Día 1 - Mañana ✅ COMPLETADO

- [x] **Tipos creados** (`libs/types/src/multi-agent-spec.ts`)
  - ✅ `AgentSpecialization`, `SpecializationAgent`
  - ✅ `AgentAnalysis`, `AgentTask`
  - ✅ `MultiAgentAnalysis`, `CombinedSpecStep`
  - ✅ `DEFAULT_AGENTS` (6 agentes especializados)
- [x] **Prompts creados** (`libs/prompts/src/multi-agent-spec.ts`)
  - ✅ `buildMultiAgentAnalysisPrompt` - Prompt para cada agente
  - ✅ `buildSpecCombinationPrompt` - Prompt para combinar análisis

- [x] **Paquetes compilados**
  - ✅ `npm run build:packages` ejecutado exitosamente

---

### Día 1 - Tarde 🚧 EN PROGRESO

- [ ] **Backend Service** (`apps/server/src/services/multi-agent-spec-service.ts`)
  - ⏸️ Servicio creado pero necesita adaptación
  - ❌ `ClaudeProvider.sendMessage()` no existe
  - ✅ Necesita usar `executeQuery()` con generadores

**BLOQUEADOR ACTUAL**:
El `ClaudeProvider` usa el patrón de generadores (`AsyncGenerator`) con el Claude Agent SDK.
Necesito adaptar el servicio para:

1. Usar `executeQuery()` en lugar de `sendMessage()`
2. Consumir el generator para obtener la respuesta completa
3. Extraer JSON de los chunks de respuesta

---

## 📝 Archivos Creados

```
libs/types/src/multi-agent-spec.ts           ✅ 340 líneas
libs/prompts/src/multi-agent-spec.ts         ✅ 120 líneas
apps/server/src/services/multi-agent-spec-service.ts  🚧 400 líneas (necesita fix)
docs/plans/TASK-0.1-MULTI-AGENT-SPEC.md      ✅ Este archivo
```

---

## 🔧 Siguiente Acción Inmediata

### Opción A: Adaptar a executeQuery (Recomendado)

Modificar `MultiAgentSpecService` para usar el patrón correcto:

```typescript
// ANTES (incorrecto)
const response = await this.claudeProvider.sendMessage({...});

// DESPUÉS (correcto)
const generator = this.claudeProvider.executeQuery({
  prompt: ...,
  model: ...,
  systemPrompt: ...,
  cwd: feature.worktreePath || feature.project_path
});

let fullResponse = '';
for await (const message of generator) {
  if (message.type === 'text') {
    fullResponse += message.text;
  }
}

const parsed = this.parseAgentResponse(fullResponse);
```

### Opción B: Crear helper method en ClaudeProvider

Agregar método `sendSimpleMessage()` en `ClaudeProvider` para llamadas no-streaming:

```typescript
// apps/server/src/providers/claude-provider.ts
async sendSimpleMessage(params: {
  prompt: string;
  model: string;
  systemPrompt: string;
  cwd?: string;
}): Promise<string> {
  const generator = this.executeQuery({
    prompt: params.prompt,
    model: params.model,
    systemPrompt: params.systemPrompt,
    cwd: params.cwd || process.cwd()
  });

  let response = '';
  for await (const message of generator) {
    if (message.type === 'text') {
      response += message.text;
    }
  }

  return response;
}
```

---

## 📋 Tareas Pendientes

### Backend (Día 1 - Tarde)

- [ ] Fix `MultiAgentSpecService.runSingleAgent()` para usar `executeQuery`
- [ ] Agregar helper method o adaptar código directamente
- [ ] Test manual con un feature simple

### API Endpoints (Día 2 - Mañana)

- [ ] `POST /api/spec/multi-agent-analyze`
  - Request: `{ featureId: string, agents?: string[], parallel?: boolean }`
  - Response: `MultiAgentAnalysis`

- [ ] WebSocket events para progreso
  - `multi_agent_started` - Análisis iniciado
  - `multi_agent_agent_progress` - Progreso de agente individual
  - `multi_agent_completed` - Análisis completado

### Frontend UI (Día 2 - Tarde y Día 3)

- [ ] `apps/ui/src/components/views/spec-view/MultiAgentAnalysisButton.tsx`
  - Botón "🤖 Analizar Automáticamente" en Spec Editor
- [ ] `apps/ui/src/components/views/spec-view/MultiAgentAnalysisModal.tsx`
  - Modal con progreso de agentes
  - Visualización de resultados
  - Aplicar spec generado

- [ ] Integración en Spec View
  - Agregar botón en toolbar
  - Manejar eventos WebSocket
  - Actualizar spec cuando se genera

### Testing (Día 3)

- [ ] Unit tests para `MultiAgentSpecService`
- [ ] E2E test del flujo completo
- [ ] Test con diferentes tipos de features

---

## 🎯 Criterios de Aceptación

- ✅ 6 agentes especializados funcionando
- ✅ Ejecución en paralelo < 60s para features simples
- ✅ Spec generado tiene 5-20 steps ordenados lógicamente
- ✅ UI muestra progreso en tiempo real
- ✅ Usuario puede aplicar o rechazar spec generado
- ✅ Insights y warnings de cada agente visibles

---

## 💡 Notas de Implementación

### Orden de Ejecución de Agentes

El spec combina tasks en este orden lógico:

1. **🗄️ Database Agent** - Schema primero
2. **⚙️ Backend Agent** - API después de DB
3. **🎨 Frontend Agent** - UI después de API
4. **🔒 Security Agent** - Validación integrada
5. **🧪 Testing Agent** - Tests al final
6. **🚀 DevOps Agent** - Deployment último

### Performance Esperado

- **Parallel mode** (6 agentes simultáneos): ~30-60s
- **Sequential mode** (1 por vez): ~3-5min
- **Overhead combinación**: ~2-5s

### Manejo de Errores

- Si 1-2 agentes fallan → continuar con los demás
- Si 3+ agentes fallan → marcar análisis como parcialmente fallido
- Siempre retornar resultado aunque sea incompleto

---

## 🔗 Referencias

- Tipos: `libs/types/src/multi-agent-spec.ts`
- Prompts: `libs/prompts/src/multi-agent-spec.ts`
- Roadmap original: `docs/plans/IMPLEMENTATION_ROADMAP.md`

---

**Última actualización**: 2026-01-02 01:45  
**Próximo checkpoint**: Completar backend service adaptado a executeQuery
