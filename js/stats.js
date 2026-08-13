// Set this to your deployed Worker URL after following worker/README.md, e.g.
// 'https://stop-meta-glasses-counters.your-subdomain.workers.dev'
// Left blank, the campaign impact panel hides itself rather than showing zeros.
const API_BASE_URL = '';

const STAT_ELEMENT_IDS = {
  visit: ['statVisitPanel'],
  optician: ['statOpticianPanel', 'statOpticianInline'],
  mp: ['statMpPanel', 'statMpInline'],
  rayban: ['statRaybanPanel', 'statRaybanInline'],
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
