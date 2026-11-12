"""Crea PDF ficticios para el recorrido de capturas. No contiene datos institucionales reales."""
from pathlib import Path
from reportlab.pdfgen import canvas
folder=Path('/tmp/ceicom-demo-pdfs');folder.mkdir(parents=True,exist_ok=True)
for name,title in [('plan','Plan global de Programación I'),('informe','Informe administrativo de demostración'),('curriculum','Currículum docente de demostración'),('circular','Circular académica 2026')]:
 c=canvas.Canvas(str(folder/(name+'.pdf')));c.setTitle(title);c.setFont('Helvetica-Bold',17);c.drawString(50,780,'INSTITUTO TECNOLOGICO CEICOM');c.setFont('Helvetica',13);c.drawString(50,735,title);c.setFont('Helvetica',11);c.drawString(50,700,'Documento ficticio para capturas y pruebas del sistema.');c.drawString(50,675,'No contiene información personal ni registros institucionales reales.');c.drawString(50,630,'Gestión: 2026. Área: Sistemas Informáticos.');c.save()
