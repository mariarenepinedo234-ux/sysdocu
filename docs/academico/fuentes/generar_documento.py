"""Renderiza el contenido estructurado en DOCX y PDF sin alterar el sistema.
Dependencias: python-docx, reportlab y Pillow. Los gráficos deben existir en ../figuras.
"""
from pathlib import Path
import sys,json,html,re,datetime
from PIL import Image as PILImage
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION_START
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.platypus import BaseDocTemplate,PageTemplate,Frame,Paragraph,Spacer,PageBreak,Image,LongTable,TableStyle,KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY,TA_LEFT,TA_CENTER
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
sys.path.insert(0,str(Path(__file__).resolve().parent))
from contenido import blocks,TITLE,ROOT
LOGO=ROOT.parents[1]/'public/assets/ceicom-logo.png'
DOCX=ROOT/'Proyecto_CEICOM_Actualizado.docx';PDF=ROOT/'Proyecto_CEICOM_Actualizado.pdf'
WINE='74180F';INK='383331';MUTED='756D67';CREAM='F5F1E8';LINE='E4DDD4'
DEDICATION=[
'A Dios por darme la fortaleza, la salud y la sabiduría necesarias para llegar hasta aquí.',
'A mis padres y familia, por su apoyo incondicional, sus consejos y su confianza, que han sido mi inspiración constante en cada paso de este camino.',
'A mis docentes y al Instituto Tecnológico CEICOM, por brindarme los conocimientos y la oportunidad de crecer académica y profesionalmente.',
'Y a todas aquellas personas que, de una u otra forma, contribuyeron a la realización de este sistema web de registro y control de archivos Word y PDF, con la esperanza de que sea de utilidad y beneficio para la institución.']
THANKS=['A mi tutor, Lic. Rodrigo Romero Flores, por su orientación y acompañamiento en el desarrollo del proyecto.','Agradezco el tiempo, la paciencia y la motivación brindados durante este proceso, que contribuyeron a mi formación técnica y profesional.','Al Instituto Tecnológico CEICOM y a las personas que apoyaron la elaboración de este trabajo.']
def esc(s):return html.escape(str(s)).replace('\n','<br/>')
def dims(file,width=15.7,maxheight=18):
 im=PILImage.open(file);w,h=im.size;r=min(width/w,maxheight/h);return w*r,h*r

def widths(b):
 n=len(b['headers'])
 if b.get('widths'):return b['widths']
 if b['title'].startswith('Diccionario'):return [3.1,2.8,2.7,7.1]
 if b['title'].startswith('Requerimientos funcionales'):return [1.7,4.0,10.0]
 if n==2:return [3.7,12.0]
 if n==3:return [3.7,6.0,6.0]
 if n==4:return [2.5,3.8,4.3,5.1]
 return [15.7/n]*n

def field(par,instr,display=''):
 node=OxmlElement('w:fldSimple');node.set(qn('w:instr'),instr)
 r=OxmlElement('w:r');t=OxmlElement('w:t');t.text=display;r.append(t);node.append(r);par._p.append(node)
 return node

def word_caption(d,label,number,text):
 par=d.add_paragraph(style='Caption');par.paragraph_format.keep_with_next=True
 par.add_run(label+' ');field(par,'SEQ '+label+' \\* ARABIC',str(number));par.add_run('. '+text);return par

