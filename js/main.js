// --- Editors: update these two lines to refresh the petition status shown in the hero and Action C. ---
// Check the live count at https://petition.parliament.uk/petitions/769206 and paste it in here.
const PETITION_SIGNATURES = '5,399';
const PETITION_CLOSE_DATE = '9 December 2026';

document.getElementById('sigCount').textContent = PETITION_SIGNATURES;
document.getElementById('sigCount2').textContent = PETITION_SIGNATURES;
document.getElementById('closeDate').textContent = PETITION_CLOSE_DATE;

const cities = ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol", "Leeds", "Glasgow", "Cardiff"];
const chipRow = document.getElementById('cityChips');
cities.forEach(city => {
  const a = document.createElement('a');
  a.className = 'chip';
  a.target = '_blank';
  a.rel = 'noopener';
  a.href = `https://www.google.com/maps/search/opticians+in+${encodeURIComponent(city)}`;
  a.textContent = city;
  chipRow.appendChild(a);
});

function flash(id) {
  const el = document.getElementById(id);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

function reportHit(type) {
  if (window.__campaignHit) window.__campaignHit(type);
}

function buildOpticianEmail() {
  const shop = document.getElementById('shopName').value.trim();
  let text = document.getElementById('emailBody').value;
  if (shop) {
    text = text.replace('[Optician name]', shop);
  }
  return text;
}

function mailtoFromTemplate(text) {
  const lines = text.split('\n');
  const subjectLine = lines[0].replace(/^Subject:\s*/i, '');
  const body = lines.slice(1).join('\n').trim();
  window.location.href = `mailto:?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
}

document.getElementById('copyEmailBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(buildOpticianEmail()).then(() => flash('copiedMsg'));
  reportHit('optician');
});
document.getElementById('openMailtoBtn').addEventListener('click', () => {
  mailtoFromTemplate(buildOpticianEmail());
  reportHit('optician');
});

document.getElementById('copyShareBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('shareText').value).then(() => flash('copiedMsg2'));
  reportHit('petition_share');
});

document.getElementById('signPetitionBtn').addEventListener('click', () => {
  reportHit('petition_click');
});

document.getElementById('copyMpEmailBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('mpEmailBody').value).then(() => flash('copiedMsg3'));
  reportHit('mp');
});

document.getElementById('copyRaybanBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('raybanEmailBody').value).then(() => flash('copiedMsg4'));
  reportHit('rayban');
});
document.getElementById('openRaybanMailtoBtn').addEventListener('click', () => {
  mailtoFromTemplate(document.getElementById('raybanEmailBody').value);
  reportHit('rayban');
});
