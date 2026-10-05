const path = require('path');
const crypto = require('crypto');

const PRODUCTION = process.env.NODE_ENV === 'production';

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'la_tua_chiave_segreta_super_sicura') {
  if (PRODUCTION) {
    throw new Error('JWT_SECRET mancante: impostalo nel file .env (vedi .env.example).');
  }
  // In sviluppo/test: chiave casuale (i login si azzerano a ogni riavvio, va bene)
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

// Usata solo quando Turso NON è configurato: un database SQLite locale,
// utile per sviluppo/test sul proprio computer. Su un hosting come Render,
// senza Turso configurato, questa cartella verrebbe azzerata ai riavvii:
// per questo in produzione è fortemente consigliato configurare Turso
// (vedi TURSO.md), che rende i dati permanenti indipendentemente dall'hosting.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..'));

const USA_TURSO = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
if (PRODUCTION && !USA_TURSO) {
  console.warn(
    '⚠️  ATTENZIONE: Turso non è configurato (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN mancanti). ' +
    'Il sito funzionerà, ma su molti hosting gratuiti (es. Render) i dati verranno persi ai riavvii. ' +
    'Vedi TURSO.md per configurarlo in pochi minuti.'
  );
}

module.exports = { PRODUCTION, JWT_SECRET, DATA_DIR, USA_TURSO };
