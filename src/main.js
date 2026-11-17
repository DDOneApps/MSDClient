const $ = s => document.querySelector(s), esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = v => v ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '';
const ic = n => `<span class="ms">${n}</span>`, KEY = 'msd-session';
const S = { route: 'login', hist: [], wide: false, base: 'https://meineschule.digital', school: '', token: '', info: null, profile: null, list: [], sel: null, det: null, q: '', tab: 0, chat: null, msgs: [], reply: null, rcp: [], err: '', loading: false, hip: 0, lim: false, reuse: true, man: false, pending: null };
const SECS = [['chats', 'Chats', 'chat_bubble'], ['home', 'Home', 'home'], ['personen', 'Personen', 'group'], ['medien', 'Medien', 'description'], ['kalender', 'Kalender', 'calendar_month'], ['infopoint', 'InfoPoint', 'school'], ['fundsachen', 'Fundsachen', 'inventory_2']];
let tt, timer; const toast = (t, e) => { const x = $('#toast'); x.textContent = t; x.className = 'toast show' + (e ? ' err' : ''); clearTimeout(tt); tt = setTimeout(() => x.className = 'toast', 3500); };
const guard = f => async (...a) => { try { return await f(...a); } catch (e) { toast(e.message || 'Fehler', 1); } };

async function http(url, o = {}) {
  const h = { Accept: 'application/json', ...(S.token && { Authorization: 'Bearer ' + S.token }), ...o.headers }; let body = o.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  let r; try { r = await fetch(url, { ...o, headers: h, body }); } catch (e) { logApi(o.method || 'GET', url, 0, body, String(e)); throw new Error('Verbindung blockiert (CORS?). Der Server muss die Herkunft dieser Seite erlauben.'); }
  if (o.blob) { logApi(o.method || 'GET', url, r.status, body, '‹Binärdaten›'); if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.blob(); }
  const d = (r.headers.get('content-type') || '').includes('json') ? await r.json().catch(() => null) : await r.text().catch(() => null);
  logApi(o.method || 'GET', url, r.status, body, d);
  if (!r.ok) { const e = new Error(r.status + ' ' + r.statusText); e.data = d; throw e; } return d;
}
const app = (c, a = '', o) => http(`${S.base}/Api/v1.0/App/${encodeURIComponent(S.school)}/${c}${a ? '/' + a : ''}`, o);
const root = p => `${S.base}/${encodeURIComponent(S.school)}/${p}`;
const students = () => S.info?.students || S.info?.Students || [];
const dl = guard(async (url, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(await http(url, { blob: true })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); });

/* ---------- Navigation ---------- */
function nav(r, anim = 'fade', back) { if (!back && S.route !== r) S.hist.push(S.route); S.route = r; S.anim = anim; if (SECS.some(s => s[0] === r)) openSec(r); else draw(); }
const goBack = () => { if (S.route === 'newchat') S.edit = null; const p = S.hist.pop() || 'chats'; S.anim = 'fade'; nav(p, 'fade', true); };
const isSec = () => SECS.some(s => s[0] === S.route);
/* ---------- Rendering ---------- */
const title = i => i.name || i.creatorUserDisplayName || i.title || 'Unbenannt';
const range = i => [fmt(i.from || i.created), i.to && fmt(i.to)].filter(Boolean).join(' – ');
const today = () => new Date(new Date().setHours(0, 0, 0, 0)), ts = i => new Date(i.to || i.from || i.created || 0);
const LI = { chats: i => [i.isInfoChannel ? 'campaign' : 'forum', title(i), i.contentTeaser || '', i.unReadCount], personen: i => ['person', i.displayName, i.studentClass || ''], medien: i => ['description', i.name, `${i.creatorUserDisplayName || ''} · ${range(i)}`], kalender: i => ['event', i.name, `${new Date(i.from || i.created).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${new Date(i.from || i.created).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`], infopoint: i => ['person', i.displayName || i.name, i.studentClass || ''] };
const searchBar = (ph, extra = '') => `<div class="search"><span class="ms">search</span><input id="q" placeholder="${ph}" value="${esc(S.q)}" autocomplete="off">${extra}</div>`;
const shell = (t, body, o = {}) => `<div class="shell ${S.wide && !mob() ? 'wide' : ''}"><nav class="rail ${mob() && S.navfit ? 'fit' : ''}"><div class="bar rail-bar" style="padding:0 0 0 4px;background:none"><button class="ib" data-a="wide" aria-label="Menü">${ic(S.wide ? 'menu_open' : 'menu')}</button></div>${railDests()}</nav><div class="main ${S.anim || 'fade'}"><header class="bar">${o.left || ''}<h1>${t}</h1>${o.acts || ''}${meBtn()}</header>${body}</div></div>`;
/* HIP */
const loginV = () => `<form class="login fade" id="login"><h1>MSD Client</h1><div class="card"><h3>Sicher angemeldet bleiben</h3><p>Zugangsdaten gehen direkt an den gewählten Server und werden nicht gespeichert. Nur das Sitzungs-Token bleibt bis zum Schließen des Tabs erhalten.</p></div>
${[['lBase', 'Server', 'dns', S.base, 'Voreingestellt: https://meineschule.digital'], ['lUser', 'Benutzername / E-Mail', 'person', ''], ['lPass', 'Passwort', 'lock', '', ''], ['lTfa', '2FA-Code (falls nötig)', 'key', '', 'Nur bei aktivierter Zwei-Faktor-Authentifizierung']].map(([id, l, i, v, s]) => `<div><div class="tf ld"><span class="ms">${i}</span><input id="${id}" placeholder=" " value="${esc(v)}" type="${id === 'lPass' ? 'password' : 'text'}" autocomplete="off"><label>${l}</label></div>${s ? `<small style="padding:4px 16px;display:block;color:var(--on-surface-variant);font-size:12px">${s}</small>` : ''}</div>`).join('')}
${S.pending ? `<div class="tf"><select id="lSchool">${S.pending.map(s => `<option value="${esc(s.tag || s.Tag)}">${esc(s.name || s.Name)}</option>`).join('')}</select><label>Schule</label></div>` : ''}<div class="err">${esc(S.err)}</div><button class="btn f" id="lGo">${ic('login')}${S.pending ? 'Starten' : 'Anmelden'}</button></form>`;
const profilV = () => { const p = S.profile || {}, id = p.userId || p.UserId || '', sc = (p.schools || p.Schools || []).map(s => `${s.name || s.Name} (${s.tag || s.Tag})`).join(', ');
  return `<div class="main right" style="height:100dvh"><header class="bar"><button class="ib" data-a="back" aria-label="Zurück">${ic('arrow_back')}</button><h1>Profil</h1></header><div class="content"><div class="form"><div class="card" data-a="tapname" style="height:140px;justify-content:center;cursor:pointer;user-select:none;-webkit-user-select:none"><div style="display:flex;align-items:center;gap:16px">${avatar(meUid(), p.displayName || p.DisplayName, 72)}<div><h3 style="font-size:22px">${esc(p.displayName || p.DisplayName || 'Benutzer')}</h3><p>Dein Konto</p></div></div></div><div class="list"><button class="li" data-a="copyid"><span class="ic">${ic('fingerprint')}</span><span class="tx"><div class="h">User-ID</div><div class="s">Eindeutige Kennung deines Kontos</div></span>${ic('content_copy')}</button><div class="li"><span class="ic">${ic('school')}</span><span class="tx"><div class="h">Schulen</div><div class="s">${esc(sc || '–')}</div></span></div></div>${themeCard()}${avCard()}${navCard()}${S.debug ? dbgCard() : ''}<div class="grp"><button class="btn o" style="flex:1" data-a="web">Profil im Web bearbeiten</button><button class="btn t" style="flex:1" data-a="logout">Abmelden</button></div></div></div></div>`; };