def render_docx():
 d=Document();sec=d.sections[0];sec.page_width=Cm(21);sec.page_height=Cm(29.7);sec.left_margin=Cm(3);sec.right_margin=Cm(2.3);sec.top_margin=Cm(2.3);sec.bottom_margin=Cm(2.2)
 sec.header_distance=Cm(.9);sec.footer_distance=Cm(1)
 normal=d.styles['Normal'];normal.font.name='Times New Roman';normal.font.size=Pt(12);normal.font.color.rgb=RGBColor.from_string(INK);normal.paragraph_format.line_spacing=1.5;normal.paragraph_format.space_after=Pt(6);normal.paragraph_format.widow_control=True
 for style,size in [('Title',18),('Heading 1',16),('Heading 2',13),('Heading 3',12)]:
  st=d.styles[style];st.font.name='Times New Roman';st.font.size=Pt(size);st.font.bold=True;st.font.color.rgb=RGBColor.from_string(WINE);st.paragraph_format.space_before=Pt(14);st.paragraph_format.space_after=Pt(9);st.paragraph_format.keep_with_next=True
 d.styles['Caption'].font.name='Times New Roman';d.styles['Caption'].font.size=Pt(10);d.styles['Caption'].font.italic=True;d.styles['Caption'].font.color.rgb=RGBColor.from_string(MUTED);d.styles['Caption'].paragraph_format.line_spacing=1.15
 sec.different_first_page_header_footer=True
 # Cover: preserved identification from the submitted document.
 def center(text,size=12,bold=False,color=INK):
  par=d.add_paragraph();par.alignment=WD_ALIGN_PARAGRAPH.CENTER;par.paragraph_format.line_spacing=1.2;par.paragraph_format.space_after=Pt(10);r=par.add_run(text);r.bold=bold;r.font.size=Pt(size);r.font.color.rgb=RGBColor.from_string(color);return par
 center('INSTITUTO TECNOLÓGICO CEICOM',18,True,WINE)
 center('Resolución Ministerial N.º 131/2026',11)
 par=d.add_paragraph();par.alignment=WD_ALIGN_PARAGRAPH.CENTER;par.add_run().add_picture(str(LOGO),width=Cm(8))
 center(TITLE,15,True,WINE)
 center('PROYECTO DE GRADO PARA OPTAR AL TÍTULO PROFESIONAL\nDE TÉCNICO SUPERIOR EN SISTEMAS INFORMÁTICOS',12,True)
 center('POSTULANTE: YESENIA MICAELA REYES BUENO',12)
 center('TUTOR: LIC. RODRIGO ROMERO FLORES',12)
 center('COCHABAMBA – BOLIVIA\n2026',12,True)
 center('Documento actualizado conforme a SYSDOCU 2.1',10,False,MUTED)
 body=d.add_section(WD_SECTION_START.NEW_PAGE);body.header.is_linked_to_previous=False;body.footer.is_linked_to_previous=False;body.different_first_page_header_footer=False
 pg=OxmlElement('w:pgNumType');pg.set(qn('w:start'),'1');body._sectPr.append(pg)
 header=body.header.paragraphs[0];header.add_run('CEICOM  |  SISTEMAS INFORMÁTICOS  |  PROYECTO DE GRADO').font.size=Pt(8);header.runs[0].font.color.rgb=RGBColor.from_string(MUTED)
 foot=body.footer.paragraphs[0];foot.alignment=WD_ALIGN_PARAGRAPH.RIGHT;foot.add_run('Página ');field(foot,'PAGE','1')
 for title,paras in [('DEDICATORIA',DEDICATION),('AGRADECIMIENTOS',THANKS)]:
  d.add_heading(title,level=1)
  for text in paras:d.add_paragraph(text)
  d.add_page_break()
 for title,instr,note in [('ÍNDICE GENERAL','TOC \\o "1-3" \\h \\z \\u','Actualice el índice en Word: Referencias → Actualizar tabla.'),('ÍNDICE DE FIGURAS','TOC \\h \\z \\c "Figura"','Índice de las 27 figuras incorporadas.'),('ÍNDICE DE TABLAS','TOC \\h \\z \\c "Tabla"','Índice de las tablas de análisis, diseño y pruebas.')]:
  par=d.add_paragraph(title,style='Title');par=d.add_paragraph();field(par,instr,note);d.add_page_break()
 table_no=fig_no=0
 first_heading=True
 for b in blocks:
  typ=b['type']
  if typ=='heading':
   if b['level']==1:
    if not first_heading:d.add_page_break()
    first_heading=False
   par=d.add_heading(b['text'],level=b['level']);par.paragraph_format.keep_with_next=True
  elif typ=='paragraph':
   par=d.add_paragraph(b['text']);par.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
  elif typ=='bullet':
   par=d.add_paragraph(b['text'],style='List Bullet');par.paragraph_format.line_spacing=1.35;par.paragraph_format.space_after=Pt(5)
  elif typ=='pagebreak':d.add_page_break()
  elif typ=='table':
   table_no+=1;word_caption(d,'Tabla',table_no,b['title'])
   tab=d.add_table(rows=1,cols=len(b['headers']));tab.autofit=False;tab.style='Table Grid'
   ws=widths(b)
   for i,w in enumerate(ws):tab.columns[i].width=Cm(w)
   header=tab.rows[0]
   repeat=OxmlElement('w:tblHeader');repeat.set(qn('w:val'),'true');header._tr.get_or_add_trPr().append(repeat)
   for i,text in enumerate(b['headers']):header.cells[i].text=str(text)
   for row in b['rows']:
    cells=tab.add_row().cells
    for i,text in enumerate(row):cells[i].text=str(text)
   for ri,row in enumerate(tab.rows):
    trpr=row._tr.get_or_add_trPr();split=OxmlElement('w:cantSplit');trpr.append(split)
    for ci,cell in enumerate(row.cells):
     cell.width=Cm(ws[ci]);shade=OxmlElement('w:shd');shade.set(qn('w:fill'),WINE if ri==0 else('FAF8F3'if ri%2==0 else'FFFFFF'));cell._tc.get_or_add_tcPr().append(shade)
     for par in cell.paragraphs:
      par.paragraph_format.space_after=Pt(4);par.paragraph_format.space_before=Pt(3);par.paragraph_format.line_spacing=1.12
      for run in par.runs:run.font.name='Times New Roman';run.font.size=Pt(9.5);run.font.bold=ri==0;run.font.color.rgb=RGBColor.from_string('FFFFFF'if ri==0 else INK)
   d.add_paragraph().paragraph_format.space_after=Pt(2)
  elif typ=='figure':
   fig_no+=1;word_caption(d,'Figura',fig_no,b['title'])
   file=ROOT/'figuras'/b['file'];w,hh=dims(file,maxheight=b.get('maxheight',17));par=d.add_paragraph();par.alignment=WD_ALIGN_PARAGRAPH.CENTER;par.paragraph_format.keep_with_next=True;par.add_run().add_picture(str(file),width=Cm(w),height=Cm(hh))
   par=d.add_paragraph(b.get('description')or'Fuente: elaboración propia con base en SYSDOCU 2.1.',style='Caption');par.paragraph_format.keep_with_next=False
 settings=d.settings.element;update=OxmlElement('w:updateFields');update.set(qn('w:val'),'true');settings.append(update)
 d.core_properties.title=TITLE;d.core_properties.author='Yesenia Micaela Reyes Bueno';d.core_properties.subject='Capítulos I–IV y fases de Cascada de SYSDOCU 2.1';d.core_properties.keywords='CEICOM, gestión documental, Node.js, SQLite, Cascada';d.core_properties.created=datetime.datetime.now(datetime.timezone.utc);d.core_properties.modified=datetime.datetime.now(datetime.timezone.utc)
 d.save(DOCX)
 return {'figuras':fig_no,'tablas':table_no}

