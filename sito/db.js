// db.js — livello dati unico per tutta l'app.
//
// Espone sempre la stessa interfaccia asincrona:
//   await db.prepare(sql).get(...parametri)
//   await db.prepare(sql).all(...parametri)
//   await db.prepare(sql).run(...parametri)
//   await db.exec(sqlConPiùIstruzioni)
// così le route non devono sapere se sotto c'è Turso o SQLite locale.
//
// - Se TURSO_DATABASE_URL e TURSO_AUTH_TOKEN sono impostati (vedi TURSO.md):
//   i dati vivono su Turso, un database esterno gratuito e permanente.
//   Necessario per hosting con disco non permanente (es. Render).
// - Altrimenti: un file SQLite locale (./database.sqlite), comodo per
//   sviluppo e per i test automatici, ma NON permanente su molti hosting.
//
// server.js aspetta `db.pronto` prima di iniziare ad accettare richieste,
// perché la creazione delle tabelle è ora un'operazione asincrona.

const { USA_TURSO, DATA_DIR } = require('./config');

let motore;

if (USA_TURSO) {
  motore = creaMotoreTurso();
} else {
  motore = creaMotoreLocale();
}

function creaMotoreTurso() {
  const { createClient } = require('@libsql/client/web');
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  return {
    tipo: 'turso',
    async exec(sql) {
      await client.executeMultiple(sql);
    },
    prepare(sql) {
      return {
        async get(...parametri) {
          const risultato = await client.execute({ sql, args: parametri });
          return risultato.rows[0];
        },
        async all(...parametri) {
          const risultato = await client.execute({ sql, args: parametri });
          return risultato.rows;
        },
        async run(...parametri) {
          const risultato = await client.execute({ sql, args: parametri });
          return {
            changes: Number(risultato.rowsAffected || 0),
            lastInsertRowid: risultato.lastInsertRowid
          };
        }
      };
    }
  };
}

function creaMotoreLocale() {
  const fs = require('fs');
  const path = require('path');
  const { DatabaseSync } = require('node:sqlite');

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const raw = new DatabaseSync(path.join(DATA_DIR, 'database.sqlite'));
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');

  return {
    tipo: 'locale',
    async exec(sql) {
      raw.exec(sql);
    },
    prepare(sql) {
      const istruzione = raw.prepare(sql);
      return {
        async get(...parametri) { return istruzione.get(...parametri); },
        async all(...parametri) { return istruzione.all(...parametri); },
        async run(...parametri) { return istruzione.run(...parametri); }
      };
    }
  };
}

async function haColonna(tabella, colonna) {
  const colonne = await motore.prepare(`PRAGMA table_info(${tabella})`).all();
  return colonne.some(c => c.name === colonna);
}
async function aggiungiColonna(tabella, colonna, definizione) {
  if (await haColonna(tabella, colonna)) return false;
  await motore.exec(`ALTER TABLE ${tabella} ADD COLUMN ${colonna} ${definizione}`);
  return true;
}

async function inizializza() {
  await motore.exec(`
    CREATE TABLE IF NOT EXISTS utenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      ruolo TEXT NOT NULL DEFAULT 'visitatore',
      creato_il TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messaggi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      domanda TEXT NOT NULL,
      risposta TEXT,
      stato TEXT DEFAULT 'in_attesa',
      nascostoPerDottoressa INTEGER DEFAULT 0,
      conversazione TEXT DEFAULT '[]',
      creato_il TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ricette (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titolo TEXT NOT NULL,
      foto TEXT,
      ingredienti TEXT NOT NULL,
      procedimento TEXT NOT NULL,
      calorie INTEGER,
      proteine REAL,
      carboidrati REAL,
      grassi REAL,
      categoria TEXT,
      data_creazione DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS impostazioni (
      chiave TEXT PRIMARY KEY,
      valore TEXT NOT NULL
    );
  `);

  // Migrazioni (sicure anche su database già esistenti)
  await aggiungiColonna('messaggi', 'nascostoPerDottoressa', 'INTEGER DEFAULT 0');
  await aggiungiColonna('messaggi', 'conversazione', "TEXT DEFAULT '[]'");
  await aggiungiColonna('ricette', 'fissata', 'INTEGER DEFAULT 0');
  await aggiungiColonna('utenti', 'nome', 'TEXT');
  await aggiungiColonna('utenti', 'cognome', 'TEXT');
  await aggiungiColonna('utenti', 'token_verifica', 'TEXT');
  await aggiungiColonna('utenti', 'token_scadenza', 'INTEGER');
  const primaVoltaVerificato = await aggiungiColonna('utenti', 'verificato', 'INTEGER DEFAULT 0');
  if (primaVoltaVerificato) {
    // Gli utenti già presenti prima dell'introduzione della verifica email restano abilitati
    await motore.exec('UPDATE utenti SET verificato = 1');
  }
}

module.exports = {
  tipo: motore.tipo,
  prepare: (sql) => motore.prepare(sql),
  exec: (sql) => motore.exec(sql),
  pronto: inizializza()
};
