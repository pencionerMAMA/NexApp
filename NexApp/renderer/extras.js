// Nex 2.2 — поиск, переводчик, напоминания, загрузки, громкость, зарядка, наушники,
// пипетка, запись экрана, помодоро, расписание, статистика, реакции на время, темы.

// ---------- поиск (Ctrl+Shift+Space) ----------
let srchItems = [], srchSel = 0, appIndex = null, rates = null;
function openSearch() {
  if (S.mode === 'onb') return;
  S.mode = 'search'; S.toast = null; api.focus();
  $('sq').value = ''; runSearch(''); refresh();
  setTimeout(() => $('sq').focus({ preventScroll: true }), 150);
  if (!appIndex) api.index().then(i => { appIndex = i || []; runSearch($('sq').value); });
  if (!rates) api.rates().then(r => { rates = r; });
}
api.on('search', openSearch);
$('hSearch').addEventListener('click', e => { e.stopPropagation(); openSearch(); });

function calc(q) {
  const s = q.replace(/\s+/g, '').replace(/,/g, '.').replace(/[×xх]/g, '*').replace(/[÷:]/g, '/');
  if (!/^[\d.+\-*/()%^]+$/.test(s) || !/\d[+\-*/^%]/.test(s)) return null;
  let i = 0;
  const num = () => { const m = s.slice(i).match(/^\d+(\.\d+)?/); if (!m) throw 0; i += m[0].length; return +m[0]; };
  const atom = () => { if (s[i] === '-') { i++; return -atom(); } if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') throw 0; return v; } let v = num(); if (s[i] === '%') { i++; v /= 100; } return v; };
  const pow = () => { const b = atom(); if (s[i] === '^') { i++; return b ** pow(); } return b; };
  const term = () => { let v = pow(); while (s[i] === '*' || s[i] === '/') { const o = s[i++], r = pow(); v = o === '*' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (s[i] === '+' || s[i] === '-') { const o = s[i++], r = term(); v = o === '+' ? v + r : v - r; } return v; };
  try { const v = expr(); return i === s.length && Number.isFinite(v) ? +v.toFixed(8) : null; } catch { return null; }
}
const CUR = { '$': 'USD', usd: 'USD', доллар: 'USD', доллара: 'USD', долларов: 'USD', '€': 'EUR', eur: 'EUR', евро: 'EUR', '₽': 'RUB', rub: 'RUB', руб: 'RUB', рубль: 'RUB', рубля: 'RUB', рублей: 'RUB', '₴': 'UAH', uah: 'UAH', грн: 'UAH', гривен: 'UAH', kzt: 'KZT', тенге: 'KZT', byn: 'BYN', gbp: 'GBP', '£': 'GBP', cny: 'CNY', юань: 'CNY', юаней: 'CNY', jpy: 'JPY', иен: 'JPY', try: 'TRY', лир: 'TRY' };
function conv(q) {
  const m = q.toLowerCase().trim().match(/^([\d.,\s]+)\s*([^\d\s]+)(?:\s+(?:в|in|to|->)\s+([^\d\s]+))?$/);
  if (!m || !rates) return null;
  const n = parseFloat(m[1].replace(/\s/g, '').replace(',', '.')), from = CUR[m[2]];
  if (!from || !n) return null;
  const home = { ru: 'RUB', uk: 'UAH', de: 'EUR', en: 'USD', zh: 'CNY', ja: 'JPY' }[I18N.lang] || 'RUB';
  const to = m[3] ? CUR[m[3]] : (from === home ? 'USD' : home);
  if (!to || !rates[from] || !rates[to]) return null;
  return `${(n / rates[from] * rates[to]).toLocaleString(LOC(), { maximumFractionDigits: 2 })} ${to}`;
}
function runSearch(q) {
  q = q.trim(); const items = [];
  const c = calc(q);
  if (c != null) items.push({ big: true, icon: '=', title: String(c), sub: 'Enter — скопировать', go: () => { api.clipCopy(String(c)); toast('Скопировано: ' + c, { force: true }); } });
  const cv = conv(q);
  if (cv) items.push({ big: true, icon: '¤', title: cv, sub: 'Курс валют', go: () => { api.clipCopy(cv); toast('Скопировано: ' + cv, { force: true }); } });
  const ql = q.toLowerCase();
  if (q) {
    S.apps.filter(a => a.name.toLowerCase().includes(ql)).forEach(a => items.push({ img: a.icon, title: a.name, sub: 'Мои программы', go: () => api.appsOpen(a.id) }));
    (appIndex || []).filter(a => a.name.toLowerCase().includes(ql) && !S.apps.some(f => f.name === a.name))
      .sort((a, b) => a.name.toLowerCase().indexOf(ql) - b.name.toLowerCase().indexOf(ql)).slice(0, 6)
      .forEach(a => items.push({ ip: a.path, icon: a.name.charAt(0), title: a.name, sub: 'Программа', go: () => api.openPath(a.path) }));
    items.push({ icon: 'N', title: 'Спросить Nex: ' + q, sub: 'Чат', keep: true, go: () => { openIsland('chat'); setTimeout(() => send(q), 400); } });
  } else {
    S.apps.slice(0, 6).forEach(a => items.push({ img: a.icon, title: a.name, sub: 'Мои программы', go: () => api.appsOpen(a.id) }));
    if (!items.length) items.push({ icon: '?', title: 'Программа, файл, 2+2*3, 100 usd или вопрос', sub: '', go: () => {} });
  }
  srchItems = items; srchSel = 0; renderSearch();
  if (q.length >= 2) api.filesSearch(q).then(r => {
    if ($('sq').value.trim() !== q || !r || !r.list.length) return;
    const fi = r.list.map(f => ({ ip: f.path, icon: f.dir ? '▸' : f.name.charAt(0), title: f.name, sub: f.dir ? 'Папка' : f.path.split('\\').slice(0, -1).slice(-2).join('\\'), go: () => api.openPath(f.path) }));
    const at = srchItems.findIndex(it => it.keep);
    srchItems.splice(at < 0 ? srchItems.length : at, 0, ...fi);
    renderSearch();
  });
}
function renderSearch() {
  $('sres').innerHTML = srchItems.map((it, i) => `<button class="sr${i === srchSel ? ' sel' : ''}${it.big ? ' big' : ''}" data-i="${i}" style="animation-delay:${i * 25}ms">${it.img ? `<img src="${it.img}" alt="">` : `<span class="si" data-ip="${esc(it.ip || '')}">${esc(it.icon || '')}</span>`}<b>${esc(it.title)}</b><small>${esc(it.sub)}</small></button>`).join('');
  $$('#sres .si').forEach(async el => { if (!el.dataset.ip) return; const ic = await api.icon(el.dataset.ip); if (ic && el.isConnected) el.outerHTML = `<img src="${ic}" alt="">`; });
  layout();
}
function pick(i) {
  const it = srchItems[i]; if (!it) return;
  if (!it.keep) { S.mode = 'mini'; refresh(); }
  it.go();
}
$('sq').addEventListener('input', debounce(() => runSearch($('sq').value), 70));
$('sq').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); srchSel = (srchSel + (e.key === 'ArrowDown' ? 1 : -1) + srchItems.length) % srchItems.length; $$('#sres .sr').forEach((b, i) => b.classList.toggle('sel', i === srchSel)); }
  else if (e.key === 'Enter') pick(srchSel);
  else if (e.key === 'Escape') closeIsland();
});
$('sres').addEventListener('click', e => { const b = e.target.closest('.sr'); if (b) pick(+b.dataset.i); });

