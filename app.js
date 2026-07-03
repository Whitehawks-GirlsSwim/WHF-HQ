const screens = document.querySelectorAll('.screen');
const navButtons = document.querySelectorAll('.bottomNav button');
const DATA = window.WHF_DATA || {};
const meetSchedule = DATA.meetSchedule || [];
const keyDates = DATA.keyDates || [];
const initialSponsors = DATA.sponsors || [];

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const meetItems = meetSchedule.map(event => ({
    ...event,
    title: event.opponent,
    type: 'meet',
    label: 'NEXT MEET'
  }));

  const dateItems = keyDates.map(item => ({
    ...item,
    opponent: item.title,
    level: item.label || 'IMPORTANT DATE',
    type: 'keyDate'
  }));

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

function addSponsor() {
  const name = document.getElementById('sponsorName').value.trim();
  const note = document.getElementById('sponsorNote').value.trim();
  if (!name) return;
  const sponsors = JSON.parse(localStorage.getItem('whfSponsors') || '[]');
  sponsors.push({ name, note });
  localStorage.setItem('whfSponsors', JSON.stringify(sponsors));
  document.getElementById('sponsorName').value = '';
  document.getElementById('sponsorNote').value = '';
  renderSponsors();
}

function clearSponsors() {
  localStorage.removeItem('whfSponsors');
  renderSponsors();
}

function renderSponsors() {
  const wall = document.getElementById('sponsorWall');
  if (!wall) return;
  const savedSponsors = JSON.parse(localStorage.getItem('whfSponsors') || '[]');
  const sponsors = [...initialSponsors, ...savedSponsors];
  wall.innerHTML = sponsors.map(s => `<div class="card green"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.note || 'Thank you for supporting WHF Swim & Dive.')}</p></div>`).join('');
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

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
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

renderTodayPanel();
renderSchedule();
renderSponsors();
renderFund();
setupHomeTaps();
