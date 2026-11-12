import express from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireLock,
  createBackup,
  listBackups,
  digest,
} from "./lib/storage.js";
const root = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
fs.mkdirSync(path.join(dir, "files"), { recursive: true });
const releaseLock = acquireLock(dir);
process.on("exit", releaseLock);
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
const db = new DatabaseSync(path.join(dir, "ceicom.sqlite"));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,description TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT,category_id INTEGER REFERENCES categories(id),owner_id INTEGER REFERENCES users(id),visibility TEXT NOT NULL,filename TEXT NOT NULL,storage TEXT NOT NULL,size INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,removed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),action TEXT,detail TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
// Additive migration from v1. Existing files and IDs are preserved.
if (db.prepare("PRAGMA user_version").get().user_version < 2) {
  if (db.prepare("SELECT id FROM users LIMIT 1").get()) createBackup(db, dir);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS areas(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL);
      INSERT OR IGNORE INTO areas(id,name) VALUES(1,'General');
      ALTER TABLE users ADD COLUMN area_id INTEGER REFERENCES areas(id);
      ALTER TABLE documents ADD COLUMN area_id INTEGER REFERENCES areas(id);
      UPDATE users SET area_id=1;
      UPDATE documents SET area_id=1;
      ALTER TABLE documents ADD COLUMN academic_year TEXT DEFAULT '';
      ALTER TABLE documents ADD COLUMN status TEXT NOT NULL DEFAULT 'aprobado';
      ALTER TABLE documents ADD COLUMN review_comment TEXT DEFAULT '';
      ALTER TABLE documents ADD COLUMN reviewed_by INTEGER REFERENCES users(id);
      CREATE TABLE versions(id INTEGER PRIMARY KEY,document_id INTEGER NOT NULL REFERENCES documents(id),number INTEGER NOT NULL,filename TEXT NOT NULL,storage TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,note TEXT DEFAULT '',created_by INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(document_id,number));
      CREATE TABLE reviews(id INTEGER PRIMARY KEY,document_id INTEGER REFERENCES documents(id),user_id INTEGER REFERENCES users(id),status TEXT NOT NULL,comment TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX document_filter ON documents(removed,area_id,status,created_at);
      CREATE INDEX versions_document ON versions(document_id);`);
    for (const d of db.prepare("SELECT * FROM documents").all()) {
      const b = fs.readFileSync(path.join(dir, "files", d.storage));
      db.prepare(
        "INSERT INTO versions(document_id,number,filename,storage,size,sha256,note,created_by,created_at) VALUES(?,1,?,?,?,?,?,?,?)",
      ).run(
        d.id,
        d.filename,
        d.storage,
        b.length,
        digest(b),
        "Versión original migrada",
        d.owner_id,
        d.created_at,
      );
    }
    db.exec("PRAGMA user_version=2; COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
if (db.prepare("PRAGMA user_version").get().user_version < 3) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "ALTER TABLE reviews ADD COLUMN version_number INTEGER; PRAGMA user_version=3; COMMIT",
    );
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
function hash(p) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
function verify(p, h) {
  const [s, k] = h.split(":");
  return timingSafeEqual(Buffer.from(k, "hex"), scryptSync(p, s, 64));
}
if (!db.prepare("SELECT id FROM users LIMIT 1").get()) {
  const password =
    process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  db.prepare(
    "INSERT INTO users(name,email,password,role,area_id) VALUES(?,?,?,?,1)",
  ).run(
    "Administrador CEICOM",
    "admin@ceicom.edu.bo",
    hash(password),
    "administrador",
  );
  if (!process.env.ADMIN_PASSWORD) {
    fs.writeFileSync(
      path.join(dir, "acceso-inicial.txt"),
      `Usuario: admin@ceicom.edu.bo\nContraseña: ${password}\nCambie la contraseña desde Mi cuenta.\n`,
      { mode: 0o600 },
    );
    console.log("Credenciales iniciales guardadas en data/acceso-inicial.txt");
  }
  for (const [n, d] of [
    ["Documentación docente", "Currículums, certificados y antecedentes"],
    ["Planificación académica", "Planes globales y programas de estudio"],
    ["Documentación administrativa", "Informes, actas y comunicados"],
  ])
    db.prepare("INSERT INTO categories(name,description) VALUES(?,?)").run(
      n,
      d,
    );
}
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-src 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'",
  });
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== `${req.protocol}://${req.get("host")}`
  )
    return res.status(403).json({ error: "Origen no permitido" });
  next();
});
app.use(express.json({ limit: "100kb" }));
const fail = (res, message, status = 400) =>
  res.status(status).json({ error: message });
