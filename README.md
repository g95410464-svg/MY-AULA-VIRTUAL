# Tu Aula Virtual

LMS funcional en español con una entrada común para alumnos, maestros, coordinadores y administradores. Backend Java 21 / Spring Boot 3.5, frontend React 19 / TypeScript y PostgreSQL. Los datos y los permisos se resuelven en el servidor.

## Qué incluye

| Rol | Funciones |
| --- | --- |
| Alumno | Asignaturas matriculadas, materiales, tareas publicadas, entrega y actualización antes del vencimiento, descarga privada, notas y observaciones, chat, avisos, horario y calendario. |
| Maestro | Materias y grupos asignados, tareas con publicación programada, adjuntos y modalidades de entrega, recursos por unidad, revisión de entregas, calificación, chat privado con coordinación, calendario con anotaciones y seguimiento. |
| Coordinador | Gestión académica de sus grupos, registro y matrícula de alumnos, calendario con anotaciones, avisos y chat privado con sus maestros. `can_manage` controla asignaciones y edición de horarios. Actividades, materias y reportes aparecen únicamente si también es Maestro. |
| Administrador | Usuarios y roles adicionales, maestros (alta, edición y desactivación), catálogos, grupos, matrículas, asignaciones, ámbitos, horario editable por maestro, calendario institucional y personal, mensajes privados y auditoría. Solo sus propias materias aparecen si también es Maestro. |

Interfaz adaptable a móviles, navegación lateral, búsqueda de asignaturas, modo oscuro, formularios con etiquetas, navegación por teclado, estados vacíos, errores y carga. Las conversaciones de asignatura/grupo son exclusivas de alumnos matriculados y su maestro. La mensajería privada separa coordinación/docencia de los mensajes de Administración; los alumnos solo pueden leer estos últimos.

El diseño institucional utiliza composición centrada, azul profundo y acentos dorados. El panel prioriza próximas entregas y clases del día; el acceso, los encabezados y los contenidos de lectura tienen límites de ancho para mantener una jerarquía clara en escritorio y móviles.

