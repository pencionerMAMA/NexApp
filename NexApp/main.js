const { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage, clipboard, globalShortcut, desktopCapturer, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => win && summon());

const W = 760, H = 600;
const DATA = app.getPath('userData');
const F = n => path.join(DATA, n);
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJson = (p, v) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(p, JSON.stringify(v)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tryJson = s => { try { return JSON.parse(s); } catch { return null; } };

let settings = Object.assign({
  provider: 'ollama', ollamaModel: 'qwen2.5:3b',
  orKey: '', orModel: 'deepseek/deepseek-chat-v3-0324:free',
  geminiKey: '', geminiModel: 'gemini-2.5-flash',
  openaiKey: '', openaiModel: 'gpt-4o-mini',
  ghKey: '', ghModel: 'openai/gpt-4o-mini',
  city: '', autostart: false, dnd: false, lang: 'ru', desktopOnly: true,
  googleClientId: '', googleClientSecret: ''
}, readJson(F('settings.json'), {}));
let profile = readJson(F('profile.json'), null);
// ===== ВШИТЫЙ КЛЮЧ ИИ =====
// Либо придёт из секрета GitHub (key.json создаётся при сборке), либо впиши сюда:
const GEMINI_KEY = '';
const BUILTIN = Object.assign({ geminiKey: '', ghKey: '', groqKey: '' }, readJson(path.join(__dirname, 'key.json'), {}));
if (GEMINI_KEY) BUILTIN.geminiKey = GEMINI_KEY;
if (BUILTIN.ollamaUrl) Object.assign(settings, { ollamaUrl: BUILTIN.ollamaUrl, ollamaToken: BUILTIN.ollamaToken || '', ollamaModel: BUILTIN.ollamaModel || settings.ollamaModel });
if (BUILTIN.ghKey) Object.assign(settings, { provider: 'github', ghKey: BUILTIN.ghKey, ghModel: settings.ghModel || 'openai/gpt-4o-mini' });
let history = readJson(F('history.json'), []);
let tasks = readJson(F('tasks.json'), { tasks: [], note: '' });
let clips = readJson(F('clips.json'), []);
let apps = readJson(F('apps.json'), []);
const PROXY = String(BUILTIN.server || '').replace(/\/+$/, '');
settings.groqKey = settings.userGroqKey || BUILTIN.groqKey || (PROXY ? 'server' : '');
const GQ = () => (PROXY && !settings.userGroqKey) ? PROXY + '/v1' : 'https://api.groq.com/openai/v1';
const GQH = () => (PROXY && !settings.userGroqKey) ? { 'X-Nex': '1' } : {};
if (BUILTIN.ghKey) settings.ghKey = BUILTIN.ghKey;
settings.geminiKey = '';
settings.provider = 'groq';
settings.groqModel = settings.groqModel || 'llama-3.3-70b-versatile';
let lastMedia = null, lastWeather = null;
const LOGO = path.join(__dirname, 'renderer', 'logo.png');
const LANGN = { ru: 'русский', en: 'English', de: 'Deutsch', uk: 'українська', zh: '中文（简体）', ja: '日本語' };

let win, tray, splash, shown = false, revealedAt = 0, onDesk = true;
const deskOnly = () => settings.desktopOnly !== false;
function raise() {
  if (!win) return;
  if (deskOnly()) { win.setAlwaysOnTop(false); win.moveTop(); }
  else win.setAlwaysOnTop(true, 'screen-saver');
}
const T0 = Date.now();
let extras = null;
const send = (ch, d) => win && !win.isDestroyed() && win.webContents.send(ch, d);

// ---------- PowerShell-помощники ----------
const psText = n => fs.readFileSync(path.join(__dirname, 'ps', n + '.ps1'), 'utf8');
function psFile(name) {
  const f = path.join(os.tmpdir(), `nex_${name}.ps1`);
  fs.writeFileSync(f, '\ufeff' + psText('common') + '\n' + psText(name), 'utf8');
  return f;
}
function spawnPs(name) {
  return spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile(name)], { windowsHide: true });
}
function lines(stream, fn) {
  let buf = ''; stream.setEncoding('utf8');
  stream.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) fn(l); } });
}

let cmdProc = null, cmdId = 0;
const waiters = new Map();
function startCmd() {
  cmdProc = spawnPs('cmd');
  lines(cmdProc.stdout, l => {
    const j = tryJson(l); if (!j || !waiters.has(j.id)) return;
    const w = waiters.get(j.id); waiters.delete(j.id);
    j.ok ? w.res(j.data || {}) : w.rej(new Error(j.err || 'ошибка'));
  });
  cmdProc.stderr.on('data', () => {});
  cmdProc.on('exit', () => {
    cmdProc = null;
    for (const w of waiters.values()) w.rej(new Error('помощник перезапускается'));
    waiters.clear();
    if (!app.isQuitting) setTimeout(startCmd, 2000);
  });
}
function ps(cmd, args = {}, timeout = 25000) {
  return new Promise((res, rej) => {
    if (!cmdProc) return rej(new Error('помощник ещё запускается'));
    const id = ++cmdId;
    waiters.set(id, { res, rej });
    cmdProc.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n');
    setTimeout(() => { if (waiters.has(id)) { waiters.delete(id); rej(new Error('нет ответа')); } }, timeout);
  });
}

let mediaProc = null, coverFile = null;
function startMedia() {
  mediaProc = spawnPs('media');
  lines(mediaProc.stdout, l => {
    const j = tryJson(l); if (!j) return;
    const out = { ok: !!j.ok, app: j.app, title: j.title, artist: j.artist, status: j.status, pos: j.pos, dur: j.dur, upd: j.upd };
    if ((j.cover || null) !== coverFile) {
      coverFile = j.cover || null;
      out.cover = null;
      if (coverFile) try { out.cover = 'data:image/jpeg;base64,' + fs.readFileSync(coverFile).toString('base64'); } catch {}
    }
    lastMedia = j.ok ? out : null;
    send('media', out);
  });
  mediaProc.stderr.on('data', () => {});
  mediaProc.on('exit', () => { mediaProc = null; if (!app.isQuitting) setTimeout(startMedia, 4000); });
}

// ---------- система ----------
function cpuTimes() { let idle = 0, total = 0; for (const c of os.cpus()) { for (const k in c.times) total += c.times[k]; idle += c.times.idle; } return { idle, total }; }
let lastCpu = cpuTimes();
function stats() {
  const n = cpuTimes(), di = n.idle - lastCpu.idle, dt = n.total - lastCpu.total; lastCpu = n;
  let disk = null;
  try { const s = fs.statfsSync('C:\\'); disk = { total: s.blocks * s.bsize, free: s.bavail * s.bsize }; } catch {}
  return { cpu: dt ? Math.round(100 * (1 - di / dt)) : 0, ramUsed: os.totalmem() - os.freemem(), ramTotal: os.totalmem(), disk, uptime: os.uptime() };
}

