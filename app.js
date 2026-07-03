const screens = document.querySelectorAll('.screen');
const navButtons = document.querySelectorAll('.bottomNav button');

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const sponsors = JSON.parse(localStorage.getItem('whfSponsors') || '[]');
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

renderSponsors();
renderFund();
