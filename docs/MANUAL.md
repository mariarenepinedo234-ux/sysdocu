# Manual de usuario · SYSDOCU CEICOM 2.1

## Preparación por el administrador

1. Instala Node.js 24 LTS y ejecuta `npm.cmd install` y `npm.cmd run dev`.
2. Abre `http://localhost:3000`. Lee la contraseña en `data/acceso-inicial.txt` e ingresa con `admin@ceicom.edu.bo`.
3. En **Mi cuenta**, cambia la contraseña. Usa al menos 10 caracteres.
4. En **Áreas y carreras**, crea las unidades reales del instituto. Puedes renombrarlas sin cambiar sus relaciones. No hay eliminación de áreas para evitar perder asociaciones históricas.
5. En **Usuarios**, crea las cuentas, asigna rol y área. Cada cuenta pertenece a un área. Para retirar acceso cambia su estado a Inactivo. No puedes desactivar ni quitar el rol de administrador a tu propia cuenta. Cambiar una cuenta invalida sus otras sesiones; tu sesión administrativa actual se conserva si editas tu propia cuenta.
6. En **Categorías**, crea o ajusta la clasificación documental. No se puede eliminar una categoría que tenga documentos, incluso si están en la papelera.

## Registrar documentos

En **Documentos → Subir documento**, completa título, categoría, área, gestión opcional, descripción y visibilidad. Selecciona un PDF, DOC o DOCX de hasta 10 MB. Docentes y administrativos registran en su propia área; el administrador puede elegir cualquier área. El documento queda Pendiente y aparece para su propietario y revisores correspondientes.

Utiliza visibilidad Restringido para currículums, certificados y otros datos personales. La visibilidad Institucional permite lectura por todas las cuentas activas una vez aprobado; Área / carrera limita esa lectura a la unidad asignada.

## Consultar y exportar

En **Documentos**, combina búsqueda con filtros de categoría, área, responsable, formato, estado, gestión y fecha. Pulsa **Buscar** para aplicarlos; **Limpiar** restablece el listado. Las fechas filtran la creación del registro, no la última versión. Las opciones de responsables proceden de documentos visibles para tu cuenta.

- **Vista previa:** abre PDF dentro del sistema. Si tu navegador no lo admite, descarga el archivo.
- **Descargar:** entrega el archivo actual según tus permisos.
- **Exportar Excel:** descarga un `.xlsx` con el inventario filtrado. Abre con Excel o una aplicación compatible.
- **Reporte PDF / Imprimir:** abre un inventario en otra pestaña. Pulsa **Imprimir / Guardar como PDF** y elige el destino PDF del navegador.

Los reportes contienen metadatos, no los archivos originales. No incluyen la papelera. Los filtros de exportación corresponden a la última búsqueda aplicada.

## Corregir y versionar

**Editar** cambia título, descripción, categoría, área permitida, gestión o visibilidad. Todo cambio vuelve a Pendiente.

**Versiones** muestra número, archivo, autor, fecha, nota y huella SHA-256. **Subir nueva versión** reemplaza el archivo actual, conserva los anteriores y devuelve el documento a revisión. Descarga versiones antiguas desde esa pantalla. No se restaura una versión antigua como actual con un botón: si es necesario, descárgala y súbela como una nueva versión, indicando el motivo.

## Revisar documentos

El administrador puede revisar todos los documentos; el personal administrativo, los de su área.

1. Filtra por estado Pendiente y revisa el archivo actual.
2. Pulsa **Revisar**.
3. Selecciona Aprobado u Observado. Para observar, explica las correcciones requeridas.
4. Guarda la decisión. Si alguien subió una nueva versión entretanto, el sistema pide actualizar el listado y revisar el archivo nuevo.

**Revisiones** conserva decisiones, comentarios, revisor y número de versión. Las revisiones anteriores no aprueban automáticamente versiones nuevas. Las cuentas con permisos de revisión pueden revisar también documentos propios; el sistema no impone separación entre autor y aprobador.

## Retirar y recuperar

**Retirar** envía el documento a la papelera y bloquea su consulta/descarga. No borra archivos ni versiones. En **Papelera → Restaurar**, confirma la recuperación. Vuelve al repositorio como Pendiente y conserva su historial.

Cada usuario ve en la papelera solo los documentos que puede gestionar. No hay eliminación definitiva ni caducidad automática.

## Historial y reportes de actividad

En **Historial de actividad** selecciona **Desde** y **Hasta**, y pulsa **Aplicar filtros**. Las fechas incluyen ambos días completos y usan UTC, el horario indicado en la tabla. Puedes dejar cualquiera de las dos fechas vacía. **Limpiar** vuelve al historial sin rango.

El administrador consulta las operaciones de todas las cuentas; el personal administrativo solo las suyas. Los docentes no acceden a este módulo. La pantalla muestra hasta 200 operaciones y el conteo completo de coincidencias.

Pulsa **Reportes** para abrir las opciones:

- **Descargar Excel:** exporta todas las operaciones autorizadas del período en `.xlsx`.
- **Imprimir / Guardar como PDF:** abre el reporte con el logo institucional. Usa el botón de impresión y elige el destino PDF del navegador.

Los reportes usan las fechas de la última búsqueda aplicada y no están limitados a las 200 filas de la pantalla. Si cambias una fecha, aplica los filtros antes de generarlos. Los rangos invertidos o fechas inválidas se rechazan. La generación del reporte también queda registrada como actividad, por lo que el conteo puede aumentar al consultar de nuevo.

## Respaldos

Solo el administrador ve **Respaldos**. Puede crear una copia y descargar su ZIP. La aplicación comprueba copias vencidas cada minuto mientras está activa y crea una nueva cada 24 horas. Copia los ZIP a otro dispositivo para protegerte de fallos del disco.

Para restaurar, detén el servidor y ejecuta:

```powershell
npm.cmd run restore -- "C:\respaldos\nombre-del-respaldo.zip"
npm.cmd run dev
```

No extraigas archivos sueltos sobre una base abierta. El restaurador valida la copia y crea un respaldo preventivo. Después de restaurar, todos deben volver a iniciar sesión. Si el equipo terminó de forma abrupta, el siguiente inicio elimina un bloqueo obsoleto cuando confirma que el proceso anterior ya no existe. No borres `server.lock` mientras haya un servidor activo.

## Problemas habituales

- **No inicia:** verifica `node --version`; utiliza Node.js 24 LTS. Ejecuta los comandos dentro de la carpeta que contiene `package.json`.
- **Puerto ocupado:** cierra la otra instancia o cambia `PORT`.
- **No veo un documento:** revisa sus filtros, área, visibilidad y aprobación. Solicita al administrador que verifique tus permisos.
- **Archivo rechazado:** revisa tamaño, formato y contenido real. Renombrar una extensión no convierte el archivo.
- **Respaldo automático ausente:** comprueba que el servidor esté activo y que haya espacio y permisos de escritura. La consola registra los fallos de respaldo.
- **Restauración rechazada:** usa un ZIP original creado por el sistema y asegúrate de detener el servidor. No modifiques el manifiesto para forzar su aceptación.
