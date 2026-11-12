# SYSDOCU 2.1 · Instituto Tecnológico CEICOM

Sistema web de gestión documental en **JavaScript, Node.js, Express y SQLite**. Interfaz en español para computadora y móvil. No necesita MySQL, XAMPP ni compilación del frontend.

## Ejecutar en Windows

Instala **Node.js 24 LTS** (mínimo 22.13). Abre una terminal en la carpeta del proyecto:

```powershell
npm.cmd install
npm.cmd run dev
```

Abre `http://localhost:3000`. En Linux/macOS usa `npm install` y `npm run dev`. `npm start` ejecuta sin vigilancia de archivos. Para detener, Ctrl+C.

### Primer ingreso

- Correo: `admin@ceicom.edu.bo`.
- Contraseña aleatoria: archivo local `data/acceso-inicial.txt`, creado en el primer arranque.

Cambia la contraseña desde **Mi cuenta** y elimina ese archivo si ya no lo necesitas. No se sirve por HTTP ni se incluye en respaldos. Puedes definir `ADMIN_PASSWORD` antes del primer arranque; no reemplaza contraseñas existentes. El administrador crea las cuentas del personal.

## Actualizar desde la versión anterior sin perder datos

1. Detén el servidor anterior con Ctrl+C.
2. Guarda una copia externa de **toda** la carpeta `data`.
3. Extrae la nueva versión en otra carpeta y copia allí tu carpeta `data` anterior. No reemplaces los datos con una carpeta vacía.
4. Ejecuta los dos comandos de instalación e inicio anteriores.

La migración es automática: conserva usuarios, contraseñas, archivos, IDs, fechas y documentos retirados. Crea una versión inicial para cada archivo y asigna los registros al área **General**. Los documentos anteriores conservan su disponibilidad con estado **Aprobado**; los nuevos, restaurados o modificados quedan **Pendientes**. Se crea además un respaldo previo a la migración si existen usuarios. La aplicación impide usar simultáneamente la misma carpeta de datos desde dos procesos del sistema.

## Funciones incluidas

- Usuarios, roles, áreas/carreras y categorías configurables.
- Carga PDF/DOC/DOCX de hasta 10 MB, validación básica de formato y archivos fuera de la carpeta pública.
- Gestión académica, título, descripción, categoría, área, responsable y visibilidad.
- Búsqueda y filtros combinables por texto, categoría, área, responsable, formato, estado, gestión y fechas de creación.
- Vista previa de PDF autenticada; Word se descarga. El visor depende del soporte PDF del navegador.
- Versiones de archivos: conserva originales, autor, fecha, nota y SHA-256; cada carga nueva vuelve a revisión.
- Revisión con estados **Pendiente**, **Aprobado** y **Observado**, comentarios e historial de decisiones por versión. Las observaciones requieren comentario. Se rechaza la aprobación si la versión cambió desde que se abrió el listado.
- Papelera con restauración; no hay eliminación definitiva ni borrado automático de documentos.
- Inventario Excel `.xlsx` y reporte imprimible para **Guardar como PDF** desde el navegador. Usan los filtros aplicados y los permisos del usuario; no incluyen documentos de la papelera.
- Historial con filtros Desde/Hasta (días completos en UTC), conteo total y botón Reportes para Excel y PDF mediante impresión. El listado muestra hasta 200 operaciones; el reporte incluye todo el período autorizado. Administradores ven todas las cuentas; administrativos, solo sus propias operaciones.
- Respaldos ZIP manuales y automáticos, descarga administrativa y restauración por comando con el servidor detenido.

## Identidad institucional

La interfaz utiliza guindo `#74180f`, guindo oscuro `#4c100d`, blanco, crema y grises. El logo ovalado de CEICOM, preparado con fondo transparente a partir de la referencia suministrada, aparece en el login, el panel lateral y los reportes imprimibles. En fondos oscuros se presenta en tono claro mediante CSS. El archivo reutilizable es `public/assets/ceicom-logo.png`.

## Permisos

| Acción                           | Administrador  | Administrativo             | Docente                    |
| -------------------------------- | -------------- | -------------------------- | -------------------------- |
| Usuarios, áreas y categorías     | Gestionar      | Consultar áreas/categorías | Consultar áreas/categorías |
| Crear documentos                 | Cualquier área | Su área                    | Su área                    |
| Gestionar documentos y versiones | Todos          | Propios y de su área       | Propios                    |
| Aprobar / observar               | Todos          | Su área                    | No                         |
| Restaurar desde papelera         | Todos          | Propios y de su área       | Propios                    |
| Respaldos completos              | Sí             | No                         | No                         |