const sw = (id, l, on) => `<div class="sw ${on ? 'on' : ''}" data-a="sw" data-v="${id}" role="switch" tabindex="0" aria-checked="${!!on}"><span>${l}</span><i></i></div>`;
/* ---------- Actions ---------- */
Object.assign(S, { cats: [], cat: '', known: new Map(), scanned: new Set(), edit: null, emo: null, mq: '', find: false, all: false, hipFull: false, hipTab: '', lim: false, reuse: true, editAuthors: [] });
let st; const imgCache = new Map();
const EMO_R = ['👍', '😂', '❤️', '🙏', '👎', '😢', '😠'], VOTE_K = /vote|reaction|emoji/i;
const EMO = '😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😍 🥰 😘 😎 🤔 😐 😴 😢 😭 😡 🤯 😱 🤗 🙄 👍 👎 👏 🙏 💪 👋 🤝 👌 🎉 🎂 ❤️ 💙 💚 🔥 ⭐ ✅ ❌ ❓ ❗ 📚 ✏️ 🎒 🏫 ⏰ 🌟'.split(' ');
const catOf = c => S.cats.find(x => x.id === c.categoryId) || c.category, tagH = k => k?.name ? `<span class="tag">${esc(k.name)}</span>` : '';
const hl = t => { t = String(t ?? ''); if (!S.mq) return esc(t); return t.split(new RegExp('(' + S.mq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')).map((p, i) => i % 2 ? `<mark>${esc(p)}</mark>` : esc(p)).join(''); };
const chatQs = () => { const q = new URLSearchParams(); if (S.q.trim()) q.set('searchquery', S.q.trim()); if (S.cat) q.set('category', S.cat); return q.size ? '?' + q : ''; };
const loadChats = async () => { S.list = await app('Messenger', 'Index' + chatQs()) || []; };

/* bekannte Kontakte (wie im Original) */
const rec = v => { const [key, text = ''] = String(v).split(/=(.*)/s); return { key: key.trim(), text }; }, fill = v => { const { key, text } = rec(v); return `${key}=${text || S.known.get(key) || ''}`; };
function addKnown(key, text) { if (!key) return; key = key.trim(); if (text || !S.known.has(key)) S.known.set(key, text || S.known.get(key) || ''); }
const addRec = v => { const { key, text } = rec(v); addKnown(key, text); };
async function resolveNames() { const ids = [...S.known].filter(([k, t]) => !t && /^U:USER:[0-9a-f-]{36}$/i.test(k)).map(([k]) => k.slice(7)); for (let i = 0; i < ids.length; i += 100) { try { (await app('App', 'Users', { method: 'POST', body: ids.slice(i, i + 100) }) || []).forEach(u => addKnown(`U:USER:${u.id}`, u.displayname || u.displayName)); } catch (e) { break; } } }
async function harvest() { try { students().forEach(s => addKnown(`P:STUDENT:${s.id}`, s.displayName)); const chats = await app('Messenger', 'Index') || []; chats.forEach(c => addKnown(c.creatorUserId && `U:USER:${c.creatorUserId}`, c.creatorUserDisplayName)); const todo = chats.filter(c => !S.scanned.has(c.id)); let n = 0; await Promise.all([0, 1, 2, 3].map(async () => { while (n < todo.length) { const c = todo[n++]; try { ((await app('Messenger', `Chat/${c.id}/Info`))?.recipients || []).forEach(addRec); S.scanned.add(c.id); } catch (e) { } } })); await resolveNames(); } catch (e) { } }

/* Liste */
const tabs = () => S.route === 'chats' ? [['Alle', () => 1], ['Infokanäle', i => i.isInfoChannel || /infokanal/i.test(`${i.name || ''} ${i.contentTeaser || ''}`)], ['Gepinnt', i => i.isPinned]] : S.route === 'kalender' ? [['Alle', () => 1], ...[...new Set(S.list.map(i => i.category?.name).filter(Boolean))].sort().map(n => [n, i => i.category?.name === n])] : null;
const relDay = d => { const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - today()) / 864e5); return n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n > 1 && n < 15 ? `in ${n} Tagen` : n < 0 ? 'vorbei' : ''; };
const rows = () => { const q = S.q.toLowerCase(), t = tabs()?.[S.tab]; const R = S.list.map((it, i) => [it, i]).filter(([it]) => (S.route === 'chats' || !q || JSON.stringify(LI[S.route] ? LI[S.route](it) : [it.name, it.location, it.text]).toLowerCase().includes(q)) && (!t || t[1](it))); if (S.route === 'kalender') R.sort((a, b) => new Date(a[0].from || a[0].created) - new Date(b[0].from || b[0].created)); return R; };
const chipInner = () => (tabs() || []).map((t, k) => `<button class="chip ${k === S.tab ? 'on' : ''}" data-a="tab" data-v="${k}">${k === S.tab ? ic('check') : ''}${esc(t[0])}</button>`).join('');
const chipRow = () => tabs() && tabs().length > 1 ? `<div class="chips" id="chips">${chipInner()}</div>` : '';
const catSel = () => S.cats.length ? `<div class="tf"><select id="cat"><option value="">Alle Kategorien</option>${S.cats.map(c => `<option value="${c.id}" ${String(S.cat) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><label>Kategorie</label><span class="ms" style="left:auto;right:12px;pointer-events:none">arrow_drop_down</span></div>` : '';
const listHtml = () => { if (S.loading) return loadingH(); const R = rows(); if (!R.length) return '<div class="empty">Keine Einträge.</div>'; let last = '';
  return R.map(([it, i]) => { const on = S.sel === i || (S.chat && S.chat.id === it.id) ? ' on' : '';
    if (S.route === 'chats') { const un = it.unReadCount; return `<button class="li${on}${un ? ' unread' : ''}" data-a="pick" data-v="${i}"><span class="ic ${it.isPinned ? 'pin' : ''}">${ic(it.isPinned ? 'push_pin' : /infokanal/i.test(it.contentTeaser || '') ? 'campaign' : 'forum')}</span><span class="tx"><div class="h">${esc(title(it))}</div><div class="s">${esc(it.contentTeaser || '')}</div>${tagH(catOf(it))}</span>${un ? `<span class="badge">${un}</span>` : ''}</button>`; }
    if (S.route === 'kalender') { const d = new Date(it.from || it.created), g = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), tm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), h = g !== last ? `<div class="gh">${g}</div>` : ''; last = g;
      return h + `<button class="li${on}" data-a="pick" data-v="${i}"><span class="ic dayb"><b>${d.getDate()}</b><small>${d.toLocaleDateString('de-DE', { weekday: 'short' })}</small></span><span class="tx"><div class="h">${esc(it.name)}</div><div class="s">${[tm !== '00:00' ? tm + ' Uhr' : 'Ganztägig', it.location, it.category?.name].filter(Boolean).map(esc).join(' · ')}</div></span><span class="rel">${relDay(d)}</span></button>`; }
    const [icon, h, s] = LI[S.route](it); return `<button class="li${on}" data-a="pick" data-v="${i}"><span class="ic">${ic(icon)}</span><span class="tx"><div class="h">${esc(h)}</div><div class="s">${esc(s)}</div></span></button>`; }).join(''); };
function draw() {
  const r = S.route, A = $('#app'); let h = '';
  if (r === 'login') h = loginV(); else if (r === 'profil') h = profilV(); else if (r === 'newchat') h = newchatV(); else if (r === 'home') h = homeV(); else if (r === 'infopoint') h = infoV(); else if (r === 'fundsachen') h = lostV();
  else { const ch = r === 'chats'; h = shell(SECS.find(s => s[0] === r)[1], `<div class="content"><div class="split ${detOpen() ? 'det' : ''}"><div class="left" style="width:${ch ? 400 : 380}px">${ch ? `<div style="display:flex;gap:8px;align-items:center">${searchBar('Chats durchsuchen')}<button class="ib f" style="width:56px;height:56px" data-a="newchat" aria-label="Neuer Chat">${ic('add')}</button></div>${catSel()}` : searchBar({ personen: 'Person suchen …', medien: 'Medien durchsuchen …', kalender: 'Termine suchen …' }[r])}${chipRow()}<div class="list ${r === 'kalender' ? 'cal' : ''}" id="list">${listHtml()}</div></div><div class="box" id="detail">${detailHtml()}</div></div></div>`); }
  const oc = document.querySelector('.main>.content');
  if (S.drawn === r && oc && r !== 'login') { const tp = document.createElement('template'); tp.innerHTML = h; const nc = tp.content.querySelector('.main>.content'); if (nc) { oc.className = nc.className; oc.innerHTML = nc.innerHTML; bind(); if (r === 'chats' && S.chat) { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; } S.anim = ''; return; } }
  A.innerHTML = h; S.drawn = r; bind(); if (mob()) $('.rail .dest.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); if (r === 'chats' && S.chat) { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; } S.anim = '';
}
const drawList = () => { const l = $('#list'); if (l) l.innerHTML = listHtml(); syncSplit(); };
const mqCount = () => { const n = $('#mqc'); if (n) n.textContent = S.mq ? `${visible().length} Treffer${S.all ? '' : ' …'}` : ''; };
const drawDetail = b => { const d = $('#detail'); if (!d) return; const k = $('#msgs'), keep = k ? k.scrollHeight - k.scrollTop : 0; d.innerHTML = detailHtml(); bind(); const n = $('#msgs'); if (n) n.scrollTop = b ? n.scrollHeight : n.scrollHeight - keep; mqCount(); syncSplit(); };
async function openSec(r) {
  S.sel = S.det = S.chat = null; S.dpush = false; S.dload = false; S.q = ''; S.tab = 0; S.list = []; S.loading = true; S.mq = ''; S.find = false; clearInterval(timer); draw();
  await guard(async () => {
    const L = { chats: async () => (await loadChats(), S.list), home: async () => (S.info = await app('School', 'Index'), []), personen: async () => (S.info = await app('School', 'Index'), students()), medien: () => app('Media', 'Index'), kalender: () => app('Calendar', 'Index'),
      infopoint: async () => { const d = await app('HIP', 'Index'); return d?.students || d?.Students || []; }, fundsachen: () => app('LostAndFound', 'Index') };
    S.list = await L[r]() || [];
  })();
  S.loading = false; if (S.route !== r) return; if (r === 'infopoint' && S.list[0]) { await pick(0); return; } if (r === 'kalender' && rows().length && !mob()) { await pick(rows()[0][1]); return; } if (r === 'chats') timer = setInterval(tick, 20000); draw();
}
const tick = guard(async () => { if (document.hidden || S.route !== 'chats') return; await loadChats(); drawList(); if (S.chat && S.msgs.length) { const id = S.chat.id, el = $('#msgs'), near = el.scrollHeight - el.scrollTop < el.clientHeight + 120, f = await app('Messenger', `Chat/${id}/ItemsAfter/${S.msgs.at(-1).id}?maxitems=1000`) || [], cur = await app('Messenger', `Chat/${id}/Items?page=1&pagesize=30`) || []; if (S.chat?.id !== id) return; let ch = f.length > 0;
  cur.forEach(n => { const m = S.msgs.find(x => x.id === n.id); if (!m) return; const b = JSON.stringify(reacts(m)); Object.keys(m).filter(k => VOTE_K.test(k) && !(k in n)).forEach(k => delete m[k]); Object.keys(n).filter(k => VOTE_K.test(k)).forEach(k => m[k] = n[k]); delete m._my; if (JSON.stringify(reacts(m)) !== b) ch = true; });
  if (f.length) { S.msgs.push(...f); markRead(); } if (ch) renderMsgs(near); } });

/* Detail */
function detailHtml() {
  const r = S.route; if (S.dload) return `<div class="dh mobonly">${mbk()}</div>${loadingH()}`; if (r === 'chats') return chatV(); if (!S.det) return '<div class="empty">Wähle einen Eintrag aus der Liste.</div>'; const d = S.det, it = S.list[S.sel] || {};
  const head = (t, s, a = '') => `<div class="dh">${mbk()}<div class="t"><b>${esc(t)}</b><span>${esc(s)}</span></div>${a}${S.debug ? `<button class="ib" data-a="rawdet" title="Rohdaten (Debug)">${ic('data_object')}</button>` : ''}</div>`;
  if (r === 'personen') { const rk = p => p.userId ? `U:USER:${p.userId}=${p.userDisplayName || p.displayName}` : `P:${p.type}:${p.id}=${p.displayName}`;
    const sec = (ti, info, icon) => { const gs = (info?.details?.length ? info.details.map(x => ({ n: x.displayName, ps: x.persons || [] })) : [{ n: '', ps: Array.isArray(info) ? info : info?.persons || [] }]).filter(g => g.ps.length); if (!gs.length) return '';
      return `<div class="gh" style="padding-left:20px">${ti}</div><div class="list" style="flex:none;padding:0 16px">${gs.flatMap(g => g.ps.map(p => `<div class="li">${S.av && p.userId ? avatar(p.userId, p.displayName, 40, icon) : `<span class="ic">${ic(icon)}</span>`}<span class="tx"><div class="h">${esc(p.displayName)}</div><div class="s">${esc(g.n || p.type || '')}</div></span><button class="ib" data-a="chatWith" data-r="${esc(rk(p))}" aria-label="Schreiben">${ic('chat')}</button></div>`)).join('')}</div>`; };
    const body = sec('Fachlehrer', d.subjectInfo, 'school') + sec('Klasse', d.studentClassInfo, 'groups') + sec('Gruppen', d.studentGroupInfo, 'groups') + sec('Eltern', d.parents, 'family_restroom') + sec('Weitere', d.partners, 'person');
    return head(d.displayName, `Klasse ${d.studentClass || it.studentClass || '–'}`, `<div class="grp"><button class="btn f" data-a="chatWith" data-r="${esc(`P:STUDENT:${d.id}=${d.displayName}`)}">Chat starten</button><button class="btn t" data-a="go" data-v="infopoint">Fehlzeiten</button></div>`) + `<div style="overflow:auto;padding-bottom:16px;flex:1">${body || '<div class="empty">Keine zugeordneten Personen.</div>'}</div>`; }
  if (r === 'medien') return head(d.name, `${d.creatorUserDisplayName || ''} · ${range(d)}`, `<div class="grp"><button class="btn f" data-a="openMedia">Öffnen</button><button class="btn t" data-a="share">Teilen</button></div>`) + `<div style="padding:0 20px 16px;overflow:auto;white-space:pre-wrap">${rich(d.content, false)}<div style="margin-top:12px"><button class="btn o" style="height:40px" data-a="like">${ic(d.liked ? 'favorite' : 'favorite_border')}${d.liked ? 'Like entfernen' : 'Gefällt mir'} (${d.likeCount || 0})</button> ${d.confirmReceive && !d.isConfirmed ? '<button class="btn f" style="height:40px" data-a="confirm">Empfang bestätigen</button>' : ''}</div>${(d.attachments || []).map(a => { const n = (a.mediaFileName || 'Anhang') + (a.mediaExtension || ''); return `<div class="li" style="margin-top:8px"><span class="ic">${ic('attach_file')}</span><span class="tx"><div class="h">${esc(n)}</div><div class="s">${esc(a.mediaSize || '')}</div></span><button class="ib" data-a="dlm" data-id="${a.id}" data-n="${esc(n)}">${ic('download')}</button></div>`; }).join('')}</div>`;
  if (r === 'kalender') { const b = (v, l) => `<button class="btn ${d.confirmAnswer === v ? 'f' : 'o'}" style="height:40px" data-a="ans" data-v="${v}">${l}</button>`; return head(d.name || it.name, `${range(d)}${d.location ? ' · ' + d.location : ''}`) + `<div style="padding:0 20px 16px;white-space:pre-wrap">${tagH(d.category || it.category)}<p>${rich(d.text || 'Keine Beschreibung.', false)}</p>${d.confirmReceive ? `<div class="grp" style="margin-top:16px">${b(1, 'Zusagen')}${b(2, 'Absagen')}${b(0, 'Keine Antwort')}</div>` : ''}</div>`; }
  return '';
}

/* Chat */
/* Reaktionen lesen (tolerant gegenüber dem Antwortformat) */
const meId = () => String(S.profile?.userId || S.profile?.UserId || '').toLowerCase();
function reacts(m) {
  const map = new Map(), add = (e, n, mine, who) => { if (typeof e !== 'string' || !e.trim()) return; e = e.trim(); const o = map.get(e) || { e, n: 0, mine: false, who: [] }; o.n += n; o.mine = o.mine || mine; if (who) o.who.push(who); map.set(e, o); };
  const item = x => { if (typeof x === 'string') return add(x, 1, false, ''); if (x && typeof x === 'object') { const uid = String(x.userId ?? x.creatorUserId ?? x.user?.id ?? '').toLowerCase(); add(x.vote ?? x.emoji ?? x.reaction ?? x.value ?? x.text ?? x.key, Number(x.count ?? x.voteCount ?? x.total ?? 1) || 1, !!(x.isFromMe ?? x.isMine ?? x.mine ?? x.own ?? x.isOwn ?? x.self) || (!!uid && uid === meId()), x.userDisplayName || x.creatorUserDisplayName || x.displayName || x.name || ''); } };
  for (const [k, v] of Object.entries(m)) { if (!VOTE_K.test(k) || k === 'vote' || k[0] === '_' || v == null || typeof v === 'boolean' || typeof v === 'number') continue;
    if (Array.isArray(v)) v.forEach(item); else if (typeof v === 'object') { const es = Object.entries(v); if (es.length && es.every(([, y]) => typeof y === 'number' || Array.isArray(y))) es.forEach(([e, y]) => { const arr = Array.isArray(y) ? y : []; add(e, Array.isArray(y) ? y.length : y, arr.some(u => String(u?.userId ?? u?.id ?? u).toLowerCase() === meId()), arr.map(u => typeof u === 'object' ? u.userDisplayName || u.displayName || '' : '').filter(Boolean).join(', ')); }); else item(v); } else item(v); }
  if (typeof m.vote === 'string' && m.vote.trim()) { const o = map.get(m.vote.trim()); if (o) o.mine = true; else add(m.vote, 1, true, ''); }
  if ('_my' in m) { map.forEach((o, e) => { if (o.mine) { o.n--; o.mine = false; if (o.n <= 0) map.delete(e); } }); if (m._my) { const o = map.get(m._my); if (o) { o.n++; o.mine = true; } else add(m._my, 1, true, ''); } }
  return [...map.values()];
}
const myOf = m => reacts(m).find(r => r.mine)?.e;
const reactH = m => { const R = reacts(m); return R.length ? `<div class="reacts">${R.map(r => `<button class="react ${r.mine ? 'mine' : ''}" ${r.mine ? `data-a="vote" data-e=""` : EMO_R.includes(r.e) ? `data-a="vote" data-e="${r.e}"` : 'data-a="react"'} data-id="${m.id}" title="${esc(r.who.join(', ') || (r.mine ? 'Deine Reaktion' : ''))}">${esc(r.e)}${r.n > 1 ? ` <small>${r.n}</small>` : ''}</button>`).join('')}</div>` : ''; };
/* LoadingIndicator (Shape-Morphing in Container-Kreis) */
const LSH = [[9, .12], [5, .11], [2, .17], [12, .13], [4, .12], [8, .15], [3, .09]], lr = (s, th) => 1 + s[1] * Math.cos(s[0] * th);
const lod = (size = 48) => `<span class="lod" role="status" aria-label="Lädt" style="--s:${size}px"><svg viewBox="-24 -24 48 48" aria-hidden="true"><circle r="24"/><path/></svg></span>`, loadingH = () => `<div class="empty">${lod(48)}</div>`;
function lodTick(t) {
  const ps = document.querySelectorAll('.lod path'); if (!ps.length) return; if (matchMedia('(prefers-reduced-motion:reduce)').matches) t = 0;
  const k = t / 700, i = Math.floor(k) % LSH.length, g = Math.min(1, (k - Math.floor(k)) / .72), x = g - 1, s = 1 + 2.70158 * x * x * x + 1.70158 * x * x, A = LSH[i], B = LSH[(i + 1) % LSH.length], rot = t / 1100; let d = '';
  for (let j = 0; j <= 96; j++) { const th = j / 96 * Math.PI * 2, r = 15.5 * ((1 - s) * lr(A, th) + s * lr(B, th)), a = th + rot; d += (j ? 'L' : 'M') + (Math.cos(a) * r).toFixed(2) + ' ' + (Math.sin(a) * r).toFixed(2); }
  ps.forEach(p => p.setAttribute('d', d + 'Z'));
}
requestAnimationFrame(function L(t) { lodTick(t); requestAnimationFrame(L); });
/* Mobil: Master-Detail */
const mob = () => matchMedia('(max-width:720px)').matches, MD = ['chats', 'personen', 'medien', 'kalender'];
const detOpen = () => MD.includes(S.route) && S.sel != null, syncSplit = () => { const s = document.querySelector('.split'); if (s) s.classList.toggle('det', detOpen()); };
const mbk = () => `<button class="ib mback" data-a="closedet" aria-label="Zurück">${ic('arrow_back')}</button>`;
const mobPush = r => { if (mob() && !S.dpush && MD.includes(r)) { history.pushState({ d: 1 }, ''); S.dpush = true; } };
function closeDetailNow() { S.sel = null; S.chat = null; S.det = null; S.dload = false; S.reply = S.att = null; S.find = false; S.mq = ''; drawList(); drawDetail(); }
addEventListener('popstate', () => { if (S.dpush) { S.dpush = false; closeDetailNow(); } });
matchMedia('(max-width:720px)').addEventListener('change', () => { S.drawn = null; draw(); });
const visible = () => S.mq ? S.msgs.filter(m => `${m.content || ''} ${m.creatorUserDisplayName || ''} ${m.attachmentName || ''}`.toLowerCase().includes(S.mq)) : S.msgs;
const msgsHtml = () => visible().map(m => `<div class="msg ${m.isFromMe ? 'me' : ''}">${m.isFromMe ? '' : avatar(m.creatorUserId, m.creatorUserDisplayName, 36)}<div class="mc"><div class="card">${m.replyToMessage ? `<div class="q">${esc(m.replyToMessage.content || 'Anhang')}</div>` : ''}<h3>${rich(m.content)}</h3>${m.hasAttachment ? `<button class="chip" data-a="att" data-id="${m.attachmentId}" data-n="${esc(m.attachmentName || 'Anhang')}">${ic('attach_file')}${hl(m.attachmentName || 'Anhang')}</button>` : ''}<p>${hl(m.isFromMe ? 'Du' : m.creatorUserDisplayName || 'Unbekannt')} · ${fmt(m.created)}</p>${S.debug ? `<p class="dbgid">id ${esc(m.id)} · user ${esc(m.creatorUserId || '–')}</p>` : ''}${reactH(m)}</div>${S.emo === String(m.id) ? `<div class="emojis">${EMO_R.map(e => `<button class="${myOf(m) === e ? 'on' : ''}" data-a="vote" data-id="${m.id}" data-e="${e}">${e}</button>`).join('')}${myOf(m) ? `<button data-a="vote" data-id="${m.id}" data-e="" title="Reaktion entfernen">✕</button>` : ''}</div>` : ''}<div class="acts"><button class="ib" data-a="react" data-id="${m.id}" aria-label="Reagieren">${ic('add_reaction')}</button><button class="ib" data-a="reply" data-id="${m.id}" aria-label="Antworten">${ic('reply')}</button>${S.debug ? `<button class="ib" data-a="rawmsg" data-id="${m.id}" aria-label="Rohdaten">${ic('data_object')}</button>` : ''}${m.canDelete || m.isFromMe || S.chat.isOwner ? `<button class="ib" data-a="delmsg" data-id="${m.id}" aria-label="Löschen">${ic('delete')}</button>` : ''}</div></div></div>`).join('') || `<div class="empty">${S.mq ? 'Keine Treffer.' : 'Noch keine Nachrichten.'}</div>`;
const renderMsgs = bottom => { const el = $('#msgs'); if (!el) return; const keep = el.scrollHeight - el.scrollTop; el.innerHTML = msgsHtml(); mqCount(); el.scrollTop = bottom ? el.scrollHeight : S.mq ? 0 : el.scrollHeight - keep; };
function chatV() {
  const c = S.chat; if (!c) return '<div class="empty">Wähle einen Chat aus der Liste.</div>';
  const a = (n, v, t, on) => `<button class="ib ${on ? 'sel' : ''}" data-a="${n}" title="${t}" aria-label="${t}">${ic(v)}</button>`;
  return `<div class="dh">${mbk()}<div class="t"><b>${esc(title(c))}</b><span>${c.canPost === false ? 'Schreiben nicht erlaubt' : c.isOwner ? 'Du bist Besitzer' : ''}</span>${tagH(catOf(c))}</div><div class="grp">${a('chatinfo', 'info', 'Chat-Info')}${S.debug ? a('rawchat', 'data_object', 'Rohdaten (Debug)') : ''}${a('findmsg', 'search', 'Im Verlauf suchen', S.find)}${a('editchat', 'edit', 'Chat bearbeiten')}${a('older', 'history', 'Ältere Nachrichten')}${a('mute', 'notifications_off', 'Stumm schalten', c.isSilent)}${a('pin', 'push_pin', 'Anheften', c.isPinned)}${c.isOwner ? a('delchat', 'delete', 'Chat löschen') : ''}</div></div>
<div class="comp ${S.find ? '' : 'hidden'}" id="msearch"><div class="search" style="flex:1"><span class="ms">search</span><input id="mq" placeholder="In diesem Chat suchen …" value="${esc(S.mq)}" autocomplete="off"><span id="mqc"></span></div></div><div class="msgs" id="msgs">${msgsHtml()}</div>
${c.canPost === false ? '' : `${S.reply || S.att ? `<button class="chip on" style="margin:0 16px;align-self:flex-start;border-radius:8px;flex:none" data-a="clearchip">${S.reply ? 'Antwort an ' + esc(S.reply.creatorUserDisplayName || '') : ''} ${S.att ? ic('attach_file') + esc(S.att.name) : ''} ${ic('close')}</button>` : ''}<div class="emopanel hidden" id="emoP">${EMO.map(e => `<button type="button" data-a="emoins" data-e="${e}">${e}</button>`).join('')}</div><form class="comp" id="comp"><div class="grp"><button type="button" class="ib t" data-a="emo" aria-label="Emoji wählen">${ic('sentiment_satisfied')}</button><button type="button" class="ib t" data-a="attach" aria-label="Anlage hinzufügen">${ic('attach_file')}</button></div><div class="tf f"><input id="msg" placeholder=" " autocomplete="off"><label>Nachricht schreiben …</label></div><button class="ib f" style="width:56px;height:56px" aria-label="Senden">${ic('send')}</button><input type="file" id="file" class="hidden"></form>`}`;
}
const markRead = async () => { const ids = S.msgs.filter(m => !m.isRead).map(m => m.id); await app('Messenger', `Chat/${S.chat.id}/MarkAsRead`, { method: 'POST', body: ids.length ? { ids } : {} }); S.msgs.forEach(m => m.isRead = true); const c = S.list.find(x => x.id === S.chat.id); if (c) c.unReadCount = 0; drawList(); };
const openChat = async c => { S.chat = null; S.dload = true; drawList(); drawDetail(); try { const ch = await app('Messenger', `Chat/${c.id}`); S.msgs = await app('Messenger', `Chat/${c.id}/Items?page=1&pagesize=30`) || []; S.chat = ch; } catch (e) { S.dload = false; drawDetail(); throw e; } S.dload = false; S.reply = S.att = null; S.mq = ''; S.find = false; S.all = false; S.emo = null; S.msgs.forEach(m => addKnown(m.creatorUserId && `U:USER:${m.creatorUserId}`, m.creatorUserDisplayName)); drawList(); drawDetail(true); await markRead(); };
const loadAll = guard(async () => { if (!S.chat || S.all || S.busy) return; S.busy = 1; try { for (let n = 0; n < 100 && !S.all && S.mq; n++) { const o = await app('Messenger', `Chat/${S.chat.id}/ItemsBefore/${S.msgs[0]?.id || ''}`) || []; if (!o.length) S.all = true; else { S.msgs = [...o, ...S.msgs]; renderMsgs(); } } } finally { S.busy = 0; renderMsgs(); } });
const send = guard(async () => { const content = $('#msg').value; if (!S.chat || (!content.trim() && !S.att)) return; const b = { content }; if (S.att) b.tempId = S.att.tempId; if (S.reply) b.replyToMessageId = S.reply.id; const m = await app('Messenger', `Chat/${S.chat.id}/Create`, { method: 'POST', body: b }); S.att = S.reply = null; if (m) S.msgs.push(m); drawDetail(true); $('#msg')?.focus(); loadChats().then(drawList); });
const tog = async (ep, p) => { const v = !S.chat[p]; await app('Messenger', `Chat/${S.chat.id}/${ep}`, { method: 'POST', body: { [p]: v } }); S.chat[p] = v; const c = S.list.find(x => x.id === S.chat.id); if (c) c[p] = v; drawDetail(); drawList(); };
const startChat = guard(async (rcp, name = null, reuse = true, lim = false) => { const c = await app('Messenger', 'Chat/Create', { method: 'POST', body: { recipients: rcp, name, useExisting: reuse, authorsLimited: lim } }); S.hist = []; S.route = 'chats'; S.anim = 'fade'; await openSec('chats'); await openChat(c); });

/* Home */
const homeV = () => { const L = S.info?.links || S.info?.Links || [], n = S.info?.name || S.info?.Name || '', C = [['kalender', 'event', 'Nächste Klausuren', 'Termine und Klausuren im Kalender'], ['infopoint', 'school', 'Fehlzeiten', 'Fehltage und Fehlstunden im InfoPoint'], ['chats', 'chat_bubble', 'Chats', 'Nachrichten und Infokanäle'], ['fundsachen', 'inventory_2', 'Fundsachen', 'Fundbüro der Schule'], ['medien', 'description', 'Medien', 'Dokumente und Formulare'], ['profil', 'account_circle', 'Mein Konto', 'Profil, Schule und Abmelden']];
  const hr = new Date().getHours(), g = hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend', host = u => { try { return new URL(u).host; } catch (e) { return u || ''; } };
  return shell('Home', `<div class="content"><div><div style="font:700 28px/36px Roboto">${g}</div><div style="font-size:16px;color:var(--on-surface-variant)">${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${n ? ' · ' + esc(n) : ''}</div></div><div class="grid">${C.map(c => `<button class="card" data-a="go" data-v="${c[0]}">${ic(c[1])}<h3>${c[2]}</h3><p>${c[3]}</p></button>`).join('')}</div>${S.loading ? `<div class="empty">${lod(40)}</div>` : L.length ? `<div style="font:500 20px/28px Roboto;margin-top:8px">Weblinks der Schule</div><div class="list" style="flex:none">${L.map((l, k) => `<button class="li" data-a="link" data-k="${k}"><span class="ic">${ic('link')}</span><span class="tx"><div class="h">${esc(l.title || l.Title || 'Link')}</div><div class="s">${esc(host(l.url || l.Url))}</div></span>${ic('open_in_new')}</button>`).join('')}</div>` : ''}</div>`); };

/* InfoPoint (Auswertung wie im Original) */
const HC = { abs: 'Fehlzeiten', rem: 'Bemerkungen', grd: 'Noten', hw: 'Hausaufgaben', les: 'Unterricht', plan: 'Stundenplan', oth: 'Weitere' };
function hipParse(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html'), out = [], clean = s => s.replace(/\s+/g, ' ').trim(), HEAD = /^(H[1-6]|STRONG|B|LEGEND|SUMMARY|DT)$/;
  let ph = '', pl = '';
  doc.body.querySelectorAll('table,h1,h2,h3,h4,h5,h6,strong,b,legend,summary,dt,p,div,span,li').forEach(el => {
    if (el.tagName !== 'TABLE') { const ct = el.closest('table'); if (ct && !ct.querySelector('table')) return; if (!HEAD.test(el.tagName) && el.children.length) return; const x = clean(el.textContent); if (x && x.length <= 100) { if (HEAD.test(el.tagName)) ph = x; else pl = x; } return; }
    const t = el; if (t.querySelector('table')) return;
    const rs = [...t.querySelectorAll('tr')].map(r => [...r.children].filter(c => /^t[hd]$/i.test(c.tagName)).map(c => clean(c.textContent))).filter(r => r.some(Boolean)); if (!rs.length) { ph = pl = ''; return; }
    let old = t.querySelector('caption')?.textContent || '', e = t.previousElementSibling, n = 0; while (!old && e && n++ < 3) { const x = clean(e.textContent); if (x && x.length < 80) old = x; e = e.previousElementSibling; }
    let ti = clean(t.querySelector('caption')?.textContent || '') || ph || pl; ph = pl = '';
    if (rs.length > 1 && rs[0].length === 1 && rs[1].length > 1) ti = rs.shift()[0];
    const head = rs[0], hs = head.join(' ').toLowerCase(), s = (old + ' ' + hs).toLowerCase(), body = rs.slice(1).filter(r => r.join('|') !== head.join('|'));
    const cls = /hausaufg/.test(hs) ? 'hw' : /stundenplan/i.test(old) ? 'plan' : /fehl|absenz|abwesen|entschuldigt/.test(s) ? 'abs' : /bemerk|vermerk/.test(s) ? 'rem' : /note|zensur/.test(s) ? 'grd' : /unterricht|inhalt/.test(s) ? 'les' : 'oth', sig = head.join('|'), p = out.at(-1);
    if (p && p.cls === cls && p.sig === sig && (!ti || ti === p.title)) p.rows.push(...body); else out.push({ title: ti, head, rows: body, cls, sig });
  }); return out;
}
function hipDoc(html) {
  const d = new DOMParser().parseFromString(String(html), 'text/html'); d.querySelectorAll('script,style,link,base,iframe,object,embed,form,input,button,video,audio').forEach(n => n.remove());
  d.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { const k = a.name.toLowerCase(); if (k.startsWith('on') || k === 'style' || k === 'srcdoc' || (k === 'href' && !/^(https?:|mailto:|#)/i.test(a.value.trim()))) n.removeAttribute(a.name); }));
  d.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  return `<!doctype html><meta charset=utf-8><base target=_blank><style>body{margin:0;padding:20px;background:#fff;font:15px/1.45 system-ui,sans-serif;color:#17202a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9aa5b1;padding:.4em;text-align:left;vertical-align:top}th{background:#edf1f5}img{max-width:100%}</style>${d.body.innerHTML}`;
}
const hrsOf = s => { if (/ganz/i.test(s)) return 0; const m = /(\d+)\.?\s*(?:bis|-|–)\s*(\d+)/i.exec(s); return m ? Math.abs(+m[2] - +m[1]) + 1 : /\d+\.?\s*Std/i.test(s) ? 1 : 0; };
const tblH = ts => ts.map(t => `${t.title ? `<h3 class="th">${esc(t.title)}</h3>` : ''}<div class="tbl"><table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('') || '<div class="empty">Keine Einträge.</div>';
function hipBody(d, P, k) {
  if (k === 'orig') { const x = (d.contentCompact || d.ContentCompact || d.content || d.Content); return (x ? `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" title="Home.InfoPoint" srcdoc="${esc(hipDoc(x))}"></iframe>` : '<div class="empty">Keine Inhalte geliefert.</div>'); }
  const ts = P.filter(t => t.cls === k);
  if (k !== 'abs') return tblH(ts);
  return absView(ts);
}
const dateRe = /\b\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2})\b/;
function absSegs(txt) {
  return txt.split(/\s*,\s*/).filter(Boolean).map(p => { const un = /un-?entschuldigt|nicht entschuldigt/i.test(p), st = un ? 'Unentschuldigt' : /entschuldigt/i.test(p) ? 'Entschuldigt' : '';
    if (/^\s*(ganzer\s+)?tag\b/i.test(p) || /ganz/i.test(p)) return { d: 1, un, st };
    const m = /(\d+)\.?\s*(?:bis|-|–)\s*(\d+)/i.exec(p); if (m) return { a: +m[1], b: +m[2], un, st };
    const s = /(\d+)\.?\s*(?:Std|Stunde)/i.exec(p); if (s) return { a: +s[1], b: +s[1], un, st }; return { raw: p, un, st }; });
}
function absText(segs) {
  const g = []; segs.filter(s => s.a != null).sort((x, y) => x.a - y.a).forEach(s => { const l = g.at(-1); if (l && l.st === s.st && s.a <= l.b + 1) l.b = Math.max(l.b, s.b); else g.push({ a: s.a, b: s.b, st: s.st }); });
  const f = st => st ? ` (${st})` : '';
  return [...segs.filter(s => s.d).map(s => `Ganzer Tag${f(s.st)}`), ...g.map(x => `${x.a === x.b ? `${x.a}. Std.` : `${x.a}. bis ${x.b}. Std.`}${f(x.st)}`), ...segs.filter(s => s.raw).map(s => s.raw)].join(', ');
}
function absView(ts) {
  const all = ts.flatMap(t => t.rows), ent = [], days = [0, 0], hrs = [0, 0];
  all.forEach(r => { const di = r.findIndex(c => dateRe.test(c)); if (di < 0) return; const segs = absSegs(r.filter((c, i) => i !== di && c && !/^[-–—]+$/.test(c)).join(', '));
    segs.forEach(s => { if (s.d) days[+s.un]++; else if (s.a != null) hrs[+s.un] += s.b - s.a + 1; }); ent.push({ day: dateRe.exec(r[di])[0], text: absText(segs) }); });
  const nums = l => { const r = all.find(r => new RegExp('^' + l, 'i').test(String(r[0] || '').trim())), n = r ? r.slice(1).map(x => parseInt(x, 10)).filter(Number.isFinite) : []; return n.length >= 2 ? n : null; };
  const td = nums('Fehltag') || days, th = nums('Fehlstunde') || hrs, stat = (n, l) => `<div class="card"><h3>${n}</h3><p>${l}</p></div>`;
  return `<div class="stats">${stat(td[0], td[0] === 1 ? 'Fehltag entschuldigt' : 'Fehltage entschuldigt')}${stat(td[1], 'Fehltage unentschuldigt')}${stat(th[0], 'Fehlstunden entschuldigt')}${stat(th[1], 'Fehlstunden unentschuldigt')}</div><b style="font-size:20px">Fehlzeiten</b>` +
    (ent.length ? `<div class="list" style="flex:none">${ent.map(x => `<div class="li"><span class="ic">${ic('event_busy')}</span><span class="tx"><div class="h">${esc(x.day)}</div>${x.text ? `<div class="s wrap">${esc(x.text)}</div>` : ''}</span></div>`).join('')}</div>` : '<div class="empty">Keine Fehlzeiten eingetragen.</div>');
}
function infoV() {
  const d = S.det; let body = loadingH(), tb = '';
  if (d) { const P = d._p || (d._p = hipParse(d.content || d.Content || d.contentCompact || d.ContentCompact)), ks = ['abs', 'rem', ...Object.keys(HC).slice(2).filter(k => P.some(t => t.cls === k)), 'orig']; if (!ks.includes(S.hipTab)) S.hipTab = ks[0]; tb = `<div class="tabs">${ks.map(k => `<button class="tab ${k === S.hipTab ? 'on' : ''}" data-a="hiptab" data-v="${k}">${HC[k] || 'Original'}</button>`).join('')}</div>`; body = hipBody(d, P, S.hipTab); }
  return shell('InfoPoint', `<div class="content"><div class="tf" style="flex:none;max-width:360px"><select id="person">${S.list.map((s, i) => `<option value="${i}" ${i === S.sel ? 'selected' : ''}>${esc((s.displayName || s.name) + (s.studentClass ? ` (${s.studentClass})` : ''))}</option>`).join('') || '<option>–</option>'}</select><label>Person</label><span class="ms" style="left:auto;right:12px;pointer-events:none">arrow_drop_down</span></div>${S.debug ? `<button class="btn t" style="height:40px;align-self:flex-start" data-a="rawdet">${ic('data_object')}Rohdaten</button>` : ''}${tb}${body}</div>`);
}

/* Fundsachen */
const imgUrl = async (id, w) => { const k = id + w; if (!imgCache.has(k)) imgCache.set(k, URL.createObjectURL(await http(root(`LostAndFound/Image/${encodeURIComponent(id)}?w=${w}`), { blob: true }))); return imgCache.get(k); };
const loadImg = async (el, id, w) => { try { el.innerHTML = `<img src="${await imgUrl(id, w)}" alt="">`; } catch (e) { el.innerHTML = ic('broken_image'); } };
const lostGrid = () => S.loading ? loadingH() : rows().map(([it, i]) => `<button class="card ${it.hasAttachment ? '' : 'noimg'}" data-a="pick" data-v="${i}">${it.hasAttachment ? `<div class="ph" data-img="${esc(it.id)}">${lod(40)}</div>` : ''}<div class="tx"><h3>${esc(title(it))}</h3><p>${esc(it.location || 'Kein Fundort')}</p></div></button>`).join('') || '<div class="empty">Keine Fundsachen.</div>';
const lostV = () => shell('Fundsachen', `<div class="content"><div style="max-width:560px;flex:none">${searchBar('Fundsachen durchsuchen …')}</div><div class="lgrid" id="lgrid">${lostGrid()}</div></div>`);
function openLost(it) {
  const dg = document.createElement('dialog'); dg.className = 'dlg'; dg.innerHTML = `<h2>${esc(title(it))}</h2><div class="sub">${ic('place')} ${esc(it.location || 'Kein Fundort')}</div>${it.hasAttachment ? `<div class="ph big">${lod(48)}</div>` : ''}${it.text ? `<p style="white-space:pre-wrap">${rich(it.text, false)}</p>` : ''}${S.debug ? `<details><summary>Rohdaten (Debug)</summary><pre class="raw">${esc(pj(it))}</pre></details>` : ''}<div class="grp" style="justify-content:flex-end"><button class="btn x" data-close>Schließen</button></div>`;
  document.body.append(dg); dg.onclick = e => { if (e.target === dg || e.target.closest('[data-close]')) dg.close(); }; dg.onclose = () => dg.remove(); dg.showModal(); const p = dg.querySelector('.ph'); if (p) loadImg(p, it.id, 1024);
}

/* Neuer Chat / Bearbeiten */
const rsel = () => S.rcp.map((v, i) => `<span class="pc">${esc(rec(v).text || rec(v).key)}<button class="ib" style="width:28px;height:28px" data-a="rm" data-v="${i}" aria-label="Entfernen">${ic('close')}</button></span>`).join('') || '<span style="color:var(--on-surface-variant)">Noch niemand ausgewählt.</span>';
const newchatV = () => `<div class="main up" style="height:100dvh"><header class="bar"><button class="ib" data-a="back" aria-label="Schließen">${ic('close')}</button><h1>${S.edit ? 'Chat bearbeiten' : 'Neuer Chat'}</h1><button class="ib" data-a="go" data-v="profil">${ic('account_circle')}</button></header><div class="content"><form class="form" id="ncf"><div class="tf"><input id="cName" placeholder=" " value="${esc(S.cname || '')}"><label>Name (optional)</label></div><b style="font-size:16px">Empfänger</b><div class="search"><span class="ms">search</span><input id="rq" placeholder="Name, Klasse oder Rolle suchen …" autocomplete="off"></div><div class="list" id="rres" style="flex:none"></div><div class="pk" id="rsel">${rsel()}</div><button type="button" class="btn x" data-a="man">${ic('add')}Manuell per ID hinzufügen</button>${S.man ? `<div class="tf"><input id="mid" placeholder=" "><label>ID oder U:USER:{id}=Name</label></div><button type="button" class="btn t" data-a="addman">Hinzufügen</button>` : ''}${S.edit ? '' : sw('reuse', 'Bestehenden Einzelchat wiederverwenden', S.reuse)}${sw('lim', 'Nur Chat-Ersteller darf schreiben', S.lim)}<div class="err">${esc(S.err)}</div><div class="grp"><button type="button" class="btn o" style="flex:1" data-a="back">Abbrechen</button><button class="btn f" style="flex:1">${S.edit ? 'Speichern' : 'Erstellen'}</button></div></form></div></div>`;
function showRes(arr) { const have = new Set(S.rcp.map(v => rec(v).key)), f = arr.filter(x => !have.has(x.key)).slice(0, 30); $('#rres').innerHTML = f.map(x => `<button type="button" class="li" data-a="add" data-v="${esc(x.key + '=' + x.text)}"><span class="ic">${ic(x.key.startsWith('U:') || x.key.startsWith('P:') ? 'person' : 'groups')}</span><span class="tx"><div class="h">${esc(x.text || x.key)}</div><div class="s">${x.key.startsWith('U:USER') ? 'Person' : x.key.startsWith('P:STUDENT') ? 'Schüler/in' : x.key.startsWith('P:') ? 'Person (Schule)' : 'Gruppe / Rolle'}</div></span></button>`).join('') || '<div class="empty">Keine Treffer.</div>'; }

/* Aktionen */
const pick = guard(async i => {
  const it = S.list[i], r = S.route; S.sel = i; mobPush(r); syncSplit(); if (r === 'chats') return openChat(it); if (r === 'fundsachen') return openLost(it);
  const G = { personen: () => app('School', `Student/${encodeURIComponent(it.id)}`), medien: () => app('Media', `Detail/${it.id}?lang=`), kalender: () => app('Calendar', `Detail/${it.id}?lang=`), infopoint: () => app('HIP', `Student/${encodeURIComponent(it.id)}`) };
  S.det = null; S.dload = r !== 'infopoint'; if (r === 'infopoint') { S.hipTab = ''; draw(); } else { drawList(); drawDetail(); } let d; try { d = await G[r](); } catch (e) { S.dload = false; drawDetail(); throw e; } S.dload = false; if (S.sel !== i) return; S.det = r === 'infopoint' ? { ...d } : d; if (r === 'infopoint') draw(); else { drawList(); drawDetail(); }
});
const ACT = {
  theme: (e, d) => { try { localStorage.setItem('msd-theme', d.v); } catch (x) { } applyTheme(d.v); document.querySelectorAll('.swc').forEach(b => { const on = b.dataset.v === d.v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('.dot').innerHTML = on ? ic('check') : ''; }); },
  chatinfo: () => chatInfo(), tapname: () => { S.taps++; clearTimeout(S.tapT); S.tapT = setTimeout(() => S.taps = 0, 2000); if (S.taps >= 7) { S.taps = 0; dbgSet(!S.debug); } else if (S.taps >= 3) toast(`Noch ${7 - S.taps}× tippen, um den Debug-Modus ${S.debug ? 'zu deaktivieren' : 'zu aktivieren'}`); },
  dbgopen: () => openDbg(), dbgoff: () => dbgSet(false), dbgclear: () => { S.log = []; renderDbg(); }, dtab: (e, d) => { S.dtab = d.v; renderDbg(); },
  dbgcopy: async () => { await navigator.clipboard.writeText(S.dtab === 'log' ? pj(S.log, 400000) : ctxRows().map(r => r.join(': ')).join('\n')); toast('Kopiert.'); },
  rawchat: () => showJson('Chat – Rohdaten', { chat: S.chat, info: S.cinfoFor === S.chat?.id ? S.cinfo : '(Chat-Info noch nicht geladen)', eigeneUserId: S.profile?.userId }), rawmsg: (e, d) => showJson('Nachricht – Rohdaten', S.msgs.find(m => String(m.id) === d.id)), rawdet: () => showJson('Detail – Rohdaten', S.det || S.list[S.sel]),
  more: () => openMore(),
  closedet: () => { if (S.dpush) history.back(); else closeDetailNow(); },
  wide: () => { S.wide = !S.wide; document.querySelector('.shell').classList.toggle('wide', S.wide); document.querySelector('[data-a=wide] .ms').textContent = S.wide ? 'menu_open' : 'menu'; },
  go: (e, d) => nav(d.v, d.v === 'profil' ? 'right' : 'fade'), back: goBack, newchat: () => { S.edit = null; S.rcp = []; S.err = ''; S.cname = ''; S.man = false; S.lim = false; S.reuse = true; nav('newchat', 'up'); },
  tab: (e, d) => { S.tab = +d.v; $('#chips').innerHTML = chipInner(); drawList(); }, pick: (e, d) => pick(+d.v),
  chatWith: (e, d) => { S.edit = null; S.rcp = [d.r]; S.err = ''; S.man = false; S.cname = ''; S.lim = false; S.reuse = true; nav('newchat', 'up'); }, hiptab: (e, d) => { S.hipTab = d.v; draw(); },
  findmsg: () => { S.find = !S.find; $('#msearch').classList.toggle('hidden', !S.find); e_sel(); if (S.find) $('#mq').focus(); else { S.mq = ''; $('#mq').value = ''; renderMsgs(true); } },
  older: async () => { const o = await app('Messenger', `Chat/${S.chat.id}/ItemsBefore/${S.msgs[0]?.id || ''}`) || []; if (!o.length) { S.all = true; return toast('Alle Nachrichten geladen.'); } S.msgs = [...o, ...S.msgs]; renderMsgs(); },
  editchat: async () => { const d = await app('Messenger', `Chat/${S.chat.id}/Edit`); (d.recipients || []).concat(d.authors || []).forEach(addRec); await resolveNames(); S.edit = S.chat.id; S.cname = d.name || ''; S.lim = !!d.authorsLimited; S.rcp = (d.recipients || []).map(fill); S.editAuthors = d.authors || []; S.err = ''; S.man = false; nav('newchat', 'up'); },
  mute: () => tog('Mute', 'isSilent'), pin: () => tog('Pin', 'isPinned'),
  delchat: async () => { if (!confirm(`Chat „${title(S.chat)}“ löschen?`)) return; await app('Messenger', `Chat/${S.chat.id}`, { method: 'DELETE' }); toast('Chat gelöscht.'); openSec('chats'); },
  reply: (e, d) => { S.reply = S.msgs.find(m => String(m.id) === d.id); drawDetail(); $('#msg')?.focus(); }, clearchip: () => { S.reply = S.att = null; drawDetail(); },
  delmsg: async (e, d) => { if (!confirm('Nachricht löschen?')) return; const r = await app('Messenger', `Chat/${S.chat.id}/Delete`, { method: 'POST', body: { ids: [d.id] } }); if (r === true || r?.value === true) { S.msgs = S.msgs.filter(m => String(m.id) !== d.id); renderMsgs(); } },
  react: (e, d) => { S.emo = S.emo === d.id ? null : d.id; renderMsgs(); },
  vote: async (e, d) => { const m = S.msgs.find(x => String(x.id) === d.id); await app('Messenger', `Chat/${S.chat.id}/Vote/${d.id}`, { method: 'POST', body: { vote: d.e || null } }); m.vote = d.e || null; m._my = d.e || null; S.emo = null; renderMsgs(); },
  emo: () => $('#emoP').classList.toggle('hidden'), emoins: (e, d) => { const t = $('#msg'), s = t.selectionStart ?? t.value.length; t.setRangeText(d.e, s, t.selectionEnd ?? s, 'end'); t.focus(); }, attach: () => $('#file').click(),
  att: (e, d) => dl(root(`Messenger/Chat/${S.chat.id}/Download/${d.id}`), d.n), dlm: (e, d) => dl(root(`Media/Download/${d.id}`), d.n),
  openMedia: () => { const a = S.det.attachments?.[0]; if (a) dl(root(`Media/Download/${a.id}`), (a.mediaFileName || 'Dokument') + (a.mediaExtension || '')); else toast('Dieses Medium hat keinen Anhang.'); },
  share: async () => { const t = `${S.det.name}\n${S.det.content || ''}`.trim(); if (navigator.share) { try { await navigator.share({ title: S.det.name, text: t }); } catch (e) { } } else { await navigator.clipboard.writeText(t); toast('In die Zwischenablage kopiert.'); } },
  like: async () => { await app('Media', `ToggleLike/${S.det.id}`, { method: 'POST', body: {} }); S.det.liked = !S.det.liked; S.det.likeCount = Math.max(0, (S.det.likeCount || 0) + (S.det.liked ? 1 : -1)); drawDetail(); },
  confirm: async () => { await app('Media', `Confirm/${S.det.id}`, { method: 'POST', body: {} }); S.det.isConfirmed = true; drawDetail(); },
  ans: async (e, d) => { await app('Calendar', `Confirm/${S.det.id}`, { method: 'POST', body: { answer: +d.v } }); S.det.confirmAnswer = +d.v; drawDetail(); toast('Rückmeldung gespeichert.'); },
  link: (e, d) => { const l = (S.info.links || S.info.Links)[+d.k], u = new URL(l.url || l.Url); if (!/^https?:$/.test(u.protocol)) throw new Error('Ungültiger Link'); open(u.href, '_blank', 'noopener,noreferrer'); },
  man: () => { S.man = !S.man; S.cname = $('#cName')?.value; draw(); }, addman: () => { const l = $('#mid').value.trim(), m = /^([0-9a-f-]{36})\s*[=,;]?\s*(.*)$/i.exec(l); let v; if (m) v = `U:USER:${m[1]}=${m[2]}`; else if (/^\w+:\w+:\S+/.test(l)) v = l.includes('=') ? l : l + '='; else return toast('Ungültige ID', 1); addRec(v); S.rcp.push(fill(v)); $('#mid').value = ''; $('#rsel').innerHTML = rsel(); resolveNames().then(() => { S.rcp = S.rcp.map(fill); const r = $('#rsel'); if (r) r.innerHTML = rsel(); }); },
  rm: (e, d) => { S.rcp.splice(+d.v, 1); $('#rsel').innerHTML = rsel(); }, add: (e, d) => { addRec(d.v); S.rcp.push(d.v); $('#rsel').innerHTML = rsel(); $('#rres').innerHTML = ''; $('#rq').value = ''; },
  sw: (e, d) => { S[d.v] = !S[d.v]; e.target.closest('.sw').classList.toggle('on', S[d.v]); if (d.v === 'navfit') { try { localStorage.setItem('msd-navfit', S.navfit ? '1' : '0'); } catch (x) { } } if (d.v === 'av') { try { localStorage.setItem('msd-avatars', S.av ? '1' : '0'); } catch (x) { } if (!S.av) { avCache.forEach(async pr => { const u = await pr; if (u) URL.revokeObjectURL(u); }); avCache.clear(); } draw(); } },
  copyid: async () => { await navigator.clipboard.writeText(S.profile?.userId || S.profile?.UserId || ''); toast('User-ID kopiert.'); },
  web: async () => { const t = await http(`${S.base}/Api/v1.0/App/App/OneTimeToken`, { method: 'POST', body: {} }), k = t?.token || t?.Token; if (!k) throw new Error('Kein Einmal-Token erhalten.'); open(`${S.base}/Account/Login?token=${encodeURIComponent(k)}&inapp=1&returnurl=${encodeURIComponent(`/${S.school}/account/profile`)}`, '_blank', 'noopener'); },
  logout: () => { sessionStorage.removeItem(KEY); clearInterval(timer); location.reload(); }
};
const e_sel = () => document.querySelector('[data-a=findmsg]')?.classList.toggle('sel', S.find);
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target; if (f.id === 'comp' && !f.onsubmit) send(); }, false);
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && ACT[b.dataset.a]) guard(ACT[b.dataset.a])(e, b.dataset); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.sw')) { e.preventDefault(); e.target.click(); } if (e.key === 'Escape' && (S.route === 'newchat' || S.route === 'profil') && !document.querySelector('dialog[open]')) goBack(); });
function bind() {
  const q = $('#q'); if (q) q.oninput = () => { S.q = q.value; clearTimeout(st); st = setTimeout(guard(async () => { if (S.route === 'chats') await loadChats(); if (S.route === 'fundsachen') { $('#lgrid').innerHTML = lostGrid(); bind(); } else drawList(); }), 250); };
  const cat = $('#cat'); if (cat) cat.onchange = guard(async () => { S.cat = cat.value; await loadChats(); drawList(); });
  document.querySelectorAll('#lgrid [data-img]').forEach(e => loadImg(e, e.dataset.img, 480));
  const c = $('#comp'); if (c) { c.onsubmit = e => { e.preventDefault(); send(); }; $('#file').onchange = guard(async e => { const f = e.target.files[0]; if (!f) return; const tempId = [...crypto.getRandomValues(new Uint8Array(40))].map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36]).join(''), fd = new FormData(); fd.append('file', f, f.name); toast('Lade Anhang hoch …'); await app('Messenger', `Chat/${S.chat.id}/Upload/${tempId}`, { method: 'POST', body: fd }); S.att = { tempId, name: f.name }; drawDetail(); toast('Anhang bereit'); }); }
  const mq = $('#mq'); if (mq) { let t; mq.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.mq = mq.value.trim().toLowerCase(); renderMsgs(!S.mq); if (S.mq) loadAll(); }, 250); }; }
  const p = $('#person'); if (p) p.onchange = () => pick(+p.value);
  const rq = $('#rq'); if (rq) { let t; rq.oninput = () => { clearTimeout(t); t = setTimeout(guard(async () => { const term = rq.value.trim(); if (!term) { $('#rres').innerHTML = ''; return; } const lc = term.toLowerCase(), m = new Map([...S.known].filter(([k, x]) => `${x} ${k}`.toLowerCase().includes(lc)).map(([k, x]) => [k, { key: k, text: x }])); showRes([...m.values()]); try { (await app('School', `SearchRecipients/${encodeURIComponent(term)}`) || []).forEach(x => { addKnown(x.key, x.text); m.set(x.key, { key: x.key, text: x.text }); }); if (rq.value.trim() === term) showRes([...m.values()]); } catch (e) { } }), 250); }; }
  const nf = $('#ncf'); if (nf) nf.onsubmit = guard(async e => { e.preventDefault(); S.cname = $('#cName').value; if (!S.rcp.length) { S.err = 'Mindestens ein Empfänger ist nötig.'; draw(); return; } const name = S.cname.trim() || null;
    if (S.edit) { const id = S.edit; await app('Messenger', `Chat/${id}/Edit`, { method: 'PATCH', body: { id, recipients: S.rcp, name, authorsLimited: S.lim, authors: S.lim ? S.editAuthors : [] } }); S.edit = null; S.hist = []; S.route = 'chats'; await openSec('chats'); await openChat({ id }); toast('Chat gespeichert.'); }
    else await startChat(S.rcp, name, S.reuse, S.lim); });
  const l = $('#login'); if (l) l.onsubmit = login;
}

