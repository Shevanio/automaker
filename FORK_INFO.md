# Fork Information - Automaker

## 📋 Información General

Este documento describe el estado del fork, los cambios implementados y la relación con el repositorio principal.

## 🔗 Repositorios

### Repositorio Principal (Upstream)

- **URL**: `git@github.com:AutoMaker-Org/automaker.git`
- **Remote name**: `origin`
- **Branch principal**: `main`
- **Descripción**: Repositorio oficial de Automaker

### Fork Personal

- **URL**: `git@github.com:Shevanio/automaker.git`
- **Remote name**: `fork`
- **Branch de desarrollo**: `ShevanioBranch`
- **Descripción**: Fork personal con mejoras y fixes

## 📊 Estado Actual

```bash
# Remotes configurados
origin → git@github.com:AutoMaker-Org/automaker.git (upstream)
fork   → git@github.com:Shevanio/automaker.git (tu fork)

# Branch actual
ShevanioBranch (55 commits adelante de origin/main)

# Última sincronización con main
Merge de main realizado el 2026-01-01 (42 commits nuevos integrados)
```

## 🎯 Problema Principal Resuelto

### Descripción del Bug

Las tarjetas del tablero Kanban **NO se movían automáticamente** a su columna final (`waiting_approval` o `verified`) cuando una feature completaba su ejecución. Era necesario **refrescar manualmente el navegador** para ver los cambios.

### Síntomas

- Feature ejecuta y completa correctamente en el backend
- El status se actualiza en el archivo JSON
- La tarjeta permanece en la columna `in_progress`
- Solo moviendo a la columna correcta después de F5 (refresh)

## 🔍 Root Cause Analysis

Después de una investigación exhaustiva, se encontraron **DOS bugs críticos**:

### Bug #1: Rate Limiting Excesivo

**Problema**: El rate limiter bloqueaba peticiones críticas con error `429 Too Many Requests`

**Detalles técnicos**:

- El endpoint `/api/features/list` (necesario para `loadFeatures()`) era bloqueado
- También `/api/features/get`, `/api/worktree/list` sufrían el mismo problema
- El generalLimiter tenía límite de 1000 req/15min sin excepciones

**Solución** (Commit `a413188`):

```typescript
// Eximir endpoints críticos de solo lectura del rate limiting
skip: (req) => {
  const exemptPaths = [
    '/api/features/list',
    '/api/features/get',
    '/api/worktree/list',
    '/api/health',
  ];
  return exemptPaths.some((path) => req.path === path);
};
```

### Bug #2: WebSocket Batch Events No Procesados ⭐ **CRÍTICO**

**Problema**: El frontend descartaba silenciosamente TODOS los eventos WebSocket batched

**Detalles técnicos**:

- El backend envía eventos en batches con estructura:

  ```json
  {
    "type": "batch",
    "events": [
      {"type": "auto_mode_feature_complete", "payload": {...}},
      {"type": "feature_status_changed", "payload": {...}}
    ],
    "count": 2
  }
  ```

- El frontend solo manejaba eventos individuales:

  ```json
  {
    "type": "auto_mode_feature_complete",
    "payload": {...}
  }
  ```

- **RESULTADO**: Todos los eventos batched (incluido `auto_mode_feature_complete`) eran descartados sin error visible

**Solución** (Commit `072e277`):

```typescript
this.ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Handle batched events from server
  if (data.type === 'batch' && Array.isArray(data.events)) {
    // Process each event in the batch
    data.events.forEach((batchedEvent: any) => {
      const callbacks = this.eventCallbacks.get(batchedEvent.type as any);
      if (callbacks) {
        callbacks.forEach((cb) => cb(batchedEvent.payload));
      }
    });
  } else {
    // Handle single event (legacy format)
    const callbacks = this.eventCallbacks.get(data.type);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data.payload));
    }
  }
};
```

## 📝 Commits Importantes

### Cronología de Fixes

