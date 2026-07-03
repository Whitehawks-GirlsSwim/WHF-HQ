const screens = document.querySelectorAll('.screen');
const navButtons = document.querySelectorAll('.bottomNav button');

let DATA = loadAdminPreviewData();
let meetSchedule = DATA.meetSchedule || [];
let keyDates = DATA.keyDates || [];
let initialSponsors = DATA.sponsors || [];

function loadAdminPreviewData() {
  try {
    const preview = localStorage.getItem('whfAdminDataPreview');
    return preview ? JSON.parse(preview) : (window.WHF_DATA || {});
  } catch (error) {
    console.warn('Admin preview data could not be loaded. Falling back to data.js.', error);
    return window.WHF_DATA || {};
  }
}

function setRuntimeData(nextData) {
  DATA = nextData || {};
  meetSchedule = DATA.meetSchedule || [];
  keyDates = DATA.keyDates || [];
  initialSponsors = DATA.sponsors || [];
}

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function daysUntil(date, now) {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startEvent = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startEvent - startToday) / 86400000);
}

function getEventStatus(eventDate, now) {
  const d = daysUntil(eventDate, now);
  if (d === 0) return 'TODAY';
  if (d === 1) return 'TOMORROW';
  if (d > 1) return `IN ${d} DAYS`;
  return 'COMPLETE';
}

