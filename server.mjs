// Monitor local de uso restante de Codex y Claude.
// Sin dependencias: `node server.mjs` y abrir http://127.0.0.1:4517
// Sólo lee archivos de este computador; la única salida a internet es la
// consulta de uso a Anthropic, y sólo si existe un inicio de sesión del CLI.
import { createServer } from 'node:http';
import { readFile, readdir, stat, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const PUERTO = Number(process.env.PUERTO || 4517);
const AQUI = dirname(fileURLToPath(import.meta.url));
const CODEX = join(homedir(), '.codex', 'sessions');
const CLAUDE = join(homedir(), '.claude');

async function listarJsonl(dir, desdeMs, salida = []) {
  let entradas;
  try { entradas = await readdir(dir, { withFileTypes: true }); } catch { return salida; }
  for (const e of entradas) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) await listarJsonl(ruta, desdeMs, salida);
    else if (e.name.endsWith('.jsonl')) {
      const s = await stat(ruta).catch(() => null);
      if (s && s.mtimeMs >= desdeMs) salida.push({ ruta, mtime: s.mtimeMs, size: s.size });
    }
  }
  return salida;
}

async function leerCola(ruta, size, bytes = 400_000) {
  const fh = await open(ruta, 'r');
  try {
    const largo = Math.min(size, bytes);
    const buf = Buffer.alloc(largo);
    await fh.read(buf, 0, largo, size - largo);
    return buf.toString('utf8');
  } finally { await fh.close(); }
}

// ---------- Codex: cada respuesta deja sus límites en el registro de la sesión
function etiquetaVentana(min) {
  if (min === 300) return '5 horas';
  if (min === 10080) return 'Semana';
  if (min % 1440 === 0) return `${min / 1440} días`;
  return `${Math.round(min / 60)} horas`;
}

async function leerCodex() {
  const archivos = (await listarJsonl(CODEX, Date.now() - 30 * 864e5)).sort((a, b) => b.mtime - a.mtime);
  let mejor = null;
  for (const a of archivos.slice(0, 8)) {
    const lineas = (await leerCola(a.ruta, a.size)).split('\n');
    for (let i = lineas.length - 1; i >= 0; i--) {
      if (!lineas[i].includes('"rate_limits":{')) continue;
      try {
        const j = JSON.parse(lineas[i]);
        const rl = j.payload?.rate_limits;
        const t = Date.parse(j.timestamp);
        if (rl && (!mejor || t > mejor.t)) mejor = { t, rl };
      } catch { /* línea cortada por el recorte de la cola */ }
      break;
    }
  }
  if (!mejor) return { ok: false, nota: 'No encontré sesiones de Codex de los últimos 30 días.' };
  const ahora = Date.now();
  const ventanas = [mejor.rl.primary, mejor.rl.secondary].filter(Boolean).map((v) => {
    const reinicia = v.resets_at * 1000;
    const vencida = reinicia <= ahora; // la ventana ya se reinició después de la última lectura
    return {
      etiqueta: etiquetaVentana(v.window_minutes),
      usado: vencida ? 0 : v.used_percent,
      reinicia: vencida ? null : reinicia,
      vencida,
    };
  });
  const c = mejor.rl.credits;
  return {
    ok: true,
    plan: mejor.rl.plan_type,
    leido: mejor.t,
    ventanas,
    creditos: c?.unlimited ? 'ilimitados' : c?.has_credits ? Number(c.balance) : null,
    limiteAlcanzado: mejor.rl.rate_limit_reached_type || null,
  };
}

// ---------- Claude: porcentaje exacto, con la sesión del CLI
const NOMBRES = { five_hour: '5 horas', seven_day: 'Semana' };
const TIPOS = { session: '5 horas', weekly_all: 'Semana' };
let cacheExacto = { t: 0, valor: null };

