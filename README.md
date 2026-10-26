# Camila Leiva | Psicología online

Sitio de atención psicológica exclusivamente telemática, con agenda y reservas conectables a Google Calendar. Node.js **22.9 o superior**, sin dependencias externas.

La portada presenta el texto centrado y seis objetos abstractos animados. En escritorio responden suavemente al cursor. El control «Pausar movimiento» detiene la animación; se respeta la preferencia de movimiento reducido del sistema y se pausan los objetos fuera de pantalla.

## Primera configuración o .env vacío

```sh
git pull origin main
npm.cmd run setup
npm.cmd run dev
```

`setup` crea `.env` a partir de la plantilla si falta o está vacío. Pregunta únicamente por el ID y el secreto OAuth que falten (el secreto se introduce sin mostrarse), y después pregunta duración, precio, días y horarios. Conserva las credenciales existentes y el token si siguen correspondiendo a la cuenta y al cliente configurados. Si cambias el cliente o la cuenta, deja el token vacío para pedir una autorización nueva. Introduce los datos de Google en tu terminal local, nunca en el chat.

No hay un `.env` de pruebas con credenciales reales. `.env.example` es solo una plantilla; `npm test` usa respuestas simuladas de Google sin conectar con una cuenta ni enviar invitaciones. El `.env` privado no se descarga con Git. Para sustituir credenciales ya guardadas, usa `npm.cmd run setup:env -- --replace-google`.

## Importar el archivo de Google sin pegar JSON

```sh
npm.cmd run setup:google
npm.cmd run dev
```

En Windows se abre un selector: elige el archivo `.json` descargado de Google Cloud. En otros sistemas se solicita su ruta. No pegues JSON en PowerShell ni en CMD. El asistente lee el archivo, valida la URI de retorno y guarda ID y secreto únicamente en `.env`. Después pregunta los datos de atención.

Para indicar directamente un archivo y conservar los datos de sesiones:

```sh
npm.cmd run setup:env -- --json-file "C:\Users\Paula\Downloads\client_secret.json"
```

Usa el nombre real de tu archivo. Si cancelas la selección o el archivo no es válido, no se modifica `.env`. El modo anterior de pegado oculto sigue disponible con `npm.cmd run setup:env -- --json`.

Usa credenciales activas del mismo cliente. Si compartiste el secreto en un chat o repositorio, reemplázalo en Google Cloud y utiliza el nuevo únicamente en tu computador.

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

`npm run dev` abre la autorización de Google si falta el token (con el ID y el secreto ya configurados), espera a que termine y luego inicia el servidor con recarga al editar. Si faltan credenciales o datos de atención, se detiene indicando los nombres de las variables pendientes. La apertura automática requiere un navegador local; si falla, abre el enlace impreso en ese mismo computador. `.env` se carga automáticamente al iniciar; al cambiar sus valores reinicia el servidor. Si el puerto está ocupado, define otro `PORT` en `.env`, por ejemplo `PORT=3001`. El terminal imprimirá el puerto utilizado.

## Actualizar desde la versión con enlace fijo

Ejecuta `git pull origin main`, conserva tu `.env` y reinicia con `npm.cmd start` en Windows. No necesitas crear un enlace Meet ni volver a autorizar si ya concediste los permisos de Calendar. Comprueba `npm.cmd run check:config`: deben estar completos duración, valor, días y horas, además de las credenciales. Prueba dos reservas con datos propios y verifica que sus eventos e invitaciones contengan enlaces Meet diferentes. Las pruebas automatizadas usan Google simulado; la comprobación con la cuenta real sigue siendo necesaria.

## Publicar sin dejar tu computador encendido: Render

El repositorio incluye `render.yaml`, Node 24 y un lockfile para instalar con `npm ci`. La configuración solicita un servicio web con plan **Free**. Comprueba disponibilidad y condiciones del plan en Render antes de crearlo; no se ha realizado un despliegue desde este entorno ni se verificaron sus condiciones comerciales actuales. La URL pública la asigna Render al crear el servicio.

