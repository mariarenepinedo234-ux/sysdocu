# SYSDOCU · Instituto Tecnológico CEICOM

Sistema web de gestión documental basado en el proyecto de grado suministrado. Implementación en **JavaScript, Node.js, Express y SQLite**, con interfaz en español adaptable a dispositivos móviles. SQLite está integrado en Node.js: no requiere MySQL, XAMPP ni servicios adicionales.

## Instalación en Windows

Instala **Node.js 24 LTS** (mínimo 22.13). Abre una terminal en esta carpeta:

```powershell
npm.cmd install
npm.cmd run dev
```

Abre `http://localhost:3000`. En Linux/macOS usa `npm install` y `npm run dev`. Para ejecutar sin vigilancia de archivos: `npm start`. Para detener: Ctrl+C.

## Primer acceso

En el primer arranque se crea automáticamente la base de datos, las categorías iniciales y el administrador:

- Correo: `admin@ceicom.edu.bo`
- Contraseña: generada aleatoriamente en `data/acceso-inicial.txt`.

Abre ese archivo localmente y cambia la contraseña desde **Mi cuenta**. Después puedes eliminar el archivo de credenciales. No se publica ni se envía al navegador. Alternativamente configura `ADMIN_PASSWORD` antes del primer arranque; solo se utiliza cuando todavía no hay usuarios. No existe registro público de cuentas: el administrador crea las cuentas del personal.

## Funcionalidades

- Inicio/cierre de sesión y cambio de contraseña; contraseñas con scrypt y sesiones de 8 horas mediante cookies HttpOnly y SameSite.
- Resumen con documentos recientes, categorías y volumen de archivos accesibles.
- Administración de usuarios: alta, modificación, roles y desactivación. Cambiar una cuenta invalida sus sesiones.
- Categorías configurables: alta, edición y eliminación cuando no tengan documentos vinculados.
- Carga de PDF, DOC y DOCX hasta 10 MB, con validación de extensión y firma/estructura básica.
- Metadatos: título, descripción, categoría, responsable, fecha y visibilidad.
- Búsqueda por título, descripción y nombre del archivo; filtro por categoría.
- Descarga protegida, edición de metadatos y retiro lógico de documentos.
- Historial de las últimas 200 operaciones para personal administrativo y administradores.

| Operación | Administrador | Administrativo | Docente |
| --- | --- | --- | --- |
| Usuarios y categorías | Gestionar | Consultar categorías | Consultar categorías |
| Subir documentos | Sí | Sí | Sí |
| Consultar/descargar | Todos | Todos | Propios e institucionales |
| Editar/retirar | Todos | Todos | Propios |
| Historial de actividad | Sí | Sí | No |

**Restringido** significa propietario y personal administrativo, incluyendo administrador. **Institucional** permite consulta por cualquier cuenta activa. Usa acceso restringido para documentos personales. Estas políticas concretan los roles del documento de grado.

El retiro oculta el registro y bloquea su descarga; conserva el archivo como resguardo. No incluye papelera/restauración en interfaz, reemplazo de archivos ni historial de versiones. No implementa OCR, escaneo, clasificación automática o respaldos automáticos. Las cifras de validación del documento académico no se toman como pruebas de esta implementación.

## Datos y respaldo

Todo el contenido persistente se guarda en `data/` (ignorado por Git): base `ceicom.sqlite`, archivos en `files/` y credenciales iniciales. Para un respaldo manual consistente, detén el servidor y copia **toda la carpeta `data`** a un lugar seguro. Para restaurar, detén el servidor y reemplaza la carpeta por la copia. Protege los respaldos porque contienen información institucional.

Variables opcionales: `PORT` (3000), `HOST` (127.0.0.1), `DATA_DIR` (ruta de datos) y `ADMIN_PASSWORD` (solo creación inicial). No son necesarias para iniciar. El mensaje de credenciales usa la ruta predeterminada; si personalizas `DATA_DIR`, el archivo estará en esa carpeta.

El servidor escucha únicamente en el equipo local por defecto. Para despliegue institucional, configura HTTPS con proxy inverso, permisos del directorio de datos y política de respaldos. La comprobación de formato no sustituye un antivirus; no abras archivos de origen desconocido. El contenido de Word se descarga, no se renderiza como HTML.

## Validación

```powershell
npm.cmd test
```

Pruebas de integración con datos temporales: autenticación, roles, carga/rechazo de formatos y tamaño, privacidad, integridad de descarga, búsqueda, edición, retiro, auditoría, cambio de contraseña y persistencia al reiniciar. No modifican la base de desarrollo. El puerto 3197 debe estar libre.

## Estructura

- `server.js`: servidor, API, permisos, SQLite y almacenamiento.
- `public/`: interfaz HTML, CSS y JavaScript, sin compilación necesaria.
- `test/system.test.js`: pruebas de integración.
- `package-lock.json`: versiones de dependencias reproducibles; usa `npm ci` en automatización.

Cada tarea de nube tiene un entorno aislado. Usa este checkout en `/workspace/sysdocu`; no se necesitan worktrees.