/* Themen-Farben */
const TK = ["primary", "on-primary", "primary-container", "on-primary-container", "secondary", "secondary-container", "on-secondary-container", "tertiary-container", "on-tertiary-container", "surface", "surface-low", "surface-container", "surface-high", "surface-highest", "on-surface", "on-surface-variant", "outline", "outline-variant", "inverse-surface", "inverse-on-surface", "error", "error-container"];
const TH = { purple: { n: 'Lila', l: ['#6750A4'], d: ['#D2BCFC'] }, green: { n: 'Grün', l: '2E6A45 FFFFFF B0F1C2 00210F 516356 D3E8D8 102016 C2E8FF 001E2C F6FBF4 F0F5EE EAF0E8 E4EAE2 DEE4DC 181D18 414941 707972 BFC9C0 2D322D EEF2EB B3261E F9DEDC'.split(' ').map(c => '#' + c), d: '96D5A9 00391C 12512E B1F1C5 B7CBBD 3A4B3F D3E8D8 1E4D54 BBEBF2 101411 181C1A 1C211E 272B28 313633 DEE4E0 BDCAC0 87948B 3E4941 DEE4E0 2D312E F2B8B5 8C1D18'.split(' ').map(c => '#' + c) }, blue: { n: 'Blau', l: '0B57D0 FFFFFF D3E3FD 041E49 5A5C7C DCE2F9 131C2B FFD8EE 2E1125 FAF9FD F3F3FA EEEDF3 E9E8EF E3E2E6 1B1B1F 44474E 74777F C4C6D0 303034 F2F0F4 B3261E F9DEDC'.split(' ').map(c => '#' + c), d: 'C0C2FD 042C71 04409F E0E0FC C3C3E9 424463 E0E0FE 6E334E FFD8E7 131317 1B1B1F 1F1F23 2A2A2E 343439 E2E2E8 C6C5D2 90909C 464651 E2E2E8 303034 F2B8B5 8C1D18'.split(' ').map(c => '#' + c) }, red: { n: 'Rot', l: '984061 FFFFFF FFD9E2 3E001D 74575F F6DDE4 31101D FFDBCA 2C1600 FFF8F8 FCF0F2 F6EBED F3E5E9 EEE0E3 201A1B 524346 847377 D5C2C6 352F30 FAEEEF B3261E F9DEDC'.split(' ').map(c => '#' + c), d: 'FEB1C9 620833 7D2649 FED9E4 DFBEC7 5B3F48 FCDAE3 5E402C FFDBC6 181213 201A1C 241E20 2E282A 393335 E8E1E3 D4C2C7 9D8D91 514347 E8E1E3 352F30 F2B8B5 8C1D18'.split(' ').map(c => '#' + c) }, orange: { n: 'Orange', l: '8B5000 FFFFFF FFDCC2 2C1600 725A44 F6DFC8 271905 D5EDC0 0E2004 FFF8F5 FCF1EA F7ECE4 F3E6DE EDE0D8 211A14 51443B 83746A D6C3B6 362F28 FBEEE5 B3261E F9DEDC'.split(' ').map(c => '#' + c), d: 'FDB976 472A07 683C05 FDDDC1 DEC1A8 59422E FBDDC4 384D25 D2EABA 17130F 1F1B18 231F1C 2D2926 383431 E7E1DD D1C4BA 9A8F85 4F453D E7E1DD 34302C F2B8B5 8C1D18'.split(' ').map(c => '#' + c) } };
const themeGet = () => { try { return localStorage.getItem('msd-theme') || 'purple'; } catch (e) { return 'purple'; } };
function applyTheme(k) {
  if (!TH[k]) k = 'purple'; const r = document.documentElement; if (k === 'purple') delete r.dataset.theme; else r.dataset.theme = k;
  const m = document.querySelectorAll('meta[name=theme-color]'), v = TH[k]; if (m[0]) m[0].content = v.l[9] || '#FEF7FF'; if (m[1]) m[1].content = v.d[9] || '#141317';
}
{ const f = a => a.map((c, i) => `--${TK[i]}:${c}`).join(';'); const st = document.createElement('style'); st.textContent = Object.entries(TH).filter(([, v]) => v.l.length > 1).map(([k, v]) => `:root[data-theme=${k}]{${f(v.l)}}@media(prefers-color-scheme:dark){:root[data-theme=${k}]{${f(v.d)}}}`).join(''); document.head.append(st); applyTheme(themeGet()); }
const themeCard = () => { const cur = themeGet(); return `<div class="card" style="background:var(--surface-container)"><h3>Themen-Farbe</h3><p>Gilt für Hell und Dunkel (folgt der Systemeinstellung).</p><div class="swatches">${Object.entries(TH).map(([k, v]) => `<button class="swc ${k === cur ? 'on' : ''}" data-a="theme" data-v="${k}" aria-pressed="${k === cur}"><span class="dot" style="--l:${v.l[0]};--d:${v.d[0]}">${k === cur ? ic('check') : ''}</span>${v.n}</button>`).join('')}</div></div>`; };
/* Debug, Dialoge, Chat-Info */
Object.assign(S, { debug: (() => { try { return localStorage.getItem('msd-debug') === '1'; } catch (e) { return false; } })(), log: [], dtab: 'ctx', taps: 0, cinfo: null, cinfoFor: null });
const pj = (o, max = 40000) => { let s; if (typeof o === 'string') s = o; else { try { s = JSON.stringify(o, (k, v) => k[0] === '_' ? undefined : v, 2); } catch (e) { s = String(o); } } s = s ?? ''; return s.length > max ? s.slice(0, max) + `\n… (${s.length - max} Zeichen gekürzt)` : s; };
function logApi(m, url, st, req, res) { const red = /CreateToken|OneTimeToken|Token\/Refresh/i.test(url); let rq = req; if (typeof req === 'string') { try { rq = JSON.parse(req); } catch (e) { } } else if (req instanceof FormData) rq = '‹FormData›';
  S.log.push({ t: Date.now(), m, url: url.replace(S.base, ''), s: st, req: red ? '‹ausgeblendet›' : rq, res: red ? '‹ausgeblendet›' : res }); if (S.log.length > 80) S.log.shift(); if (S.debug) renderDbg(); }