1. Sube la foto y cualquier cambio pendiente a GitHub.
2. En [Render](https://render.com/), entra con GitHub usando **PaulaNarvaez**.
3. Elige **New → Blueprint**, conecta `PaulaNarvaez/agendamiento_web` y selecciona `main`.
4. Revisa que el servicio indique **Free**. Completa los valores privados que solicita el Blueprint: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `SESSION_DURATION_MINUTES`, `SESSION_PRICE_CLP`, `AVAILABLE_WEEKDAYS` y `AVAILABLE_HOURS`. Usa los valores activos de tu `.env` local, sin publicarlos en GitHub. La cuenta y calendario ya se fijan a `pruebacami12@gmail.com`.
5. Despliega y espera a que Render marque el servicio como activo. Abre la dirección HTTPS `.onrender.com` que muestre su panel. Usa esa dirección para compartir la web.
6. Haz una reserva con datos propios y comprueba Calendar, Meet e invitación. El endpoint `/health` comprueba el proceso web, no el envío de correos ni la autorización de Google.

Tu computador puede apagarse: el servidor está en Render. Los planes gratuitos pueden suspender servicios por inactividad y tener arranques lentos, cuotas y limitaciones. Es una opción para comenzar y mostrar el proyecto, sin garantía de disponibilidad continua. Para atención de pacientes con requisitos de disponibilidad, evalúa un plan con servicio permanente.

La autorización de Google se completa primero en tu computador; en Render se ejecuta `npm start`, no el asistente interactivo. El callback local de Google no necesita convertirse en la URL pública porque la web no inicia sesiones OAuth de pacientes. Una app OAuth en modo prueba puede requerir renovar su autorización a los siete días. No publiques un secreto expuesto: reemplázalo y usa credenciales activas.

El Blueprint configura `TRUST_PROXY_HOPS=1` para identificar visitantes detrás del proxy y evitar compartir el mismo límite de reservas entre todos. No actives esa opción en otros entornos sin revisar su cadena de proxies. Se usa una sola instancia. Las reservas permanecen en Google Calendar; la foto se recupera desde GitHub en cada despliegue.

## Incorporar la foto de Camila

Guarda la fotografía original como JPG, PNG o WebP en tu computador. En Windows ejecuta:

```powershell
npm.cmd run setup:photo
```

Selecciona la imagen en la ventana. Se copia sin modificar sus bytes a `public/camila.jpg`, `public/camila.png` o `public/camila.webp`, según su formato real; la web aplica el difuminado mediante CSS. Si había una imagen distinta, se conserva un respaldo en `.local-backups`, excluido de Git. Después súbela:

```powershell
git add "public/camila.*"
git commit -m (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
git push origin main
```

Conserva la foto en el repositorio para que aparezca también en Render. La vista previa de la imagen dentro del chat no es un archivo disponible para el despliegue.

## Estado de las reservas

Sin la configuración completa, la agenda muestra **«Agenda no disponible»** y bloquea la selección de horarios y el formulario. No ofrece horas de ejemplo ni un botón de reserva ficticia. Las API de disponibilidad y reserva responden con 503 hasta completar la configuración. No basta con indicar una dirección de correo: su titular debe autorizar el acceso a Google.

Cuenta organizadora prevista: **pruebacami12@gmail.com**. El correo no es una credencial y no otorga acceso al calendario. Todavía no se ha autorizado esta cuenta ni verificado el envío real de invitaciones.

## Completar duración, precio, días y horas sin editar archivos

Ejecuta `npm.cmd run setup:sessions` en Windows (o `npm run setup:sessions`). El asistente pregunta los cuatro datos reales de atención y los guarda en tu `.env` local, conservando las credenciales de Google. Los valores de ejemplo de las preguntas no se guardan automáticamente. Si ya existe un valor, Enter permite conservarlo. Las horas se interpretan en Chile y no pueden superponerse según la duración indicada. Al terminar, inicia con `npm.cmd run dev`.

`git pull` actualiza el código y la plantilla pública; no completa tu `.env` privado.

## Si la agenda no está habilitada

En la terminal de VS Code, dentro de la carpeta del proyecto, ejecuta `npm.cmd run check:config` (Windows) o `npm run check:config` (otros sistemas). El informe muestra la ruta del `.env` esperado y únicamente los nombres de las variables vacías, nunca sus valores. Completa esos campos en tu computador, guarda el archivo, detén el servidor con Ctrl+C y vuelve a ejecutar `npm.cmd start`. No sobrescribas tu `.env` con la plantilla: perderías tu autorización de Google.

La autorización de Google y la configuración de la sesión son requisitos separados. Tener un refresh token no habilita reservas si falta duración, precio, días u horas. El informe verifica presencia; no garantiza que Google acepte las credenciales. Al iniciar sin la configuración completa, el servidor también imprime automáticamente los campos que faltan. Si ves «Probar reserva de demostración», estás ejecutando una versión anterior: actualiza el código, reinicia el proceso y recarga el navegador.

## Cambiar las invitaciones a pruebacami12@gmail.com

Detén el servidor antes de cambiar de cuenta. En Google Auth Platform → Público, agrega `pruebacami12@gmail.com` como usuario de prueba si la app continúa en modo prueba. Después ejecuta:

```sh
git pull origin main
npm.cmd run connect:google -- --account=pruebacami12@gmail.com
npm.cmd run dev
```

En el navegador autoriza **pruebacami12@gmail.com**. La cuenta permitida es exclusivamente `pruebacami12@gmail.com`, incluso si tu `.env` conserva otra. `npm.cmd run dev` inicia una nueva autorización cuando detecta la cuenta o el calendario anteriores. El parámetro `--account` se admite para esa misma dirección y rechaza otras. Solo después de verificar la nueva cuenta, el asistente actualiza `GOOGLE_ACCOUNT_EMAIL`, `GOOGLE_CALENDAR_ID` y `GOOGLE_REFRESH_TOKEN` en `.env`. Conserva ID, secreto, duración, precio y horarios. No reemplaces tu `.env` por la plantilla.

Las nuevas reservas se crean en el calendario principal de la nueva cuenta, que será la organizadora de las invitaciones. Google controla la dirección técnica que entrega sus notificaciones; no es un correo SMTP personalizado. Los eventos existentes de la cuenta anterior no se migran ni se eliminan, y sus bloqueos no se consultan en el calendario nuevo: refleja allí las sesiones vigentes antes de aceptar nuevas reservas.

## Conectar tu cuenta de Google (en tu propio computador)

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o selecciona un proyecto y habilita **Google Calendar API**.
2. Configura la pantalla de consentimiento OAuth en Google Auth Platform. Para una cuenta Gmail personal el público es externo. Mientras la aplicación esté en modo prueba, agrega `pruebacami12@gmail.com` como usuario de prueba. Solicita los permisos `openid`, `email`, `https://www.googleapis.com/auth/calendar.events` y `https://www.googleapis.com/auth/calendar.freebusy`.
3. Crea un cliente OAuth de tipo **Aplicación de escritorio**. El ID de cliente proporcionado ya está incluido en `.env.example`. Copia el secreto completo al archivo `.env` local, usando `.env.example` como modelo. Si ya tienes un `.env`, actualiza solo `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` sin sobrescribir tus otros valores. Puedes crear la copia desde el explorador de VS Code. No subas `.env` a Git ni compartas contraseñas o tokens.
4. Conserva `GOOGLE_ACCOUNT_EMAIL=pruebacami12@gmail.com` y `GOOGLE_CALENDAR_ID=pruebacami12@gmail.com` para usar tu calendario principal. Después ejecuta:

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

7. Reinicia `npm start`. La página debe mostrar que la agenda está habilitada. Comprueba con datos propios una reserva: evento en tu calendario, invitación recibida por el paciente, fecha/hora/profesional/enlace correctos y bloqueo del mismo horario. Esta prueba requiere autorización real y aún está pendiente.

En modo prueba de Google, los refresh tokens de apps externas pueden caducar a los siete días. Antes de abrir reservas públicas, completa los requisitos de publicación/verificación de Google. No uses una autorización temporal como conexión permanente.

### Qué se envía al paciente y qué ves tú

El servidor consulta la disponibilidad del calendario configurado y vuelve a comprobarla al reservar. Crea un evento **privado** llamado «Sesión online · Camila Leiva, psicóloga», con fecha, inicio y término en `America/Santiago`, modalidad telemática, instrucciones y enlace de conexión. Añade al paciente como asistente y solicita a Google el envío de la invitación con `sendUpdates=all`.

El evento aparece en el calendario de `pruebacami12@gmail.com` cuando se usa ese ID. Los bloqueos que crees en ese mismo calendario impiden reservas superpuestas. Esta instalación solo admite el calendario principal de `pruebacami12@gmail.com`. La aplicación comprueba también que el token pertenezca a esa cuenta; una autorización de otra cuenta se rechaza antes de consultar o modificar eventos.

Para recibir avisos en tu propio correo, configura las notificaciones de ese calendario en Google Calendar. Cada paciente controla las notificaciones de su calendario. Los recordatorios configurados en el evento corresponden a la cuenta organizadora; no sustituyen ni garantizan los recordatorios del paciente. Las invitaciones dependen de Google y pueden llegar a spam: no hay un servicio SMTP separado ni seguimiento de entrega.

Cada reserva solicita un **Google Meet distinto** mediante `conferenceDataVersion=1` y un `requestId` nuevo. No necesitas crear reuniones manualmente ni configurar `ONLINE_SESSION_URL`; si esa variable existe en un `.env` antiguo, se ignora. La cuenta y el calendario autorizados deben permitir crear Google Meet.

La aplicación crea primero un evento provisional **sin invitados**, espera a que Google entregue el enlace y después añade al paciente, actualiza la descripción y ubicación y solicita el envío a todos los asistentes. Así el paciente recibe una invitación inicial con el Meet listo. Si Google rechaza la creación de Meet o no termina a tiempo, se intenta eliminar el evento provisional y no se confirma la reserva. Si una operación queda incierta (por ejemplo, falla la actualización de invitaciones o la eliminación), se indica que hay que comprobar la reserva antes de reintentar. El correo depende de Google: no hay confirmación de entrega en bandeja de entrada.

## Si el evento aparece pero la invitación falla

No repitas la reserva: el evento puede existir aunque falle una etapa posterior. La web muestra «Reserva pendiente de revisión» si se creó el evento pero no se confirmó el envío. La aplicación no garantiza entrega del correo ni la verifica.

En el terminal del servidor busca la línea `[Agenda] etapa=...; HTTP=...; motivo=...`. Contiene únicamente códigos, nunca tokens, nombres de pacientes o respuestas completas de Google. Identifica si falló crear el evento, generar Meet, revertir un evento provisional o enviar la invitación.

Ejecuta `npm.cmd run check:google` para verificar autorización/disponibilidad y contar los eventos recientes con Meet e invitados. Es de solo lectura, no muestra datos de pacientes, no envía correos y revisa como máximo los 50 próximos eventos.

Para una reserva ya creada, abre ese evento en Google Calendar, comprueba el enlace de Meet y el correo del paciente en Invitados, guarda y elige enviar invitaciones si Google lo solicita. Esto permite gestionar ese evento sin duplicarlo. Los eventos anteriores no se reparan automáticamente al actualizar el código.

### Error 403 rateLimitExceeded al enviar una invitación

Este rechazo viene de Google y puede corresponder a límites de solicitudes o de uso del calendario/invitaciones. La aplicación reintenta únicamente rechazos explícitos 403 `rateLimitExceeded`/`userRateLimitExceeded` y 429, con espera exponencial y variación aleatoria, hasta cuatro intentos sobre **el mismo evento**. No crea otro evento ni otro Meet. Respeta `Retry-After` expresado en segundos o como fecha; si Google exige más de diez segundos, deja el envío pendiente en vez de reintentar antes de tiempo.

Si el límite persiste, el mensaje identifica la limitación y conserva la sesión para revisión. No hay una cola en segundo plano ni reenvío posterior garantizado. Espera a que Google permita enviar de nuevo y gestiona la invitación en el evento existente de Calendar. No repitas reservas para probar: eso genera más actividad. La consola de Google Cloud → Calendar API → Cuotas puede ayudar a distinguir límites de API; algunos límites de uso e invitaciones se gestionan aparte y no se eliminan aumentando cuotas. No se puede prometer un plazo de recuperación.

## Error al intercambiar la autorización de Google

El asistente muestra un mensaje específico y una línea `[OAuth] HTTP=...; motivo=...`, sin imprimir el secreto, código, token ni la descripción completa de Google. `invalid_client` requiere revisar el ID y el secreto del mismo cliente OAuth en `.env`, especialmente después de rotar el secreto. `invalid_grant` requiere reiniciar el asistente y autorizar desde el enlace nuevo, comprobando la URI de retorno. No copies credenciales a la plantilla pública ni compartas el `.env` para diagnosticar.

## Contenido y publicación pendientes

Faltan confirmar formación, trayectoria, precio, duración, horarios y condiciones de cambios/cancelación. Publicar aviso de privacidad y condiciones antes de abrir reservas. Se recogen nombre, correo y consentimiento; no se solicitan antecedentes clínicos ni se procesan pagos. Las reservas reales se guardan en Google Calendar y no hay un registro de auditoría separado del consentimiento.

Para incorporar la fotografía autorizada de Camila, agrega `public/camila.jpg`, `camila.jpeg`, `camila.png` o `camila.webp`. Se aceptan mayúsculas en el nombre y la extensión. Si solo hay una imagen JPG/JPEG/PNG/WebP en `public`, se usa aunque tenga otro nombre; si hay varias, usa el nombre `camila` para evitar ambigüedad. No basta con cambiar la extensión de un formato distinto: exporta la foto a uno de los formatos admitidos.

El retrato carga independientemente de Google. Después de copiar la foto, recarga la página; no es necesario volver a autorizar. En tu navegador local abre `http://localhost:3000/api/portrait`: debe mostrar la imagen. Si responde «Fotografía no disponible», revisa que el archivo esté en la carpeta `public` de la misma copia del proyecto que estás ejecutando. La imagen enviada solo como vista previa en el chat no se incorpora automáticamente al repositorio.

En producción usar HTTPS y **una sola instancia**. La cola evita reservas simultáneas dentro de esa instancia, pero no bloquea cambios manuales o aplicaciones externas en Google. Múltiples instancias requieren persistencia e idempotencia compartidas. Ante un timeout al crear un evento, comprobar Calendar antes de repetir para evitar duplicados. El límite por IP vive en memoria y debe complementarse con controles del proveedor. El sitio aún no está desplegado públicamente.

## Pruebas

```sh
npm test
```

Incluyen horarios de Chile, cruces de eventos, validación exclusivamente online, bloqueo de reservas sin configuración y solicitudes de Google con respuestas simuladas. Las pruebas simuladas nunca envían invitaciones ni sustituyen la validación con una cuenta real.