function getSeasonItems() {
  const meetItems = meetSchedule.map(event => ({ ...event, title: event.opponent, type: 'meet', label: 'NEXT MEET' }));
  const dateItems = keyDates.map(item => ({ ...item, opponent: item.title, level: item.label || 'IMPORTANT DATE', type: 'keyDate' }));
  return [...dateItems, ...meetItems].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getNextSeasonItem(now = new Date()) {
  return getSeasonItems().find(item => new Date(item.date).getTime() + 3 * 60 * 60 * 1000 >= now.getTime()) || null;
}

function getNextMeet(now = new Date()) {
  const sorted = [...meetSchedule].sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted.find(event => new Date(event.date).getTime() + 3 * 60 * 60 * 1000 >= now.getTime()) || null;
}

function renderTodayPanel() {
  const now = new Date();
  const next = getNextSeasonItem(now);
  const kicker = document.getElementById('todayKicker');
  const main = document.getElementById('todayMain');
  const meta = document.getElementById('todayMeta');
  const location = document.getElementById('todayLocation');
  if (!kicker || !main || !meta || !location) return;

  if (!next) {
    kicker.textContent = 'SEASON COMPLETE';
    main.textContent = 'Thank you, WHF families';
    meta.textContent = '2026 season schedule complete';
    location.textContent = 'Updates can continue here for banquet, records and offseason information.';
    return;
  }

  const date = new Date(next.date);
  const status = getEventStatus(date, now);
  kicker.textContent = status === 'TODAY' ? 'TODAY' : (next.type === 'keyDate' ? (next.label || 'NEXT UP') : 'NEXT MEET');
  main.textContent = next.title || next.opponent;

  if (next.type === 'keyDate') {
    meta.textContent = next.meta || `${formatDate(date)} • ${formatTime(date)}`;
    location.textContent = next.location || 'Details will be updated here.';
  } else {
    meta.textContent = `${next.level} • ${formatDate(date)} • ${formatTime(date)}`;
    location.textContent = next.location;
  }
}

function cardHtml(item, idx = 0) {
  const accent = item.accent || (idx % 2 === 0 ? 'green' : 'red');
  const cls = accent === 'split' ? 'split' : accent === 'red' ? 'red' : 'green';
  const detail = item.body || item.detail || '';
  const date = item.date ? `<p><b>${escapeHtml(item.date)}</b></p>` : '';
  const link = item.linkUrl ? `<a class="link" href="${escapeHtml(item.linkUrl)}">${escapeHtml(item.linkText || 'View Details')}</a>` : '';
  return `<div class="card ${cls}"><h3>${escapeHtml(item.title || item.name || 'Untitled')}</h3>${date}<p>${escapeHtml(detail)}</p>${link}</div>`;
}

function renderPageCards() {
  const parent = document.getElementById('parentCards');
  if (parent) parent.innerHTML = (DATA.parentCards || []).map(cardHtml).join('');

  const booster = document.getElementById('boosterCards');
  if (booster) booster.innerHTML = (DATA.boosterCards || []).map(cardHtml).join('');

  const events = document.getElementById('eventsList');
  if (events) events.innerHTML = (DATA.events || []).map(cardHtml).join('');

  const sponsorIntro = document.getElementById('sponsorIntro');
  if (sponsorIntro && DATA.sponsorIntro) sponsorIntro.innerHTML = cardHtml({ accent: 'split', title: DATA.sponsorIntro.title, body: DATA.sponsorIntro.body });
}

function renderSchedule() {
  const list = document.getElementById('scheduleList');
  const status = document.getElementById('scheduleStatus');
  if (!list) return;

  const now = new Date();
  const next = getNextMeet(now);
  const nextKey = next ? `${next.date}|${next.level}|${next.opponent}` : null;

  list.innerHTML = meetSchedule.map((event, index) => {
    const date = new Date(event.date);
    const eventKey = `${event.date}|${event.level}|${event.opponent}`;
    const isNext = nextKey === eventKey;
    const isPast = date.getTime() + 3 * 60 * 60 * 1000 < now.getTime();
    const accent = index % 2 === 0 ? 'greenAccent' : 'redAccent';
    const stateClass = isNext ? ' currentEvent' : isPast ? ' pastEvent' : '';
    const label = isNext ? '<div class="scheduleBadge">NEXT UP</div>' : '';
    return `<div class="scheduleItem ${accent}${stateClass}">
      <div class="scheduleDate"><strong>${formatDate(date)}</strong><span>${formatTime(date)}</span></div>
      <div class="scheduleInfo">${label}<h3>${escapeHtml(event.opponent)}</h3><p>${escapeHtml(event.level)} • ${escapeHtml(event.location)}</p></div>
    </div>`;
  }).join('');

  if (status && next) {
    const date = new Date(next.date);
    status.textContent = `Next meet: ${next.opponent} • ${formatDate(date)} at ${formatTime(date)}`;
  } else if (status) {
    status.textContent = 'The 2026 meet schedule is complete.';
  }
}

function renderSponsors() {
  const wall = document.getElementById('sponsorWall');
  if (!wall) return;
  const savedSponsors = JSON.parse(localStorage.getItem('whfSponsors') || '[]');
  const sponsors = [...initialSponsors, ...savedSponsors];
  wall.innerHTML = sponsors.length
    ? sponsors.map(s => `<div class="card green"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.note || 'Thank you for supporting WHF Swim & Dive.')}</p></div>`).join('')
    : `<div class="card green"><h3>Sponsors Coming Soon</h3><p>Community partners will be added here as sponsorships are finalized.</p></div>`;
}

function updateFund() {
  const raw = Number(document.getElementById('fundTotal').value || 0);
  const total = Math.max(0, Math.min(30000, raw));
  localStorage.setItem('whfFundTotal', String(total));
  renderFund();
}

function resetFund() {
  localStorage.removeItem('whfFundTotal');
  renderFund();
}

function renderFund() {
  const total = Number(localStorage.getItem('whfFundTotal') || 0);
  const pct = Math.max(0, Math.min(100, (total / 30000) * 100));
  const fill = document.getElementById('water');
  const text = document.getElementById('poolText');
  if (fill) fill.style.height = pct + '%';
  if (text) text.innerHTML = `$${total.toLocaleString()}<br><small>of $30,000</small>`;
}

function setupHomeTaps() {
  const todayPanel = document.getElementById('todayPanel');
  if (!todayPanel) return;
  todayPanel.addEventListener('click', () => showScreen('season'));
  todayPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showScreen('season');
    }
  });
}

function toInputDate(value) {
  if (!value) return '';
  return String(value).slice(0, 16);
}

function ctOffsetForInput(value) {
  const month = Number(String(value).slice(5, 7));
  return month >= 11 ? '-06:00' : '-05:00';
}

function field(name, value, placeholder = '', tag = 'input') {
  const safe = escapeHtml(value || '');
  if (tag === 'textarea') return `<textarea data-field="${name}" placeholder="${escapeHtml(placeholder)}">${safe}</textarea>`;
  return `<input data-field="${name}" value="${safe}" placeholder="${escapeHtml(placeholder)}">`;
}

