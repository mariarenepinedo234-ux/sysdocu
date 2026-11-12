// Evidencia reproducible con un DATA_DIR temporal y vacío. Nunca ejecutar sobre producción.
// Requiere Playwright y Chromium externos a las dependencias de la aplicación.
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACADEMIC_BASE||'http://127.0.0.1:3210';
const password=process.env.ACADEMIC_PASSWORD;if(!password)throw Error('Defina ACADEMIC_PASSWORD para el servidor temporal.');
const out=path.resolve('docs/academico/figuras');fs.mkdirSync(out,{recursive:true});
const api=async(route,cookie,method='GET',body)=>{const r=await fetch(base+'/api'+route,{method,headers:{...(cookie?{cookie}:{}),...(body&&!(body instanceof FormData)?{'content-type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(route+': '+r.status+' '+await r.text());return r};
const login=async(email)=>{const r=await api('/login',null,'POST',{email,password});return r.headers.get('set-cookie').split(';')[0]};
const admin=await login('admin@ceicom.edu.bo');
const systems=(await (await api('/areas',admin,'POST',{name:'Sistemas Informáticos'})).json()).id;
const management=(await (await api('/areas',admin,'POST',{name:'Administración'})).json()).id;
for(const [name,email,role,area_id] of [['Docente de demostración','docente.demo@ceicom.edu.bo','docente',systems],['Personal de demostración','administrativo.demo@ceicom.edu.bo','administrativo',systems]])await api('/users',admin,'POST',{name,email,role,area_id,password});
const teacher=await login('docente.demo@ceicom.edu.bo');
const categories=await (await api('/categories',admin)).json();
const cat=n=>categories.find(c=>c.name===n).id;
async function upload(title,file,category_id,area_id,visibility,cookie=admin){const f=new FormData();for(const [k,v]of Object.entries({title,description:'Registro ficticio para diseño y validación académica.',category_id,area_id,visibility,academic_year:'2026'}))f.set(k,String(v));f.set('file',new Blob([fs.readFileSync('/tmp/ceicom-demo-pdfs/'+file+'.pdf')],{type:'application/pdf'}),file+'.pdf');return (await (await api('/documents',cookie,'POST',f)).json()).id}
const plan=await upload('Plan global · Programación I','plan',cat('Planificación académica'),systems,'area',teacher);
await api(`/documents/${plan}/review`,admin,'POST',{status:'observado',version:1,comment:'Completar la planificación de actividades y criterios de evaluación.'});
const version=new FormData();version.set('note','Planificación revisada con actividades y evaluación.');version.set('file',new Blob([fs.readFileSync('/tmp/ceicom-demo-pdfs/plan.pdf')]),'plan-corregido.pdf');await api(`/documents/${plan}/versions`,teacher,'POST',version);await api(`/documents/${plan}/review`,admin,'POST',{status:'aprobado',version:2,comment:'Documento revisado y aprobado para consulta del área.'});
const report=await upload('Informe de gestión · Primer semestre','informe',cat('Documentación administrativa'),management,'privado');await api(`/documents/${report}/review`,admin,'POST',{status:'aprobado',version:1,comment:'Revisión administrativa completada.'});
await upload('Antecedentes · Docente de demostración','curriculum',cat('Documentación docente'),systems,'privado',teacher);
const circular=await upload('Circular · Calendario académico 2026','circular',cat('Planificación académica'),systems,'institucional');await api(`/documents/${circular}/review`,admin,'POST',{status:'aprobado',version:1,comment:'Comunicado disponible para la institución.'});
const removed=await upload('Informe anterior · Registro retirado','informe',cat('Documentación administrativa'),management,'privado');await api(`/documents/${removed}`,admin,'DELETE');
await api('/backups',admin,'POST');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function shot(name){await page.waitForTimeout(160);await page.screenshot({path:path.join(out,name+'.png'),fullPage:false})}
async function nav(id){await page.locator(`[data-page=${id}]`).click();await page.getByRole('heading',{level:1}).waitFor();if(id==='activity')await page.getByText(/Mostrando \d+ de \d+ operaciones/).waitFor()}
async function close(){await page.getByRole('button',{name:'Cerrar',exact:true}).click()}
await page.goto(base);await page.locator('.login-form-logo').waitFor();await shot('M01_login');await page.getByLabel('Correo electrónico').fill('admin@ceicom.edu.bo');await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Ingresar al sistema'}).click();await page.getByRole('heading',{name:'Tu archivo, organizado.'}).waitFor();await shot('M02_resumen');
await nav('documents');await page.getByText('Plan global · Programación I',{exact:true}).waitFor();await shot('M03_documentos');await page.getByRole('button',{name:'Subir documento'}).click();await page.getByLabel('Título del documento').fill('Nuevo documento académico');await page.getByLabel('Área o carrera').selectOption(String(systems));await page.getByLabel('Gestión académica (opcional)').fill('2026');await shot('M04_carga');await close();
const row=page.getByRole('row').filter({hasText:'Plan global · Programación I'});await row.getByRole('button',{name:'Versiones',exact:true}).click();await page.getByRole('heading',{name:'Versiones · Plan global · Programación I'}).waitFor();await shot('M05_versiones');await close();
await row.getByRole('button',{name:'Revisiones',exact:true}).click();await shot('M06_revisiones');await close();await row.getByRole('button',{name:'Revisar',exact:true}).click();await shot('M07_aprobacion');await close();
await row.getByRole('button',{name:'Vista previa',exact:true}).click();await page.getByTitle('Vista previa PDF').waitFor();await page.waitForTimeout(500);await shot('M08_vista_previa');await close();
await nav('categories');await shot('M09_categorias');await nav('users');await page.getByText('docente.demo@ceicom.edu.bo',{exact:true}).waitFor();await shot('M10_usuarios');await nav('areas');await shot('M11_areas');await nav('trash');await page.getByText('Informe anterior · Registro retirado',{exact:true}).waitFor();await shot('M12_papelera');
await nav('activity');await page.getByLabel('Desde',{exact:true}).fill('2026-01-01');await page.getByLabel('Hasta',{exact:true}).fill('2026-12-31');const ready=page.waitForResponse(r=>r.url().includes('/activity/count?from=2026')&&r.ok());await page.getByRole('button',{name:'Aplicar filtros'}).click();await ready;await shot('M13_historial');await page.getByRole('button',{name:'Reportes',exact:true}).click();await shot('M14_reportes_historial');const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Imprimir / Guardar como PDF',exact:true}).click();const print=await popup;await print.getByRole('heading',{name:'Historial de actividad',exact:true}).waitFor();await print.screenshot({path:path.join(out,'M15_reporte_imprimible.png')});await print.close();await close();
await nav('backups');await shot('M16_respaldos');await nav('account');await shot('M17_mi_cuenta');
await page.setViewportSize({width:390,height:844});await nav('documents');await shot('M18_movil');await page.setViewportSize({width:1366,height:900});await page.getByRole('button',{name:'Salir',exact:true}).click();await page.getByLabel('Correo electrónico').fill('docente.demo@ceicom.edu.bo');await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Ingresar al sistema'}).click();await page.getByRole('heading',{name:'Tu archivo, organizado.'}).waitFor();await shot('M19_portal_docente');
await browser.close();fs.writeFileSync('docs/academico/evidencias/pantallas.json',JSON.stringify({base,fecha_utc:new Date().toISOString(),pantallas:19,errores_javascript:errors,datos:'Ficticios; entorno temporal aislado.'},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('19 pantallas capturadas; sin errores JavaScript.');