const audit = (u, a, d) =>
  db
    .prepare("INSERT INTO activity(user_id,action,detail) VALUES(?,?,?)")
    .run(u, a, String(d));
const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  area_id: u.area_id,
});
const attempts = new Map();
app.post("/api/login", (req, res) => {
  const key = req.ip;
  const a = attempts.get(key) || { count: 0, until: 0 };
  if (a.until > Date.now() && a.count >= 10)
    return fail(res, "Demasiados intentos. Espere 15 minutos.", 429);
  if (a.until < Date.now()) {
    a.count = 0;
    a.until = Date.now() + 900000;
  }
  const { email, password } = req.body || {};
  const u = db
    .prepare("SELECT * FROM users WHERE email=? AND active=1")
    .get(String(email || "").toLowerCase());
  if (
    typeof password !== "string" ||
    password.length > 256 ||
    !u ||
    !verify(password, u.password)
  ) {
    a.count++;
    attempts.set(key, a);
    return fail(res, "Correo o contraseña incorrectos", 401);
  }
  attempts.delete(key);
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    createHash("sha256").update(token).digest("hex"),
    u.id,
    Date.now() + 28800000,
  );
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure,
    maxAge: 28800000,
  });
  audit(u.id, "Inicio de sesión", u.email);
  res.json(safeUser(u));
});
app.use("/api", (req, res, next) => {
  const raw =
    (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("session="))
      ?.slice(8) || "";
  req.session = createHash("sha256").update(raw).digest("hex");
  req.user = db
    .prepare(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1",
    )
    .get(req.session, Date.now());
  if (!req.user) return fail(res, "Inicie sesión para continuar", 401);
  res.set("Cache-Control", "no-store");
  next();
});
const admin = (req, res, next) =>
  req.user.role === "administrador"
    ? next()
    : fail(res, "Acceso reservado al administrador", 403);
const staff = (req, res, next) =>
  req.user.role !== "docente"
    ? next()
    : fail(res, "No tiene permiso para esta operación", 403);
