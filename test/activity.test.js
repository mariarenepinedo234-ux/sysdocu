import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import AdmZip from "adm-zip";
const cwd = path.resolve(import.meta.dirname, "..");

test("Historial: fechas inclusivas, reportes completos y permisos", async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ceicom-history-"));
  const base = "http://127.0.0.1:3205/api";
  let child;
  async function start() {
    child = spawn(process.execPath, ["server.js"], {
      cwd,
      env: {
        ...process.env,
        DATA_DIR: dir,
        PORT: "3205",
        ADMIN_PASSWORD: "HistorialPrueba123!",
      },
      stdio: "pipe",
    });
    let log = "";
    child.stderr.on("data", (d) => (log += d));
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw Error(log);
      try {
        if ((await fetch("http://127.0.0.1:3205")).ok) return;
      } catch {}
      await delay(75);
    }
    throw Error(log || "Servidor no disponible");
  }
  async function stop() {
    if (child && child.exitCode === null)
      await new Promise((r) => {
        child.once("exit", r);
        child.kill();
      });
  }
  t.after(async () => {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  });
  const req = (route, cookie, method = "GET", body) =>
    fetch(base + route, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  async function login(email = "admin@ceicom.edu.bo") {
    const r = await req("/login", null, "POST", {
      email,
      password: "HistorialPrueba123!",
    });
    assert.equal(r.status, 200);
    return r.headers.get("set-cookie").split(";")[0];
  }
  await start();
  const admin = await login();
  const accounts = {};
  for (const [name, role] of [
    ["Personal A", "administrativo"],
    ["Personal B", "administrativo"],
    ["Docente", "docente"],
  ]) {
    const email = name.replaceAll(" ", "").toLowerCase() + "@ceicom.edu.bo";
    const r = await req("/users", admin, "POST", {
      name,
      email,
      role,
      password: "HistorialPrueba123!",
    });
    assert.equal(r.status, 201);
    accounts[
      role === "docente" ? "teacher" : name.endsWith("A") ? "staff" : "other"
    ] = { id: (await r.json()).id, cookie: await login(email) };
  }
  await stop();
  const fixtures = [
    {
      user_id: accounts.staff.id,
      action: "Primera operación",
      detail: "Inicio incluido",
      created_at: "2025-02-01 00:00:00",
    },
    {
      user_id: accounts.staff.id,
      action: "Última operación",
      detail: "Fin incluido",
      created_at: "2025-02-28 23:59:59",
    },
    {
      user_id: accounts.staff.id,
      action: "Fuera del período",
      detail: "Marzo",
      created_at: "2025-03-01 00:00:00",
    },
    {
      user_id: accounts.other.id,
      action: "Operación privada B",
      detail: "SOLO-B-EXCLUSIVO",
      created_at: "2025-02-10 14:00:00",
    },
    {
      user_id: accounts.staff.id,
      action: "Caracteres especiales",
      detail: '=SUM(1,2) <script>alert("x")</script>',
      created_at: "2025-02-14 13:00:00",
    },
    {
      user_id: accounts.staff.id,
      action: "Bisiesto",
      detail: "Febrero 29 válido",
      created_at: "2024-02-29 12:00:00",
    },
  ];
  for (let i = 0; i < 205; i++)
    fixtures.push({
      user_id: 1,
      action: "Registro administrativo",
      detail: "OPERACIÓN-" + i,
      created_at: "2025-02-12 12:00:00",
    });
  const db = new DatabaseSync(path.join(dir, "ceicom.sqlite"));
  const insert = db.prepare(
    "INSERT INTO activity(user_id,action,detail,created_at) VALUES(?,?,?,?)",
  );
  for (const f of fixtures)
    insert.run(f.user_id, f.action, f.detail, f.created_at);
  db.close();
  await start();
  const range = "from=2025-02-01&to=2025-02-28";
  await t.test(
    "Filtrado inclusivo, rango de un día y conteo sin límite",
    async () => {
      const rows = await (await req("/activity?" + range, admin)).json();
      assert.equal(rows.length, 200);
      assert.equal(rows[0].created_at, "2025-02-28 23:59:59");
      const count = await (await req("/activity/count?" + range, admin)).json();
      assert.equal(count.total, 209);
      const first = await (
        await req("/activity?from=2025-02-01&to=2025-02-01", admin)
      ).json();
      assert.equal(first.length, 1);
      assert.equal(first[0].detail, "Inicio incluido");
      const last = await (
        await req("/activity?from=2025-02-28&to=2025-02-28", admin)
      ).json();
      assert.equal(last.length, 1);
      assert.equal(last[0].detail, "Fin incluido");
      assert.equal(
        (
          await (
            await req("/activity?from=2024-02-29&to=2024-02-29", admin)
          ).json()
        ).length,
        1,
      );
      assert.equal(
        (
          await (
            await req("/activity/count?from=2027-01-01&to=2027-01-31", admin)
          ).json()
        ).total,
        0,
      );
    },
  );
  await t.test(
    "Fechas inválidas, duplicadas y rangos invertidos se rechazan en todas las rutas",
    async () => {
      for (const route of [
        "/activity",
        "/activity/count",
        "/activity/report.xlsx",
        "/activity/report/print",
      ])
        for (const q of [
          "from=2025-02-29",
          "to=2025-13-01",
          "from=incorrecta",
          "from=2025-03-01&to=2025-02-28",
          "from=2025-02-01&from=2025-02-02",
        ]) {
          const r = await req(route + "?" + q, admin);
          assert.equal(r.status, 400, route + "?" + q);
          assert.ok((await r.json()).error);
        }
    },
  );
  await t.test(
    "Personal administrativo solo ve y exporta su actividad; docentes sin acceso",
    async () => {
      const rows = await (
        await req("/activity?" + range, accounts.staff.cookie)
      ).json();
      assert.equal(rows.length, 3);
      assert.ok(rows.every((r) => r.user_id === accounts.staff.id));
      const count = await (
        await req("/activity/count?" + range, accounts.staff.cookie)
      ).json();
      assert.equal(count.total, 3);
      const other = await (
        await req("/activity?" + range, accounts.other.cookie)
      ).json();
      assert.equal(other.length, 1);
      assert.equal(other[0].detail, "SOLO-B-EXCLUSIVO");
      for (const route of [
        "/activity",
        "/activity/count",
        "/activity/report.xlsx",
        "/activity/report/print",
      ]) {
        assert.equal((await req(route + "?" + range)).status, 401);
        assert.equal(
          (await req(route + "?" + range, accounts.teacher.cookie)).status,
          403,
        );
      }
      const r = await req(
        "/activity/report.xlsx?" + range,
        accounts.staff.cookie,
      );
      assert.equal(r.status, 200);
      const sheet = new AdmZip(Buffer.from(await r.arrayBuffer())).readAsText(
        "xl/worksheets/sheet1.xml",
      );
      assert.ok(!sheet.includes("SOLO-B-EXCLUSIVO"));
      assert.ok(!sheet.includes("OPERACIÓN-"));
      assert.ok(sheet.includes("SUM(1,2)"));
      assert.ok(!sheet.includes("<f>"));
      assert.match(sheet, /&lt;script&gt;/);
      const html = await (
        await req("/activity/report/print?" + range, accounts.staff.cookie)
      ).text();
      assert.ok(!html.includes("SOLO-B-EXCLUSIVO"));
      assert.ok(!html.includes("OPERACIÓN-"));
      assert.match(html, /&lt;script&gt;/);
      assert.ok(!html.includes("<script>alert"));
    },
  );
  await t.test(
    "Reportes exportan todo el rango, incluyen fechas y quedan auditados",
    async () => {
      const r = await req("/activity/report.xlsx?" + range, admin);
      assert.equal(r.status, 200);
      assert.match(
        r.headers.get("content-disposition"),
        /historial-ceicom.xlsx/,
      );
      const zip = new AdmZip(Buffer.from(await r.arrayBuffer()));
      const sheet = zip.readAsText("xl/worksheets/sheet1.xml");
      assert.equal((sheet.match(/<row /g) || []).length, 210);
      assert.match(sheet, /Inicio incluido/);
      assert.match(sheet, /Fin incluido/);
      assert.ok(!sheet.includes("Marzo"));
      const html = await (
        await req("/activity/report/print?" + range, admin)
      ).text();
      assert.match(html, /209 registros/);
      assert.match(html, /2025-02-01/);
      assert.match(html, /2025-02-28/);
      assert.match(html, /ceicom-logo.png/);
      assert.match(html, /Guardar como PDF/);
      assert.match(html, /Inicio incluido/);
      const events = await (
        await req(
          "/activity?from=" + new Date().toISOString().slice(0, 10),
          admin,
        )
      ).json();
      assert.ok(events.some((r) => r.action === "Reporte de historial Excel"));
      assert.ok(
        events.some((r) => r.action === "Reporte de historial imprimible"),
      );
    },
  );
  await t.test(
    "Reporte vacío se genera sin errores y el logo se sirve correctamente",
    async () => {
      const html = await (
        await req("/activity/report/print?from=2027-01-01&to=2027-01-02", admin)
      ).text();
      assert.match(html, /0 registros/);
      assert.match(html, /No hay registros/);
      const image = await fetch("http://127.0.0.1:3205/assets/ceicom-logo.png");
      assert.equal(image.status, 200);
      assert.match(image.headers.get("content-type"), /image\/png/);
      assert.ok((await image.arrayBuffer()).byteLength > 1000);
    },
  );
});
