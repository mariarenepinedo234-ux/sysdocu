import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import { scryptSync, createHash } from "node:crypto";
import AdmZip from "adm-zip";
const cwd = path.resolve(import.meta.dirname, "..");
const password = "PruebaExtendida123!";
function server(dir, port) {
  let child;
  return {
    async start() {
      child = spawn(process.execPath, ["server.js"], {
        cwd,
        env: {
          ...process.env,
          PORT: String(port),
          DATA_DIR: dir,
          ADMIN_PASSWORD: password,
        },
        stdio: "pipe",
      });
      let log = "";
      child.stderr.on("data", (d) => (log += d));
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) throw Error(log);
        try {
          if ((await fetch(`http://127.0.0.1:${port}`)).ok) return;
        } catch {}
        await delay(75);
      }
      throw Error(log || "Sin respuesta del servidor");
    },
    async stop() {
      if (child && child.exitCode === null)
        await new Promise((r) => {
          child.once("exit", r);
          child.kill();
        });
    },
  };
}

test("Mejoras v2: permisos, versiones, reportes, papelera y recuperación", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ceicom-v2-"));
  const service = server(dir, 3199);
  t.after(async () => {
    await service.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await service.start();
  const base = "http://127.0.0.1:3199/api";
  async function req(route, cookie, method = "GET", body) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (body && !(body instanceof FormData))
      headers["content-type"] = "application/json";
    return fetch(base + route, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
  }
  async function login(email = "admin@ceicom.edu.bo") {
    const r = await req("/login", null, "POST", { email, password });
    assert.equal(r.status, 200);
    return r.headers.get("set-cookie").split(";")[0];
  }
  const admin = await login();
  const category = (await (await req("/categories", admin)).json())[0].id;
  const area = (
    await (
      await req("/areas", admin, "POST", { name: "Sistemas Informáticos" })
    ).json()
  ).id;
  const otherArea = (
    await (
      await req("/areas", admin, "POST", { name: "Administración de Empresas" })
    ).json()
  ).id;
  const createUser = async (name, role, area_id) => {
    const r = await req("/users", admin, "POST", {
      name,
      email: name + "@ceicom.edu.bo",
      password,
      role,
      area_id,
    });
    assert.equal(r.status, 201);
    return (await r.json()).id;
  };
  const ownerId = await createUser("autor", "docente", area);
  await createUser("colega", "docente", area);
  await createUser("externo", "docente", otherArea);
  await createUser("revisor", "administrativo", area);
  await createUser("revisor-externo", "administrativo", otherArea);
  const owner = await login("autor@ceicom.edu.bo"),
    peer = await login("colega@ceicom.edu.bo"),
    outsider = await login("externo@ceicom.edu.bo"),
    reviewer = await login("revisor@ceicom.edu.bo"),
    outsideReviewer = await login("revisor-externo@ceicom.edu.bo");
  const original = Buffer.from("%PDF-1.4\nVersion original\n%%EOF"),
    updated = Buffer.from("%PDF-1.4\nVersion corregida\n%%EOF");
  let id, oldVersion, newVersion, backup;
  async function upload(
    bytes = original,
    visibility = "area",
    targetArea = area,
  ) {
    const f = new FormData();
    f.set("title", "=SUM(1,2) · Plan académico");
    f.set("description", "Contenido para revisión");
    f.set("category_id", String(category));
    f.set("area_id", String(targetArea));
    f.set("academic_year", "2026");
    f.set("visibility", visibility);
    f.set("file", new Blob([bytes]), "plan.pdf");
    return req("/documents", owner, "POST", f);
  }
  await t.test(
    "Asignación de área y documento pendiente sin filtración",
    async () => {
      assert.equal((await upload(original, "area", otherArea)).status, 400);
      const r = await upload();
      assert.equal(r.status, 201);
      id = (await r.json()).id;
      for (const c of [peer, outsider, outsideReviewer]) {
        assert.equal((await req(`/documents/${id}/download`, c)).status, 403);
        assert.equal((await (await req("/documents", c)).json()).length, 0);
        const cats = await (await req("/categories", c)).json();
        assert.equal(cats.find((x) => x.id === category).total, 0);
      }
      assert.equal(
        (await req(`/documents/${id}/download`, reviewer)).status,
        200,
      );
      assert.equal(
        (
          await req(`/documents/${id}/review`, outsideReviewer, "POST", {
            status: "aprobado",
            version: 1,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await req(`/documents/${id}/review`, owner, "POST", {
            status: "aprobado",
            version: 1,
          })
        ).status,
        403,
      );
    },
  );
  await t.test("Observaciones obligatorias y aprobación por área", async () => {
    assert.equal(
      (
        await req(`/documents/${id}/review`, reviewer, "POST", {
          status: "observado",
          version: 1,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req(`/documents/${id}/review`, reviewer, "POST", {
          status: "observado",
          version: 1,
          comment: "Corregir el contenido del plan.",
        })
      ).status,
      200,
    );
    assert.equal((await req(`/documents/${id}/download`, peer)).status, 403);
    assert.equal(
      (
        await req(`/documents/${id}/review`, reviewer, "POST", {
          status: "aprobado",
          version: 1,
          comment: "Verificado",
        })
      ).status,
      200,
    );
    assert.equal((await req(`/documents/${id}/download`, peer)).status, 200);
    assert.equal(
      (await req(`/documents/${id}/download`, outsider)).status,
      403,
    );
    const history = await (await req(`/documents/${id}/reviews`, owner)).json();
    assert.equal(history.length, 2);
    assert.equal(history[0].version_number, 1);
    assert.equal(history[1].comment, "Corregir el contenido del plan.");
  });
  await t.test("Vista previa PDF protegida y filtros combinados", async () => {
    const preview = await req(`/documents/${id}/preview`, peer);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get("content-type"), /application\/pdf/);
    assert.match(preview.headers.get("content-disposition"), /inline/);
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()), original);
    assert.equal((await req(`/documents/${id}/preview`)).status, 401);
    const q = new URLSearchParams({
      q: "académico",
      category,
      area,
      owner: ownerId,
      format: "pdf",
      year: "2026",
      status: "aprobado",
      from: "2000-01-01",
      to: "2099-12-31",
    });
    assert.equal((await (await req("/documents?" + q, peer)).json()).length, 1);
    assert.equal(
      (await (await req("/documents?year=2025", peer)).json()).length,
      0,
    );
    assert.equal(
      (await (await req("/documents?format=docx", peer)).json()).length,
      0,
    );
  });
  await t.test(
    "Excel real sin fórmulas y reporte imprimible con los mismos permisos",
    async () => {
      const r = await req("/reports.xlsx?year=2026", peer);
      assert.equal(r.status, 200);
      const zip = new AdmZip(Buffer.from(await r.arrayBuffer()));
      const sheet = zip.readAsText("xl/worksheets/sheet1.xml");
      assert.match(sheet, /inlineStr/);
      assert.match(sheet, /SUM\(1,2\)/);
      assert.ok(!sheet.includes("<f>"));
      assert.match(sheet, /Sistemas Informáticos/);
      const outsiderReport = new AdmZip(
        Buffer.from(await (await req("/reports.xlsx", outsider)).arrayBuffer()),
      );
      assert.ok(
        !outsiderReport
          .readAsText("xl/worksheets/sheet1.xml")
          .includes("Plan académico"),
      );
      const html = await (await req("/reports/print?year=2026", peer)).text();
      assert.match(html, /Guardar como PDF/);
      assert.match(html, /Plan académico/);
      assert.equal((await req("/reports.xlsx")).status, 401);
    },
  );
  await t.test(
    "Historial de versiones íntegro y nueva carga vuelve a revisión",
    async () => {
      oldVersion = (
        await (await req(`/documents/${id}/versions`, owner)).json()
      )[0].id;
      assert.equal((await req(`/documents/${id}/versions`, peer)).status, 403);
      const f = new FormData();
      f.set("note", "Correcciones solicitadas");
      f.set("file", new Blob([updated]), "plan-v2.pdf");
      const r = await req(`/documents/${id}/versions`, owner, "POST", f);
      assert.equal(r.status, 201);
      assert.equal((await r.json()).number, 2);
      const versions = await (
        await req(`/documents/${id}/versions`, owner)
      ).json();
      assert.equal(versions.length, 2);
      assert.equal(
        (
          await req(`/documents/${id}/review`, reviewer, "POST", {
            status: "aprobado",
            version: 1,
          })
        ).status,
        409,
      );
      newVersion = versions[0].id;
      assert.equal(
        versions[0].sha256,
        createHash("sha256").update(updated).digest("hex"),
      );
      assert.equal(versions[0].note, "Correcciones solicitadas");
      assert.equal((await req(`/documents/${id}/download`, peer)).status, 403);
      assert.deepEqual(
        Buffer.from(
          await (
            await req(`/documents/${id}/versions/${oldVersion}/download`, owner)
          ).arrayBuffer(),
        ),
        original,
      );
      assert.deepEqual(
        Buffer.from(
          await (await req(`/documents/${id}/download`, owner)).arrayBuffer(),
        ),
        updated,
      );
      const invalid = new FormData();
      invalid.set("file", new Blob(["ejecutable"]), "virus.exe");
      assert.equal(
        (await req(`/documents/${id}/versions`, owner, "POST", invalid)).status,
        400,
      );
      assert.equal(
        (await (await req(`/documents/${id}/versions`, owner)).json()).length,
        2,
      );
    },
  );
  await t.test(
    "Papelera, versiones bloqueadas y restauración con revisión pendiente",
    async () => {
      assert.equal(
        (await req("/documents/" + id, owner, "DELETE")).status,
        200,
      );
      assert.equal((await (await req("/documents", owner)).json()).length, 0);
      assert.equal((await (await req("/trash", owner)).json()).length, 1);
      assert.equal((await (await req("/trash", outsider)).json()).length, 0);
      assert.equal(
        (await req(`/documents/${id}/versions/${oldVersion}/download`, owner))
          .status,
        404,
      );
      assert.equal(
        (await req(`/documents/${id}/restore`, outsider, "POST")).status,
        403,
      );
      assert.equal(
        (await req(`/documents/${id}/restore`, owner, "POST")).status,
        200,
      );
      const rows = await (await req("/documents", owner)).json();
      assert.equal(rows[0].status, "pendiente");
      assert.equal(rows[0].version, 2);
      assert.equal((await req(`/documents/${id}/download`, peer)).status, 403);
    },
  );
  await t.test(
    "Respaldo íntegro incluye todas las versiones y excluye sesiones/credenciales",
    async () => {
      assert.equal((await req("/backups", owner)).status, 403);
      assert.equal((await req("/backups", reviewer, "POST")).status, 403);
      const r = await req("/backups", admin, "POST");
      assert.equal(r.status, 201);
      backup = await r.json();
      const content = Buffer.from(
        await (await req("/backups/" + backup.name, admin)).arrayBuffer(),
      );
      const zip = new AdmZip(content);
      assert.equal(
        zip.getEntries().filter((e) => e.entryName.startsWith("files/")).length,
        2,
      );
      assert.equal(zip.getEntry("acceso-inicial.txt"), null);
      const manifest = JSON.parse(zip.readAsText("manifest.json"));
      assert.equal(manifest.format, "ceicom-backup");
      const snap = path.join(dir, "test-snapshot.sqlite");
      fs.writeFileSync(snap, zip.readFile("ceicom.sqlite"));
      const db = new DatabaseSync(snap);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions").get().n, 0);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM versions").get().n, 2);
      db.close();
      fs.rmSync(snap);
    },
  );
  await t.test(
    "Restauración exige servidor detenido y rechaza ZIP alterado",
    async () => {
      const restore = (archive) =>
        spawnSync(process.execPath, ["scripts/restore.js", archive], {
          cwd,
          env: { ...process.env, DATA_DIR: dir },
          encoding: "utf8",
        });
      const archive = path.join(dir, "backups", backup.name);
      const blocked = restore(archive);
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, /en uso/);
      await service.stop();
      const corrupt = new AdmZip(archive);
      const entry = corrupt
        .getEntries()
        .find((e) => e.entryName.startsWith("files/"));
      corrupt.updateFile(entry.entryName, Buffer.from("alterado"));
      const bad = path.join(dir, "alterado.zip");
      corrupt.writeZip(bad);
      const result = restore(bad);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /inválido|integridad/);
      const malicious = new AdmZip();
      malicious.addFile("unexpected.txt", Buffer.from("x"));
      const maliciousPath = path.join(dir, "no-permitido.zip");
      malicious.writeZip(maliciousPath);
      assert.equal(restore(maliciousPath).status, 1);
      assert.equal(restore(archive).status, 0);
      await service.start();
      assert.equal((await req("/me", owner)).status, 401);
      const fresh = await login("autor@ceicom.edu.bo");
      const rows = await (await req("/documents", fresh)).json();
      assert.equal(rows[0].version, 2);
      assert.deepEqual(
        Buffer.from(
          await (
            await req(`/documents/${id}/versions/${newVersion}/download`, fresh)
          ).arrayBuffer(),
        ),
        updated,
      );
      assert.deepEqual(
        Buffer.from(
          await (
            await req(`/documents/${id}/versions/${oldVersion}/download`, fresh)
          ).arrayBuffer(),
        ),
        original,
      );
    },
  );
  await t.test(
    "Respaldo automático al reiniciar y retención de siete copias",
    async () => {
      const freshAdmin = await login();
      for (let i = 0; i < 9; i++)
        assert.equal((await req("/backups", freshAdmin, "POST")).status, 201);
      await service.stop();
      const folder = path.join(dir, "backups");
      const old = new Date(Date.now() - 25 * 3600000);
      for (const name of fs
        .readdirSync(folder)
        .filter((n) => n.endsWith(".zip")))
        fs.utimesSync(path.join(folder, name), old, old);
      await service.start();
      const cookie = await login();
      const b = await (await req("/backups", cookie)).json();
      assert.equal(b.items.length, 7);
      assert.ok(Date.now() - new Date(b.items[0].created_at).getTime() < 60000);
    },
  );
});