// La sesión del CLI dura 8 horas y sólo el propio CLI sabe renovarla: una consulta
// mínima (Haiku, sin MCP) lo obliga a hacerlo. Se intenta a lo más cada 10 minutos.
let renovando = null, ultimoIntento = 0;
async function rutaCli() {
  const base = join(process.env.APPDATA || '', 'Claude', 'claude-code');
  const rutas = [];
  for (const v of await readdir(base).catch(() => [])) {
    for (const h of await readdir(join(base, v)).catch(() => [])) {
      const ruta = join(base, v, h, 'claude.exe');
      const st = await stat(ruta).catch(() => null);
      if (st) rutas.push({ ruta, mtime: st.mtimeMs });
    }
  }
  return rutas.sort((a, b) => b.mtime - a.mtime)[0]?.ruta || 'claude';
}
function renovarSesion() {
  if (renovando) return renovando;
  if (Date.now() - ultimoIntento < 600_000) return Promise.resolve();
  ultimoIntento = Date.now();
  renovando = rutaCli().then((cli) => new Promise((listo) => {
    execFile(cli, ['-p', 'Responde solo: ok', '--model', 'haiku', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'],
      { cwd: AQUI, timeout: 90_000, windowsHide: true }, () => listo());
  })).finally(() => { renovando = null; });
  return renovando;
}
const leerOauth = async () => {
  try { return JSON.parse(await readFile(join(CLAUDE, '.credentials.json'), 'utf8')).claudeAiOauth; } catch { return null; }
};

async function claudeExacto() {
  let oauth = await leerOauth();
  if (!oauth?.accessToken) return { ok: false, motivo: 'sin-sesion' };
  if (Date.now() - cacheExacto.t < 180_000 && cacheExacto.valor) return cacheExacto.valor;
  if (oauth.expiresAt && oauth.expiresAt < Date.now() + 120_000) {
    await renovarSesion();
    oauth = (await leerOauth()) || oauth;
    if (oauth.expiresAt < Date.now()) return { ok: false, motivo: 'vencida' };
  }
  try {
    const r = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${oauth.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false, motivo: `http-${r.status}` };
    const j = await r.json();
    const fecha = (s) => (s ? Date.parse(s) : null);
    // `limits` es la misma lista que pinta la tarjeta de uso de la app
    const ventanas = Array.isArray(j.limits)
      ? j.limits.map((l) => ({
          etiqueta: TIPOS[l.kind] || (l.scope?.model?.display_name ? `Semana · ${l.scope.model.display_name}` : l.kind),
          usado: l.percent,
          reinicia: fecha(l.resets_at),
        }))
      : Object.entries(NOMBRES).filter(([k]) => j[k]).map(([k, etiqueta]) => ({
          etiqueta, usado: j[k].utilization, reinicia: fecha(j[k].resets_at),
        }));
    const saldos = Object.values(j)
      .filter((v) => v && typeof v.limit_dollars === 'number')
      .map((v) => ({ limite: v.limit_dollars, restante: v.remaining_dollars, reinicia: fecha(v.resets_at) }));
    const valor = { ok: true, plan: oauth.subscriptionType || null, ventanas, saldos, leido: Date.now() };
    cacheExacto = { t: Date.now(), valor };
    return valor;
  } catch (e) {
    return { ok: false, motivo: String(e.message || e) };
  }
}


async function estado() {
  const [codex, claude] = await Promise.all([
    leerCodex().catch((e) => ({ ok: false, nota: String(e.message || e) })),
    claudeExacto().catch((e) => ({ ok: false, motivo: String(e.message || e) })),
  ]);
  return { generado: Date.now(), codex, claude };
}

createServer(async (req, res) => {
  if (req.url === '/api/uso') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(await estado()));
  } else if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(await readFile(join(AQUI, 'index.html')));
  } else {
    res.writeHead(404).end();
  }
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`Monitor de uso: http://127.0.0.1:${PUERTO}`);
});
