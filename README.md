# Camila Leiva · Agendamiento web

Web adaptable a móvil y escritorio con perfil, agenda y selección online/presencial. Node.js 22 o superior, sin dependencias externas.

## Ejecutar

```sh
git clone https://github.com/PaulaNarvaez/agendamiento_web.git
cd agendamiento_web
code .
npm test
npm start
```

Después de `npm start`, abre http://localhost:3000 en tu navegador local. Abrir `index.html` directamente o ver el repositorio en GitHub no ejecuta la aplicación.

Puerto 3000, configurable mediante `PORT`. `npm run dev` reinicia el servidor al editar. Usar HTTPS detrás de un proxy en producción.

## Estado actual

Agenda de **demostración**: horarios de ejemplo, sin reservas reales ni correos. El formulario demo no transmite ni guarda datos personales. Faltan cuenta Google, autorización del calendario, trayectoria, duración, precio, dirección, enlace online y condiciones de cancelación.

La foto adjunta al chat no está disponible como archivo en el entorno. Colocar la fotografía autorizada en `public/camila.jpg` activa el retrato automáticamente. Se muestran iniciales mientras tanto.

## Google Calendar y correo

1. Camila debe crear una cuenta en https://accounts.google.com/signup y activar recuperación y verificación en dos pasos. La web no crea cuentas ni pide contraseñas. Una dirección con dominio propio requiere dominio y Google Workspace.
2. Crear un calendario privado para la consulta. Copiar su ID desde ajustes de Calendar. Los bloqueos personales deben reflejarse en ese calendario: la web solo consulta ese calendario.
3. En Google Cloud, habilitar Calendar API, configurar consentimiento OAuth y cliente OAuth. Camila debe autorizar los alcances `https://www.googleapis.com/auth/calendar.events` y `https://www.googleapis.com/auth/calendar.freebusy` y obtener un refresh token con acceso offline. Google puede exigir verificación para una app externa; los tokens de apps en modo prueba pueden caducar en siete días. Usar autorización permanente antes de abrir reservas.
4. Configurar de forma segura las variables de `.env.example`. Nunca escribir secretos en Git ni enviarlos por chat. Se leen del proceso; no se carga `.env` automáticamente. Localmente se puede usar `node --env-file=.env server.js` con un archivo privado.
5. Definir duración, precio, dirección presencial, enlace HTTPS online, días (0 domingo a 6 sábado, separados por coma) y horas (`HH:MM`, separadas por coma). Todos son necesarios para activar el modo real. Evitar horarios que se solapen dada la duración.
6. Reiniciar. `/api/config` debe indicar `demo: false`. Realizar una reserva con datos propios y verificar evento privado, invitación recibida y bloqueo del horario. Esta integración real **no fue probada**: no hay cuenta autorizada.

El servidor consulta `freeBusy` y vuelve a comprobar el horario al reservar. Crea un evento privado con el paciente como asistente y `sendUpdates=all`: Google solicita el envío de la invitación. No hay un segundo servicio SMTP ni garantía de entrega en bandeja de entrada. Camila ve las reservas en Calendar y debe activar notificaciones por correo en su calendario para recibir avisos. El enlace online es fijo, no se generan enlaces Meet individuales.

## Antes de abrir al público

Confirmar y actualizar perfil profesional, duración, valor y política de cambios/cancelaciones. Revisar y publicar aviso de privacidad y condiciones. Se piden solo nombre, correo, modalidad y consentimiento; no hay información clínica ni pagos. Las reservas reales se guardan en Google Calendar; no hay base local ni auditoría separada de consentimiento.

Usar **una sola instancia**: la cola serializa reservas de la web, pero Google no ofrece bloqueo transaccional frente a cambios manuales o apps externas. Múltiples instancias requieren una base con exclusión e idempotencia. El límite por IP vive en memoria y debe complementarse con controles del proveedor al desplegar. Si un envío termina con timeout, revisar Calendar antes de repetir para evitar duplicados. No se ha publicado el sitio ni probado envío real de correo.

## Verificación

`npm test` comprueba horario chileno en invierno/verano, cruces de eventos, horas pasadas, datos y API demo. No requiere secretos ni envía correos.