// ---------- погода ----------
async function getJson(u) { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
async function weather() {
  let loc = null;
  if (settings.city) {
    const g = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=${encodeURIComponent(settings.city)}`).catch(() => null);
    const x = g && g.results && g.results[0];
    if (x) loc = { city: x.name, lat: x.latitude, lon: x.longitude };
  }
  if (!loc) {
    const a = await getJson('https://ipwho.is/?lang=ru').catch(() => null);
    if (a && a.success !== false && a.latitude) loc = { city: a.city, lat: a.latitude, lon: a.longitude };
  }
  if (!loc) {
    const b = await getJson('http://ip-api.com/json/?lang=ru').catch(() => null);
    if (b && b.status === 'success') loc = { city: b.city, lat: b.lat, lon: b.lon };
  }
  if (!loc) throw new Error('Не удалось определить город');
  const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6&wind_speed_unit=ms`);
  lastWeather = { city: loc.city, current: w.current, daily: w.daily };
  return lastWeather;
}

// ---------- буфер обмена ----------
let lastClip = '';
function saveClips() { writeJson(F('clips.json'), clips); send('clips', clips); }
function watchClipboard() {
  lastClip = clipboard.readText();
  setInterval(() => {
    const t = clipboard.readText();
    if (!t || t === lastClip) return;
    lastClip = t;
    if (t.length > 8000) return;
    const old = clips.find(c => c.text === t);
    clips = [{ id: Date.now(), text: t, t: Date.now(), pin: old ? old.pin : false }, ...clips.filter(c => c.text !== t)];
    const pinned = clips.filter(c => c.pin), rest = clips.filter(c => !c.pin).slice(0, 40);
    clips = clips.filter(c => pinned.includes(c) || rest.includes(c));
    saveClips();
  }, 900);
}

// ---------- ИИ ----------
const aiReady = () => settings.provider === 'ollama' || !!({ openrouter: settings.orKey, gemini: settings.geminiKey, openai: settings.openaiKey, github: settings.ghKey, groq: settings.groqKey }[settings.provider]);
async function failHttp(r) { const t = await r.text().catch(() => ''); const j = tryJson(t) || {}; throw new Error((j.error && (j.error.message || j.error)) || t.slice(0, 200) || 'HTTP ' + r.status); }
async function readLines(res, onLine) {
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) onLine(l); } }
  if (buf.trim()) onLine(buf.trim());
}
const OLLAMA = () => String(settings.ollamaUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
let gIdx = 0;
const gKey = () => { const k = String(settings.geminiKey || '').split(/[,\s]+/).filter(Boolean); return k.length ? k[gIdx % k.length] : ''; };
async function aiStreamRaw(system, msgs, onDelta, signal) {
  let full = '';
  const push = t => { if (t) { full += t; onDelta(t); } };
  try {
    if (settings.provider === 'ollama') {
      const r = await fetch(OLLAMA() + '/api/chat', { method: 'POST', signal, headers: settings.ollamaToken ? { Authorization: 'Bearer ' + settings.ollamaToken } : {}, body: JSON.stringify({ model: settings.ollamaModel, stream: true, keep_alive: '30m', options: { temperature: 0.6, top_p: 0.9, repeat_penalty: 1.15, num_ctx: 4096 }, messages: [{ role: 'system', content: system }, ...msgs] }) });
      if (!r.ok) await failHttp(r);
      await readLines(r, l => { const j = tryJson(l); if (!j) return; if (j.error) throw new Error(j.error); push(j.message && j.message.content); });
    } else if (['openrouter', 'openai', 'github', 'groq'].includes(settings.provider)) {
      const oa = settings.provider === 'openai', gh = settings.provider === 'github', gq = settings.provider === 'groq';
      const url = gq ? GQ() + '/chat/completions' : gh ? 'https://models.github.ai/inference/chat/completions' : oa ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
      const key = gq ? settings.groqKey : gh ? settings.ghKey : oa ? settings.openaiKey : settings.orKey;
      const model = gq ? (settings.groqModel || 'llama-3.3-70b-versatile') : gh ? (settings.ghModel || 'openai/gpt-4o-mini') : oa ? (settings.openaiModel || 'gpt-4o-mini') : settings.orModel;
      const r = await fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'X-Title': 'Nex', ...(gq ? GQH() : {}) }, body: JSON.stringify({ model, stream: true, temperature: 0.8, messages: [{ role: 'system', content: system }, ...msgs] }) });
      if (!r.ok) await failHttp(r);
      await readLines(r, l => { if (!l.startsWith('data:')) return; const d = l.slice(5).trim(); if (d === '[DONE]') return; const j = tryJson(d); if (!j) return; if (j.error) throw new Error(j.error.message || 'openrouter'); push(j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content); });
    } else {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(gKey())}`;
      const r = await fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: Object.assign({ temperature: 0.8 }, /2\.5/.test(settings.geminiModel) ? { thinkingConfig: { thinkingBudget: 0 } } : {}), safetySettings: ['HARASSMENT', 'HATE_SPEECH', 'SEXUALLY_EXPLICIT', 'DANGEROUS_CONTENT'].map(c => ({ category: 'HARM_CATEGORY_' + c, threshold: c === 'SEXUALLY_EXPLICIT' ? 'BLOCK_MEDIUM_AND_ABOVE' : 'BLOCK_ONLY_HIGH' })) }) });
      if (!r.ok) await failHttp(r);
      await readLines(r, l => { if (!l.startsWith('data:')) return; const j = tryJson(l.slice(5).trim()); if (!j) return; if (j.error) throw new Error(j.error.message); const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []; push(parts.map(p => p.text || '').join('')); const fr = j.candidates && j.candidates[0] && j.candidates[0].finishReason; if (((j.promptFeedback && j.promptFeedback.blockReason) || fr === 'SAFETY' || fr === 'PROHIBITED_CONTENT' || fr === 'BLOCKLIST') && !full) push('Хм, на это я отвечать не буду. Давай о чём-нибудь другом?'); });
    }
  } catch (e) { if (e.name === 'AbortError') return full; throw e; }
  return full;
}
const FALLBACK = {
  gemini: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'],
  github: ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'openai/gpt-4.1-nano', 'openai/gpt-4o'],
  groq: ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'],
  openrouter: ['deepseek/deepseek-chat-v3-0324:free', 'openai/gpt-oss-20b:free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free']
};
const MODEL_KEY = { gemini: 'geminiModel', github: 'ghModel', openrouter: 'orModel', groq: 'groqModel' };
async function aiStream(system, msgs, onDelta, signal) {
  const main = settings.provider;
  const chain = [main, ...[].filter(p => p !== main && settings[{ gemini: 'geminiKey', groq: 'groqKey', github: 'ghKey' }[p]])];
  let err; const errs = [];
  for (const p of chain) {
    let said = false; settings.provider = p;
    try {
      const out = await aiStreamOne(system, msgs, t => { if (t) said = true; onDelta(t); }, signal);
      if (String(out || '').trim()) return out;
      const alt = await aiPlain(p, system, msgs, signal);
      if (alt) { onDelta(alt); return alt; }
      throw new Error('пустой ответ от ' + p);
    }
    catch (e) { errs.push(p + ': ' + String(e && e.message || e).slice(0, 140)); err = e; if (said || (signal && signal.aborted)) throw e; }
    finally { settings.provider = main; }
  }
  throw new Error(errs.join(' | ') || String(err));
}
let groqModels = null;
async function groqPick() {
  if (groqModels && groqModels.length) return groqModels;
  const r = await fetch(GQ() + '/models', { headers: { Authorization: 'Bearer ' + settings.groqKey, ...GQH() } });
  const t = await r.text(); const j = tryJson(t) || {};
  if (!r.ok) throw new Error('groq: ' + ((j.error && j.error.message) || ('HTTP ' + r.status)));
  const ids = (j.data || []).filter(x => x.active !== false).map(x => x.id).filter(id => !/whisper|guard|tts|playai|orpheus|distil|prompt|safeguard|compound/i.test(id));
  const pref = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct', 'openai/gpt-oss-20b', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'];
  groqModels = [...pref.filter(p => ids.includes(p)), ...ids.filter(i => !pref.includes(i))];
  if (!groqModels.length) throw new Error('groq: в твоём аккаунте Groq нет доступных моделей. Зайди на console.groq.com → Settings → Limits и включи модели.');
  return groqModels;
}
async function aiPlain(p, system, msgs, signal) {
  const cfg = { groq: [GQ() + '/chat/completions', settings.groqKey, settings.groqModel || 'llama-3.3-70b-versatile'], github: ['https://models.github.ai/inference/chat/completions', settings.ghKey, settings.ghModel || 'openai/gpt-4o-mini'] }[p];
  if (!cfg || !cfg[1]) return '';
  const r = await fetch(cfg[0], { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg[1], ...(p === 'groq' ? GQH() : {}) }, body: JSON.stringify({ model: cfg[2], stream: false, temperature: 0.8, messages: [{ role: 'system', content: system }, ...msgs] }) });
  const t = await r.text(); const j = tryJson(t) || {};
  if (!r.ok || j.error) throw new Error((j.error && (j.error.message || j.error)) || ('HTTP ' + r.status + ' ' + t.slice(0, 120)));
  const c = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  if (!c) throw new Error(p + ' HTTP ' + r.status + ': ' + (t.slice(0, 140) || 'пусто'));
  return c;
}
async function aiStreamOne(system, msgs, onDelta, signal) {
  const p = settings.provider, key = MODEL_KEY[p], list = p === 'groq' ? await groqPick() : FALLBACK[p];
  if (p === 'groq' && !list.includes(settings.groqModel)) settings.groqModel = list[0];
  if (p === 'ollama') {
    try { return await aiStreamRaw(system, msgs, onDelta, signal); }
    catch (e) {
      if (!/not found|pull/i.test(String(e && e.message || e))) throw e;
      const t = await fetch(OLLAMA() + '/api/tags').then(r => r.json()).catch(() => null);
      const m = t && t.models && t.models[0] && t.models[0].name;
      if (!m) throw e;
      settings.ollamaModel = m; writeJson(F('settings.json'), settings);
      return aiStreamRaw(system, msgs, onDelta, signal);
    }
  }
  if (!list) return aiStreamRaw(system, msgs, onDelta, signal);
  const tried = new Set();
  let retried = false, rot = 0, triedLocal = false;
  for (;;) {
    try { return await aiStreamRaw(system, msgs, onDelta, signal); }
    catch (e) {
      const m = String(e && e.message || e);
      if (/429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(m)) {
        const nk = String(settings.geminiKey || '').split(/[,\s]+/).filter(Boolean).length;
        if (p === 'gemini' && rot < nk - 1) { rot++; gIdx++; continue; }
        if (!triedLocal && fs.existsSync(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'))) {
          triedLocal = true; const keepP = settings.provider; settings.provider = 'ollama';
          try { return await aiStreamRaw(system, msgs, onDelta, signal); } catch {} finally { settings.provider = keepP; }
        }
        throw e;
      }
      if (/overloaded|503|UNAVAILABLE|try again later|500|INTERNAL/i.test(m) && !retried) { retried = true; await new Promise(r => setTimeout(r, 1200)); continue; }
      const gone = /not found|is not supported|no longer|deprecated|does not exist|unknown model|No endpoints|invalid model|unknown_model/i.test(m);
      const busy = /overloaded|503|UNAVAILABLE|try again later/i.test(m);
      if (!gone && !busy) throw e;
      tried.add(settings[key]);
      const next = list.find(x => !tried.has(x));
      if (!next) throw e;
      if (gone) { settings[key] = next; writeJson(F('settings.json'), settings); continue; }
      const keep = settings[key]; settings[key] = next;
      try { return await aiStreamRaw(system, msgs, onDelta, signal); } finally { settings[key] = keep; }
    }
  }
}
function humanErr(e) {
  const m = String(e && e.message || e);
  if (/^(groq|github)[: ]/.test(m)) return 'Ошибка ИИ → ' + m.slice(0, 300);
  if (/ECONNREFUSED|fetch failed/i.test(m) && settings.provider === 'ollama') return 'Ollama не запущена. Открой её или выбери другой «мозг» в настройках.';
  if (/abort/i.test(m)) return 'ИИ слишком долго не отвечал. Попробуй ещё раз.';
  if (/fetch failed|ENOTFOUND|ETIMEDOUT|ERR_/i.test(m)) return 'Нет связи с ИИ (' + (settings.groqKey ? 'Groq' : settings.provider) + '). Сайт может быть заблокирован — включи VPN. [' + m.slice(0, 60) + ']';
  if (/403|forbidden|access denied|country|region/i.test(m)) return 'ИИ недоступен в твоей стране — включи VPN.';
  if (!aiReady() || (settings.provider === 'ollama' && !settings.groqKey)) return 'Нет связи с сервером Nex. Проверь секрет NEX_SERVER.';
  if (/location is not supported/i.test(m)) return 'Этот ИИ недоступен в твоей стране.';
  if (/API key|401|invalid.*key|Unauthorized/i.test(m)) return 'Ключ не подходит — проверь его в настройках.';
  if (/429|quota|rate/i.test(m)) return 'Все бесплатные лимиты на сегодня кончились. Подожди немного.';
  if (/not found|No endpoints|model/i.test(m)) return 'Такой модели нет. Поменяй модель в настройках.';
  return 'Ошибка: ' + m.slice(0, 300);
}
const nowText = () => { const d = new Date(); return `${d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`; };
function systemPrompt() {
  const p = profile || {}, ctx = [];
  if (p.name) ctx.push(`Пользователя зовут ${p.name}.`);
  if (p.birth) ctx.push(`Его день рождения: ${new Date(p.birth).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.`);
  if (p.hobby) ctx.push(`Увлечения: ${p.hobby}.`);
  if (lastWeather) ctx.push(`Он в городе ${lastWeather.city}, сейчас там ${Math.round(lastWeather.current.temperature_2m)}°C.`);
  if (lastMedia && lastMedia.title) ctx.push(`Сейчас у него ${lastMedia.status === 'Playing' ? 'играет' : 'на паузе'}: «${lastMedia.title}»${lastMedia.artist ? ' — ' + lastMedia.artist : ''}.`);
  return `Ты — Nex, маленький добрый персонаж, который живёт в островке сверху экрана Windows. Ты друг пользователя.
ТОЧНАЯ ДАТА И ВРЕМЯ СЕЙЧАС: ${nowText()}. Сейчас ${new Date().getFullYear()} год. Эта дата взята с часов компьютера и всегда верна — на вопросы о дате и годе отвечай только по ней.
${ctx.join(' ')}

Характер: тёплый, весёлый, любопытный, немного шутишь, искренне интересуешься жизнью друга, поддерживаешь, когда грустно, говоришь честно.
ЯЗЫК: всегда отвечай на языке «${LANGN[settings.lang] || 'русский'}», даже если пишут на другом.
ТВОЯ ПРОГРАММА — Nex Island: островок сверху рабочего стола Windows. Вкладки: чат с тобой, погода (город — в настройках), музыка (видишь Spotify и любой плеер), задачи и заметки, таймер и помодоро, календарь, система (процессор, память, диск), буфер обмена, любимые программы (открываются по клику), расписание уроков, напоминания, статистика программ. Быстрые кнопки: Wi‑Fi, Bluetooth, ночной свет, скриншот, запись экрана, «не беспокоить». Клавиши: Ctrl+Alt+N — открыть Nex, Ctrl+Shift+Space — поиск по всему компьютеру, калькулятор, валюты, Ctrl+Alt+T — перевести скопированный текст. Настройки: нажать на аватарку → обои, цвет, язык, город, автозапуск. ИИ работает через Ollama прямо на компьютере. Островок показывается только на рабочем столе.
${extras && extras.pcInfo ? 'ЧТО ЕСТЬ НА КОМПЬЮТЕРЕ: ' + extras.pcInfo() : ''}
ДЕЙСТВИЯ: ты умеешь управлять компьютером. Если друг просит открыть игру, программу или папку — добавь в самом конце ответа [[open:название]]. Если просит написать кому-то — [[msg:telegram|имя контакта в именительном падеже|текст сообщения]] (или discord вместо telegram). Ночной свет — [[night]]. Других команд нет, не выдумывай их.

Как общаешься: ВСЕГДА на «ты», никогда на «вы». Не здоровайся в каждом сообщении и не называй дату/время, если об этом не спросили. Если сообщение похоже на случайные буквы — просто весело спроси, что друг имел в виду. Отвечай по сути того, что написали, а не общими фразами.
${memory.length ? 'ЧТО ДРУГ ПРОСИЛ ЗАПОМНИТЬ: ' + memory.map(x => '— ' + x).join(' ') : ''}
Стиль: просто и живо, как друг в переписке. Обычно 1–4 предложения; длиннее — только если просят помочь с чем-то большим. Задаёшь встречные вопросы, помнишь прошлые разговоры. Помогаешь с чем угодно: учёба, идеи, советы, планы, игры, фильмы, музыка. Не пишешь программный код. Не говоришь «как ИИ». Ты — Nex.`;
}
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
function fixLayout(t) {
  if (!/^(ru|uk)$/.test(settings.lang || 'ru') || /[а-яё]/i.test(t) || !/[a-z]/i.test(t)) return t;
  const w = t.toLowerCase().match(/[a-z;',.\[\]`]+/g) || [];
  const novow = w.filter(x => !/[aeiouy]/.test(x)).length;
  if (novow / w.length < 0.5) return t;
  return [...t].map(ch => { const i = EN.indexOf(ch.toLowerCase()); if (i < 0) return ch; const r = RU[i]; return ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? r.toUpperCase() : r; }).join('');
}
let memory = readJson(F('memory.json'), []);
const FEW = [
  { role: 'user', content: 'привет' }, { role: 'assistant', content: 'Привет! Как день проходит?' },
  { role: 'user', content: 'скучно' }, { role: 'assistant', content: 'Понимаю 😅 Хочешь, подкину идею — игру, фильм или что-нибудь сделать руками?' }
];
// ---------- автоустановка ИИ ----------
const setup = { busy: false, text: '' };
let setupW = null, lastProg = 0;
function setupWin() {
  if (setupW && !setupW.isDestroyed()) return setupW;
  setupW = new BrowserWindow({ width: 480, height: 200, frame: false, transparent: true, resizable: false, alwaysOnTop: true, center: true, show: false, hasShadow: false, skipTaskbar: false, icon: LOGO, title: 'Nex' });
  setupW.ready = new Promise(res => setupW.webContents.once('did-finish-load', res));
  setupW.loadFile(path.join(__dirname, 'renderer', 'splash.html'), { query: { lang: settings.lang || 'ru', mode: 'setup' } });
  setupW.once('ready-to-show', () => setupW.show());
  return setupW;
}
const MB = b => (b / 1048576).toFixed(b < 1048576 * 100 ? 1 : 0);
const fmtEta = s => !isFinite(s) || s <= 0 ? '' : s < 60 ? `${Math.ceil(s)} сек` : s < 3600 ? `${Math.ceil(s / 60)} мин` : `${Math.floor(s / 3600)} ч ${Math.ceil(s % 3600 / 60)} мин`;
function setStage(text, info = {}, force) {
  const { got, total, speed } = info;
  const pct = total ? Math.min(100, Math.floor(got / total * 100)) : info.pct;
  setup.text = text + (pct != null ? ` ${pct}%` : '');
  const now = Date.now(); if (!force && now - lastProg < 250) return; lastProg = now;
  send('ai-setup', { text, pct, done: !setup.busy });
  const parts = [];
  if (total) parts.push(`${MB(got)} / ${MB(total)} МБ`);
  if (speed) parts.push(`${(speed / 1048576).toFixed(1)} МБ/с`);
  if (total && speed) { const e = fmtEta((total - got) / speed); if (e) parts.push('осталось ' + e); }
  const w = setupWin();
  w.ready.then(() => { if (!w.isDestroyed()) w.webContents.executeJavaScript(`window.prog && prog(${JSON.stringify({ title: text, pct: pct == null ? null : pct, status: parts.join('  ·  ') || 'Подожди немного…' })})`).catch(() => {}); });
}
function closeSetup(msg) {
  if (!setupW || setupW.isDestroyed()) return;
  const w = setupW; setupW = null;
  w.webContents.executeJavaScript(`window.prog && prog(${JSON.stringify({ title: msg, pct: 100, status: '' })}); setTimeout(() => window.done && done(), 700)`).catch(() => {});
  setTimeout(() => { if (!w.isDestroyed()) w.close(); }, 1500);
}
function speedo() { let last = Date.now(), lastB = 0, sp = 0; return b => { const now = Date.now(), dt = (now - last) / 1000; if (dt >= 0.5) { const inst = (b - lastB) / dt; sp = sp ? sp * 0.7 + inst * 0.3 : inst; last = now; lastB = b; } return sp; }; }
const pickModel = () => { const g = os.totalmem() / 1073741824; return g < 7.5 ? 'qwen2.5:1.5b' : g < 15 ? 'gemma3:4b' : 'qwen2.5:7b'; };
const ollamaUp = () => fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2500) }).then(r => r.json()).catch(() => null);
const OLLAMA_EXE = () => [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'), 'C:\\Program Files\\Ollama\\ollama.exe'].find(p => fs.existsSync(p));
async function waitUp(sec) { for (let i = 0; i < sec; i++) { const t = await ollamaUp(); if (t) return t; await sleep(1000); } return null; }
async function download(url, file, label) {
  const head = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  const cr = head.headers.get('content-range'), total = cr ? +cr.split('/')[1] : 0;
  const finalUrl = head.url || url; try { await head.body.cancel(); } catch {}
  const sp = speedo(); let got = 0;
  if (head.status === 206 && total > 8e6) {
    const N = 8, part = Math.ceil(total / N), fd = fs.openSync(file, 'w');
    try {
      await Promise.all(Array.from({ length: N }, async (_, i) => {
        let pos = i * part; const end = Math.min(total, pos + part) - 1;
        for (let tries = 0; pos <= end; tries++) {
          try {
            const r = await fetch(finalUrl, { headers: { Range: `bytes=${pos}-${end}` } });
            if (r.status !== 206) throw new Error('HTTP ' + r.status);
            const rd = r.body.getReader();
            for (;;) { const { done, value } = await rd.read(); if (done) break; fs.writeSync(fd, value, 0, value.length, pos); pos += value.length; got += value.length; setStage(label, { got, total, speed: sp(got) }); }
          } catch (err) { if (tries > 4) throw err; await sleep(1000); }
        }
      }));
    } finally { fs.closeSync(fd); }
    return;
  }
  const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
  const t2 = +r.headers.get('content-length') || 0, out = fs.createWriteStream(file), rd = r.body.getReader();
  for (;;) { const { done, value } = await rd.read(); if (done) break; got += value.length; if (!out.write(Buffer.from(value))) await new Promise(res => out.once('drain', res)); setStage(label, { got, total: t2, speed: sp(got) }); }
  await new Promise(res => out.end(res));
}
async function ensureOllama() {
  if (settings.ollamaUrl && !/127\.0\.0\.1|localhost/.test(settings.ollamaUrl)) { setup.busy = false; return; }
  setup.busy = true;
  try {
    let tags = await ollamaUp();
    if (!tags) {
      let exe = OLLAMA_EXE();
      if (!exe) {
        const f = path.join(os.tmpdir(), 'OllamaSetup.exe');
        await download('https://ollama.com/download/OllamaSetup.exe', f, 'Скачиваю движок ИИ');
        setStage('Устанавливаю движок…', {}, true);
        await new Promise(res => spawn(f, ['/VERYSILENT', '/NORESTART', '/SUPPRESSMSGBOXES', '/SP-'], { windowsHide: true }).on('exit', res).on('error', res));
        try { fs.unlinkSync(f); } catch {}
        tags = await waitUp(20); exe = OLLAMA_EXE();
      }
      if (!tags && exe) { spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); tags = await waitUp(30); }
      if (!tags) throw new Error('Не удалось запустить ИИ');
    }
    const have = (tags.models || []).map(m => m.name);
    const FAST = 'qwen2.5:1.5b', want = settings.ollamaModelChosen ? settings.ollamaModel : (settings.autoModel && have.some(n => n === settings.autoModel) ? settings.autoModel : FAST);
    if (!have.some(n => n === want || n === want + ':latest')) {
      const r = await fetch('http://127.0.0.1:11434/api/pull', { method: 'POST', body: JSON.stringify({ model: want, stream: true }) });
      const layers = {}, sp = speedo();
      setStage('Загружаю мозг Nex', {}, true);
      await readLines(r, l => { const j = tryJson(l); if (!j) return; if (j.error) throw new Error(j.error); if (j.digest && j.total) { layers[j.digest] = [j.completed || 0, j.total]; const v = Object.values(layers), g = v.reduce((a, x) => a + x[0], 0), t = v.reduce((a, x) => a + x[1], 0); setStage('Загружаю мозг Nex', { got: g, total: t, speed: sp(g) }); } });
    }
    settings.ollamaModel = want; writeJson(F('settings.json'), settings);
    const better = pickModel();
    if (!settings.ollamaModelChosen && better !== want && better !== FAST) setTimeout(async () => {
      try {
        const r = await fetch('http://127.0.0.1:11434/api/pull', { method: 'POST', body: JSON.stringify({ model: better, stream: false }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && !j.error && !settings.ollamaModelChosen) { settings.ollamaModel = better; settings.autoModel = better; writeJson(F('settings.json'), settings); send('ai-setup', { text: 'Nex стал умнее 🧠', done: true }); }
      } catch {}
    }, 5000);
    setup.busy = false; send('ai-setup', { text: 'Nex готов к разговору!', done: true }); closeSetup('Готово');
  } catch (e) {
    setup.busy = false; setup.err = String(e.message || e); send('ai-setup', { text: 'Не получилось установить ИИ — проверь интернет', done: true }); closeSetup('Нет интернета — попробую ещё раз');
    setTimeout(ensureOllama, 60000);
  }
}
let abortCtl = null;
async function chat(text) {
  if (!aiReady()) return { needKey: true };
  if (setup.busy) return { error: 'Я ещё загружаю свой мозг: ' + setup.text + '. Это только один раз!' };
  if (abortCtl) return { error: 'Секунду, я ещё отвечаю.' };
  history.push({ role: 'user', content: text });
  abortCtl = new AbortController();
  try {
    text = fixLayout(text);
    const mm = text.match(/^\s*запомни[,:]?\s+(.+)/i);
    if (mm) { memory.push(mm[1].trim()); memory = memory.slice(-50); writeJson(F('memory.json'), memory); const a = 'Запомнил! 👍'; history.push({ role: 'assistant', content: a }); writeJson(F('history.json'), history.slice(-60)); return { text: a }; }
    if (/^\s*забудь (всё|все)/i.test(text)) { memory = []; writeJson(F('memory.json'), memory); return { text: 'Всё забыл.' }; }
    if (/^\s*что ты (обо мне )?(помнишь|знаешь обо мне)/i.test(text) && memory.length) return { text: 'Я помню:\n' + memory.map(x => '• ' + x).join('\n') };
    history[history.length - 1].content = text;
    const msgs = FEW.concat(history.slice(-20).map(m => ({ ...m })));
    const quick = extras && extras.quick ? await extras.quick(text).catch(() => null) : null;
    if (quick) { history.push({ role: 'assistant', content: quick }); writeJson(F('history.json'), history.slice(-60)); return { text: quick }; }
    const tmo = setTimeout(() => abortCtl && abortCtl.abort(), 40000);
    let out; try { out = await aiStream(systemPrompt(), msgs, t => send('chunk', t), abortCtl.signal); } finally { clearTimeout(tmo); }
    if (!String(out || '').trim()) throw new Error('ИИ прислал пустой ответ');
    const acts = [...String(out).matchAll(/\[\[(open|msg|night):?([^\]]*)\]\]/g)];
    out = String(out).replace(/\[\[[^\]]*\]\]/g, '').trim();
    for (const a of acts) { const r = extras && extras.act ? await extras.act(a[1], a[2].trim()) : ''; if (r) out += (out ? '\n\n' : '') + r; }
    history.push({ role: 'assistant', content: out || '…' });
    writeJson(F('history.json'), history.slice(-60));
    return { text: out };
  } catch (e) { history.pop(); return { error: humanErr(e) }; }
  finally { abortCtl = null; }
}

