/* Izwi browser app. It asks the server for "state" (everything this person may see), draws it,
   and sends each tap back to the server. The server decides what is allowed. */
(() => {
const C = window.IZWI, T = C.T;
const app = document.getElementById('app'), toastEl = document.getElementById('toast');
let S = { role: null };                        // server state
const U = {                                     // what is open on this device right now
  screen: location.hash === '#guardian' ? 'glogin' : 'welcome', tab: 'home', info: null, causeId: null, causeTab: 'about', newCause: false,
  fmt: '', aud: { family: true, class: true }, vf: '', vc: '', wrong: {}, topic: '', ri: 0, ready: {}, skills: [], f: {},
  avatar: C.AVATARS[0], color: C.COLORS[0], route: 'school', gstep: 0, devCode: '', unlock: false, modTab: 'queue', rec: null, recording: false
};
const SPACE = { home: ['🏠', 'Home'], learn: ['📚', 'Learn'], create: ['🎨', 'Create'], verse: ['🌍', 'Toto Verse'], community: ['🤝', 'Community'] };
const RULE_E = ['🛡️', '😊', '✅', '🙌'], TOPIC_E = { social: '📱', bully: '🚫', wrong: '🔎', exploit: '⚠️', unsafe: '🆘' }, VALUE_E = ['🤲', '👀', '💛'];
const FEAT_E = ['📚', '🎨', '🌍', '🤝', '📣', '💜', '🏅', '🛟'], REACT_E = ['✨', '💡', '👏'], ROUTE_E = { school: '🏫', community: '🏘️', own: '🙋' };
const KIND = { work: 'Upload', post: 'Discussion post', gpost: 'Group message', memo: 'Memorandum', message: 'Campaign message', cause: 'New cause', feedback: 'Written feedback', update: 'Cause update', doc: 'Shared document', report: 'Member report', talk: 'Asked to talk' };

/* ---------- small helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const e = x => `<span class="e" aria-hidden="true">${x}</span>`;
const av = (p, cls = '') => `<span class="av ${cls}" style="background:${esc(p.color || '#FFD166')}" aria-hidden="true">${esc(p.avatar || '🙂')}</span>`;
const val = id => (document.getElementById(id)?.value || '').trim();
const bind = k => `data-bind="${k}" value="${esc(U.f[k] || '')}"`;
const area = (k, attrs = '') => `<textarea data-bind="${k}" ${attrs}>${esc(U.f[k] || '')}</textarea>`;
const clearF = prefix => { for (const k of Object.keys(U.f)) if (k.startsWith(prefix)) delete U.f[k]; };
const bandName = b => (b === 'o' ? '16 to 18' : '13 to 15');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
let tt;
function toast(t, bad) { toastEl.textContent = t; toastEl.className = 'toast' + (bad ? ' bad' : ''); toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => (toastEl.hidden = true), 3200); }
async function api(path, body, form) {
  let r, j;
  try {
    r = await fetch('/api' + path, { method: body || form ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'x-izwi': '1', ...(form || !body ? {} : { 'content-type': 'application/json' }) }, body: form || (body ? JSON.stringify(body) : undefined) });
    j = await r.json();
  } catch { toast('No connection. Check your internet and try again.', true); return null; }
  if (!r.ok) { toast(j.error || 'Something went wrong.', true); return null; }
  return j;
}
async function refresh() { const s = await api('/state'); if (s) S = s; render(); }
// Send something to the server. On success, reload state and show a message.
async function send(path, body, msg, form) { const r = await api(path, body || {}, form); if (!r) return 'keep'; if (msg) toast(msg); await refresh(); return r; }
const statusPill = (s, c) => { const label = s === 'cosign' ? C.STATUS[c === 'guardian' ? 'guardian' : 'leader'] : C.STATUS[s]; return `<span class="pill ${s === 'approved' ? 'ok' : s === 'returned' || s === 'escalated' ? 'bad' : 'wait'}">${s === 'approved' ? '✓ ' : ''}${label}</span>`; };
const adult = () => S.group?.adult || 'guardian';
const sec = (emoji, t, b) => `<section class="card row" style="align-items:flex-start">${e(`<span class="big-e">${emoji}</span>`)}<div class="grow"><h3>${t}</h3><p>${b}</p></div></section>`;
const media = (id, w) => !w.hasFile ? '' : /^audio\//.test(w.mime) ? `<audio controls preload="none" src="/api/files/${id}"></audio>` : /^video\//.test(w.mime) ? `<video controls preload="none" src="/api/files/${id}"></video>` : /^image\//.test(w.mime) ? '' : `<a href="/api/files/${id}" target="_blank" rel="noopener">Open ${esc(w.fileName || 'the file')}</a>`;
const cover = (w) => `<div class="cover">${w.hasFile && /^image\//.test(w.mime) ? `<img loading="lazy" alt="" src="/api/files/${w.id}">` : e(C.EMOJI[w.fmt] || '⭐')}</div>`;

/* ---------- pages that explain things. Used when joining and from Help ---------- */
function rulesHtml(band) { const o = band === 'o'; return C.RULES[band].map((r, i) => `<div class="rule">${e(`<span class="big-e">${RULE_E[i]}</span>`)}<div><b>${r[0]}</b><p>${r[1]}</p><p class="small"><strong>${o ? 'Why' : 'Try it'}:</strong> ${r[2]}</p></div></div>`).join('') + `<div class="note">${e('🔁')} <b>If a rule is broken.</b> A moderator sends the work back with a reason. You can fix it and send it again. Serious or repeated harm is passed to a trusted adult.</div>`; }
const featsHtml = () => C.FEATS.map((f, i) => sec(FEAT_E[i], f[1], f[2])).join('');
const workHtml = () => C.WORKINFO.map((w, i) => sec(['👀', '🎯', '🔑', '🪪', '🧑‍🏫', '👋'][i], w[0], w[1])).join('') + '<p class="small muted">Wording to be confirmed with legal before launch.</p>';
const causeHowHtml = () => C.CAUSEHOW.map((c, i) => sec(['🌱', '🧭', '💬', '📝', '📣', '🏁'][i], `${i + 1}. ${c[0]}`, c[1])).join('') + `<div class="note">${e('🛡️')} <b>Staying safe in a cause.</b> A teacher, leader or moderator is always present. You never have to share your own story. At 13 to 15, your ${adult()} co-signs a new cause.</div>`;
function safetyHtml() {
  const rd = S.me?.readiness || {}, read = S.me?.safetyRead || {}, flag = k => C.READY.some((q, i) => q[1] === k && rd[i] === 0);
  return `<section class="card stack tight"><div class="row"><h3 class="grow">${e('🧭')} Online safety</h3><span class="pill plain">5 short parts</span></div><p>Online safety means knowing the dangers you can meet on the internet and what to do about them.</p>
   ${C.TOPICS.map(t => `<button class="choice ${U.topic === t[0] ? 'sel' : ''}" data-act="topic" data-k="${t[0]}" aria-expanded="${U.topic === t[0]}">${e(TOPIC_E[t[0]])}<span class="grow"><span class="row"><b class="grow">${t[1]}</b>${read[t[0]] ? '<span class="pill ok">✓ Read</span>' : flag(t[0]) ? '<span class="pill gold">Start here</span>' : ''}</span>${U.topic === t[0] ? `<span>${t[2]}</span>` : ''}</span></button>`).join('')}</section>
  <section class="card stack tight"><h3>${e('💜')} Our values</h3>${C.VALUES.map((v, i) => `<p>${e(VALUE_E[i])} <b>${v[0]}.</b> ${v[1]}</p>`).join('')}</section>
  <section class="card stack tight"><h3>${e('🤝')} How children and adults work together here</h3>${C.PRINC.map((p, i) => `<p>${i + 1}. ${p}</p>`).join('')}</section>`;
}
function helpHtml() {
  const m = S.role === 'member';
  return `<section class="card stack"><h3>${e('🫶')} Talk now</h3><p>You do not have to face it alone. Choose who to talk to.</p>
   <div class="grid2"><div class="note">${e('🧑‍🤝‍🧑')} <b>A friend.</b> Tell someone your own age what happened.</div>
   <div class="note stack tight"><div>${e('🧑‍🏫')} <b>A ${m ? adult() : 'trusted adult'}.</b> Ask them to talk to you. They see only that you asked, not why.</div>${m ? `<div><button class="btn sm" data-act="askadult">Ask my ${adult()} to talk to me</button></div>` : ''}</div>
   <div class="note gold">${e('📞')} <b>A professional.</b> Child Helpline <b>116</b> is free to call in Kenya, day and night.</div></div></section>
  ${m ? `<section class="card stack"><h3>${e('🚩')} Report something</h3><label class="field"><span>What happened? A moderator reads every report.</span>${area('rep-body', 'maxlength="600"')}</label><div><button class="btn" data-act="report">Send report</button></div></section>` : ''}
  <section class="card stack tight"><h3>${e('📖')} Read again</h3><div class="row">${[['rules', 'The four rules'], ['features', 'How Toto Space works'], ['work', 'Your work and your information'], ['causehow', 'How a cause works'], ['safety', 'Safety lessons and values']].map(x => `<button class="btn ghost sm" data-act="info" data-k="${x[0]}">${x[1]}</button>`).join('')}</div></section>`;
}
const INFO = { help: ['Help', helpHtml], rules: ['The four rules, and what they mean', () => `<div class="stack">${rulesHtml(S.me?.band || 'y')}</div>`], features: ['How Toto Space works', featsHtml], work: ['Your work and your information', workHtml], causehow: ['How a cause works', causeHowHtml], safety: ['Safety lessons and values', safetyHtml] };
const infoPage = () => `<div><button class="linkbtn" data-act="info" data-k="${U.info === 'help' ? '' : 'help'}">← ${U.info === 'help' ? 'Back' : 'Back to Help'}</button><h2>${INFO[U.info][0]}</h2></div>${INFO[U.info][1]()}`;
const helpBtn = () => `<button class="btn gold sm" data-act="info" data-k="help">${e('🛟')} Help 116</button>`;
const topBar = extra => `<header class="top"><div class="wrap"><div class="logo">izwi <small>Our Voices</small></div>${extra || ''}${helpBtn()}</div></header>`;

/* ---------- before sign-in ---------- */
function outside() {
  const s = U.screen; let h = '';
  if (s === 'welcome') h = `<div class="hero"><span class="float">${e('📣')}</span><span class="bubble">Our Voices</span><h1>izwi</h1>
    <p>Learn creative skills. Share what you make. Work with others on the things you care about. All in a safe space made for you.</p>
    <div class="row"><button class="btn gold" data-act="screen" data-s="who">Let’s go ${e('🚀')}</button></div></div>
    <div class="grid2">${[['📚', 'Learn', 'Podcasting, video, AI and more', 'learn'], ['🎨', 'Create', 'Make it and share it safely', 'create'], ['🌍', 'Toto Verse', 'See what others made', 'verse'], ['🤝', 'Community', 'Start or join a cause', 'community']].map(x => `<div class="tile ${x[3]}">${e(x[0])}<b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div>`;
  if (s === 'who') h = `<h2>Who is here? ${e('👋')}</h2>
    <button class="choice" data-act="screen" data-s="child">${e('🧒')}<span><b>I am a child or teen</b>Ages 13 to 18 for now</span></button>
    <button class="choice" data-act="screen" data-s="adult">${e('🧑')}<span><b>I am an adult</b>Parent or guardian, teacher, group leader or moderator</span></button>
    <div><button class="linkbtn" data-act="screen" data-s="welcome">← Back</button></div>`;
  if (s === 'child') h = `<h2>Welcome! ${e('🎉')}</h2>
    <button class="choice" data-act="screen" data-s="join">${e('✨')}<span><b>I am new</b>Join Izwi</span></button>
    <button class="choice" data-act="screen" data-s="login">${e('🔑')}<span><b>I have an account</b>Sign in with my nickname and secret word</span></button>
    <div><button class="linkbtn" data-act="screen" data-s="who">← Back</button></div>`;
  if (s === 'adult') h = `<h2>Which adult are you?</h2><p class="muted">Adults do not join the children’s spaces. Each has a page of their own.</p>
    <button class="choice" data-act="screen" data-s="glogin">${e('👪')}<span><b>Parent or guardian</b>Sign in with your phone number</span></button>
    <button class="choice" data-act="screen" data-s="staff">${e('🧑‍🏫')}<span><b>Teacher, group leader or moderator</b>Sign in with your email</span></button>
    <div><button class="linkbtn" data-act="screen" data-s="who">← Back</button></div>`;
  if (s === 'login' || s === 'staff') h = `<h2>${s === 'staff' ? 'Sign in' : `Welcome back ${e('👋')}`}</h2>
    <label class="field"><span>${s === 'staff' ? 'Email' : 'Nickname'}</span><input ${bind('li-user')} autocomplete="username" ${s === 'staff' ? 'type="email"' : ''}></label>
    <label class="field"><span>${s === 'staff' ? 'Password' : 'Secret word'}</span><input id="li-secret" type="password" autocomplete="current-password"></label>
    <div class="row"><button class="btn" data-act="login">Sign in</button><button class="linkbtn" data-act="screen" data-s="${s === 'staff' ? 'adult' : 'child'}">← Back</button></div>
    ${s === 'login' ? `<p class="small muted">Forgot your secret word? Ask your teacher, leader or guardian to contact Izwi.</p>` : ''}`;
  if (s === 'glogin') h = `<h2>Parent or guardian ${e('👪')}</h2><p class="muted">Use the phone number your child gave us. We send a code to that phone.</p>
    <label class="field"><span>Your phone number</span><input ${bind('g-phone')} inputmode="tel" placeholder="07XX XXX XXX" autocomplete="tel"></label>
    ${U.gstep ? `<label class="field"><span>The 6-digit code we sent</span><input id="g-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></label>${U.devCode ? `<div class="note gold">Test mode: your code is <b>${U.devCode}</b>. On the live site this arrives by SMS.</div>` : ''}
    <div class="row"><button class="btn" data-act="gverify">Sign in</button><button class="linkbtn" data-act="gstart">Send a new code</button></div>` : `<div class="row"><button class="btn" data-act="gstart">Send me a code</button><button class="linkbtn" data-act="screen" data-s="adult">← Back</button></div>`}`;
  if (s === 'join') h = joinForm();
  return topBar() + `<main class="wrap"><div class="narrow stack">${U.info ? infoPage() : h}</div></main>`;
}
function joinForm() {
  const y = new Date().getFullYear();
  return `<h2>Join Izwi ${e('✨')}</h2>
   <div class="label">1. How are you joining?</div>
   ${Object.entries(C.ROUTES).map(([k, r]) => `<button class="choice" data-act="route" data-k="${k}" aria-pressed="${U.route === k}">${e(ROUTE_E[k])}<span><b>${r[0]}</b>${r[1]}</span></button>`).join('')}
   ${U.route === 'own' ? `<div class="note">On this route there is no teacher or leader, so your guardian and Izwi moderators check more.</div>` : `<label class="field"><span>${U.route === 'school' ? 'School' : 'Group'} code from your ${C.ROUTES[U.route][2]}</span><input ${bind('j-code')} maxlength="12" autocomplete="off" placeholder="ABC-1234"></label>`}
   <div class="label">2. About you</div>
   <div class="grid2"><label class="field"><span>Nickname (not your real name)</span><input ${bind('j-name')} maxlength="20" autocomplete="off"></label>
   <label class="field"><span>Secret word (6 letters or more). Keep it to yourself</span><input ${bind('j-secret')} type="password" maxlength="60" autocomplete="new-password"></label>
   <label class="field"><span>Year you were born</span><select data-bind="j-year">${[18, 17, 16, 15, 14, 13].map(a => `<option${String(y - a) === (U.f['j-year'] || String(y - 14)) ? ' selected' : ''}>${y - a}</option>`).join('')}</select></label>
   <label class="field"><span>Country</span><select data-bind="j-country">${C.COUNTRIES.map(c => `<option${c === (U.f['j-country'] || 'Kenya') ? ' selected' : ''}>${c}</option>`).join('')}</select></label></div>
   <div class="label">3. Pick your animal and colour</div>
   <div class="row">${C.AVATARS.map(a => `<button class="av pick" style="background:${U.color}" data-act="avatar" data-a="${a}" aria-pressed="${U.avatar === a}" aria-label="Animal ${a}">${a}</button>`).join('')}</div>
   <div class="row">${C.COLORS.map(c => `<button class="sw" style="background:${c}" data-act="color" data-c="${c}" aria-pressed="${U.color === c}" aria-label="Colour"></button>`).join('')}</div>
   <div class="note">${e('🔒')} We ask for a nickname and an animal, never your photo or your real name. Your year of birth sets your space: 13 to 15 or 16 to 18.</div>
   <div class="row"><button class="btn" data-act="signup">Join ${e('🎉')}</button><button class="linkbtn" data-act="screen" data-s="child">← Back</button></div>`;
}

/* ---------- joining steps for a new member ---------- */
const STEPS = C.STAGES.slice(0, -1);
const steps = () => `<div class="steps" aria-hidden="true">${STEPS.map((s, i) => `<i class="${i <= STEPS.indexOf(S.me.stage) ? 'done' : ''}"></i>`).join('')}</div>`;
const nextBtn = (to, label) => `<div class="row"><button class="btn" data-act="stage" data-to="${to}">${label}</button></div>`;
function onboarding() {
  const m = S.me, s = m.stage, o = m.band === 'o'; let h = '';
  if (U.unlock) h = `<div class="hero"><div class="party" aria-hidden="true"><span>🎉</span><span>⭐</span><span>🎈</span><span>✨</span><span>🎊</span></div><span class="bubble">Well done, ${esc(m.nickname)}!</span><h1>You have unlocked Toto Space</h1>
    <p>You finished the safety lessons and agreed to the rules. Your first badge is the Safety badge ${e('🛡️')}</p><div class="row"><button class="btn gold" data-act="enter">Enter Toto Space ${e('🚀')}</button></div></div>`;
  else if (s === 'consent') {
    const a = m.age >= 18;
    h = `${steps()}<h2>${a ? 'You give your own consent' : `Ask your parent or guardian ${e('👪')}`}</h2>
    <p class="muted">${a ? 'At 18 you agree to the terms yourself.' : 'This is the message they will receive. Read it too, so you both know what you are agreeing to.'}</p>
    <div class="note stack tight"><div class="label">${a ? 'What you are agreeing to' : 'Message to your guardian'}</div>${a ? '' : '<p>Hello Parent or Guardian. Your child wants to join Izwi, a platform by Mtoto News built with safety in mind.</p>'}
     <p>${e('🎨')} <b>What ${a ? 'you' : 'your child'} will do.</b> Learn creative skills, make and share work, and join group causes.</p>
     <p>${e('🪪')} <b>What we collect.</b> A nickname, year of birth, country and group. No full name and no address.</p>
     <p>${e('👀')} <b>Who sees the work.</b> Only the people ${a ? 'you choose' : 'your child chooses'}, after a moderator has checked it.</p>
     <p>${e('🎛️')} <b>Control.</b> ${a ? 'You can delete your account and everything in it at any time.' : 'You see what they make. You can limit sharing or withdraw consent at any time.'}</p></div>
    ${a ? (m.consent === 'yes' ? '' : `<div class="row"><button class="btn" data-act="selfconsent">I consent</button></div>`) : `
    <label class="field"><span>Parent or guardian phone number</span><input ${bind('c-phone')} inputmode="tel" placeholder="07XX XXX XXX" autocomplete="off"></label>
    <div class="row"><button class="btn" data-act="consentsend">${m.consent === 'none' ? 'Send request by SMS' : 'Send it again'}</button>${m.consent === 'none' ? '' : `<span class="pill ${m.consent === 'yes' ? 'ok' : 'wait'}">${m.consent === 'yes' ? '✓ Your guardian said yes' : 'Waiting for your guardian'}</span>`}</div>
    <div class="note"><b>${o ? '16 and 17.' : '13 to 15.'}</b> ${o ? 'You accept the terms yourself, and your guardian confirms.' : 'You cannot post until your guardian says yes.'} Your guardian signs in with a code sent to their phone. You can do the safety lessons while you wait.</div>
    ${S.dev && m.consent === 'sent' ? `<div class="note gold">Test mode: open this site in a private window, choose adult, then parent or guardian, and sign in with the same phone number.</div>` : ''}`}
    ${m.consent === 'none' ? '' : nextBtn('ready', 'Continue to the readiness check')}`;
  } else if (s === 'ready') {
    const q = C.READY[U.ri], p = U.ready[U.ri];
    h = `${steps()}<div class="label">Readiness check, ${U.ri + 1} of ${C.READY.length}</div><h2>${q[0]}</h2>
    ${C.RO.map((r, i) => `<button class="choice ${p === i ? 'sel' : ''}" data-act="ready" data-i="${i}">${e(['🙅', '🤔', '💪'][i])}<b>${r}</b></button>`).join('')}
    <p class="small muted">There are no wrong answers. Your answers choose your first safety lessons.</p>
    <div class="row">${U.ri ? '<button class="btn ghost" data-act="rprev">Back</button>' : ''}<button class="btn" data-act="rnext" ${p === undefined ? 'disabled' : ''}>${U.ri < C.READY.length - 1 ? 'Next' : 'See my safety lessons'}</button></div>`;
  } else if (s === 'safety') h = `${steps()}<h2>Before you enter ${e('🧭')}</h2><p class="muted">Short lessons first. Tap a part to read it. Your readiness answers mark where to start.</p>${safetyHtml()}${nextBtn('rules', 'Continue to the rules')}`;
  else if (s === 'rules') h = `${steps()}<h2>${o ? 'The community agreement' : 'The four rules, and what they mean'}</h2><p class="muted">Every member agrees to these. You can read them again from Help on any screen.</p>${rulesHtml(m.band)}${nextBtn('features', o ? 'I accept the agreement' : 'I understand and I agree')}`;
  else if (s === 'features') h = `${steps()}<h2>How Toto Space works</h2><p class="muted">What each part is for, in plain words.</p>${featsHtml()}${nextBtn('work', 'Got it')}`;
  else if (s === 'work') h = `${steps()}<h2>Your work and your information</h2><p class="muted">What happens to what you make, and what we know about you.</p>${workHtml()}${nextBtn('skills', 'Got it')}`;
  else if (s === 'skills') h = `${steps()}<h2>What do you want to learn, ${esc(m.nickname)}?</h2><p class="muted">Choose at least one. Each skill has ${C.need(m.band)} short lessons. Finishing it unlocks creating in it.</p>
    <div class="grid2">${Object.entries(T).map(([k, t]) => `<button class="choice" data-act="skill" data-k="${k}" aria-pressed="${U.skills.includes(k)}">${e(C.EMOJI[k])}<span><b>${t.name}</b>${t.d}</span></button>`).join('')}</div>
    <div class="row"><button class="btn" data-act="skillsdone" ${U.skills.length ? '' : 'disabled'}>Continue</button></div>`;
  return topBar(`<span class="who">${av(m)}${esc(m.nickname)}</span><button class="linkbtn" data-act="logout">Sign out</button>`) + `<main class="wrap"><div class="narrow stack">${U.info ? infoPage() : h}</div></main>`;
}

/* ---------- member spaces ---------- */
const prog = k => (S.skills.find(s => s.track === k) || {}).progress || 0;
const need = () => C.need(S.me.band);
const done = k => prog(k) >= need();
const blocked = () => S.me.canPost ? '' : `<div class="note bad">${e('⏳')} <b>You cannot post yet.</b> ${S.me.consent !== 'yes' ? 'Your guardian has not said yes.' : `Your ${adult()} has not confirmed you yet.`} You can keep learning while you wait.</div>`;
function memberShell() {
  const m = S.me;
  return `<div data-space="${U.info ? 'home' : U.tab}"><header class="top"><div class="wrap"><div class="logo">izwi <small>Our Voices</small></div><span class="who">${av(m)}${esc(m.nickname)}</span>${helpBtn()}<button class="linkbtn" data-act="logout">Sign out</button></div></header>
   ${U.info ? '' : `<nav class="tabs" aria-label="Spaces"><div class="wrap">${Object.entries(SPACE).map(([k, v]) => `<button data-act="tab" data-t="${k}" data-space="${k}" ${U.tab === k ? 'aria-current="page"' : ''}>${e(v[0])}${v[1]}</button>`).join('')}</div></nav>`}
   <main class="wrap"><div class="stack">${U.info ? infoPage() : ({ home, learn, create, verse, community })[U.tab]()}</div></main></div>`;
}
function home() {
  const m = S.me, mine = S.skills.map(s => s.track), cur = mine.find(k => !done(k)), badges = mine.filter(done);
  return `<div class="hero flat"><div class="row">${av(m, 'lg')}<div class="grow"><h2>Hi ${esc(m.nickname)}! ${e('👋')}</h2><span class="pill gold">Age ${bandName(m.band)}</span></div></div></div>
   ${blocked()}
   ${cur ? `<section class="card stack tight" data-space="learn"><div class="label">Continue learning</div><h3>${e(C.EMOJI[cur])} ${T[cur].name}, lesson ${Math.min(prog(cur) + 1, need())} of ${need()}</h3><div class="bar"><i style="width:${prog(cur) / need() * 100}%"></i></div><div><button class="btn sm" data-act="tab" data-t="learn">Open lesson</button></div></section>` : `<section class="card stack tight"><h3>${e('🏆')} Every skill you chose is finished</h3><p class="muted">Add another skill in Learn, or go and create.</p></section>`}
   <div class="grid2">${[['learn', `${mine.length} skills chosen`], ['create', badges.length ? `${badges.length} unlocked` : 'Unlocks after a skill'], ['verse', 'See what members made'], ['community', 'Your group and causes']].map(t => `<button class="tile ${t[0]}" data-act="tab" data-t="${t[0]}">${e(SPACE[t[0]][0])}<b>${SPACE[t[0]][1]}</b><span>${t[1]}</span></button>`).join('')}</div>
   <section class="card stack tight"><div class="row"><h3 class="grow">${e(ROUTE_E[m.route])} ${esc(S.group.name)}</h3><span class="pill ok">${S.group.adult ? cap(S.group.adult) : 'Moderator'} present</span></div>
    <p class="muted">${m.route === 'own' ? 'You joined on your own. Izwi moderators are present in your group, and your guardian sees what you post.' : `Your ${adult()} sees your progress and what you post in the group.`}</p></section>
   <section class="card stack tight"><h3>${e('🏅')} My badges</h3><div class="row"><span class="pill ok">${e('🛡️')} Safety</span>${badges.map(k => `<span class="pill ok">${e(C.EMOJI[k])} ${T[k].name}</span>`).join('')}</div><p class="small muted">One badge for each finished skill. Badges cannot be bought or traded.</p></section>`;
}
function learn() {
  const mine = S.skills.map(s => s.track), N = need();
  const card = k => {
    const t = T[k], p = prog(k), L = C.lessonsOf(k, S.me.band);
    const body = (l, i) => {
      if (i > p) return `<p class="small muted">${e('🔒')} Finish the lesson before this one.</p>`;
      let h = `<p>${l[1]}</p>`; if (i < p) return h;
      if (l[2]) return h + `<div class="label">Quick check</div><p><b>${l[2]}</b></p>${l[3].map((o, j) => `<button class="choice ${U.wrong[k] === j ? 'wrong' : ''}" data-act="answer" data-k="${k}" data-i="${j}">${o}</button>`).join('')}${U.wrong[k] === undefined ? '' : `<p class="small muted">Not quite. Read the lesson again and try once more ${e('💪')}</p>`}`;
      return h + `<div><button class="btn sm" data-act="answer" data-k="${k}">${l[0] === C.P ? `I finished the task ${e('✅')}` : 'Mark lesson done'}</button></div>`;
    };
    return `<section class="card stack"><div class="row">${e(`<span class="big-e">${C.EMOJI[k]}</span>`)}<h3 class="grow">${t.name}</h3>${p >= N ? `<span class="pill ok">${e('🏅')} Badge earned</span>` : `<span class="pill">${p} of ${N}</span>`}</div>
     <div class="bar"><i style="width:${Math.min(p / N, 1) * 100}%"></i></div>
     <div>${L.map((l, i) => `<div class="lesson"><span class="dot ${i < p ? 'done' : i === p ? 'now' : ''}">${i < p ? '✓' : i + 1}</span><div class="stack tight grow"><b>${l[0]}</b>${body(l, i)}</div></div>`).join('')}</div>
     ${t.res.length ? `<div class="stack tight"><div class="label">Free extras from other sites (open in a new tab)</div>${t.res.filter(r => !r[3] || r[3] === S.me.band).map(r => `<a class="res" href="${r[2]}" target="_blank" rel="noopener noreferrer"><b>${r[0]}</b>${r[1]}</a>`).join('')}</div>` : ''}
     ${p >= N ? `<div data-space="create"><button class="btn" data-act="makein" data-k="${k}">${e('🎨')} Create a ${t.fmt.toLowerCase()}</button></div>` : ''}</section>`;
  };
  const rest = Object.keys(T).filter(k => !mine.includes(k));
  return `<div><h2>${e('📚')} Your skills</h2><p class="muted">${S.me.band === 'o' ? 'Four lessons each. The last one is about publishing and earning from your work.' : 'Three short lessons each. Answer the quick check to move on. The third is a task you do away from the screen.'}</p></div>
   <div class="two">${mine.map(card).join('')}</div>
   ${rest.length ? `<div class="label">Add another skill</div><div class="row">${rest.map(k => `<button class="btn ghost sm" data-act="addskill" data-k="${k}">${e(C.EMOJI[k])} ${T[k].name}</button>`).join('')}</div>` : ''}`;
}
function create() {
  const m = S.me, open = Object.keys(T).filter(done); if (!open.includes(U.fmt)) U.fmt = open[0] || '';
  const mine = S.works.filter(w => w.mine), lock = k => (k === 'community' || k === 'verse') && !m.shareBeyond;
  return `<div><h2>${e('🎨')} Create</h2><p class="muted">Finish a skill to unlock creating in it. A moderator checks every piece before anyone else sees it.</p></div>
   ${blocked()}
   <div class="row">${Object.entries(T).map(([k, t]) => done(k) ? `<button class="btn sm ${U.fmt === k ? 'sel' : 'ghost'}" data-act="fmt" data-k="${k}">${e(C.EMOJI[k])} ${t.fmt}</button>` : `<span class="pill plain">${e('🔒')} ${t.fmt}</span>`).join('')}</div>
   ${U.fmt ? `<section class="card stack"><h3>${e(C.EMOJI[U.fmt])} New ${T[U.fmt].fmt.toLowerCase()}</h3>
    <label class="field"><span>Title</span><input ${bind('cr-title')} maxlength="80" placeholder="What is it called?"></label>
    <label class="field"><span>What is it about?</span>${area('cr-body', 'maxlength="300" placeholder="Two or three sentences"')}</label>
    <div class="card soft stack tight"><div class="label">Add your work: a file, a recording or your words</div>
     <label class="field"><span>${e('📁')} Upload a file from this phone or computer</span><input id="cr-file" type="file" accept="audio/*,video/*,image/*,application/pdf,text/plain"></label>
     ${U.fmt === 'mic' ? `<div class="stack tight"><b>${e('🎙️')} Or record here</b><div class="row"><button class="btn sm ${U.recording ? 'danger' : ''}" data-act="record">${U.recording ? '■ Stop recording' : '● Start recording'}</button>${U.rec ? `<button class="btn ghost sm" data-act="recclear">Delete recording</button>` : ''}</div>${U.rec ? `<audio controls src="${U.rec.url}"></audio>` : ''}</div>` : ''}
     <label class="field"><span>${e('✍️')} ${U.fmt === 'writing' ? 'Write your article here' : 'Or write your script, storyboard or notes here'}</span>${area('cr-content', 'maxlength="6000"')}</label></div>
    <div class="grid2"><label class="field"><span>Topic</span><select data-bind="cr-cat">${C.CATS.map(c => `<option${U.f['cr-cat'] === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
    <label class="field"><span>Link it to a cause (you can skip this)</span><select data-bind="cr-cause"><option value="">No cause</option>${S.causes.filter(c => c.status === 'approved').map(c => `<option value="${c.id}"${U.f['cr-cause'] == c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
    <div class="stack tight"><div class="label">Who can see it?</div>${C.AUD.map(a => `<div class="row"><button class="btn sm ${U.aud[a[0]] && !lock(a[0]) ? 'sel' : 'ghost'}" data-act="aud" data-k="${a[0]}" aria-pressed="${!!U.aud[a[0]] && !lock(a[0])}" ${lock(a[0]) ? 'disabled' : ''} style="min-width:128px">${lock(a[0]) ? e('🔒') : ''}${a[1]}</button><span class="small grow">${lock(a[0]) ? 'Your guardian has not allowed sharing beyond your school or group.' : a[2]}</span></div>`).join('')}</div>
    <label class="field"><span>${e('🙏')} Built on another member’s work? Thank them in your own words</span><input ${bind('cr-credit')} maxlength="140" placeholder="One line of credit"></label>
    <label class="row" style="align-items:flex-start"><input id="cr-ok" type="checkbox"><span class="grow">My work shows no full names, school names or home locations, and anyone in it said yes.</span></label>
    <div class="row"><button class="btn" data-act="submitwork" ${m.canPost ? '' : 'disabled'}>Send for review ${e('🚀')}</button></div>
    <div class="note"><b>What happens next.</b> 1. A moderator checks your work against the four rules. 2. You get a yes, or a reason and a chance to fix it. 3. It appears only for the people you chose.</div></section>`
    : `<div class="card stack"><h3>${e('🔒')} Nothing unlocked yet</h3><p class="muted">Finish the lessons in any skill and its format opens here.</p><div data-space="learn"><button class="btn" data-act="tab" data-t="learn">${e('📚')} Go to Learn</button></div></div>`}
   ${m.band === 'o' ? `<section class="card stack"><div class="row"><h3 class="grow">${e('💼')} My portfolio</h3><span class="pill gold">16 to 18 only</span></div><p class="small muted">Badges and approved work on one page you can show a school, a festival or a client.</p><div class="row">${open.map(k => `<span class="pill ok">${e(C.EMOJI[k])} ${T[k].name}</span>`).join('') || '<span class="small muted">Finish a skill to earn your first badge.</span>'}<span class="pill plain">${mine.filter(w => w.status === 'approved').length} approved pieces</span></div></section>` : ''}
   ${mine.length ? `<div class="label">My work</div>${mine.map(w => `<div class="card row">${e(`<span class="big-e">${C.EMOJI[w.fmt]}</span>`)}<div class="grow"><b>${esc(w.title)}</b><div class="small muted">${T[w.fmt].fmt} · shared with ${w.aud.map(a => C.AUD.find(x => x[0] === a)[1]).join(', ')}${w.status === 'returned' ? `<br>Moderator note: ${esc(w.reason)}` : ''}</div></div>${statusPill(w.status)}<button class="btn ghost sm" data-act="takedown" data-id="${w.id}">${w.status === 'approved' ? 'Take down' : 'Delete'}</button></div>`).join('')}` : ''}`;
}
function verse() {
  const m = S.me, all = S.works.filter(w => w.status === 'approved'), o = m.band === 'o';
  const fmts = [...new Set(all.map(w => w.fmt))], list = all.filter(w => (!U.vf || w.fmt === U.vf) && (!U.vc || w.cat === U.vc));
  const chip = (act, v, l, on) => `<button class="btn sm ${on ? 'sel' : 'ghost'}" data-act="${act}" data-k="${v}">${l}</button>`;
  return `<div><h2>${e('🌍')} Toto Verse</h2><p class="muted">Work by members. Every piece here passed moderator review.</p></div>
   <div class="row">${chip('vf', '', 'All', !U.vf)}${fmts.map(f => chip('vf', f, `${e(C.EMOJI[f])} ${T[f].fmt}`, U.vf === f)).join('')}</div>
   <div class="row">${chip('vc', '', 'All topics', !U.vc)}${C.CATS.map(c => chip('vc', c, c, U.vc === c)).join('')}</div>
   <div class="cards">${list.map(w => { const c = S.causes.find(c => c.id === w.causeId); return `<article class="card stack tight">${cover(w)}${media(w.id, w)}
    <div class="row" style="gap:6px"><span class="pill">${T[w.fmt].fmt}</span><span class="pill plain">${w.cat}</span>${c ? `<span class="pill plain">${e('📣')} ${esc(c.name)}</span>` : ''}${w.mine ? '<span class="pill ok">Yours</span>' : w.aud.includes('verse') ? '' : '<span class="pill plain">From your group</span>'}</div>
    <h3>${esc(w.title)}</h3><p class="small muted">${esc(w.body)}</p>
    ${w.content ? `<details><summary><b>Read it</b></summary><div class="reading">${esc(w.content)}</div></details>` : ''}
    <div class="row">${av(w)}<span class="small"><b>${esc(w.by)}</b>${w.country ? `, ${esc(w.country)}` : ''}</span></div>
    ${w.credit ? `<p class="small note">${e('🙏')} ${esc(w.credit)}</p>` : ''}
    <div class="row" style="gap:6px">${C.REACT.map((r, j) => `<button class="btn sm ${w.myReact === j ? 'on' : 'ghost'}" data-act="react" data-id="${w.id}" data-i="${j}" aria-pressed="${w.myReact === j}">${e(REACT_E[j])} ${r} ${w.r[j] || ''}</button>`).join('')}</div>
    ${w.feedback.map(f => `<p class="small"><b>${esc(f.by)}:</b> ${esc(f.body)} ${f.status === 'approved' ? '' : statusPill(f.status)}</p>`).join('')}
    ${o && !w.mine ? `<label class="field"><span>Written feedback: one strength, one change</span><input id="fb-${w.id}" maxlength="200"></label><div><button class="btn sm" data-act="feedback" data-id="${w.id}" ${m.canPost ? '' : 'disabled'}>Send for review</button></div>` : ''}</article>`; }).join('') || `<div class="card">${e('🌱')} <b>Nothing here yet.</b> Be the first to share something.</div>`}</div>
   <p class="small muted">${o ? 'At 16 to 18 you can also write feedback. A moderator reads it first.' : 'At 13 to 15 you respond with the three reactions. Written feedback opens at 16.'}</p>
   <section class="card soft stack"><h3>${e('🌙')} That is everything for today</h3><p>The page ends here on purpose. Read a book, or go and make something.</p>
    <div class="label">Books to look for</div>${C.BOOKS.filter(b => !b[2] || b[2] === m.band).map(b => `<p>${e('📖')} <b>${b[0]}</b> by ${b[1]}</p>`).join('')}
    <div data-space="create"><button class="btn" data-act="tab" data-t="create">${e('🎨')} Make something</button></div></section>`;
}
function community() {
  const m = S.me;
  if (U.newCause) return `<div><button class="linkbtn" data-act="backcauses">← Back to Community</button><h2>${e('🌱')} Start a cause</h2></div>
   <section class="card stack"><label class="field"><span>What is the name of your cause?</span><input ${bind('nc-name')} maxlength="50"></label>
   <label class="field"><span>What is the issue you want to address?</span><input ${bind('nc-goal')} maxlength="100"></label>
   <label class="field"><span>Why do you think this is an issue?</span>${area('nc-why', 'maxlength="400"')}</label>
   <label class="field"><span>Who can fix it? Name the person or office that decides</span><input ${bind('nc-who')} maxlength="80" placeholder="For example: the head teacher"></label>
   ${m.band === 'y' ? `<div class="note">At 13 to 15, your ${adult()} co-signs a new cause before it goes to the moderators.</div>` : ''}
   <div class="row"><button class="btn" data-act="submitcause" ${m.canPost ? '' : 'disabled'}>Send for review</button></div></section>`;
  const c = S.causes.find(c => c.id === U.causeId);
  if (c) return causePage(c);
  const mine = S.causes.filter(c => c.mine && c.status !== 'approved');
  return `<h2>${e('🤝')} Community</h2>${blocked()}
   <section class="card stack"><div class="row"><h3 class="grow">${e(ROUTE_E[m.route])} ${esc(S.group.name)}</h3><span class="pill ok">${S.group.adult ? cap(S.group.adult) : 'Moderator'} present</span></div>
    ${S.gposts.map(p => `<div class="msg ${p.mine ? 'mine' : ''}">${av(p)}<div><b>${esc(p.by)}</b>${p.staff ? ' <span class="pill plain">Adult</span>' : ''} ${p.status === 'approved' ? '' : statusPill(p.status)}<br>${esc(p.body)}${p.status === 'returned' ? `<div class="small muted">Note: ${esc(p.reason)}</div>` : ''}</div></div>`).join('') || (m.route !== 'own' && !m.vouched ? `<p class="muted">${e('⏳')} Your ${adult()} needs to confirm you before the group opens.</p>` : `<p class="muted">No messages yet. Say hello ${e('👋')}</p>`)}
    <label class="field"><span>Write to your group</span>${area('gp-body', 'maxlength="280"')}</label><div><button class="btn" data-act="gpost" ${m.canPost ? '' : 'disabled'}>Send</button></div>
    <p class="small muted">${e('🔒')} Group talk only. There are no private messages on Izwi. ${m.route === 'own' ? 'A moderator' : 'Your ' + adult()} reads each message before the group sees it.</p></section>
   <div class="row"><div class="grow"><h2>${e('📣')} Causes</h2><p class="muted">Movements started and run by members.</p></div><button class="btn ghost sm" data-act="info" data-k="causehow">How a cause works</button><button class="btn gold" data-act="newcause">${e('🌱')} Start a cause</button></div>
   <div class="cards">${S.causes.filter(c => c.status === 'approved').map(c => `<article class="card stack tight"><div class="row"><div class="label grow">Started by ${esc(c.by)}</div>${c.won ? `<span class="pill ok">${e('🏆')} Won</span>` : ''}</div><h3>${esc(c.name)}</h3><p>${esc(c.goal)}</p>
    <p class="small muted">${c.sup} supporters · ${c.mem} members</p><div class="row" style="margin-top:auto"><button class="btn sm" data-act="opencause" data-id="${c.id}">Open</button><button class="btn sm ${c.supported ? 'on' : 'ghost'}" data-act="support" data-id="${c.id}">${c.supported ? '✓ Supporting' : 'Support'}</button></div></article>`).join('') || `<div class="card">${e('🌱')} <b>No causes yet.</b> Start the first one.</div>`}</div>
   ${mine.map(c => `<div class="card row"><div class="grow"><b>${esc(c.name)}</b><div class="small muted">Your cause${c.status === 'returned' ? ` · Note: ${esc(c.reason)}` : ''}</div></div>${statusPill(c.status, c.cosignBy)}</div>`).join('')}`;
}
function memoHtml(c) { const d = U.f, l = (t, v, ph) => `<div><div class="label">${t}</div><p class="${v ? '' : 'muted'}">${esc(v || ph)}</p></div>`;
  return `<div class="label">Preview · to ${esc(c.who)}</div><h3>${esc(d['m-title'] || 'Your heading')}</h3>${l('The facts', d['m-facts'], 'What is happening, where and since when.')}${l('How it affects children', d['m-affect'], 'What it means for children’s lives.')}${l('What we ask', d['m-ask'], 'The action you want, and from whom.')}<p class="small muted">Signed by the members of ${esc(c.name)}</p>`; }
function causePage(c) {
  const m = S.me, J = c.joined, Tb = U.causeTab; let body = '';
  const works = S.works.filter(w => w.causeId === c.id && w.status === 'approved');
  if (Tb === 'about') body = `<div class="two"><section class="card stack tight"><div class="label">Our ask</div><p style="font-weight:800;font-size:1.15rem">${esc(c.goal)}</p><div class="label">Who decides</div><p>${e('🧭')} ${esc(c.who)}</p><div class="label">Why it is important</div><p>${esc(c.why)}</p></section>
   <section class="card stack tight"><div class="row"><h3 class="grow">Updates</h3><span class="pill ${c.won ? 'ok' : 'plain'}">${c.won ? '🏆 Won' : 'Not won yet'}</span></div>${c.updates.map(u => `<p>${e('📌')} ${esc(u.body)} ${u.status === 'approved' ? '' : statusPill(u.status)}</p>`).join('') || '<p class="muted">No updates yet.</p>'}
    ${J ? `<label class="field"><span>Post an update for supporters</span><input ${bind('up-body')} maxlength="140"></label><div><button class="btn sm" data-act="citem" data-kind="update" data-id="${c.id}" ${m.canPost ? '' : 'disabled'}>Send for review</button></div>` : '<p class="small muted">Members of the cause post updates.</p>'}</section></div>
   <div class="label">Made for this cause</div><div class="cards">${works.map(w => `<div class="card stack tight">${cover(w)}<b>${esc(w.title)}</b><span class="small muted">${esc(w.by)}</span></div>`).join('') || '<p class="muted">Nothing yet. Link your next creation to this cause.</p>'}</div>`;
  if (Tb === 'talk') body = `<section class="card soft stack tight"><div class="label">Questions to get you talking</div><p><b>${e('💭')} What is the first thing we can do?</b></p><p><b>${e('🤝')} Who can we work with on this cause?</b></p></section>
   <section class="card stack"><div class="label">Discussion</div>${c.posts.map(p => `<div class="msg ${p.mine ? 'mine' : ''}">${av(p)}<div><b>${esc(p.by)}</b> ${p.status !== 'approved' ? statusPill(p.status) : ''}<br>${esc(p.body)}${p.status === 'returned' ? `<div class="small muted">Moderator note: ${esc(p.reason)}</div>` : ''}</div></div>`).join('') || '<p class="muted">No ideas yet. Add the first one.</p>'}
   ${J ? `<label class="field"><span>Add your idea</span>${area('post-body', 'maxlength="280"')}</label><div><button class="btn" data-act="citem" data-kind="post" data-id="${c.id}" ${m.canPost ? '' : 'disabled'}>Send for review</button></div>` : `<div class="note">Join the cause to add your ideas.</div>`}</section>`;
  if (Tb === 'act') body = J ? `<div class="two"><section class="card stack"><h3>${e('📝')} Write a memorandum</h3><p class="small muted">A memorandum is a short formal letter asking a leader to act.</p>
    <label class="field"><span>Heading</span><input ${bind('m-title')} maxlength="80"></label>
    <label class="field"><span>Facts about the cause</span>${area('m-facts', 'maxlength="400"')}</label>
    <label class="field"><span>How it is affecting children</span>${area('m-affect', 'maxlength="400"')}</label>
    <label class="field"><span>What we want to be done</span>${area('m-ask', 'maxlength="400"')}</label>
    <div><button class="btn" data-act="memo" data-id="${c.id}" ${m.canPost ? '' : 'disabled'}>Send memorandum for review</button></div></section>
   <div class="stack"><div class="memo stack" id="memo-prev">${memoHtml(c)}</div>
    ${m.band === 'y' ? `<section class="card stack tight"><h3>${e('📣')} Online campaign message</h3><p class="small muted">${e('🔒')} Opens at 16. At your age you shape the message in the discussion and co-write the memorandum.</p></section>` : `<section class="card stack"><h3>${e('📣')} Online campaign message</h3><label class="field"><span>One message, 280 characters</span>${area('msg-body', 'maxlength="280"')}</label><p class="small muted">Approved messages go out from the Izwi team account, never from a member’s own account.</p><div><button class="btn" data-act="citem" data-kind="message" data-id="${c.id}" ${m.canPost ? '' : 'disabled'}>Send for review</button></div></section>`}
    <section class="card stack"><h3>${e('📎')} Shared documents</h3><label class="field"><span>Add a document for the group</span><input id="doc-file" type="file" accept="application/pdf,text/plain,image/*"></label><div><button class="btn sm" data-act="doc" data-id="${c.id}" ${m.canPost ? '' : 'disabled'}>Send for review</button></div></section></div></div>
   ${c.sent.length ? `<div class="label">Sent from this cause</div>${c.sent.map(i => `<div class="card row"><div class="grow"><b>${esc(i.title)}</b><div class="small muted">${KIND[i.kind]} by ${esc(i.by)}${i.status === 'returned' ? ` · Moderator note: ${esc(i.reason)}` : ''}</div>${i.kind === 'doc' && i.status === 'approved' ? `<a href="/api/files/${i.id}" target="_blank" rel="noopener">Open</a>` : `<p class="small">${i.kind === 'doc' ? '' : esc(i.body)}</p>`}</div>${statusPill(i.status)}</div>`).join('')}` : ''}`
    : `<div class="note">Join the cause to use the Action Space.</div>`;
  return `<div class="row"><button class="linkbtn" data-act="backcauses">← Back to Community</button><button class="linkbtn" data-act="info" data-k="causehow">How a cause works</button></div>
   <div class="hero flat"><div class="label" style="color:#fff">Started by ${esc(c.by)}</div><h2>${esc(c.name)}</h2>
    <p>${c.sup} supporters · ${c.mem} members</p>
    <div class="row"><button class="btn gold" data-act="join" data-id="${c.id}">${J ? '✓ You are a member' : 'Join cause'}</button><button class="btn ghost" data-act="support" data-id="${c.id}">${c.supported ? '✓ Supporting' : 'Support'}</button></div></div>
   <div class="row">${[['about', 'About and updates'], ['talk', 'Discussion'], ['act', 'Action Space']].map(([k, n]) => `<button class="btn sm ${Tb === k ? '' : 'ghost'}" data-act="ctab" data-t="${k}">${n}</button>`).join('')}</div>${body}`;
}

/* ---------- adults ---------- */
const adultShell = (title, body, space) => `<div data-space="${space}"><header class="top"><div class="wrap"><div class="logo">izwi <small>${title}</small></div><span class="who">${esc(S.me.nickname)}</span><button class="linkbtn" data-act="logout">Sign out</button></div></header><main class="wrap"><div class="stack">${U.info ? infoPage() : body}</div></main></div>`;
function leaderView() {
  const g = S.group; if (!g) return adultShell('Teacher or leader', '<div class="note">You do not have a group yet. Ask Izwi to set one up.</div>', 'learn');
  const wait = S.members.filter(m => !m.vouched), n = S.pending.length + S.causes.length + S.help.length + wait.length;
  return adultShell(cap(g.adult), `<div><div class="label">${cap(g.adult)}</div><h2>${esc(g.name)}</h2></div>
   <div class="cards"><div class="card stat"><b>${esc(g.code)}</b><span class="muted small">Group code. Give it only to your own members.</span></div>
    <div class="card stat"><b>${S.members.filter(m => m.consent === 'yes').length} of ${S.members.length}</b><span class="muted small">guardian consents received</span></div>
    <div class="card stat"><b>${n}</b><span class="muted small">waiting for you</span></div></div>
   ${S.help.map(h => `<section class="card row note gold"><div class="grow"><b>${e('🫶')} ${esc(h.by)} asked to talk to you</b><p class="small">You see only that they asked. Speak to them in person and follow your safeguarding procedure.</p></div><button class="btn sm" data-act="lhelp" data-id="${h.id}">I have spoken to them</button><button class="btn ghost sm" data-act="lhelp" data-id="${h.id}" data-esc="1">I need Izwi’s help</button></section>`).join('')}
   ${wait.map(m => `<section class="card row">${av(m)}<div class="grow"><b>${esc(m.nickname)}</b> wants to join your group<p class="small muted">Confirm only if you know this child is in your group. Age ${bandName(m.band)}.</p></div><button class="btn sm" data-act="vouch" data-id="${m.id}" data-ok="1">Yes, they are mine</button><button class="btn ghost sm" data-act="vouch" data-id="${m.id}">Not in my group</button></section>`).join('')}
   ${S.causes.map(c => `<section class="card stack tight"><span class="pill" style="align-self:flex-start">New cause to co-sign</span><h3>${esc(c.name)}</h3><p>${esc(c.goal)}. ${esc(c.why)}</p><p class="small muted">From ${esc(c.by)} · Who decides: ${esc(c.who)}</p>
    <div class="row"><button class="btn sm" data-act="lcause" data-id="${c.id}" data-a="cosign">Co-sign and send to moderators</button><button class="btn ghost sm" data-act="lcause" data-id="${c.id}" data-a="return">Talk it through first</button></div></section>`).join('')}
   ${S.pending.map(p => `<section class="card stack tight"><div class="row"><span class="pill">Group message</span>${p.flag ? `<span class="pill bad">${esc(p.flag)}</span>` : ''}</div><div class="msg">${av(p)}<div><b>${esc(p.by)}</b><br>${esc(p.body)}</div></div><div class="row"><button class="btn sm" data-act="litem" data-id="${p.id}" data-a="approve">Show to the group</button><button class="btn ghost sm" data-act="litem" data-id="${p.id}" data-a="return">Send back</button><button class="btn ghost sm" data-act="litem" data-id="${p.id}" data-a="escalate">Send to Izwi moderators</button></div></section>`).join('')}
   ${n ? '' : `<div class="card">${e('✅')} <b>Nothing is waiting for you.</b></div>`}
   <section class="card stack"><h3>${e('💬')} Group chat</h3>${S.gposts.map(p => `<div class="msg">${av(p)}<div><b>${esc(p.by)}</b><br>${esc(p.body)}</div></div>`).join('') || '<p class="muted">No messages yet.</p>'}
    <label class="field"><span>Write to your group</span>${area('gp-body', 'maxlength="280"')}</label><div><button class="btn" data-act="gpost">Send</button></div></section>
   <section class="card stack"><h3>${e('📈')} Member progress</h3>${S.members.filter(m => m.vouched).map(m => `<div class="row">${av(m)}<span class="grow"><b>${esc(m.nickname)}</b> <span class="small muted">${m.skills.map(s => T[s.track].name).join(', ') || 'No skill chosen yet'}</span></span>${m.consent === 'yes' ? '' : '<span class="pill wait">No consent yet</span>'}<div class="bar" style="width:120px"><i style="width:${m.skills.length ? m.skills.reduce((a, s) => a + s.progress / s.need, 0) / m.skills.length * 100 : 0}%"></i></div></div>`).join('') || '<p class="muted">No confirmed members yet.</p>'}
    <p class="small muted">You see progress and group posts. You do not see readiness answers or the reason for a help request.</p></section>`, 'learn');
}
function guardianView() {
  return adultShell('Parent or guardian', S.children.map(k => {
    const yes = k.consent === 'yes', tog = (key, on, l, d) => `<div class="row"><div class="grow"><b>${l}</b><div class="small muted">${d}</div></div><button class="btn sm ${on ? 'on' : 'ghost'}" data-act="gset" data-id="${k.id}" data-k="${key}" data-v="${on ? '' : '1'}" aria-pressed="${on}">${on ? 'On' : 'Off'}</button></div>`;
    return `<div class="hero flat"><div class="row">${av(k, 'lg')}<div><h2>${esc(k.nickname)} on Izwi</h2><span class="pill gold">Age ${bandName(k.band)}</span></div></div></div>
    ${k.help ? `<section class="card row note gold"><div class="grow"><b>${e('🫶')} ${esc(k.nickname)} asked to talk to you</b><p class="small">Find a quiet moment and ask how things are going online.</p></div><button class="btn sm" data-act="gset" data-id="${k.id}" data-k="helpDone" data-v="1">We have talked</button></section>` : ''}
    <section class="card stack"><div class="row"><h3 class="grow">Your consent</h3><span class="pill ${yes ? 'ok' : 'wait'}">${yes ? '✓ Given' : k.consent === 'withdrawn' ? 'Withdrawn' : 'Not given yet'}</span></div>
     <p>${e('🎨')} Your child learns creative skills, makes and shares work, and joins group causes.</p><p>${e('🪪')} We collect a nickname, year of birth, country and group. No full name and no address.</p><p>${e('👀')} Only the people your child chooses see their work, after a moderator has checked it.</p>
     <div class="row">${yes ? `<button class="btn ghost sm" data-act="gconsent" data-id="${k.id}" data-v="withdrawn">Withdraw consent</button>` : `<button class="btn" data-act="gconsent" data-id="${k.id}" data-v="yes">I give consent ${e('✅')}</button>`}<button class="btn ghost sm" data-act="info" data-k="work">How Izwi handles your child’s information</button></div>
     ${yes ? '' : '<p class="small muted">Without consent your child can learn, but cannot post or share anything, and nothing they made is shown to others.</p>'}</section>
    ${k.cosign.map(c => `<section class="card stack tight"><span class="pill" style="align-self:flex-start">Your child wants to start a cause</span><h3>${esc(c.name)}</h3><p>${esc(c.goal)}. ${esc(c.why)}</p><div class="row"><button class="btn sm" data-act="gcause" data-id="${c.id}" data-a="cosign">Co-sign and send to moderators</button><button class="btn ghost sm" data-act="gcause" data-id="${c.id}" data-a="return">Talk it through first</button></div></section>`).join('')}
    <section class="card stack tight"><h3>${e('🎨')} What ${esc(k.nickname)} made</h3>${k.works.map(w => `<div class="row"><span class="grow">${e(C.EMOJI[w.fmt])} <b>${esc(w.title)}</b></span>${w.hasFile ? `<a href="/api/files/${w.id}" target="_blank" rel="noopener">Open</a>` : ''}${statusPill(w.status)}</div>`).join('') || '<p class="muted">Nothing yet.</p>'}</section>
    <section class="card stack tight"><h3>${e('🧭')} Where ${esc(k.nickname)} takes part</h3><p>${esc(k.group.name)}, with a ${k.group.adult || 'moderator'} present</p>${k.causes.map(c => `<p>${e('📣')} Cause: ${esc(c)}</p>`).join('')}<p>${e('📚')} Skills: ${k.skills.map(s => T[s].name).join(', ') || 'none chosen yet'}</p></section>
    <section class="card stack"><h3>${e('🎛️')} Your choices</h3>${tog('shareBeyond', k.shareBeyond, 'Show work beyond the school or group', 'Allows sharing with the wider community and the Toto Verse')}${tog('smsSummary', k.smsSummary, 'Weekly summary by SMS', 'What your child learned and made this week')}</section>`;
  }).join('') || '<div class="note">No child is linked to this phone number yet.</div>', 'community') ;
}
function modView() {
  const q = S.queue, st = S.stats, tab = U.modTab;
  const item = i => `<section class="card stack tight"><div class="row" style="gap:6px"><span class="pill">${KIND[i.kind]}${i.fmt ? `: ${T[i.fmt].fmt}` : ''}</span>${i.causeName ? `<span class="pill plain">${esc(i.causeName)}</span>` : ''}${i.band ? `<span class="pill gold">Age ${bandName(i.band)}</span>` : ''}${i.route ? `<span class="pill plain">${C.ROUTES[i.route][0]}</span>` : ''}${i.flag ? `<span class="pill bad">${e('🚩')} ${esc(i.flag)}</span>` : ''}</div>
    ${i.title ? `<h3>${esc(i.title)}</h3>` : ''}<p>${esc(i.body)}</p>${i.t === 'item' ? media(i.id, i) : ''}${i.hasFile && /^image\//.test(i.mime) ? `<img alt="" src="/api/files/${i.id}" style="border-radius:12px;max-height:300px">` : ''}
    ${i.content && i.kind === 'work' ? `<div class="reading">${esc(i.content)}</div>` : ''}
    <div class="row small muted">${av(i)}From ${esc(i.by)}${i.credit ? ` · credit: ${esc(i.credit)}` : ''}${i.aud?.length ? ` · for: ${i.aud.join(', ')}` : ''}</div>
    <div class="row">${i.t === 'help' ? `<button class="btn sm" data-act="mhelp" data-id="${i.id}">Mark handled</button>` : `<button class="btn sm" data-act="mod" data-t="${i.t}" data-id="${i.id}" data-a="approve">✓ Approve</button><select id="rs-${i.t}${i.id}" aria-label="Reason for sending back" style="width:auto;flex:1;min-width:0;max-width:280px">${C.REASONS.map((r, k) => `<option${/phone|contact/.test(i.flag || '') && k === 0 || /unkind/.test(i.flag || '') && k === 1 ? ' selected' : ''}>${r}</option>`).join('')}</select><button class="btn ghost sm" data-act="mod" data-t="${i.t}" data-id="${i.id}" data-a="return">Send back</button>`}<button class="btn danger sm" data-act="${i.t === 'help' ? 'mhelp' : 'mod'}" data-t="${i.t}" data-id="${i.id}" data-a="escalate">Escalate</button></div></section>`;
  let body = '';
  if (tab === 'queue') body = (q.length ? q.map(item).join('') : `<div class="card">${e('✅')} <b>The queue is clear.</b></div>`) + `<div class="note bad">${e('🆘')} <b>A child may be at risk?</b> Escalate passes the item to the safeguarding lead and removes it from the queue. Follow the written escalation procedure.</div>`;
  if (tab === 'groups') body = `<section class="card stack"><h3>Create a school or community group</h3><div class="grid2">
     <label class="field"><span>Group name</span><input ${bind('g-name')} placeholder="Grade 8 Blue"></label><label class="field"><span>School or organisation</span><input ${bind('g-org')}></label>
     <label class="field"><span>Kind</span><select data-bind="g-kind"><option value="school">School</option><option value="community"${U.f['g-kind'] === 'community' ? ' selected' : ''}>Community group</option></select></label>
     <label class="field"><span>Teacher or leader name</span><input ${bind('g-lname')}></label><label class="field"><span>Their email</span><input ${bind('g-email')} type="email"></label>
     <label class="field"><span>A first password for them (10 or more characters)</span><input ${bind('g-pass')}></label></div><div><button class="btn" data-act="mkgroup">Create group</button></div>
     <p class="small muted">Check the adult’s identity and safeguarding clearance before you create their account.</p></section>
    ${S.groups.map(g => `<div class="card row"><div class="grow"><b>${esc(g.name)}</b> <span class="small muted">${esc(g.org)} · ${g.kind} · ${g.members} members${g.leader ? ` · ${esc(g.leader)}` : ''}</span></div>${g.code ? `<span class="pill">${esc(g.code)}</span>` : ''}</div>`).join('')}`;
  if (tab === 'causes') body = S.causes.map(c => `<div class="card row"><b class="grow">${esc(c.name)}</b><button class="btn sm ${c.won ? 'on' : 'ghost'}" data-act="mod" data-t="cause" data-id="${c.id}" data-a="won">${c.won ? '🏆 Won' : 'Mark as won'}</button></div>`).join('') || '<div class="card">No approved causes yet.</div>';
  if (tab === 'log') body = `<section class="card stack tight">${S.log.map(l => `<p class="small"><b>${esc(l.display || 'System')}</b> ${esc(l.action)} ${esc(l.target)} ${esc(l.detail)} <span class="muted">${esc(l.at.slice(0, 16).replace('T', ' '))}</span></p>`).join('') || '<p class="muted">Nothing yet.</p>'}</section>`;
  return adultShell('Moderator', `<div><div class="label">Izwi moderator</div><h2>${e('🛡️')} Review</h2><p class="muted">Nothing a member makes is public until a trained moderator approves it here.</p></div>
   <div class="cards"><div class="card stat"><b>${st.review}</b><span class="muted small">waiting</span></div><div class="card stat"><b>${st.approved}</b><span class="muted small">approved and live</span></div><div class="card stat"><b>${st.returned}</b><span class="muted small">sent back</span></div><div class="card stat"><b>${st.escalated}</b><span class="muted small">with the safeguarding lead</span></div><div class="card stat"><b>${st.members}</b><span class="muted small">members</span></div></div>
   <div class="row">${[['queue', `Queue (${q.length})`], ['groups', 'Groups'], ['causes', 'Causes'], ['log', 'Activity log']].map(([k, n]) => `<button class="btn sm ${tab === k ? '' : 'ghost'}" data-act="modtab" data-t="${k}">${n}</button>`).join('')}</div>${body}`, 'home');
}

/* ---------- actions ---------- */
let recorder, chunks = [];
const A = {
  screen: d => { U.screen = d.s; U.gstep = 0; U.devCode = ''; },
  info: d => { U.info = d.k || null; },
  route: d => { U.route = d.k; }, avatar: d => { U.avatar = d.a; }, color: d => { U.color = d.c; },
  signup: async () => { const y = new Date().getFullYear(); const r = await send('/signup', { nickname: U.f['j-name'], secret: U.f['j-secret'], birthYear: +(U.f['j-year'] || y - 14), country: U.f['j-country'] || 'Kenya', route: U.route, code: U.f['j-code'], avatar: U.avatar, color: U.color }, 'Welcome to Izwi!'); if (r !== 'keep') clearF('j-'); return r; },
  login: async () => { const r = await send('/login', { username: U.f['li-user'], secret: document.getElementById('li-secret').value }); if (r !== 'keep') clearF('li-'); return r; },
  logout: async () => { await api('/logout', {}); Object.assign(U, { screen: 'welcome', tab: 'home', info: null, causeId: null, f: {}, unlock: false }); await refresh(); },
  gstart: async () => { const r = await api('/guardian/start', { phone: U.f['g-phone'] }); if (!r) return 'keep'; U.gstep = 1; U.devCode = r.devCode || ''; toast('If that number is linked to a child, a code is on its way.'); },
  gverify: () => send('/guardian/verify', { phone: U.f['g-phone'], code: val('g-code') }),
  gconsent: d => send(`/guardian/child/${d.id}`, { consent: d.v }, d.v === 'yes' ? 'Consent given. Thank you.' : 'Consent withdrawn. Posting is paused.'),
  gset: d => send(`/guardian/child/${d.id}`, { [d.k]: !!d.v }),
  gcause: d => send(`/guardian/cause/${d.id}`, { action: d.a }, d.a === 'cosign' ? 'Co-signed. Now with the moderators.' : 'Sent back to your child.'),
  consentsend: () => send('/consent/request', { phone: U.f['c-phone'] }, 'Request sent to your guardian.'),
  selfconsent: () => send('/consent/self', {}, 'Thank you.'),
  stage: d => send('/onboarding', { stage: d.to }),
  ready: d => { U.ready[U.ri] = +d.i; },
  rprev: () => { U.ri--; },
  rnext: async () => { if (U.ri < C.READY.length - 1) { U.ri++; return; } return send('/onboarding', { readiness: U.ready, stage: 'safety' }); },
  topic: d => { U.topic = U.topic === d.k ? '' : d.k; if (S.me && !S.me.safetyRead[d.k]) { S.me.safetyRead[d.k] = true; api('/onboarding', { read: d.k }); } },
  skill: d => { U.skills = U.skills.includes(d.k) ? U.skills.filter(k => k !== d.k) : [...U.skills, d.k]; },
  skillsdone: async () => { const r = await api('/onboarding', { skills: U.skills, stage: 'done' }); if (!r) return 'keep'; U.unlock = true; await refresh(); },
  enter: () => { U.unlock = false; U.tab = 'home'; },
  tab: d => { U.tab = d.t; U.causeId = null; U.newCause = false; U.info = null; },
  answer: async d => { const r = await api('/learn', { track: d.k, choice: d.i === undefined ? undefined : +d.i }); if (!r) return 'keep'; if (!r.correct) { U.wrong[d.k] = +d.i; return; } delete U.wrong[d.k]; toast(r.badge ? `🏅 ${T[d.k].name} badge earned! ${T[d.k].fmt} is unlocked in Create.` : 'Nice one! Next lesson unlocked.'); await refresh(); },
  addskill: d => send('/skills', { track: d.k }),
  makein: d => { U.fmt = d.k; U.tab = 'create'; },
  fmt: d => { U.fmt = d.k; }, aud: d => { U.aud[d.k] = !U.aud[d.k]; },
  record: async () => {
    if (U.recording) { recorder.stop(); return 'keep'; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = ev => chunks.push(ev.data);
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); if (U.rec) URL.revokeObjectURL(U.rec.url); U.rec = { blob, url: URL.createObjectURL(blob) }; U.recording = false; render(); };
      recorder.start(); U.recording = true;
    } catch { toast('We could not use the microphone. Allow it in your browser, or upload a file.', true); return 'keep'; }
  },
  recclear: () => { if (U.rec) URL.revokeObjectURL(U.rec.url); U.rec = null; },
  submitwork: async () => {
    const f = new FormData(), file = document.getElementById('cr-file').files[0];
    if (!document.getElementById('cr-ok').checked) { toast('Tick the safety box before sending.', true); return 'keep'; }
    for (const [k, v] of Object.entries({ fmt: U.fmt, title: U.f['cr-title'] || '', body: U.f['cr-body'] || '', content: U.f['cr-content'] || '', cat: U.f['cr-cat'] || C.CATS[0], credit: U.f['cr-credit'] || '', causeId: U.f['cr-cause'] || '', aud: JSON.stringify(Object.keys(U.aud).filter(k => U.aud[k])), ok: 'true' })) f.set(k, v);
    if (file) f.set('file', file); else if (U.rec && U.fmt === 'mic') f.set('file', U.rec.blob, 'recording.webm');
    const r = await send('/works', null, 'Sent for review! 🚀', f); if (r !== 'keep') { clearF('cr-'); A.recclear(); render(); } return r;
  },
  takedown: d => send(`/works/${d.id}/delete`, {}, 'Removed.'),
  vf: d => { U.vf = d.k; }, vc: d => { U.vc = d.k; },
  react: d => { const w = S.works.find(w => w.id == d.id); return send(`/works/${d.id}/react`, { kind: w.myReact === +d.i ? -1 : +d.i }); },
  feedback: async d => { const r = await send(`/works/${d.id}/feedback`, { body: val('fb-' + d.id) }, 'Feedback sent for review.'); return r; },
  gpost: async () => { const r = await send('/gposts', { body: U.f['gp-body'] }, S.role === 'leader' ? 'Sent.' : S.me.route === 'own' ? 'Sent to a moderator.' : `Sent to your ${adult()}.`); if (r !== 'keep') { clearF('gp-'); render(); } return r; },
  newcause: () => { U.newCause = true; }, backcauses: () => { U.newCause = false; U.causeId = null; },
  opencause: d => { U.causeId = +d.id; U.causeTab = 'about'; }, ctab: d => { U.causeTab = d.t; },
  support: d => send(`/causes/${d.id}/support`), join: d => send(`/causes/${d.id}/join`),
  submitcause: async () => { const r = await send('/causes', { name: U.f['nc-name'], goal: U.f['nc-goal'], why: U.f['nc-why'], who: U.f['nc-who'] }, S.me.band === 'y' ? `Sent to your ${adult()} to co-sign.` : 'Cause sent for review.'); if (r !== 'keep') { clearF('nc-'); U.newCause = false; render(); } return r; },
  citem: async d => { const key = { update: 'up-body', post: 'post-body', message: 'msg-body' }[d.kind]; const r = await send(`/causes/${d.id}/items`, { kind: d.kind, body: U.f[key] }, 'Sent for review.'); if (r !== 'keep') { delete U.f[key]; render(); } return r; },
  memo: async d => { const r = await send(`/causes/${d.id}/items`, { kind: 'memo', title: U.f['m-title'], facts: U.f['m-facts'], affect: U.f['m-affect'], ask: U.f['m-ask'] }, 'Memorandum sent for review.'); if (r !== 'keep') { clearF('m-'); render(); } return r; },
  doc: d => { const file = document.getElementById('doc-file').files[0]; if (!file) { toast('Choose a document first.', true); return 'keep'; } const f = new FormData(); f.set('file', file); return send(`/causes/${d.id}/docs`, null, 'Document sent for review.', f); },
  askadult: () => send('/help', { kind: 'talk' }, `Your ${adult()} has been asked to talk to you.`),
  report: async () => { const r = await send('/help', { kind: 'report', body: U.f['rep-body'] }, 'Report sent. A moderator will read it.'); if (r !== 'keep') { clearF('rep-'); U.info = null; render(); } return r; },
  vouch: d => send(`/leader/vouch/${d.id}`, { ok: !!d.ok }, d.ok ? 'Member confirmed.' : 'Removed from your group.'),
  litem: d => send(`/leader/item/${d.id}`, { action: d.a }),
  lcause: d => send(`/leader/cause/${d.id}`, { action: d.a }, d.a === 'cosign' ? 'Co-signed. Now with the moderators.' : 'Sent back to the member.'),
  lhelp: d => send(`/leader/help/${d.id}`, { escalate: !!d.esc }, d.esc ? 'Izwi’s safeguarding lead has been told.' : 'Marked as done.'),
  modtab: d => { U.modTab = d.t; },
  mod: d => send(`/mod/${d.t}/${d.id}`, { action: d.a, reason: val(`rs-${d.t}${d.id}`) }, { approve: 'Approved and live.', return: 'Sent back with a note.', escalate: 'Passed to the safeguarding lead.' }[d.a]),
  mhelp: d => send(`/mod/help/${d.id}`, { action: d.a || 'close' }, d.a ? 'Passed to the safeguarding lead.' : 'Marked as handled.'),
  mkgroup: async () => { const r = await send('/mod/groups', { name: U.f['g-name'], org: U.f['g-org'], kind: U.f['g-kind'] || 'school', leaderName: U.f['g-lname'], leaderEmail: U.f['g-email'], leaderPassword: U.f['g-pass'] }); if (r !== 'keep') { toast(`Group created. Code: ${r.code}`); clearF('g-'); render(); } return r; }
};

/* ---------- draw and listen ---------- */
function render() {
  const key = [S.role, S.me?.stage, U.screen, U.tab, U.info, U.causeId, U.causeTab, U.newCause, U.ri, U.unlock, U.modTab].join('|');
  app.innerHTML = !S.role ? outside() : S.role === 'member' ? (S.me.stage !== 'done' || U.unlock ? onboarding() : memberShell()) : ({ leader: leaderView, guardian: guardianView, moderator: modView })[S.role]();
  if (key !== render.key) window.scrollTo(0, 0);
  render.key = key;
}
let busy = false;
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-act]'); if (!b || b.disabled || busy) return;
  busy = true;
  try { if ((await A[b.dataset.act](b.dataset)) !== 'keep') render(); } finally { busy = false; }
});
document.addEventListener('input', ev => {
  const k = ev.target.dataset?.bind; if (!k) return;
  U.f[k] = ev.target.value;
  if (k.startsWith('m-')) { const p = document.getElementById('memo-prev'), c = S.causes?.find(c => c.id === U.causeId); if (p && c) p.innerHTML = memoHtml(c); }
});
document.addEventListener('change', ev => { const k = ev.target.dataset?.bind; if (k) U.f[k] = ev.target.value; });
refresh();
})();