// ---------- переводчик (скопируй текст → Ctrl+Alt+T) ----------
api.on('translate-start', () => toast('Перевожу…', { force: true, ms: 20000 }));
api.on('translate-done', r => {
  if (!r.ok) return toast(r.err || 'Не получилось перевести', { force: true, ms: 6000 });
  if (r.text.length <= 42) toast(r.text + ' · скопировано', { force: true, ms: 6000 });
  else { S.toast = null; refresh(); openIsland('chat'); addMsg(false, '**Перевод** (уже скопирован):\n\n' + r.text); }
});

// ---------- напоминания ----------
S.rem = [];
const UNITS = { с: 1, сек: 1, секунд: 1, секунды: 1, секунду: 1, мин: 60, минут: 60, минуты: 60, минуту: 60, минутку: 60, час: 3600, часа: 3600, часов: 3600, день: 86400, дня: 86400, дней: 86400, sec: 1, seconds: 1, min: 60, mins: 60, minute: 60, minutes: 60, hour: 3600, hours: 3600 };
window.preSend = text => {
  let m = text.match(/^(?:напомни|remind me)(?:\s+мне)?\s+(?:через|in)\s+(\d+)?\s*([a-zа-яё]+)\s+(.+)$/i), at, what;
  if (m && UNITS[m[2].toLowerCase()]) { at = Date.now() + (+(m[1] || 1)) * UNITS[m[2].toLowerCase()] * 1000; what = m[3]; }
  else if ((m = text.match(/^(?:напомни|remind me)(?:\s+мне)?\s+(?:в|at)\s+(\d{1,2})[:.](\d{2})\s+(.+)$/i))) {
    const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1);
    at = d.getTime(); what = m[3];
  } else return false;
  what = what.replace(/^(что|чтобы|to)\s+/i, '');
  api.remAdd({ at, text: what }).then(r => { S.rem = r; renderRem(); });
  addMsg(true, text);
  addMsg(false, `Хорошо! Напомню в **${new Date(at).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' })}**: ${what}`);
  return true;
};
function renderRem() {
  const r = [...(S.rem || [])].sort((a, b) => a.at - b.at);
  $('remList').innerHTML = r.length
    ? r.map(x => `<div class="task" data-id="${x.id}"><span style="font-family:var(--mono);color:var(--acc);flex:none">${new Date(x.at).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' })}</span><span>${esc(x.text)}</span><button class="x">×</button></div>`).join('')
    : '<p class="hint" style="padding:2px 6px">Напиши в чате: «напомни через 10 минут позвонить маме»</p>';
  if (S.mode === 'open') layout();
}
$('remList').addEventListener('click', async e => { if (!e.target.closest('.x')) return; S.rem = await api.remDel(+e.target.closest('.task').dataset.id); renderRem(); });
api.remList().then(r => { S.rem = r || []; });
api.on('reminders', r => { S.rem = r; renderRem(); });
api.on('remind', r => {
  beep(); setTimeout(beep, 900);
  toast('Напоминание: ' + r.text, { force: true, ms: 12000 });
  addMsg(false, `**Напоминание:** ${r.text}`);
});

