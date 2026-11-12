import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import AdmZip from 'adm-zip';
const cwd=path.resolve(import.meta.dirname,'..');
test('Flujo documental, permisos y persistencia SQLite',async t=>{
const dir=mkdtempSync(path.join(tmpdir(),'ceicom-test-'));let child;
const base='http://127.0.0.1:3197';
async function start(){child=spawn(process.execPath,['server.js'],{cwd,env:{...process.env,PORT:'3197',DATA_DIR:dir,ADMIN_PASSWORD:'PruebaSegura123!'},stdio:'pipe'});let log='';child.stderr.on('data',d=>log+=d);for(let i=0;i<80;i++){try{if((await fetch(base)).ok)return}catch{}if(child.exitCode!==null)throw Error(log);await delay(100)}throw Error('Servidor no disponible: '+log)}
async function stop(){const p=child;if(p&&p.exitCode===null){await new Promise(resolve=>{p.once('exit',resolve);p.kill()})}}
t.after(async()=>{await stop();rmSync(dir,{recursive:true,force:true})});
await start();
async function req(url,{cookie,method='GET',body}={}){const headers={};if(cookie)headers.cookie=cookie;if(body&&!(body instanceof FormData))headers['content-type']='application/json';return fetch(base+'/api'+url,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined})}
async function login(email,password){const r=await req('/login',{method:'POST',body:{email,password}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
const admin=await login('admin@ceicom.edu.bo','PruebaSegura123!');
await t.test('Inicio de sesión y rutas protegidas',async()=>{assert.equal((await req('/documents')).status,401);assert.equal((await req('/login',{method:'POST',body:{email:'admin@ceicom.edu.bo',password:'incorrecta'}})).status,401)});
const category=(await (await req('/categories',{cookie:admin})).json())[0].id;
let teacher,other,docid;
await t.test('Usuarios y asignación de roles',async()=>{for(const [name,email] of [['Docente Uno','uno@ceicom.edu.bo'],['Docente Dos','dos@ceicom.edu.bo']]){assert.equal((await req('/users',{cookie:admin,method:'POST',body:{name,email,password:'Docente12345!',role:'docente'}})).status,201)}teacher=await login('uno@ceicom.edu.bo','Docente12345!');other=await login('dos@ceicom.edu.bo','Docente12345!');assert.equal((await req('/users',{cookie:teacher})).status,403);assert.equal((await req('/categories',{cookie:teacher,method:'POST',body:{name:'Sin permiso'}})).status,403)});
const pdf=Buffer.from('%PDF-1.4\nDocumento de prueba\n%%EOF');
async function upload(buffer,name,cookie=teacher){const f=new FormData();f.set('title','Plan académico');f.set('description','Prueba de integración');f.set('category_id',String(category));f.set('visibility','privado');f.set('file',new Blob([buffer]),name);return req('/documents',{cookie,method:'POST',body:f})}
await t.test('Carga válida y rechazo de formatos y tamaño',async()=>{const r=await upload(pdf,'plan.pdf');assert.equal(r.status,201);docid=(await r.json()).id;assert.equal((await upload(Buffer.from('ejecutable'),'falso.pdf')).status,400);assert.equal((await upload(pdf,'archivo.exe')).status,400);assert.equal((await upload(Buffer.alloc(11*1024*1024),'grande.pdf')).status,400);const zip=new AdmZip();zip.addFile('[Content_Types].xml',Buffer.from('<Types/>'));zip.addFile('word/document.xml',Buffer.from('<document/>'));assert.equal((await upload(zip.toBuffer(),'plan.docx')).status,201)});
await t.test('Privacidad, descarga íntegra y búsqueda',async()=>{assert.equal((await (await req('/documents',{cookie:other})).json()).length,0);assert.equal((await req(`/documents/${docid}/download`,{cookie:other})).status,403);const r=await req(`/documents/${docid}/download`,{cookie:teacher});assert.deepEqual(Buffer.from(await r.arrayBuffer()),pdf);assert.equal((await (await req('/documents?q=inexistente',{cookie:teacher})).json()).length,0);assert.equal((await (await req('/documents?q=acad',{cookie:teacher})).json()).length,2)});
await t.test('Edición autorizada y consulta institucional',async()=>{const body={title:'Plan actualizado',description:'Modificado',category_id:category,visibility:'institucional'};assert.equal((await req('/documents/'+docid,{cookie:other,method:'PUT',body})).status,403);assert.equal((await req('/documents/'+docid,{cookie:teacher,method:'PUT',body})).status,200);assert.equal((await req(`/documents/${docid}/download`,{cookie:other})).status,200);assert.equal((await req('/documents/'+docid,{cookie:other,method:'DELETE'})).status,403)});
await t.test('Persistencia al reiniciar',async()=>{await stop();await start();const rows=await (await req('/documents',{cookie:teacher})).json();assert.equal(rows.find(x=>x.id===docid).title,'Plan actualizado')});
await t.test('Retiro lógico, categorías referenciadas y auditoría',async()=>{assert.equal((await req('/categories/'+category,{cookie:admin,method:'DELETE'})).status,400);assert.equal((await req('/documents/'+docid,{cookie:teacher,method:'DELETE'})).status,200);assert.equal((await req(`/documents/${docid}/download`,{cookie:teacher})).status,404);const events=await (await req('/activity',{cookie:admin})).json();assert.ok(events.some(a=>a.action==='Documento retirado'));assert.equal((await req('/activity',{cookie:teacher})).status,403)});
await t.test('Cambio de contraseña y cierre de sesión',async()=>{assert.equal((await req('/password',{cookie:teacher,method:'PUT',body:{current:'Docente12345!',password:'NuevaClave123!'}})).status,200);await login('uno@ceicom.edu.bo','NuevaClave123!');await req('/logout',{cookie:teacher,method:'POST'});assert.equal((await req('/me',{cookie:teacher})).status,401)});
});
