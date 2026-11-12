"""Genera diagramas originales y extrae el esquema real. Requiere Graphviz y matplotlib."""
from pathlib import Path
import sqlite3,json,subprocess,os,base64
os.environ.setdefault("MPLCONFIGDIR","/tmp/ceicom-matplotlib")
os.environ.setdefault("XDG_CACHE_HOME","/tmp/ceicom-cache")
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[1]
FIG=ROOT/'figuras';FIG.mkdir(exist_ok=True)
DB=Path(os.environ.get('ACADEMIC_DATA_DIR','/tmp/ceicom-academic'))/'ceicom.sqlite'
con=sqlite3.connect(DB);con.row_factory=sqlite3.Row
names=['areas','users','categories','documents','versions','reviews','sessions','activity']
schema={n:{'columns':[dict(r) for r in con.execute(f'PRAGMA table_info({n})')],'foreign_keys':[dict(r) for r in con.execute(f'PRAGMA foreign_key_list({n})')],'indexes':[dict(r) for r in con.execute(f'PRAGMA index_list({n})')],'sql':con.execute('SELECT sql FROM sqlite_master WHERE type="table" AND name=?',(n,)).fetchone()[0]}for n in names}
(ROOT/'evidencias'/'esquema-real.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2))
(ROOT/'evidencias'/'esquema-real.sql').write_text('PRAGMA foreign_keys=ON;\n\n'+';\n\n'.join(v['sql']for v in schema.values())+';\n')
indexes=[r[0]for r in con.execute("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")]
with (ROOT/'evidencias'/'esquema-real.sql').open('a')as out:out.write('\n\n'+';\n'.join(indexes)+';\nPRAGMA user_version=3;\n')
con.close()
WINE='#74180f';CREAM='#f5f1e8'
fig,ax=plt.subplots(figsize=(.7,1.1));fig.patch.set_alpha(0);ax.set_xlim(0,1);ax.set_ylim(0,1);ax.axis('off');ax.add_patch(plt.Circle((.5,.79),.13,fill=False,lw=2,color=WINE));ax.plot([.5,.5],[.65,.32],color=WINE,lw=2);ax.plot([.2,.8],[.52,.52],color=WINE,lw=2);ax.plot([.5,.25],[.32,.08],color=WINE,lw=2);ax.plot([.5,.75],[.32,.08],color=WINE,lw=2);fig.savefig(FIG/'actor.png',dpi=150,bbox_inches='tight',transparent=True);plt.close(fig)
BASE='''graph [fontname="DejaVu Sans",bgcolor="white",pad="0.25",nodesep="0.32",ranksep="0.8",splines=polyline];node [fontname="DejaVu Sans",fontsize=12,color="#74180f",fontcolor="#383331",style=filled,fillcolor="#faf8f3",penwidth=1.2];edge [fontname="DejaVu Sans",fontsize=10,color="#756d67",fontcolor="#534e4b",arrowsize=.7];'''
def render(name,body,directed=True):
 dot=('digraph'if directed else'graph')+' G {\n'+BASE+'\n'+body+'\n}'
 p=ROOT/'fuentes'/(name+'.dot');p.write_text(dot)
 for ext in ['png','svg']:
  subprocess.run(['dot',f'-T{ext}',str(p),'-o',str(FIG/(name+'.'+ext))],check=True)
  if ext=='svg':
   svg=FIG/(name+'.svg');svg.write_text(svg.read_text().replace(str(FIG/'actor.png'),'data:image/png;base64,'+base64.b64encode((FIG/'actor.png').read_bytes()).decode()))

def actor(id,label):return f'{id} [shape=none,image="{FIG/"actor.png"}",label="{label}",labelloc=b,width=1.5,height=1.3,imagescale=true];'
render('D01_cascada','''rankdir=TB;
analisis [shape=box,label="FASE I · ANÁLISIS\nProblema, actores, requisitos y casos de uso"];
diseno [shape=box,label="FASE II · DISEÑO\nArquitectura, modelo relacional, diccionario y mockups"];
desarrollo [shape=box,label="FASE III · DESARROLLO\nNode.js, API, SQLite, permisos y módulos web"];
pruebas [shape=box,label="FASE IV · PRUEBAS\nCasos funcionales, migración y recuperación"];
implementacion [shape=box,label="FASE V · IMPLEMENTACIÓN Y MANTENIMIENTO\nInstalación reproducible, manuales y operación propuesta"];
analisis -> diseno -> desarrollo -> pruebas -> implementacion;
pruebas -> desarrollo [label="Corrección y nueva verificación",style=dashed,constraint=false];
desarrollo -> diseno [label="Ajuste documentado",style=dashed,constraint=false];''')
render('D02_casos_general','rankdir=LR;'+actor('admin','Administrador')+actor('staff','Personal administrativo')+actor('teacher','Docente autorizado')+'''
subgraph cluster_system {label="SYSDOCU · Sistema web de gestión documental";color="#d2b4ab";style=rounded;
node[shape=ellipse];access[label="Iniciar / cerrar sesión\ny cambiar contraseña"];consult[label="Consultar documentos, PDF\ny reportes de inventario"];manage[label="Gestionar documentos,\nversiones y papelera"];review[label="Revisar, aprobar\nu observar"];catalog[label="Gestionar usuarios,\náreas y categorías"];history[label="Consultar historial\ny generar reportes"];backup[label="Crear y descargar\nrespaldos"];
}
admin -> access [dir=none];admin -> consult [dir=none];admin -> manage[dir=none];admin -> review[dir=none];admin -> catalog[dir=none];admin -> history[dir=none];admin -> backup[dir=none];
staff -> access[dir=none];staff -> consult[dir=none];staff -> manage[dir=none,label="Propios / su área"];staff -> review[dir=none,label="Su área"];staff -> history[dir=none,label="Su actividad"];
teacher -> access[dir=none];teacher -> consult[dir=none,label="Según aprobación y visibilidad"];teacher -> manage[dir=none,label="Propios"];
''')
render('D03_casos_documentos','rankdir=LR;'+actor('owner','Propietario / gestor')+actor('reader','Lector autorizado')+'''
subgraph cluster_system {label="Gestión documental · sesión activa como precondición";color="#d2b4ab";
node[shape=ellipse];create[label="Registrar documento"];upload[label="Cargar nueva versión"];validate[label="Validar archivo y metadatos"];metadata[label="Editar metadatos"];history[label="Consultar versiones\ny descargar anteriores"];remove[label="Retirar a papelera"];restore[label="Restaurar documento"];pending[label="Dejar pendiente\nde revisión"];query[label="Buscar y consultar"];download[label="Descargar archivo actual"];preview[label="Ver PDF en navegador"];
}
owner -> create[dir=none];owner -> upload[dir=none];owner -> metadata[dir=none];owner -> history[dir=none];owner -> remove[dir=none];owner -> restore[dir=none];
reader -> query[dir=none];reader -> download[dir=none];reader -> preview[dir=none];
create -> validate[style=dashed,label="«include»",arrowhead=empty];upload -> validate[style=dashed,label="«include»",arrowhead=empty];
create -> pending[style=dashed,label="«include»",arrowhead=empty];upload -> pending[style=dashed,label="«include»",arrowhead=empty];metadata -> pending[style=dashed,label="«include»",arrowhead=empty];restore -> pending[style=dashed,label="«include»",arrowhead=empty];
preview -> query[style=dashed,label="«extend»\n[archivo PDF]",arrowhead=empty];''')
render('D04_casos_revision_respaldo','rankdir=LR;'+actor('reviewer','Revisor: administrador\no administrativo del área')+actor('admin','Administrador')+actor('operator','Operador técnico local')+'''
subgraph cluster_system {label="Revisión, auditoría y conservación";color="#d2b4ab";
node[shape=ellipse];review[label="Registrar decisión\nde revisión"];version[label="Comprobar versión actual"];comment[label="Exigir comentario\nsi es Observado"];audit[label="Consultar historial\npor fechas"];report[label="Exportar historial\na Excel / impresión PDF"];backup[label="Crear respaldo ZIP"];download[label="Descargar respaldo ZIP"];restore[label="Restaurar respaldo\npor comando local"];
}
reviewer -> review[dir=none];reviewer -> audit[dir=none,label="Según alcance del rol"];reviewer -> report[dir=none];
review -> version[style=dashed,label="«include»",arrowhead=empty];comment -> review[style=dashed,label="«extend» [Observado]",arrowhead=empty];
admin -> backup[dir=none];admin -> download[dir=none];operator -> restore[dir=none,label="Servidor detenido"];
''')
render('D05_arquitectura','''rankdir=TB;
client[shape=box,label="Navegador\nHTML + CSS + JavaScript\nLogin, paneles y reportes imprimibles"];
server[shape=box,label="Servidor Node.js + Express\nAutenticación · API · reglas de permisos"];
db[shape=cylinder,label="SQLite · data/ceicom.sqlite\nUsuarios, metadatos, versiones, revisiones y auditoría"];
files[shape=folder,label="data/files/\nPDF, DOC y DOCX con nombres aleatorios"];
backup[shape=folder,label="data/backups/\nInstantánea SQLite + archivos + manifiesto SHA-256"];
operator[shape=box,label="Restauración local\nnpm run restore -- archivo.zip\nServidor detenido"];
client -> server[label="HTTP local / HTTPS en despliegue\nJSON, multipart y cookie HttpOnly",dir=both];server -> db[label="SQL parametrizado",dir=both];server -> files[label="Lectura y escritura controladas",dir=both];db -> backup[label="VACUUM INTO"];files -> backup[label="Incluye versiones y retirados"];backup -> operator;operator -> db[style=dashed,label="Recuperación validada"];operator -> files[style=dashed];''')
# Logical relational model: the detailed physical schema is in the dictionary and SQL annex.
body='rankdir=LR;node[shape=plain];'
shown={'areas':['id PK','name UNIQUE'],'users':['id PK','area_id FK → areas','name, email UNIQUE','password, role, active'],'categories':['id PK','name UNIQUE','description'],'documents':['id PK','category_id FK → categories','owner_id FK → users','area_id FK → areas','reviewed_by FK → users','title, visibility, status','storage, filename, size','academic_year, removed'],'versions':['id PK','document_id FK → documents','created_by FK → users','number, storage, sha256','UNIQUE(document_id, number)'],'reviews':['id PK','document_id FK → documents','user_id FK → users','version_number (sin FK física)','status, comment, created_at'],'sessions':['token PK','user_id FK → users','expires'],'activity':['id PK','user_id FK → users','action, detail, created_at']}
for n,fields in shown.items():
 rows=''.join('<TR><TD ALIGN="LEFT">'+x.replace('&','&amp;').replace('→','&#8594;')+'</TD></TR>'for x in fields)
 body+=f'{n}[label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="6"><TR><TD BGCOLOR="#74180f"><FONT COLOR="white"><B>{n}</B></FONT></TD></TR>{rows}</TABLE>>];'
for child in names:
 for fk in schema[child]['foreign_keys']:
  body+=f'{fk["table"]} -> {child} [label="1 : 0..N · {fk["from"]}",arrowhead=crow,fontsize=9];'
render('D06_modelo_relacional',body)
render('D07_estados_documento','''rankdir=LR;node[shape=box,style="rounded,filled"];
start[shape=point,fillcolor="#74180f"];pending[label="PENDIENTE\nPropietario y gestores pueden consultar"];
approved[label="APROBADO\nLectura compartida según visibilidad"];observed[label="OBSERVADO\nComentario de corrección requerido"];
removed[label="PAPELERA (removed=1)\nSin descargas de archivo ni versiones"];
start -> pending[label="Carga inicial"];pending -> approved[label="Revisor autorizado\nversión vigente"];pending -> observed[label="Observaciones"];approved -> pending[label="Nueva versión o edición"];observed -> pending[label="Corrección / nueva versión"];
pending -> removed[label="Retiro"];approved -> removed[label="Retiro"];observed -> removed[label="Retiro"];removed -> pending[label="Restauración"];
''')
render('D08_proceso_documental','''rankdir=TB;node[shape=box];
a[label="Usuario autorizado inicia sesión"];b[label="Registra título, categoría, área, gestión y visibilidad"];
c[label="Carga PDF / DOC / DOCX (hasta 10 MB)"];d[shape=diamond,label="¿Archivo y datos válidos?"];
e[label="Guardar archivo + metadatos + versión inicial\nEstado Pendiente"];f[label="Revisor del área o administrador examina"];
g[shape=diamond,label="¿Aprobar u observar?"];h[label="Observado con comentarios"];i[label="Propietario corrige / carga nueva versión"];
j[label="Aprobado"];k[label="Consulta / descarga según permisos"];x[label="Rechazar solicitud con mensaje"];
a->b->c->d;d->e[label="Sí"];d->x[label="No"];x->b;e->f->g;g->h[label="Observar"];h->i->e;g->j[label="Aprobar"];j->k;
''')
print('8 diagramas PNG/SVG y esquema real exportados.')
