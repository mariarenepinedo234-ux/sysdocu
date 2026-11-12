const $ = (s) => document.querySelector(s),
  app = $("#app");
let me,
  docs = [],
  categories = [],
  areas = [],
  page = "dashboard";
const statuses = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  observado: "Observado",
};
const visibilityNames = {
  privado: "Restringido",
  institucional: "Institucional",
  area: "Área / carrera",
};
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const roles = {
  administrador: "Administrador",
  administrativo: "Personal administrativo",
  docente: "Docente",
};
const date = (v) =>
  new Date(v.replace(" ", "T") + "Z").toLocaleDateString("es-BO");
const size = (n) =>
  n < 1024 * 1024
    ? (n / 1024).toFixed(1) + " KB"
    : (n / 1024 / 1024).toFixed(1) + " MB";
async function api(url, options = {}) {
  if (options.body && !(options.body instanceof FormData)) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(options.body);
  }
  const r = await fetch("/api" + url, options);
  const b = await r.json();
  if (!r.ok) {
    if (r.status === 401 && me) {
      me = null;
      login();
    }
    throw Error(b.error || "No se pudo completar la solicitud");
  }
  return b;
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 5000);
}
function login() {
  app.innerHTML = `<div class="login"><section class="login-art"><div class="brand">CEICOM<span>®</span></div><div class="subbrand">INSTITUTO TECNOLÓGICO</div><h1>La información correcta.<br>En un solo lugar.</h1><p>Organiza, protege y consulta los documentos académicos y administrativos de nuestra institución.</p><small>GESTIÓN DOCUMENTAL INSTITUCIONAL</small></section><section class="login-form"><form class="login-card"><div class="eyebrow">BIENVENIDO A SYSDOCU</div><h1>Iniciar sesión</h1><p>Ingresa con tu cuenta institucional.</p><label for="email">Correo electrónico</label><input id="email" type="email" name="email" autocomplete="username" required placeholder="nombre@ceicom.edu.bo"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="current-password" required><div class="error" role="alert"></div><button>Ingresar al sistema →</button><div class="hint">¿Necesitas acceso? Solicita una cuenta al administrador del instituto.</div></form></section></div>`;
  $(".login-card").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.currentTarget.querySelector("button");
    b.disabled = true;
    try {
      page = "dashboard";
      me = await api("/login", {
        method: "POST",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      await refresh();
    } catch (e) {
      $(".error").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
}
async function refresh() {
  [docs, categories, areas] = await Promise.all([
    api("/documents"),
    api("/categories"),
    api("/areas"),
  ]);
  render();
}
const names = {
  dashboard: "Resumen general",
  documents: "Documentos",
  categories: "Categorías",
  users: "Usuarios",
  activity: "Historial de actividad",
  account: "Mi cuenta",
  trash: "Papelera",
  areas: "Áreas y carreras",
  backups: "Respaldos",
};
function render() {
  app.innerHTML = `<div class="layout"><aside class="sidebar"><div class="brand">CEICOM<span>®</span></div><div class="subbrand">GESTIÓN DOCUMENTAL</div><div class="nav-title">ESPACIO DE TRABAJO</div><nav class="nav">${[
    ["dashboard", "◫", "Resumen general"],
    ["documents", "▤", "Documentos"],
    ["categories", "▦", "Categorías"],
    ["trash", "♲", "Papelera"],
    ...(me.role === "administrador"
      ? [
          ["users", "♙", "Usuarios"],
          ["areas", "▧", "Áreas y carreras"],
          ["backups", "◈", "Respaldos"],
        ]
      : []),
    ...(me.role !== "docente"
      ? [["activity", "◷", "Historial de actividad"]]
      : []),
    ["account", "⚙", "Mi cuenta"],
  ]
    .map(
      ([id, icon, name]) =>
        `<button data-page="${id}" class="${id === page ? "active" : ""}">${icon} &nbsp; ${name}</button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom">Repositorio institucional<br><br>Instituto Tecnológico CEICOM<br>Cochabamba · Bolivia</div></aside><div><header class="topbar"><span>Espacio de trabajo &nbsp; / &nbsp; ${names[page]}</span><div class="identity"><div class="avatar">${esc(me.name.slice(0, 2).toUpperCase())}</div><div><strong>${esc(me.name)}</strong><small>${roles[me.role]} · ${esc(areas.find((a) => a.id === me.area_id)?.name || "General")}</small></div><button class="secondary" id="logout">Salir</button></div></header><main class="content"><div id="view"></div><div class="footer"><span>© ${new Date().getFullYear()} Instituto Tecnológico CEICOM</span><span>Repositorio digital · Acceso protegido</span></div></main></div></div>`;
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        page = b.dataset.page;
        render();
      }),
  );
  $("#logout").onclick = async () => {
    await api("/logout", { method: "POST" });
    me = null;
    login();
  };
  show().catch((e) => toast(e.message));
}
function heading(title, desc, button = "") {
  return `<div class="heading"><div><div class="eyebrow">REPOSITORIO INSTITUCIONAL</div><h1>${title}</h1><p>${desc}</p></div>${button}</div>`;
}
function uploadButton() {
  return '<button id="upload">＋ &nbsp; Subir documento</button>';
}
function table(items, trash = false) {
  return items.length
    ? `<div class="table-scroll"><table><thead><tr><th>DOCUMENTO</th><th>CATEGORÍA / ÁREA</th><th>RESPONSABLE</th><th>ESTADO / FECHA</th><th>ACCIONES</th></tr></thead><tbody>${items.map((d) => `<tr><td><div class="file"><span class="file-icon">${esc(d.filename.split(".").pop().toUpperCase())}</span><div><strong>${esc(d.title)}</strong><small>${size(d.size)} · ${visibilityNames[d.visibility]} · v${d.version}</small><small class="block">Gestión: ${esc(d.academic_year || "Sin asignar")}</small></div></div></td><td><span class="badge">${esc(d.category)}</span><small class="block">${esc(d.area)}</small></td><td>${esc(d.owner)}</td><td><span class="badge status-${d.status}">${statuses[d.status]}</span><small class="block">${date(d.created_at)}</small></td><td class="document-actions">${trash ? `<button data-restore="${d.id}">Restaurar</button>` : `<a href="/api/documents/${d.id}/download">Descargar ↓</a> ${d.filename.toLowerCase().endsWith(".pdf") ? `<button class="secondary" data-preview="${d.id}">Vista previa</button>` : ""}<button class="secondary" data-reviews="${d.id}">Revisiones</button>${d.can_manage ? `<button class="secondary" data-edit="${d.id}">Editar</button><button class="secondary" data-versions="${d.id}">Versiones</button><button class="danger" data-remove="${d.id}">Retirar</button>` : ""}${d.can_review ? `<button data-review="${d.id}">Revisar</button>` : ""}`}</td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty"><b>No hay documentos para mostrar</b>Sube un archivo PDF o Word, o cambia los filtros de búsqueda.</div>';
}
function bindDocs(items = docs) {
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          documentModal(items.find((d) => d.id === Number(b.dataset.edit)))),
    );
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmModal(
          "Retirar documento",
          "El documento se enviará a la papelera. Sus versiones se conservarán.",
          async () => {
            await api("/documents/" + b.dataset.remove, { method: "DELETE" });
            await refresh();
            toast("Documento enviado a la papelera");
          },
        )),
  );
  document.querySelectorAll("[data-restore]").forEach(
    (b) =>
      (b.onclick = () =>
        confirmModal(
          "Restaurar documento",
          "Volverá al repositorio con estado Pendiente para una nueva revisión.",
          async () => {
            await api("/documents/" + b.dataset.restore + "/restore", {
              method: "POST",
            });
            await refresh();
            toast("Documento restaurado");
          },
        )),
  );
  document
    .querySelectorAll("[data-preview]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          previewModal(items.find((d) => d.id === Number(b.dataset.preview)))),
    );
  document
    .querySelectorAll("[data-versions]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          versionsModal(
            items.find((d) => d.id === Number(b.dataset.versions)),
          ).catch((e) => toast(e.message))),
    );
  document
    .querySelectorAll("[data-review]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          reviewModal(items.find((d) => d.id === Number(b.dataset.review)))),
    );
  document
    .querySelectorAll("[data-reviews]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          reviewsModal(
            items.find((d) => d.id === Number(b.dataset.reviews)),
          ).catch((e) => toast(e.message))),
    );
  if ($("#upload")) $("#upload").onclick = () => documentModal();
}
async function show() {
  const v = $("#view");
  if (page === "dashboard") {
    v.innerHTML =
      heading(
        "Tu archivo, organizado.",
        "Toda la documentación del instituto, centralizada y a tu alcance.",
        uploadButton(),
      ) +
      `<div class="stats"><div class="stat"><div class="icon">▤</div><span>DOCUMENTOS DISPONIBLES</span><strong>${docs.length}</strong><small>En tu espacio de consulta</small></div><div class="stat"><div class="icon">▦</div><span>CATEGORÍAS</span><strong>${categories.length}</strong><small>Organización institucional</small></div><div class="stat"><div class="icon">↥</div><span>ALMACENAMIENTO VISIBLE</span><strong>${size(docs.reduce((n, d) => n + d.size, 0))}</strong><small>Archivos PDF y Word</small></div></div><section class="panel"><div class="panel-head"><h2>Documentos recientes</h2><button class="secondary" id="all">Ver todos →</button></div>${table(docs.slice(0, 6))}</section>`;
    $("#all").onclick = () => {
      page = "documents";
      render();
    };
    bindDocs();
  }
  if (page === "documents" || page === "trash") {
    await documentPage(v, page === "trash");
  }
  if (page === "categories") {
    v.innerHTML =
      heading(
        "Categorías",
        "Una estructura clara para cada tipo de documento.",
        me.role === "administrador"
          ? '<button id="new-category">＋ Nueva categoría</button>'
          : "",
      ) +
      `<div class="cards">${categories.map((c) => `<section class="panel category-card"><span class="badge">▦ &nbsp; ${c.total} documentos</span><h2>${esc(c.name)}</h2><p>${esc(c.description)}</p>${me.role === "administrador" ? `<button class="secondary" data-cat="${c.id}">Editar</button><button class="danger" data-delcat="${c.id}">Eliminar</button>` : ""}</section>`).join("")}</div>`;
    if ($("#new-category")) $("#new-category").onclick = () => categoryModal();
    document
      .querySelectorAll("[data-cat]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            categoryModal(
              categories.find((c) => c.id === Number(b.dataset.cat)),
            )),
      );
    document.querySelectorAll("[data-delcat]").forEach(
      (b) =>
        (b.onclick = () =>
          confirmModal(
            "Eliminar categoría",
            "Solo pueden eliminarse categorías sin documentos vinculados.",
            async () => {
              await api("/categories/" + b.dataset.delcat, {
                method: "DELETE",
              });
              await refresh();
            },
          )),
    );
  }
  if (page === "users") {
    const users = await api("/users");
    v.innerHTML =
      heading(
        "Usuarios",
        "Gestiona las cuentas y los permisos del personal.",
        '<button id="new-user">＋ Nuevo usuario</button>',
      ) +
      `<section class="panel"><div class="table-scroll"><table><thead><tr><th>NOMBRE</th><th>CORREO</th><th>ROL / ÁREA</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${roles[u.role]}<small class="block">${esc(areas.find((a) => a.id === u.area_id)?.name || "General")}</small></td><td><span class="badge">${u.active ? "Activo" : "Inactivo"}</span></td><td><button class="secondary" data-user="${u.id}">Editar</button></td></tr>`).join("")}</tbody></table></div></section>`;
    $("#new-user").onclick = () => userModal();
    document
      .querySelectorAll("[data-user]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            userModal(users.find((u) => u.id === Number(b.dataset.user)))),
      );
  }
  if (page === "areas") await areasPage(v);
  if (page === "backups") await backupsPage(v);
  if (page === "activity") {
    const rows = await api("/activity");
    v.innerHTML =
      heading(
        "Historial de actividad",
        "Últimas 200 operaciones. El administrador ve todas; el personal administrativo ve sus propias operaciones.",
      ) +
      `<section class="panel"><div class="table-scroll"><table><thead><tr><th>FECHA</th><th>USUARIO</th><th>ACCIÓN</th><th>DETALLE</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.created_at)} UTC</td><td>${esc(r.user)}</td><td>${esc(r.action)}</td><td>${esc(r.detail)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  if (page === "account") {
    v.innerHTML =
      heading("Mi cuenta", "Mantén protegidas tus credenciales de acceso.") +
      `<form class="panel account"><h2>Cambiar contraseña</h2><p>${esc(me.email)} · ${roles[me.role]}</p><label>Contraseña actual</label><input name="current" type="password" required autocomplete="current-password"><label>Nueva contraseña</label><input name="password" type="password" minlength="10" maxlength="128" required autocomplete="new-password"><p class="hint">Utiliza al menos 10 caracteres. Las demás sesiones se cerrarán al guardar.</p><button>Guardar contraseña</button></form>`;
    $(".account").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("/password", {
          method: "PUT",
          body: Object.fromEntries(new FormData(e.currentTarget)),
        });
        e.target.reset();
        toast("Contraseña actualizada");
      } catch (e) {
        toast(e.message);
      }
    };
  }
}
function categoryOptions(id) {
  return categories
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === Number(id) ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
}
function modal(title, body, save, label = "Guardar") {
  document.querySelector("dialog")?.remove();
  const d = document.createElement("dialog");
  d.innerHTML = `<header><h2>${title}</h2><button type="button" aria-label="Cerrar">×</button></header><form>${body}<div class="error" role="alert"></div><div class="actions"><button type="button" class="secondary" id="cancel">Cancelar</button><button type="submit">${label}</button></div></form>`;
  document.body.append(d);
  d.querySelector("header button").onclick = () => d.close();
  d.querySelector("#cancel").onclick = () => d.close();
  d.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const button = d.querySelector("[type=submit]");
    button.disabled = true;
    try {
      await save(new FormData(e.target));
      d.close();
    } catch (e) {
      d.querySelector(".error").textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
  d.onclose = () => d.remove();
  d.showModal();
}
function documentModal(d) {
  if (!categories.length)
    return toast("El administrador debe crear una categoría primero");
  modal(
    d ? "Editar documento" : "Registrar documento",
    field(
      "Título del documento",
      "title",
      d?.title || "",
      "text",
      'required maxlength="200"',
    ) +
      `<label for="description">Descripción</label><textarea id="description" name="description" maxlength="2000">${esc(d?.description || "")}</textarea><label for="category_id">Categoría</label><select id="category_id" name="category_id" required>${categoryOptions(d?.category_id)}</select>${areaSelect(d?.area_id || me.area_id, me.role !== "administrador")}${field("Gestión académica (opcional)", "academic_year", d?.academic_year || "", "number", 'min="2000" max="2099"')}<label for="visibility">Acceso al documento</label><select id="visibility" name="visibility"><option value="privado">Restringido · propietario y revisores del área</option><option value="area" ${d?.visibility === "area" ? "selected" : ""}>Área / carrera · usuarios de la misma área</option><option value="institucional" ${d?.visibility === "institucional" ? "selected" : ""}>Institucional · todos los usuarios autorizados</option></select>` +
      (!d
        ? field(
            "Archivo PDF o Word · máximo 10 MB",
            "file",
            "",
            "file",
            'required accept=".pdf,.doc,.docx"',
          )
        : "") +
      '<p class="hint">Los documentos nuevos y las modificaciones quedan pendientes de revisión. Usa acceso restringido para archivos personales.</p>',
    async (f) => {
      await api(d ? "/documents/" + d.id : "/documents", {
        method: d ? "PUT" : "POST",
        body: d ? Object.fromEntries(f) : f,
      });
      await refresh();
      toast(d ? "Documento actualizado" : "Documento registrado");
    },
    d ? "Guardar cambios" : "Subir documento",
  );
}
function categoryModal(c) {
  modal(
    c ? "Editar categoría" : "Nueva categoría",
    field("Nombre", "name", c?.name || "", "text", 'required maxlength="100"') +
      field(
        "Descripción",
        "description",
        c?.description || "",
        "text",
        'maxlength="500"',
      ),
    async (f) => {
      await api("/categories" + (c ? "/" + c.id : ""), {
        method: c ? "PUT" : "POST",
        body: Object.fromEntries(f),
      });
      await refresh();
      toast("Categoría guardada");
    },
  );
}
function userModal(u) {
  modal(
    u ? "Editar usuario" : "Nuevo usuario",
    field(
      "Nombre completo",
      "name",
      u?.name || "",
      "text",
      'required maxlength="100"',
    ) +
      field(
        "Correo electrónico",
        "email",
        u?.email || "",
        "email",
        'required maxlength="160"',
      ) +
      `<label for="role">Rol</label><select id="role" name="role">${Object.entries(
        roles,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${u?.role === k ? "selected" : ""}>${v}</option>`,
        )
        .join("")}</select>${areaSelect(u?.area_id || me.area_id)}` +
      (u
        ? `<label for="active">Estado</label><select name="active" id="active"><option value="1">Activo</option><option value="0" ${!u.active ? "selected" : ""}>Inactivo</option></select>`
        : field(
            "Contraseña inicial",
            "password",
            "",
            "password",
            'required minlength="10" maxlength="128" autocomplete="new-password"',
          )),
    async (f) => {
      const b = Object.fromEntries(f);
      if (u) b.active = Number(b.active);
      await api("/users" + (u ? "/" + u.id : ""), {
        method: u ? "PUT" : "POST",
        body: b,
      });
      me = await api("/me");
      await refresh();
      toast("Usuario guardado");
    },
  );
}
function confirmModal(title, message, fn) {
  modal(title, `<p class="hint">${esc(message)}</p>`, fn, "Confirmar");
}
try {
  me = await api("/me");
  await refresh();
} catch {
  login();
}

function areaSelect(id, restricted = false) {
  return `<label for="f-area_id">Área o carrera</label><select id="f-area_id" name="area_id" required>${areas
    .filter((a) => !restricted || a.id === me.area_id)
    .map(
      (a) =>
        `<option value="${a.id}" ${a.id === Number(id) ? "selected" : ""}>${esc(a.name)}</option>`,
    )
    .join("")}</select>`;
}
async function documentPage(v, trash) {
  const filters = await api("/document-filters");
  const items = trash ? await api("/trash") : docs;
  v.innerHTML =
    heading(
      trash ? "Papelera" : "Documentos",
      trash
        ? "Recupera los documentos retirados. Los archivos y sus versiones se conservan."
        : "Busca, revisa y consulta los archivos del instituto.",
      trash ? "" : uploadButton(),
    ) +
    `<section class="panel"><div class="panel-head"><h2>${trash ? "Documentos retirados" : "Repositorio documental"}</h2><small id="count">${items.length} documentos</small></div><form class="filters advanced-filters"><label class="search-filter">Búsqueda<input name="q" placeholder="Buscar por título, descripción o archivo…"></label><label>Categoría<select name="category"><option value="">Todas</option>${categoryOptions()}</select></label><label>Área / carrera<select name="area"><option value="">Todas</option>${areas.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label><label>Responsable<select name="owner"><option value="">Todos</option>${filters.owners.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></label><label>Formato<select name="format"><option value="">Todos</option><option>pdf</option><option>doc</option><option>docx</option></select></label><label>Estado<select name="status"><option value="">Todos</option>${Object.entries(
      statuses,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select></label><label>Gestión<input type="number" name="year" min="2000" max="2099" placeholder="2026"></label><label>Desde<input type="date" name="from"></label><label>Hasta<input type="date" name="to"></label><div class="filter-buttons"><button>Buscar</button><button type="reset" class="secondary">Limpiar</button></div></form>${!trash ? '<div class="report-actions"><a id="excel" class="link-button" href="/api/reports.xlsx">Exportar Excel</a><a id="pdf-report" class="link-button" href="/api/reports/print" target="_blank" rel="noopener">Reporte PDF / Imprimir</a><small>Los reportes usan los filtros aplicados y tus permisos de acceso.</small></div>' : ""}<div id="results">${table(items, trash)}</div></section>`;
  bindDocs(items);
  const form = $(".filters");
  const search = async () => {
    try {
      const params = new URLSearchParams(new FormData(form));
      const rows = await api((trash ? "/trash" : "/documents") + "?" + params);
      $("#results").innerHTML = table(rows, trash);
      $("#count").textContent = rows.length + " documentos";
      bindDocs(rows);
      if (!trash) {
        $("#excel").href = "/api/reports.xlsx?" + params;
        $("#pdf-report").href = "/api/reports/print?" + params;
      }
    } catch (e) {
      toast(e.message);
    }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    search();
  };
  form.onreset = () => setTimeout(search, 0);
}
function infoDialog(title, html, wide = false) {
  document.querySelector("dialog")?.remove();
  const d = document.createElement("dialog");
  if (wide) d.classList.add("wide-dialog");
  d.innerHTML = `<header><h2>${esc(title)}</h2><button aria-label="Cerrar">×</button></header><div class="dialog-content">${html}</div>`;
  document.body.append(d);
  d.querySelector("header button").onclick = () => d.close();
  d.onclose = () => d.remove();
  d.showModal();
  return d;
}
function previewModal(d) {
  infoDialog(
    d.title,
    `<iframe class="pdf-preview" title="Vista previa PDF" src="/api/documents/${d.id}/preview"></iframe><p><a href="/api/documents/${d.id}/download">Descargar PDF</a> · Si tu navegador no muestra PDF, descarga el archivo.</p>`,
    true,
  );
}
async function versionsModal(d) {
  const versions = await api("/documents/" + d.id + "/versions");
  const dialog = infoDialog(
    "Versiones · " + d.title,
    `<p>La versión más reciente es la actual. Una nueva carga conserva las anteriores y vuelve a revisión.</p><button id="new-version">＋ Subir nueva versión</button><div class="table-scroll"><table><thead><tr><th>VERSIÓN</th><th>ARCHIVO / NOTA</th><th>RESPONSABLE / FECHA</th><th>ACCIÓN</th></tr></thead><tbody>${versions.map((v) => `<tr><td>v${v.number}</td><td>${esc(v.filename)}<small class="block">${esc(v.note)}</small><small class="hash">SHA-256: ${esc(v.sha256)}</small></td><td>${esc(v.author)}<small class="block">${date(v.created_at)}</small></td><td><a href="/api/documents/${d.id}/versions/${v.id}/download">Descargar</a></td></tr>`).join("")}</tbody></table></div>`,
    true,
  );
  dialog.querySelector("#new-version").onclick = () =>
    modal(
      "Nueva versión de archivo",
      field(
        "Archivo PDF o Word · máximo 10 MB",
        "file",
        "",
        "file",
        'required accept=".pdf,.doc,.docx"',
      ) + field("Describe los cambios", "note", "", "text", 'maxlength="500"'),
      async (f) => {
        await api("/documents/" + d.id + "/versions", {
          method: "POST",
          body: f,
        });
        await refresh();
        toast("Versión registrada; pendiente de revisión");
      },
      "Subir versión",
    );
}
function reviewModal(d) {
  modal(
    "Revisar · " + d.title,
    `<p>Revisa el archivo antes de aprobarlo. La aprobación permite su consulta según la visibilidad configurada.</p><label for="review-status">Decisión</label><select id="review-status" name="status"><option value="aprobado">Aprobado</option><option value="observado">Observado</option></select><label for="review-comment">Comentarios (obligatorios si hay observaciones)</label><textarea id="review-comment" name="comment" maxlength="2000">${esc(d.review_comment)}</textarea>`,
    async (f) => {
      await api("/documents/" + d.id + "/review", {
        method: "POST",
        body: { ...Object.fromEntries(f), version: d.version },
      });
      await refresh();
      toast("Revisión registrada");
    },
  );
}
async function reviewsModal(d) {
  const reviews = await api("/documents/" + d.id + "/reviews");
  infoDialog(
    "Revisiones · " + d.title,
    `<p>Estado actual: <span class="badge status-${d.status}">${statuses[d.status]}</span></p>${reviews.length ? reviews.map((r) => `<article class="review-item"><strong>${statuses[r.status]} · ${r.version_number ? "v" + r.version_number : "Versión no registrada"} · ${esc(r.reviewer)}</strong><small class="block">${date(r.created_at)}</small><p>${esc(r.comment || "Sin comentarios")}</p></article>`).join("") : "<p>Todavía no se registraron revisiones.</p>"}`,
  );
}
async function areasPage(v) {
  v.innerHTML =
    heading(
      "Áreas y carreras",
      "Organiza las cuentas y los documentos por unidad institucional.",
      '<button id="new-area">＋ Nueva área</button>',
    ) +
    `<div class="cards">${areas.map((a) => `<section class="panel category-card"><span class="badge">Área / carrera</span><h2>${esc(a.name)}</h2><button class="secondary" data-area="${a.id}">Editar nombre</button></section>`).join("")}</div>`;
  $("#new-area").onclick = () => areaModal();
  document
    .querySelectorAll("[data-area]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          areaModal(areas.find((a) => a.id === Number(b.dataset.area)))),
    );
}
function areaModal(a) {
  modal(
    a ? "Editar área" : "Nueva área o carrera",
    field(
      "Nombre del área o carrera",
      "name",
      a?.name || "",
      "text",
      'required maxlength="100"',
    ),
    async (f) => {
      await api("/areas" + (a ? "/" + a.id : ""), {
        method: a ? "PUT" : "POST",
        body: Object.fromEntries(f),
      });
      await refresh();
      toast("Área guardada");
    },
  );
}
async function backupsPage(v) {
  const b = await api("/backups");
  v.innerHTML =
    heading(
      "Respaldos",
      "Protege la base de datos, los documentos y todas sus versiones.",
      '<button id="new-backup">＋ Crear respaldo ahora</button>',
    ) +
    `<p class="security-note">Se comprueba cada minuto si corresponde un respaldo: al iniciar y luego cada ${b.interval_hours} horas con el servidor activo. La limpieza automática conserva los ${b.retention} más recientes. Descarga copias a otro dispositivo. Para restaurar, detén el servidor y sigue el manual.</p><section class="panel"><div class="table-scroll"><table><thead><tr><th>RESPALDO</th><th>FECHA</th><th>TAMAÑO</th><th>ACCIÓN</th></tr></thead><tbody>${b.items.map((b) => `<tr><td>${esc(b.name)}</td><td>${new Date(b.created_at).toLocaleString("es-BO")}</td><td>${size(b.size)}</td><td><a href="/api/backups/${encodeURIComponent(b.name)}">Descargar ZIP</a></td></tr>`).join("")}</tbody></table></div></section><div class="panel restore-instructions"><h2>Restauración segura</h2><p>1. Detén el servidor con Ctrl+C.<br>2. Ejecuta en la carpeta del proyecto:</p><pre>npm.cmd run restore -- "C:\\respaldos\\ceicom-respaldo.zip"</pre><p>3. Vuelve a iniciar con <code>npm.cmd run dev</code>.<br>Se verifica la integridad y se crea una copia preventiva antes de reemplazar los datos. La restauración cierra todas las sesiones.</p></div>`;
  $("#new-backup").onclick = async () => {
    const btn = $("#new-backup");
    btn.disabled = true;
    btn.textContent = "Creando respaldo…";
    try {
      await api("/backups", { method: "POST" });
      await backupsPage(v);
      toast("Respaldo creado");
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = "Crear respaldo ahora";
    }
  };
}