// ---------- вход через Google ----------
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function googleLogin() {
  const bg = BUILTIN.google || {}, id = settings.googleClientId || bg.id, secret = settings.googleClientSecret || bg.secret;
  if (!id) return Promise.resolve({ error: 'NO_CLIENT' });
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  return new Promise(resolve => {
    let redirect, done = false;
    const finish = v => { if (done) return; done = true; try { srv.close(); } catch {} resolve(v); };
    const srv = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/') { res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0b0f;color:#fff;font-family:Segoe UI,sans-serif"><h2>Готово! Возвращайся в Nex.</h2></body></html>');
      const code = u.searchParams.get('code');
      if (!code || u.searchParams.get('state') !== state) return finish({ error: 'Вход отменён.' });
      try {
        const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }) }).then(r => r.json());
        if (!r.id_token) return finish({ error: r.error_description || r.error || 'Google не ответил' });
        const p = JSON.parse(Buffer.from(r.id_token.split('.')[1], 'base64url').toString());
        let avatar = null;
        if (p.picture) try { avatar = 'data:image/jpeg;base64,' + Buffer.from(await (await fetch(p.picture)).arrayBuffer()).toString('base64'); } catch {}
        if (r.refresh_token || r.access_token) writeJson(F('google.json'), { refresh: r.refresh_token || (readJson(F('google.json'), {}).refresh), access: r.access_token, exp: Date.now() + (r.expires_in || 3000) * 1000, email: p.email });
        let cloud = null; try { cloud = await cloudGet(); } catch {}
        win && win.focus();
        finish({ name: p.given_name || p.name || '', email: p.email || '', avatar, cloud });
      } catch (e) { finish({ error: e.message }); }
    });
    srv.listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${srv.address().port}`;
      shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile https://www.googleapis.com/auth/drive.appdata', access_type: 'offline', code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'select_account' }));
    });
    setTimeout(() => finish({ error: 'Время вышло, попробуй ещё раз.' }), 180000);
  });
}

// ---------- облако: профиль в скрытой папке Google Drive пользователя ----------
async function gToken() {
  const t = readJson(F('google.json'), null); if (!t) return null;
  if (t.access && t.exp > Date.now() + 60000) return t.access;
  if (!t.refresh) return null;
  const bg = BUILTIN.google || {};
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: settings.googleClientId || bg.id, client_secret: settings.googleClientSecret || bg.secret, refresh_token: t.refresh, grant_type: 'refresh_token' }) }).then(r => r.json());
  if (!r.access_token) return null;
  t.access = r.access_token; t.exp = Date.now() + (r.expires_in || 3000) * 1000; writeJson(F('google.json'), t); return t.access;
}
async function cloudFileId(tok) {
  const r = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + encodeURIComponent("name='nex-profile.json'") + '&fields=files(id)', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());
  return r.files && r.files[0] && r.files[0].id;
}
async function cloudGet() {
  const tok = await gToken(); if (!tok) return null;
  const id = await cloudFileId(tok); if (!id) return null;
  const d = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());
  return d && d.profile ? d : null;
}
let cloudT = null;
function cloudPut() {
  clearTimeout(cloudT);
  cloudT = setTimeout(async () => {
    try {
      const tok = await gToken(); if (!tok || !profile || !profile.google) return;
      const body = JSON.stringify({ profile, settings: { city: settings.city, lang: settings.lang, dnd: settings.dnd }, apps: typeof apps !== 'undefined' ? apps : [], tasks: readJson(F('tasks.json'), null), at: Date.now() });
      const id = await cloudFileId(tok), b = 'nexb' + Date.now();
      const meta = id ? {} : { name: 'nex-profile.json', parents: ['appDataFolder'] };
      const multipart = `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
      await fetch('https://www.googleapis.com/upload/drive/v3/files' + (id ? '/' + id : '') + '?uploadType=multipart', { method: id ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'multipart/related; boundary=' + b }, body: multipart });
    } catch {}
  }, 3000);
}
ipcMain.handle('cloud-restore', (_, d) => {
  if (!d || !d.profile) return false;
  profile = stamp(d.profile); writeJson(F('profile.json'), profile);
  if (d.settings) { Object.assign(settings, d.settings); writeJson(F('settings.json'), settings); }
  if (Array.isArray(d.apps) && d.apps.length && typeof apps !== 'undefined') { apps = d.apps; writeJson(F('apps.json'), apps); }
  if (d.tasks) writeJson(F('tasks.json'), d.tasks);
  return true;
});