function adminCardEditor(section, item, idx, fields) {
  const inputs = fields.map(f => {
    const value = f.type === 'datetime-local' ? toInputDate(item[f.key]) : (item[f.key] || '');
    if (f.type === 'textarea') return `<textarea data-section="${section}" data-index="${idx}" data-key="${f.key}" placeholder="${escapeHtml(f.label)}">${escapeHtml(value)}</textarea>`;
    return `<input data-section="${section}" data-index="${idx}" data-key="${f.key}" type="${f.type || 'text'}" value="${escapeHtml(value)}" placeholder="${escapeHtml(f.label)}">`;
  }).join('');
  return `<div class="adminEditItem"><div class="adminItemTitle">${escapeHtml(item.title || item.opponent || item.name || 'Item')}</div>${inputs}<button onclick="deleteAdminItem('${section}', ${idx})" class="ghost smallBtn">Delete</button></div>`;
}

function buildAdminForms() {
  const root = document.getElementById('adminSimpleEditor');
  if (!root) return;

  root.innerHTML = `
    <div class="card green adminPanel">
      <h3>Latest Update</h3>
      <input id="adminLatestTitle" value="${escapeHtml(DATA.latestUpdate?.title || '')}" placeholder="Title">
      <textarea id="adminLatestBody" placeholder="Details">${escapeHtml(DATA.latestUpdate?.body || '')}</textarea>
      <input id="adminLatestUpdated" value="${escapeHtml(DATA.latestUpdate?.updated || '')}" placeholder="Updated label">
    </div>

    <div class="card red adminPanel">
      <h3>Key Dates / Practice Info</h3>
      <div id="adminKeyDates">${(DATA.keyDates || []).map((item, i) => adminCardEditor('keyDates', item, i, [
        {key:'date', label:'Date/time', type:'datetime-local'},
        {key:'title', label:'Title'},
        {key:'label', label:'Home label'},
        {key:'meta', label:'Display date'},
        {key:'location', label:'Details', type:'textarea'}
      ])).join('')}</div>
      <button onclick="addAdminItem('keyDates')">Add Key Date</button>
    </div>

    <div class="card split adminPanel">
      <h3>Meet Schedule</h3>
      <div id="adminMeetSchedule">${(DATA.meetSchedule || []).map((item, i) => adminCardEditor('meetSchedule', item, i, [
        {key:'date', label:'Date/time', type:'datetime-local'},
        {key:'level', label:'Level'},
        {key:'opponent', label:'Opponent / event'},
        {key:'location', label:'Location'}
      ])).join('')}</div>
      <button onclick="addAdminItem('meetSchedule')">Add Meet</button>
    </div>

    <div class="card green adminPanel">
      <h3>Parent Hub Boxes</h3>
      <div id="adminParentCards">${(DATA.parentCards || []).map((item, i) => adminCardEditor('parentCards', item, i, [
        {key:'accent', label:'Accent: green, red, or split'},
        {key:'title', label:'Title'},
        {key:'body', label:'Body', type:'textarea'},
        {key:'linkText', label:'Button text'},
        {key:'linkUrl', label:'Button link'}
      ])).join('')}</div>
      <button onclick="addAdminItem('parentCards')">Add Parent Box</button>
    </div>

    <div class="card red adminPanel">
      <h3>Events Boxes</h3>
      <div id="adminEvents">${(DATA.events || []).map((item, i) => adminCardEditor('events', item, i, [
        {key:'accent', label:'Accent: green, red, or split'},
        {key:'title', label:'Title'},
        {key:'date', label:'Date label'},
        {key:'detail', label:'Details', type:'textarea'},
        {key:'linkText', label:'Button text'},
        {key:'linkUrl', label:'Button link'}
      ])).join('')}</div>
      <button onclick="addAdminItem('events')">Add Event Box</button>
    </div>

    <div class="card green adminPanel">
      <h3>Booster Boxes</h3>
      <div id="adminBoosterCards">${(DATA.boosterCards || []).map((item, i) => adminCardEditor('boosterCards', item, i, [
        {key:'accent', label:'Accent: green, red, or split'},
        {key:'title', label:'Title'},
        {key:'body', label:'Body', type:'textarea'}
      ])).join('')}</div>
      <button onclick="addAdminItem('boosterCards')">Add Booster Box</button>
    </div>

    <div class="card red adminPanel">
      <h3>Sponsors</h3>
      <input id="adminSponsorIntroTitle" value="${escapeHtml(DATA.sponsorIntro?.title || '')}" placeholder="Sponsor intro title">
      <textarea id="adminSponsorIntroBody" placeholder="Sponsor intro text">${escapeHtml(DATA.sponsorIntro?.body || '')}</textarea>
      <div id="adminSponsors">${(DATA.sponsors || []).map((item, i) => adminCardEditor('sponsors', item, i, [
        {key:'name', label:'Business name'},
        {key:'note', label:'Sponsor note / level'}
      ])).join('')}</div>
      <button onclick="addAdminItem('sponsors')">Add Sponsor</button>
    </div>
  `;
}