test("Migración desde v1 preserva cuentas, documentos, fechas y retiro", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ceicom-migrate-"));
  fs.mkdirSync(path.join(dir, "files"));
  const storage = "a".repeat(48);
  const bytes = Buffer.from("%PDF-1.4\nLegado\n%%EOF");
  fs.writeFileSync(path.join(dir, "files", storage), bytes);
  const db = new DatabaseSync(path.join(dir, "ceicom.sqlite"));
  const salt = "legacy-test";
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT UNIQUE,password TEXT,role TEXT,active INTEGER DEFAULT 1);
 CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT,description TEXT);
 CREATE TABLE documents(id INTEGER PRIMARY KEY,title TEXT,description TEXT,category_id INTEGER REFERENCES categories(id),owner_id INTEGER REFERENCES users(id),visibility TEXT,filename TEXT,storage TEXT,size INTEGER,created_at TEXT,updated_at TEXT,removed INTEGER DEFAULT 0);
 CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
 CREATE TABLE activity(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),action TEXT,detail TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO categories VALUES(1,'Legado','Categoría anterior');`);
  db.prepare("INSERT INTO users VALUES(1,?,?,?,?,1)").run(
    "Admin legado",
    "admin@ceicom.edu.bo",
    salt + ":" + scryptSync(password, salt, 64).toString("hex"),
    "administrador",
  );
  db.prepare(
    "INSERT INTO documents VALUES(1,'Documento anterior','Descripción',1,1,'privado','legado.pdf',?,?,'2025-02-01 10:00:00','2025-02-01 10:00:00',1)",
  ).run(storage, bytes.length);
  db.close();
  const service = server(dir, 3201);
  t.after(async () => {
    await service.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await service.start();
  await service.stop();
  const upgraded = new DatabaseSync(path.join(dir, "ceicom.sqlite"));
  const d = upgraded.prepare("SELECT * FROM documents WHERE id=1").get();
  assert.equal(d.title, "Documento anterior");
  assert.equal(d.created_at, "2025-02-01 10:00:00");
  assert.equal(d.removed, 1);
  assert.equal(d.status, "aprobado");
  assert.equal(d.area_id, 1);
  const v = upgraded.prepare("SELECT * FROM versions").get();
  assert.equal(v.number, 1);
  assert.equal(v.created_at, d.created_at);
  assert.equal(v.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(upgraded.prepare("PRAGMA foreign_key_check").all().length, 0);
  upgraded.close();
  assert.deepEqual(fs.readFileSync(path.join(dir, "files", storage)), bytes);
  assert.ok(
    fs.readdirSync(path.join(dir, "backups")).some((n) => n.endsWith(".zip")),
  );
  await service.start();
  await service.stop();
  const reopened = new DatabaseSync(path.join(dir, "ceicom.sqlite"));
  assert.equal(reopened.prepare("SELECT COUNT(*) n FROM versions").get().n, 1);
  reopened.close();
});