```
b1c4208 - fix: restore rate limiting and enhanced CORS security after merge
3731e8e - Merge main into ShevanioBranch (42 new commits from main)
fe6f9ae - fix: emit real-time events when feature status changes
2002871 - fix: exempt read-only endpoints from strict rate limiting
76e1685 - fix: add optimistic UI updates when starting/resuming features
b726f31 - fix: update feature status immediately when execution completes
57b905a - Fix real-time UI updates by preventing full reload on completion
79d1b12 - Fix: Update feature status BEFORE removing from runningTasks
1ab160b - Add comprehensive debug logging for real-time UI updates
29fc488 - Revert to main's working approach: full reload on completion
bb04816 - Add detailed logging to debug feature reload after completion
081a210 - Add backend logging for completion events
a413188 - Fix: Exempt critical read endpoints from rate limiting ⭐
072e277 - Fix: Handle batched WebSocket events in frontend ⭐⭐⭐
86c61c0 - Clean up debug logging (FINAL)
```

### Los 2 Commits Críticos

#### 1. `a413188` - Fix Rate Limiting

**Archivo modificado**: `apps/server/src/index.ts`

**Cambio**: Añadido `skip` function al `generalLimiter` para eximir endpoints de solo lectura.

#### 2. `072e277` - Fix WebSocket Batch Handling (⭐ EL MÁS IMPORTANTE)

**Archivo modificado**: `apps/ui/src/lib/http-api-client.ts`

**Cambio**: Implementado procesamiento de eventos batch en `ws.onmessage`, manteniendo compatibilidad con eventos simples.

**Impacto**: Este fix desbloqueó TODOS los eventos WebSocket que estaban siendo silenciosamente descartados.

## 🛠️ Archivos Modificados

### Backend

```
apps/server/src/index.ts
  - Rate limiting optimizado con skip function

apps/server/src/services/auto-mode-service.ts
  - Emite eventos con status field en completion
  - (Temporal) Logging de debug (luego removido)
```

### Frontend

```
apps/ui/src/lib/http-api-client.ts
  ⭐ Manejo de batch events en WebSocket

apps/ui/src/hooks/use-auto-mode.ts
  - Helpers addToRunningTasks/removeFromRunningTasks
  - Manejo de auto_mode_feature_complete event

apps/ui/src/components/views/board-view/hooks/use-board-features.ts
  - loadFeatures() llamado en completion
  - Reproducción de sonido ding al completar

apps/ui/src/types/electron.d.ts
  - Tipos actualizados para eventos con status field
```

## 🔄 Flujo de Eventos Corregido

### ANTES (No funcionaba)

```
1. Backend: Feature completa
2. Backend: Actualiza JSON con status="verified"
3. Backend: Emite batch con auto_mode_feature_complete
4. Frontend: ❌ DESCARTA el batch (tipo desconocido)
5. UI: ❌ Tarjeta NO se mueve
6. Usuario: Tiene que refrescar manualmente
```

### DESPUÉS (Funciona correctamente)

```
1. Backend: Feature completa
2. Backend: Actualiza JSON con status="verified"
3. Backend: Emite batch con eventos:
   - feature_status_changed (status="verified")
   - auto_mode_feature_complete (passes=true, status="verified")
4. Frontend: ✅ Procesa el batch
5. Frontend: ✅ Llama loadFeatures()
6. Frontend: ✅ Carga features con status actualizado
7. UI: ✅ Tarjeta se mueve automáticamente
8. UI: ✅ Suena "ding" de completado
```

## 📚 Archivos de Referencia

### Documentación del Proyecto

- `CLAUDE.md` - Guía para Claude Code con comandos y arquitectura
- `README.md` - Documentación principal del proyecto
- `docs/SECURITY.md` - Guía de seguridad
- `CONTRIBUTING.md` - Guía de contribución

### Configuración

- `.claude_settings.json` - Settings de Claude Code
- `docker-compose.yml` - Configuración Docker
- `package.json` - Workspace raíz

## 🚀 Comandos Útiles

### Sincronizar con Upstream (main)

