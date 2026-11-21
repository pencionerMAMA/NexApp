const api = window.nexApi;
const $ = id => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const setHtml = (id, h) => { const el = $(id); if (el && el.__h !== h) { el.__h = h; el.innerHTML = h; } };
const island = $('island');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = x => { x = Math.max(0, Math.floor(x || 0)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;

const SW = ['#8b7bff', '#4cc2ff', '#3fcf8e', '#f5d04c', '#ff8a3d', '#ff5d8f'];
const TAB_H = { home: 296, weather: 250, chat: 440, tasks: 370, clip: 362, connect: 400, system: 262, timer: 214, settings: 482 };
const ONB_H = { auth: 444, profile: 548, style: 474 , email: 430};
const LOC = () => ({ zh: 'zh-CN', ja: 'ja-JP', uk: 'uk-UA', de: 'de-DE', en: 'en-GB' }[I18N.lang] || 'ru-RU');
const days = () => [...Array(7)].map((_, i) => new Intl.DateTimeFormat(LOC(), { weekday: 'short' }).format(new Date(2024, 0, 1 + i)).replace('.', ''));
const monthName = d => { const s = new Intl.DateTimeFormat(LOC(), { month: 'long' }).format(d); return s.charAt(0).toUpperCase() + s.slice(1); };
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const ICON_SEND = $('sendB').innerHTML;
const ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

const S = {
  mode: 'mini', tab: 'home', hover: false, toast: null, toastAct: null, picking: false, step: 'auth',
  profile: null, settings: {}, tasks: { tasks: [], note: '' }, clips: [],
  media: null, cover: null, lastTitle: null,
  timer: { total: 1500, left: 1500, run: false, end: 0 },
  wifi: 'None', bt: 'None', ssid: '', nets: null, netErr: null, scanning: false, openNet: null, connecting: null, devs: null,
  vol: 50, bright: null, battery: null, weather: null, weatherAt: 0, wall: null,
  busy: false, current: null
};

// клики проходят сквозь прозрачную часть окна
let ignoring = true;
document.addEventListener('mousemove', e => {
  const hit = !!e.target.closest('[data-hit]');
  if (hit === ignoring) { ignoring = !hit; api.setIgnore(ignoring); }
});

// ---------- раскладка ----------
const P = () => S.profile || {};
const drop = () => (P().shape || 'drop') === 'drop';
const playing = () => S.media && S.media.status === 'Playing';
function layout() {
  let w, h, r;
  if (S.mode === 'onb') { w = 440; h = Math.min(590, $('onb').offsetHeight || ONB_H[S.step]); r = 34; }
  else if (S.mode === 'open') { w = 720; h = Math.min(590, $('full').offsetHeight || TAB_H[S.tab]); r = 34; }
  else if (S.mode === 'search') { w = 560; h = Math.min(450, $('srch').offsetHeight || 70); r = 26; }
  else if (S.toast) { w = 380; h = 40; }
  else { const live = playing() || S.timer.run; w = S.hover ? (live ? 330 : 250) : (live ? 260 : 210); h = S.hover ? 40 : 36; }
  if (r == null) r = h / 2;
  island.style.width = w + 'px'; island.style.height = h + 'px';
  island.style.borderRadius = drop() ? `0 0 ${r}px ${r}px` : r + 'px';
  island.style.top = drop() ? '0px' : '10px';
  island.className = 'm-' + S.mode + (drop() ? ' drop' : '');
}
function renderMini() {
  const t = S.toast, m = S.media, cov = playing() && S.cover && !t;
  $('miniCover').hidden = !cov; $('miniNex').hidden = !!cov;
  if (cov) $('miniCover').src = S.cover;
  let mid = '', right = '';
  if (t) mid = S.toastHtml || esc(t);
  else if (S.hover && m && m.title) mid = esc(m.title + (m.artist ? ' — ' + m.artist : ''));
  else if (S.hover) mid = esc(hello());
  if (!t) {
    if (S.timer.run) right = `<span style="color:var(--acc);font-family:var(--mono)">${mmss(S.timer.left)}</span>`;
    else if (m && m.title) right = `<span class="eq${playing() ? '' : ' paused'}"><i></i><i></i><i></i><i></i></span>`;
    else right = esc(clock());
  }
  $('miniText').innerHTML = mid;
  $('miniRight').innerHTML = right;
}
function refresh() { layout(); renderMini(); }
// островок не должен прокручиваться (фокус в поле ввода сдвигал всё содержимое вверх)
const noScroll = el => el.addEventListener('scroll', () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } });
[island, document.documentElement, document.body].forEach(noScroll);
window.addEventListener('scroll', () => window.scrollTo(0, 0));

let toastT;
function toast(text, { force, act, ms = 3400, html, dl } = {}) {
  if (S.settings.dnd && !force) return;
  clearTimeout(toastT);
  S.toast = text; S.toastAct = act || null; S.toastHtml = html || null; S.dlToast = !!dl; refresh();
  toastT = setTimeout(() => { S.toast = null; S.toastAct = null; S.toastHtml = null; refresh(); }, ms);
}
const clock = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
function hello() {
  const h = new Date().getHours(), n = P().name ? ', ' + P().name : '';
  return I18N.T(h < 5 ? 'Не спится' : h < 12 ? 'Доброе утро' : h < 18 ? 'Привет' : 'Добрый вечер') + n;
}

