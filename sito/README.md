# Sito Dott.ssa Genny Ferrara — Biologa Nutrizionista

## Cosa c'è dentro
```
sito/
  server.js            avvio del server
  db.js                database: Turso (permanente) o SQLite locale (sviluppo)
  mailer.js             invio email di verifica (Brevo via HTTPS oppure SMTP)
  config/                configurazione ed elenco editor (dottoressa/operatore)
  middleware/            controllo login (JWT) e limite richieste
  routes/                auth (login/registrazione), ricette, messaggi
  public/                tutto il sito (HTML, CSS, JS del browser)
  test/smoke.js          test automatici end-to-end
  .env.example           copialo in ".env" e compila i valori
  TURSO.md               guida passo-passo per il database permanente gratuito
```

## 1. Installazione in locale
Serve Node.js 22 o superiore (usa `node -v` per controllare).

```bash
cd sito
npm install
cp .env.example .env
```

Apri `.env` e imposta almeno:
- `JWT_SECRET` — generalo con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Le variabili email (vedi punto 3)
- `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (vedi punto 2 e `TURSO.md`) —
  **fortemente consigliate prima di pubblicare il sito**, altrimenti su molti
  hosting gratuiti (Render incluso) i dati si perdono ai riavvii

Poi avvia:
```bash
npm start
```
Il sito è su `http://localhost:3000`. Nel terminale, la riga "Database: ..."
ti dice se stai usando Turso (permanente) o SQLite locale (solo per prova).

## 2. Il database permanente (Turso) — consigliato prima di pubblicare
Il sito può funzionare con un semplice file SQLite locale, comodo per fare
prove sul tuo computer. Ma su un hosting come Render quel file **non
sopravvive ai riavvii**: messaggi, ricette e foto andrebbero persi ogni
tanto. La soluzione è **Turso**: un database esterno, gratis per sempre,
senza carta di credito, dove i dati restano per sempre indipendentemente
da cosa succede all'hosting.

Segui **`TURSO.md`** (dentro questa cartella): è una guida di 10 minuti,
tutta da browser, senza terminale, per creare il database e ottenere i due
codici da mettere nel file `.env`.

## 3. Come testarlo
Il progetto include una suite di test automatici che avvia un server vero,
crea un database temporaneo e verifica: registrazione, verifica email,
login, box messaggi (visitatore + editor), ricette con foto vera
(aggiungi/fissa/elimina), permessi (chi può fare cosa), consiglio del giorno.
Funziona sia con Turso configurato sia in modalità locale, automaticamente.

```bash
npm test
```
Se vedi `# pass 12` e `# fail 0`, tutto funziona.

**Test manuale rapido (in locale):**
1. `npm start`, apri `http://localhost:3000`
2. Registrati con una tua email vera (se hai configurato l'email) oppure, se NODE_ENV
   non è "production" e l'email non è configurata, il link di verifica viene stampato
   nel terminale del server: copialo e incollalo nel browser.
3. Fai login, scrivi una domanda nella pagina "Messaggi".
4. Registrati/accedi con una delle email della dottoressa/operatore (vedi
   `config/editors.js`) per rispondere ai messaggi e gestire le ricette.
5. Prova ad aggiungere una ricetta con una foto: dovrebbe apparire subito
   nella griglia. Se hai configurato Turso, riavvia il server (`Ctrl+C` poi
   `npm start`) e controlla che la ricetta sia ancora lì.

## 4. Email di verifica: come configurarla gratis
Il sito supporta due modalità (bastano le variabili nel file `.env`):

**Opzione consigliata: Brevo (ex Sendinblu)** — gratis fino a 300 email al giorno,
funziona su qualunque hosting (anche quelli che bloccano le porte SMTP):
1. Crea un account gratuito su brevo.com
2. Impostazioni → SMTP & API → crea una "API Key"
3. Nel `.env`:
   ```
   BREVO_API_KEY=la-tua-chiave
   MAIL_FROM_EMAIL=una-tua-email-verificata-su-brevo@esempio.it
   MAIL_FROM_NAME=Dott.ssa Genny Ferrara
   ```

**Opzione alternativa: Gmail via SMTP** (funziona solo se l'hosting non blocca la
porta 587 — molti hosting gratuiti la bloccano, Brevo è più affidabile):
1. Attiva la verifica in due passaggi sul tuo account Google
2. Crea una "Password per le app" (myaccount.google.com → Sicurezza)
3. Nel `.env`:
   ```
   SMTP_USER=tuaemail@gmail.com
   SMTP_PASS=la-password-per-le-app-di-16-caratteri
   MAIL_FROM_EMAIL=tuaemail@gmail.com
   ```

Se non configuri nessuna delle due, in sviluppo il link di verifica viene solo
stampato nel terminale (comodo per testare); in produzione la registrazione
darà errore finché non configuri l'email.

## 5. Chi può gestire ricette e messaggi (ruolo "editor")
Apri `config/editors.js` e metti lì le email che devono avere il ruolo di
dottoressa/operatore. Solo chi si registra E verifica l'email con una di
quelle email ottiene i permessi da editor (aggiungere/togliere ricette,
mettere in evidenza, rispondere/nascondere messaggi, modificare il
consiglio del giorno). Un normale visitatore non può ottenere questi
permessi in nessun modo dal browser.

## 6. Come pubblicarlo online GRATIS, senza carta di credito
**Render.com**, piano gratuito "Web Service" + **Turso** per i dati (punto 2).
Questa combinazione risolve il problema che ci eravamo posti: zero carta di
credito, zero spese, e i dati NON si perdono più, nemmeno quando Render
riavvia il sito.

1. Prima configura Turso (punto 2 / `TURSO.md`) e verifica in locale che
   funzioni (`npm start` deve dire "Database: Turso (permanente)").
2. Carica il codice su GitHub (crea un repository e fai push di questa cartella,
   **senza** includere il file `.env` — c'è già un `.gitignore` che lo esclude).
3. Su Render: "New" → "Web Service" → collega il repository GitHub.
4. Imposta:
   - Build command: `npm install`
   - Start command: `npm start`
5. In "Environment" aggiungi le stesse variabili del tuo `.env`:
   `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BREVO_API_KEY`,
   `MAIL_FROM_EMAIL`, `NODE_ENV=production`, `BASE_URL=https://il-tuo-sito.onrender.com`.
6. Deploy. Dopo qualche minuto il sito è online.

**Una cosa vera da sapere, per non avere sorprese:** il piano gratuito di
Render "si addormenta" dopo 15 minuti di inattività. Il primo visitatore
dopo una pausa aspetta fino a un minuto prima che la pagina si carichi (il
server si sta "risvegliando"); dal secondo click in poi è di nuovo veloce.
Per un sito con poche visite al giorno è normale e non è un difetto del
codice — e soprattutto, con Turso configurato, **i dati restano intatti**
anche durante questi risvegli.

## 7. Sicurezza — cosa ho già messo a posto
- Le password sono cifrate (bcrypt), mai salvate in chiaro.
- Il ruolo "editor" è deciso SOLO dal server (email nella whitelist +
  email verificata), mai dal browser.
- Solo la cartella `public/` è raggiungibile da internet: `.env`, il
  database e il codice sorgente non sono scaricabili.
- Limite di richieste su login/registrazione/invio messaggi (anti-abuso).
- Caricamento immagini ricette limitato a 5 MB e solo file immagine veri.
- Le foto delle ricette sono salvate dentro il database (non su disco):
  niente cartelle da proteggere, niente file orfani da ripulire.
- Testo di domande/risposte inserito nella pagina in modo sicuro (niente
  script iniettabili).