app.get("/api/me", (req, res) => res.json(safeUser(req.user)));
app.post("/api/logout", (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.session);
  res.clearCookie("session");
  res.json({ ok: true });
});
app.put("/api/password", (req, res) => {
  const { current, password } = req.body;
  if (typeof current !== "string" || !verify(current, req.user.password))
    return fail(res, "Contraseña actual incorrecta");
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    return fail(res, "Use entre 10 y 128 caracteres");
  db.prepare("UPDATE users SET password=? WHERE id=?").run(
    hash(password),
    req.user.id,
  );
  db.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").run(
    req.user.id,
    req.session,
  );
  audit(req.user.id, "Cambio de contraseña", "Mi cuenta");
  res.json({ ok: true });
});
app.get("/api/categories", (req, res) => {
  const visible = listDocuments(req.user, {});
  res.json(
    db
      .prepare("SELECT * FROM categories ORDER BY name")
      .all()
      .map((c) => ({
        ...c,
        total: visible.filter((d) => d.category_id === c.id).length,
      })),
  );
});
app.get("/api/areas", (req, res) =>
  res.json(db.prepare("SELECT * FROM areas ORDER BY name").all()),
);
app.post("/api/areas", admin, (req, res) => {
  if (!text(req.body.name, 100))
    return fail(res, "Ingrese un nombre de área válido");
  const r = db
    .prepare("INSERT INTO areas(name) VALUES(?)")
    .run(req.body.name.trim());
  audit(req.user.id, "Área creada", req.body.name);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.put("/api/areas/:id", admin, (req, res) => {
  if (!text(req.body.name, 100))
    return fail(res, "Ingrese un nombre de área válido");
  if (
    !db
      .prepare("UPDATE areas SET name=? WHERE id=?")
      .run(req.body.name.trim(), req.params.id).changes
  )
    return fail(res, "Área no encontrada", 404);
  audit(req.user.id, "Área actualizada", req.body.name);
  res.json({ ok: true });
});
const text = (v, max = 200) =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
app.post("/api/categories", admin, (req, res) => {
  const { name, description = "" } = req.body;
  if (!text(name, 100) || description.length > 500)
    return fail(
      res,
      "Ingrese un nombre válido y descripción de hasta 500 caracteres",
    );
  const r = db
    .prepare("INSERT INTO categories(name,description) VALUES(?,?)")
    .run(name.trim(), description);
  audit(req.user.id, "Categoría creada", name);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.put("/api/categories/:id", admin, (req, res) => {
  const { name, description = "" } = req.body;
  if (!text(name, 100) || description.length > 500)
    return fail(res, "Datos de categoría inválidos");
  if (
    !db
      .prepare("UPDATE categories SET name=?,description=? WHERE id=?")
      .run(name.trim(), description, req.params.id).changes
  )
    return fail(res, "Categoría no encontrada", 404);
  audit(req.user.id, "Categoría actualizada", name);
  res.json({ ok: true });
});
app.delete("/api/categories/:id", admin, (req, res) => {
  if (
    db
      .prepare("SELECT id FROM documents WHERE category_id=? LIMIT 1")
      .get(req.params.id)
  )
    return fail(
      res,
      "La categoría está vinculada a documentos y debe conservarse",
    );
  db.prepare("DELETE FROM categories WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
app.get("/api/users", admin, (req, res) =>
  res.json(
    db
      .prepare(
        "SELECT id,name,email,role,active,area_id FROM users ORDER BY name",
      )
      .all(),
  ),
);
function userInput(b) {
  return (
    text(b.name, 100) &&
    text(b.email, 160) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) &&
    ["administrador", "administrativo", "docente"].includes(b.role) &&
    db.prepare("SELECT id FROM areas WHERE id=?").get(Number(b.area_id) || 1)
  );
}
app.post("/api/users", admin, (req, res) => {
  const b = req.body;
  if (
    !userInput(b) ||
    typeof b.password !== "string" ||
    b.password.length < 10 ||
    b.password.length > 128
  )
    return fail(
      res,
      "Revise los datos; la contraseña requiere entre 10 y 128 caracteres",
    );
  const r = db
    .prepare(
      "INSERT INTO users(name,email,password,role,area_id) VALUES(?,?,?,?,?)",
    )
    .run(
      b.name.trim(),
      b.email.trim().toLowerCase(),
      hash(b.password),
      b.role,
      Number(b.area_id) || 1,
    );
  audit(req.user.id, "Usuario creado", b.email);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.put("/api/users/:id", admin, (req, res) => {
  const b = req.body;
  if (!userInput(b) || ![0, 1].includes(b.active))
    return fail(res, "Datos inválidos");
  if (
    Number(req.params.id) === req.user.id &&
    (b.active !== 1 || b.role !== "administrador")
  )
    return fail(
      res,
      "No puede desactivar ni quitar permisos a su propia cuenta",
    );
  if (
    !db
      .prepare(
        "UPDATE users SET name=?,email=?,role=?,active=?,area_id=? WHERE id=?",
      )
      .run(
        b.name.trim(),
        b.email.trim().toLowerCase(),
        b.role,
        b.active,
        Number(b.area_id) || 1,
        req.params.id,
      ).changes
  )
    return fail(res, "Usuario no encontrado", 404);
  db.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").run(
    req.params.id,
    Number(req.params.id) === req.user.id ? req.session : "",
  );
  audit(req.user.id, "Usuario actualizado", b.email);
  res.json({ ok: true });
});
function canManage(u, d) {
  return (
    u.role === "administrador" ||
    d.owner_id === u.id ||
    (u.role === "administrativo" && d.area_id === u.area_id)
  );
}
function canRead(u, d) {
  return (
    canManage(u, d) ||
    (d.status === "aprobado" &&
      (d.visibility === "institucional" ||
        (d.visibility === "area" && d.area_id === u.area_id)))
  );
}
function canReview(u, d) {
  return (
    u.role === "administrador" ||
    (u.role === "administrativo" && d.area_id === u.area_id)
  );
}
function listDocuments(u, q, removed = 0) {
  const args = [removed];
  let where = "d.removed=?";
  if (u.role !== "administrador") {
    where += ` AND (d.owner_id=? OR (?='administrativo' AND d.area_id=?) OR (d.status='aprobado' AND (d.visibility='institucional' OR (d.visibility='area' AND d.area_id=?))))`;
    args.push(u.id, u.role, u.area_id, u.area_id);
  }
  for (const [param, col] of [
    ["category", "d.category_id"],
    ["owner", "d.owner_id"],
    ["area", "d.area_id"],
  ])
    if (q[param]) {
      where += ` AND ${col}=?`;
      args.push(Number(q[param]) || 0);
    }
  if (q.status) {
    where += " AND d.status=?";
    args.push(String(q.status));
  }
  if (q.year) {
    where += " AND d.academic_year=?";
    args.push(String(q.year));
  }
  if (q.from) {
    where += " AND date(d.created_at)>=date(?)";
    args.push(String(q.from));
  }
  if (q.to) {
    where += " AND date(d.created_at)<=date(?)";
    args.push(String(q.to));
  }
  if (q.format) {
    where += " AND lower(d.filename) LIKE ?";
    args.push("%." + String(q.format).toLowerCase());
  }
  if (q.q) {
    where +=
      " AND (d.title LIKE ? OR d.description LIKE ? OR d.filename LIKE ?)";
    args.push(...Array(3).fill("%" + String(q.q).slice(0, 200) + "%"));
  }
  const rows = db
    .prepare(
      `SELECT d.id,d.title,d.description,d.category_id,d.owner_id,d.visibility,d.filename,d.size,d.created_at,d.updated_at,d.area_id,d.academic_year,d.status,d.review_comment,d.removed,c.name AS category,u.name AS owner,a.name AS area,(SELECT MAX(number) FROM versions v WHERE v.document_id=d.id) AS version FROM documents d JOIN categories c ON c.id=d.category_id JOIN users u ON u.id=d.owner_id LEFT JOIN areas a ON a.id=d.area_id WHERE ${where} ORDER BY d.created_at DESC,d.id DESC`,
    )
    .all(...args);
  return rows
    .filter((d) => !removed || canManage(u, d))
    .map((d) => ({
      ...d,
      can_manage: canManage(u, d),
      can_review: canReview(u, d),
    }));
}
app.get("/api/documents", (req, res) =>
  res.json(listDocuments(req.user, req.query)),
);
app.get("/api/trash", (req, res) =>
  res.json(listDocuments(req.user, req.query, 1)),
);
app.get("/api/document-filters", (req, res) => {
  const rows = listDocuments(req.user, {});
  const owners = [
    ...new Map(
      rows.map((d) => [d.owner_id, { id: d.owner_id, name: d.owner }]),
    ).values(),
  ];
  res.json({
    owners,
    years: [...new Set(rows.map((d) => d.academic_year).filter(Boolean))]
      .sort()
      .reverse(),
  });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 12 },
});
function documentInput(b, u) {
  const area = Number(b.area_id) || u.area_id;
  return (
    text(b.title) &&
    typeof (b.description || "") === "string" &&
    (b.description || "").length <= 2000 &&
    ["privado", "institucional", "area"].includes(b.visibility) &&
    (!b.academic_year || /^20[0-9]{2}$/.test(String(b.academic_year))) &&
    db
      .prepare("SELECT id FROM categories WHERE id=?")
      .get(Number(b.category_id) || 0) &&
    db.prepare("SELECT id FROM areas WHERE id=?").get(area) &&
    (u.role === "administrador" || area === u.area_id)
  );
}
function validFile(f) {
  if (!f) return false;
  const ext = path.extname(f.originalname).toLowerCase();
  if (ext === ".pdf") return f.buffer.subarray(0, 5).toString() === "%PDF-";
  if (ext === ".doc")
    return f.buffer
      .subarray(0, 8)
      .equals(Buffer.from("d0cf11e0a1b11ae1", "hex"));
  if (ext === ".docx") {
    try {
      const entries = new AdmZip(f.buffer).getEntries();
      return (
        entries.some((e) => e.entryName === "[Content_Types].xml") &&
        entries.some((e) => e.entryName === "word/document.xml") &&
        entries.every((e) => e.header.size < 25 * 1024 * 1024)
      );
    } catch {
      return false;
    }
  }
  return false;
}
function saveUpload(f, fn) {
  const storage = randomBytes(24).toString("hex");
  const dest = path.join(dir, "files", storage);
  try {
    fs.writeFileSync(dest, f.buffer, { flag: "wx" });
    return transaction(() => fn(storage));
  } catch (e) {
    fs.rmSync(dest, { force: true });
    throw e;
  }
}
function addVersion(d, f, storage, u, note) {
  const number = db
    .prepare(
      "SELECT COALESCE(MAX(number),0)+1 AS n FROM versions WHERE document_id=?",
    )
    .get(d).n;
  db.prepare(
    "INSERT INTO versions(document_id,number,filename,storage,size,sha256,note,created_by) VALUES(?,?,?,?,?,?,?,?)",
  ).run(
    d,
    number,
    path.basename(f.originalname),
    storage,
    f.size,
    digest(f.buffer),
    note,
    u,
  );
  return number;
}
app.post("/api/documents", upload.single("file"), (req, res) => {
  const b = req.body;
  if (!documentInput(b, req.user))
    return fail(res, "Revise título, categoría, área, gestión y acceso");
  if (!validFile(req.file))
    return fail(res, "Seleccione un PDF, DOC o DOCX válido (máximo 10 MB)");
  const id = saveUpload(req.file, (storage) => {
    const r = db
      .prepare(
        "INSERT INTO documents(title,description,category_id,owner_id,visibility,filename,storage,size,area_id,academic_year,status) VALUES(?,?,?,?,?,?,?,?,?,?,'pendiente')",
      )
      .run(
        b.title.trim(),
        b.description || "",
        Number(b.category_id),
        req.user.id,
        b.visibility,
        path.basename(req.file.originalname),
        storage,
        req.file.size,
        Number(b.area_id) || req.user.area_id,
        b.academic_year || "",
      );
    const id = Number(r.lastInsertRowid);
    addVersion(id, req.file, storage, req.user.id, "Versión inicial");
    audit(req.user.id, "Documento registrado", b.title);
    return id;
  });
  res.status(201).json({ id });
});
function getDoc(req, res, { edit = false, removed = 0, review = false } = {}) {
  const d = db
    .prepare("SELECT * FROM documents WHERE id=? AND removed=?")
    .get(req.params.id, removed);
  if (!d) {
    fail(res, "Documento no encontrado", 404);
    return null;
  }
  if (
    !(review
      ? canReview(req.user, d)
      : edit
        ? canManage(req.user, d)
        : canRead(req.user, d))
  ) {
    fail(res, "No tiene acceso a este documento", 403);
    return null;
  }
  return d;
}
function sendDocument(req, res, version, preview = false) {
  const d = getDoc(req, res);
  if (!d) return;
  let f = d;
  if (version) {
    f = db
      .prepare("SELECT * FROM versions WHERE document_id=? AND id=?")
      .get(d.id, req.params.version);
    if (!f) return fail(res, "Versión no encontrada", 404);
  }
  // Historical files are reserved for managers; public readers see only the current approved file.
  if (version && !canManage(req.user, d))
    return fail(
      res,
      "El historial está reservado al responsable y revisores",
      403,
    );
  audit(
    req.user.id,
    preview ? "Vista previa" : "Documento descargado",
    d.title + (version ? " · versión " + f.number : ""),
  );
  if (preview) {
    if (path.extname(f.filename).toLowerCase() !== ".pdf")
      return fail(res, "La vista previa está disponible para PDF");
    res.type("application/pdf");
    res.set("Content-Disposition", 'inline; filename="documento.pdf"');
    res.sendFile(path.join(dir, "files", f.storage));
  } else res.download(path.join(dir, "files", f.storage), f.filename);
}
app.get("/api/documents/:id/download", (req, res) =>
  sendDocument(req, res, false),
);
app.get("/api/documents/:id/preview", (req, res) =>
  sendDocument(req, res, false, true),
);
app.get("/api/documents/:id/versions/:version/download", (req, res) =>
  sendDocument(req, res, true),
);
app.get("/api/documents/:id/versions", (req, res) => {
  const d = getDoc(req, res, { edit: true });
  if (!d) return;
  res.json(
    db
      .prepare(
        "SELECT v.id,v.number,v.filename,v.size,v.sha256,v.note,v.created_at,u.name AS author FROM versions v LEFT JOIN users u ON u.id=v.created_by WHERE v.document_id=? ORDER BY number DESC",
      )
      .all(d.id),
  );
});
app.post(
  "/api/documents/:id/versions",
  (req, res, next) => {
    if (!getDoc(req, res, { edit: true })) return;
    next();
  },
  upload.single("file"),
  (req, res) => {
    const d = getDoc(req, res, { edit: true });
    if (!d) return;
    if (
      !validFile(req.file) ||
      typeof (req.body.note || "") !== "string" ||
      (req.body.note || "").length > 500
    )
      return fail(
        res,
        "Archivo o nota no válidos (máximo 10 MB y 500 caracteres)",
      );
    const number = saveUpload(req.file, (storage) => {
      const n = addVersion(
        d.id,
        req.file,
        storage,
        req.user.id,
        req.body.note || "",
      );
      db.prepare(
        "UPDATE documents SET filename=?,storage=?,size=?,status='pendiente',review_comment='',reviewed_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(path.basename(req.file.originalname), storage, req.file.size, d.id);
      audit(req.user.id, "Nueva versión", d.title + " · v" + n);
      return n;
    });
    res.status(201).json({ number });
  },
);
app.put("/api/documents/:id", (req, res) => {
  const d = getDoc(req, res, { edit: true });
  if (!d) return;
  const b = req.body;
  if (!documentInput(b, req.user))
    return fail(res, "Datos de documento inválidos");
  transaction(() => {
    db.prepare(
      "UPDATE documents SET title=?,description=?,category_id=?,visibility=?,area_id=?,academic_year=?,status='pendiente',review_comment='',reviewed_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      b.title.trim(),
      b.description || "",
      Number(b.category_id),
      b.visibility,
      Number(b.area_id) || d.area_id,
      b.academic_year ?? d.academic_year,
      d.id,
    );
    audit(req.user.id, "Documento actualizado", b.title);
  });
  res.json({ ok: true });
});
app.delete("/api/documents/:id", (req, res) => {
  const d = getDoc(req, res, { edit: true });
  if (!d) return;
  transaction(() => {
    db.prepare(
      "UPDATE documents SET removed=1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(d.id);
    audit(req.user.id, "Documento retirado", d.title);
  });
  res.json({ ok: true });
});
app.post("/api/documents/:id/restore", (req, res) => {
  const d = getDoc(req, res, { edit: true, removed: 1 });
  if (!d) return;
  transaction(() => {
    db.prepare(
      "UPDATE documents SET removed=0,status='pendiente',review_comment='',reviewed_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(d.id);
    audit(req.user.id, "Documento restaurado", d.title);
  });
  res.json({ ok: true });
});
app.get("/api/documents/:id/reviews", (req, res) => {
  const d = getDoc(req, res);
  if (!d) return;
  res.json(
    db
      .prepare(
        "SELECT r.*,u.name AS reviewer FROM reviews r JOIN users u ON u.id=r.user_id WHERE document_id=? ORDER BY r.id DESC",
      )
      .all(d.id),
  );
});
app.post("/api/documents/:id/review", staff, (req, res) => {
  const d = getDoc(req, res, { review: true });
  if (!d) return;
  const { status, comment = "", version } = req.body;
  const currentVersion = db
    .prepare("SELECT MAX(number) AS n FROM versions WHERE document_id=?")
    .get(d.id).n;
  if (!Number.isInteger(version) || version !== currentVersion)
    return fail(
      res,
      "El archivo cambió. Actualice el listado y revise la versión actual.",
      409,
    );
  if (
    !["aprobado", "observado"].includes(status) ||
    typeof comment !== "string" ||
    comment.length > 2000 ||
    (status === "observado" && !comment.trim())
  )
    return fail(
      res,
      "Seleccione un estado y describa las observaciones cuando corresponda",
    );
  transaction(() => {
    db.prepare(
      "UPDATE documents SET status=?,review_comment=?,reviewed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(status, comment.trim(), req.user.id, d.id);
    db.prepare(
      "INSERT INTO reviews(document_id,user_id,status,comment,version_number) VALUES(?,?,?,?,?)",
    ).run(d.id, req.user.id, status, comment.trim(), currentVersion);
    audit(req.user.id, "Documento " + status, d.title);
  });
  res.json({ ok: true });
});
const xml = (v) =>
  String(v ?? "").replace(
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
const reportHeaders = [
  "Título",
  "Categoría",
  "Responsable",
  "Área / carrera",
  "Gestión",
  "Estado",
  "Acceso",
  "Archivo",
  "Versión",
  "Fecha",
];
function reportRows(req) {
  return listDocuments(req.user, req.query).map((d) => [
    d.title,
    d.category,
    d.owner,
    d.area,
    d.academic_year,
    d.status,
    d.visibility,
    d.filename,
    d.version,
    d.created_at,
  ]);
}
app.get("/api/reports.xlsx", (req, res) => {
  const rows = [reportHeaders, ...reportRows(req)],
    zip = new AdmZip();
  const letters = (n) => {
    let s = "";
    for (n++; n; n = Math.floor((n - 1) / 26))
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  zip.addFile(
    "[Content_Types].xml",
    Buffer.from(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
  );
  zip.addFile(
    "_rels/.rels",
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
  );
  zip.addFile(
    "xl/workbook.xml",
    Buffer.from(
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Inventario CEICOM" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
  );
  zip.addFile(
    "xl/_rels/workbook.xml.rels",
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
  );
  zip.addFile(
    "xl/worksheets/sheet1.xml",
    Buffer.from(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        rows
          .map(
            (r, i) =>
              `<row r="${i + 1}">` +
              r
                .map(
                  (v, j) =>
                    `<c r="${letters(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`,
                )
                .join("") +
              "</row>",
          )
          .join("") +
        "</sheetData></worksheet>",
    ),
  );
  audit(req.user.id, "Reporte Excel", String(rows.length - 1) + " documentos");
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .attachment("inventario-ceicom.xlsx")
    .send(zip.toBuffer());
});
app.get("/api/reports/print", (req, res) => {
  const rows = reportRows(req);
  audit(req.user.id, "Reporte imprimible", rows.length + " documentos");
  res
    .type("html")
    .send(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Inventario CEICOM</title><link rel="stylesheet" href="/report.css"></head><body><button id="print">Imprimir / Guardar como PDF</button><h1>CEICOM · Inventario documental</h1><p>Generado: ${xml(new Date().toISOString())} · Usuario: ${xml(req.user.name)} · ${rows.length} documentos</p><p>Filtros aplicados: ${xml(new URLSearchParams(req.query).toString() || "Todos los documentos autorizados")}</p><table><thead><tr>${reportHeaders.map((h) => "<th>" + h + "</th>").join("")}</tr></thead><tbody>${rows.map((r) => "<tr>" + r.map((v) => "<td>" + xml(v) + "</td>").join("") + "</tr>").join("")}</tbody></table><script src="/report.js"></script></body></html>`,
    );
});
app.get("/api/backups", admin, (req, res) =>
  res.json({ items: listBackups(dir), interval_hours: 24, retention: 7 }),
);
app.post("/api/backups", admin, (req, res) => {
  const b = createBackup(db, dir);
  audit(req.user.id, "Respaldo creado", b.name);
  res.status(201).json(b);
});
app.get("/api/backups/:name", admin, (req, res) => {
  const b = listBackups(dir).find((b) => b.name === req.params.name);
  if (!b) return fail(res, "Respaldo no encontrado", 404);
  audit(req.user.id, "Respaldo descargado", b.name);
  res.download(path.join(dir, "backups", b.name));
});
function automaticBackup() {
  try {
    const latest = listBackups(dir)[0];
    if (
      !latest ||
      Date.now() - new Date(latest.created_at).getTime() >= 24 * 3600000
    ) {
      const b = createBackup(db, dir);
      console.log("Respaldo automático: " + b.name);
      for (const old of listBackups(dir).slice(7))
        fs.unlinkSync(path.join(dir, "backups", old.name));
    }
  } catch (e) {
    console.error("No se pudo crear el respaldo automático: " + e.message);
  }
}
automaticBackup();
setInterval(automaticBackup, 60000).unref();
app.get("/api/activity", staff, (req, res) =>
  res.json(
    db
      .prepare(
        "SELECT a.*,u.name AS user FROM activity a JOIN users u ON u.id=a.user_id WHERE (?='administrador' OR a.user_id=?) ORDER BY a.id DESC LIMIT 200",
      )
      .all(req.user.role, req.user.id),
  ),
);

app.use(express.static(path.join(root, "public")));
app.use((err, req, res, next) => {
  console.error(err.code || "SERVER_ERROR", err.message);
  if (res.headersSent) return next(err);
  fail(
    res,
    err instanceof multer.MulterError
      ? "Archivo demasiado grande o formulario inválido"
      : String(err.code || "").includes("CONSTRAINT")
        ? "El registro ya existe o está relacionado con otros datos"
        : "No se pudo completar la operación",
    err instanceof multer.MulterError ? 400 : 500,
  );
});
app.use("/api", (req, res) => fail(res, "Ruta no encontrada", 404));
const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`CEICOM disponible en http://localhost:${port}`),
);

server.on("error", (e) => {
  console.error(e.message);
  process.exit(1);
});
