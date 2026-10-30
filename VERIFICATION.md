# Verificación — Examen final, versión 1

Fecha: 29 de octubre de 2026, America/Guatemala.

## Resultado ejecutado

| Comprobación | Resultado |
| --- | --- |
| TypeScript / React 19 / Vite, build de producción | Correcto |
| JUnit / Spring Boot Test / Spring Security / PostgreSQL real | **26 pruebas, 0 fallos, 0 errores, 0 omitidas** |
| Playwright / Chromium contra JAR unificado en instancia de prueba separada | **16 pruebas aprobadas, 51,0 segundos** |
| Flyway en base nueva de navegador | V1, V2 y V3 aplicadas correctamente |
| Flyway en base local existente | Actualización V2 → V3 correcta |
| Aplicación local en http://127.0.0.1:8080/ | HTTP 200 y acceso de los cuatro roles comprobado |
| Conservación de datos existentes | Iguales recuentos de usuarios, cursos, tareas, entregas, archivos y mensajes antes/después de actualizar |
| Diseño y modo oscuro | Ambos archivos CSS conservan exactamente su SHA-256; captura de horario en modo oscuro revisada |

Entorno: Windows, Java 21.0.13, Maven 3.9.11, Spring Boot 3.5.16, React 19, TypeScript 5.9, Vite 7.3.7 y PostgreSQL 18.4. Las pruebas de API y navegador usan bases distintas de la aplicación local. Se realizó una copia de respaldo de la base local antes de migrar.

## Jerarquía de roles y permisos

Se añadió `RolePolicy.Profile` con niveles organizativos y `GET /api/access-model`, más la vista React `Jerarquía y permisos`. No se usa el nivel para heredar privilegios: las validaciones docentes y de datos privados se conservan. La prueba nueva verifica los cuatro niveles, el catálogo autenticado, el doble rol y que un Admin no pueda crear tareas ajenas. Playwright comprueba el menú, la matriz, los cuatro roles, modo oscuro y ausencia de desbordamiento en móvil.

Evidencias adicionales: [Jerarquía en modo oscuro](evidence/hierarchy-dark.png), [Jerarquía en móvil](evidence/hierarchy-mobile.png).

## Cobertura de seguridad y funcionalidad

- Roles efectivos: principal más Maestro explícito o derivado de una asignación; autoridades de sesión y alias españoles. Revocación por edición del rol. Un Admin con Maestro accede a sus propias materias, no a las de otros docentes.
- Admin/Coordinador sin Maestro: cursos personales vacíos, sin acceso a actividades, entregas, recursos, conversaciones de clase ni reportes. Gestión académica usa un catálogo separado.
- Matrículas idempotentes, rechazo de roles incompatibles, alumnos sin grupo disponibles para matrícula y registro atómico de alumno/matrícula dentro del ámbito del coordinador, incluso sin permiso de editar horarios. El coordinador no puede usar Usuarios ni registrar fuera de su ámbito.
- Alta, consulta, edición y desactivación de maestros, contraseña temporal obligatoria, conservación de asignaciones y cierre de sesiones al desactivar.
- Anotaciones personales: creación, persistencia, listado por fechas, eliminación propia, aislamiento entre usuarios y CSRF. Eventos institucionales de lectura para la comunidad y escritura de Admin.
- Horarios: Admin sin horario global inicial, filtro por maestro, actualización de bloques, exclusión del propio bloque en la búsqueda de conflictos, bloques contiguos, recesos y rechazo de solapamientos. Edición del coordinador limitada a grupos con `can_manage`.
- Conversaciones privadas de Maestro–Coordinador: filtro por grupos compartidos y comprobación de participantes en todas las lecturas/escrituras. Alumnos, otros maestros y administradores ajenos no pueden consultar ni enviar en esas conversaciones. Retirar el ámbito revoca el acceso.
- Administración → Alumno: alumno puede leer; creación y respuesta denegadas en API aunque se manipule la solicitud. Un destinatario docente sí puede responder.
- Entregas: apertura desde Actividades, contador actualizado al recibir una entrega, archivo subido de extremo a extremo, metadatos, detalle, descarga real y cabecera de vista previa. Un alumno retirado del grupo conserva su entrega histórica visible para el maestro.
- Regresiones: login, CSRF, anonimato, acceso horizontal, publicación programada, notas, fechas límite, validación MIME/contenido/URL, archivos ajenos, reset/cambio de contraseña, chat de clase, avisos, notificaciones y auditoría.
- Interfaz: navegación de los cuatro roles, calendario, registro/matrícula y maestros, doble rol de Admin, recepción automática de conversación privada, bandeja del alumno sin formulario de respuesta, modo oscuro, vista móvil sin desbordamiento y acceso Figma institucional sin Google/Facebook.

## Evidencias

- [Resultado JUnit](evidence/junit.txt)
- [Resultado Playwright completo](evidence/playwright-final.txt)
- [Detalle de entrega y adjunto](evidence/submission-detail.png)
- [Horario de Admin en modo oscuro](evidence/admin-schedule-dark.png)
- [Gestión académica de Coordinador](evidence/coordinator-management.png)
- [Mensajes de solo lectura del alumno](evidence/student-private-readonly.png)
- [Acceso de escritorio](evidence/figma-login-desktop.png)
- [Acceso móvil](evidence/figma-login-mobile.png)
- [Materiales en modo oscuro](evidence/dark-materials.png)

SHA-256 de `frontend/src/style.css`: `1CF627C01AF4E9E481C599EE322409F0F9FD954EF9EF604352D60EE5A5F9EDFF`.

SHA-256 de `frontend/src/login-figma.css`: `BF46731BB0EA95AE587B6C85C3BD9931AF6BAA5240A88EFBEA1258FEE4AF77AD`.

## Límites de lo verificado

Las pruebas se ejecutaron sobre PostgreSQL 18.4 local. Flyway emite una advertencia de compatibilidad porque su versión declara compatibilidad probada hasta PostgreSQL 17; las tres migraciones y las pruebas aprobaron en esta instancia. Docker/Compose y el despliegue público no se ejecutaron en esta revisión. No se realizaron pruebas de carga sostenida, penetración ni una auditoría formal de accesibilidad. La desactivación del maestro conserva sus materias; el administrador puede reasignarlas desde Gestión Académica.

La vista previa se abre en otra pestaña para PDF/JPG/PNG; DOCX/PPTX se descargan. Los recesos son bloques configurados y persistidos, no horarios inventados automáticamente. Las conversaciones conservan los 100 mensajes recientes en la vista y utilizan consultas periódicas; las sesiones continúan siendo de una sola instancia.