function getAdminFormData() {
  const next = JSON.parse(JSON.stringify(DATA));
  next.latestUpdate = {
    title: document.getElementById('adminLatestTitle')?.value.trim() || '',
    body: document.getElementById('adminLatestBody')?.value.trim() || '',
    updated: document.getElementById('adminLatestUpdated')?.value.trim() || ''
  };
  next.sponsorIntro = {
    title: document.getElementById('adminSponsorIntroTitle')?.value.trim() || '',
    body: document.getElementById('adminSponsorIntroBody')?.value.trim() || ''
  };

  document.querySelectorAll('[data-section][data-index][data-key]').forEach(el => {
    const section = el.dataset.section;
    const index = Number(el.dataset.index);
    const key = el.dataset.key;
    next[section] = next[section] || [];
    next[section][index] = next[section][index] || {};
    let value = el.value.trim();
    if ((section === 'meetSchedule' || section === 'keyDates') && key === 'date' && value) {
      value = value + ':00' + ctOffsetForInput(value);
    }
    next[section][index][key] = value;
  });

  next.meetSchedule = (next.meetSchedule || []).filter(x => x.opponent || x.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  next.keyDates = (next.keyDates || []).filter(x => x.title || x.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  ['parentCards','boosterCards','events','sponsors'].forEach(section => {
    next[section] = (next[section] || []).filter(x => x.title || x.name || x.body || x.detail);
  });
  return next;
}

function saveAdminPreview() {
  try {
    const next = getAdminFormData();
    applyDataObject(next);
    alert('Preview saved on this device. Review the app, then download the publish file when it looks right.');
  } catch (error) {
    alert('Could not save preview. Check for a missing required field.');
  }
}

function addAdminItem(section) {
  const next = getAdminFormData();
  next[section] = next[section] || [];
  const templates = {
    keyDates: { date: '', title: '', label: 'NEXT UP', meta: '', location: '' },
    meetSchedule: { date: '', level: 'Varsity', opponent: '', location: '' },
    parentCards: { accent: 'green', title: '', body: '', linkText: '', linkUrl: '' },
    events: { accent: 'green', title: '', date: '', detail: '', linkText: '', linkUrl: '' },
    boosterCards: { accent: 'green', title: '', body: '' },
    sponsors: { name: '', note: '' }
  };
  next[section].push(templates[section] || {});
  setRuntimeData(next);
  buildAdminForms();
}

function deleteAdminItem(section, index) {
  const next = getAdminFormData();
  next[section] = next[section] || [];
  next[section].splice(index, 1);
  setRuntimeData(next);
  buildAdminForms();
}

function applyDataObject(nextData) {
  setRuntimeData(nextData);
  localStorage.setItem('whfAdminDataPreview', JSON.stringify(DATA));
  refreshAppFromData();
}

function resetAdminPreview() {
  localStorage.removeItem('whfAdminDataPreview');
  setRuntimeData(window.WHF_DATA || {});
  refreshAppFromData();
  alert('Preview reset to the published data.js file.');
}

function downloadDataFile() {
  try {
    const nextData = getAdminFormData();
    const fileText = 'window.WHF_DATA = ' + JSON.stringify(nextData, null, 2) + ';\n';
    const blob = new Blob([fileText], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('Could not create data.js. Save your preview first and try again.');
  }
}

function refreshAppFromData() {
  renderTodayPanel();
  renderSchedule();
  renderPageCards();
  renderSponsors();
  renderFund();
  buildAdminForms();
}

renderTodayPanel();
renderSchedule();
renderPageCards();
renderSponsors();
renderFund();
setupHomeTaps();
buildAdminForms();
