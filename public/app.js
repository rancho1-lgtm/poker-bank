let tournaments = [];
let locations = [];
let editingId = null;
let deletingId = null;

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadLocations();
  await loadTournaments();
  setupFormListeners();
  setDefaultDate();
});

async function loadTournaments() {
  const res = await fetch('/api/tournaments');
  tournaments = await res.json();
  renderTable();
  renderSummary();
}

async function loadLocations() {
  const res = await fetch('/api/locations');
  locations = await res.json();
}

// ── Summary ─────────────────────────────────────────────
function renderSummary() {
  const count = tournaments.length;
  let totalExpenses = 0, totalWinnings = 0, cashedCount = 0;

  tournaments.forEach(t => {
    totalExpenses += t.totalExpenses || 0;
    if (t.cashed) {
      cashedCount++;
      totalWinnings += t.winnings || 0;
    }
  });

  const net = totalWinnings - totalExpenses;
  const itm = count > 0 ? Math.round((cashedCount / count) * 100) : 0;

  const netEl = document.getElementById('summary-net');
  netEl.textContent = formatCurrency(net);
  netEl.className = 'card-value ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : '');

  document.getElementById('summary-count').textContent = count;
  document.getElementById('summary-itm').textContent = itm + '%';
  document.getElementById('summary-expenses').textContent = formatCurrency(totalExpenses);
  document.getElementById('summary-winnings').textContent = formatCurrency(totalWinnings);
}

// ── Table ───────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  if (tournaments.length === 0) {
    tbody.innerHTML = '<tr id="empty-row"><td colspan="10" class="empty-msg">אין טורנירים עדיין — לחץ "הוסף טורניר" כדי להתחיל ♠</td></tr>';
    return;
  }

  // Sort by date descending
  const sorted = [...tournaments].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(t => {
    const net = (t.cashed ? (t.winnings || 0) : 0) - (t.totalExpenses || 0);
    const netClass = net > 0 ? 'result-positive' : net < 0 ? 'result-negative' : 'result-zero';
    const netStr = net > 0 ? '+' + formatCurrency(net) : formatCurrency(net);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(t.date)}</td>
      <td>${escHtml(t.location)}</td>
      <td>${formatCurrency(t.entryFee)}</td>
      <td>${t.bullets}</td>
      <td>${formatCurrency(t.otherExpenses || 0)}</td>
      <td><strong>${formatCurrency(t.totalExpenses)}</strong></td>
      <td>${t.cashed ? '<span class="badge-yes">כן ✓</span>' : '<span class="badge-no">לא</span>'}</td>
      <td>${t.cashed ? formatCurrency(t.winnings || 0) : '—'}</td>
      <td class="result-col"><span class="${netClass}">${netStr}</span></td>
      <td>
        <button class="btn-icon" onclick="openEdit('${t.id}')">✎ עריכה</button>
        <button class="btn-icon del" onclick="askDelete('${t.id}')">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Modal ───────────────────────────────────────────────
function openModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'הוסף טורניר';
  resetForm();
  setDefaultDate();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openEdit(id) {
  const t = tournaments.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'עריכת טורניר';

  document.getElementById('f-date').value = t.date;
  document.getElementById('f-location').value = t.location;
  document.getElementById('f-entry').value = t.entryFee;
  document.getElementById('f-bullets').value = t.bullets;
  document.getElementById('f-other').value = t.otherExpenses || 0;

  const radios = document.querySelectorAll('input[name="cashed"]');
  radios.forEach(r => { r.checked = (r.value === (t.cashed ? 'yes' : 'no')); });
  toggleWinnings();

  if (t.cashed) document.getElementById('f-winnings').value = t.winnings || 0;

  updateCalc();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  resetForm();
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function resetForm() {
  document.getElementById('tournament-form').reset();
  document.getElementById('f-bullets').value = 1;
  document.getElementById('f-other').value = 0;
  document.getElementById('calc-total').textContent = '₪0';
  document.getElementById('calc-total').className = 'calculated-field';
  document.getElementById('calc-result').textContent = '₪0';
  document.getElementById('calc-result').className = 'calculated-field large';
  document.getElementById('winnings-group').style.display = 'none';
  editingId = null;
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-date').value = today;
}

// ── Form Logic ──────────────────────────────────────────
function setupFormListeners() {
  ['f-entry', 'f-bullets', 'f-other', 'f-winnings'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCalc);
  });

  // Location autocomplete
  const locInput = document.getElementById('f-location');
  locInput.addEventListener('input', showSuggestions);
  locInput.addEventListener('focus', showSuggestions);
  document.addEventListener('click', e => {
    if (!e.target.closest('.autocomplete-wrap')) hideSuggestions();
  });
}

