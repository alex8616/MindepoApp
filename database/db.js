import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('asistencia.db');

export const initDB = async () => {
    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      email TEXT,
      fecha TEXT,
      hora TEXT,
      tipo TEXT,
      lat TEXT,
      lng TEXT,
      observacion TEXT,
      estado_sync TEXT
    );
  `);
};

export default db;