El propietario y los gestores del documento pueden consultarlo aunque esté pendiente u observado. Para otros lectores, se requiere estado **Aprobado** y se aplica la visibilidad:

- **Restringido:** propietario, administrador y personal administrativo del área del documento.
- **Área / carrera:** además, cuentas de la misma área.
- **Institucional:** además, cualquier cuenta activa.

La descarga de versiones antiguas se reserva a quienes pueden gestionar el documento. El retiro bloquea toda descarga, incluida la de versiones antiguas. Restaurar vuelve a estado Pendiente. El propietario conserva sus documentos si cambia de área. Un administrativo que conserva documentos propios en otra área puede gestionarlos, pero no aprobarlos allí; debe hacerlo un revisor de esa área o el administrador. Para datos personales utiliza acceso restringido.

## Respaldos y recuperación

El servidor comprueba cada minuto si pasaron 24 horas desde la copia más reciente. Genera una copia al primer arranque y cuando corresponde al reiniciar. **Solo funciona con el servidor activo**; no instala servicios ni tareas del sistema operativo. La limpieza de una ejecución automática conserva las siete copias ZIP más recientes; las copias manuales pueden superar ese número hasta la próxima ejecución automática.

Cada ZIP contiene una instantánea SQLite consistente, todos los archivos (incluidas versiones y retirados) y un manifiesto con tamaños y SHA-256. Se excluyen sesiones y el archivo de acceso inicial. Las copias incluyen datos personales y hashes de contraseñas: solo puede descargarlas el administrador. Descarga periódicamente una copia a **otro equipo o almacenamiento protegido**; el mismo disco no protege contra su pérdida.

Para restaurar:

```powershell
# Primero detén el servidor con Ctrl+C.
npm.cmd run restore -- "C:\respaldos\ceicom-AAAA-MM-DD.zip"
npm.cmd run dev
```

El comando rechaza un servidor activo, rutas no permitidas, archivos faltantes, tamaños/hashes incorrectos y bases inconsistentes. Antes de reemplazar los datos crea un respaldo preventivo del estado actual. Los respaldos anteriores se conservan. Todas las sesiones se cierran tras restaurar; usa las credenciales vigentes en la fecha del respaldo. Los hashes detectan alteraciones, pero no son una firma digital: restaura únicamente copias de confianza. El restaurador admite hasta 1 GB descomprimido y 100 000 entradas.

## Configuración y límites

Variables opcionales: `PORT` (3000), `HOST` (127.0.0.1), `DATA_DIR` (carpeta `data` junto al proyecto), `ADMIN_PASSWORD` (solo creación inicial). Si cambias `DATA_DIR`, usa la misma variable al restaurar. No se requieren variables para uso local.

SQLite es adecuada para esta instalación en un único servidor. Los respaldos y reportes se generan en el proceso y pueden pausarlo brevemente; para grandes volúmenes conviene separar estas tareas y evaluar PostgreSQL. Para despliegue institucional configura HTTPS y permisos del directorio. La verificación de formato no sustituye un antivirus. No se implementan OCR, firma digital, notificaciones por correo ni clasificación automática. El versionado conserva archivos; no captura cada cambio de metadatos como una versión. La aprobación es una revisión operativa, no una firma legal.

## Validación y documentación

```powershell
npm.cmd test
```

La suite usa datos temporales y los puertos **3197, 3199, 3201 y 3205**, que deben estar libres. Comprueba permisos, archivos, filtros, versiones, revisión, papelera, reportes, respaldos, restauración y migración desde v1. No modifica tu base de desarrollo. No se atribuyen a esta implementación los resultados declarados en el documento académico original.

- [Manual de usuario](docs/MANUAL.md)
- [Modelo de datos y arquitectura](docs/ARQUITECTURA.md)
- [Requisitos, pruebas y medición](docs/VALIDACION.md)

Código: `server.js` (API y migraciones), `lib/storage.js` (respaldo/recuperación), `scripts/restore.js` (restauración), `public/` (interfaz), `test/` (pruebas). `data/` y `node_modules/` están excluidos de Git. Usa `npm ci` para una instalación reproducible.

Cada tarea de nube tiene un entorno aislado. Usa el checkout existente `/workspace/sysdocu`; no se necesitan worktrees.

## Documento del proyecto de grado

La actualización de los capítulos I–IV, con Cascada, casos de uso, modelo relacional, diccionario de datos, mockups y pruebas funcionales, está en [docs/academico](docs/academico/LEEME.md). Incluye Word editable, PDF y fuentes/evidencias. Su referencia de código es la versión 2.1.0 (e41c5de); no modifica la aplicación ni los datos.