// ---------- загрузки ----------
const MB = x => (x / 1048576).toFixed(1);
api.on('downloads', list => {
  if (!list.length || S.mode !== 'mini' || (S.toast && !S.dlToast)) return;
  const d = list[0];
  toast(' ', { dl: true, ms: 1700, html: `<span class="osd"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="flex:none;color:var(--acc)"><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</span><span style="font-family:var(--mono);color:var(--acc);flex:none">${MB(d.size)} МБ · ${MB(d.speed)} МБ/с</span></span>` });
});
api.on('download-done', d => toast('Скачано: ' + d.name + ' · открыть', { ms: 6000, act: () => api.showItem(d.path) }));

// ---------- громкость: своя полоска вместо стандартной ----------
let lastVol = null, volBusy = false;
setInterval(async () => {
  if (S.mode !== 'mini' || volBusy) return;
  volBusy = true; const r = await api.sys('vol-get'); volBusy = false;
  if (!r.ok) return;
  const v = r.data.mute ? 0 : r.data.vol;
  if (lastVol !== null && v !== lastVol) toast(' ', { force: true, ms: 1500, html: `<span class="osd"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="flex:none"><path d="M4 9h4l5-4v14l-5-4H4z"/></svg><span class="ob"><i style="width:${v}%"></i></span><span style="font-family:var(--mono);width:28px;text-align:right;flex:none">${r.data.mute ? 'off' : v}</span></span>` });
  lastVol = v; S.vol = r.data.vol;
}, 1200);

// ---------- зарядка ----------
if (navigator.getBattery) navigator.getBattery().then(b => {
  b.addEventListener('chargingchange', () => {
    const p = Math.round(b.level * 100);
    if (b.charging) toast(' ', { force: true, ms: 3500, html: `<span class="osd" style="justify-content:center"><span class="batt-anim"><i style="width:${p}%"></i></span><b style="color:var(--ok)">Заряжается · ${p}%</b></span>` });
    else toast('Зарядка отключена · ' + p + '%', { force: true });
  });
});

// ---------- наушники и Bluetooth-устройства ----------
let btPrev = null;
setInterval(async () => {
  if (S.bt !== 'On') return;
  const r = await api.sys('bt-list'); if (!r.ok) return;
  const con = r.data.devs.filter(d => d.connected).map(d => d.name);
  if (btPrev) {
    con.filter(n => !btPrev.includes(n)).forEach(n => toast('Подключено: ' + n, { force: true, ms: 4000 }));
    btPrev.filter(n => !con.includes(n)).forEach(n => toast('Отключено: ' + n, { ms: 3000 }));
  }
  btPrev = con;
}, 12000);

