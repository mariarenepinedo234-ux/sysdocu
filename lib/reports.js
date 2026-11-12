import AdmZip from "adm-zip";

export const xml = (value) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );

export function workbook(headers, rows, name = "Reporte CEICOM") {
  const zip = new AdmZip();
  const add = (name, text) => zip.addFile(name, Buffer.from(text));
  const column = (n) => {
    let s = "";
    for (n++; n; n = Math.floor((n - 1) / 26))
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  add(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  );
  add(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  add(
    "xl/workbook.xml",
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  );
  // All cells are explicit text: user-controlled strings cannot become formulas.
  add(
    "xl/worksheets/sheet1.xml",
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      [headers, ...rows]
        .map(
          (row, i) =>
            `<row r="${i + 1}">` +
            row
              .map(
                (v, j) =>
                  `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`,
              )
              .join("") +
            "</row>",
        )
        .join("") +
      "</sheetData></worksheet>",
  );
  return zip.toBuffer();
}

export function printReport({
  title,
  user,
  description,
  headers,
  rows,
  noun = "registros",
}) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xml(title)}</title><link rel="stylesheet" href="/report.css"></head><body><div class="print-toolbar"><button id="print">Imprimir / Guardar como PDF</button><span>Selecciona «Guardar como PDF» en el diálogo de impresión.</span></div><header class="report-heading"><img src="/assets/ceicom-logo.png" alt="Instituto Tecnológico CEICOM" width="190" height="84"><div><p class="report-eyebrow">INSTITUTO TECNOLÓGICO CEICOM</p><h1>${xml(title)}</h1><p>${xml(description)}</p></div></header><div class="report-meta"><span>Generado: ${xml(new Date().toISOString().replace("T", " ").slice(0, 19))} UTC</span><span>Usuario: ${xml(user)}</span><strong>${rows.length} ${xml(noun)}</strong></div><div class="report-table"><table><thead><tr>${headers.map((h) => "<th>" + xml(h) + "</th>").join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => "<tr>" + row.map((v) => "<td>" + xml(v) + "</td>").join("") + "</tr>").join("") : `<tr><td colspan="${headers.length}" class="empty-report">No hay registros para los filtros seleccionados.</td></tr>`}</tbody></table></div><footer>SYSDOCU · Gestión documental institucional · Documento generado para consulta autorizada</footer><script src="/report.js"></script></body></html>`;
}
