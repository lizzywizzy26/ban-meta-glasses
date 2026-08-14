// Single source of truth for the Worker API URL, shared by js/stats.js and
// js/finder.js. Set this to your deployed Worker URL after following
// worker/README.md, e.g. 'https://stop-meta-glasses-counters.your-subdomain.workers.dev'
// Left blank: the campaign-impact panel hides itself, and the postcode
// finder shows a graceful "search is being set up" message instead of a
// broken search box — the rest of the site keeps working either way.
window.API_BASE_URL = '';