// ---------- пипетка ----------
$('qPick').onclick = async () => {
  if (!window.EyeDropper) return toast('Пипетка не поддерживается', { force: true });
  S.picking = true;
  try {
    const r = await new EyeDropper().open();
    api.clipCopy(r.sRGBHex);
    toast(' ', { force: true, ms: 4500, html: `<span class="osd" style="justify-content:center"><i style="width:16px;height:16px;border-radius:50%;background:${r.sRGBHex};flex:none;box-shadow:0 0 0 2px rgba(255,255,255,.3)"></i><b style="font-family:var(--mono)">${r.sRGBHex}</b><span style="color:var(--mut)">скопировано</span></span>` });
  } catch {}
  S.picking = false;
};

// ---------- запись экрана ----------
let rec = null, recT0 = 0, recTick;
$('qRec').onclick = async () => {
  if (rec) return rec.stop();
  try {
    const id = await api.screenSource();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id, maxFrameRate: 30 } } });
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    const chunks = [];
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); clearInterval(recTick); rec = null;
      $('qRec').classList.remove('on'); $('qRec').textContent = 'Запись';
      const f = await api.saveVideo(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
      toast('Видео сохранено · открыть', { force: true, ms: 6000, act: () => api.showItem(f) });
    };
    rec.start(1000); recT0 = Date.now();
    $('qRec').classList.add('on'); closeIsland();
    recTick = setInterval(() => {
      const s = Math.floor((Date.now() - recT0) / 1000);
      $('qRec').textContent = 'Стоп · ' + mmss(s);
      if (S.mode === 'mini' && (!S.toast || S.recToast)) { toast(' ', { force: true, ms: 1300, act: () => rec && rec.stop(), html: `<span class="osd"><span class="rec"></span><b>Запись ${mmss(s)}</b><span style="color:var(--mut);margin-left:auto">нажми — стоп</span></span>` }); S.recToast = true; }
    }, 1000);
  } catch { rec = null; toast('Не удалось начать запись', { force: true }); }
};

// ---------- помодоро ----------
S.pomo = { on: false, phase: 'work', n: 0 };
function pomoTxt() { $('pomoTxt').textContent = S.pomo.on ? (S.pomo.phase === 'work' ? `Работа · цикл ${S.pomo.n + 1} · уведомления скрыты` : 'Перерыв — отдохни') : ''; }
function startT(sec) { S.timer = { total: sec, left: sec, run: true, end: Date.now() + sec * 1000 }; renderTimer(); refresh(); }
async function setDnd(on) { const r = await api.sys('dnd', { on }); if (r.ok) { S.settings.dnd = on; api.saveSettings({ dnd: on }); } }
$('pomoSw').onclick = () => {
  S.pomo = { on: !S.pomo.on, phase: 'work', n: 0 };
  $('pomoSw').classList.toggle('on', S.pomo.on);
  S.timer = { total: 1500, left: 1500, run: false, end: 0 };
  if (!S.pomo.on && S.settings.dnd) setDnd(false);
  pomoTxt(); renderTimer();
};
$('tGo').addEventListener('click', () => { if (S.pomo.on && S.pomo.phase === 'work' && S.timer.run) setDnd(true); });
window.onTimerDone = () => {
  beep();
  if (!S.pomo.on) return toast('Таймер закончился!', { force: true, ms: 6000 });
  if (S.pomo.phase === 'work') {
    S.pomo.n++; S.pomo.phase = 'break';
    const m = S.pomo.n % 4 === 0 ? 15 : 5;
    startT(m * 60); setDnd(false);
    toast(`Перерыв ${m} мин — отдохни!`, { force: true, ms: 6000 });
  } else { S.pomo.phase = 'work'; startT(1500); setDnd(true); toast('Снова за работу — 25 минут', { force: true, ms: 6000 }); }
  pomoTxt();
};