function openDlg(html, cls = '') { const dg = document.createElement('dialog'); dg.className = 'dlg ' + cls; dg.innerHTML = html; document.body.append(dg);
  dg.onclick = e => { if (e.target === dg || e.target.closest('[data-close]')) dg.close(); const cp = e.target.closest('[data-copy]'); if (cp) navigator.clipboard.writeText(dg.querySelector(cp.dataset.copy).textContent).then(() => toast('Kopiert.')); };
  dg.onclose = () => dg.remove(); dg.showModal(); return dg; }
const showJson = (ti, o) => openDlg(`<h2>${esc(ti)}</h2><pre class="raw" id="rawj">${esc(pj(o))}</pre><div class="grp" style="justify-content:flex-end"><button class="btn t" data-copy="#rawj">Kopieren</button><button class="btn x" data-close>Schließen</button></div>`, 'wide');
const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${esc(v ?? '–')}</b></div>`;
function ctxRows() { const c = S.chat, who = new Map(); S.msgs.forEach(m => { if (m.creatorUserId) who.set(m.creatorUserId, m.creatorUserDisplayName || ''); });
  const rows = [['Server', S.base], ['Schule (Tag)', S.school], ['Eigene User-ID', S.profile?.userId || S.profile?.UserId], ['Anzeigename', S.profile?.displayName || S.profile?.DisplayName], ['Bereich', S.route], ['Gewählter Eintrag (ID)', S.list[S.sel]?.id], ['Chat-ID', c?.id], ['Chat-Ersteller-ID', c?.creatorUserId], ['Kategorie-ID', c?.categoryId], ['Geladene Nachrichten', c ? S.msgs.length : null], ['Bekannte Kontakte', S.known.size], ['API-Log-Einträge', S.log.length]];
  who.forEach((n, id) => rows.push(['Autor im Chat', `${id}  ${n}`])); if (S.cinfo && S.cinfoFor === c?.id) infoMembers(S.cinfo).forEach(x => rows.push(['Empfänger', `${x.key}  ${x.text}`])); return rows; }
const logHtml = () => S.log.slice().reverse().map(e => `<details data-i="${e.t}${e.url}"><summary><span class="st ${!e.s || e.s >= 400 ? 'bad' : ''}">${e.s || 'ERR'}</span> ${e.m} ${esc(e.url)}</summary>${e.req != null && e.req !== '' ? `<div class="lb">Anfrage</div><pre class="raw">${esc(pj(e.req, 8000))}</pre>` : ''}<div class="lb">Antwort</div><pre class="raw">${esc(pj(e.res, 20000))}</pre></details>`).join('') || '<div class="empty">Noch keine Anfragen.</div>';
let dbgDlg;
function renderDbg() { if (!dbgDlg || !dbgDlg.isConnected) return; const open = new Set([...dbgDlg.querySelectorAll('details[open]')].map(d => d.dataset.i)), b = dbgDlg.querySelector('#dbgBody'), sc = b.scrollTop; b.innerHTML = S.dtab === 'log' ? logHtml() : ctxRows().map(([k, v]) => kv(k, v)).join(''); b.querySelectorAll('details').forEach(d => { if (open.has(d.dataset.i)) d.open = true; }); b.scrollTop = sc; dbgDlg.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.v === S.dtab)); const n = dbgDlg.querySelector('[data-v=log]'); if (n) n.textContent = `API-Log (${S.log.length})`; }
function openDbg() { dbgDlg = openDlg(`<h2>Debug</h2><div class="tabs"><button class="tab" data-a="dtab" data-v="ctx">Kontext</button><button class="tab" data-a="dtab" data-v="log">API-Log</button></div><div id="dbgBody" class="dbgbody"></div><div class="grp" style="justify-content:flex-end;flex-wrap:wrap;margin-top:12px"><button class="btn t" data-a="dbgcopy" style="height:40px">Kopieren</button><button class="btn t" data-a="dbgclear" style="height:40px">Log leeren</button><button class="btn o" data-a="dbgoff" style="height:40px">Debug beenden</button><button class="btn x" data-close style="height:40px">Schließen</button></div>`, 'wide'); renderDbg(); }
function syncDbg() { let f = $('#dbgfab'); if (!f) { f = document.createElement('button'); f.id = 'dbgfab'; f.className = 'fab'; f.dataset.a = 'dbgopen'; f.setAttribute('aria-label', 'Debug'); f.innerHTML = ic('bug_report'); document.body.append(f); } f.classList.toggle('hidden', !S.debug); }
function dbgSet(v) { S.debug = v; try { localStorage.setItem('msd-debug', v ? '1' : '0'); } catch (e) { } syncDbg(); if (!v && dbgDlg?.isConnected) dbgDlg.close(); toast(v ? 'Debug-Modus aktiviert' : 'Debug-Modus deaktiviert'); if (S.route === 'profil') draw(); else if ($('#detail')) { drawDetail(); drawList(); } else if (S.route === 'infopoint') draw(); }
const dbgCard = () => `<div class="card" style="background:var(--tertiary-container);color:var(--on-tertiary-container)"><h3>Debug-Modus aktiv</h3><p style="color:inherit">Rohdaten, IDs und API-Log sind sichtbar. Zum Beenden hier deaktivieren oder erneut 7× auf den Namen tippen.</p><div class="grp" style="margin-top:12px;flex-wrap:wrap"><button class="btn t" style="height:40px" data-a="dbgopen">Debug öffnen</button><button class="btn o" style="height:40px;color:inherit" data-a="dbgoff">Deaktivieren</button></div></div>`;
syncDbg();
/* Chat-Info */
const infoMembers = inf => { const a = inf?.recipients || inf?.members || inf?.participants || inf?.users || []; return a.map(x => typeof x === 'string' ? rec(x) : { key: String(x.key ?? x.id ?? x.userId ?? ''), text: x.text ?? x.displayName ?? x.name ?? '' }).filter(x => x.key); };
async function chatInfo() {
  const c = S.chat, dg = openDlg(`<h2>${esc(title(c))}</h2>${loadingH()}`);
  try {
    const inf = await app('Messenger', `Chat/${c.id}/Info`); S.cinfo = inf; S.cinfoFor = c.id; const mem = infoMembers(inf); mem.forEach(x => addKnown(x.key, x.text)); await resolveNames(); const nm = x => x.text || S.known.get(x.key) || x.key, k = catOf(c), au = inf?.authors || [];
    const row = (a, b) => b ? `<div class="kv"><span>${a}</span><b>${esc(b)}</b></div>` : '';
    dg.innerHTML = `<h2>${esc(title(c))}</h2>${tagH(k)}<div style="margin:12px 0">${row('Besitzer', c.isOwner ? 'Du' : c.creatorUserDisplayName || inf?.creatorUserDisplayName)}${row('Erstellt', fmt(c.created || inf?.created))}${row('Schreibrechte', (c.authorsLimited ?? inf?.authorsLimited) ? 'Nur Chat-Ersteller / Autoren' : 'Alle Teilnehmer')}${row('Status', [c.isPinned && 'angeheftet', c.isSilent && 'stumm'].filter(Boolean).join(', '))}</div>
