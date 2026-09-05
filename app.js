const whfScreens = document.querySelectorAll('.screen');
const navButtons = document.querySelectorAll('.bottomNav button');

function normalizeMeetSchedule(items = []) {
  const unique = new Map();
  [...items].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(item => {
    const eventName = item.opponent || item.title || '';
    const varsityOnly = /true team|section|state/i.test(eventName);
    const normalized = { ...item, level: varsityOnly ? 'Varsity' : 'JV & Varsity' };
    const key = `${normalized.date}|${eventName.trim().toLowerCase()}|${String(normalized.location || '').trim().toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, normalized);
  });
  return [...unique.values()];
}

let DATA = loadAdminPreviewData();
let meetSchedule = normalizeMeetSchedule(DATA.meetSchedule || []);
DATA.meetSchedule = meetSchedule;
let keyDates = DATA.keyDates || [];
let divePracticeSchedule = DATA.divePracticeSchedule || [];
let initialSponsors = DATA.sponsors || [];
function loadSavedPhotoFeed() {
  try {
    const saved = JSON.parse(localStorage.getItem('whfApprovedPhotoFeed') || '[]');
    return Array.isArray(saved) ? saved.filter(item => item && item.status !== 'pending') : [];
  } catch (error) {
    return [];
  }
}

let approvedPhotoFeed = loadSavedPhotoFeed();
let approvedPhotoFeedInFlight = false;
let approvedPhotoFeedLoaded = approvedPhotoFeed.length > 0;
let photoViewerItems = [];
let activePhotoIndex = 0;
let photoSwipeStartX = null;
let pullRefreshStartX = null;
let pullRefreshStartY = null;
let pullRefreshDistance = 0;
let pullRefreshInFlight = false;
let pullRefreshCuePlayed = false;
let activeRecordGroup = 'girlsMoundWestonka';
let homeAlertItems = [];
let activeSheetLink = '';
let lastSheetTrigger = null;
const screenScrollPositions = new Map();
const screenOrder = ['home', 'volunteers', 'meets', 'practice', 'spirit', 'parents', 'program', 'photos'];
const APP_RELEASE_KEY = '20260903-72';
const LIVE_SYNC_INTERVAL_MS = 30 * 1000;
let appUpdateCheckInFlight = false;
let appReloadScheduled = false;

function reloadLatestApp() {
  if (appReloadScheduled) return;
  appReloadScheduled = true;
  const url = new URL(window.location.href);
  url.searchParams.set('appRefresh', Date.now().toString());
  window.location.replace(url.toString());
}

async function checkForAppUpdate() {
  if (appUpdateCheckInFlight || appReloadScheduled) return false;
  appUpdateCheckInFlight = true;

  try {
    const response = await fetch(`index.html?appCheck=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const html = await response.text();
    const liveRelease = html.match(/app\.js\?v=([^"'&\s<]+)/i)?.[1] || '';
    if (liveRelease && liveRelease !== APP_RELEASE_KEY) {
      showToast('Loading the latest WHF HQ update');
      reloadLatestApp();
      return true;
    }
  } catch (error) {
    console.warn('App version check will retry shortly.', error);
  } finally {
    appUpdateCheckInFlight = false;
  }

  return false;
}

function loadAdminPreviewData() {
  const published = window.WHF_DATA || {};
  const previewRequested = new URLSearchParams(window.location.search).get('adminPreview') === '1';
  if (!previewRequested) return published;
  try {
    const preview = localStorage.getItem('whfAdminDataPreview');
    if (!preview) return published;

    const parsed = JSON.parse(preview);
    const publishedSchedule = JSON.stringify([published.latestUpdate, published.keyDates, published.divePracticeSchedule, published.meetSchedule]);
    const previewSchedule = JSON.stringify([parsed.latestUpdate, parsed.keyDates, parsed.divePracticeSchedule, parsed.meetSchedule]);

    if (publishedSchedule !== previewSchedule) {
      localStorage.removeItem('whfAdminDataPreview');
      return published;
    }

    return parsed;
  } catch (error) {
    console.warn('Admin preview data could not be loaded. Falling back to data.js.', error);
    return published;
  }
}

function setRuntimeData(nextData) {
  DATA = nextData || {};
  meetSchedule = normalizeMeetSchedule(DATA.meetSchedule || []);
  DATA.meetSchedule = meetSchedule;
  keyDates = DATA.keyDates || [];
  divePracticeSchedule = DATA.divePracticeSchedule || [];
  initialSponsors = DATA.sponsors || [];
}

let publishedRefreshInFlight = false;

async function refreshPublishedData() {
  if (publishedRefreshInFlight || document.getElementById('admin')?.classList.contains('active')) return;
  publishedRefreshInFlight = true;

  try {
    const response = await fetch(`data.js?refresh=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;

    const fileText = await response.text();
    const jsonText = fileText
      .replace(/^\s*window\.WHF_DATA\s*=\s*/, '')
      .replace(/;\s*$/, '');
    const fresh = JSON.parse(jsonText);

    if (JSON.stringify(fresh) !== JSON.stringify(DATA)) {
      localStorage.removeItem('whfAdminDataPreview');
      window.WHF_DATA = fresh;
      setRuntimeData(fresh);
      refreshAppFromData();
      updateNavBadges();
      showToast('Team information updated');
    }
  } catch (error) {
    console.warn('Published schedule refresh will retry later.', error);
  } finally {
    publishedRefreshInFlight = false;
  }
}

async function refreshApprovedPhotoFeed() {
  const feedUrl = String(DATA.photoFeedUrl || '').trim();
  if (!feedUrl || approvedPhotoFeedInFlight) return;
  approvedPhotoFeedInFlight = true;

  try {
    const separator = feedUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${feedUrl}${separator}refresh=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;

    const payload = await response.json();
    if (!Array.isArray(payload.photoLinks)) throw new Error('Photo feed returned an invalid response.');
    const fresh = payload.photoLinks.filter(item => item && item.status !== 'pending');
    approvedPhotoFeedLoaded = true;
    localStorage.setItem('whfApprovedPhotoFeed', JSON.stringify(fresh));

    if (JSON.stringify(fresh) !== JSON.stringify(approvedPhotoFeed)) {
      approvedPhotoFeed = fresh;
      renderProgram();
    }
  } catch (error) {
    console.warn('Approved photo feed will retry later.', error);
  } finally {
    approvedPhotoFeedInFlight = false;
  }
}

function showScreen(id) {
  const current = document.querySelector('.screen.active');
  if (current?.id === id) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    markScreenSeen(id);
    return;
  }
  if (current) screenScrollPositions.set(current.id, window.scrollY);
  const fromIndex = screenOrder.indexOf(current?.id || 'home');
  const toIndex = screenOrder.indexOf(id);
  document.documentElement.dataset.navDirection = toIndex >= fromIndex ? 'forward' : 'back';

  const commit = () => {
    whfScreens.forEach(screen => screen.classList.toggle('active', screen.id === id));
    const navScreen = id === 'volunteers' ? 'home' : id;
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === navScreen));
    updateNavIndicator();
    markScreenSeen(id);
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reducedMotion) document.startViewTransition(commit);
  else commit();

  requestAnimationFrame(() => window.scrollTo({ top: screenScrollPositions.get(id) || 0, behavior: 'auto' }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function showToast(message) {
  const toast = document.getElementById('appToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function openDetailSheet({ eyebrow = 'DETAILS', title = '', body = '', meta = '', location = '', linkText = '', linkUrl = '' }, trigger) {
  const sheet = document.getElementById('detailSheet');
  if (!sheet) return;
  lastSheetTrigger = trigger || document.activeElement;
  activeSheetLink = linkUrl;
  document.getElementById('sheetEyebrow').textContent = eyebrow;
  document.getElementById('sheetTitle').textContent = title;
  document.getElementById('sheetBody').textContent = body;
  document.getElementById('sheetMeta').textContent = meta;
  document.getElementById('sheetMeta').hidden = !meta;
  document.getElementById('sheetLocation').textContent = location;
  document.getElementById('sheetLocation').hidden = !location;
  const action = document.getElementById('sheetAction');
  action.textContent = linkText || 'Open Link';
  action.href = linkUrl || '#';
  action.hidden = !linkUrl;
  document.querySelector('.sheetActions')?.toggleAttribute('hidden', !linkUrl);
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('sheetOpen');
  requestAnimationFrame(() => document.getElementById('sheetClose')?.focus());
}

function closeDetailSheet() {
  const sheet = document.getElementById('detailSheet');
  if (!sheet?.classList.contains('open')) return;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('sheetOpen');
  lastSheetTrigger?.focus?.();
}

function updatePhotoViewer() {
  const image = document.getElementById('photoViewerImage');
  const counter = document.getElementById('photoViewerCounter');
  const imageUrl = photoViewerItems[activePhotoIndex];
  if (!image || !imageUrl) return;
  image.src = imageUrl;
  if (counter) counter.textContent = `${activePhotoIndex + 1} / ${photoViewerItems.length}`;
}

function openPhotoViewer(index = 0) {
  const viewer = document.getElementById('photoViewer');
  if (!viewer || !photoViewerItems.length) return;
  activePhotoIndex = Math.max(0, Math.min(photoViewerItems.length - 1, Number(index) || 0));
  updatePhotoViewer();
  viewer.classList.add('open');
  viewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('photoViewerOpen');
  requestAnimationFrame(() => viewer.querySelector('.photoViewerClose')?.focus());
}

function stepPhotoViewer(direction) {
  if (!photoViewerItems.length) return;
  activePhotoIndex = (activePhotoIndex + direction + photoViewerItems.length) % photoViewerItems.length;
  updatePhotoViewer();
}

function closePhotoViewer() {
  const viewer = document.getElementById('photoViewer');
  const image = document.getElementById('photoViewerImage');
  if (!viewer) return;
  viewer.classList.remove('open');
  viewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('photoViewerOpen');
  if (image) image.src = '';
}

async function copySheetLink() {
  if (!activeSheetLink) return;
  try {
    await navigator.clipboard.writeText(activeSheetLink);
    showToast('Link copied');
  } catch (error) {
    showToast('Copy unavailable on this device');
  }
}

function isCurrentOrFuturePractice(item) {
  const now = new Date();
  const practiceDate = new Date(item.date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return !Number.isNaN(practiceDate.getTime()) && practiceDate >= today;
}

function getScheduleForSheet(kind) {
  const source = kind === 'dive'
    ? divePracticeSchedule.filter(isCurrentOrFuturePractice)
    : kind === 'practice'
      ? keyDates.filter(item => String(item.label || '').toUpperCase() === 'PRACTICE').filter(isCurrentOrFuturePractice)
      : meetSchedule;
  return [...source].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function openScheduleSheet(kind, index, trigger) {
  const event = getScheduleForSheet(kind)[index];
  if (!event) return;
  const date = new Date(event.date);
  const isPractice = kind === 'practice' || kind === 'dive';
  const title = event.title || event.opponent || (kind === 'dive' ? 'Dive Practice' : kind === 'practice' ? 'Swim Practice' : 'Meet');
  const practiceDetails = event.location || 'Practice details coming soon';
  const location = isPractice ? '' : (event.location || 'Location details coming soon');
  const directionsUrl = !isPractice && location && !/coming soon/i.test(location)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : '';
  openDetailSheet({
    eyebrow: kind === 'dive' ? 'DIVE PRACTICE' : isPractice ? 'SWIM PRACTICE' : `${event.level || 'MEET'} DETAILS`,
    title,
    body: isPractice ? practiceDetails : `Meet information for ${event.opponent || title}.`,
    meta: `${event.displayDate || formatDate(date)} • ${event.displayTime || formatTime(date)}`,
    location,
    linkText: directionsUrl ? 'Get Directions' : '',
    linkUrl: directionsUrl
  }, trigger);
}

function openHomeAlertSheet(index, trigger) {
  const item = homeAlertItems[index];
  if (!item) return;
  openDetailSheet({
    eyebrow: item.eyebrow,
    title: item.title,
    body: item.body,
    linkText: item.linkText,
    linkUrl: item.linkUrl
  }, trigger);
}

function contentKeyForScreen(id) {
  const content = id === 'meets'
    ? meetSchedule
    : id === 'practice'
      ? { swim: keyDates, dive: divePracticeSchedule }
      : id === 'volunteers'
        ? DATA.volunteerCards
        : id === 'parents'
          ? { cards: DATA.parentCards, socialLinks: DATA.socialLinks, teamContacts: DATA.teamContacts }
          : null;
  if (!content) return '';
  let hash = 0;
  const text = JSON.stringify(content);
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return String(hash);
}

function updateNavBadges() {
  ['meets', 'practice', 'volunteers', 'parents'].forEach(id => {
    const key = contentKeyForScreen(id);
    const storageKey = `whfSeen-${id}`;
    const seen = localStorage.getItem(storageKey);
    if (seen === null) localStorage.setItem(storageKey, key);
    const button = document.querySelector(`.bottomNav button[data-screen="${id}"]`);
    button?.classList.toggle('hasUpdate', seen !== null && seen !== key);
  });

  const homeButton = document.querySelector('.bottomNav button[data-screen="home"]');
  const seenRelease = localStorage.getItem('whfSeen-appRelease');
  homeButton?.classList.toggle('hasUpdate', seenRelease !== APP_RELEASE_KEY);
}

function markScreenSeen(id) {
  if (id === 'home') {
    localStorage.setItem('whfSeen-appRelease', APP_RELEASE_KEY);
    document.querySelector('.bottomNav button[data-screen="home"]')?.classList.remove('hasUpdate');
    return;
  }

  const key = contentKeyForScreen(id);
  if (!key) return;
  localStorage.setItem(`whfSeen-${id}`, key);
  document.querySelector(`.bottomNav button[data-screen="${id}"]`)?.classList.remove('hasUpdate');
}

function updateNavIndicator() {
  const indicator = document.getElementById('navIndicator');
  const active = document.querySelector('.bottomNav button.active');
  if (!indicator || !active) return;
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
  const nav = active.closest('.bottomNav');
  if (nav && nav.scrollWidth > nav.clientWidth) {
    const centeredLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, centeredLeft), behavior: 'smooth' });
  }
}

function updateConnectionState() {
  const banner = document.getElementById('connectionBanner');
  if (!banner) return;
  banner.textContent = navigator.onLine ? 'Back online — checking for updates…' : 'You are offline — viewing the latest saved information.';
  banner.classList.toggle('show', !navigator.onLine);
  banner.classList.toggle('online', navigator.onLine);
  if (navigator.onLine) {
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 1800);
    refreshPublishedData();
  }
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

function eventDayEnd(item) {
  const end = new Date(item.date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function isPastScheduleItem(item, now = new Date()) {
  return eventDayEnd(item).getTime() < now.getTime();
}

function getNextSeasonItem(now = new Date()) {
  return getSeasonItems().find(item => !isPastScheduleItem(item, now)) || null;
}

function getNextMeet(now = new Date()) {
  const sorted = [...meetSchedule].sort((a, b) => new Date(a.date) - new Date(b.date));
  return sorted.find(event => !isPastScheduleItem(event, now)) || null;
}

function renderTodayPanel() {
  const now = new Date();
  const next = getNextSeasonItem(now);
  const kicker = document.getElementById('todayKicker');
  const main = document.getElementById('todayMain');
  const meta = document.getElementById('todayMeta');
  const location = document.getElementById('todayLocation');
  const button = document.getElementById('todayButton');
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
    if (button) button.textContent = 'Open Practice';
  } else {
    meta.textContent = `${next.level} • ${formatDate(date)} • ${formatTime(date)}`;
    location.textContent = next.location;
    if (button) button.textContent = 'Open Meet Details';
  }
}

function renderHomeAlerts() {
  const host = document.getElementById('homeAlerts');
  if (!host) return;
  const parentCards = DATA.parentCards || [];
  const registration = parentCards.find(item => /registration/i.test(item.title || ''));
  const storeCard = parentCards.find(item => /team store/i.test(item.title || ''));
  const store = DATA.teamStore || {};
  const alerts = [];
  const storeDeadline = new Date(store.deadline || '2026-10-16T00:00:00-05:00');
  const seniorNightMeet = meetSchedule.find(item =>
    /senior night|pack the pool/i.test(item.opponent || item.title || '')
  );
  const seniorNightDeadline = seniorNightMeet ? new Date(seniorNightMeet.date) : null;
  if (seniorNightDeadline) seniorNightDeadline.setHours(23, 59, 59, 999);

  if (store.url && new Date() < storeDeadline) {
    alerts.push({
      accent: 'red',
      eyebrow: 'TEAM STORE OPEN',
      title: 'WHF spirit wear is available',
      body: `Order from ${store.vendor || 'the team store'} through ${store.deadlineLabel || 'mid-October'}.`,
      linkText: storeCard?.linkText || 'Shop Team Store',
      linkUrl: store.url
    });
  }

  if (seniorNightMeet && new Date() <= seniorNightDeadline) {
    const seniorDate = new Date(seniorNightMeet.date);
    const seniorDateText = seniorNightMeet.displayDate || formatDate(seniorDate);
    const seniorTimeText = seniorNightMeet.displayTime || formatTime(seniorDate);
    alerts.push({
      accent: 'green',
      eyebrow: 'SENIOR NIGHT • PACK THE POOL',
      title: 'WHF vs. Orono',
      body: `${seniorDateText} at ${seniorTimeText} at ${seniorNightMeet.location}. Fill the stands and help us celebrate our seniors!`,
      linkText: '',
      linkUrl: ''
    });
  }

  if (registration?.linkUrl) {
    alerts.push({
      accent: 'green',
      eyebrow: 'ACTION NEEDED',
      title: registration.title || 'Registration Open',
      body: 'Complete athlete registration before the season begins and confirm a current sports physical is on file.',
      linkText: registration.linkText || 'Register Athlete',
      linkUrl: registration.linkUrl
    });
  }

  homeAlertItems = alerts;
  host.innerHTML = alerts.length ? `<div class="homeAlertsLabel">Important Dates</div><div class="homeAlertGrid">${alerts.map((item, index) => `<button type="button" class="homeAlert ${item.accent}" onclick="openHomeAlertSheet(${index},this)"><div><span>${escapeHtml(item.eyebrow)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div><b>View Details</b></button>`).join('')}</div>` : '';
}

function latestUpdateKey(item = DATA.latestUpdate || {}) {
  return [item.updated, item.title, item.body].map(value => String(value || '').trim()).join('|');
}

function renderLatestUpdate() {
  const host = document.getElementById('latestUpdate');
  if (!host) return;
  const item = DATA.latestUpdate || {};
  const key = latestUpdateKey(item);
  if (!key.replace(/\|/g, '')) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  const seen = localStorage.getItem('whfSeen-latestUpdate') === key;
  host.hidden = false;
  host.innerHTML = `<button type="button" class="latestUpdateCard${seen ? '' : ' isNew'}" onclick="openLatestUpdate(this)">
    <span class="latestUpdateTop"><b class="latestUpdateBadge"${seen ? ' hidden' : ''}>NEW</b><time>${escapeHtml(item.updated || 'Recently updated')}</time></span>
    <strong>${escapeHtml(item.title || 'WHF HQ update')}</strong>
    <span class="latestUpdateBody">${escapeHtml(item.summary || item.body || 'New team information is available.')}</span>
    <span class="latestUpdateAction">${escapeHtml(item.actionText || 'See what changed')} <i aria-hidden="true">›</i></span>
  </button>`;
}

function openLatestUpdate(trigger) {
  const item = DATA.latestUpdate || {};
  const key = latestUpdateKey(item);
  if (!key.replace(/\|/g, '')) return;
  localStorage.setItem('whfSeen-latestUpdate', key);
  trigger?.classList.remove('isNew');
  trigger?.querySelector('.latestUpdateBadge')?.setAttribute('hidden', '');
  if (item.targetAction === 'teamAlerts') {
    showScreen('home');
    const alertsCard = document.getElementById('teamAlertsCard');
    alertsCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alertsCard?.focus({ preventScroll: true });
    alertsCard?.animate([
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(1.035)', filter: 'brightness(1.35)' },
      { transform: 'scale(1)', filter: 'brightness(1)' }
    ], { duration: 900, easing: 'ease-out' });
    return;
  }
  if (item.linkUrl) {
    window.location.href = item.linkUrl;
    return;
  }
  if (item.targetScreen) {
    showScreen(item.targetScreen);
    return;
  }
  openDetailSheet({
    eyebrow: 'WHAT\'S NEW',
    title: item.title || 'WHF HQ update',
    body: item.body || 'New team information is available.',
    meta: [item.updated ? `Published ${item.updated}` : '', item.author ? `By ${item.author}` : ''].filter(Boolean).join(' • ')
  }, trigger);
}

function cardHtml(item, idx = 0) {
  const accent = item.accent || (idx % 2 === 0 ? 'green' : 'red');
  const cls = accent === 'split' ? 'split' : accent === 'red' ? 'red' : 'green';
  const isPast = item.pastAfter ? new Date(item.pastAfter).getTime() < Date.now() : false;
  const pastClass = isPast ? ' pastCard' : '';
  const pastBadge = isPast ? '<span class="cardStatus">COMPLETED</span>' : '';
  const detail = item.body || item.detail || '';
  const date = item.date ? `<p><b>${escapeHtml(item.date)}</b></p>` : '';
  let link = '';
  if (item.targetScreen) {
    link = `<button class="inlineLink" onclick="showScreen('${escapeHtml(item.targetScreen)}')">${escapeHtml(item.linkText || 'Open')}</button>`;
  } else if (item.linkUrl) {
    link = `<a class="link" href="${escapeHtml(item.linkUrl)}" target="_blank" rel="noopener" data-toast="Opening link…">${escapeHtml(item.linkText || 'View Details')}</a>`;
  }
  return `<div class="card ${cls}${pastClass}">${pastBadge}<h3>${escapeHtml(item.title || item.name || 'Untitled')}</h3>${date}<p>${escapeHtml(detail)}</p>${link}</div>`;
}

function renderPageCards() {
  const parent = document.getElementById('parentCards');
  if (parent) parent.innerHTML = (DATA.parentCards || []).map(cardHtml).join('');

  const booster = document.getElementById('boosterCards');
  if (booster) booster.innerHTML = (DATA.boosterCards || []).map(cardHtml).join('');

  const volunteers = document.getElementById('volunteerCards');
  if (volunteers) volunteers.innerHTML = (DATA.volunteerCards || []).map(cardHtml).join('');

  const events = document.getElementById('eventsList');
  if (events) {
    const items = DATA.events || [];
    const upcoming = items.filter(item => item.status !== 'completed');
    const completed = items.filter(item => item.status === 'completed');
    const completedMeetings = completed.filter(item => /meeting/i.test(item.title || ''));
    const completedFundraisers = completed.filter(item => !/meeting/i.test(item.title || ''));
    const group = (title, list) => list.length ? `<section class="eventGroup"><div class="sectionLabel">${title}</div>${list.map((item, index) => {
      const result = item.result ? `<div class="eventResult">${escapeHtml(item.result)}</div>` : '';
      return `<div class="eventCard ${item.status === 'completed' ? 'completedEvent' : 'upcomingEvent'}">${result}${cardHtml(item, index)}</div>`;
    }).join('')}</section>` : '';
    events.innerHTML = group('Upcoming', upcoming)
      + group('Completed Meetings', completedMeetings)
      + group('Completed Fundraisers', completedFundraisers);
  }

  const sponsorIntro = document.getElementById('sponsorIntro');
  if (sponsorIntro && DATA.sponsorIntro) {
    const raised = Number(DATA.sponsorIntro.raised || 0);
    const goal = Number(DATA.sponsorIntro.goal || 30000);
    const progress = goal ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    sponsorIntro.innerHTML = `<div class="sponsorProgressCard"><span class="sectionLabel">Timing Equipment Campaign</span><h2>${escapeHtml(DATA.sponsorIntro.title)}</h2><p>${escapeHtml(DATA.sponsorIntro.body)}</p><div class="sponsorProgress"><i style="width:${progress}%"></i></div><div class="sponsorProgressMeta"><strong>${progress}% funded</strong><span>Goal: $${goal.toLocaleString()}</span></div></div>`;
  }
}

function renderSocialLinks() {
  const host = document.getElementById('socialSection');
  if (!host) return;
  const links = (DATA.socialLinks || []).filter(item => item?.url);
  if (!links.length) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }

  host.hidden = false;
  host.innerHTML = `<div class="sectionLabel">Social Media</div><div class="socialGrid">${links.map(item => {
    const platform = item.platform || 'Social Media';
    const isInstagram = /instagram/i.test(platform);
    const isFacebook = /facebook/i.test(platform);
    const icon = isInstagram
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.4" cy="6.6" r="1"></circle></svg>`
      : isFacebook
        ? `<b class="facebookGlyph" aria-hidden="true">f</b>`
        : `<b aria-hidden="true">${escapeHtml(platform.slice(0, 2).toUpperCase())}</b>`;
    return `<a class="socialCard${isInstagram ? ' instagram' : isFacebook ? ' facebook' : ''}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-toast="Opening ${escapeHtml(platform)}…">
      <span class="socialIcon">${icon}</span>
      <span class="socialCopy"><strong>${escapeHtml(platform)}</strong><small>${escapeHtml(item.handle || '')}</small><em>${escapeHtml(item.body || 'Follow WHF Girls Swim & Dive.')}</em></span>
      <span class="socialAction">Follow <i aria-hidden="true">›</i></span>
    </a>`;
  }).join('')}</div>`;
}

function renderTeamContacts() {
  const host = document.getElementById('contactSection');
  if (!host) return;
  const contacts = (DATA.teamContacts || []).filter(item => item?.name && (item?.phone || item?.email));
  if (!contacts.length) {
    host.innerHTML = '';
    host.hidden = true;
    return;
  }

  host.hidden = false;
  host.innerHTML = `<div class="sectionLabel">Team Contacts</div><div class="contactGrid">${contacts.map((item, index) => {
    const phoneDigits = String(item.phone || '').replace(/[^0-9+]/g, '');
    const email = String(item.email || '').trim();
    const actions = [
      phoneDigits ? `<a href="tel:${escapeHtml(phoneDigits)}" data-toast="Calling ${escapeHtml(item.name)}...">Call</a>` : '',
      email ? `<a href="mailto:${escapeHtml(email)}" data-toast="Opening email...">Email</a>` : ''
    ].join('');
    return `<article class="contactCard ${index % 2 === 0 ? 'red' : 'green'}">
      <div class="contactIdentity"><span class="contactInitials" aria-hidden="true">${escapeHtml(item.name.split(/\s+/).map(part => part[0] || '').slice(0, 2).join('').toUpperCase())}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.role || '')}</small></div></div>
      <div class="contactDetails">${item.phone ? `<a href="tel:${escapeHtml(phoneDigits)}">${escapeHtml(item.phone)}</a>` : ''}${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : ''}</div>
      <div class="contactActions">${actions}</div>
    </article>`;
  }).join('')}</div>`;
}

function renderCombinedScheduleLegacy() {
  const list = document.getElementById('scheduleList');
  const status = document.getElementById('scheduleStatus');
  if (!list) return;

  const now = new Date();
  const seasonItems = getSeasonItems();
  const next = getNextSeasonItem(now);
  const itemKey = item => `${item.date}|${item.type}|${item.title || item.opponent}`;
  const nextKey = next ? itemKey(next) : null;

  list.innerHTML = seasonItems.map((event, index) => {
    const date = new Date(event.date);
    const isNext = nextKey === itemKey(event);
    const isPast = isPastScheduleItem(event, now);
    const accent = index % 2 === 0 ? 'greenAccent' : 'redAccent';
    const stateClass = isNext ? ' currentEvent' : isPast ? ' pastEvent' : '';
    const badge = isNext ? '<div class="scheduleBadge">NEXT UP</div>' : isPast ? '<div class="scheduleBadge completedBadge">COMPLETED</div>' : '';
    const title = event.title || event.opponent;
    const detail = event.type === 'keyDate'
      ? `${event.label || 'IMPORTANT DATE'} • ${event.location || 'Details coming soon'}`
      : `${event.level} • ${event.location}`;

    return `<div class="scheduleItem ${accent}${stateClass}">
      <div class="scheduleDate"><strong>${formatDate(date)}</strong><span>${formatTime(date)}</span></div>
      <div class="scheduleInfo">${badge}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>
    </div>`;
  }).join('');

  if (status && next) {
    const date = new Date(next.date);
    status.textContent = `Next event: ${next.title || next.opponent} • ${formatDate(date)} at ${formatTime(date)}`;
  } else if (status) {
    status.textContent = 'The 2026 season schedule is complete.';
  }
}

function renderSeparatedScheduleList(listId, statusId, scheduleItems, kind) {
  const list = document.getElementById(listId);
  const status = document.getElementById(statusId);
  if (!list) return;
  const now = new Date();
  const sorted = [...scheduleItems].sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = sorted.find(item => !isPastScheduleItem(item, now)) || null;
  const nextKey = next ? `${next.date}|${next.title || next.opponent}` : '';
  const practiceKind = kind === 'practice' || kind === 'dive';
  const kindLabel = kind === 'dive' ? 'dive practice' : kind === 'practice' ? 'swim practice' : 'meet';

  list.innerHTML = sorted.map((event, index) => {
    const date = new Date(event.date);
    const isNext = nextKey === `${event.date}|${event.title || event.opponent}`;
    const isPast = isPastScheduleItem(event, now);
    const stateClass = isNext ? ' currentEvent' : isPast ? ' pastEvent' : '';
    const badge = isNext ? `<div class="scheduleBadge">NEXT ${kindLabel.toUpperCase()}</div>` : isPast ? '<div class="scheduleBadge completedBadge">COMPLETED</div>' : '';
    const title = event.title || event.opponent;
    const detail = practiceKind
      ? (event.location || 'Practice details coming soon')
      : `${event.level} • ${event.location}`;
    const accent = kind === 'dive' ? 'diveAccent' : kind === 'practice' ? 'swimAccent' : (index % 2 === 0 ? 'greenAccent' : 'redAccent');
    return `<button type="button" class="scheduleItem detailTrigger ${accent}${stateClass}" onclick="openScheduleSheet('${kind}',${index},this)">
      <div class="scheduleDate"><strong>${escapeHtml(event.displayDate || formatDate(date))}</strong><span>${escapeHtml(event.displayTime || formatTime(date))}</span></div>
      <div class="scheduleInfo">${badge}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>
      <span class="detailChevron" aria-hidden="true">›</span>
    </button>`;
  }).join('');

  if (status && next) {
    const date = new Date(next.date);
    status.textContent = `Next ${kindLabel}: ${next.title || next.opponent} • ${eventDateLabel(next, date)}`;
  } else if (status) {
    status.textContent = `The 2026 ${kindLabel} schedule is complete.`;
  }
}

function eventDateLabel(event, date) {
  return `${event.displayDate || formatDate(date)} • ${event.displayTime || formatTime(date)}`;
}



function getWeeklyEmailRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function weeklyEmailRangeLabel(start, end) {
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'long', day: 'numeric' });
  return `${startLabel}–${endLabel}`;
}

function cleanVolunteerNeed(value = '') {
  const text = String(value).trim().replace(/\.$/, '');
  const expanded = /^both$/i.test(text) ? 'beverages/fruit and a main breakfast item' : text;
  return expanded.charAt(0).toUpperCase() + expanded.slice(1);
}

function splitVolunteerNeedItems(value = '') {
  return cleanVolunteerNeed(value)
    .split(/,\s*(?:and\s+)?|\s+and\s+/i)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.charAt(0).toUpperCase() + item.slice(1));
}

function formatVolunteerNeeds(detail = '') {
  let text = String(detail).trim();
  let updated = '';
  const prefix = text.match(/^Open as of ([^:]+):\s*/i);
  if (prefix) {
    updated = prefix[1];
    text = text.slice(prefix[0].length);
  }

  const entries = [];
  text.split(';').map(item => item.trim()).filter(Boolean).forEach(item => {
    const clause = item.replace(/\.$/, '');
    const paired = clause.match(/^([A-Za-z]+ \d+) and ([A-Za-z]+ \d+) each need (.+)$/i);
    if (paired) {
      entries.push({ date: paired[1], needs: splitVolunteerNeedItems(paired[3]) });
      entries.push({ date: paired[2], needs: splitVolunteerNeedItems(paired[3]) });
      return;
    }

    const dated = clause.match(/^([A-Za-z]+ \d+) needs? (.+)$/i);
    if (dated) {
      entries.push({ date: dated[1], needs: splitVolunteerNeedItems(dated[2]) });
      return;
    }

    entries.push({ date: '', needs: [clause] });
  });

  return { updated, entries };
}

function buildWeeklyEmailDraft(now = new Date()) {
  const { start, end } = getWeeklyEmailRange(now);
  const rangeLabel = weeklyEmailRangeLabel(start, end);
  const weekly = DATA.weeklyUpdate || {};
  const activeEvents = (DATA.events || []).filter(item =>
    item.status !== 'completed' &&
    item.title !== weekly.title &&
    !/^TBD$/i.test(String(item.date || '').trim()) &&
    !/waiting on confirmation/i.test(item.detail || item.body || '')
  );
  const volunteerNeeds = (DATA.volunteerCards || []).filter(item => item.status !== 'completed');
  const boosterContact = (DATA.teamContacts || []).find(item => /booster president/i.test(item.role || '')) || {};
  const cleanAppUrl = window.location.origin + window.location.pathname;
  const nextMeet = getNextMeet(now);
  const firstScheduledMeet = [...meetSchedule].sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  const isSeasonOpener = Boolean(nextMeet && firstScheduledMeet && nextMeet.date === firstScheduledMeet.date);
  const sections = [
    'Hello everyone,',
    '',
    'I hope you’re all doing well!',
    '',
    'I wanted to share a few important WHF Girls Swim & Dive reminders and Booster Club updates.',
    '',
    '---',
    '',
    '📣 ' + (weekly.title || 'Booster Club Update'),
    '',
    weekly.body || 'Visit WHF-HQ for the latest Booster Club information.',
    ''
  ];

  if (nextMeet) {
    const meetDate = new Date(nextMeet.date);
    const meetDay = meetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const meetTime = nextMeet.displayTime || meetDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const meetName = nextMeet.opponent || nextMeet.title || 'Upcoming Meet';

    sections.push(
      '---',
      '',
      (isSeasonOpener ? '🏊 First Meet of the Season – ' : '🏊 Next Meet – ') + meetName,
      ''
    );

    if (isSeasonOpener) {
      sections.push(
        'The 2026 season officially kicks off this Saturday at the Tim Daly Invitational!',
        '',
        'Let’s fill the stands, bring the energy, and cheer on our swimmers and divers as they begin another exciting WHF season.',
        ''
      );
    }

    sections.push(
      'Date: ' + meetDay,
      'Time: ' + meetTime,
      'Teams: ' + (nextMeet.level || 'JV & Varsity'),
      'Location: ' + (nextMeet.location || 'Location details coming soon'),
      ''
    );

    if (isSeasonOpener) sections.push('Let’s go White Hawks!', '');
  }

  activeEvents.forEach(item => {
    const eventIcon = /crumbl/i.test(item.title || '') ? '🍪' : /culver/i.test(item.title || '') ? '🍔' : '📅';
    sections.push(
      '---',
      '',
      eventIcon + ' ' + item.title,
      ''
    );
    if (item.date) sections.push(item.date, '');
    if (item.detail || item.body) sections.push(item.detail || item.body, '');
    if (item.linkUrl) sections.push(item.linkUrl, '');
  });

  sections.push(
    '---',
    '',
    '🙋 Volunteer Sign-Ups',
    '',
    'Our home meets and Saturday breakfasts depend on parent volunteers. Please review the open needs below and sign up for any spots that work for your family.',
    ''
  );

  if (volunteerNeeds.length) {
    volunteerNeeds.forEach(item => {
      const formatted = formatVolunteerNeeds(item.detail || item.body || '');
      const icon = /breakfast/i.test(item.title || '') ? '🥞' : /meet/i.test(item.title || '') ? '⏱️' : '✅';
      sections.push(icon + ' ' + item.title, '');
      if (formatted.updated) sections.push('Open spots as of ' + formatted.updated + ':', '');

      formatted.entries.forEach(entry => {
        if (entry.date) sections.push('• ' + entry.date);
        entry.needs.forEach(need => sections.push('  - ' + need));
        sections.push('');
      });

      if (item.linkUrl) sections.push(item.linkUrl, '');
    });
  } else {
    sections.push('There are no open volunteer needs currently listed.', '');
  }

  sections.push(
    'Thank you to everyone who has already signed up. We truly appreciate your help!',
    '',
    '---',
    '',
    '📱 WHF-HQ',
    '',
    'All of the information and links included in this email are also available in WHF-HQ for easy access throughout the season.',
    '',
    cleanAppUrl,
    '',
    '---',
    '',
    'Thank you again for all of your support. As always, please reach out with any questions!',
    '',
    'Go White Hawks!',
    '',
    '--',
    '',
    boosterContact.name || 'Bob Dongoske',
    '',
    boosterContact.role || 'Booster President',
    'Westonka Holy Family Girls Swim & Dive',
    '',
    boosterContact.email || 'mwhfswimdivegirls@gmail.com',
    boosterContact.phone || '952-261-2807'
  );

  return {
    subject: isSeasonOpener
      ? 'WHF Girls Swim & Dive — First Meet of the Season This Saturday!'
      : 'WHF Girls Swim & Dive Booster Update — ' + rangeLabel,
    body: sections.join('\n')
  };
}

function emailWeeklyUpdate() {
  const draft = buildWeeklyEmailDraft();
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  showToast('Opening your Gmail draft…');
  window.location.assign(gmailUrl);
}

function renderSchedule() {
  const meets = meetSchedule.map(event => ({ ...event, title: event.opponent, type: 'meet' }));
  const practices = keyDates
    .filter(item => String(item.label || '').toUpperCase() === 'PRACTICE')
    .filter(isCurrentOrFuturePractice)
    .map(item => ({ ...item, opponent: item.title, type: 'practice' }));
  const dives = divePracticeSchedule
    .filter(isCurrentOrFuturePractice)
    .map(item => ({ ...item, opponent: item.title, type: 'dive' }));
  renderSeparatedScheduleList('meetScheduleList', 'meetScheduleStatus', meets, 'meet');
  renderSeparatedScheduleList('practiceScheduleList', 'practiceScheduleStatus', practices, 'practice');
  renderSeparatedScheduleList('divePracticeScheduleList', 'divePracticeScheduleStatus', dives, 'dive');
}

function renderSponsors() {
  const wall = document.getElementById('sponsorWall');
  if (!wall) return;
  const savedSponsors = JSON.parse(localStorage.getItem('whfSponsors') || '[]');
  const sponsors = [...initialSponsors, ...savedSponsors];
  const amount = sponsor => Number(String(sponsor.note || '').replace(/[^0-9.]/g, '')) || 0;
  const level = sponsor => amount(sponsor) >= 5000 ? 'Presenting Partners' : amount(sponsor) >= 1500 ? 'Gold Partners' : amount(sponsor) >= 500 ? 'Silver Partners' : 'Community Partners';
  const levels = ['Presenting Partners', 'Gold Partners', 'Silver Partners', 'Community Partners'];
  wall.innerHTML = sponsors.length
    ? levels.map(title => {
      const group = sponsors.filter(sponsor => level(sponsor) === title);
      return group.length ? `<section class="sponsorTier"><div class="sectionLabel">${title}</div><div class="sponsorTierGrid">${group.map(s => `<div class="sponsorCard">${s.logo ? `<div class="sponsorLogo"><img src="${escapeHtml(s.logo)}" alt="${escapeHtml(s.name)} logo" loading="lazy"></div>` : '<div class="sponsorMark">WHF</div>'}<div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.note || 'Thank you for supporting WHF Swim & Dive.')}</p></div></div>`).join('')}</div></section>` : '';
    }).join('')
    : `<div class="card green"><h3>Sponsors Coming Soon</h3><p>Community partners will be added here as sponsorships are finalized.</p></div>`;
}

function setRecordGroup(group) {
  activeRecordGroup = group;
  document.querySelectorAll('.recordFilter button').forEach(button => button.classList.toggle('active', button.dataset.group === group));
  const shell = document.querySelector('.recordsTableShell');
  if (shell) shell.dataset.activeGroup = group;
}


function renderProgram() {
  const summary = DATA.programSummary || {};
  const record = DATA.seasonRecord || {};
  const headline = document.getElementById('programHeadline');
  const intro = document.getElementById('programIntroText');
  const recordValue = document.getElementById('seasonRecordValue');
  const recordNote = document.getElementById('seasonRecordNote');
  const statusValue = document.getElementById('programStatusValue');
  if (headline) headline.textContent = summary.headline || 'Team and Pool Records';
  if (intro) intro.textContent = summary.intro || 'Program history and honors live here.';
  if (recordValue) recordValue.textContent = record.value || 'Coming Soon';
  if (recordNote) recordNote.textContent = record.note || 'Update from Admin when results are available.';
  if (statusValue) statusValue.textContent = summary.status || (DATA.season?.label || '2026 Season');

  const records = document.getElementById('teamRecordsList');
  if (records) {
    const rows = DATA.teamRecords || [];
    records.innerHTML = rows.length ? `<div class="recordsTableHint">Choose a record group on phones. The complete table remains available on larger whfScreens.</div>
      <div class="recordFilter" role="group" aria-label="Choose record group">
        <button data-group="boysMoundWestonka" onclick="setRecordGroup('boysMoundWestonka')">Boys Westonka</button>
        <button class="active" data-group="girlsMoundWestonka" onclick="setRecordGroup('girlsMoundWestonka')">Girls Westonka</button>
        <button data-group="girlsHolyFamily" onclick="setRecordGroup('girlsHolyFamily')">Holy Family</button>
        <button data-group="girlsPool" onclick="setRecordGroup('girlsPool')">Pool</button>
      </div>
      <div class="recordsTableShell" data-active-group="${activeRecordGroup}" role="region" aria-label="White Hawk Swimming and Diving records" tabindex="0">
        <table class="recordsTable">
          <thead><tr>
            <th scope="col">Event</th>
            <th scope="col" data-record-group="boysMoundWestonka">Boys Mound Westonka School</th>
            <th scope="col" data-record-group="girlsMoundWestonka">Girls Mound Westonka School</th>
            <th scope="col" data-record-group="girlsHolyFamily">Girls Holy Family School</th>
            <th scope="col" data-record-group="girlsPool">Girls Pool</th>
          </tr></thead>
          <tbody>${rows.map(item => `<tr>
            <th scope="row">${escapeHtml(item.event || 'Event')}</th>
            <td data-record-group="boysMoundWestonka">${escapeHtml(item.boysMoundWestonka || '—')}</td>
            <td data-record-group="girlsMoundWestonka">${escapeHtml(item.girlsMoundWestonka || '—')}</td>
            <td data-record-group="girlsHolyFamily">${escapeHtml(item.girlsHolyFamily || '—')}</td>
            <td data-record-group="girlsPool">${escapeHtml(item.girlsPool || '—')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : `<div class="card green"><h3>Records Coming Soon</h3><p>Add team records from Admin.</p></div>`;
  }

  const photos = document.getElementById('photoLinksList');
  if (photos) {
    const photoMap = new Map();
    [...(DATA.photoLinks || []), ...approvedPhotoFeed]
      .filter(item => item && item.status !== 'pending')
      .forEach((item, index) => {
        const key = item.linkUrl || item.imageUrl || `${item.album || ''}|${item.title || ''}|${index}`;
        if (!photoMap.has(key)) photoMap.set(key, item);
      });
    const items = [...photoMap.values()];
    photoViewerItems = items.map(item => String(item.imageUrl || '').trim()).filter(Boolean);
    const albums = [...new Set(items.map(item => item.album || 'Team Highlights'))];
    const gallerySummary = document.getElementById('photoGallerySummary');
    const photosLoading = !approvedPhotoFeedLoaded && !items.length;
    if (gallerySummary) gallerySummary.textContent = items.length
      ? `${items.length} approved photo${items.length === 1 ? '' : 's'}`
      : photosLoading ? 'Loading approved photos…' : 'Approved team photos in one place.';
    photos.innerHTML = items.length ? albums.map(album => `<section class="photoAlbum"><div class="sectionLabel">${escapeHtml(album)}</div><div class="photoGallery">${items.filter(item => (item.album || 'Team Highlights') === album).map(item => {
      const imageUrl = escapeHtml(item.imageUrl || '');
      const photoIndex = photoViewerItems.indexOf(String(item.imageUrl || '').trim());
      const image = imageUrl ? `<div class="photoImage"><img src="${imageUrl}" alt="Team photo" loading="lazy"></div>` : `<div class="photoPlaceholder"><span>WHF</span></div>`;
      return imageUrl ? `<button class="photoGalleryCard" type="button" onclick="openPhotoViewer(${photoIndex})" aria-label="Open team photo">${image}</button>` : `<article class="photoGalleryCard">${image}</article>`;
    }).join('')}</div></section>`).join('') : photosLoading
      ? `<div class="photoApprovalNote"><strong>Loading approved photos</strong><span>Your last successful gallery stays saved on this device for future refreshes.</span></div>`
      : `<div class="photoApprovalNote"><strong>Approved photos will appear here</strong><span>Submissions stay private until the team approves them for an album.</span></div>`;
  }
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
  const openNextItem = () => {
    const next = getNextSeasonItem(new Date());
    showScreen(next?.type === 'meet' ? 'meets' : 'practice');
  };
  todayPanel.addEventListener('click', openNextItem);
  todayPanel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openNextItem();
    }
  });
}

function updatePullRefreshIndicator(distance = 0) {
  const indicator = document.getElementById('pullRefresh');
  const text = document.getElementById('pullRefreshText');
  if (!indicator || pullRefreshInFlight) return;
  const offset = Math.min(76, Math.max(0, distance));
  indicator.style.setProperty('--pull-distance', `${offset}px`);
  indicator.classList.toggle('visible', offset > 8);
  indicator.classList.toggle('ready', offset >= 58);
  if (text) text.textContent = offset >= 58 ? 'Release to refresh' : 'Pull to refresh';
}

let refreshAudioContext = null;

function unlockRefreshAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    refreshAudioContext = refreshAudioContext || new AudioContextClass();
    if (refreshAudioContext.state === 'suspended') {
      refreshAudioContext.resume().catch(() => {});
    }
  } catch (error) {
    console.warn('Refresh audio could not be unlocked.', error);
  }
}

function scheduleRefreshChime(context) {
  const now = context.currentTime + 0.02;
  [880, 1175].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * 0.085;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.18);
  });
}

function playRefreshSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      refreshAudioContext = refreshAudioContext || new AudioContextClass();
      if (refreshAudioContext.state === 'suspended') {
        refreshAudioContext.resume()
          .then(() => scheduleRefreshChime(refreshAudioContext))
          .catch(error => console.warn('Refresh sound could not start.', error));
      } else {
        scheduleRefreshChime(refreshAudioContext);
      }
    }
    navigator.vibrate?.([12, 35, 12]);
  } catch (error) {
    console.warn('Refresh sound is unavailable on this device.', error);
  }
}

async function performPullRefresh() {
  if (pullRefreshInFlight) return;
  if (!pullRefreshCuePlayed) playRefreshSound();
  const indicator = document.getElementById('pullRefresh');
  const text = document.getElementById('pullRefreshText');
  pullRefreshInFlight = true;
  indicator?.classList.add('visible', 'refreshing');
  indicator?.classList.remove('ready');
  indicator?.style.setProperty('--pull-distance', '68px');
  if (text) text.textContent = 'Loading latest WHF HQ';

  await Promise.allSettled([refreshPublishedData(), refreshApprovedPhotoFeed()]);
  showToast('Loading the latest WHF HQ update');
  setTimeout(reloadLatestApp, 300);
}

function setupPullToRefresh() {
  document.addEventListener('touchstart', event => {
    if (pullRefreshInFlight || event.touches.length !== 1 || window.scrollY > 1) return;
    if (document.body.classList.contains('sheetOpen') || document.body.classList.contains('photoViewerOpen')) return;
    pullRefreshStartX = event.touches[0].clientX;
    pullRefreshStartY = event.touches[0].clientY;
    pullRefreshDistance = 0;
    pullRefreshCuePlayed = false;
    unlockRefreshAudio();
  }, { passive: true });

  document.addEventListener('touchmove', event => {
    if (pullRefreshStartY === null || !event.touches.length) return;
    const horizontal = event.touches[0].clientX - pullRefreshStartX;
    const vertical = event.touches[0].clientY - pullRefreshStartY;
    if (Math.abs(horizontal) > Math.abs(vertical)) {
      pullRefreshStartX = null;
      pullRefreshStartY = null;
      updatePullRefreshIndicator(0);
      return;
    }
    if (vertical <= 0 || window.scrollY > 1) {
      updatePullRefreshIndicator(0);
      return;
    }
    pullRefreshDistance = Math.min(76, vertical * .55);
    updatePullRefreshIndicator(pullRefreshDistance);
    if (pullRefreshDistance >= 58 && !pullRefreshCuePlayed) {
      pullRefreshCuePlayed = true;
      playRefreshSound();
    }
    if (vertical > 8) event.preventDefault();
  }, { passive: false });

  const finishPull = () => {
    if (pullRefreshStartY === null) return;
    const shouldRefresh = pullRefreshDistance >= 58;
    pullRefreshStartX = null;
    pullRefreshStartY = null;
    if (shouldRefresh) performPullRefresh();
    else {
      pullRefreshDistance = 0;
      pullRefreshCuePlayed = false;
      updatePullRefreshIndicator(0);
    }
  };
  document.addEventListener('touchend', finishPull, { passive: true });
  document.addEventListener('touchcancel', finishPull, { passive: true });
}

function setupNativeInteractions() {
  updateNavIndicator();
  updateNavBadges();
  setupPullToRefresh();
  window.addEventListener('resize', updateNavIndicator);
  window.addEventListener('offline', updateConnectionState);
  window.addEventListener('online', updateConnectionState);
  if (!navigator.onLine) updateConnectionState();

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link) showToast(link.dataset.toast || 'Opening link…');
    if (event.target.matches('[data-close-sheet]')) closeDetailSheet();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeDetailSheet();
      closePhotoViewer();
    }
    if (document.getElementById('photoViewer')?.classList.contains('open')) {
      if (event.key === 'ArrowLeft') stepPhotoViewer(-1);
      if (event.key === 'ArrowRight') stepPhotoViewer(1);
    }
  });

  const photoViewer = document.getElementById('photoViewer');
  photoViewer?.addEventListener('touchstart', event => {
    if (event.touches.length === 1) photoSwipeStartX = event.touches[0].clientX;
  }, { passive: true });
  photoViewer?.addEventListener('touchend', event => {
    if (photoSwipeStartX === null || !event.changedTouches.length) return;
    const distance = event.changedTouches[0].clientX - photoSwipeStartX;
    photoSwipeStartX = null;
    if (Math.abs(distance) >= 45) stepPhotoViewer(distance < 0 ? 1 : -1);
  }, { passive: true });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.getElementById('bootSkeleton')?.classList.add('hide');
    setTimeout(() => document.getElementById('bootSkeleton')?.remove(), 260);
  }));
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
        {key:'status', label:'Status: upcoming or completed'},
        {key:'result', label:'Result badge, ex: $1,335.47 Raised'},
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

    <div class="card split adminPanel">
      <h3>Program Summary</h3>
      <input id="adminProgramHeadline" value="${escapeHtml(DATA.programSummary?.headline || '')}" placeholder="Headline">
      <textarea id="adminProgramIntro" placeholder="Intro text">${escapeHtml(DATA.programSummary?.intro || '')}</textarea>
      <input id="adminProgramStatus" value="${escapeHtml(DATA.programSummary?.status || '')}" placeholder="Program status / season label">
      <input id="adminSeasonRecordValue" value="${escapeHtml(DATA.seasonRecord?.value || '')}" placeholder="Season record, ex: 4-1">
      <textarea id="adminSeasonRecordNote" placeholder="Season record note">${escapeHtml(DATA.seasonRecord?.note || '')}</textarea>
    </div>

    <div class="card red adminPanel">
      <h3>Team Records</h3>
      <div id="adminTeamRecords">${(DATA.teamRecords || []).map((item, i) => adminCardEditor('teamRecords', item, i, [
        {key:'event', label:'Event'},
        {key:'holder', label:'Record holder / relay'},
        {key:'mark', label:'Time / score'},
        {key:'year', label:'Year'}
      ])).join('')}</div>
      <button onclick="addAdminItem('teamRecords')">Add Record</button>
    </div>

    <div class="card split adminPanel">
      <h3>Photo Links</h3>
      <div id="adminPhotoLinks">${(DATA.photoLinks || []).map((item, i) => adminCardEditor('photoLinks', item, i, [
        {key:'accent', label:'Accent: green, red, or split'},
        {key:'title', label:'Title'},
        {key:'album', label:'Album name'},
        {key:'status', label:'Status: approved or pending'},
        {key:'detail', label:'Details', type:'textarea'},
        {key:'imageUrl', label:'Photo file or image URL'},
        {key:'linkText', label:'Button text'},
        {key:'linkUrl', label:'Google Drive / gallery link'}
      ])).join('')}</div>
      <button onclick="addAdminItem('photoLinks')">Add Photo Link</button>
    </div>

    <div class="card red adminPanel">
      <h3>Sponsors</h3>
      <input id="adminSponsorIntroTitle" value="${escapeHtml(DATA.sponsorIntro?.title || '')}" placeholder="Sponsor intro title">
      <textarea id="adminSponsorIntroBody" placeholder="Sponsor intro text">${escapeHtml(DATA.sponsorIntro?.body || '')}</textarea>
      <input id="adminSponsorRaised" type="number" step="0.01" value="${escapeHtml(DATA.sponsorIntro?.raised || '')}" placeholder="Total raised">
      <input id="adminSponsorGoal" type="number" step="0.01" value="${escapeHtml(DATA.sponsorIntro?.goal || '30000')}" placeholder="Campaign goal">
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
    body: document.getElementById('adminSponsorIntroBody')?.value.trim() || '',
    raised: Number(document.getElementById('adminSponsorRaised')?.value || 0),
    goal: Number(document.getElementById('adminSponsorGoal')?.value || 30000)
  };
  next.programSummary = {
    headline: document.getElementById('adminProgramHeadline')?.value.trim() || '',
    intro: document.getElementById('adminProgramIntro')?.value.trim() || '',
    status: document.getElementById('adminProgramStatus')?.value.trim() || ''
  };
  next.seasonRecord = {
    value: document.getElementById('adminSeasonRecordValue')?.value.trim() || '',
    note: document.getElementById('adminSeasonRecordNote')?.value.trim() || ''
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
  ['parentCards','volunteerCards','boosterCards','events','sponsors','photoLinks'].forEach(section => {
    next[section] = (next[section] || []).filter(x => x.title || x.name || x.body || x.detail || x.linkUrl || x.imageUrl);
  });
  next.teamRecords = (next.teamRecords || []).filter(x => x.event || x.holder || x.mark);
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
    meetSchedule: { date: '', level: 'JV & Varsity', opponent: '', location: '' },
    parentCards: { accent: 'green', title: '', body: '', linkText: '', linkUrl: '' },
    volunteerCards: { accent: 'green', title: '', date: '', detail: '', status: 'upcoming', linkText: '', linkUrl: '' },
    events: { accent: 'green', title: '', date: '', detail: '', status: 'upcoming', result: '', linkText: '', linkUrl: '' },
    boosterCards: { accent: 'green', title: '', body: '' },
    sponsors: { name: '', note: '' },
    teamRecords: { event: '', holder: '', mark: '', year: '' },
    photoLinks: { accent: 'split', title: '', album: 'Team Highlights', status: 'approved', detail: '', imageUrl: '', linkText: '', linkUrl: '' }
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
    localStorage.setItem('whfAdminDataPreview', JSON.stringify(nextData));
    setRuntimeData(nextData);
    renderAdminStatus();
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


function getChangedSections(candidate = DATA) {
  const base = window.WHF_DATA || {};
  const sections = [
    ['latestUpdate', 'Latest Update'],
    ['keyDates', 'Key Dates / Practice Info'],
    ['meetSchedule', 'Meet Schedule'],
    ['parentCards', 'Parent Hub'],
    ['socialLinks', 'Social Media'],
    ['teamContacts', 'Team Contacts'],
    ['volunteerCards', 'Volunteers'],
    ['events', 'Events'],
    ['boosterCards', 'Booster Club'],
    ['programSummary', 'Program Summary'],
    ['seasonRecord', 'Season Record'],
    ['teamRecords', 'Team Records'],
    ['photoLinks', 'Photo Links'],
    ['sponsorIntro', 'Sponsor Intro'],
    ['sponsors', 'Sponsors'],
    ['teamStore', 'Team Store']
  ];
  return sections.filter(([key]) => JSON.stringify(candidate?.[key] ?? null) !== JSON.stringify(base?.[key] ?? null)).map(([, label]) => label);
}

function renderAdminStatus() {
  const countEl = document.getElementById('adminPendingCount');
  const detailEl = document.getElementById('adminPendingDetail');
  const summaryEl = document.getElementById('publishSummary');
  if (!countEl || !detailEl) return;
  const changed = getChangedSections(DATA);
  if (!changed.length) {
    countEl.textContent = 'No pending changes';
    detailEl.textContent = 'Published data is currently loaded.';
    if (summaryEl) summaryEl.textContent = 'Make edits below, save a preview, then download data.js when you are ready to publish.';
    return;
  }
  countEl.textContent = `${changed.length} pending ${changed.length === 1 ? 'change' : 'changes'}`;
  detailEl.textContent = changed.slice(0, 4).join(' • ') + (changed.length > 4 ? ` • +${changed.length - 4} more` : '');
  if (summaryEl) summaryEl.textContent = `${changed.length} section${changed.length === 1 ? '' : 's'} changed. Download data.js when the preview looks right.`;
}

function refreshAppFromData() {
  renderTodayPanel();
  renderLatestUpdate();
  renderHomeAlerts();
  renderSchedule();
  renderPageCards();
  renderSocialLinks();
  renderTeamContacts();
  renderSponsors();
  renderProgram();
  renderFund();
  buildAdminForms();
  renderAdminStatus();
}

renderTodayPanel();
renderLatestUpdate();
renderHomeAlerts();
renderSchedule();
renderPageCards();
renderSocialLinks();
renderTeamContacts();
renderSponsors();
renderProgram();
renderFund();
setupHomeTaps();
setupNativeInteractions();
buildAdminForms();
renderAdminStatus();
if (new URLSearchParams(window.location.search).get('admin') === '1') showScreen('admin');
checkForAppUpdate();
refreshPublishedData();
refreshApprovedPhotoFeed();

window.addEventListener('focus', () => {
  checkForAppUpdate();
  refreshPublishedData();
  refreshApprovedPhotoFeed();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    checkForAppUpdate();
    refreshPublishedData();
    refreshApprovedPhotoFeed();
  }
});
setInterval(() => {
  if (document.hidden) return;
  checkForAppUpdate();
  refreshPublishedData();
  refreshApprovedPhotoFeed();
}, LIVE_SYNC_INTERVAL_MS);

const NOTIFICATION_WORKER_URL = 'notification-sw.js?v=20260903-72';

function setNotificationTestStatus(message, tone = '') {
  const status = document.getElementById('notificationTestStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function isInstalledWhfApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function getNotificationWorker() {
  const registration = await navigator.serviceWorker.register(NOTIFICATION_WORKER_URL, { scope: './' });
  await navigator.serviceWorker.ready;
  return registration;
}

async function enableAndTestNotifications() {
  const isiPhoneOrIPad = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) {
    setNotificationTestStatus('This phone or browser does not support WHF-HQ notifications.', 'error');
    return;
  }

  if (isiPhoneOrIPad && !isInstalledWhfApp()) {
    setNotificationTestStatus('On iPhone, first add WHF-HQ to the Home Screen. Then open that saved app and try again.', 'error');
    return;
  }

  try {
    setNotificationTestStatus('Waiting for notification permission…');
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      setNotificationTestStatus('Notifications were not allowed. You can enable them later in this phone’s notification settings.', 'error');
      return;
    }

    const registration = await getNotificationWorker();
    await registration.showNotification('WHF-HQ test notification', {
      body: 'Phone notifications are working on this device. No parents were notified.',
      icon: 'app-icon.svg',
      badge: 'app-icon.svg',
      tag: 'whf-hq-private-test',
      renotify: true,
      data: { url: './?admin=1&notificationTest=1' }
    });

    if ('setAppBadge' in navigator) {
      await navigator.setAppBadge(1);
      setNotificationTestStatus('Test sent to this phone. You should see an alert and a red app badge. No parents were notified.', 'success');
    } else {
      setNotificationTestStatus('Test notification sent. This phone controls whether an icon badge is displayed.', 'success');
    }
  } catch (error) {
    console.warn('Notification test could not be completed.', error);
    setNotificationTestStatus('The test could not be completed on this phone. Make sure WHF-HQ is saved to the Home Screen and notifications are allowed.', 'error');
  }
}

async function clearNotificationBadge() {
  try {
    if ('clearAppBadge' in navigator) await navigator.clearAppBadge();
    setNotificationTestStatus('The WHF-HQ app badge was cleared on this phone.', 'success');
  } catch (error) {
    setNotificationTestStatus('This phone manages the app badge automatically.');
  }
}

if (new URLSearchParams(window.location.search).get('notificationTest') === '1') {
  clearNotificationBadge();
}



const ONE_SIGNAL_APP_ID = 'cc26f77d-7d78-400a-9d13-61406a7db12b';
let whfOneSignal = null;

function updateTeamAlertsCard(state, message) {
  const title = document.getElementById('teamAlertsTitle');
  const copy = document.getElementById('teamAlertsCopy');
  const action = document.getElementById('teamAlertsAction');
  if (!title || !copy || !action) return;

  if (state === 'enabled') {
    title.textContent = 'Team Alerts Are On';
    copy.textContent = message || 'This phone will receive important WHF-HQ updates.';
    action.textContent = 'Notifications Enabled';
    return;
  }

  if (state === 'working') {
    title.textContent = 'Turning On Alerts...';
    copy.textContent = message || 'Please respond to the notification permission message.';
    action.textContent = 'Working...';
    return;
  }

  title.textContent = 'Turn On Notifications';
  copy.textContent = message || 'Get important schedule changes and team updates on this phone.';
  action.textContent = 'Turn On Alerts';
}

function isWhfHomeScreenApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function enableTeamAlerts() {
  const isiPhoneOrIPad = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (isiPhoneOrIPad && !isWhfHomeScreenApp()) {
    updateTeamAlertsCard('off', 'On iPhone, save WHF-HQ to the Home Screen and open the saved app before turning on alerts.');
    showToast('Open the saved WHF-HQ app first');
    return;
  }

  if (!whfOneSignal) {
    updateTeamAlertsCard('working', 'The notification service is still loading. Please tap again in a moment.');
    return;
  }

  try {
    if (!whfOneSignal.Notifications.isPushSupported()) {
      updateTeamAlertsCard('off', 'This browser does not support team alerts. Try the saved app or an updated browser.');
      return;
    }

    updateTeamAlertsCard('working');
    await whfOneSignal.User.PushSubscription.optIn();

    if (whfOneSignal.Notifications.permission && whfOneSignal.User.PushSubscription.optedIn) {
      updateTeamAlertsCard('enabled');
      showToast('Team alerts are on');
    } else {
      updateTeamAlertsCard('off', 'Notifications were not enabled. Check this app in your phone’s notification settings, then try again.');
    }
  } catch (error) {
    console.warn('WHF-HQ team alerts could not be enabled.', error);
    updateTeamAlertsCard('off', 'Notifications could not be enabled yet. Please try again.');
  }
}

window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(async function(OneSignal) {
  try {
    await OneSignal.init({
      appId: ONE_SIGNAL_APP_ID,
      serviceWorkerPath: '/WHF-HQ/push/onesignal/OneSignalSDKWorker.js',
      serviceWorkerParam: { scope: '/WHF-HQ/push/onesignal/' },
      notifyButton: { enable: false },
      welcomeNotification: {
        title: 'WHF-HQ Team Alerts',
        message: 'Team alerts are now enabled on this phone.',
        url: 'https://whitehawks-girlsswim.github.io/WHF-HQ/'
      }
    });

    whfOneSignal = OneSignal;

    if (OneSignal.Notifications.permission && OneSignal.User.PushSubscription.optedIn) {
      updateTeamAlertsCard('enabled');
    }

    OneSignal.Notifications.addEventListener('permissionChange', function(permission) {
      if (permission && OneSignal.User.PushSubscription.optedIn) updateTeamAlertsCard('enabled');
    });

    OneSignal.User.PushSubscription.addEventListener('change', function(event) {
      if (event.current && event.current.optedIn) updateTeamAlertsCard('enabled');
    });
  } catch (error) {
    console.warn('WHF-HQ team alerts are unavailable.', error);
    updateTeamAlertsCard('off', 'Team alerts are temporarily unavailable. Please try again later.');
  }
});

function setupHiddenAdminShortcut() {
  const brand = document.querySelector('.brandMark');
  if (!brand) return;

  let tapCount = 0;
  let resetTimer = null;

  brand.addEventListener('click', () => {
    tapCount += 1;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { tapCount = 0; }, 2500);

    if (tapCount < 7) return;
    tapCount = 0;
    clearTimeout(resetTimer);
    showScreen('admin');
    showToast('Private Admin opened');
  });
}

setupHiddenAdminShortcut();
