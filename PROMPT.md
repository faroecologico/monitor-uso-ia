# Prompt para construir el tuyo

Pégalo tal cual en Claude Code o en Codex.

```text
Constrúyeme un widget de escritorio que muestre cuánto me QUEDA de uso semanal
en Codex, en Claude y en Antigravity. Hazlo en una carpeta nueva fuera de cualquier repositorio.

QUÉ QUIERO VER
- Una ventanita flotante de unos 74 × 290 px, sin marco, siempre encima de las
  demás ventanas, arrastrable desde cualquier punto, que recuerde su posición.
- Fondo casi transparente (velo oscuro al 30 %, esquinas redondeadas, borde
  claro de 1 px) y sombra en el texto para que se lea sobre cualquier fondo.
- Tres aros de progreso apilados en vertical: Codex (logo de OpenAI en blanco al
  centro), Claude (logo de Claude en naranja #D97757) y Antigravity (el ícono
  extraído del Antigravity.exe instalado). Los dos primeros, de Simple Icons.
- El aro lleno significa 100 % restante y se vacía a medida que gasto.
  Verde sobre 40 %, amarillo entre 15 y 40 %, rojo bajo 15 %.
- Bajo cada aro: el % restante y cuánto falta para el reinicio ("5 d 9 h").
- Sólo el límite semanal. Sin botones dentro de la ventana.
- Ícono en la bandeja del sistema: clic muestra/oculta, clic derecho → Cerrar.
  Sin ícono en la barra de tareas.
- Que se actualice solo cada minuto y que arranque al iniciar sesión en el sistema.

CÓMO
- Electron, con un servidor Node sin dependencias dentro del mismo proceso que
  expone /api/uso en 127.0.0.1 y sirve un index.html. Nada sale a internet salvo
  la consulta de uso a Anthropic.
- Ventana: frame false, transparent true, alwaysOnTop nivel 'screen-saver',
  skipTaskbar true, resizable false. Arrastre con -webkit-app-region: drag.
  La página mide su alto y se lo manda al proceso principal por IPC para
  ajustar la ventana.

DE DÓNDE SALEN LOS DATOS
- Codex: no hace falta red ni token. Cada respuesta deja una línea con
  "rate_limits" en ~/.codex/sessions/AAAA/MM/DD/*.jsonl. Lee la cola de los
  archivos más recientes y toma la última: payload.rate_limits.primary y
  .secondary traen used_percent, window_minutes (10080 = semana, 300 = 5 horas)
  y resets_at (epoch en segundos). Si resets_at ya pasó, muestra 100 %.
- Claude: GET https://api.anthropic.com/api/oauth/usage con las cabeceras
  Authorization: Bearer <accessToken> y anthropic-beta: oauth-2025-04-20.
  El token está en ~/.claude/.credentials.json → claudeAiOauth.accessToken
  (en macOS está en el Llavero, no en ese archivo). La respuesta trae un arreglo
  "limits"; el semanal es el de kind "weekly_all", con percent y resets_at.
  Es un endpoint no documentado: puede cambiar. Guarda la respuesta 3 minutos
  en memoria para no consultarlo de más.

- Antigravity: sin red. Busca el proceso language_server.exe cuya línea de
  comandos contiene "antigravity", saca de ahí --csrf_token y averigua sus
  puertos en escucha. Haz POST por http a
  127.0.0.1:<puerto>/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary
  con las cabeceras x-codeium-csrf-token y connect-protocol-version: 1 y el
  cuerpo {"metadata":{"ideName":"antigravity","extensionName":"antigravity"}}.
  response.groups[].buckets trae por grupo de modelos un bucket "weekly" y uno
  "5h" con remainingFraction y resetTime. Muestra el semanal del grupo al que
  le queda menos. OJO: GetUserStatus sólo trae el de 5 horas. Sólo responde con
  Antigravity abierto: guarda la última lectura en disco y úsala mientras esté
  cerrado (pasado el resetTime, 100 %).

TROPIEZOS QUE YA CONOCEMOS
- Si sólo uso la app de escritorio de Claude, ese archivo no tiene
  claudeAiOauth: tengo que correr una vez `claude auth login` en el CLI.
  Si falta, muéstrame el aro vacío y dime qué hacer; no busques el token en
  otro lado.
- El token dura 8 horas y sólo el CLI lo renueva. Cuando esté por vencer,
  ejecuta `claude -p "ok" --model haiku --strict-mcp-config --mcp-config
  '{"mcpServers":{}}'` (a lo más un intento cada 10 minutos) y vuelve a leer el
  archivo. Avísame que eso gasta unos pocos tokens tres veces al día. No
  implementes el refresco de OAuth por tu cuenta ni escribas en el archivo de
  credenciales.
- No nombres una función global igual que el objeto que expones con
  contextBridge: la página queda en blanco sin error visible.
- Si `npm install` no deja el binario de Electron, corre
  `node node_modules/electron/install.js`.
- En juegos a pantalla completa exclusiva la ventana queda tapada; sólo se ve
  con "pantalla completa en ventana". No intentes saltarte eso.
- Nunca imprimas ni me muestres el token.

AL TERMINAR
Ábrela, saca una captura sólo del área de la ventana para comprobar que se ve
bien y dime qué probaste y qué no.
```