// ---------- обновления через GitHub Releases ----------
const REPO = 'pencionerMAMA/NexApp';
let upd = null;
async function checkUpdate() {
  try {
    const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { 'User-Agent': 'Nex' } }).then(r => r.json());
    const v = String(r.tag_name || '').replace(/^v/, ''), cur = app.getVersion();
    const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
    const asset = (r.assets || []).find(a => /\.exe$/i.test(a.name));
    if (v && asset && newer(v, cur)) { upd = { version: v, url: asset.browser_download_url, notes: (r.body || '').slice(0, 300) }; send('update', upd); }
  } catch {}
}
ipcMain.handle('update-check', async () => { await checkUpdate(); return upd; });
ipcMain.handle('update-install', async () => {
  const exe = process.env.PORTABLE_EXECUTABLE_FILE;
  if (!upd || !exe) { if (upd) shell.openExternal(upd.url); return { error: 'Открыл ссылку на новую версию.' }; }
  const tmp = exe + '.new';
  const r = await fetch(upd.url); if (!r.ok) return { error: 'HTTP ' + r.status };
  const total = +r.headers.get('content-length') || 0, out = fs.createWriteStream(tmp), rd = r.body.getReader(); let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; got += value.length; if (!out.write(Buffer.from(value))) await new Promise(res => out.once('drain', res)); send('update-progress', total ? got / total : 0); }
  await new Promise(res => out.end(res));
  const bat = path.join(os.tmpdir(), 'nex-update.cmd');
  fs.writeFileSync(bat, `@echo off\r\nping 127.0.0.1 -n 3 >nul\r\n:retry\r\nmove /y "${tmp}" "${exe}" >nul 2>&1 || (ping 127.0.0.1 -n 2 >nul & goto retry)\r\nstart "" "${exe}"\r\ndel "%~f0"\r\n`);
  require('child_process').spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  app.quit(); return { ok: true };
});

