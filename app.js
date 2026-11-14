'use strict';

/* ---------- storage ---------- */
const KEY = 'shopping-support-v1';
let S = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      s.history = Array.isArray(s.history) ? s.history : [];
      s.current = s.current || null;
      return s;
    }
  } catch (e) { /* empty or broken: start fresh */ }
  return { current: null, history: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full / blocked */ }
}

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
function localStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function shortDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return m ? `${MONTHS[m - 1]} ${d}` : '';
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** "36" → 36000, "35.5" → 35500 (천원 단위). null if empty / 0 / not a number. */
function parseK(str) {
  let s = String(str || '').trim().replace(/\s/g, '').replace(/−/g, '-');
  if (!s) return null;
  s = s.replace(/,/g, '.');
  if ((s.match(/\./g) || []).length > 1) return null;
  const v = Number(s);
  if (!isFinite(v)) return null;
  const won = Math.round(v * 1000);
  return won === 0 ? null : won;
}
/** 36000 → "36", 35500 → "35.5" */
const toK = (won) => String(Math.round(won) / 1000);

/** keep the grey ",000" right after the typed number */
function bindSuffix(input) {
  const wrap = input.closest('.suffixed');
  const ghost = wrap && wrap.querySelector('.ghost-text');
  const sync = () => {
    if (ghost) ghost.textContent = input.value;
    wrap.classList.toggle('empty', !input.value);
  };
  input.addEventListener('input', sync);
  input._sync = sync;
  sync();
}
function setVal(input, v) { input.value = v; if (input._sync) input._sync(); }

function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

/* ---------- screens ---------- */
function show() {
  const shopping = !!S.current;
  $('start').hidden = shopping;
  $('shop').hidden = !shopping;
  if (shopping) renderShop(); else renderStart();
}

/* ① New trip */
function renderStart() {
  const last = S.history[0];
  setVal($('s-store'), S.lastStore || (last && last.store) || '');
  setVal($('s-budget'), last ? toK(last.budget) : '');
  updateBudgetHint();
  $('last').hidden = !last;
  if (last) {
    $('last-where').textContent = `${last.store} · ${shortDate(last.date)}`;
    $('last-amt').textContent = `₩${fmt(last.spent)} / ${fmt(last.budget)}`;
  }
}
function updateBudgetHint() {
  const v = parseK($('s-budget').value);
  $('s-hint').textContent = v && v > 0 ? `₩${fmt(v)} · type ${toK(v)}, not ${v}` : 'Type 300 for ₩300,000';
}
function startTrip() {
  const budget = parseK($('s-budget').value);
  if (!budget || budget < 0) { shake($('s-budget').closest('.suffixed')); $('s-budget').focus(); return; }
  const store = $('s-store').value.trim() || 'Store';
  S.lastStore = store;
  S.current = { id: localStamp().slice(0, 16), store, budget, items: [] };
  save();
  show();
}

/* ② Shopping */
const C_BIG = 2 * Math.PI * 100;
const C_MINI = 2 * Math.PI * 20;
const spentOf = () => S.current.items.reduce((a, it) => a + it.amount, 0);

function setArc(el, C, frac) {
  const f = Math.max(0, Math.min(1, frac));
  el.setAttribute('stroke-dasharray', `${(C * f).toFixed(1)} ${C.toFixed(1)}`);
  el.style.opacity = f > 0 ? 1 : 0;
}

function renderSummary() {
  const cur = S.current;
  const spent = spentOf();
  const left = cur.budget - spent;
  const over = left < 0;
  const pct = cur.budget > 0 ? Math.round((spent / cur.budget) * 100) : 0;
  const frac = cur.budget > 0 ? spent / cur.budget : 1;

  $('shop').classList.toggle('over', over);
  $('store-name').textContent = cur.store;
  $('budget-btn').textContent = `Budget ${fmt(cur.budget)}`;

  setArc($('ring-arc'), C_BIG, over ? 1 : frac);
  setArc($('mini-arc'), C_MINI, over ? 1 : frac);

  $('ring-label').textContent = over ? 'Over by' : 'Left';
  $('ring-num').textContent = fmt(Math.abs(left));
  $('ring-sub').textContent = `Spent ${fmt(spent)} · ${pct}%`;

  $('mini-num').textContent = fmt(Math.abs(left));
  $('mini-unit').textContent = over ? 'over' : 'left';

  const n = cur.items.length;
  $('count').textContent = `${n} item${n === 1 ? '' : 's'}`;
  renderPreview();
}

/** compact second line: totals, or "After eggs → 133,000 left" while typing an amount */
function renderPreview() {
  if (!S.current) return;
  const cur = S.current;
  const spent = spentOf();
  const sub = $('mini-sub');
  const amt = parseK($('in-amt').value);
  if (document.activeElement === $('in-amt') && amt !== null) {
    const name = $('in-name').value.trim() || 'this';
    const after = cur.budget - spent - amt;
    sub.textContent = after >= 0
      ? `After ${name} → ${fmt(after)} left`
      : `After ${name} → over by ${fmt(-after)}`;
    sub.classList.add('preview');
    sub.classList.toggle('bad', after < 0);
  } else {
    sub.textContent = `Spent ${fmt(spent)} / ${fmt(cur.budget)}`;
    sub.classList.remove('preview', 'bad');
  }
}

