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
  } catch (error) { if (version === requestVersion) slotMessage(error.message || 'No se pudo cargar la agenda. Intenta nuevamente.'); }
}
for (const [id, delta] of [['prev-month',-1],['next-month',1]]) $(id).addEventListener('click', () => { displayed.setUTCMonth(displayed.getUTCMonth()+delta); renderCalendar(); });
$('continue').addEventListener('click', () => {
  $('selection-summary').textContent = `${formatDate(selectedDate)} · ${selectedHour} · Hora de Chile`;
  $('form-status').textContent = config.demo ? 'Puedes explorar el formulario. Esta demostración no envía ni guarda tus datos.' : '';
  $('submit').textContent = config.demo ? 'Probar reserva de demostración' : 'Confirmar reserva ↗'; showStep('data'); $('name').focus();
});
$('back').addEventListener('click', () => showStep('date'));
$('new-booking').addEventListener('click', () => { $('booking-form').reset(); showStep('date'); selectDate(selectedDate); });
$('booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (config.demo) { $('form-status').textContent = '¡Así se verá el proceso! No se ha realizado una reserva ni enviado un correo. Tus datos no se han guardado.'; return; }
  $('submit').disabled = true; $('form-status').textContent = 'Confirmando tu reserva…';
  try {
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $('name').value.trim(), email: $('email').value.trim(), date: selectedDate, hour: selectedHour, mode: 'online', consent: $('consent').checked }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    $('session-link').hidden = true;
    if (data.onlineUrl?.startsWith('https://')) { $('session-link').href = data.onlineUrl; $('session-link').hidden = false; }
    $('success-text').textContent = `${formatDate(selectedDate)} a las ${selectedHour}. ${data.message}`; showStep('success'); $('booking-form').reset();
  } catch (error) { $('form-status').textContent = error.message || 'No se pudo confirmar la reserva. Revisa tu correo antes de reintentar.'; }
  finally { $('submit').disabled = false; }
});
const portrait = $('portrait'); portrait.addEventListener('load', () => { portrait.hidden = false; $('portrait-placeholder').hidden = true; });
try {
  const response = await fetch('/api/config'); if (!response.ok) throw new Error(); config = await response.json();
  if (config.hasPortrait) portrait.src = portrait.dataset.src;
  displayed = new Date(`${config.today.slice(0,7)}-01T12:00:00Z`);
  if (!config.demo) { $('mode-notice').textContent = 'Agenda conectada con Google Calendar'; $('session-details').textContent = `${config.duration} minutos · ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(config.price)} · Por videollamada`; $('faq-price').textContent = $('session-details').textContent; }
  renderCalendar(); await selectDate(config.today);
} catch { $('month-label').textContent = 'Agenda no disponible'; slotMessage('No se pudo conectar con la agenda. Recarga la página para reintentar.'); $('prev-month').disabled = true; $('next-month').disabled = true; }
