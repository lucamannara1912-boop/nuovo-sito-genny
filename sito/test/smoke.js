'use strict';
// Test end-to-end "a caldo": avvia il server vero su una porta libera,
// usa un database temporaneo e la mailer in modalità "test" (non invia email vere,
// le mette in una casella interna che leggiamo per estrarre il link di verifica).

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = process.env.DATA_DIR || require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sito-test-'));
process.env.JWT_SECRET = 'chiave-di-test-non-usare-in-produzione';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const app = require('../server');
const db = require('../db');
const { outbox } = require('../mailer');

let server, base;

function url(p) { return `${base}${p}`; }

async function api(metodo, percorso, { body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (form) {
    payload = form; // FormData: fetch imposta da solo il Content-Type con boundary
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url(percorso), { method: metodo, headers, body: payload });
  let dati = null;
  try { dati = await res.json(); } catch { /* risposta non JSON (es. pagina HTML di verifica) */ }
  return { status: res.status, dati, res };
}

test('avvio server di test', async () => {
  await db.pronto; // aspetta che le tabelle siano pronte (asincrono con Turso)
  await new Promise((resolve) => {
    server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
  });
});

const utenteNormale = { nome: 'Mario', cognome: 'Rossi', email: `mario.${Date.now()}@example.com`, password: 'PasswordSicura123' };
const utenteEditor = { nome: 'Luca', cognome: 'Mannara', email: 'lucamannara53@gmail.com', password: 'AltraPasswordSicura456' };
let tokenNormale, tokenEditor, idRicetta, idMessaggio;

test('healthcheck', async () => {
  const { status, dati } = await api('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(dati.status, 'attivo');
});

test('la cartella pubblica serve le pagine ma non i file sensibili', async () => {
  const home = await fetch(url('/home.html'));
  assert.equal(home.status, 200);
  const root = await fetch(url('/'));
  assert.equal(root.status, 200);

  const envFile = await fetch(url('/.env'));
  assert.equal(envFile.status, 404);
  const dbFile = await fetch(url('/database.sqlite'));
  assert.equal(dbFile.status, 404);
  const serverSrc = await fetch(url('/server.js'));
  assert.equal(serverSrc.status, 404);
});

test('registrazione utente normale + verifica email + login', async () => {
  const reg = await api('POST', '/api/auth/registrati', { body: utenteNormale });
  assert.equal(reg.status, 201, JSON.stringify(reg.dati));

  const loginPrimaVerifica = await api('POST', '/api/auth/login', { body: { email: utenteNormale.email, password: utenteNormale.password } });
  assert.equal(loginPrimaVerifica.status, 403); // deve rifiutare finché non verifica l'email

  const mail = outbox.find(m => m.to === utenteNormale.email);
  assert.ok(mail, 'email di verifica non trovata nella outbox di test');
  const link = mail.text.match(/https?:\/\/\S+/)[0];
  const percorsoVerifica = link.replace(base, '');

  const verifica = await fetch(url(percorsoVerifica));
  assert.equal(verifica.status, 200);

  const login = await api('POST', '/api/auth/login', { body: { email: utenteNormale.email, password: utenteNormale.password } });
  assert.equal(login.status, 200, JSON.stringify(login.dati));
  assert.equal(login.dati.ruolo, 'visitatore');
  tokenNormale = login.dati.token;
});

test('registrazione ed accesso di un editor (email in whitelist)', async () => {
  await api('POST', '/api/auth/registrati', { body: utenteEditor });
  const mail = outbox.find(m => m.to === utenteEditor.email);
  const link = mail.text.match(/https?:\/\/\S+/)[0].replace(base, '');
  await fetch(url(link));

  const login = await api('POST', '/api/auth/login', { body: { email: utenteEditor.email, password: utenteEditor.password } });
  assert.equal(login.status, 200);
  assert.equal(login.dati.ruolo, 'editor');
  tokenEditor = login.dati.token;
});

test('password sbagliata ed email inesistente vengono rifiutate allo stesso modo', async () => {
  const a = await api('POST', '/api/auth/login', { body: { email: utenteNormale.email, password: 'sbagliata' } });
  const b = await api('POST', '/api/auth/login', { body: { email: 'nonesiste@example.com', password: 'qualsiasi' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.dati.errore, b.dati.errore);
});

test('box messaggi: un visitatore scrive, l\'editor risponde, la conversazione cresce', async () => {
  const senzaToken = await api('POST', '/api/messaggi', { body: { domanda: 'Ciao' } });
  assert.equal(senzaToken.status, 401);

  const invio = await api('POST', '/api/messaggi', { body: { domanda: 'Quante proteine servono al giorno?' }, token: tokenNormale });
  assert.equal(invio.status, 201);

  const listaEditor = await api('GET', '/api/messaggi', { token: tokenEditor });
  assert.equal(listaEditor.status, 200);
  assert.ok(listaEditor.dati.length >= 1);
  const msg = listaEditor.dati.find(m => m.user_email === utenteNormale.email);
  assert.ok(msg);
  idMessaggio = msg.id;

  const listaAltroUtente = await api('GET', '/api/messaggi', { token: tokenNormale });
  assert.ok(listaAltroUtente.dati.every(m => m.user_email === utenteNormale.email), 'un visitatore non deve vedere i messaggi altrui');

  const risposta = await api('PATCH', `/api/messaggi/${idMessaggio}/rispondi`, { body: { risposta: 'Dipende dal tuo peso e obiettivo.' }, token: tokenEditor });
  assert.equal(risposta.status, 200);

  const dopo = await api('GET', '/api/messaggi', { token: tokenEditor });
  const msgAggiornato = dopo.dati.find(m => m.id === idMessaggio);
  assert.equal(msgAggiornato.stato, 'risposto');
  assert.equal(msgAggiornato.conversazione.length, 1);

  const replicaVisitatore = await api('PATCH', `/api/messaggi/${idMessaggio}/rispondi`, { body: { risposta: 'Grazie mille!' }, token: tokenNormale });
  assert.equal(replicaVisitatore.status, 200);
});

test('un visitatore non può cancellare i messaggi di un altro', async () => {
  const reg2 = { nome: 'Anna', cognome: 'Bianchi', email: `anna.${Date.now()}@example.com`, password: 'PasswordSicura789' };
  await api('POST', '/api/auth/registrati', { body: reg2 });
  const mail = outbox.find(m => m.to === reg2.email);
  await fetch(url(mail.text.match(/https?:\/\/\S+/)[0].replace(base, '')));
  const login2 = await api('POST', '/api/auth/login', { body: { email: reg2.email, password: reg2.password } });
  const token2 = login2.dati.token;

  const tentativo = await api('DELETE', `/api/messaggi/${idMessaggio}`, { token: token2 });
  assert.equal(tentativo.status, 403);
});

test('ricette: solo l\'editor può aggiungere, fissare, eliminare', async () => {
  const senzaPermesso = await api('POST', '/api/ricette', { token: tokenNormale, form: (() => {
    const f = new FormData();
    f.append('titolo', 'Prova non autorizzata');
    f.append('ingredienti', 'x');
    f.append('procedimento', 'y');
    return f;
  })() });
  assert.equal(senzaPermesso.status, 403);

  const form = new FormData();
  form.append('titolo', 'Bowl di quinoa e avocado');
  form.append('ingredienti', 'Quinoa, avocado, pomodorini, limone, olio EVO');
  form.append('procedimento', 'Cuoci la quinoa, taglia le verdure, unisci tutto e condisci.');
  form.append('calorie', '420');
  form.append('proteine', '14');
  form.append('carboidrati', '55');
  form.append('grassi', '16');
  form.append('categorie', 'pranzo');
  form.append('categorie', 'cena');
  // Un piccolo PNG reale (1x1 pixel), per verificare che la foto venga
  // davvero salvata (come base64, dentro il database) e restituita.
  const pngMinuscolo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  form.append('foto', new Blob([pngMinuscolo], { type: 'image/png' }), 'test.png');

  const creazione = await api('POST', '/api/ricette', { token: tokenEditor, form });
  assert.equal(creazione.status, 201, JSON.stringify(creazione.dati));
  idRicetta = creazione.dati.id;

  const elenco = await api('GET', '/api/ricette');
  assert.equal(elenco.status, 200);
  const trovata = elenco.dati.find(r => r.id === idRicetta);
  assert.ok(trovata);
  assert.equal(trovata.categoria, 'pranzo,cena');
  assert.equal(trovata.fissata, false);
  assert.ok(trovata.foto && trovata.foto.startsWith('data:image/png;base64,'), 'la foto deve essere salvata come data URL base64 dentro il database');

  const fissa = await api('PATCH', `/api/ricette/${idRicetta}/fissa`, { token: tokenEditor });
  assert.equal(fissa.status, 200);
  assert.equal(fissa.dati.fissata, true);

  const eliminaSenzaPermesso = await api('DELETE', `/api/ricette/${idRicetta}`, { token: tokenNormale });
  assert.equal(eliminaSenzaPermesso.status, 403);

  const elimina = await api('DELETE', `/api/ricette/${idRicetta}`, { token: tokenEditor });
  assert.equal(elimina.status, 200);

  const elencoDopo = await api('GET', '/api/ricette');
  assert.ok(!elencoDopo.dati.some(r => r.id === idRicetta));
});

test('consiglio del giorno: pubblico in lettura, riservato in scrittura', async () => {
  const lettura = await api('GET', '/api/ricette/consiglio');
  assert.equal(lettura.status, 200);
  assert.ok(typeof lettura.dati.testo === 'string');

  const scritturaVietata = await api('PUT', '/api/ricette/consiglio', { body: { testo: 'x' }, token: tokenNormale });
  assert.equal(scritturaVietata.status, 403);

  const scrittura = await api('PUT', '/api/ricette/consiglio', { body: { testo: 'Mangia più verdure di stagione!' }, token: tokenEditor });
  assert.equal(scrittura.status, 200);

  const rilettura = await api('GET', '/api/ricette/consiglio');
  assert.equal(rilettura.dati.testo, 'Mangia più verdure di stagione!');
});

test('token non valido viene rifiutato', async () => {
  const r = await api('GET', '/api/messaggi', { token: 'token-falso-non-valido' });
  assert.equal(r.status, 401);
});

test('chiusura server', async () => {
  await new Promise((resolve) => server.close(resolve));
});