function renderList() {
  const list = $('list');
  list.textContent = '';
  const items = S.current.items.slice().reverse(); // newest on top
  if (!items.length) {
    const p = document.createElement('div');
    p.className = 'empty-note';
    p.textContent = 'Add your first item below.';
    list.appendChild(p);
  }
  for (const it of items) list.appendChild(rowEl(it));

  const wrap = document.createElement('div');
  wrap.className = 'finish-wrap';
  const b = document.createElement('button');
  b.className = 'finish';
  b.textContent = 'Finish trip';
  b.addEventListener('click', askFinish);
  wrap.appendChild(b);
  list.appendChild(wrap);
}

function renderShop() { renderSummary(); renderList(); }

/* ---------- add ---------- */
function addItem() {
  const nameEl = $('in-name'), amtEl = $('in-amt');
  const amount = parseK(amtEl.value);
  if (amount === null) {
    if (amtEl.value.trim() || nameEl.value.trim()) { shake(amtEl.closest('.bar-amt')); amtEl.focus(); }
    return;
  }
  S.current.items.push({ id: uid(), name: nameEl.value.trim(), amount, t: localStamp() });
  save();
  nameEl.value = '';
  amtEl.value = '';
  nameEl.focus();
  renderShop();
  $('list').scrollTop = 0;
}

/* ---------- row: tap = edit, swipe left = delete ---------- */
const OPEN_X = 112;
let openRow = null;

function closeOpenRow(except) {
  if (openRow && openRow !== except) {
    const fg = openRow.querySelector('.fg');
    fg.classList.add('anim');
    fg.style.transform = '';
    fg.classList.remove('moved');
    openRow = null;
  }
}

function rowEl(it) {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.id = it.id;

  const del = document.createElement('button');
  del.className = 'del';
  del.tabIndex = -1;
  del.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>Delete';
  del.addEventListener('click', () => removeItem(it.id, row));

  const fg = document.createElement('div');
  fg.className = 'fg num';
  fg.setAttribute('role', 'button');
  fg.tabIndex = 0;
  const nm = document.createElement('span');
  nm.className = 'name' + (it.name ? '' : ' noname');
  nm.textContent = it.name || 'No name · tap to name';
  const am = document.createElement('span');
  am.className = 'amt' + (it.amount < 0 ? ' neg' : '');
  am.textContent = fmt(it.amount);
  fg.append(nm, am);
  fg.setAttribute('aria-label', `${it.name || 'No name'}, ${fmt(it.amount)} won. Tap to edit.`);
  fg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(it.id); } });

  row.append(del, fg);
  attachSwipe(row, fg, it.id);
  return row;
}

function attachSwipe(row, fg, id) {
  let sx = 0, sy = 0, base = 0, x = 0, mode = null, pid = null;

  fg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    closeOpenRow(row);
    pid = e.pointerId;
    sx = e.clientX; sy = e.clientY;
    base = openRow === row ? -OPEN_X : 0;
    x = base;
    mode = null;
    fg.classList.remove('anim');
  });

  fg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid || mode === 'v') return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!mode) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (mode === 'h') { try { fg.setPointerCapture(pid); } catch (_) {} fg.classList.add('moved'); }
      else return;
    }
    x = Math.min(0, base + dx);
    fg.style.transform = `translateX(${x}px)`;
  });

  const end = (e, cancelled) => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (!mode) {
      if (cancelled) return;
      if (openRow === row) { closeOpenRow(); return; }
      openEdit(id);
      return;
    }
    if (mode !== 'h') return;
    const w = row.offsetWidth;
    fg.classList.add('anim');
    if (!cancelled && x < -w * 0.55) {
      fg.style.transform = `translateX(${-w}px)`;
      setTimeout(() => removeItem(id, row), 160);
    } else if (!cancelled && x < -OPEN_X / 2) {
      fg.style.transform = `translateX(${-OPEN_X}px)`;
      openRow = row;
    } else {
      fg.style.transform = '';
      fg.classList.remove('moved');
      if (openRow === row) openRow = null;
    }
  };
  fg.addEventListener('pointerup', (e) => end(e, false));
  fg.addEventListener('pointercancel', (e) => end(e, true));
}

function removeItem(id, row) {
  const i = S.current.items.findIndex((it) => it.id === id);
  if (i < 0) return;
  S.current.items.splice(i, 1);
  save();
  openRow = null;
  if (row) {
    row.style.maxHeight = row.offsetHeight + 'px';
    void row.offsetHeight;
    row.classList.add('gone');
    setTimeout(renderShop, 200);
    renderSummary();
  } else {
    renderShop();
  }
}

