# Camila Leiva | Psicología online

Sitio de atención psicológica exclusivamente telemática, con agenda y reservas conectables a Google Calendar. Node.js **22.9 o superior**, sin dependencias externas.

La portada presenta el texto centrado y seis objetos abstractos animados. En escritorio responden suavemente al cursor. El control «Pausar movimiento» detiene la animación; se respeta la preferencia de movimiento reducido del sistema y se pausan los objetos fuera de pantalla.

## Abrir en Visual Studio Code

Si ya clonaste el repositorio, abre una terminal en su carpeta y ejecuta:

```sh
git pull origin main
npm start
```

El terminal mostrará una dirección como `http://localhost:3000`. Haz Ctrl+clic en ella o cópiala al navegador. El proceso debe permanecer abierto. Detener con Ctrl+C. No uses Live Server ni abras `index.html` directamente: las reservas necesitan el servidor Node.

Para una primera instalación:

```sh
git clone https://github.com/PaulaNarvaez/agendamiento_web.git
cd agendamiento_web
code .
npm start
```

`npm run dev` reinicia el servidor al editar. `.env` se carga automáticamente al iniciar; al cambiar sus valores reinicia el servidor. Si el puerto está ocupado, define otro `PORT` en `.env`, por ejemplo `PORT=3001`. El terminal imprimirá el puerto utilizado.

## Actualizar desde la versión con enlace fijo

Ejecuta `git pull origin main`, conserva tu `.env` y reinicia con `npm.cmd start` en Windows. No necesitas crear un enlace Meet ni volver a autorizar si ya concediste los permisos de Calendar. Comprueba `npm.cmd run check:config`: deben estar completos duración, valor, días y horas, además de las credenciales. Prueba dos reservas con datos propios y verifica que sus eventos e invitaciones contengan enlaces Meet diferentes. Las pruebas automatizadas usan Google simulado; la comprobación con la cuenta real sigue siendo necesaria.

## Estado de las reservas

Sin la configuración completa, la agenda es una **demostración**: horarios de ejemplo, sin guardar datos de pacientes, crear eventos ni enviar invitaciones. El sitio identifica este estado. No basta con indicar una dirección de correo: su titular debe autorizar el acceso a Google.

Cuenta propuesta: **heatherroseyt@gmail.com**. El correo no es una credencial y no otorga acceso al calendario. Todavía no se ha autorizado esta cuenta ni verificado el envío real de invitaciones.

## Si sigue apareciendo «Agenda de demostración»

En la terminal de VS Code, dentro de la carpeta del proyecto, ejecuta `npm.cmd run check:config` (Windows) o `npm run check:config` (otros sistemas). El informe muestra la ruta del `.env` esperado y únicamente los nombres de las variables vacías, nunca sus valores. Completa esos campos en tu computador, guarda el archivo, detén el servidor con Ctrl+C y vuelve a ejecutar `npm.cmd start`. No sobrescribas tu `.env` con la plantilla: perderías tu autorización de Google.

La autorización de Google y la configuración de la sesión son requisitos separados. Tener un refresh token no habilita reservas si falta duración, precio, días u horas. El informe verifica presencia; no garantiza que Google acepte las credenciales. Al iniciar en modo demo, el servidor también imprime automáticamente los campos que faltan.

## Conectar tu cuenta de Google (en tu propio computador)

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o selecciona un proyecto y habilita **Google Calendar API**.
2. Configura la pantalla de consentimiento OAuth en Google Auth Platform. Para una cuenta Gmail personal el público es externo. Mientras la aplicación esté en modo prueba, agrega `heatherroseyt@gmail.com` como usuario de prueba. Solicita los permisos `openid`, `email`, `https://www.googleapis.com/auth/calendar.events` y `https://www.googleapis.com/auth/calendar.freebusy`.
3. Crea un cliente OAuth de tipo **Aplicación de escritorio**. El ID de cliente proporcionado ya está incluido en `.env.example`. Copia el secreto completo al archivo `.env` local, usando `.env.example` como modelo. Si ya tienes un `.env`, actualiza solo `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` sin sobrescribir tus otros valores. Puedes crear la copia desde el explorador de VS Code. No subas `.env` a Git ni compartas contraseñas o tokens.
4. Conserva `GOOGLE_ACCOUNT_EMAIL=heatherroseyt@gmail.com` y `GOOGLE_CALENDAR_ID=heatherroseyt@gmail.com` para usar tu calendario principal. Después ejecuta:

   ```sh
   npm run connect:google
   ```

