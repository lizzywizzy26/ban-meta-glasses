// API_BASE_URL is set once in js/config.js (loaded before this file) and
// shared with js/finder.js.
const API_BASE_URL = window.API_BASE_URL || '';

const STAT_ELEMENT_IDS = {
  visit: ['statVisitPanel'],
  optician: ['statOpticianPanel', 'statOpticianInline'],
  mp: ['statMpPanel', 'statMpInline'],
  rayban: ['statRaybanPanel', 'statRaybanInline'],
  retailer: ['statRetailerPanel', 'statRetailerInline'],
  petition_click: ['statPetitionClickPanel', 'statPetitionClickInline'],
  petition_share: ['statSharePanel', 'statShareInline'],
};

function renderCounts(counts) {
  for (const [type, ids] of Object.entries(STAT_ELEMENT_IDS)) {
    const value = counts[type];
    if (value === undefined) continue;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toLocaleString('en-GB');
    }
  }
}

async function hit(type) {
  if (!API_BASE_URL) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    if (data && data.counts) renderCounts(data.counts);
  } catch (err) {
    // Silent failure — counters are a nice-to-have, never block the user's actual task.
  }
}

async function loadStats() {
  if (!API_BASE_URL) {
    const panel = document.getElementById('impactPanel');
    if (panel) panel.hidden = true;
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/stats`);
    const counts = await res.json();
    renderCounts(counts);
  } catch (err) {
    const panel = document.getElementById('impactPanel');
    if (panel) panel.hidden = true;
  }
}

loadStats();
hit('visit');

window.__campaignHit = hit;