// ---------- открытие ----------
function openIsland(tab) {
  if (S.mode === 'onb') return;
  S.mode = 'open'; S.toast = null; api.focus();
  showTab(tab || S.tab);
}
function closeIsland() { if (S.mode !== 'open' && S.mode !== 'search') return; S.mode = 'mini'; refresh(); }
island.addEventListener('click', () => {
  if (S.mode !== 'mini') return;
  if (S.toastAct) { const a = S.toastAct; S.toast = null; S.toastAct = null; refresh(); return a(); }
  openIsland();
});
island.addEventListener('mouseenter', () => { S.hover = true; if (S.mode === 'mini') refresh(); });
island.addEventListener('mouseleave', () => { S.hover = false; if (S.mode === 'mini') refresh(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeIsland(); });
api.on('blur', () => { if (!S.picking) closeIsland(); });
api.on('toggle', () => S.mode === 'open' ? closeIsland() : openIsland());
api.on('open-tab', t => openIsland(t));

$$('[data-tab]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); showTab(b.dataset.tab); }));
function showTab(t) {
  S.tab = t;
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('section[data-sec]').forEach(s => s.hidden = s.dataset.sec !== t);
  const sec = document.querySelector(`section[data-sec="${t}"]`);
  if (sec) { sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter'); }
  refresh();
  ({ home: renderHome, apps: renderApps, weather: () => { renderWeather(); loadWeather(); }, chat: () => { down(); setTimeout(() => { $('askIn').focus({ preventScroll: true }); island.scrollTop = 0; }, 600); }, tasks: renderTasks, clip: renderClips, connect: () => { refreshRadios(); scanWifi(); scanBt(); }, system: () => { tickStats(); loadVolume(); }, timer: renderTimer, settings: fillSettings }[t] || (() => {}))();
}

// ---------- тема ----------
function applyTheme() {
  const p = P();
  document.documentElement.style.setProperty('--acc', p.accent || SW[0]);
  const bg = p.bg || 'dark';
  const img = bg === 'wall' ? S.wall : bg === 'custom' ? p.bgImg : null;
  $('ibg').style.backgroundImage = img ? `url("${img}")` : 'none';
  $('ibg').style.filter = bg === 'wall' ? 'blur(18px) saturate(1.3)' : 'none';
  $('ibg').style.opacity = img ? 1 : 0;
  $('idim').style.opacity = img ? 1 : 0;
  const letter = p.avatar ? '' : (p.name || '?').trim().charAt(0).toUpperCase();
  ['hAva', 'sAva', 'oAva'].forEach(id => { const el = $(id); el.style.backgroundImage = p.avatar ? `url("${p.avatar}")` : 'none'; el.textContent = letter; });
  $$('.swatches').forEach(box => box.innerHTML = SW.map(c => `<button class="swt${(p.accent || SW[0]) === c ? ' on' : ''}" data-c="${c}" style="background:${c};--c:${c}"></button>`).join(''));
  $$('#sBg button').forEach(b => b.classList.toggle('on', b.dataset.v === bg));
  $$('#sShape button, #oShape button').forEach(b => b.classList.toggle('on', b.dataset.v === (p.shape || 'drop')));
  $('sBgUp').hidden = bg !== 'custom';
  const pi = $('oPrevI');
  pi.style.borderRadius = drop() ? '0 0 17px 17px' : '17px';
  $('oPrev').style.alignItems = 'flex-start'; $('oPrev').style.paddingTop = drop() ? '0' : '10px';
  $('oPrevT').textContent = 'Привет, ' + (p.name || 'друг');
  if (S.wall) $('oPrev').style.backgroundImage = `url("${S.wall}")`;
  refresh();
}
const saveProfile = debounce(() => api.saveProfile(S.profile), 300);
function setP(patch) { S.profile = { ...P(), ...patch }; applyTheme(); saveProfile(); }
document.addEventListener('click', e => {
  const sw = e.target.closest('.swt'); if (sw) return setP({ accent: sw.dataset.c });
  const sb = e.target.closest('#sBg button'); if (sb) return setP({ bg: sb.dataset.v });
  const sh = e.target.closest('#sShape button, #oShape button'); if (sh) return setP({ shape: sh.dataset.v });
});
$$('[data-p]').forEach(inp => inp.addEventListener('input', () => {
  setP({ [inp.dataset.p]: inp.value });
  $$(`[data-p="${inp.dataset.p}"]`).forEach(o => { if (o !== inp) o.value = inp.value; });
  $('sName').textContent = P().name || 'Без имени';
}));
$$('input[data-img]').forEach(inp => {
  inp.addEventListener('click', () => { S.picking = true; });
  inp.addEventListener('change', () => {
    S.picking = false; api.focus();
    const f = inp.files[0]; if (!f) return;
    const key = inp.dataset.img, max = key === 'avatar' ? 256 : 1200;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        setP({ [key]: c.toDataURL('image/jpeg', .86), ...(key === 'bgImg' ? { bg: 'custom' } : {}) });
      };
      img.src = r.result;
    };
    r.readAsDataURL(f); inp.value = '';
  });
});
window.addEventListener('focus', () => { S.picking = false; });

// ---------- регистрация ----------
function showStep(st) {
  S.step = st;
  $$('.ostep').forEach(x => x.hidden = x.dataset.step !== st);
  $$('#dots i').forEach((d, i) => d.classList.toggle('on', ['auth', 'email', 'profile', 'style'][i] === st));
  $$('[data-p]').forEach(inp => inp.value = P()[inp.dataset.p] || '');
  $('oAcc').textContent = P().email ? 'Google · ' + P().email : '';
  $('oNext').style.opacity = (P().name || '').trim() ? 1 : .45;
  refresh();
}
async function googleFlow(btnTxt) {
  const old = btnTxt.textContent; btnTxt.textContent = 'Жду ответа в браузере…';
  const r = await api.google();
  btnTxt.textContent = old;
  if (r.error === 'NO_CLIENT') return { error: 'Вход через Google ещё не настроен — смотри раздел «Google» в README. Пока создай профиль, это 10 секунд.' };
  return r;
}
let viaGoogle = false;
const mailMode = g => {
  viaGoogle = g; eReset(); showStep('email');
  const t = document.querySelector('[data-step="email"] h2');
  if (t) t.textContent = g ? 'Вход через Google' : 'Твоя почта';
  $('eSub').textContent = g ? 'Введи свой Gmail — пришлём код прямо в Nex.' : 'Пришлём код, чтобы подтвердить, что это ты.';
  $('eMail').placeholder = g ? 'name@gmail.com' : 'you@mail.com';
  if (P().email) $('eMail').value = P().email;
  setTimeout(() => $('eMail').focus(), 200);
};
$('oGoogle').onclick = () => mailMode(true);
function refreshOnbH() { ONB_H.auth = $('oNote').hidden ? 444 : 500; refresh(); }
$('oManual').onclick = () => mailMode(false);
// ---------- подтверждение почты ----------
const eCells = () => [...document.querySelectorAll('#eCells input')];
let eSent = false, eTimer = null;
function eNote(t, ok) { $('eNote').textContent = t || ''; $('eNote').style.color = ok ? 'var(--ok)' : 'var(--bad)'; }
function eReset() { eSent = false; $('eCodeBox').hidden = true; $('eMailL').hidden = false; $('eGo').textContent = 'Отправить код'; $('eSub').textContent = 'Пришлём код, чтобы подтвердить, что это ты.'; eNote(''); eCells().forEach(c => c.value = ''); }
async function eSend() {
  const mail = $('eMail').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return eNote('Проверь адрес почты');
  if (viaGoogle && !/@(gmail|googlemail)\.com$/i.test(mail)) return eNote('Это не Gmail — нажми «Назад» → «Другая почта»');
  $('eGo').disabled = true; eNote('Отправляю…', true);
  const res = await api.mailSend(mail, P().lang || 'ru');
  $('eGo').disabled = false;
  if (res.error) return eNote(res.error);
  eSent = true; $('eMailL').hidden = true; $('eCodeBox').hidden = false; $('eGo').textContent = 'Подтвердить';
  $('eSub').textContent = 'Код отправлен на ' + mail + '. Проверь и «Спам».'; eNote('');
  eCells()[0].focus(); eCooldown(30);
}
function eCooldown(s) {
  clearInterval(eTimer); const b = $('eResend'); b.disabled = true;
  const tick = () => { b.textContent = s > 0 ? 'Отправить снова через ' + s + ' с' : 'Отправить снова'; if (s-- <= 0) { b.disabled = false; clearInterval(eTimer); } };
  tick(); eTimer = setInterval(tick, 1000);
}
async function eVerify() {
  const code = eCells().map(c => c.value).join('');
  if (code.length < 6) return eNote('Введи все 6 цифр');
  const res = await api.mailVerify(code);
  if (res.error) { eNote(res.error); eCells().forEach(c => c.value = ''); eCells()[0].focus(); return; }
  S.profile = { ...P(), email: res.email, emailOk: true, google: viaGoogle || !!P().google };
  eNote('Почта подтверждена ✓', true);
  if (S.needLogin && (P().name || '').trim()) {
    S.needLogin = false;
    return setTimeout(() => { setP({ done: true }); api.saveProfile(S.profile); S.mode = 'mini'; refresh(); toast('С возвращением, ' + P().name + '!', { force: true }); }, 500);
  }
  setTimeout(() => showStep('profile'), 500);
}
$('eGo').onclick = () => eSent ? eVerify() : eSend();
$('eResend').onclick = () => eSend();
$('eBack').onclick = () => { eSent ? eReset() : showStep('auth'); };
$('eMail').addEventListener('keydown', e => { if (e.key === 'Enter') eSend(); });
eCells().forEach((c, i, all) => {
  c.addEventListener('input', () => {
    const d = c.value.replace(/\D/g, '');
    if (d.length > 1) { d.slice(0, 6).split('').forEach((x, j) => { if (all[j]) all[j].value = x; }); all[Math.min(5, d.length - 1)].focus(); }
    else { c.value = d; if (d && all[i + 1]) all[i + 1].focus(); }
    if (all.every(x => x.value)) eVerify();
  });
  c.addEventListener('keydown', e => { if (e.key === 'Backspace' && !c.value && all[i - 1]) all[i - 1].focus(); });
});
$$('#onb [data-p="name"]').forEach(i => i.addEventListener('input', () => { $('oNext').style.opacity = i.value.trim() ? 1 : .45; }));
$('oNext').onclick = () => { if ((P().name || '').trim()) showStep('style'); };
$('oDone').onclick = () => {
  setP({ done: true }); api.saveProfile(S.profile);
  S.mode = 'mini'; refresh();
  setTimeout(() => toast(hello() + '! Нажми на меня', { force: true }), 500);
};

// ---------- главная ----------
function appName(id) {
  if (!id) return '';
  if (/spotify/i.test(id)) return 'Spotify';
  if (/chrome/i.test(id)) return 'Chrome'; if (/msedge/i.test(id)) return 'Edge'; if (/firefox/i.test(id)) return 'Firefox';
  if (/yandex/i.test(id)) return 'Яндекс'; if (/zune|media/i.test(id)) return 'Медиаплеер'; if (/vlc/i.test(id)) return 'VLC';
  return id.replace(/\.exe$/i, '').split(/[!_.]/)[0];
}
function mediaPos() {
  const m = S.media; if (!m) return 0;
  let p = m.pos || 0;
  if (m.status === 'Playing' && m.upd > 0) p += (Date.now() - m.upd) / 1000;
  return m.dur ? Math.min(p, m.dur) : p;
}
function renderHome() {
  const m = S.media, has = m && m.title;
  $('mTitle').textContent = has ? m.title : 'Тишина';
  $('mArtist').textContent = has ? (m.artist || '') : 'Включи музыку в Spotify, YouTube или любом плеере';
  $('mArtist').classList.toggle('mut', !has);
  $('mApp').textContent = has ? appName(m.app) : '';
  setHtml('mPlay', playing() ? ICON_PAUSE : ICON_PLAY);
  $('cover').style.backgroundImage = has && S.cover ? `url("${S.cover}")` : 'none';
  $('cover').textContent = has && S.cover ? '' : '♪';
  $('mProg').style.visibility = has && m.dur > 0 ? 'visible' : 'hidden';
  tickMedia();
  renderCal();
  const w = S.weather;
  $('calW').innerHTML = w ? `${Math.round(w.current.temperature_2m)}° ${esc(w.city || '')}` : '';
  $('qDnd').classList.toggle('on', !!S.settings.dnd);
  $('qWifi').classList.toggle('on', S.wifi === 'On');
  $('qWifi').textContent = S.wifi === 'On' && S.ssid ? 'Wi‑Fi · ' + S.ssid : 'Wi‑Fi';
  $('qBt').classList.toggle('on', S.bt === 'On');
  $('qWifi').hidden = S.wifi === 'None'; $('qBt').hidden = S.bt === 'None';
  $('vol').value = S.vol;
}
function tickMedia() {
  const m = S.media; if (!m || !m.dur) return;
  const p = mediaPos();
  $('mBar').style.width = (p / m.dur * 100) + '%';
  $('mPos').textContent = mmss(p); $('mDur').textContent = mmss(m.dur);
}
function renderCal() {
  const now = new Date(), dow = (now.getDay() + 6) % 7, mon = new Date(now); mon.setDate(now.getDate() - dow);
  $('calM').textContent = monthName(now); $('calY').textContent = now.getFullYear();
  setHtml('week', days().map((d, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return `<div class="${i > 4 ? 'we' : ''}"><small>${d}</small><span class="${i === dow ? 'today' : ''}">${x.getDate()}</span></div>`; }).join(''));
  const p = P(), b = p.birth ? new Date(p.birth) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let title = 'Сегодня ничего не запланировано', sub = 'Свободный день — отдохни';
  const left = S.tasks.tasks.filter(t => !t.done).length;
  if (left) { title = `${left} ${plural(left, 'задача', 'задачи', 'задач')} на сегодня`; sub = S.tasks.tasks.find(t => !t.done).text; }
  if (b) {
    let nx = new Date(today.getFullYear(), b.getMonth(), b.getDate()); if (nx < today) nx.setFullYear(today.getFullYear() + 1);
    const dd = Math.round((nx - today) / 864e5);
    if (dd === 0) { title = `С днём рождения, ${p.name}!`; sub = 'Nex желает тебе самого лучшего'; }
    else if (!left) sub = `До твоего дня рождения ${dd} ${plural(dd, 'день', 'дня', 'дней')}`;
  }
  $('evT').textContent = title; $('evS').textContent = sub;
}
$('mPlay').onclick = () => { if (!S.media) return; S.media.status = playing() ? 'Paused' : 'Playing'; S.media.upd = Date.now(); S.media.pos = mediaPos(); renderHome(); renderMini(); api.sys('media', { a: 'toggle' }); };
$('mNext').onclick = () => api.sys('media', { a: 'next' });
$('mPrev').onclick = () => api.sys('media', { a: 'prev' });
api.on('media', d => {
  if (d.cover !== undefined) S.cover = d.cover;
  const prev = S.lastTitle;
  S.media = d.ok ? d : null;
  if (S.media && S.media.title && S.media.title !== prev && prev !== null && S.media.status === 'Playing' && S.mode === 'mini') toast(`${S.media.title}${S.media.artist ? ' — ' + S.media.artist : ''}`);
  S.lastTitle = S.media ? S.media.title : '';
  if (S.mode === 'open' && S.tab === 'home') renderHome();
  if (S.mode === 'mini') refresh();
});

// быстрые кнопки
$('qDnd').onclick = async () => {
  const on = !S.settings.dnd;
  const r = await api.sys('dnd', { on });
  if (!r.ok) return toast('Не получилось: ' + r.err, { force: true });
  S.settings.dnd = on; api.saveSettings({ dnd: on }); renderHome();
  toast(on ? 'Не беспокоить: уведомления скрыты' : 'Уведомления снова включены', { force: true });
};
$('qWifi').onclick = () => setRadio('WiFi', S.wifi !== 'On');
$('qBt').onclick = () => setRadio('Bluetooth', S.bt !== 'On');
$('qNight').onclick = async () => {
  const b = $('qNight'); if (b.disabled) return; b.disabled = true;
  const r = await api.nightLight(); b.disabled = false;
  if (r && r.ok) { b.classList.toggle('on', r.on); window.toast && toast(r.on ? 'Ночной свет включён' : 'Ночной свет выключен', { force: true, ms: 1800 }); }
  else api.winSettings('nightlight');
};
$('qShot').onclick = async () => {
  closeIsland(); await new Promise(r => setTimeout(r, 450));
  const r = await api.screenshot();
  if (r.ok) toast('Скриншот сохранён и скопирован · открыть', { force: true, act: () => api.showItem(r.file), ms: 5000 });
  else toast('Не получилось сделать скриншот', { force: true });
};

// ---------- громкость / яркость ----------
async function loadVolume() {
  const r = await api.sys('vol-get'); if (r.ok) { S.vol = r.data.vol; syncVol(); }
  const b = await api.sys('bright-get');
  if (b.ok && b.data.v >= 0) { S.bright = b.data.v; $('brightBox').hidden = false; $('bright').value = S.bright; $('brTxt').textContent = S.bright; }
}
function syncVol() { $('vol').value = S.vol; $('vol2').value = S.vol; $('volTxt').textContent = S.vol; }
const pushVol = debounce(v => api.sys('vol-set', { v }), 60);
['vol', 'vol2'].forEach(id => $(id).addEventListener('input', e => { S.vol = +e.target.value; syncVol(); pushVol(S.vol); }));
$('qMute').onclick = async () => { const r = await api.sys('mute'); if (r.ok) toast(r.data.mute ? 'Звук выключен' : 'Звук включён'); };
const pushBright = debounce(v => api.sys('bright-set', { v }), 80);
$('bright').addEventListener('input', e => { S.bright = +e.target.value; $('brTxt').textContent = S.bright; pushBright(S.bright); });

// ---------- погода ----------
const WMO = c => c === 0 ? ['Ясно', 'sun'] : c <= 2 ? ['Переменная облачность', 'part'] : c === 3 ? ['Пасмурно', 'cloud'] : c <= 48 ? ['Туман', 'fog'] : c <= 57 ? ['Морось', 'rain'] : c <= 67 ? ['Дождь', 'rain'] : c <= 77 ? ['Снег', 'snow'] : c <= 82 ? ['Ливень', 'rain'] : c <= 86 ? ['Снегопад', 'snow'] : ['Гроза', 'storm'];
function wIcon(kind, s = 24) {
  const sun = '<circle cx="12" cy="12" r="4.5" fill="#f5d04c"/><g stroke="#f5d04c" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g>';
  const cloud = (y = 0, c = '#d9d7e2') => `<path transform="translate(0 ${y})" d="M7 19h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.6A3.3 3.3 0 0 0 7 19z" fill="${c}"/>`;
  const body = { sun, part: '<g transform="translate(-3 -3) scale(.8)">' + sun + '</g>' + cloud(1), cloud: cloud(), fog: cloud(-3) + '<g stroke="#b7b4c4" stroke-width="2" stroke-linecap="round"><path d="M4 20h16M7 23h10"/></g>', rain: cloud(-3) + '<g stroke="#4cc2ff" stroke-width="2" stroke-linecap="round"><path d="M8 19l-1 3M12 19l-1 3M16 19l-1 3"/></g>', snow: cloud(-3) + '<g fill="#fff"><circle cx="8" cy="20.5" r="1.2"/><circle cx="12" cy="22" r="1.2"/><circle cx="16" cy="20.5" r="1.2"/></g>', storm: cloud(-3, '#9a97a8') + '<path d="M13 16l-3 4h3l-2 4" stroke="#f5d04c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' }[kind];
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="overflow:visible">${body}</svg>`;
}
async function loadWeather(force) {
  if (!force && S.weather && Date.now() - S.weatherAt < 15 * 60e3) return;
  const r = await api.weather();
  if (!r.ok) { if (!S.weather) $('wCity').textContent = 'Не удалось узнать погоду. Проверь интернет или впиши город в настройках.'; return; }
  S.weather = r.data; S.weatherAt = Date.now();
  renderWeather(); if (S.tab === 'home') renderHome();
}
function renderWeather() {
  const w = S.weather; if (!w) return;
  const c = w.current, [desc, kind] = WMO(c.weather_code);
  $('wCity').textContent = w.city || 'Твой город';
  $('wTemp').innerHTML = `<span style="display:inline-flex;align-items:center;gap:14px">${Math.round(c.temperature_2m)}°${wIcon(kind, 44)}</span>`;
  $('wDesc').textContent = desc;
  $('wMeta').textContent = `Ощущается как ${Math.round(c.apparent_temperature)}° · влажность ${c.relative_humidity_2m}% · ветер ${Math.round(c.wind_speed_10m)} м/с`;
  const d = w.daily;
  $('wDays').innerHTML = d.time.map((t, i) => { const dt = new Date(t), k = WMO(d.weather_code[i])[1]; return `<div class="wday${i === 0 ? ' today' : ''}"><small>${i === 0 ? 'Сегодня' : days()[(dt.getDay() + 6) % 7]}</small>${wIcon(k, 26)}<span>${Math.round(d.temperature_2m_max[i])}°</span><em>${Math.round(d.temperature_2m_min[i])}°</em></div>`; }).join('');
}

// ---------- чат ----------
function inline(s) { return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>'); }
function md(t) {
  let out = '', para = [], list = null;
  const fp = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
  const fl = () => { if (list) { out += `<${list.t}>${list.i.map(x => '<li>' + inline(x) + '</li>').join('')}</${list.t}>`; list = null; } };
  for (const l of String(t).replace(/```[\s\S]*?(```|$)/g, '').split('\n')) {
    let m;
    if (!l.trim()) { fp(); fl(); continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { fp(); if (!list || list.t !== 'ul') { fl(); list = { t: 'ul', i: [] }; } list.i.push(m[1]); continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { fp(); if (!list || list.t !== 'ol') { fl(); list = { t: 'ol', i: [] }; } list.i.push(m[1]); continue; }
    fl(); para.push(l.replace(/^#+\s*/, ''));
  }
  fp(); fl(); return out;
}
const chat = $('chat');
function updSugg() { $('sugg').hidden = !!chat.children.length; if (S.mode === 'open') layout(); }
const down = () => { chat.scrollTop = chat.scrollHeight; };
function addMsg(me, text) {
  const d = document.createElement('div');
  d.className = 'm' + (me ? ' me' : '');
  d.innerHTML = me ? '<div class="bub"></div>' : '<div class="nexav"><img src="nex/happy.png" alt=""></div><div class="bub"></div>';
  const b = d.querySelector('.bub');
  if (me) b.textContent = text; else b.innerHTML = text == null ? '<span class="typing"><i></i><i></i><i></i></span>' : md(text);
  chat.appendChild(d); updSugg(); down();
  let buf = '';
  return { el: b, append(t) { buf += t; b.innerHTML = md(buf); down(); }, set(h) { b.innerHTML = h; down(); } };
}
function setBusy(v) { S.busy = v; $('sendB').innerHTML = v ? ICON_STOP : ICON_SEND; }
async function send(text) {
  text = (text || '').trim(); if (!text || S.busy) return;
  if (window.preSend && preSend(text)) return;
  addMsg(true, text);
  const m = addMsg(false, null);
  S.current = m; setBusy(true);
  const r = await api.chat(text);
  S.current = null; setBusy(false);
  if (r.needKey) { S.pendingText = text; return m.set(keyCard()); }
  if (r.error) return m.set(`<span class="err">${esc(r.error)}</span>`);
  m.set(md(r.text || '…'));
}
api.on('chunk', t => S.current && S.current.append(t));
let setupLast = 0;
api.on('ai-setup', d => { if (!d.done) return; toast(d.pct != null ? `${d.text} · ${d.pct}%` : d.text, { force: true, ms: d.done ? 4000 : 2500 }); });
$('askForm').onsubmit = e => { e.preventDefault(); if (S.busy) return api.stop(); const t = $('askIn').value; $('askIn').value = ''; send(t); };
$$('#sugg [data-q]').forEach(b => b.onclick = () => send(b.dataset.q));
$('newChat').onclick = async () => { if (S.busy) return; await api.newChat(); chat.innerHTML = ''; updSugg(); };

// ---------- задачи ----------
const saveTasks = debounce(() => api.saveTasks(S.tasks), 300);
function renderTasks() {
  const t = S.tasks.tasks, left = t.filter(x => !x.done).length;
  $('tLeft').textContent = t.length ? (left ? `осталось ${left}` : 'всё сделано!') : '';
  $('taskList').innerHTML = t.length ? t.map(x => `<div class="task${x.done ? ' done' : ''}" data-id="${x.id}"><button class="chk">${x.done ? '✓' : ''}</button><span>${esc(x.text)}</span><button class="x">×</button></div>`).join('') : '<div class="empty">Пока пусто. Напиши задачу и нажми Enter.</div>';
  if (document.activeElement !== $('note')) $('note').value = S.tasks.note || '';
}
$('taskIn').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  S.tasks.tasks.push({ id: Date.now(), text: e.target.value.trim(), done: false }); e.target.value = '';
  renderTasks(); saveTasks();
});
$('taskList').addEventListener('click', e => {
  const row = e.target.closest('.task'); if (!row) return;
  const id = +row.dataset.id, t = S.tasks.tasks.find(x => x.id === id);
  if (e.target.closest('.x')) S.tasks.tasks = S.tasks.tasks.filter(x => x.id !== id);
  else if (e.target.closest('.chk')) { t.done = !t.done; if (t.done) toast('Задача выполнена!'); }
  else return;
  renderTasks(); saveTasks();
});
$('note').addEventListener('input', e => { S.tasks.note = e.target.value; saveTasks(); });

// ---------- буфер ----------
function ago(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : Math.round(m / 1440) + ' дн назад'; }
function renderClips() {
  const c = [...S.clips].sort((a, b) => (b.pin - a.pin) || (b.t - a.t));
  $('clips').innerHTML = c.length ? c.map(x => `<div class="clip${x.pin ? ' pin' : ''}" data-id="${x.id}"><p>${esc(x.text)}</p><div><span>${ago(x.t)}</span><button class="lnk${x.pin ? ' acc' : ''}" data-a="pin">${x.pin ? 'Закреплено' : 'Закрепить'}</button><button class="lnk acc" data-a="copy">Копировать</button><button class="x" data-a="del">×</button></div></div>`).join('') : '<div class="empty">Скопируй любой текст — он появится здесь.</div>';
}
$('clips').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const id = +b.closest('.clip').dataset.id, c = S.clips.find(x => x.id === id);
  if (b.dataset.a === 'copy') { api.clipCopy(c.text); b.textContent = 'Скопировано'; setTimeout(renderClips, 1200); }
  if (b.dataset.a === 'pin') api.clipPin(id);
  if (b.dataset.a === 'del') api.clipDel(id);
});
$('clipClear').onclick = () => api.clipClear();
api.on('clips', c => { S.clips = c; if (S.mode === 'open' && S.tab === 'clip') renderClips(); });

// ---------- Wi‑Fi и Bluetooth ----------
async function refreshRadios() {
  const r = await api.sys('radios');
  if (!r.ok) return;
  S.wifi = r.data.wifi; S.bt = r.data.bt; S.ssid = r.data.ssid || '';
  $('wfSw').classList.toggle('on', S.wifi === 'On'); $('btSw').classList.toggle('on', S.bt === 'On');
  if (S.tab === 'home') renderHome();
}
async function setRadio(kind, on) {
  const r = await api.sys('radio-set', { kind, on });
  if (!r.ok) return toast('Не получилось: ' + r.err, { force: true });
  toast(`${kind === 'WiFi' ? 'Wi‑Fi' : 'Bluetooth'} ${on ? 'включён' : 'выключен'}`, { force: true });
  await refreshRadios();
  if (S.tab === 'connect') { kind === 'WiFi' ? setTimeout(scanWifi, 1500) : setTimeout(scanBt, 1000); }
}
$('wfSw').onclick = () => setRadio('WiFi', S.wifi !== 'On');
$('btSw').onclick = () => setRadio('Bluetooth', S.bt !== 'On');
$('wfScan').onclick = () => scanWifi();
$('btScan').onclick = () => scanBt();
$('btAdd').onclick = () => api.winSettings('bluetooth');
const lock = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="opacity:.6;flex:none"><path d="M7 10V7a5 5 0 0 1 10 0v3h1v11H6V10zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
const sig = n => `<span class="sig">${[4, 6, 9, 12].map((h, i) => `<i class="${n > i ? 'on' : ''}" style="height:${h}px"></i>`).join('')}</span>`;
async function scanWifi() {
  if (S.scanning) return;
  S.scanning = true; renderNets();
  const r = await api.sys('wifi-scan');
  S.scanning = false;
  if (r.ok) { S.nets = r.data.nets.sort((a, b) => b.bars - a.bars); S.ssid = r.data.current || S.ssid; S.netErr = null; }
  else S.netErr = r.err;
  renderNets();
}
function renderNets() {
  const el = $('wfList');
  if (S.wifi === 'Off') { el.innerHTML = '<div class="empty">Wi‑Fi выключен</div>'; return; }
  if (S.netErr) { el.innerHTML = `<div class="empty">Windows не даёт искать сети.<br>Разреши приложениям доступ к расположению.<br><br><button class="btn ghost" id="locBtn">Открыть параметры</button></div>`; $('locBtn').onclick = () => api.winSettings('privacy-location'); return; }
  if (!S.nets) { el.innerHTML = `<div class="empty"><span class="spin"></span></div>`; return; }
  const list = [...S.nets].sort((a, b) => (b.ssid === S.ssid) - (a.ssid === S.ssid));
  el.innerHTML = (S.scanning ? '<div class="empty" style="padding:4px 0"><span class="spin"></span></div>' : '') + list.map(n => {
    const cur = n.ssid === S.ssid, open = S.openNet === n.ssid, busy = S.connecting === n.ssid;
    let extra = '';
    if (open && cur) extra = `<div class="pw"><button class="btn ghost" data-dis="1" style="flex:1">Отключиться</button></div>`;
    else if (open && n.secure) extra = `<div class="pw"><input class="fld" type="password" placeholder="Пароль" data-pw="${esc(n.ssid)}"><button class="btn" data-go="${esc(n.ssid)}">${busy ? '<span class="spin"></span>' : 'Подключить'}</button></div>`;
    return `<button class="net${cur ? ' cur' : ''}" data-net="${esc(n.ssid)}">${sig(n.bars)}<b>${esc(n.ssid)}</b>${busy && !n.secure ? '<span class="spin"></span>' : cur ? '<small>подключено</small>' : n.secure ? lock : ''}</button>${extra}`;
  }).join('');
  const pw = el.querySelector('[data-pw]'); if (pw) pw.focus({ preventScroll: true });
}
$('wfList').addEventListener('click', e => {
  const go = e.target.closest('[data-go]'); if (go) { const inp = $('wfList').querySelector('[data-pw]'); return connectWifi(go.dataset.go, inp.value); }
  if (e.target.closest('[data-dis]')) { api.sys('wifi-disconnect').then(() => { toast('Wi‑Fi отключён', { force: true }); S.ssid = ''; S.openNet = null; refreshRadios(); renderNets(); }); return; }
  const n = e.target.closest('[data-net]'); if (!n) return;
  const ssid = n.dataset.net, net = S.nets.find(x => x.ssid === ssid);
  if (S.openNet === ssid) { S.openNet = null; return renderNets(); }
  S.openNet = ssid;
  if (!net.secure && ssid !== S.ssid) return connectWifi(ssid, '');
  renderNets();
});
$('wfList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.pw) connectWifi(e.target.dataset.pw, e.target.value); });
async function connectWifi(ssid, pass) {
  S.connecting = ssid; renderNets();
  const r = await api.sys('wifi-connect', { ssid, pass });
  S.connecting = null;
  const st = r.ok ? r.data.status : r.err;
  if (st === 'Success') { toast('Подключено к ' + ssid, { force: true }); S.openNet = null; S.ssid = ssid; }
  else toast(st === 'InvalidCredential' ? 'Неверный пароль' : 'Не удалось подключиться: ' + st, { force: true });
  renderNets(); setTimeout(refreshRadios, 1500);
}
async function scanBt() {
  const el = $('btList');
  if (S.bt === 'Off') { el.innerHTML = '<div class="empty">Bluetooth выключен</div>'; return; }
  if (!S.devs) el.innerHTML = '<div class="empty"><span class="spin"></span></div>';
  const r = await api.sys('bt-list');
  S.devs = r.ok ? r.data.devs : [];
  el.innerHTML = S.devs.length ? [...S.devs].sort((a, b) => b.connected - a.connected).map(d => `<button class="dev net${d.connected ? ' on' : ''}" data-bt="1"><i></i><b>${esc(d.name)}</b><small>${d.connected ? 'подключено' : 'сопряжено'}</small></button>`).join('') : '<div class="empty">Нет сопряжённых устройств</div>';
}
$('btList').addEventListener('click', e => { if (e.target.closest('[data-bt]')) api.winSettings('bluetooth'); });

// ---------- система ----------
const GB = b => (b / 1073741824).toFixed(1);
async function tickStats() {
  if (S.mode !== 'open' || S.tab !== 'system') return;
  const s = await api.stats();
  const meter = (label, pct, txt) => `<div class="meter"><div><span>${label}</span><span>${txt}</span></div><div class="mbar"><i style="width:${pct}%;background:${pct > 85 ? 'var(--bad)' : pct > 65 ? 'var(--warn)' : 'var(--acc)'}"></i></div></div>`;
  let h = meter('Процессор', s.cpu, s.cpu + '%') + meter('Память', s.ramUsed / s.ramTotal * 100, `${GB(s.ramUsed)} / ${GB(s.ramTotal)} ГБ`);
  if (s.disk) h += meter('Диск C:', (1 - s.disk.free / s.disk.total) * 100, `свободно ${GB(s.disk.free)} ГБ`);
  if (S.battery) h += meter('Батарея' + (S.battery.charging ? ' · заряжается' : ''), S.battery.level * 100, Math.round(S.battery.level * 100) + '%');
  $('meters').innerHTML = h;
  const u = s.uptime, d = Math.floor(u / 86400), hh = Math.floor(u % 86400 / 3600), mm = Math.floor(u % 3600 / 60);
  $('upTxt').textContent = `Компьютер работает ${d ? d + ' дн ' : ''}${hh} ч ${mm} мин`;
}
setInterval(tickStats, 2000);

// ---------- таймер ----------
function renderTimer() {
  const t = S.timer;
  $('tDig').textContent = mmss(t.left).padStart(5, '0');
  $('tBar').style.width = (100 - t.left / t.total * 100) + '%';
  $('tGo').textContent = t.run ? 'Пауза' : t.left === 0 ? 'Заново' : 'Старт';
  $('presets').innerHTML = [5, 15, 25, 45, 60].map(m => `<button class="chip${t.total === m * 60 ? ' on' : ''}" data-m="${m}">${m} мин</button>`).join('');
}
$('presets').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; S.timer = { total: b.dataset.m * 60, left: b.dataset.m * 60, run: false, end: 0 }; renderTimer(); });
$('tGo').onclick = () => {
  const t = S.timer;
  if (t.run) { t.run = false; } else { if (t.left === 0) t.left = t.total; t.run = true; t.end = Date.now() + t.left * 1000; }
  renderTimer(); refresh();
};
$('tReset').onclick = () => { S.timer = { ...S.timer, left: S.timer.total, run: false }; renderTimer(); refresh(); };
function beep() {
  try {
    const ctx = new AudioContext();
    [0, .25, .5].forEach(d => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.18, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d + .2); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + .22); });
  } catch {}
}

// ---------- настройки ----------
function fillSettings() {
  const p = P(), s = S.settings;
  $$('#full [data-p]').forEach(i => i.value = p[i.dataset.p] || '');
  $('sName').textContent = p.name || 'Без имени';
  $('sAcc').textContent = p.email ? 'Google · ' + p.email : 'Локальный профиль';
  $('sGoogle').hidden = !!p.email;
  $('sCity').value = s.city || '';
  $('sAuto').classList.toggle('on', !!s.autostart);
  $('sDesk').classList.toggle('on', s.desktopOnly !== false);
  $$('#sLang button').forEach(b => b.classList.toggle('on', b.dataset.l === (s.lang || 'ru')));
  $$('[data-s]').forEach(i => i.value = s[i.dataset.s] || '');
  setProv(s.provider || 'ollama');
  applyTheme();
}
function setProv(v) {
  $$('#sProv button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $$('[data-for]').forEach(x => x.hidden = x.dataset.for !== v);
}
const saveSet = debounce(p => api.saveSettings(p), 300);
$$('#sProv button').forEach(b => b.onclick = () => { S.settings.provider = b.dataset.v; setProv(b.dataset.v); api.saveSettings({ provider: b.dataset.v }); });
$$('[data-s]').forEach(i => i.addEventListener('input', () => { S.settings[i.dataset.s] = i.value.trim(); saveSet({ [i.dataset.s]: i.value.trim() }); }));
$$('[data-url]').forEach(b => b.onclick = () => api.openUrl(b.dataset.url));
const saveCity = async v => { $('sCity').value = v; $('citySug').innerHTML = ''; if (S.settings.city === v) return; S.settings.city = v; await api.saveSettings({ city: v }); loadWeather(true); };
$('sCity').addEventListener('change', () => setTimeout(() => saveCity($('sCity').value.trim()), 200));
let citySeq = 0;
$('sCity').addEventListener('input', debounce(async () => {
  const q = $('sCity').value.trim(), my = ++citySeq;
  const l = q.length < 2 ? [] : await api.citySuggest(q);
  if (my !== citySeq) return;
  $('citySug').innerHTML = l.map(c => `<button type="button" data-c="${esc(c.name)}" style="display:flex;justify-content:space-between;gap:10px;width:100%;padding:7px 10px;border-radius:8px;text-align:left"><span>${esc(c.name)}</span><span style="color:var(--mut);font-size:11px">${esc(c.sub)}</span></button>`).join('');
}, 250));
$('citySug').addEventListener('mousedown', e => { const b = e.target.closest('[data-c]'); if (b) { e.preventDefault(); saveCity(b.dataset.c); } });
$('sAuto').onclick = () => { S.settings.autostart = !S.settings.autostart; $('sAuto').classList.toggle('on', S.settings.autostart); api.saveSettings({ autostart: S.settings.autostart }); };
$('sGoogle').onclick = async () => {
  const r = await googleFlow($('sGoogle'));
  if (r.error) return toast(r.error, { force: true, ms: 6000 });
  setP({ email: r.email, avatar: P().avatar || r.avatar, name: P().name || r.name, google: true }); fillSettings();
};
$('sLogout').onclick = () => {
  S.profile = { accent: P().accent, shape: P().shape };
  api.saveProfile(S.profile); applyTheme();
  S.mode = 'onb'; showStep('auth');
};

// ---------- часы, батарея, фоновые задачи ----------
setInterval(() => {
  const t = S.timer;
  if (t.run) {
    t.left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    if (t.left === 0) { t.run = false; if (window.onTimerDone) onTimerDone(); else { beep(); toast('Таймер закончился!', { force: true, ms: 6000 }); } }
    if (S.mode === 'open' && S.tab === 'timer') renderTimer();
  }
  if (S.mode === 'open' && S.tab === 'home') tickMedia();
  if (S.mode === 'mini' && !S.toast) renderMini();
}, 500);
setInterval(() => { renderCal(); loadWeather(); refreshRadios(); }, 60000);
if (navigator.getBattery) navigator.getBattery().then(b => {
  let warned = 100;
  const upd = () => {
    S.battery = { level: b.level, charging: b.charging };
    const desktop = b.level === 1 && b.charging && b.chargingTime === 0 && b.dischargingTime === Infinity;
    $('batt').hidden = desktop;
    if (desktop) S.battery = null;
    $('battTxt').textContent = Math.round(b.level * 100) + '%';
    $('battFill').style.width = (b.level * 100) + '%';
    $('battFill').style.background = b.level < .2 && !b.charging ? 'var(--bad)' : 'var(--ok)';
    const pct = Math.round(b.level * 100);
    if (b.charging) warned = 100;
    else if ((pct <= 20 && warned > 20) || (pct <= 10 && warned > 10)) { warned = pct <= 10 ? 10 : 20; toast(`Осталось ${pct}% заряда — пора на зарядку`, { force: true, ms: 6000 }); }
  };
  ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, upd)); upd();
});

// ---------- любимые программы ----------
S.apps = [];
function renderApps() {
  const box = $('apps');
  box.innerHTML = S.apps.length
    ? S.apps.map(a => `<button class="app" data-id="${a.id}" title="${esc(a.name)}">${a.icon ? `<img src="${a.icon}" alt="">` : `<div class="ph">${esc(a.name.charAt(0).toUpperCase())}</div>`}<span>${esc(a.name)}</span><i class="del">×</i></button>`).join('')
    : '<div class="empty" style="grid-column:1/-1;padding:40px 0">Добавь любимые программы — и открывай их одним кликом.</div>';
  $('appsEdit').hidden = !S.apps.length;
  if (!S.apps.length) box.classList.remove('editing');
  $('appsEdit').textContent = box.classList.contains('editing') ? 'Готово' : 'Изменить';
  if (S.mode === 'open') layout();
}
$('appsAdd').onclick = async () => { S.picking = true; S.apps = await api.appsAdd(); S.picking = false; renderApps(); };
$('appsEdit').onclick = () => { $('apps').classList.toggle('editing'); renderApps(); };
$('apps').addEventListener('click', async e => {
  const b = e.target.closest('.app'); if (!b) return;
  const id = +b.dataset.id, a = S.apps.find(x => x.id === id);
  if ($('apps').classList.contains('editing')) { if (e.target.closest('.del')) { S.apps = await api.appsDel(id); renderApps(); } return; }
  closeIsland();
  toast('Открываю ' + a.name, { force: true, ms: 2000 });
  const r = await api.appsOpen(id);
  if (r.error) toast('Не удалось открыть программу', { force: true });
});

// ---------- язык ----------
function setLang(l) {
  S.settings.lang = l; api.saveSettings({ lang: l }); I18N.set(l);
  $$('#oLang button, #sLang button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
  renderCal(); if (S.weather) renderWeather(); refresh();
}
$('sLang').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) setLang(b.dataset.l); });
$('oLang').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) setLang(b.dataset.l); });
$('sDesk').onclick = () => { S.settings.desktopOnly = S.settings.desktopOnly === false; $('sDesk').classList.toggle('on', S.settings.desktopOnly); api.saveSettings({ desktopOnly: S.settings.desktopOnly }); };

// ---------- старт ----------
(async () => {
  try {
    const all = await api.getAll();
    S.profile = all.profile || null; S.settings = all.settings || {}; S.tasks = all.tasks || { tasks: [], note: '' }; S.clips = all.clips || []; S.apps = all.apps || []; S.needLogin = !!all.needLogin;
    I18N.set(S.settings.lang || 'ru');
    $$('#oLang button').forEach(b => b.classList.toggle('on', b.dataset.l === (S.settings.lang || 'ru')));
    (all.history || []).forEach(m => addMsg(m.role === 'user', m.content));
  } catch (e) { console.error(e); }
  updSugg();
  S.wall = await api.wallpaper().catch(() => null);
  applyTheme(); renderCal(); renderTimer();
  if (!P().done || S.needLogin) {
    if (S.needLogin) { S.profile = { ...P(), done: false }; }
    S.mode = 'onb'; showStep('auth');
    if (S.needLogin && $('oNote')) { $('oNote').hidden = false; $('oNote').textContent = 'Новое устройство или новая версия Nex — подтверди почту ещё раз.'; if ($('eMail') && P().email) $('eMail').value = P().email; }
  }
  else { S.mode = 'mini'; refresh(); setTimeout(() => toast(hello()), 700); }
  showTab('home'); if (S.mode !== 'open') refresh();
  api.ready();
  loadWeather(); refreshRadios(); loadVolume();
})();

// ---------- свой ключ Groq ----------
function keyCard() {
  return '<div class="kc" style="display:flex;flex-direction:column;gap:8px">'
    + '<b>Подключи мне мозг — это бесплатно 🧠</b>'
    + '<span style="opacity:.75;font-size:12.5px">1. Открой Groq и войди через Google<br>2. Нажми «Create API Key» и скопируй ключ<br>3. Вставь его сюда</span>'
    + '<button class="kcOpen" style="all:unset;cursor:pointer;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.08);text-align:center;font-size:12.5px">Открыть Groq ↗</button>'
    + '<div style="display:flex;gap:6px"><input class="kcIn" placeholder="gsk_..." style="flex:1;min-width:0;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#0b0b0d;color:#fff;font:inherit;font-size:12.5px;outline:none">'
    + '<button class="kcSave" style="all:unset;cursor:pointer;padding:8px 12px;border-radius:10px;background:#8b7bff;color:#0b0b0d;font-weight:600;font-size:12.5px">Готово</button></div>'
    + '<span class="kcMsg" style="font-size:12px;color:#ff8a8a"></span></div>';
}
document.addEventListener('click', async e => {
  const c = e.target.closest('.kc'); if (!c) return;
  if (e.target.closest('.kcOpen')) return api.openUrl('https://console.groq.com/keys');
  if (!e.target.closest('.kcSave')) return;
  const msg = c.querySelector('.kcMsg'), btn = c.querySelector('.kcSave');
  msg.style.color = '#aaa'; msg.textContent = 'Проверяю ключ…'; btn.style.opacity = .5;
  const res = await api.setKey(c.querySelector('.kcIn').value);
  btn.style.opacity = 1;
  if (res.error) { msg.style.color = '#ff8a8a'; msg.textContent = res.error; return; }
  msg.style.color = '#7be3a0'; msg.textContent = 'Готово! Теперь у тебя свой мозг Nex ✨';
  const t = S.pendingText; S.pendingText = null; if (t) setTimeout(() => send(t), 600);
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('kcIn')) { e.preventDefault(); e.target.closest('.kc').querySelector('.kcSave').click(); } });

Promise.resolve(true).then(ok => { if (ok) return; for (const id of ['oGoogle', 'sGoogle']) { const el = $(id); if (el) (el.closest('.row') && id === 'sGoogle' ? el.closest('.row') : el).hidden = true; } const m = $('oManual'); if (m) { m.className = 'bigbtn white'; m.removeAttribute('style'); m.textContent = S.needLogin ? 'Войти по почте' : 'Войти по почте'; } try { refreshOnbH(); } catch {} });

(() => {
  let busy = false;
  const show = u => {
    if (!u || busy) return;
    toast('Вышел Nex ' + u.version + ' — нажми, чтобы обновить', { force: true, ms: 15000, act: go });
  };
  const go = async () => {
    if (busy) return; busy = true; toast('Скачиваю обновление…', { force: true, ms: 60000 });
    const r = await api.updateInstall(); if (r && r.error) { busy = false; toast(r.error, { force: true }); }
  };
  api.onUpdate(show);
  api.onUpdateProgress(p => toast('Обновление: ' + Math.round(p * 100) + '%', { force: true, ms: 60000 }));
})();

{ const sg = $('sGoogle'); if (sg) (sg.closest('.row') || sg).hidden = true; }
