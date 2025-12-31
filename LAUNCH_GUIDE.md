# 🚀 Guía Rápida de Inicio

## Opción 1: Script Automático (Recomendado)

### Instalación de dependencias (primera vez)

```bash
npm install
```

### Lanzar Automaker

```bash
./launch.sh
```

Este script:

- ✅ Limpia puertos 3007 y 3008
- ✅ Verifica dependencias
- ✅ Compila paquetes compartidos
- ✅ Detecta tu IP local
- ✅ Levanta backend (3008) y frontend (3007) **simultáneamente**

**Acceso:**

- Local: `http://localhost:3007`
- Red LAN: `http://TU_IP:3007` (ej: `http://192.168.1.100:3007`)

---

## Opción 2: Script Simple (Sin concurrently)

Si prefieres ver logs separados o `concurrently` no funciona:

```bash
./launch-simple.sh
```

**Ventajas:**

- Logs en archivos separados (`backend.log`, `frontend.log`)
- Espera a que backend esté listo antes de iniciar frontend
- Muestra PIDs de los procesos

**Ver logs en tiempo real:**

```bash
# Terminal 1
tail -f backend.log

# Terminal 2
tail -f frontend.log
```

---

## Opción 3: Manual (Para desarrollo)

### Terminal 1 - Backend:

```bash
npm run dev:server
```

### Terminal 2 - Frontend:

```bash
npm run dev:web
```

---

## Detener los Servicios

**Con scripts automáticos:**

```bash
Ctrl+C
```

**Si se quedan procesos zombies:**

```bash
npx kill-port 3007 3008
```

O manualmente:

```bash
# Listar procesos
lsof -i :3007
lsof -i :3008

# Matar por PID
kill -9 <PID>
```

---

## Verificación Rápida

### Backend funcionando:

```bash
curl http://localhost:3008/api/health
# Respuesta: {"status":"ok"}
```

### Frontend funcionando:

```bash
curl http://localhost:3007
# Respuesta: HTML de la aplicación
```

### Verificar puertos abiertos:

```bash
sudo netstat -tulpn | grep -E '3007|3008'
```

Deberías ver:

```
tcp  0.0.0.0:3007  LISTEN  <PID>/node  (Frontend)
tcp  0.0.0.0:3008  LISTEN  <PID>/node  (Backend)
```

---

## Solución de Problemas

### Error: "Port already in use"

```bash
npx kill-port 3007 3008
./launch.sh
```

### Error: "concurrently not found"

```bash
npm install
./launch.sh
```

### Error: "Backend not responding"

1. Verifica autenticación:

```bash
claude auth status
```

2. Si no está autenticado:

```bash
claude auth login
```

3. O usa API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
./launch.sh
```

### Error: "Cannot connect from LAN"

1. Verifica firewall:

```bash
# Ubuntu/Debian
sudo ufw allow 3007/tcp
sudo ufw allow 3008/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=3007/tcp --permanent
sudo firewall-cmd --add-port=3008/tcp --permanent
sudo firewall-cmd --reload
```

2. Verifica que esté escuchando en 0.0.0.0:

```bash
sudo netstat -tulpn | grep -E '3007|3008'
# Debe mostrar 0.0.0.0:XXXX no 127.0.0.1:XXXX
```

---

## Acceso desde Otros Equipos

### Obtén tu IP:

```bash
hostname -I | awk '{print $1}'
# Ejemplo: 192.168.1.100
```

### Accede desde navegador:

```
http://192.168.1.100:3007
```

**Nota:** Asegúrate de estar en la misma red local.

---

## Logs y Debugging

### Ver logs del backend:

```bash
# Si usaste launch-simple.sh
tail -f backend.log

# Si usaste launch.sh o dev:full
# Los logs aparecen en la terminal directamente
```

### Ver logs del frontend:

```bash
# Si usaste launch-simple.sh
tail -f frontend.log

# Abrir DevTools en el navegador
F12 o Ctrl+Shift+I
```

---

## Scripts Disponibles

| Script                 | Descripción                                     |
| ---------------------- | ----------------------------------------------- |
| `./launch.sh`          | **Recomendado** - Levanta todo con concurrently |
| `./launch-simple.sh`   | Levanta con logs separados                      |
| `npm run dev`          | Launcher interactivo                            |
| `npm run dev:web`      | Solo frontend (NO backend)                      |
| `npm run dev:server`   | Solo backend                                    |
| `npm run dev:full`     | Backend + Frontend con npm                      |
| `npm run dev:electron` | Modo desktop (solo local)                       |

---

## TL;DR

```bash
# Primera vez
npm install

# Levantar todo
./launch.sh

# Acceso
http://localhost:3007              # Local
http://192.168.1.100:3007          # Red LAN

# Detener
Ctrl+C
```