// ---------- окно ----------
function place() {
  const b = screen.getPrimaryDisplay().bounds;
  win.setBounds({ x: b.x + Math.round((b.width - W) / 2), y: b.y, width: W, height: H });
}
function createWindow() {
  win = new BrowserWindow({
    width: W, height: H, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: settings.desktopOnly === false, show: false, icon: LOGO,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false }
  });
  place();
  raise();
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('blur', () => send('blur'));
  win.webContents.on('before-input-event', (_, i) => { if (i.key === 'F12') win.webContents.openDevTools({ mode: 'detach' }); });
  win.webContents.on('render-process-gone', () => win.reload());
  screen.on('display-metrics-changed', place);
}
function summon(tab) {
  if (!win) return;
  if (deskOnly() && !onDesk) return;
  win.show(); raise();
  tab ? send('open-tab', tab) : send('toggle');
  win.focus();
}
function createSplash() {
  splash = new BrowserWindow({ width: 480, height: 200, frame: false, transparent: true, resizable: false, alwaysOnTop: true, center: true, show: false, hasShadow: false, icon: LOGO });
  splash.loadFile(path.join(__dirname, 'renderer', 'splash.html'), { query: { lang: settings.lang || 'ru' } });
  splash.once('ready-to-show', () => splash.show());
}
function revealMain() {
  if (shown) return; shown = true;
  setTimeout(() => {
    if (splash && !splash.isDestroyed()) {
      splash.webContents.executeJavaScript('window.done && done()').catch(() => {});
      setTimeout(() => { if (splash && !splash.isDestroyed()) splash.close(); }, 650);
    }
    const go = () => { if (setup.busy) return setTimeout(go, 700); revealedAt = Date.now(); if (deskOnly() && !onDesk && profile && profile.done && !needLogin()) return; win.showInactive(); raise(); };
    setTimeout(go, 450);
  }, Math.max(0, 2600 - (Date.now() - T0)));
}
// островок только на рабочем столе
const PASS = new Set(['', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'NotifyIconOverflowWindow', 'TopLevelWindowForOverflowXamlIsland', 'Windows.UI.Core.CoreWindow', 'XamlExplorerHostIslandWindow', 'ForegroundStaging', 'MultitaskingViewFrame', 'TaskListThumbnailWnd', '#32768']);
function startFg() {
  const p = spawnPs('fg');
  lines(p.stdout, l => {
    const [cls, pid, pname] = l.split('|');
    if (extras && extras.onFg && +pid !== process.pid) extras.onFg(pname);
    if (+pid === process.pid || PASS.has(cls)) return;
    onDesk = cls === 'Progman' || cls === 'WorkerW';
    if (!shown || !deskOnly() || !win) return;
    if (onDesk) { if (!win.isVisible()) win.showInactive(); raise(); }
    else if (win.isVisible() && (profile && profile.done && !needLogin() || Date.now() - revealedAt > 1500)) { send('blur'); win.hide(); }
  });
  p.stderr.on('data', () => {});
  p.on('exit', () => { if (!app.isQuitting) setTimeout(startFg, 3000); });
}
// любимые программы
async function appEntry(p) {
  let target = p;
  if (/\.lnk$/i.test(p)) { try { const s = shell.readShortcutLink(p); if (s.target) target = s.target; } catch {} }
  let icon = null;
  for (const f of [target, p]) { if (icon) break; try { const im = await app.getFileIcon(f, { size: 'large' }); if (!im.isEmpty()) icon = im.toDataURL(); } catch {} }
  return { id: Date.now() + Math.floor(Math.random() * 1000), name: path.basename(p).replace(/\.(lnk|exe|url)$/i, ''), path: p, icon };
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(LOGO).resize({ width: 16, height: 16 }));
  tray.setToolTip('Nex · Ctrl+Alt+N');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть островок', click: () => summon() },
    { label: 'Настройки', click: () => summon('settings') },
    { label: 'Перезапустить', click: () => { place(); win.reload(); } },
    { type: 'separator' },
    { label: 'Выход', click: () => app.quit() }
  ]));
  tray.on('click', () => summon());
}

