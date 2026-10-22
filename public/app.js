const $ = id => document.getElementById(id);
let config, selectedDate, selectedHour, displayed, requestVersion = 0;
const formatDate = date => new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
function showStep(step) {
  $('date-step').hidden = step !== 'date'; $('booking-form').hidden = step !== 'data'; $('success').hidden = step !== 'success';
  $('tab-date').classList.toggle('active', step === 'date'); $('tab-data').classList.toggle('active', step !== 'date');
}
function renderCalendar() {
  $('month-label').textContent = displayed.toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const first = new Date(Date.UTC(displayed.getUTCFullYear(), displayed.getUTCMonth(), 1));
  const days = new Date(Date.UTC(displayed.getUTCFullYear(), displayed.getUTCMonth() + 1, 0)).getUTCDate();
  $('calendar').replaceChildren();
  for (let i = 0; i < (first.getUTCDay() + 6) % 7; i++) $('calendar').append(document.createElement('span'));
  const max = new Date(`${config.today}T12:00:00Z`); max.setUTCDate(max.getUTCDate() + 89);
  for (let day = 1; day <= days; day++) {
    const date = new Date(Date.UTC(displayed.getUTCFullYear(), displayed.getUTCMonth(), day, 12)).toISOString().slice(0,10);
    const button = document.createElement('button'); button.type = 'button'; button.textContent = day;
    button.disabled = date < config.today || date > max.toISOString().slice(0,10);
    button.classList.toggle('selected', date === selectedDate); button.classList.toggle('today', date === config.today);
    button.setAttribute('aria-label', formatDate(date)); button.setAttribute('aria-pressed', String(date === selectedDate));
    button.addEventListener('click', () => selectDate(date)); $('calendar').append(button);
  }
  $('prev-month').disabled = displayed.getUTCFullYear() === Number(config.today.slice(0,4)) && displayed.getUTCMonth() === Number(config.today.slice(5,7))-1;
  $('next-month').disabled = displayed.getUTCFullYear()*12+displayed.getUTCMonth() >= max.getUTCFullYear()*12+max.getUTCMonth();
}
function slotMessage(message) { const p = document.createElement('p'); p.textContent = message; $('slots').replaceChildren(p); }
async function selectDate(date) {
  selectedDate = date; selectedHour = null; $('continue').disabled = true; renderCalendar();
  $('selected-label').textContent = new Date(`${date}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  slotMessage('Consultando disponibilidad…'); const version = ++requestVersion;
  try {
    const response = await fetch(`/api/availability?date=${date}`); const data = await response.json();
    if (version !== requestVersion) return;
    if (!response.ok) throw new Error(data.error);
    $('mode-notice').textContent = 'Agenda habilitada para reservas';
    $('slots').replaceChildren();
    if (!data.slots.length) return slotMessage('No hay horarios disponibles para este día. Selecciona otra fecha.');
    for (const slot of data.slots) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = slot.hour; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        selectedHour = slot.hour;
        for (const item of $('slots').children) { item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', String(item === button)); }
        $('continue').disabled = false;
      }); $('slots').append(button);
    }
  } catch (error) { if (version === requestVersion) { $('mode-notice').textContent = 'No se pudo consultar Google Calendar. No se ha confirmado ninguna reserva.'; slotMessage(error.message || 'No se pudo cargar la agenda. Intenta nuevamente.'); } }
}
for (const [id, delta] of [['prev-month',-1],['next-month',1]]) $(id).addEventListener('click', () => { displayed.setUTCMonth(displayed.getUTCMonth()+delta); renderCalendar(); });
$('continue').addEventListener('click', () => {
  $('selection-summary').textContent = `${formatDate(selectedDate)} · ${selectedHour} · Hora de Chile`;
  if (!config?.bookingEnabled) return;
  $('form-status').textContent = '';
  $('submit').textContent = 'Confirmar reserva ↗'; showStep('data'); $('name').focus();
});
$('back').addEventListener('click', () => showStep('date'));
$('new-booking').addEventListener('click', () => { $('booking-form').reset(); showStep('date'); selectDate(selectedDate); });
$('booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!config?.bookingEnabled) { $('form-status').textContent = 'La agenda no está habilitada. No se ha realizado ninguna reserva.'; return; }
  $('submit').disabled = true; $('form-status').textContent = 'Confirmando tu reserva…';
  try {
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $('name').value.trim(), email: $('email').value.trim(), date: selectedDate, hour: selectedHour, mode: 'online', consent: $('consent').checked }) });
    const data = await response.json();
    if (!response.ok && !data.reservationNeedsReview) throw new Error(data.error);
    $('success-title').textContent = data.reservationNeedsReview ? 'Reserva pendiente de revisión.' : 'Reserva confirmada.';
    $('session-link').hidden = true;
    if (data.onlineUrl?.startsWith('https://')) { $('session-link').href = data.onlineUrl; $('session-link').hidden = false; }
    $('success-text').textContent = `${formatDate(selectedDate)} a las ${selectedHour}. ${data.reservationNeedsReview ? data.error : data.message}`; showStep('success'); $('booking-form').reset();
  } catch (error) { $('form-status').textContent = error.message || 'No se pudo confirmar la reserva. Revisa tu correo antes de reintentar.'; }
  finally { $('submit').disabled = false; }
});
const portrait = $('portrait');
function revealPortrait() {
  if (!portrait.naturalWidth) return;
  portrait.hidden = false;
  $('portrait-placeholder').hidden = true;
}
portrait.addEventListener('load', revealPortrait);
portrait.addEventListener('error', () => { portrait.hidden = true; $('portrait-placeholder').hidden = false; });
// El retrato no depende de la agenda ni de que Google esté configurado.
portrait.src = portrait.dataset.src;
if (portrait.complete) revealPortrait();
function unavailableAgenda(message) {
  $('mode-notice').textContent = message;
  $('date-step').hidden = true;
  $('booking-form').hidden = true;
  $('success').hidden = true;
  document.querySelector('.booking-tabs').hidden = true;
  $('booking-unavailable').hidden = false;
  $('continue').disabled = true;
}
async function loadAgenda() {
  $('retry-agenda').disabled = true;
  try {
    const response = await fetch('/api/config'); if (!response.ok) throw new Error(); config = await response.json();
    if (!config.bookingEnabled) {
      unavailableAgenda('Reservas no disponibles por el momento.');
      return;
    }
    $('booking-unavailable').hidden = true;
    document.querySelector('.booking-tabs').hidden = false;
    showStep('date');
    displayed = new Date(`${config.today.slice(0,7)}-01T12:00:00Z`);
    $('mode-notice').textContent = 'Consultando disponibilidad en Google Calendar…';
    $('session-details').textContent = `${config.duration} minutos · ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(config.price)} · Por videollamada`;
    $('faq-price').textContent = $('session-details').textContent;
    renderCalendar(); await selectDate(config.today);
  } catch {
    unavailableAgenda('No pudimos conectar con la agenda. Intenta nuevamente.');
  } finally { $('retry-agenda').disabled = false; }
}
$('retry-agenda').addEventListener('click', loadAgenda);
loadAgenda();

// La animación CSS funciona sin JavaScript. La interacción solo se activa
// con un puntero preciso y cuando no se ha solicitado movimiento reducido.
const stage = $('motion-stage');
const hero = $('inicio');
const motionToggle = $('motion-toggle');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const objects = [...stage.querySelectorAll('.float-object')];
let motionPaused = false;
let motionFrame = 0;
function resetObjects() {
  cancelAnimationFrame(motionFrame);
  motionFrame = 0;
  objects.forEach(object => { object.style.transform = ''; });
}
function updateMotionPreference() {
  resetObjects();
  motionToggle.hidden = reducedMotion.matches;
  stage.classList.toggle('is-paused', motionPaused || reducedMotion.matches);
}
motionToggle.addEventListener('click', () => {
  motionPaused = !motionPaused;
  motionToggle.setAttribute('aria-pressed', String(motionPaused));
  $('motion-label').textContent = motionPaused ? 'Activar movimiento' : 'Pausar movimiento';
  updateMotionPreference();
});
hero.addEventListener('pointermove', event => {
  if (motionPaused || reducedMotion.matches || !finePointer.matches || motionFrame) return;
  const bounds = hero.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - .5;
  const y = (event.clientY - bounds.top) / bounds.height - .5;
  motionFrame = requestAnimationFrame(() => {
    objects.forEach(object => {
      const depth = Number(object.dataset.depth);
      object.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
    });
    motionFrame = 0;
  });
}, { passive: true });
hero.addEventListener('pointerleave', resetObjects);
reducedMotion.addEventListener('change', updateMotionPreference);
finePointer.addEventListener('change', resetObjects);
document.addEventListener('visibilitychange', () => {
  stage.classList.toggle('is-hidden', document.hidden);
  if (document.hidden) resetObjects();
});
new IntersectionObserver(([entry]) => {
  stage.classList.toggle('is-offscreen', !entry.isIntersecting);
}, { threshold: 0 }).observe(hero);
updateMotionPreference();
