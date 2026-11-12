# Documento académico actualizado · SYSDOCU CEICOM 2.1

Se actualizaron los capítulos I, II, III y IV del documento proporcionado para corresponder al código **e41c5de4968d967f33311fae147091f814d15a21**. La portada conserva el título, postulante, tutor, localidad y gestión de la fuente original. La resolución ministerial se reproduce de esa fuente; no fue verificada externamente.

## Entrega

- **Proyecto_CEICOM_Actualizado.docx**: versión editable con índices automáticos. Al abrir en Word, permite la actualización de campos o utiliza **Referencias → Actualizar tabla**. El contenido no requiere reconstruir gráficos.
- **Proyecto_CEICOM_Actualizado.pdf**: consulta con índices paginados e hipervínculos.
- **figuras/**: 27 figuras incorporadas (8 diagramas y 19 pantallas). Los diagramas también se entregan en SVG y sus fuentes DOT están en `fuentes/`.
- **evidencias/**: salida TAP, versión/entorno de ejecución, registro de capturas, esquema SQL/JSON y controles documentales.
- **fuentes/**: contenido estructurado y generadores originales para mantener correspondencia entre documentos y sistema.

El capítulo III desarrolla las fases de Cascada: análisis; diseño (modelo relacional, diccionario de 8 tablas/54 campos y mockups); desarrollo; pruebas; implementación y mantenimiento. Las especificaciones y resultados se distinguen de la evaluación institucional pendiente.

## Evidencia y límites

Se ejecutó `node --test --test-reporter=tap`. Node.js informa **26 resultados aprobados y 0 fallos**: **23 casos ejecutables y 3 agrupadores**. No se afirma cobertura total del código, despliegue institucional o ahorro cuantificado. Se capturaron 19 pantallas en Chromium con datos ficticios y sin errores JavaScript. Las capturas son mockups de alta fidelidad derivados de una aplicación real, no registros personales de CEICOM.

El código de la aplicación y la base de desarrollo no se modificaron para producir esta documentación. Las pruebas y capturas usan almacenamiento temporal. No se incluyen bases de datos, contraseñas, cookies o respaldos reales.

## Regeneración opcional

La aplicación sigue instalándose con `npm.cmd install` y `npm.cmd run dev`. Las siguientes dependencias son **solo para regenerar documentos**, no para ejecutar el sistema: Python, python-docx, reportlab, Pillow, matplotlib y Graphviz; para recapturar pantallas, Playwright y Chromium.

Desde la raíz del repositorio:

1. Crea un servidor **temporal y vacío**, con `DATA_DIR` independiente y `PORT=3210`; define una contraseña de prueba mediante `ADMIN_PASSWORD`. Nunca apuntes los generadores a datos productivos.
2. Ejecuta `python docs/academico/fuentes/preparar_datos_demo.py`.
3. Define `ACADEMIC_PASSWORD` igual a esa contraseña de prueba. Ejecuta `node docs/academico/fuentes/capturar_pantallas.mjs`. Puedes definir `PLAYWRIGHT_MODULE` y `CHROMIUM_PATH` según tu instalación.
4. Ejecuta `python docs/academico/fuentes/generar_figuras.py`. Usa `ACADEMIC_DATA_DIR` si la base temporal está en otra ruta; por defecto utiliza `/tmp/ceicom-academic`.
5. Ejecuta `python docs/academico/fuentes/generar_documento.py`. Genera DOCX y PDF desde el mismo contenido, con paginación propia de cada formato.
6. Para actualizar evidencia técnica: `node --test --test-reporter=tap > docs/academico/evidencias/pruebas-funcionales.tap`. Registra también versión y entorno, y revisa los resultados antes de afirmarlos en el documento.

Los scripts de captura usan `/tmp` para archivos de demostración en el entorno de generación. Si se regeneran en Windows, adapta esas rutas de utilidades académicas o utiliza un entorno equivalente. Esto no cambia los comandos ni la compatibilidad prevista del sistema web.

Antes de la presentación formal, confirma con el instituto los datos de portada, formato exigido, firmas y requisitos de evaluación. Los índices de Word pueden paginarse de manera diferente del PDF al cambiar fuente, impresora o contenido.