<div class="gh" style="padding-left:0">Teilnehmer (${mem.length})</div><div class="list" style="max-height:40dvh;flex:none">${mem.map(x => `<div class="li">${S.av && /^U:USER:/i.test(x.key) ? avatar(x.key.slice(7), nm(x), 40) : `<span class="ic">${ic(/^(U|P):/.test(x.key) ? 'person' : 'groups')}</span>`}<span class="tx"><div class="h">${esc(nm(x))}</div><div class="s">${S.debug ? esc(x.key) : /^U:|^P:/.test(x.key) ? 'Person' : 'Gruppe / Rolle'}</div></span></div>`).join('') || '<div class="empty">Keine Teilnehmer geliefert.</div>'}</div>
${au.length ? `<div class="gh" style="padding-left:0">Autoren (${au.length})</div><div class="list" style="max-height:25dvh;flex:none">${au.map(a => { const x = typeof a === 'string' ? rec(a) : { key: String(a.key ?? a.id), text: a.text ?? a.displayName }; return `<div class="li"><span class="ic">${ic('edit')}</span><span class="tx"><div class="h">${esc(nm(x))}</div></span></div>`; }).join('')}</div>` : ''}
${S.debug ? `<details><summary>Rohdaten (Debug)</summary><pre class="raw">${esc(pj({ chat: c, info: inf }))}</pre></details>` : ''}<div class="grp" style="justify-content:flex-end;margin-top:12px"><button class="btn x" data-close>Schließen</button></div>`;
  } catch (e) { dg.innerHTML = `<h2>${esc(title(c))}</h2><p>Info konnte nicht geladen werden: ${esc(e.message)}</p><div class="grp" style="justify-content:flex-end"><button class="btn x" data-close>Schließen</button></div>`; }
}
/* Profilbilder (GET /Account/Image/{userId}, nicht schulbezogen) */
S.av = (() => { try { return localStorage.getItem('msd-avatars') !== '0'; } catch (e) { return true; } })();
const avCache = new Map(), meUid = () => String(S.profile?.userId || S.profile?.UserId || ''), ini = n => String(n || '?').split(/[\s,]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || '?';
const avUrl = id => { if (!avCache.has(id)) avCache.set(id, (async () => { for (const w of [96, 48]) { try { const b = await http(`${S.base}/Account/Image/${encodeURIComponent(id)}?w=${w}`, { blob: true }); if (/svg/i.test(b.type) || /<svg|<\?xml/i.test(await b.slice(0, 200).text())) return null; return URL.createObjectURL(b); } catch (e) { if (/^40[134]/.test(e.message)) return null; } } return null; })()); return avCache.get(id); };
const avatar = (id, name, size = 40, icon = '') => S.av ? `<span class="av c${icon ? 0 : [...String(id || name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 3}" ${id ? `data-av="${esc(id)}"` : ''} style="--s:${size}px" title="${esc(name || '')}">${icon ? ic(icon) : esc(ini(name))}</span>` : '';
const meBtn = () => S.av && meUid() ? `<button class="ib avb" data-a="go" data-v="profil" aria-label="Profil">${avatar(meUid(), S.profile?.displayName || S.profile?.DisplayName, 36)}</button>` : `<button class="ib" data-a="go" data-v="profil" aria-label="Profil">${ic('account_circle')}</button>`;
const avCard = () => `<div class="card" style="background:var(--surface-container)">${sw('av', 'Profilbilder anzeigen', S.av)}<p>Lädt die Bilder vom Schulserver. Ausgeschaltet werden keine Profilbilder abgerufen.</p></div>`;
function hydrateAv() { if (!S.av) return; document.querySelectorAll('.av[data-av]:not([data-done])').forEach(el => { el.dataset.done = 1; avUrl(el.dataset.av).then(u => { if (u && el.isConnected) el.innerHTML = `<img src="${u}" alt="" loading="lazy">`; }); }); }
let avT; new MutationObserver(() => { cancelAnimationFrame(avT); avT = requestAnimationFrame(hydrateAv); }).observe(document.body, { childList: true, subtree: true });
/* Mobile Navigation: passend zur Bildschirmbreite, Rest unter „Mehr“ */
S.navfit = (() => { try { return localStorage.getItem('msd-navfit') !== '0'; } catch (e) { return true; } })();
const NAVPRIO = ['home', 'chats', 'kalender', 'infopoint', 'personen', 'medien', 'fundsachen'];
function navSplit() {
  if (!mob() || !S.navfit) return { direct: SECS, more: [] };
  const fit = Math.floor(document.documentElement.clientWidth / 72); if (SECS.length <= fit) return { direct: SECS, more: [] };
  const keep = new Set(NAVPRIO.slice(0, Math.max(1, fit - 1))); return { direct: SECS.filter(s => keep.has(s[0])), more: SECS.filter(s => !keep.has(s[0])) };
}
const destBtn = ([k, n, i]) => `<button class="dest ${S.route === k ? 'on' : ''}" data-a="go" data-v="${k}"><span class="pill">${ic(i)}<span class="lbl">${n}</span></span><span>${n}</span></button>`;
function railDests() { const { direct, more } = navSplit(); const h = direct.map(destBtn).join('') + (more.length ? `<button class="dest ${more.some(s => s[0] === S.route) ? 'on' : ''}" data-a="more" aria-haspopup="dialog"><span class="pill">${ic('more_horiz')}<span class="lbl">Mehr</span></span><span>Mehr</span></button>` : ''); S.railHtml = h; return h; }
function openMore() { const { more } = navSplit(); if (!more.length) return; openDlg(`<div class="grab"></div><div class="list" style="flex:none">${more.map(([k, n, i]) => `<button class="li ${S.route === k ? 'on' : ''}" data-a="go" data-v="${k}" data-close><span class="ic">${ic(i)}</span><span class="tx"><div class="h">${n}</div></span></button>`).join('')}</div>`, 'sheet'); }
let rsT; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { const r = document.querySelector('.rail'); if (!r || !mob()) return; const old = S.railHtml, h = railDests(); if (h === old) return; r.querySelectorAll('.dest').forEach(x => x.remove()); r.insertAdjacentHTML('beforeend', h); }, 120); });
const navCard = () => `<div class="card" style="background:var(--surface-container)">${sw('navfit', 'Menüleiste an Bildschirmgröße anpassen', S.navfit)}<p>Nur auf Smartphones: Die untere Leiste zeigt so viele Einträge, wie auf den Bildschirm passen (bevorzugt Home, Chats, Kalender, InfoPoint). Der Rest steht unter „Mehr“. Ausgeschaltet zeigt die Leiste alle Einträge und lässt sich scrollen.</p></div>`;
/* Links in Texten antippbar machen (nur http/https) */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
function rich(text, mark = true) {
  text = String(text ?? ''); const h = mark ? hl : esc; let out = '', last = 0, m; URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    let u = m[0], tail = ''; const mt = /[.,;:!?)\]}'"»”]+$/.exec(u); if (mt) { u = u.slice(0, -mt[0].length); tail = mt[0]; }
    out += h(text.slice(last, m.index)); const href = /^www\./i.test(u) ? 'https://' + u : u; let ok = false; try { ok = /^https?:$/.test(new URL(href).protocol); } catch (e) { }
    out += (ok ? `<a class="lnk" href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">${h(u)}</a>` : h(u)) + h(tail); last = m.index + m[0].length;
  }
  return out + h(text.slice(last));
}
/* ---------- Login ---------- */
const appId = () => sessionStorage.getItem('msd-appid') || (id => (sessionStorage.setItem('msd-appid', id), id))(`MSDAPP:${crypto.randomUUID()}`);
async function login(ev) {
  ev.preventDefault(); const btn = $('#lGo'); S.err = ''; btn.disabled = true; btn.innerHTML = `${lod(28)}Anmelden …`;
  try {
    if (!S.pending) {
      const base = $('#lBase').value.trim().replace(/\/$/, ''), u = $('#lUser').value.trim(), pw = $('#lPass').value; if (!/^https?:\/\//.test(base) || !u || !pw) throw new Error('Server, Benutzername und Passwort sind erforderlich.');
      const r = await http(`${base}/Api/v1.0/Token/CreateToken`, { method: 'POST', body: { userName: u, password: pw, twoFactorCode: $('#lTfa').value.trim() || null, appId: appId() } }), token = r?.token || r?.Token; if (!token) throw new Error('Kein Zugriffstoken erhalten.');
      Object.assign(S, { base, token }); S.profile = await http(`${base}/Api/v1.0/App/App/Profile`); const L = S.profile.schools || S.profile.Schools || []; if (!L.length) throw new Error('Keine Schule im Profil gefunden.');
      if (L.length > 1) { S.pending = L; draw(); $('#lUser').value = u; return; } S.school = L[0].tag || L[0].Tag;
    } else S.school = $('#lSchool').value;
    S.pending = null; await connect(true);
  } catch (e) { S.err = (e.data?.twoFactorNeeded || e.data?.TwoFactorNeeded) ? 'Bitte 2FA-Code eingeben und erneut anmelden.' : e.message; const u = $('#lUser')?.value, b = $('#lBase')?.value; draw(); if (b) $('#lBase').value = b; if (u) $('#lUser').value = u; }
}
async function connect(fresh) {
  S.drawn = null; $('#app').innerHTML = `<div class="splash">${lod(64)}</div>`;
  sessionStorage.setItem(KEY, JSON.stringify({ base: S.base, school: S.school, token: S.token }));
  try { [S.cats, S.info] = await Promise.all([app('Messenger', 'Categories').catch(() => []), app('School', 'Index')]); harvest(); if (!S.profile) S.profile = await http(`${S.base}/Api/v1.0/App/App/Profile`); S.hist = []; nav('chats'); }
  catch (e) { sessionStorage.removeItem(KEY); S.token = ''; S.err = 'Verbindung fehlgeschlagen: ' + e.message; S.route = 'login'; draw(); }
}
const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved?.token) { Object.assign(S, saved); connect(); } else draw();