// ---------- расписание уроков ----------
const DK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
let schDay = (new Date().getDay() + 6) % 7;
const school = () => S.tasks.school || (S.tasks.school = {});
function nextLesson() {
  const today = school()[DK[(new Date().getDay() + 6) % 7]] || [];
  const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return today.find(l => l.t > hm) || null;
}
function renderSchool() {
  $('schDays').innerHTML = days().map((d, i) => `<button data-d="${i}" class="${i === schDay ? 'on' : ''}">${d}</button>`).join('');
  const L = school()[DK[schDay]] || [];
  $('schList').innerHTML = L.length
    ? L.map((l, i) => `<div class="task" data-i="${i}"><span style="font-family:var(--mono);color:var(--acc);flex:none;width:50px">${l.t}</span><span>${esc(l.name)}</span><button class="x">×</button></div>`).join('')
    : '<div class="empty">Нет уроков. Добавь время и название внизу.</div>';
  const n = nextLesson(); $('schNext').textContent = n ? `Следующий: ${n.name} в ${n.t}` : '';
  if (S.mode === 'open') layout();
}
$('schDays').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) { schDay = +b.dataset.d; renderSchool(); } });
$('schName').addEventListener('keydown', e => {
  const name = e.target.value.trim(), t = $('schTime').value;
  if (e.key !== 'Enter' || !name || !t) return;
  const L = school()[DK[schDay]] = [...(school()[DK[schDay]] || []), { t, name }].sort((a, b) => a.t.localeCompare(b.t));
  e.target.value = ''; saveTasks(); renderSchool();
});
$('schList').addEventListener('click', e => {
  if (!e.target.closest('.x')) return;
  school()[DK[schDay]].splice(+e.target.closest('.task').dataset.i, 1); saveTasks(); renderSchool();
});
const warned = new Set();
setInterval(() => {
  const n = nextLesson(); if (!n) return;
  const [h, m] = n.t.split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0);
  const left = Math.round((d - Date.now()) / 60000), key = d.toDateString() + n.t;
  if (left <= 10 && left >= 0 && !warned.has(key)) { warned.add(key); toast(`Через ${left} мин: ${n.name}`, { force: true, ms: 7000 }); }
}, 30000);

// ---------- статистика ----------
async function renderUsage() {
  const u = await api.usage();
  const arr = Object.entries(u || {}).filter(([, s]) => s >= 60).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = arr[0] ? arr[0][1] : 1, fmt = s => s >= 3600 ? `${Math.floor(s / 3600)} ч ${Math.round(s % 3600 / 60)} мин` : `${Math.round(s / 60)} мин`;
  $('usage').innerHTML = arr.length
    ? arr.map(([n, s]) => `<div class="meter"><div><span>${esc(n)}</span><span>${fmt(s)}</span></div><div class="mbar"><i style="width:${s / max * 100}%"></i></div></div>`).join('')
    : '<p class="hint">Пока мало данных — загляни позже.</p>';
  if (S.mode === 'open') layout();
}

// ---------- темы ----------
let lastTheme = null;
function applyFx() {
  const th = P().theme || 'none';
  $$('#sTheme button').forEach(b => b.classList.toggle('on', b.dataset.v === th));
  if (th === lastTheme) return; lastTheme = th;
  const fx = $('fx'); fx.className = 'fx ' + th; fx.innerHTML = '';
  if (th === 'none') return;
  for (let i = 0; i < 28; i++) {
    const e = document.createElement('i'), s = 2 + Math.random() * 3;
    e.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${5 + Math.random() * 7}s;animation-delay:${-Math.random() * 10}s;--dx:${(Math.random() - .5) * 60}px;` +
      (th === 'ny' ? 'background:rgba(255,255,255,.85)' : `background:hsl(${18 + Math.random() * 22} 100% 56%);box-shadow:0 0 6px #ff7a1a`);
    fx.appendChild(e);
  }
}
$('sTheme').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setP({ theme: b.dataset.v }); });

// ---------- реакции на время ----------
setTimeout(() => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12 && S.weather) { const w = S.weather.current; toast(`${hello()}! Сейчас ${Math.round(w.temperature_2m)}°, ${I18N.T(WMO(w.weather_code)[0]).toLowerCase()}`, { ms: 6000 }); }
}, 7000);
let nightKey = '';
setInterval(() => {
  const d = new Date(), h = d.getHours(), k = new Date(d - (h < 4 ? 864e5 : 0)).toDateString();
  if ((h >= 23 || h < 4) && nightKey !== k) { nightKey = k; toast('Уже поздно — может, пора спать?', { ms: 7000 }); }
}, 60000);

// ---------- подключение к основным функциям ----------
const _showTab = showTab;
showTab = t => {
  _showTab(t);
  if (t === 'school') renderSchool();
  if (t === 'tasks') renderRem();
  if (t === 'system') renderUsage();
  if (t === 'timer') { $('pomoSw').classList.toggle('on', S.pomo.on); pomoTxt(); }
};
const _applyTheme = applyTheme;
applyTheme = () => { _applyTheme(); applyFx(); };
const _renderCal = renderCal;
renderCal = () => {
  _renderCal();
  const n = nextLesson();
  if (n) { $('evT').textContent = 'Следующий урок: ' + n.name; $('evS').textContent = 'в ' + n.t; }
};
