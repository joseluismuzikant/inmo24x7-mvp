import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

console.log("🚀 Intentando inicializar la base de datos...");

const dataDir = path.join(process.cwd(), 'data');
console.log("📁 Ruta de la carpeta data:", dataDir);

if (!fs.existsSync(dataDir)) {
    console.log("✨ Creando carpeta data...");
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath, { verbose: console.log });

db.pragma('journal_mode = WAL');

const schema = `
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    userId TEXT NOT NULL,
    operacion TEXT,
    zona TEXT,
    presupuestoMax REAL,
    nombre TEXT,
    contacto TEXT,
    summary TEXT
  );
`;

db.exec(schema);
console.log("✅ Base de datos y tabla 'leads' listas.");

export default db;