```bash
# Fetch cambios del repo principal
git fetch origin

# Ver diferencias
git log origin/main..ShevanioBranch

# Mergear cambios de main a tu branch
git checkout ShevanioBranch
git merge origin/main

# Resolver conflictos si existen
git mergetool

# Push a tu fork
git push fork ShevanioBranch
```

### Desarrollo

```bash
# Iniciar en modo desarrollo
npm run dev              # Launcher interactivo
npm run dev:web          # Web (localhost:3007)
npm run dev:electron     # Desktop app

# Testing
npm run test             # E2E tests (Playwright)
npm run test:server      # Server unit tests (Vitest)
npm run test:packages    # Shared packages tests

# Linting y formatting
npm run lint
npm run format
npm run format:check
```

### Git Workflow

```bash
# Ver estado
git status
git log --oneline -10

# Commits
git add .
git commit -m "mensaje"

# Push a tu fork
git push fork ShevanioBranch

# Ver remotes
git remote -v
```

## 🔐 Permisos y Acceso

### Fork (Shevanio/automaker)

- ✅ **Acceso completo**: Puedes hacer push directamente
- ✅ **Branch**: `ShevanioBranch` es tu rama de desarrollo
- ✅ **Libertad total**: Experimenta sin afectar el upstream

### Upstream (AutoMaker-Org/automaker)

- ❌ **No tienes permisos de push directo**
- ✅ **Puedes crear Pull Requests** si quieres contribuir
- ✅ **Puedes hacer fetch/pull** para sincronizar

## 📊 Estadísticas

```
Total commits en ShevanioBranch: 55 adelante de main
Archivos modificados: ~15
Líneas añadidas: ~200
Líneas eliminadas: ~50
Bugs críticos corregidos: 2
Tiempo de investigación: ~4 horas
```

## 🎯 Estado Final

### ✅ Completado

- [x] Bug de rate limiting resuelto
- [x] Bug de WebSocket batch handling resuelto
- [x] UI se actualiza en tiempo real
- [x] No se requiere refresh manual
- [x] Debug logs limpiados
- [x] Código formateado y limpio
- [x] Cambios subidos a fork

### 🔄 Mantenimiento Futuro

#### Sincronización con Upstream

Cada cierto tiempo, sincroniza tu fork con el repo principal:

```bash
git fetch origin
git checkout ShevanioBranch
git merge origin/main
git push fork ShevanioBranch
```

#### Si quieres contribuir al upstream

1. Crea un Pull Request desde GitHub:
   - Desde: `Shevanio/automaker:ShevanioBranch`
   - Hacia: `AutoMaker-Org/automaker:main`
2. Describe los cambios y los bugs corregidos
3. Espera revisión de código
4. Aplica cambios solicitados si es necesario
5. Merge cuando sea aprobado

## 💡 Lecciones Aprendidas

### Debugging de WebSocket

- Los eventos batch pueden descartarse silenciosamente sin errores
- Siempre verificar logs del backend Y del frontend
- El WebSocket.readyState debe ser `OPEN` (1) para enviar

### Rate Limiting

- Los endpoints de solo lectura no deberían tener rate limit estricto
- El rate limiting puede romper funcionalidad crítica
- Siempre eximir `/health`, `/status` y endpoints de lectura frecuente

### Git Workflow con Forks

- Mantener dos remotes: `origin` (upstream) y `fork` (personal)
- Hacer push a `fork`, no a `origin`
- Sincronizar regularmente con `origin/main`

## 📞 Contacto y Soporte

### Si necesitas ayuda

1. Revisa la documentación en `docs/`
2. Lee `CLAUDE.md` para comandos comunes
3. Consulta issues en el repo principal
4. Experimenta en tu fork sin miedo a romper nada

### Recursos

- Repo principal: https://github.com/AutoMaker-Org/automaker
- Tu fork: https://github.com/Shevanio/automaker
- Claude Code docs: https://claude.ai/code

---

**Última actualización**: 2026-01-01  
**Versión**: ShevanioBranch @ commit `86c61c0`  
**Status**: ✅ Funcional y listo para uso