ipcMain.on('ignore', (_, v) => win && win.setIgnoreMouseEvents(v, { forward: true }));
ipcMain.on('focus', () => win && win.focus());
const DEVICE = crypto.createHash('sha256').update([os.hostname(), os.userInfo().username, (os.cpus()[0] || {}).model, os.totalmem()].join('|')).digest('hex').slice(0, 16);
const stamp = p => { if (p && p.done) { p.loginVer = app.getVersion(); p.device = DEVICE; } return p; };
const needLogin = () => !!(profile && profile.done && (profile.loginVer !== app.getVersion() || profile.device !== DEVICE));
ipcMain.handle('get-all', () => ({ profile, settings, tasks, clips, apps, history: history.slice(-40), needLogin: needLogin() }));
ipcMain.on('ready', () => revealMain());
ipcMain.handle('apps-add', async () => {
  const start = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  const r = await dialog.showOpenDialog(win, { defaultPath: start, properties: ['openFile', 'multiSelections'], filters: [{ name: 'Apps', extensions: ['exe', 'lnk', 'url'] }] });
  if (!r.canceled) for (const p of r.filePaths) if (!apps.some(a => a.path === p)) apps.push(await appEntry(p));
  writeJson(F('apps.json'), apps); win.focus();
  return apps;
});
const launch = async p => {
  const { spawn } = require('child_process');
  if (!p) return 'no path';
  const run = (cmd, args) => new Promise(res => { try { const ch = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true, cwd: require('path').dirname(p) }); ch.on('error', e => res(String(e.message))); ch.unref(); setTimeout(() => res(''), 400); } catch (e) { res(String(e.message)); } });
  if (!require('fs').existsSync(p) && !/^[a-z]+:\/\//i.test(p)) return 'файл не найден';
  if (/\.exe$/i.test(p)) { const e = await run(p, []); if (!e) return ''; }
  let e = await shell.openPath(p); if (!e) return '';
  e = await run('explorer.exe', [p]); if (!e) return '';
  return run('cmd.exe', ['/c', 'start', '""', p]);
};
ipcMain.handle('apps-open', async (_, id) => {
  const a = apps.find(x => x.id === id); if (!a) return { error: 'not found' };
  const e = await launch(a.path);
  return e ? { error: e } : { ok: true };
});
ipcMain.handle('apps-del', (_, id) => { apps = apps.filter(x => x.id !== id); writeJson(F('apps.json'), apps); return apps; });
ipcMain.handle('save-profile', (_, p) => { profile = stamp(p); writeJson(F('profile.json'), profile); cloudPut(); });
ipcMain.handle('save-settings', (_, s) => {
  const cityChanged = s.city !== undefined && s.city !== settings.city;
  if (s.ollamaModel) s.ollamaModelChosen = true;
  Object.assign(settings, s); writeJson(F('settings.json'), settings);
  try { app.setLoginItemSettings({ openAtLogin: !!settings.autostart }); } catch {}
  return { cityChanged };
});
ipcMain.handle('save-tasks', (_, d) => { tasks = d; writeJson(F('tasks.json'), d); });
ipcMain.handle('sys', async (_, cmd, args) => { try { return { ok: true, data: await ps(cmd, args) }; } catch (e) { return { ok: false, err: e.message }; } });
ipcMain.handle('stats', () => stats());
ipcMain.handle('weather', async () => { try { return { ok: true, data: await weather() }; } catch (e) { return { ok: false, err: e.message }; } });
ipcMain.handle('wallpaper', () => {
  const f = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
  try { const img = nativeImage.createFromPath(f); if (img.isEmpty()) return null; return img.resize({ width: 900 }).toDataURL(); } catch { return null; }
});
ipcMain.handle('chat', (_, t) => chat(t));
const MAIL = { code: null, email: null, exp: 0, tries: 0, last: 0 };
ipcMain.handle('mail-send', async (_, email, lang) => {
  if (PROXY) {
    if (Date.now() - MAIL.last < 30000) return { error: 'Подожди 30 секунд перед новой отправкой.' };
    try {
      const r = await fetch(PROXY + '/mail-send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nex': '1' }, body: JSON.stringify({ email, name: (profile && profile.name) || '' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) return { error: j.error || 'Сервер Nex ответил ошибкой ' + r.status };
      Object.assign(MAIL, { token: j.token, code: null, email, exp: Date.now() + 10 * 60000, tries: 0, last: Date.now() });
      return { ok: true };
    } catch { return { error: 'Нет связи с сервером Nex.' }; }
  }
  const c = BUILTIN.emailjs || {}, g = BUILTIN.gmail || {};
  if (!g.user && !BUILTIN.emailjs) return { error: 'Отправка писем ещё не настроена.' };
  if (Date.now() - MAIL.last < 30000) return { error: 'Подожди 30 секунд перед новой отправкой.' };
  const code = String(require('crypto').randomInt(100000, 1000000));
  const nm = (profile && profile.name) || '';
  let sent = false, gErr = '';
  if (g.user && g.pass) {
    try {
      const tr = require('nodemailer').createTransport({ service: 'gmail', auth: { user: g.user, pass: g.pass } });
      await tr.sendMail({ from: `"Nex" <${g.user}>`, to: email, subject: 'Код Nex: ' + code,
        text: `Привет${nm ? ', ' + nm : ''}! Твой код для Nex: ${code}. Он действует 10 минут.`,
        html: `<div style="font-family:Segoe UI,Arial,sans-serif;background:#0b0b0d;color:#f2f1f6;padding:32px;border-radius:16px;max-width:420px"><h2 style="margin:0 0 8px">Привет${nm ? ', ' + nm : ''}!</h2><p style="color:#a9a7b3;margin:0 0 20px">Твой код для входа в Nex:</p><div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#8b7bff;-webkit-user-select:all;user-select:all">${code}</div><p style="color:#7d7b86;font-size:12px;margin:8px 0 0">Нажми на код — он выделится целиком, потом «Копировать».</p><p style="color:#7d7b86;font-size:12px;margin:20px 0 0">Код действует 10 минут. Если это не ты — просто удали письмо.</p></div>` });
      sent = true;
    } catch (e) { gErr = String(e && e.message || e).slice(0, 120); }
  }
  const pool = (Array.isArray(BUILTIN.emailjs) ? BUILTIN.emailjs : [BUILTIN.emailjs]).filter(x => x && x.service && x.template && x.publicKey);
  const start = (settings.ejsIdx || 0) % Math.max(1, pool.length);
  for (let i = 0; i < pool.length && !sent; i++) {
    const idx = (start + i) % pool.length, x = pool[idx];
    try {
      const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ service_id: x.service, template_id: x.template, user_id: x.publicKey, accessToken: x.privateKey || undefined, template_params: { to_email: email, code, name: nm } }) });
      if (r.ok) { sent = true; settings.ejsIdx = idx; writeJson(F('settings.json'), settings); }
      else gErr = (await r.text()).slice(0, 120);
    } catch { gErr = 'Нет интернета.'; }
  }
  if (!sent) return { error: 'Не получилось отправить письмо: ' + gErr };
  Object.assign(MAIL, { code: require('crypto').createHash('sha256').update(code).digest('hex'), email, exp: Date.now() + 10 * 60000, tries: 0, last: Date.now() });
  return { ok: true };
});
ipcMain.handle('mail-verify', async (_, code) => {
  if (PROXY && MAIL.token) {
    if (++MAIL.tries > 5) { MAIL.token = null; return { error: 'Слишком много попыток — отправь новый код.' }; }
    try {
      const r = await fetch(PROXY + '/mail-verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nex': '1' }, body: JSON.stringify({ token: MAIL.token, code }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return { error: (j.error || 'Ошибка') + (/Неверный/.test(j.error || '') ? ' Осталось попыток: ' + (5 - MAIL.tries) : '') };
      MAIL.token = null; return { ok: true, email: MAIL.email };
    } catch { return { error: 'Нет связи с сервером Nex.' }; }
  }
  if (!MAIL.code || Date.now() > MAIL.exp) return { error: 'Код устарел — отправь новый.' };
  if (++MAIL.tries > 5) { MAIL.code = null; return { error: 'Слишком много попыток — отправь новый код.' }; }
  if (require('crypto').createHash('sha256').update(String(code)).digest('hex') !== MAIL.code) return { error: 'Неверный код. Осталось попыток: ' + (5 - MAIL.tries) };
  const email = MAIL.email; MAIL.code = null; return { ok: true, email };
});
ipcMain.handle('set-key', async (_, k) => {
  k = String(k || '').trim();
  if (!/^gsk_\w{20,}$/.test(k)) return { error: 'Ключ должен начинаться с gsk_ — скопируй его целиком.' };
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + k } });
    if (r.status === 401) return { error: 'Groq говорит, что ключ неверный.' };
    if (!r.ok) return { error: 'Groq ответил ошибкой ' + r.status + '. Попробуй ещё раз.' };
  } catch { return { error: 'Нет интернета.' }; }
  settings.userGroqKey = k; settings.groqKey = k; groqModels = null; settings.provider = 'groq'; writeJson(F('settings.json'), settings);
  return { ok: true };
});
ipcMain.handle('stop', () => { if (abortCtl) abortCtl.abort(); });
ipcMain.handle('new-chat', () => { history = []; writeJson(F('history.json'), []); });
ipcMain.handle('clip-copy', (_, t) => { lastClip = t; clipboard.writeText(String(t)); });
ipcMain.handle('clip-pin', (_, id) => { clips = clips.map(c => c.id === id ? { ...c, pin: !c.pin } : c); saveClips(); });
ipcMain.handle('clip-del', (_, id) => { clips = clips.filter(c => c.id !== id); saveClips(); });
ipcMain.handle('clip-clear', () => { clips = clips.filter(c => c.pin); saveClips(); });
ipcMain.handle('screenshot', async () => {
  const d = screen.getPrimaryDisplay();
  const size = { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
  win.setOpacity(0); await sleep(160);
  try {
    const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
    const img = (srcs.find(s => s.display_id === String(d.id)) || srcs[0]).thumbnail;
    const dir = path.join(app.getPath('pictures'), 'Nex');
    fs.mkdirSync(dir, { recursive: true });
    const n = new Date(), pad = x => String(x).padStart(2, '0');
    const f = path.join(dir, `Скриншот ${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())} ${pad(n.getHours())}-${pad(n.getMinutes())}-${pad(n.getSeconds())}.png`);
    fs.writeFileSync(f, img.toPNG());
    clipboard.writeImage(img);
    return { ok: true, file: f };
  } catch (e) { return { ok: false, err: e.message }; }
  finally { win.setOpacity(1); }
});
ipcMain.handle('show-item', (_, p) => shell.showItemInFolder(p));
ipcMain.handle('win-settings', (_, page) => { if (/^[a-z-]+$/.test(page)) shell.openExternal('ms-settings:' + page); });
ipcMain.handle('open-url', (_, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });
ipcMain.handle('google', () => googleLogin());
ipcMain.handle('google-ready', () => !!(settings.googleClientId || (BUILTIN.google && BUILTIN.google.id)));

app.whenReady().then(() => {
  createSplash(); createWindow(); createTray();
  startCmd(); startMedia(); startFg(); watchClipboard();
  setTimeout(checkUpdate, 15000); setInterval(checkUpdate, 6 * 3600e3);
  try {
    const exe = process.env.PORTABLE_EXECUTABLE_FILE, lnk = path.join(app.getPath('desktop'), 'Nex.lnk');
    if (exe && !settings.shortcutMade) { shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'update' : 'create', { target: exe, icon: exe, iconIndex: 0, description: 'Nex' }); settings.shortcutMade = true; writeJson(F('settings.json'), settings); }
  } catch {}
  if (settings.provider === 'ollama') { setup.busy = true; ensureOllama(); } else setup.busy = false;
  try { extras = require('./extras-main')({ ps: (cmd, a, t) => ps(cmd, a, t), isDesk: () => !deskOnly() || onDesk, raise: () => raise(), win: () => win, send, F, readJson, writeJson, settings, LOGO, aiReady, ai: (sys, text) => aiStream(sys, [{ role: 'user', content: text }], () => {}) }); } catch (e) { console.error(e); }
  setTimeout(revealMain, 9000);
  globalShortcut.register('Control+Alt+N', () => summon());
});
app.on('before-quit', () => { app.isQuitting = true; try { cmdProc && cmdProc.kill(); mediaProc && mediaProc.kill(); } catch {} });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