El acceso actual adapta [Login Page, de Marwan](https://www.figma.com/community/file/1249321675959577741/login-page), con variantes de escritorio/móvil y un emblema ficticio de Colegio Horizonte en lugar de la imagen floral. El nombre público del sistema es **Tu Aula Virtual**. El acceso utiliza exclusivamente el correo y la contraseña de la institución; no se muestran opciones de Google ni Facebook. Las ayudas de contraseña y solicitud de cuenta explican el procedimiento administrativo real. Los créditos y las diferencias tipográficas se detallan en `ASSET_CREDITS.md`.

## Jerarquía de roles y permisos

El menú **Jerarquía y permisos** presenta los niveles organizativos Administrador (4), Coordinador (3), Maestro (2) y Alumno (1), los roles efectivos de la sesión y la matriz de permisos. La API `GET /api/access-model` sirve este catálogo a usuarios autenticados. El nivel organizativo no concede permisos por comparación numérica: cada operación sigue validando rol, ámbito, asignación y propiedad; Admin y Coordinador necesitan Maestro para enseñar en sus materias.

## Inicio con Docker

Requisitos: Docker con motor activo y Compose.

1. Copia `.env.example` a `.env`.
2. Configura `POSTGRES_PASSWORD` y los datos del administrador en `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`.
3. Ejecuta `docker compose up --build -d` desde esta carpeta.
4. Abre <http://localhost:8080>.

El primer arranque aplica las migraciones y permite crear un único administrador con los datos configurados por entorno. La contraseña requiere un mínimo de 12 caracteres y un máximo de 72 bytes. Si no se configuran esas variables, no se crean usuarios. Si ya existen cuentas, la inicialización no las modifica ni restablece sus contraseñas.

La instalación no carga alumnos, maestros, grupos, materias ni actividades de ejemplo. Los datos ficticios pertenecen a las pruebas y no se incluyen en el JAR de producción. Las variables `INITIAL_ADMIN_*` se pueden retirar después de crear la cuenta.

## Desarrollo local

Requisitos: Java 21, Maven 3.9+, Node 22.12+ y PostgreSQL 17 o 18.

Configura por entorno:

```powershell
$env:DATABASE_URL = 'jdbc:postgresql://127.0.0.1:5432/aula'
$env:DATABASE_USER = 'aula'
$env:DATABASE_PASSWORD = '<tu contraseña local>'
$env:INITIAL_ADMIN_NAME = '<nombre del administrador>'
$env:INITIAL_ADMIN_EMAIL = '<correo institucional>'
$env:INITIAL_ADMIN_PASSWORD = '<contraseña inicial>'
```

La base y su usuario deben existir. Flyway aplica las migraciones al arrancar; el usuario de la aplicación necesita los privilegios de creación del esquema para ese paso.

En dos terminales:

```powershell
mvn -f backend/pom.xml spring-boot:run
```

```powershell
cd frontend
npm ci
npm run dev
```

Abre <http://127.0.0.1:5173>. Vite reenvía `/api` al backend en el puerto 8080, conservando el mismo origen para cookies y CSRF. No mezcles `localhost` y `127.0.0.1` en una sesión.

Si el host Windows/MSIX produce `Unable to establish loopback connection` al iniciar Tomcat, utiliza el conector NIO2 opcional:

```powershell
$env:APP_TOMCAT_NIO2 = 'true'
mvn -f backend/pom.xml spring-boot:run
```

## Compilación unificada

```powershell
./scripts/build.ps1
```

También puedes ejecutar `npm ci --prefix frontend`, `npm run build --prefix frontend` y `mvn -f backend/pom.xml -DskipTests package`. Maven empaqueta `frontend/dist` como recursos estáticos: el JAR sirve interfaz y API desde el mismo puerto.

```powershell
java -jar backend/target/aula-virtual-1.0.0.jar
```

`build.ps1` compila sin ejecutar las pruebas de base de datos. Ejecuta las verificaciones siguientes antes de desplegar cambios. El Dockerfile utiliza el mismo empaquetado y un usuario de ejecución sin privilegios.

## Pruebas

Las pruebas de integración utilizan PostgreSQL real, no una emulación en memoria. Crea una base **dedicada exclusivamente a pruebas**. Las pruebas cargan cuentas de prueba y realizan transacciones con rollback; no apuntes a una base institucional.

```powershell
$env:TEST_DATABASE_URL = 'jdbc:postgresql://127.0.0.1:5432/aula_test'
$env:TEST_DATABASE_USER = 'aula'
$env:TEST_DATABASE_PASSWORD = '<contraseña de la base de pruebas>'
mvn -f backend/pom.xml test
```

Los recorridos de navegador utilizan una instancia aislada con datos de prueba. La semilla de `backend/src/test/` requiere el perfil `demo` y el classpath de pruebas; no está disponible en la imagen de producción:

```powershell
cd frontend
npx playwright install chromium
$env:E2E_PASSWORD = '<contraseña del entorno de demostración>'
npm run test:e2e
```

`APP_URL` permite apuntar al JAR unificado; por defecto utiliza `http://127.0.0.1:5173`. `PLAYWRIGHT_EXECUTABLE_PATH` permite usar un Chromium existente. Las pruebas de navegador generan usuarios, tareas, mensajes y calificaciones en el entorno elegido: utiliza una instancia de demostración.

Consulta `VERIFICATION.md` para resultados efectivamente ejecutados, capturas y limitaciones.

## Arquitectura y seguridad

- `SecurityConfig`, `AuthController`, `Access`, `RolePolicy`: login unificado, BCrypt, sesiones HttpOnly/SameSite, CSRF, limitación de intentos y autorización por rol y grupo. Cada cuenta conserva un rol principal y puede añadir Maestro si es Admin/Coordinador. Las asignaciones docentes existentes también habilitan ese rol. La sesión expone autoridades inglesas `ROLE_*` y los alias `MAESTRO`, `COORDINADOR`, `ALUMNO`, `ADMIN`. Desactivar, cambiar rol o restablecer contraseña revoca las sesiones anteriores en la siguiente solicitud. Cambiar la contraseña cierra otras sesiones y conserva la actual.
- `AcademicController` y `PeopleController`: usuarios, roles, maestros, registro/matrícula de alumnos, catálogos, grupos, asignaciones y ámbitos. `/courses` contiene aulas personales; el campo `courses` de `/catalog` contiene las asignaciones administrativas. Las altas de alumnos del coordinador solo se realizan dentro de Gestión Académica.
- `ScheduleController`: consulta por docente y bloques editables. Valida solapamientos de docente/grupo y recesos; serializa escrituras con bloqueos de filas. Administración debe indicar `teacherId` para cargar un horario.
- `CalendarController`: anotaciones privadas por usuario/fecha y eventos institucionales que solo Administración crea o elimina. El calendario de Admin no incorpora las clases globales.
- `LearningController`: tareas, publicación, entregas, recursos, calificaciones y reportes. Una tarea calificada no se puede reenviar. Las fechas límite se validan en el servidor. Las notas se muestran al calificarse.
- `FileController`: documentos de hasta 5 MB, cuota de 100 MB por usuario, comprobación de extensión/MIME/contenido, límites de expansión de ZIP y de dimensiones de imagen. Descarga como adjunto y vista previa autorizada en otra pestaña para PDF/JPG/PNG mediante `?preview=true`. Un alumno no puede descargar archivos de entregas ajenas, incluso dentro de su mismo grupo. No se ofrecen vistas embebidas de documentos.
- `CommunicationController` y `DirectMessageController`: conversaciones por asignatura, avisos, notificaciones y mensajes privados. Solo los participantes pueden consultar una conversación privada; el alcance de coordinación se comprueba al leer y escribir. Un alumno no puede crear conversaciones privadas ni responder a Administración. El chat consulta cambios cada cinco segundos; las notificaciones cada quince. Se muestran hasta 100 mensajes recientes. La API permite recuperar mensajes posteriores con `after`.
- `PublicationNotifier`: notifica tareas al publicarse, con consulta cada treinta segundos y bloqueo transaccional para evitar duplicados.
- `db/migration`: claves foráneas, restricciones, índices, unicidad de matrícula/curso/entrega y migraciones versionadas.
- No se guardan tokens de autenticación en `localStorage`. Se guarda únicamente la preferencia visual. La autorización no depende de botones ocultos. Se registra la gestión administrativa, cambios de contraseña y calificaciones.

Spring JDBC se eligió en lugar de JPA para mantener explícitas las consultas de alcance y las transacciones en esta primera versión. Las capas de presentación y persistencia están separadas, aunque varios controladores aún agrupan la orquestación de negocio; una ampliación grande debe extraer esos casos de uso a servicios por módulo.

Los instantes de publicación, entrega y mensajes se guardan en UTC y se presentan en la zona horaria del navegador. Los horarios semanales son horas locales de la institución; coordina esa zona con los usuarios. `APP_TIMEZONE` configura la zona de la institución. No hay gestión multiinstitución ni conversión automática del horario recurrente entre zonas.

## API principal

| Área | Rutas |
| --- | --- |
| Sesión | `GET /api/auth/csrf`, `POST /api/auth/login` (formulario `email`/`password`), `GET /api/auth/me`, `POST /api/auth/password`, `POST /api/auth/logout` |
| Organización | `/api/catalog`, `/api/catalog/{type}`, `/api/groups`, `/api/groups/{id}/enrollments`, `/api/groups/{id}/coordinators`, `/api/courses`, `/api/courses/{id}/teacher` |
| Aprendizaje | `/api/courses/{id}/tasks`, `/api/tasks/{id}/files`, `/api/tasks/{id}/submission`, `/api/tasks/{id}/submissions`, `/api/submissions/{id}`, `/api/submissions/{id}/grade`, `/api/courses/{id}/resources` |
| Archivos | `POST /api/courses/{id}/files` (multipart), `GET /api/files/{uuid}` |
| Personas | `POST /api/academic/students`, `/api/teachers`, `/api/teachers/{id}`, `PUT /api/users/{id}/roles` |
| Horarios | `GET /api/schedules?teacherId={id}`, `POST /api/schedules`, `PUT/DELETE /api/schedules/{id}`, `/api/schedule-breaks` |
| Calendario | `GET /api/calendar/annotations?from=YYYY-MM-DD&to=YYYY-MM-DD`, `POST /api/calendar/annotations`, `DELETE /api/calendar/annotations/{id}`; mismo esquema para `/events` |
| Privados | `GET /api/message-recipients?search=...`, `GET/POST /api/conversations`, `GET/POST /api/conversations/{id}/messages` |
| Comunidad | `/api/courses/{id}/messages`, `/api/notices`, `/api/notifications`, `POST /api/notifications/{id}/read` |
| Operación | `/api/schedules`, `/api/reports`, `/api/users`, `/api/users/{id}/reset`, `/api/audit` |

Obtén primero el token CSRF y envíalo en `X-XSRF-TOKEN` en todas las mutaciones. El login rota la sesión y el token; solicita otro token después de ingresar. La cookie de sesión se envía en las siguientes llamadas del mismo origen.

## Operación y siguiente etapa

El sistema es una primera versión funcional verificable, no una certificación de seguridad ni de capacidad de producción. El despliegue público no se ha realizado.

Para servirlo a una institución, configura HTTPS y `COOKIE_SECURE=true`, restringe PostgreSQL a la red privada, configura respaldo/restauración y prueba la recuperación. El puerto de Compose se publica únicamente en loopback para colocarlo detrás de un proxy HTTPS. Las sesiones y el límite de intentos están en memoria de una sola instancia; al reiniciar se requiere volver a ingresar. Para varias réplicas se necesita un almacén compartido de sesiones y rate limiting.

Las ampliaciones registradas incluyen almacenamiento de objetos con análisis antivirus, retención y limpieza de archivos huérfanos, paginación completa, edición/versionado de tareas y recursos, mensajería directa si la institución la requiere, notificaciones por correo/push, pruebas de concurrencia/carga y revisión de accesibilidad formal. Los videos se comparten por URL; no se aloja ni transcodifica video.

No existe eliminación permanente de usuarios ni un botón que simule esa operación. Se conservan las entregas y la auditoría al desactivar cuentas. La protección contra cambios accidentales incluye confirmaciones al retirar matrículas, coordinación y clases del horario.

## Referencias técnicas

- [Requisitos oficiales de Spring Boot 3.5](https://docs.spring.io/spring-boot/3.5/system-requirements.html).
- [Guía oficial de Vite](https://vite.dev/guide/).
