import path from "node:path";
import { fileURLToPath } from "node:url";
import { restoreBackup } from "../lib/storage.js";
const archive = process.argv[2];
if (!archive) {
  console.error(
    'Uso: npm run restore -- "ruta/al/respaldo.zip" (con el servidor detenido)',
  );
  process.exit(1);
}
try {
  const safety = restoreBackup(
    path.resolve(archive),
    path.resolve(
      process.env.DATA_DIR ||
        fileURLToPath(new URL("../data", import.meta.url)),
    ),
  );
  console.log(
    "Restauración verificada. Inicie el servidor e ingrese de nuevo.",
  );
  if (safety) console.log("Respaldo preventivo: " + safety.name);
} catch (e) {
  console.error("No se restauró: " + e.message);
  process.exitCode = 1;
}