/* ---------- dialogs ---------- */
let editId = null;
function openEdit(id) {
  const it = S.current.items.find((x) => x.id === id);
  if (!it) return;
  editId = id;
  setVal($('e-name'), it.name);
  setVal($('e-amt'), toK(it.amount));
  $('dlg-item').showModal();
  if (!it.name) $('e-name').focus(); else $('e-amt').blur();
}
$('dlg-item').addEventListener('close', () => {
  const d = $('dlg-item');
  if (d.returnValue === 'ok' && editId) {
    const it = S.current.items.find((x) => x.id === editId);
    const amount = parseK($('e-amt').value);
    if (it) {
      it.name = $('e-name').value.trim();
      if (amount !== null) it.amount = amount;
      save();
      renderShop();
    }
  }
  editId = null;
  d.returnValue = '';
});
$('e-del').addEventListener('click', () => {
  const id = editId;
  $('dlg-item').close('cancel');
  removeItem(id, null);
});
$('e-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('e-amt').focus(); }
});
$('f-item').addEventListener('submit', (e) => {
  // Enter inside the amount field = Save; block saving an empty / 0 amount
  if (e.submitter && e.submitter.value === 'cancel') return;
  if (parseK($('e-amt').value) === null) { e.preventDefault(); shake($('e-amt').closest('.suffixed')); }
});

function openBudget() {
  setVal($('b-amt'), toK(S.current.budget));
  $('dlg-budget').showModal();
  $('b-amt').select();
}
$('dlg-budget').querySelector('form').addEventListener('submit', (e) => {
  if (e.submitter && e.submitter.value === 'cancel') return;
  const v = parseK($('b-amt').value);
  if (!v || v < 0) { e.preventDefault(); shake($('b-amt').closest('.suffixed')); }
});
$('dlg-budget').addEventListener('close', () => {
  const d = $('dlg-budget');
  if (d.returnValue === 'ok') {
    const v = parseK($('b-amt').value);
    if (v && v > 0) { S.current.budget = v; save(); renderSummary(); }
  }
  d.returnValue = '';
});

function askFinish() {
  const spent = spentOf();
  const n = S.current.items.length;
  $('finish-text').textContent =
    `${S.current.store} · spent ₩${fmt(spent)} of ${fmt(S.current.budget)} (${n} item${n === 1 ? '' : 's'}). It will be saved as your last trip.`;
  $('dlg-finish').showModal();
}
$('dlg-finish').addEventListener('close', () => {
  const d = $('dlg-finish');
  if (d.returnValue === 'ok' && S.current) {
    const cur = S.current;
    S.history.unshift({
      store: cur.store,
      date: localStamp().slice(0, 10),
      budget: cur.budget,
      spent: spentOf(),
      items: cur.items,
    });
    S.history = S.history.slice(0, 50);
    S.lastStore = cur.store;
    S.current = null;
    save();
    show();
  }
  d.returnValue = '';
});

/* ---------- wiring ---------- */
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close('cancel')));

['s-budget', 'e-amt', 'b-amt'].forEach((id) => bindSuffix($(id)));

$('s-budget').addEventListener('input', updateBudgetHint);
$('s-store').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('s-budget').focus(); } });
$('s-budget').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); startTrip(); } });
$('s-go').addEventListener('click', startTrip);
$('budget-btn').addEventListener('click', openBudget);

// Name: Enter = Next → Amount.  Amount: Enter = Done → add, back to Name.
$('in-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('in-amt').focus(); }
});
$('in-amt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addItem(); }
});
$('in-amt').addEventListener('input', renderPreview);
$('in-name').addEventListener('input', renderPreview);

// + button: keep the keyboard up (don't steal focus)
$('add-btn').addEventListener('pointerdown', (e) => e.preventDefault());
$('add-btn').addEventListener('mousedown', (e) => e.preventDefault());
$('add-btn').addEventListener('click', addItem);

// keyboard up (an input in the bar has focus) → ring folds into one line
const bar = $('bar');
bar.addEventListener('focusin', () => { $('shop').classList.add('typing'); closeOpenRow(); renderPreview(); });
bar.addEventListener('focusout', () => {
  setTimeout(() => {
    if (!bar.contains(document.activeElement)) $('shop').classList.remove('typing');
    renderPreview();
  }, 0);
});
// tapping the list while typing closes the keyboard
$('list').addEventListener('pointerdown', () => {
  if (bar.contains(document.activeElement)) document.activeElement.blur();
});
document.addEventListener('pointerdown', (e) => {
  if (openRow && !openRow.contains(e.target)) closeOpenRow();
}, true);

// another tab / window changed the data
window.addEventListener('storage', (e) => { if (e.key === KEY) { S = load(); show(); } });

show();

/* ---------- offline ---------- */
// New version: the new sw.js calls skipWaiting() + clients.claim(), the page reloads itself once.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller; // first install: no reload
  let reloading = false;
  const reloadNow = () => { if (!reloading) { reloading = true; location.reload(); } };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    // don't throw away a half-typed item: wait until the input bar loses focus
    if (bar.contains(document.activeElement)) {
      bar.addEventListener('focusout', () => setTimeout(() => {
        if (!bar.contains(document.activeElement)) reloadNow();
      }, 0));
    } else {
      reloadNow();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // an installed app is often resumed, not reopened: check again when it comes back to the front
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