function updateCalc() {
  const entry = parseFloat(document.getElementById('f-entry').value) || 0;
  const bullets = parseInt(document.getElementById('f-bullets').value) || 1;
  const other = parseFloat(document.getElementById('f-other').value) || 0;
  const totalExp = entry * bullets + other;

  const totalEl = document.getElementById('calc-total');
  totalEl.textContent = formatCurrency(totalExp);

  const cashed = document.querySelector('input[name="cashed"]:checked')?.value === 'yes';
  const winnings = cashed ? (parseFloat(document.getElementById('f-winnings').value) || 0) : 0;
  const net = winnings - totalExp;

  const resultEl = document.getElementById('calc-result');
  resultEl.textContent = (net > 0 ? '+' : '') + formatCurrency(net);
  resultEl.className = 'calculated-field large ' + (net > 0 ? 'positive' : net < 0 ? 'negative' : '');
}

function toggleWinnings() {
  const cashed = document.querySelector('input[name="cashed"]:checked')?.value === 'yes';
  const group = document.getElementById('winnings-group');
  const wInput = document.getElementById('f-winnings');

  group.style.display = cashed ? '' : 'none';
  if (cashed) {
    wInput.setAttribute('required', 'required');
  } else {
    wInput.removeAttribute('required');
    wInput.value = '';
  }
  updateCalc();
}

// ── Submit ──────────────────────────────────────────────
async function submitForm(e) {
  e.preventDefault();

  const entry = parseFloat(document.getElementById('f-entry').value) || 0;
  const bullets = parseInt(document.getElementById('f-bullets').value) || 1;
  const other = parseFloat(document.getElementById('f-other').value) || 0;
  const cashed = document.querySelector('input[name="cashed"]:checked')?.value === 'yes';
  const winnings = cashed ? (parseFloat(document.getElementById('f-winnings').value) || 0) : 0;

  const payload = {
    date: document.getElementById('f-date').value,
    location: document.getElementById('f-location').value.trim(),
    entryFee: entry,
    bullets,
    otherExpenses: other,
    totalExpenses: entry * bullets + other,
    cashed,
    winnings: cashed ? winnings : 0,
  };

  const url = editingId ? `/api/tournaments/${editingId}` : '/api/tournaments';
  const method = editingId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) { alert('שגיאה בשמירה. נסה שוב.'); return; }

  await loadLocations();
  await loadTournaments();
  closeModal();
}

// ── Delete ──────────────────────────────────────────────
function askDelete(id) {
  deletingId = id;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

function closeConfirm() {
  deletingId = null;
  document.getElementById('confirm-overlay').classList.add('hidden');
}

async function confirmDelete() {
  if (!deletingId) return;
  await fetch(`/api/tournaments/${deletingId}`, { method: 'DELETE' });
  closeConfirm();
  await loadTournaments();
}

// ── Autocomplete ────────────────────────────────────────
function showSuggestions() {
  const val = document.getElementById('f-location').value.toLowerCase();
  const list = document.getElementById('location-suggestions');

  const matches = locations.filter(l => l.toLowerCase().includes(val));
  if (matches.length === 0) { hideSuggestions(); return; }

  list.innerHTML = matches.map(l =>
    `<li onclick="selectLocation('${escHtml(l)}')">${escHtml(l)}</li>`
  ).join('');
  list.classList.remove('hidden');
}

function hideSuggestions() {
  document.getElementById('location-suggestions').classList.add('hidden');
}

function selectLocation(val) {
  document.getElementById('f-location').value = val;
  hideSuggestions();
}

// ── Helpers ─────────────────────────────────────────────
function formatCurrency(n) {
  if (n === undefined || n === null || isNaN(n)) return '₪0';
  return '₪' + Number(n).toLocaleString('he-IL');
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
