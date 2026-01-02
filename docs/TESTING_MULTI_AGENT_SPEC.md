# 🧪 Guía de Testing: Multi-Agent Spec Analysis

## 📋 Tabla de Contenidos

1. [Pre-requisitos](#pre-requisitos)
2. [Configuración Inicial](#configuración-inicial)
3. [Tests Manuales - UI](#tests-manuales---ui)
4. [Tests Manuales - Backend](#tests-manuales---backend)
5. [Tests End-to-End](#tests-end-to-end)
6. [Problemas Conocidos y Soluciones](#problemas-conocidos-y-soluciones)
7. [Checklist de Verificación](#checklist-de-verificación)

---

## Pre-requisitos

### ✅ Verificar antes de empezar

```bash
# 1. Verificar que tienes la rama correcta
git branch
# Debe mostrar: * ShevanioBranch

# 2. Verificar últimos commits
git log --oneline -3
# Debe mostrar:
# 224f305 fix(multi-agent): support app spec analysis without featureId
# 8b00fe2 feat(ui): add multi-agent spec analysis UI components
# 5652242 feat: Add Multi-Agent Spec API endpoint and WebSocket events

# 3. Verificar que tienes API key de Anthropic
cat apps/server/.env.example
# Debe contener: ANTHROPIC_API_KEY=
```

### 🔑 Configurar API Key

```bash
# Opción 1: Variable de entorno (recomendado)
export ANTHROPIC_API_KEY="tu-api-key-aqui"

# Opción 2: Archivo .env en apps/server/
echo "ANTHROPIC_API_KEY=tu-api-key-aqui" > apps/server/.env

# Verificar
echo $ANTHROPIC_API_KEY  # Debe mostrar tu API key
```

---

## Configuración Inicial

### Paso 1: Build del proyecto

```bash
# Desde la raíz del proyecto
cd /home/shevanio/dev/automaker

# 1. Instalar dependencias (si no lo has hecho)
npm install

# 2. Build de paquetes compartidos
npm run build:packages

# Debe completar sin errores y mostrar:
# > @automaker/types@1.0.0 build
# > @automaker/platform@1.0.0 build
# > @automaker/utils@1.0.0 build
# > @automaker/prompts@1.0.0 build
# > @automaker/model-resolver@1.0.0 build
# > @automaker/dependency-resolver@1.0.0 build
# > @automaker/git-utils@1.0.0 build
```

### Paso 2: Iniciar el servidor

```bash
# En una terminal (Terminal 1)
cd /home/shevanio/dev/automaker
npm run dev

# Debe mostrar:
# > Automaker Development Launcher
# > Choose mode:
# >   1) Web browser (localhost:3007)
# >   2) Electron desktop app
# >   3) Electron desktop app with DevTools

# Seleccionar opción 1 (Web browser)
# Presionar: 1 <Enter>

# El servidor debe iniciar y mostrar:
# [Server] Server started on port 3008
# [Server] CORS enabled for: http://localhost:3007
# [UI] Vite dev server started on http://localhost:3007
```

### Paso 3: Verificar que la app carga

```bash
# Abrir en tu navegador:
# http://localhost:3007

# Debes ver:
# - Login screen (si es primera vez)
# - O la vista principal de Automaker
```

---

## Tests Manuales - UI

### Test 1: Verificar que el botón aparece

**Objetivo**: Confirmar que el botón "🤖 Analizar Automáticamente" está visible

**Pasos**:

1. Abre http://localhost:3007
2. Navega a un proyecto existente (o crea uno nuevo)
3. Haz click en la pestaña **"Spec"** en la barra lateral
4. Verifica que ves el editor de especificación

**Resultado esperado**:

- ✅ En la parte superior derecha, debes ver **3 botones**:
  - **"🤖 Analizar Automáticamente"** (con fondo degradado púrpura/azul)
  - **"Regenerate"**
  - **"Save Changes"** (o "Saved")

**Verificación visual**:

```
┌─────────────────────────────────────────────────────────┐
│ App Specification                                       │
│ /path/to/project/.automaker/app_spec.txt              │
│                                                         │
│  [🤖 Analizar Automáticamente] [Regenerate] [Saved]   │
└─────────────────────────────────────────────────────────┘
```

**Si falla**:

- Verifica que estás en spec-view (no en board-view)
- Verifica que existe un archivo `app_spec.txt` en `.automaker/`
- Revisa consola del navegador (F12 → Console) para errores

---

### Test 2: Abrir el modal

**Objetivo**: Verificar que el modal se abre correctamente

**Pasos**:

1. Desde spec-view, haz click en **"🤖 Analizar Automáticamente"**

**Resultado esperado**:

- ✅ Se abre un modal grande con:
  - Título: **"Multi-Agent Spec Analysis"**
  - Descripción sobre 6 agentes especializados
  - Grid de 6 tarjetas mostrando los agentes:
    - 🎨 Frontend Specialist
    - ⚙️ Backend Specialist
    - 💾 Database Architect
    - 🔒 Security Auditor
    - 🧪 Testing Specialist
    - 🚀 DevOps Engineer
  - Botón **"Start Analysis"** en la parte inferior

**Verificación visual**:

```
┌──────────────────────────────────────────────────────┐
│ Multi-Agent Spec Analysis                       [X]  │
├──────────────────────────────────────────────────────┤
│ Deploy 6 specialized AI agents to analyze your      │
│ feature from multiple perspectives...               │
│                                                      │
│  Ready to Analyze                                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │    🎨    │  │    ⚙️    │  │    💾    │          │
│  │ Frontend │  │ Backend  │  │ Database │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │    🔒    │  │    🧪    │  │    🚀    │          │
│  │ Security │  │ Testing  │  │  DevOps  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
├──────────────────────────────────────────────────────┤
│                        [Cancel] [Start Analysis]     │
└──────────────────────────────────────────────────────┘
```

**Si falla**:

- Verifica que no hay errores en consola (F12 → Console)
- Verifica que el modal está importado correctamente
- Revisa Network tab (F12 → Network) para errores de carga

---

### Test 3: Iniciar análisis (UI solamente)

**Objetivo**: Verificar que la UI responde al click de "Start Analysis"

**Pasos**:

1. Con el modal abierto, haz click en **"Start Analysis"**

**Resultado esperado**:

- ✅ El modal cambia a vista de progreso:
  - Barra de progreso en la parte superior
  - Lista de 6 agentes con indicadores de estado
  - Algunos agentes muestran animación de "running" (spinner)
  - Texto: "Progress: X of 6 agents completed"

**Verificación visual (durante ejecución)**:

```
┌──────────────────────────────────────────────────────┐
│ Multi-Agent Spec Analysis                       [X]  │
├──────────────────────────────────────────────────────┤
│ Progress: 2 of 6 agents completed              33%  │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │
│                                                      │
│  ┌────────────────────────────────────────┐         │
│  │ 🎨 Frontend Specialist      [✓]        │ green   │
│  │ 3 tasks identified • ~15min            │         │
│  └────────────────────────────────────────┘         │
│                                                      │
│  ┌────────────────────────────────────────┐         │
│  │ ⚙️ Backend Specialist       [●]        │ blue    │
│  │ Analyzing...                           │         │
│  └────────────────────────────────────────┘         │
│                                                      │
│  ┌────────────────────────────────────────┐         │
│  │ 💾 Database Architect       [○]        │ gray    │
│  └────────────────────────────────────────┘         │
│                                                      │
│  ... (otros agentes)                                │
└──────────────────────────────────────────────────────┘
```

**Notas importantes**:

- **Este test puede FALLAR en el backend** si:
  - No tienes API key configurada
  - El backend no está corriendo
  - Hay errores en la llamada a Claude
- **Esto es NORMAL** en esta fase de testing
- Si ves error, pasa al siguiente test para verificar backend

**Si ves error**:

- Abre DevTools (F12) → Console
- Anota el mensaje de error exacto
- Verifica Network tab → busca request a `/api/spec/multi-agent-analyze`
- Verifica Response del request (debería mostrar error detallado)

---

### Test 4: Cerrar modal

**Objetivo**: Verificar que el modal se cierra correctamente

**Pasos**:

1. Con el modal abierto (en cualquier estado), haz click en **"Cancel"** o **[X]**

**Resultado esperado**:

- ✅ El modal se cierra
- ✅ Vuelves a spec-view normal

**Si falla**:

- Verifica que el botón Cancel/Close está visible
- Verifica que no hay errores en consola

---

## Tests Manuales - Backend

### Test 5: Verificar endpoint disponible

**Objetivo**: Confirmar que el endpoint responde

**Pasos**:

```bash
# Desde otra terminal (Terminal 2), con el servidor corriendo
curl -X POST http://localhost:3008/api/spec/multi-agent-analyze \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/tmp/test",
    "description": "Test description"
  }'
```

**Resultado esperado**:

```json
{
  "success": false,
  "error": "..."
}
```

**O puede ser error de autenticación**:

```json
{
  "error": "Unauthorized"
}
```

**Esto es OK** - confirma que el endpoint existe y responde.

**Si falla**:

- Verifica que el servidor está corriendo (Terminal 1)
- Verifica el puerto (debe ser 3008)
- Revisa logs del servidor para ver el error

---

### Test 6: Verificar análisis con proyecto real

**Objetivo**: Ejecutar análisis completo con backend

**Pre-requisitos**:

- Servidor corriendo (Terminal 1)
- API key de Anthropic configurada
- Proyecto cargado en la UI

**Pasos**:

1. En la UI, abre un proyecto
2. Ve a Spec view
3. Asegúrate de que hay contenido en `app_spec.txt`
4. Haz click en **"🤖 Analizar Automáticamente"**
5. Haz click en **"Start Analysis"**
6. **Observa la Terminal 1** (donde corre el servidor)

**Resultado esperado en Terminal 1**:

```
[MultiAgentSpecRoute] Starting multi-agent analysis for app spec
[MultiAgentSpecService] Analyzing with 6 agents in parallel mode
[MultiAgentSpecService] Executing agent: frontend
[MultiAgentSpecService] Executing agent: backend
[MultiAgentSpecService] Executing agent: database
[MultiAgentSpecService] Executing agent: security
[MultiAgentSpecService] Executing agent: testing
[MultiAgentSpecService] Executing agent: devops
[MultiAgentSpecService] Agent frontend completed in 3245ms
[MultiAgentSpecService] Agent backend completed in 4102ms
... (otros agentes)
[MultiAgentSpecRoute] Multi-agent analysis completed: 23 steps, 95min estimated
```

**Resultado esperado en UI**:

- Barra de progreso avanza gradualmente
- Agentes cambian de estado: pending → running → completed
- Al terminar, se muestran los resultados

**Si falla**:

- **Error "Unauthorized" o "API key missing"**:

  ```bash
  # Verificar API key
  echo $ANTHROPIC_API_KEY

  # Si está vacía, configurar:
  export ANTHROPIC_API_KEY="tu-api-key"

  # Reiniciar servidor (Ctrl+C en Terminal 1, luego npm run dev)
  ```

- **Error "Rate limit exceeded"**:
  - Esperar 60 segundos
  - Intentar de nuevo
  - Puede ser que hayas ejecutado muchas pruebas

- **Error "Model not found" o "Invalid request"**:
  - Revisa logs del servidor (Terminal 1)
  - Puede ser problema con el prompt
  - Anota el error exacto

- **Timeout o no response**:
  - El análisis puede tomar **30-90 segundos**
  - Espera pacientemente
  - Si pasa de 2 minutos, hay un problema

---

### Test 7: Verificar resultados en el modal

**Objetivo**: Confirmar que los resultados se muestran correctamente

**Pasos**:

1. Después de que el análisis complete (Test 6), el modal debe cambiar automáticamente

**Resultado esperado**:

- ✅ Modal muestra vista de **Resultados**:
  - **3 métricas principales**:
    - Total Tasks (número)
    - Estimated Duration (minutos)
    - Complexity Score (1-10)
  - **Risk Level badge**: Low/Medium/High
  - **6 tarjetas expandibles** (una por agente):
    - Nombre del agente con ícono
    - Número de tareas identificadas
    - Duración estimada
    - Al expandir: lista de tareas, insights, warnings

**Verificación visual**:

```
┌──────────────────────────────────────────────────────┐
│ Multi-Agent Spec Analysis                       [X]  │
├──────────────────────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐                    │
│  │  23   │  │ 95min │  │ 7/10  │                    │
│  │ Tasks │  │ Time  │  │Complex│                    │
│  └───────┘  └───────┘  └───────┘                    │
│                                                      │
│  [ ⚠️ Risk Level: MEDIUM ]                          │
│                                                      │
│  ⚡ Agent Insights                                  │
│                                                      │
│  ▼ 🎨 Frontend Specialist                           │
│     5 tasks • 20min                                 │
│     ─────────────────────────                       │
│     Tasks:                                          │
│     • Create responsive navigation component        │
│     • Implement state management with Zustand       │
│     • Add form validation                           │
│     • Create reusable UI components                 │
│     • Implement routing with TanStack Router        │
│                                                      │
│     💡 Key Insights:                                │
│     • Use React 19 features for better performance  │
│     • Consider code splitting for large components  │
│                                                      │
│  ▶ ⚙️ Backend Specialist                            │
│     4 tasks • 18min                                 │
│                                                      │
│  ... (otros agentes)                                │
│                                                      │
├──────────────────────────────────────────────────────┤
│                        [Close] [Apply Spec]          │
└──────────────────────────────────────────────────────┘
```

**Interacciones a probar**:

1. **Expandir/colapsar tarjetas**: Click en cualquier agente
2. **Scroll**: Debe funcionar suavemente
3. **Datos coherentes**: Suma de tasks = Total Tasks mostrado arriba

**Si falla**:

- Verifica que `result.success === true` en Network tab
- Verifica que `result.analysis` existe y tiene la estructura correcta
- Revisa consola para errores de renderizado
- Verifica que los datos no son `undefined` o `null`

---

### Test 8: Aplicar el spec (botón Apply Spec)

**Objetivo**: Verificar que el botón "Apply Spec" funciona

**Pasos**:

1. Con los resultados mostrados (Test 7), haz click en **"Apply Spec"**

**Resultado esperado ACTUAL**:

- ✅ Modal se cierra
- ✅ Mensaje en consola: `"Applying analysis:"` con el objeto de análisis
- ❌ **El spec NO se actualiza** (funcionalidad pendiente)

**Notas**:

- Esta funcionalidad está **parcialmente implementada**
- El botón existe pero solo hace `console.log()`
- La implementación completa requiere:
  - Formatear `combined_steps` a formato de spec
  - Actualizar `app_spec.txt`
  - Refrescar el editor

**Verificación**:

```javascript
// En consola del navegador (F12 → Console)
// Debes ver:
Applying analysis: {
  combined_steps: [...],
  metadata: {...},
  agents: [...]
}
```

---

## Tests End-to-End

### Test 9: Flujo completo

**Objetivo**: Ejecutar todo el flujo de principio a fin

**Pasos completos**:

1. ✅ Abrir Automaker → http://localhost:3007
2. ✅ Cargar/crear un proyecto
3. ✅ Ir a Spec view
4. ✅ Click en "🤖 Analizar Automáticamente"
5. ✅ Verificar modal se abre
6. ✅ Click en "Start Analysis"
7. ✅ Esperar análisis (30-90 segundos)
8. ✅ Verificar resultados se muestran
9. ✅ Expandir algunas tarjetas de agentes
10. ✅ Click en "Apply Spec" (opcional)
11. ✅ Cerrar modal

**Cronometrar**:

- Tiempo total: ~2-3 minutos
- Tiempo de análisis: ~30-90 segundos (depende de Claude API)

**Criterio de éxito**:

- ✅ Todos los pasos completaron sin errores
- ✅ UI respondió correctamente
- ✅ Resultados coherentes y útiles
- ✅ Sin crashes ni freezes

---

### Test 10: Manejo de errores

**Objetivo**: Verificar que los errores se manejan correctamente

**Escenario 1: Sin API key**

```bash
# Eliminar API key temporalmente
unset ANTHROPIC_API_KEY

# Reiniciar servidor
# Ctrl+C en Terminal 1
npm run dev

# Intentar análisis en la UI
```

**Resultado esperado**:

- ✅ Modal muestra estado de error
- ✅ Mensaje claro: "API key is required" o similar
- ✅ Botón "Retry" aparece
- ✅ No crash de la app

**Escenario 2: Proyecto sin spec**

```bash
# Crear proyecto vacío
mkdir -p /tmp/test-project
# NO crear .automaker/app_spec.txt
```

**Pasos en UI**:

1. Cargar proyecto `/tmp/test-project`
2. Ir a Spec view

**Resultado esperado**:

- ✅ Botón "🤖 Analizar Automáticamente" **NO aparece**
- O muestra mensaje: "No spec available"

**Escenario 3: Error de Claude API**

```bash
# Usar API key inválida
export ANTHROPIC_API_KEY="sk-invalid-key"

# Reiniciar servidor
```

**Resultado esperado**:

- ✅ Análisis falla con mensaje de error
- ✅ Modal muestra error
- ✅ Opción de reintentar

---

## Problemas Conocidos y Soluciones

### Problema 1: "Cannot find module '@/components/ui/progress'"

**Síntoma**: Error en consola al abrir modal

**Solución**:

```bash
# Verificar que el archivo existe
ls apps/ui/src/components/ui/progress.tsx

# Si no existe, crearlo
# (Ya debería existir desde el commit anterior)
```

---

### Problema 2: "API key not configured"

**Síntoma**: Error 401 al iniciar análisis

**Solución**:

```bash
# Opción 1: Variable de entorno
export ANTHROPIC_API_KEY="tu-api-key"

# Opción 2: Archivo .env
echo "ANTHROPIC_API_KEY=tu-api-key" > apps/server/.env

# Reiniciar servidor
# Ctrl+C en Terminal 1
npm run dev
```

---

### Problema 3: Modal no se cierra después de error

**Síntoma**: Click en "Cancel" no funciona

**Solución**:

```javascript
// Forzar cierre desde consola del navegador
// Presionar Escape
// O refrescar página (F5)
```

---

### Problema 4: Análisis toma más de 2 minutos

**Síntoma**: Barra de progreso se queda congelada

**Causas posibles**:

1. Claude API lenta (alta demanda)
2. Spec muy grande (>10,000 líneas)
3. Timeout de red

**Solución**:

1. Esperar hasta 3 minutos
2. Si no responde, cancelar y reintentar
3. Reducir tamaño del spec si es muy grande

---

### Problema 5: Resultados vacíos o sin sentido

**Síntoma**: Agentes completan pero no muestran tareas

**Causas**:

1. Spec vacía o muy genérica
2. Prompt no generó JSON válido
3. Parsing falló

**Solución**:

```bash
# Revisar logs del servidor (Terminal 1)
# Buscar mensajes de parsing errors
# Ejemplo:
[MultiAgentSpecService] Failed to parse agent response: No valid JSON found
```

**Verificar**:

- Spec tiene contenido útil
- No solo texto genérico
- Incluye detalles técnicos

---

## Checklist de Verificación

### ✅ Pre-Testing

- [ ] Rama `ShevanioBranch` activa
- [ ] Commits recientes presentes (224f305, 8b00fe2)
- [ ] API key de Anthropic configurada
- [ ] `npm install` ejecutado
- [ ] `npm run build:packages` completado sin errores

### ✅ UI Tests

- [ ] Botón "🤖 Analizar Automáticamente" visible en Spec view
- [ ] Modal se abre al hacer click
- [ ] Modal muestra 6 agentes correctamente
- [ ] Botón "Start Analysis" funciona
- [ ] Barra de progreso aparece
- [ ] Agentes cambian de estado (pending → running → completed)
- [ ] Modal se puede cerrar con Cancel/X

### ✅ Backend Tests

- [ ] Endpoint `/api/spec/multi-agent-analyze` responde
- [ ] Servidor muestra logs de análisis
- [ ] Claude API responde correctamente
- [ ] Análisis completa en <2 minutos
- [ ] Sin errores en Terminal 1

### ✅ Integration Tests

- [ ] Resultados se muestran en modal
- [ ] 3 métricas principales correctas
- [ ] Risk level badge aparece
- [ ] Tarjetas de agentes son expandibles
- [ ] Datos coherentes (tasks, duration, complexity)
- [ ] Botón "Apply Spec" existe (aunque no funcione completamente)

### ✅ Error Handling

- [ ] Error sin API key se maneja bien
- [ ] Error de Claude API se muestra correctamente
- [ ] Modal no se queda bloqueado en error
- [ ] Botón "Retry" funciona

---

## 🎯 Criterios de Éxito

Para considerar el test **EXITOSO**, debes tener:

1. **✅ UI Funcional**:
   - Botón visible y clickeable
   - Modal se abre/cierra correctamente
   - Progreso se muestra visualmente

2. **✅ Backend Funcional**:
   - Endpoint responde
   - Claude API se ejecuta
   - Análisis completa sin errores

3. **✅ Integración Funcional**:
   - Datos fluyen de backend a frontend
   - Resultados se muestran correctamente
   - No hay errores en consola

4. **✅ UX Aceptable**:
   - Tiempo de espera razonable (<2 min)
   - Feedback visual claro
   - Errores se comunican claramente

---

## 📊 Métricas Esperadas

### Performance

- Tiempo de carga del modal: <500ms
- Tiempo de análisis: 30-90 segundos
- Tamaño de respuesta: ~10-50 KB JSON

### Calidad de Resultados

- Tasks identificadas: 15-30 (depende del spec)
- Duration estimada: 60-180 minutos
- Complexity score: 5-8 (depende del spec)
- Risk level: Varía según el proyecto

---

## 🐛 Reportar Problemas

Si encuentras un bug, anota:

1. **Qué test estabas ejecutando**: (ej. Test 6)
2. **Qué esperabas**: (comportamiento esperado)
3. **Qué obtuviste**: (comportamiento actual)
4. **Logs relevantes**:
   - Consola del navegador (F12 → Console)
   - Terminal del servidor (Terminal 1)
   - Network tab (F12 → Network → Request details)
5. **Screenshots** (si aplica)

---

## ✨ Siguiente Paso

Una vez que **todos los tests pasen**, el feature está listo para:

1. **Documentación**: Crear docs de usuario
2. **Refinamiento**: Mejorar UX basado en feedback
3. **Implementar "Apply Spec"**: Formatear y aplicar resultados
4. **Tests automatizados**: Crear tests E2E con Playwright

---

**¡Buena suerte con el testing!** 🚀
