# Requisitos y validación

La suite se ejecuta con `npm test` usando datos temporales. Sus resultados corresponden al código ejecutado, no a las declaraciones del documento académico. Se conserva la suite del flujo inicial y se amplía para los cambios de la versión 2.

| Requisito / mejora                                                                                   | Evidencia automatizada                                               |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Inicio/cierre de sesión, credenciales y rutas protegidas                                             | `test/system.test.js`: Inicio de sesión; Cambio de contraseña        |
| Usuarios, roles y categorías                                                                         | `system.test.js`: Usuarios; Retiro lógico y categorías referenciadas |
| Carga y formato/tamaño                                                                               | `system.test.js`: Carga válida y rechazo                             |
| Búsqueda y descarga íntegra                                                                          | `system.test.js`: Privacidad y búsqueda                              |
| Edición y conservación al reiniciar                                                                  | `system.test.js`: Edición; Persistencia                              |
| Permisos por área y ausencia de filtración en listados/conteos                                       | `test/upgrades.test.js`: Asignación de área                          |
| Aprobación y observaciones                                                                           | `upgrades.test.js`: Observaciones obligatorias y aprobación          |
| Vista previa autenticada y filtros combinados                                                        | `upgrades.test.js`: Vista previa PDF                                 |
| Excel con celdas de texto e inventario imprimible según permisos                                     | `upgrades.test.js`: Excel real y reporte imprimible                  |
| Versiones íntegras y rechazo de aprobación de versión desactualizada                                 | `upgrades.test.js`: Historial de versiones                           |
| Papelera y recuperación con revisión pendiente                                                       | `upgrades.test.js`: Papelera                                         |
| Respaldo de documentos/versiones sin sesiones ni credenciales iniciales                              | `upgrades.test.js`: Respaldo íntegro                                 |
| Restauración con servidor detenido, rechazo de alteraciones/rutas y recuperación de bytes originales | `upgrades.test.js`: Restauración                                     |
| Respaldo automático y retención                                                                      | `upgrades.test.js`: Respaldo automático al reiniciar                 |
| Migración v1 sin pérdida de fechas, IDs, retiro ni archivos; repetibilidad                           | `upgrades.test.js`: Migración desde v1                               |

La comprobación de programación automática simula una copia de más de 24 horas y reinicia el servidor; no espera un día real. La vista previa automatizada comprueba tipo MIME y bytes. La exportación PDF utiliza la impresión del navegador, no un motor PDF del servidor. La suite no prueba un antivirus, envíos de correo, firma digital ni OCR porque esas funciones no existen.

## Revisión en navegador

Comprobar en Chromium y, antes de la instalación institucional, también en los navegadores usados por el instituto:

1. Ingreso, cambio de cuenta y navegación según el rol.
2. Creación de área y usuario, carga de PDF y vista previa.
3. Observación, nueva versión, aprobación y consulta según área.
4. Búsqueda combinada, descarga Excel y generación de PDF desde impresión.
5. Retiro y restauración desde papelera.
6. Creación y descarga de respaldo.
7. Pantalla móvil y ausencia de errores JavaScript.

La prueba de migración parte de una base v1 con un documento retirado y verifica su conservación. La restauración usa el comando real del proyecto sobre datos temporales y comprueba que las versiones originales se descargan con los mismos bytes.

## Medición para el proyecto de grado

No se presentan mejoras porcentuales de tiempo sin medirlas. Para obtener evidencia institucional:

1. Selecciona, con autorización, un conjunto de documentos y tareas representativas.
2. Pide a los mismos participantes localizar documentos con el proceso anterior y con SYSDOCU. Alterna el orden para reducir el efecto de aprendizaje.
3. Registra identificador de la tarea, participante anonimizado, método, segundos, éxito/error y observaciones. No incluyas contenido personal en el informe.
4. Compara medianas de tiempo y proporción de tareas completadas, indicando tamaño de muestra y condiciones.
5. Adjunta capturas sin credenciales, resultados de pruebas y las limitaciones observadas.

Actualiza los requisitos, alcance, diagramas y casos de uso del documento académico para incluir versiones, revisiones, áreas, reportes y respaldo. Distingue funciones implementadas de propuestas futuras.
