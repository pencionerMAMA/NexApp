const { app, ipcMain, globalShortcut, shell, clipboard, Notification, powerMonitor, desktopCapturer, screen } = require('electron');
const fs = require('fs'), path = require('path'), os = require('os');
const { execFile } = require('child_process');
function runPs(code, timeout = 20000) {
  const f = path.join(os.tmpdir(), 'nex_x_' + Date.now() + '.ps1');
  fs.writeFileSync(f, '\ufeff' + code, 'utf8');
  return new Promise(res => execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', f], { windowsHide: true, timeout }, (e, out) => { try { fs.unlinkSync(f); } catch {} res({ ok: !e, out: String(out || '').trim(), code: e && e.code }); }));
}
const psq = s => "'" + String(s).replace(/'/g, "''") + "'";

module.exports = function init(c) {
  const { send, F, readJson, writeJson } = c;
  const show = () => { const w = c.win(); if (!w || !c.isDesk()) return false; w.show(); c.raise(); w.focus(); return true; };

  // ---------- напоминания ----------
  let rem = readJson(F('reminders.json'), []);
  const timers = new Map();
  const saveRem = () => { writeJson(F('reminders.json'), rem); send('reminders', rem); };
  const arm = r => { clearTimeout(timers.get(r.id)); timers.set(r.id, setTimeout(() => fire(r), Math.max(0, Math.min(r.at - Date.now(), 2147483000)))); };
  function fire(r) {
    rem = rem.filter(x => x.id !== r.id); saveRem();
    show(); send('remind', r);
    try { new Notification({ title: 'Nex', body: r.text, icon: c.LOGO }).show(); } catch {}
  }
  rem.forEach(arm);
  ipcMain.handle('rem-add', (_, r) => { r.id = Date.now(); rem.push(r); arm(r); saveRem(); return rem; });
  ipcMain.handle('rem-del', (_, id) => { clearTimeout(timers.get(id)); rem = rem.filter(x => x.id !== id); saveRem(); return rem; });
  ipcMain.handle('rem-list', () => rem);

  // ---------- статистика программ ----------
  const day = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  let usage = readJson(F('usage.json'), {}), cur = null, since = Date.now();
  function flush() {
    const now = Date.now();
    if (cur && powerMonitor.getSystemIdleTime() < 120) { const d = day(); usage[d] = usage[d] || {}; usage[d][cur] = (usage[d][cur] || 0) + (now - since) / 1000; }
    since = now;
  }
  c.onFg = name => { flush(); cur = !name ? null : name.toLowerCase() === 'explorer' ? 'Рабочий стол' : name; };
  setInterval(() => {
    flush();
    const k = Object.keys(usage); while (k.length > 14) delete usage[k.shift()];
    writeJson(F('usage.json'), usage);
  }, 60000);
  ipcMain.handle('usage', () => { flush(); return usage[day()] || {}; });

  // ---------- загрузки ----------
  const dl = app.getPath('downloads'), seen = {};
  const TMP = /\.(crdownload|part|download|opdownload)$/i;
  setInterval(() => {
    let files; try { files = fs.readdirSync(dl); } catch { return; }
    const act = files.filter(f => TMP.test(f));
    const out = [];
    for (const f of act) {
      let size = 0; try { size = fs.statSync(path.join(dl, f)).size; } catch {}
      const prev = seen[f] == null ? size : seen[f]; seen[f] = size;
      if (size > 0) out.push({ name: f.replace(TMP, '').replace(/^Не подтверждено \d+\.?|^Unconfirmed \d+\.?/i, '') || 'файл', size, speed: Math.max(0, size - prev) });
    }
    for (const k of Object.keys(seen)) if (!act.includes(k)) { delete seen[k]; const name = k.replace(TMP, ''); if (files.includes(name)) send('download-done', { name, path: path.join(dl, name) }); }
    send('downloads', out);
  }, 1000);

  // ---------- поиск программ ----------
  let index = null;
  function scan(dir, acc, lv = 0) {
    let e; try { e = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const x of e) {
      const p = path.join(dir, x.name);
      if (x.isDirectory() && lv < 3) scan(p, acc, lv + 1);
      else if (/\.(lnk|url)$/i.test(x.name) && !/uninstall|удал|readme|help|справк|документац/i.test(x.name)) acc.push({ name: x.name.replace(/\.(lnk|url)$/i, ''), path: p });
    }
  }
  ipcMain.handle('index', () => {
    if (!index) {
      const a = [];
      scan(path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'), a);
      scan(path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'), a);
      const m = new Map(); a.forEach(i => m.set(i.name.toLowerCase(), i)); index = [...m.values()];
      setTimeout(() => { index = null; }, 10 * 60e3);
    }
    return index;
  });
  const iconCache = {};
  ipcMain.handle('icon', async (_, p) => {
    if (iconCache[p] !== undefined) return iconCache[p];
    let r = null;
    try { let t = p; if (/\.lnk$/i.test(p)) { const s = shell.readShortcutLink(p); if (s.target) t = s.target; } const im = await app.getFileIcon(t, { size: 'normal' }); r = im.isEmpty() ? null : im.toDataURL(); } catch {}
    return (iconCache[p] = r);
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
  ipcMain.handle('open-path', (_, p) => launch(p));

  // ---------- индекс файлов всего компьютера ----------
  const FSKIP = /^(\$recycle\.bin|system volume information|windows|program files|program files \(x86\)|programdata|appdata|node_modules|\.git|\.cache|temp|tmp|cache|\$windows\.~bt|\$winreagent|recovery|msocache|perflogs|onedrivetemp)$/i;
  let files = [], indexing = false;
  async function buildIndex() {
    if (indexing) return; indexing = true;
    const out = [], drives = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(d => d + ':\\').filter(d => { try { return fs.existsSync(d); } catch { return false; } });
    const stack = drives.map(d => [d, 0]); let n = 0;
    while (stack.length && out.length < 250000) {
      const [dir, lv] = stack.pop();
      let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (e.name.startsWith('.') || e.name.startsWith('$')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!FSKIP.test(e.name) && lv < 12) { stack.push([p, lv + 1]); out.push({ n: e.name.toLowerCase(), p, d: 1 }); } }
        else out.push({ n: e.name.toLowerCase(), p });
      }
      if (++n % 60 === 0) await new Promise(r => setTimeout(r, 10));
    }
    files = out; indexing = false;
    await findGames();
  }

  // ---------- игры ----------
  let games = [];
  async function findGames() {
    const roots = new Set(), drives = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(d => d + ':\\').filter(d => { try { return fs.existsSync(d); } catch { return false; } });
    for (const b of ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']) {
      roots.add(path.join(b, 'steamapps', 'common'));
      try { const v = fs.readFileSync(path.join(b, 'steamapps', 'libraryfolders.vdf'), 'utf8'); for (const m of v.matchAll(/"path"\s+"([^"]+)"/g)) roots.add(path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps', 'common')); } catch {}
    }
    for (const d of drives) for (const s of ['SteamLibrary\\steamapps\\common', 'Games', 'Игры', 'Epic Games', 'Program Files\\Epic Games', 'Riot Games', 'XboxGames', 'Program Files\\EA Games', 'Program Files (x86)\\Origin Games', 'Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games']) roots.add(d + s);
    const BAD = /unins|crash|setup|redist|install|helper|report|vc_|dxsetup|ue4prereq|launcherpatch|easyanticheat|be(service|_)|cef|update/i;
    const out = [];
    for (const r of roots) {
      let dirs; try { dirs = fs.readdirSync(r, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { continue; }
      for (const g of dirs) {
        if (/^(steamworks shared|directx|_commonredist|launcher|engine)$/i.test(g.name)) continue;
        const gp = path.join(r, g.name); let best = null;
        const look = (dir, lv) => { let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
          for (const e of es) { const p = path.join(dir, e.name);
            if (e.isFile() && /\.exe$/i.test(e.name) && !BAD.test(e.name)) { let sz = 0; try { sz = fs.statSync(p).size; } catch {} if (!best || sz > best.sz) best = { p, sz }; }
            else if (e.isDirectory() && lv < 3 && !/redist|support|tools|_/i.test(e.name.slice(0, 1) === '_' ? '_' : e.name)) look(p, lv + 1); } };
        look(gp, 0);
        if (best && !out.some(x => x.name === g.name)) out.push({ name: g.name, exe: best.p });
        await new Promise(r2 => setImmediate(r2));
      }
    }
    games = out;
  }
  ipcMain.handle('games', () => games);

  // ---------- что Nex знает о компьютере ----------
  c.pcInfo = () => {
    const top = d => { try { return fs.readdirSync(d).filter(x => !x.startsWith('.') && !/^desktop\.ini$/i.test(x)).slice(0, 25).join(', '); } catch { return ''; } };
    const L = [];
    if (games.length) L.push(`Игры на компьютере (${games.length}): ${games.map(g => g.name).slice(0, 60).join(', ')}.`);
    const dk = top(app.getPath('desktop')); if (dk) L.push(`На рабочем столе: ${dk}.`);
    const dc = top(app.getPath('documents')); if (dc) L.push(`В Документах: ${dc}.`);
    const dl = top(app.getPath('downloads')); if (dl) L.push(`В Загрузках: ${dl}.`);
    if (files.length) L.push(`Всего проиндексировано файлов и папок: ${files.length}.`);
    return L.join(' ');
  };

  // ---------- действия ----------
  function findThing(q) {
    q = String(q || '').toLowerCase().trim(); if (!q) return null;
    const g = games.find(x => x.name.toLowerCase() === q) || games.find(x => x.name.toLowerCase().includes(q));
    if (g) return { name: g.name, path: g.exe };
    let best = null, score = 1e9;
    for (const f of files) {
      if (!f.n.includes(q)) continue;
      const s = (/\.(lnk|exe|url)$/.test(f.n) ? 0 : f.d ? 50 : 200) + (f.n.startsWith(q) ? 0 : 20) + f.n.length;
      if (s < score) { score = s; best = f; }
    }
    return best && { name: path.basename(best.p).replace(/\.(lnk|url)$/i, ''), path: best.p };
  }
  const MSG_PS = {
    telegram: `$p = Get-Process Telegram -EA 0 | ? MainWindowHandle -ne 0 | select -f 1
if(!$p){ Start-Process 'tg://'; Start-Sleep 4; $p = Get-Process Telegram -EA 0 | ? MainWindowHandle -ne 0 | select -f 1 }
if(!$p){ exit 3 }
$k='{ESC}{ESC}'`,
    discord: `$p = Get-Process Discord -EA 0 | ? MainWindowHandle -ne 0 | select -f 1
if(!$p){ exit 3 }
$k='^k'`
  };
  async function sendMsg(appN, who, text) {
    appN = /disc|диск/i.test(appN) ? 'discord' : 'telegram';
    who = String(who).trim().split(/\s+/).map(w => w.length >= 4 && /[еуюи]$/i.test(w) ? w.slice(0, -1) : w).join(' ');
    const old = clipboard.readText();
    const r = await runPs(`Add-Type -AssemblyName System.Windows.Forms
${MSG_PS[appN]}
$ws = New-Object -ComObject WScript.Shell
$ws.AppActivate($p.Id) | Out-Null; Start-Sleep -m 700
[System.Windows.Forms.SendKeys]::SendWait($k); Start-Sleep -m 400
Set-Clipboard -Value ${psq(who)}; [System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -m 1300
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -m 900
Set-Clipboard -Value ${psq(text)}; [System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -m 300
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`, 25000);
    setTimeout(() => { try { clipboard.writeText(old); } catch {} }, 600);
    if (r.code === 3) return `Открой ${appN === 'discord' ? 'Discord' : 'Telegram'} и войди — тогда смогу написать.`;
    return r.ok ? `Отправил «${text}» → ${who} (${appN === 'discord' ? 'Discord' : 'Telegram'}).` : 'Не получилось отправить сообщение.';
  }
  async function nightLight() {
    const r = await runPs(`$k='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\DefaultAccount\\Current\\default$windows.data.bluelightreduction.bluelightreductionstate\\windows.data.bluelightreduction.bluelightreductionstate'
if(!(Test-Path $k)){ Write-Output 'none'; exit }
$d=[byte[]](Get-ItemProperty -Path $k -Name Data).Data
if($d[18] -eq 0x15){ $n=[byte[]]($d[0..21]+$d[25..($d.Length-1)]); $n[18]=0x13; $s='off' } else { $n=[byte[]]($d[0..21]+[byte[]](0x10,0x00)+$d[22..($d.Length-1)]); $n[18]=0x15; $s='on' }
for($i=10;$i -lt 15;$i++){ if($n[$i] -ne 0xff){ $n[$i]++; break } }
Set-ItemProperty -Path $k -Name Data -Value $n -Type Binary
Write-Output $s`);
    return r.out === 'on' || r.out === 'off' ? { ok: true, on: r.out === 'on' } : { ok: false };
  }
  ipcMain.handle('night-light', () => nightLight());
  c.act = async (kind, arg) => {
    if (kind === 'open') { const t = findThing(arg); if (!t) return `Не нашёл «${arg}» на компьютере.`; const er = await launch(t.path); return er ? `Не смог открыть ${t.name}: ${er}` : `Открываю ${t.name}.`; }
    if (kind === 'msg') { const [a, w, ...rest] = String(arg).split('|'); return sendMsg(a, w || '', rest.join('|')); }
    if (kind === 'night') { const r = await nightLight(); return r.ok ? (r.on ? 'Ночной свет включён.' : 'Ночной свет выключен.') : 'Не смог переключить ночной свет.'; }
    return '';
  };
  c.quick = async text => {
    const t = text.trim().replace(/[.!]+$/, '');
    let m = t.match(/^(?:напиши|отправь|скажи)\s+(?:контакту\s+|сообщение\s+)?(.+?)\s+(?:в\s+(телеграм\w*|телеге|тг|дискорд\w*|discord|telegram)\s+)?(?:слово|сообщение|текст|что)\s*[:«"]?\s*(.+?)[»"]?$/i);
    if (m) return sendMsg(m[2] || 'telegram', m[1].replace(/\s+в\s+(телеграм\w*|телеге|тг|дискорд\w*)$/i, ''), m[3]);
    m = t.match(/^(?:открой|запусти|включи игру)\s+(.+)$/i);
    if (m && !/^(ночной|вай|wi|блют|blue)/i.test(m[1])) { const x = findThing(m[1]); if (x) { const er = await launch(x.path); return er ? `Не смог открыть ${x.name}: ${er}` : `Открываю ${x.name}.`; } }
    if (/^(включи|выключи|переключи)\s+ночной\s+(свет|режим)/i.test(t)) return c.act('night');
    return null;
  };

  // ---------- подсказки городов ----------
  ipcMain.handle('city-suggest', async (_, q) => {
    q = String(q || '').trim(); if (q.length < 2) return [];
    try { const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=${c.settings.lang || 'ru'}&name=${encodeURIComponent(q)}`)).json();
      return (j.results || []).map(x => ({ name: x.name, sub: [x.admin1, x.country].filter(Boolean).join(', ') })); } catch { return []; }
  });
  setTimeout(buildIndex, 15000); setInterval(buildIndex, 30 * 60e3);
  ipcMain.handle('files-search', (_, q) => {
    q = String(q || '').toLowerCase().trim();
    if (q.length < 2) return { list: [], total: files.length, indexing };
    const res = [];
    for (const f of files) if (f.n.includes(q)) { res.push(f); if (res.length > 500) break; }
    res.sort((a, b) => (a.n.startsWith(q) ? 0 : 1) - (b.n.startsWith(q) ? 0 : 1) || a.n.length - b.n.length);
    return { list: res.slice(0, 8).map(f => ({ name: path.basename(f.p), path: f.p, dir: !!f.d })), total: files.length, indexing };
  });

  // ---------- курсы валют ----------
  let rates = null, ratesAt = 0;
  ipcMain.handle('rates', async () => {
    if (rates && Date.now() - ratesAt < 6 * 3600e3) return rates;
    try { const j = await (await fetch('https://open.er-api.com/v6/latest/USD')).json(); if (j.rates) { rates = j.rates; ratesAt = Date.now(); } } catch {}
    return rates;
  });

  // ---------- переводчик ----------
  const NAMES = { ru: 'русский', en: 'английский', de: 'немецкий', uk: 'украинский', zh: 'китайский', ja: 'японский' };
  async function translate(text) {
    const L = c.settings.lang || 'ru', cyr = /[а-яёіїєґ]/i.test(text);
    const to = (L === 'ru' || L === 'uk') && cyr ? 'en' : L;
    if (!c.aiReady()) return { ok: false, err: 'Ключ ИИ не вшит в сборку (секрет GEMINI_KEY).' };
    try {
      const t = await c.ai(`Ты переводчик. Переведи текст на ${NAMES[to]} язык. Ответь только переводом, без кавычек и пояснений.`, text);
      return t.trim() ? { ok: true, text: t.trim(), to } : { ok: false, err: 'ИИ вернул пустой ответ' };
    } catch (e) {
      const m = String(e.message || e);
      return { ok: false, err: /location is not supported/i.test(m) ? 'Gemini не работает без VPN в твоей стране' : /API key|401|403/i.test(m) ? 'Ключ не подходит' : /429|quota/i.test(m) ? 'Лимит запросов, подожди минуту' : /fetch failed|ENOTFOUND/i.test(m) ? 'Нет связи с ИИ' : m.slice(0, 120) };
    }
  }
  const notify = (title, body) => { try { new Notification({ title, body: body.slice(0, 250), icon: c.LOGO }).show(); } catch {} };
  async function hotTranslate() {
    const old = clipboard.readText();
    clipboard.writeText('');
    try { await c.ps('copy-sel', {}, 4000); } catch {}
    let t = clipboard.readText().trim();
    if (!t) { t = old.trim(); }
    clipboard.writeText(old);
    if (!t) { notify('Nex', 'Выдели слово и нажми Ctrl+Alt+T'); return; }
    t = t.slice(0, 1500);
    const pop = openPopup(t);
    const L = c.settings.lang || 'ru', cyr = /[а-яёіїєґ]/i.test(t);
    const to = (L === 'ru' || L === 'uk') && cyr ? 'en' : L;
    const short = t.split(/\s+/).length <= 4;
    let tr = '', ex = '', err = '';
    if (!c.aiReady()) err = 'ИИ ещё не готов.';
    else try {
      const a = await c.ai(short
        ? `Ты словарь. Переведи на ${NAMES[to]} язык. Ответ строго в 2 строки: 1) перевод (1–3 варианта через запятую); 2) очень короткое объяснение значения на языке «${NAMES[L]}». Без нумерации и кавычек.`
        : `Ты переводчик. Переведи текст на ${NAMES[to]} язык. Ответь только переводом.`, t);
      const ls = a.trim().split(/\n+/).map(s => s.replace(/^\s*(\d[.)]|[-•])\s*/, '').trim()).filter(Boolean);
      tr = short ? ls[0] || '' : ls.join('\n'); ex = short ? ls.slice(1).join(' ') : '';
      if (!tr) err = 'Не получилось перевести.';
    } catch (e) { err = 'Не получилось перевести.'; }
    if (pop.isDestroyed()) return;
    await pop.ready;
    const h = await pop.webContents.executeJavaScript(`setOut(${JSON.stringify(tr)}, ${JSON.stringify(ex)}, ${JSON.stringify(err)})`).catch(() => 0);
    if (h && !pop.isDestroyed()) { const [x, y] = pop.getPosition(); const wa = screen.getDisplayNearestPoint({ x, y }).workArea; pop.setBounds({ x, y: Math.min(y, wa.y + wa.height - h), width: 340, height: Math.ceil(h) }); }
  }
  let popWin = null;
  function openPopup(text) {
    if (popWin && !popWin.isDestroyed()) popWin.close();
    const p = screen.getCursorScreenPoint(), wa = screen.getDisplayNearestPoint(p).workArea;
    const x = Math.min(Math.max(p.x - 30, wa.x), wa.x + wa.width - 340), y = Math.min(p.y + 18, wa.y + wa.height - 120);
    const pop = popWin = new (require('electron').BrowserWindow)({ x, y, width: 340, height: 90, frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: false, hasShadow: false });
    pop.setAlwaysOnTop(true, 'screen-saver');
    pop.ready = new Promise(res => pop.webContents.once('did-finish-load', res));
    pop.loadFile(path.join(__dirname, 'renderer', 'popup.html'));
    pop.ready.then(() => { if (pop.isDestroyed()) return; pop.webContents.executeJavaScript(`setSrc(${JSON.stringify(text.replace(/\s+/g, ' ').slice(0, 80))})`); pop.show(); });
    pop.on('blur', () => setTimeout(() => { if (!pop.isDestroyed()) pop.close(); }, 150));
    return pop;
  }
  ipcMain.handle('translate', (_, t) => translate(t));

  // ---------- запись экрана ----------
  ipcMain.handle('screen-source', async () => {
    const d = screen.getPrimaryDisplay();
    const s = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
    return (s.find(x => x.display_id === String(d.id)) || s[0]).id;
  });
  ipcMain.handle('save-video', (_, buf) => {
    const dir = path.join(app.getPath('videos'), 'Nex'); fs.mkdirSync(dir, { recursive: true });
    const n = new Date(), p2 = x => String(x).padStart(2, '0');
    const f = path.join(dir, `Запись ${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())} ${p2(n.getHours())}-${p2(n.getMinutes())}-${p2(n.getSeconds())}.webm`);
    fs.writeFileSync(f, Buffer.from(buf)); return f;
  });

  // ---------- горячие клавиши ----------
  globalShortcut.register('Control+Shift+Space', () => { if (show()) send('search'); });
  const okT = globalShortcut.register('Control+Alt+T', hotTranslate) || globalShortcut.register('Alt+Shift+T', hotTranslate);
  if (!okT) setTimeout(() => notify('Nex', 'Горячая клавиша перевода занята другой программой'), 5000);

  return c;
};
