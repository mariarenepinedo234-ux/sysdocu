import fs from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import AdmZip from "adm-zip";

export const digest = (data) => createHash("sha256").update(data).digest("hex");
export function acquireLock(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, "server.lock");
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0)
      throw Error(
        "Bloqueo inválido: revise server.lock con el servidor detenido.",
      );
    try {
      process.kill(pid, 0);
      throw Error(
        "La carpeta de datos está en uso. Detenga el servidor primero.",
      );
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
    fs.unlinkSync(lock);
  }
  fs.writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
  return () => {
    if (
      fs.existsSync(lock) &&
      fs.readFileSync(lock, "utf8") === String(process.pid)
    )
      fs.unlinkSync(lock);
  };
}
export function listBackups(dir) {
  const folder = path.join(dir, "backups");
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((n) => /^ceicom-[\w-]+\.zip$/.test(n))
    .sort()
    .reverse()
    .map((name) => {
      const s = fs.statSync(path.join(folder, name));
      return { name, size: s.size, created_at: s.mtime.toISOString() };
    });
}
// Synchronous snapshot + file collection: no upload can interleave on this process.
export function createBackup(db, dir) {
  const folder = path.join(dir, "backups");
  fs.mkdirSync(folder, { recursive: true });
  const id =
    new Date().toISOString().replace(/[:.]/g, "-") +
    "-" +
    randomBytes(3).toString("hex");
  const snapshot = path.join(folder, `snapshot-${id}.sqlite`);
  const name = `ceicom-${id}.zip`;
  const target = path.join(folder, name);
  try {
    db.prepare("VACUUM INTO ?").run(snapshot);
    const copy = new DatabaseSync(snapshot);
    try {
      if (
        copy
          .prepare("SELECT name FROM sqlite_master WHERE name='sessions'")
          .get()
      )
        copy.exec("DELETE FROM sessions;");
    } finally {
      copy.close();
    }
    const zip = new AdmZip();
    const manifest = {
      format: "ceicom-backup",
      version: 1,
      created_at: new Date().toISOString(),
      files: {},
    };
    const add = (name, file) => {
      const b = fs.readFileSync(file);
      manifest.files[name] = { size: b.length, sha256: digest(b) };
      zip.addFile(name, b);
    };
    add("ceicom.sqlite", snapshot);
    for (const file of fs.readdirSync(path.join(dir, "files"))) {
      if (!/^[a-f0-9]{48}$/.test(file))
        throw Error("Nombre de archivo de almacenamiento no reconocido");
      add("files/" + file, path.join(dir, "files", file));
    }
    const references = db.prepare("SELECT storage FROM documents").all();
    if (
      db.prepare("SELECT name FROM sqlite_master WHERE name='versions'").get()
    )
      references.push(...db.prepare("SELECT storage FROM versions").all());
    for (const row of references)
      if (!manifest.files["files/" + row.storage])
        throw Error(
          "Un archivo referenciado no existe; no se creó el respaldo.",
        );
    zip.addFile(
      "manifest.json",
      Buffer.from(JSON.stringify(manifest, null, 2)),
    );
    fs.writeFileSync(target + ".tmp", zip.toBuffer(), {
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(target + ".tmp", target);
    return listBackups(dir).find((b) => b.name === name);
  } finally {
    fs.rmSync(snapshot, { force: true });
    fs.rmSync(target + ".tmp", { force: true });
  }
}

export function restoreBackup(archive, dir) {
  const release = acquireLock(dir);
  const stage = fs.mkdtempSync(
    path.join(path.dirname(dir), ".ceicom-restore-"),
  );
  let safety;
  try {
    const zip = new AdmZip(archive);
    const entries = zip.getEntries();
    const names = entries.map((e) => e.entryName);
    if (
      new Set(names).size !== names.length ||
      entries.length > 100000 ||
      entries.reduce((s, e) => s + e.header.size, 0) > 1024 ** 3
    )
      throw Error(
        "Respaldo duplicado o demasiado grande (máximo 1 GB descomprimido).",
      );
    if (
      entries.some(
        (e) =>
          !/^(manifest\.json|ceicom\.sqlite|files\/[a-f0-9]{48})$/.test(
            e.entryName,
          ),
      )
    )
      throw Error("El respaldo contiene rutas no permitidas.");
    const metaEntry = zip.getEntry("manifest.json");
    if (!metaEntry || metaEntry.header.size > 20 * 1024 * 1024)
      throw Error("Manifiesto inválido.");
    const meta = JSON.parse(metaEntry.getData().toString());
    if (
      meta.format !== "ceicom-backup" ||
      meta.version !== 1 ||
      !meta.files?.["ceicom.sqlite"]
    )
      throw Error("Formato de respaldo no compatible.");
    if (Object.keys(meta.files).length !== entries.length - 1)
      throw Error("Inventario de respaldo incompleto.");
    fs.mkdirSync(path.join(stage, "files"));
    for (const e of entries.filter((e) => e.entryName !== "manifest.json")) {
      const expected = meta.files[e.entryName];
      if (!expected || expected.size !== e.header.size)
        throw Error("Tamaño inválido en respaldo.");
      const b = e.getData();
      if (digest(b) !== expected.sha256)
        throw Error("La integridad del respaldo no es válida.");
      fs.writeFileSync(path.join(stage, e.entryName), b, {
        flag: "wx",
        mode: 0o600,
      });
    }
    const candidate = new DatabaseSync(path.join(stage, "ceicom.sqlite"));
    try {
      if (
        candidate.prepare("PRAGMA integrity_check").get().integrity_check !==
          "ok" ||
        candidate.prepare("PRAGMA foreign_key_check").all().length
      )
        throw Error("Base de datos inconsistente.");
      for (const name of [
        "users",
        "categories",
        "documents",
        "sessions",
        "activity",
      ])
        if (
          !candidate
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            )
            .get(name)
        )
          throw Error("Faltan tablas requeridas.");
      const refs = candidate.prepare("SELECT storage FROM documents").all();
      if (
        candidate
          .prepare("SELECT name FROM sqlite_master WHERE name='versions'")
          .get()
      )
        refs.push(...candidate.prepare("SELECT storage FROM versions").all());
      for (const row of refs)
        if (
          !/^[a-f0-9]{48}$/.test(row.storage) ||
          !fs.existsSync(path.join(stage, "files", row.storage))
        )
          throw Error("El respaldo no contiene todos los documentos.");
      candidate.exec("DELETE FROM sessions;");
    } finally {
      candidate.close();
    }
    // Preserve current state before replacing anything. Backups remain outside the replacement.
    if (fs.existsSync(path.join(dir, "ceicom.sqlite"))) {
      const current = new DatabaseSync(path.join(dir, "ceicom.sqlite"));
      try {
        safety = createBackup(current, dir);
      } finally {
        current.close();
      }
    }
    const old = path.join(stage, "previous");
    fs.mkdirSync(old);
    const moved = [],
      installed = [];
    try {
      for (const file of [
        "ceicom.sqlite",
        "ceicom.sqlite-wal",
        "ceicom.sqlite-shm",
        "files",
      ])
        if (fs.existsSync(path.join(dir, file))) {
          fs.renameSync(path.join(dir, file), path.join(old, file));
          moved.push(file);
        }
      for (const file of ["ceicom.sqlite", "files"]) {
        fs.renameSync(path.join(stage, file), path.join(dir, file));
        installed.push(file);
      }
    } catch (e) {
      for (const file of installed)
        fs.rmSync(path.join(dir, file), { recursive: true, force: true });
      for (const file of moved)
        fs.renameSync(path.join(old, file), path.join(dir, file));
      throw e;
    }
    return safety;
  } finally {
    release();
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