# Embedded Unicode fonts ensure accents and arrows survive export.
FONT=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('Body','DejaVuSerif.ttf'),('Body-Bold','DejaVuSerif-Bold.ttf'),('Body-Italic','DejaVuSerif-Italic.ttf'),('Sans','DejaVuSans.ttf'),('Sans-Bold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,str(FONT/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Body-Bold',italic='Body-Italic',boldItalic='Body-Bold')
pdfmetrics.registerFontFamily('Sans',normal='Sans',bold='Sans-Bold',italic='Sans',boldItalic='Sans-Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle('BodyDoc',fontName='Body',fontSize=11.2,leading=16.8,spaceAfter=7,alignment=TA_JUSTIFY,allowWidows=0,allowOrphans=0))
for name,size,leading in [('H1',16,20),('H2',13,17),('H3',11.7,15)]:styles.add(ParagraphStyle(name,fontName='Body-Bold',fontSize=size,leading=leading,textColor=colors.HexColor('#'+WINE),spaceBefore=13,spaceAfter=9,keepWithNext=True))
styles.add(ParagraphStyle('Cap',fontName='Body-Italic',fontSize=9.2,leading=12,textColor=colors.HexColor('#'+MUTED),spaceBefore=8,spaceAfter=6,keepWithNext=True))
styles.add(ParagraphStyle('Legend',fontName='Body-Italic',fontSize=9,leading=12,textColor=colors.HexColor('#'+MUTED),spaceAfter=9))
styles.add(ParagraphStyle('Cell',fontName='Sans',fontSize=8.6,leading=11.7,spaceAfter=0))
styles.add(ParagraphStyle('CellHead',fontName='Sans-Bold',fontSize=8.8,leading=12,textColor=colors.white))
styles.add(ParagraphStyle('Cover',fontName='Body',fontSize=12,leading=17,alignment=TA_CENTER,spaceAfter=13))
styles.add(ParagraphStyle('CoverTitle',fontName='Body-Bold',fontSize=15,leading=21,alignment=TA_CENTER,textColor=colors.HexColor('#'+WINE),spaceAfter=20))
styles.add(ParagraphStyle('BulletDoc',parent=styles['BodyDoc'],leftIndent=13,firstLineIndent=-10,spaceAfter=5,leading=15.5))
class SpecialTOC(TableOfContents):
 def __init__(self,kind,**kw):super().__init__(**kw);self.kind=kind
 def notify(self,kind,stuff):
  if kind==self.kind:self.addEntry(*stuff)
class AcademicDoc(BaseDocTemplate):
 def afterFlowable(self,flowable):
  if isinstance(flowable,Paragraph) and hasattr(flowable,'_entry'):
   kind,level,title,key=flowable._entry;self.canv.bookmarkPage(key);self.notify(kind,(level,title,self.page-1,key))

def render_pdf():
 doc=AcademicDoc(str(PDF),pagesize=A4,leftMargin=3*cm,rightMargin=2.3*cm,topMargin=2.3*cm,bottomMargin=2.2*cm,title=TITLE,author='Yesenia Micaela Reyes Bueno')
 def decoration(canvas,doc):
  if doc.page==1:return
  canvas.saveState();canvas.setStrokeColor(colors.HexColor('#'+LINE));canvas.setLineWidth(.5);canvas.line(3*cm,A4[1]-1.65*cm,A4[0]-2.3*cm,A4[1]-1.65*cm)
  canvas.setFont('Sans',7.5);canvas.setFillColor(colors.HexColor('#'+MUTED));canvas.drawString(3*cm,A4[1]-1.35*cm,'CEICOM  |  SISTEMAS INFORMÁTICOS  |  PROYECTO DE GRADO');canvas.drawRightString(A4[0]-2.3*cm,1.15*cm,f'Página {doc.page-1}');canvas.restoreState()
 frame=Frame(doc.leftMargin,doc.bottomMargin,doc.width,doc.height,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
 doc.addPageTemplates(PageTemplate(id='main',frames=[frame],onPage=decoration));story=[];serial=0
 def para(text,style='BodyDoc'):return Paragraph(esc(text),styles[style])
 def heading(text,level=1):
  nonlocal serial
  serial+=1;par=para(text,'H'+str(level));par._entry=('TOCEntry',level-1,text,'h'+str(serial));return par
 def cover(text,style='Cover'):story.append(para(text,style))
 cover('INSTITUTO TECNOLÓGICO CEICOM','CoverTitle');cover('Resolución Ministerial N.º 131/2026');story.append(Spacer(1,.4*cm));w,hh=dims(LOGO,8,4);story.append(Image(str(LOGO),w*cm,hh*cm));story.append(Spacer(1,.8*cm));cover(TITLE,'CoverTitle');cover('PROYECTO DE GRADO PARA OPTAR AL TÍTULO PROFESIONAL DE TÉCNICO SUPERIOR EN SISTEMAS INFORMÁTICOS');story.append(Spacer(1,.7*cm));cover('POSTULANTE: YESENIA MICAELA REYES BUENO');cover('TUTOR: LIC. RODRIGO ROMERO FLORES');story.append(Spacer(1,.9*cm));cover('COCHABAMBA – BOLIVIA\n2026');cover('Documento actualizado conforme a SYSDOCU 2.1');story.append(PageBreak())
 for title,paras in [('DEDICATORIA',DEDICATION),('AGRADECIMIENTOS',THANKS)]:
  story.append(para(title,'H1'))
  for text in paras:story.append(para(text))
  story.append(PageBreak())
 for title,kind in [('ÍNDICE GENERAL','TOCEntry'),('ÍNDICE DE FIGURAS','FigureEntry'),('ÍNDICE DE TABLAS','TableEntry')]:
  story.append(para(title,'H1'));toc=SpecialTOC(kind);toc.levelStyles=[ParagraphStyle('Index0',fontName='Body',fontSize=10,leading=14,leftIndent=0,firstLineIndent=0,spaceBefore=5),ParagraphStyle('Index1',fontName='Body',fontSize=9.5,leading=13,leftIndent=14,firstLineIndent=0,spaceBefore=2),ParagraphStyle('Index2',fontName='Body',fontSize=9,leading=12,leftIndent=26)];story.append(toc);story.append(PageBreak())
 fig_no=table_no=0
 for b in blocks:
  typ=b['type']
  if typ=='heading':
   if b['level']==1 and not isinstance(story[-1],PageBreak):story.append(PageBreak())
   story.append(heading(b['text'],b['level']))
  elif typ=='paragraph':story.append(para(b['text']))
  elif typ=='bullet':story.append(para('• '+b['text'],'BulletDoc'))
  elif typ=='pagebreak':story.append(PageBreak())
  elif typ=='table':
   table_no+=1;text=f'Tabla {table_no}. '+b['title'];cap=para(text,'Cap');cap._entry=('TableEntry',0,text,'t'+str(table_no));story.append(cap)
   rows=[[para(v,'CellHead')for v in b['headers']]]+[[para(v,'Cell')for v in r]for r in b['rows']]
   tab=LongTable(rows,colWidths=[x*cm for x in widths(b)],repeatRows=1,hAlign='LEFT',spaceAfter=10)
   tab.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#'+WINE)),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#FAF8F3')]),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#'+LINE)),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]));story.append(tab)
  elif typ=='figure':
   fig_no+=1;text=f'Figura {fig_no}. '+b['title'];cap=para(text,'Cap');cap._entry=('FigureEntry',0,text,'f'+str(fig_no));story.append(cap)
   file=ROOT/'figuras'/b['file'];w,hh=dims(file,maxheight=b.get('maxheight',17));story.append(Image(str(file),w*cm,hh*cm));story.append(para(b.get('description')or'Fuente: elaboración propia con base en SYSDOCU 2.1.','Legend'))
 doc.multiBuild(story,maxPasses=10)

if __name__=='__main__':
 stats=render_docx();render_pdf();(ROOT/'evidencias'/'documento-generado.json').write_text(json.dumps({**stats,'bloques':len(blocks),'docx':DOCX.name,'pdf':PDF.name,'fecha_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()},ensure_ascii=False,indent=2));print('Generados:',DOCX,PDF,stats)