5. Abre el enlace de Google que imprime el terminal **en el mismo computador**. Inicia sesión en la cuenta indicada y concede los permisos. El asistente comprueba la cuenta autorizada y guarda el refresh token en `.env` sin mostrarlo. Usa un retorno local en el puerto 53682 y expira a los diez minutos. Este asistente es para desarrollo local, no es una ruta pública del sitio.
6. Define en `.env` la duración, valor, días y horas. No se incluyen valores clínicos ni comerciales inventados:

   | Variable | Contenido |
   | --- | --- |
   | `SESSION_DURATION_MINUTES` | Duración de la sesión en minutos, de 15 a 180 |
   | `SESSION_PRICE_CLP` | Valor en pesos chilenos, sin separadores |
   | `AVAILABLE_WEEKDAYS` | Días separados por coma: 0 domingo, 1 lunes … 6 sábado |
   | `AVAILABLE_HOURS` | Horas de inicio `HH:MM`, separadas por coma, horario de Chile |

7. Reinicia `npm start`. La página debe mostrar que la agenda está conectada. Comprueba con datos propios una reserva: evento en tu calendario, invitación recibida por el paciente, fecha/hora/profesional/enlace correctos y bloqueo del mismo horario. Esta prueba requiere autorización real y aún está pendiente.

En modo prueba de Google, los refresh tokens de apps externas pueden caducar a los siete días. Antes de abrir reservas públicas, completa los requisitos de publicación/verificación de Google. No uses una autorización temporal como conexión permanente.

### Qué se envía al paciente y qué ves tú

El servidor consulta la disponibilidad del calendario configurado y vuelve a comprobarla al reservar. Crea un evento **privado** llamado «Sesión online · Camila Leiva, psicóloga», con fecha, inicio y término en `America/Santiago`, modalidad telemática, instrucciones y enlace de conexión. Añade al paciente como asistente y solicita a Google el envío de la invitación con `sendUpdates=all`.

El evento aparece en el calendario de `heatherroseyt@gmail.com` cuando se usa ese ID. Los bloqueos que crees en ese mismo calendario impiden reservas superpuestas. Si usas un calendario secundario, copia su ID a `GOOGLE_CALENDAR_ID`, asegúrate de que tu cuenta tenga permiso de edición y refleja allí todos los bloqueos relevantes.

Para recibir avisos en tu propio correo, configura las notificaciones de ese calendario en Google Calendar. Cada paciente controla las notificaciones de su calendario. Los recordatorios configurados en el evento corresponden a la cuenta organizadora; no sustituyen ni garantizan los recordatorios del paciente. Las invitaciones dependen de Google y pueden llegar a spam: no hay un servicio SMTP separado ni seguimiento de entrega.

Cada reserva solicita un **Google Meet distinto** mediante `conferenceDataVersion=1` y un `requestId` nuevo. No necesitas crear reuniones manualmente ni configurar `ONLINE_SESSION_URL`; si esa variable existe en un `.env` antiguo, se ignora. La cuenta y el calendario autorizados deben permitir crear Google Meet.

La aplicación crea primero un evento provisional sin solicitar invitaciones, espera a que Google entregue el enlace y después actualiza la descripción y ubicación solicitando el envío a todos los asistentes. Si Google rechaza la creación de Meet o no termina a tiempo, se intenta eliminar el evento provisional y no se confirma la reserva. Si una operación queda incierta (por ejemplo, falla la actualización de invitaciones o la eliminación), se indica que hay que comprobar la reserva antes de reintentar. El correo depende de Google: no hay confirmación de entrega en bandeja de entrada.

## Contenido y publicación pendientes

Faltan confirmar formación, trayectoria, precio, duración, horarios y condiciones de cambios/cancelación. Publicar aviso de privacidad y condiciones antes de abrir reservas. Se recogen nombre, correo y consentimiento; no se solicitan antecedentes clínicos ni se procesan pagos. Las reservas reales se guardan en Google Calendar y no hay un registro de auditoría separado del consentimiento.

Para incorporar la fotografía autorizada de Camila, agrega `public/camila.jpg`. El retrato se muestra automáticamente; mientras tanto se usan sus iniciales. La foto del chat no está disponible como archivo del repositorio.

En producción usar HTTPS y **una sola instancia**. La cola evita reservas simultáneas dentro de esa instancia, pero no bloquea cambios manuales o aplicaciones externas en Google. Múltiples instancias requieren persistencia e idempotencia compartidas. Ante un timeout al crear un evento, comprobar Calendar antes de repetir para evitar duplicados. El límite por IP vive en memoria y debe complementarse con controles del proveedor. El sitio aún no está desplegado públicamente.

## Pruebas

```sh
npm test
```

Incluyen horarios de Chile, cruces de eventos, validación exclusivamente online, API de demostración y solicitudes de Google con respuestas simuladas. Las pruebas simuladas nunca envían invitaciones ni sustituyen la validación con una cuenta real.
