# Monitor de uso · Codex y Claude

Ventanita flotante para Windows que muestra cuánto te **queda** de uso semanal en Codex y en Claude Code. Dos aros, siempre encima de las demás ventanas, casi transparente y arrastrable.

- El aro lleno es 100 % restante y se va vaciando. Verde sobre 40 %, amarillo entre 15 y 40 %, rojo bajo 15 %.
- Bajo cada aro: el porcentaje restante y cuánto falta para el reinicio semanal.
- Se actualiza sola cada minuto.
- Ícono en la bandeja del sistema: clic muestra u oculta, clic derecho → Cerrar.

Probado sólo en Windows 11. Necesitas plan de suscripción en ambos servicios; con clave de API no hay límites semanales que mostrar.

## Instalar

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
git clone https://github.com/faroecologico/monitor-uso-ia.git
cd monitor-uso-ia
npm install
npm start
```

Si `npm install` no deja el binario de Electron, corre `node node_modules/electron/install.js`.

Después puedes abrirla con doble clic en `Abrir monitor.cmd`.

### Para que aparezca Claude

La app de escritorio de Claude no deja la sesión en disco, así que hay que iniciar sesión una vez en el CLI de Claude Code:

```bash
claude auth login
```

Mientras falte, el aro de Claude queda vacío con una raya.

### Abrirla al encender el computador

En PowerShell, dentro de la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\inicio-automatico.ps1
```

Crea un acceso directo en la carpeta de Inicio de Windows. Para quitarlo: `Win+R`, `shell:startup`, y borra `Monitor de uso IA`.

## De dónde salen los datos

| Servicio | Fuente | ¿Sale a internet? |
|---|---|---|
| Codex | La última línea con `rate_limits` en `~/.codex/sessions/**/*.jsonl` | No |
| Claude | `GET https://api.anthropic.com/api/oauth/usage` con el token de `~/.claude/.credentials.json` | Sólo a Anthropic |

- El dato de Codex se refresca cada vez que Codex responde. Si no lo usas no cambia, y al pasar la hora de reinicio vuelve a 100 %.
- El de Claude se consulta a lo más cada 3 minutos.
- El token nunca se imprime, no se guarda en otro lado ni se envía a nadie más que a Anthropic.

## Lo que conviene saber

- **El endpoint de uso de Claude no está documentado.** Si Anthropic lo cambia, el aro de Claude deja de funcionar hasta ajustar `server.mjs`.
- **La renovación de la sesión gasta unos pocos tokens.** El token del CLI dura 8 horas y sólo el CLI sabe renovarlo, así que cuando está por vencer el monitor ejecuta `claude -p "Responde solo: ok" --model haiku`. Son unas 3 consultas mínimas al día, descontadas de tu uso de Claude. Si no lo quieres, borra la llamada a `renovarSesion()` en `server.mjs` y renueva a mano abriendo `claude`.
- **Juegos a pantalla completa exclusiva tapan la ventana.** Se ve sólo con "pantalla completa en ventana".
- **macOS y Linux:** no están probados. En macOS el token de Claude vive en el Llavero y no en el archivo, y la búsqueda del CLI asume rutas de Windows.

## Ajustes rápidos

| Qué | Dónde |
|---|---|
| Transparencia del fondo | `rgba(16, 18, 24, 0.30)` en `index.html` |
| Umbrales de color | función `medidor` en `index.html` |
| Tamaño de la ventana | `ANCHO` en `main.cjs` y `#vidrio` en `index.html` |
| Puerto local | `PUERTO` en `main.cjs` y `server.mjs` (4517) |

## Hacer el tuyo con un agente

Si prefieres que Claude Code o Codex te construyan una versión propia desde cero, el encargo completo está en [PROMPT.md](PROMPT.md).

## Créditos y licencia

Código bajo licencia MIT. Los logos de OpenAI y Claude vienen de [Simple Icons](https://simpleicons.org) y son marcas de sus dueños; este proyecto no está afiliado a OpenAI ni a Anthropic.
