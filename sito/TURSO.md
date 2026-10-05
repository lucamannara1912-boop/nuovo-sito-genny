# Turso — il database permanente del sito (gratis, senza carta di credito)

Questa guida ti fa creare il database esterno dove vivranno per sempre
messaggi, ricette e foto, così non si perdono mai, anche se l'hosting
(Render) riavvia il sito. Tutto dal browser, **niente terminale**, 5-10 minuti.

## 1. Crea l'account Turso

1. Vai su **turso.tech** e clicca "Get Started" / "Sign up".
2. Accedi con GitHub o Google (il più veloce), oppure con email.
3. **Nessuna carta di credito richiesta** in nessun passaggio.

## 2. Crea il database

1. Nella dashboard, clicca **"Create Database"** (o il "+").
2. Dai un nome, es. `sito-genny-ferrara` (minuscolo, senza spazi).
3. Scegli la regione più vicina a te (es. una in Europa, tipo "Frankfurt"
   o "Amsterdam" se disponibili — non è un dettaglio critico).
4. Clicca **Create**. Aspetta qualche secondo.

## 3. Prendi i due codici che ti servono

1. Aperto il database, cerca la sezione **"Connect"** / **"Quick start"** /
   dettagli di connessione (il nome esatto del pulsante può variare un po'
   a seconda degli aggiornamenti dell'interfaccia Turso).
2. Troverai due informazioni:
   - **URL del database**: una stringa che inizia con `libsql://...`
   - **Auth Token**: un pulsante tipo "Create Token" / "Generate Token" —
     cliccalo, scegli una scadenza lunga (es. "No expiration" se c'è, o la
     più lunga disponibile) e copia il token che appare (è una stringa
     lunga di lettere e numeri). **Si vede una volta sola**: copialo subito
     in un posto sicuro.

## 4. Mettili nel file `.env` del sito

Apri il file `.env` nella cartella del sito (quello creato copiando
`.env.example`, come spiegato nel `README.md`) e compila:

```
TURSO_DATABASE_URL=libsql://il-tuo-indirizzo-completo.turso.io
TURSO_AUTH_TOKEN=il-token-lunghissimo-che-hai-copiato
```

Salva il file.

## 5. Prova che funzioni

In locale, dalla cartella del sito:
```bash
npm install
npm start
```
Nel terminale dovresti vedere scritto **"Database: Turso (permanente)"**
(invece di "locale"). Se lo vedi, sei collegato correttamente.

Prova poi ad aggiungere una ricetta di prova dal sito (`npm test` verifica
automaticamente anche questo, con `# pass 12`). Se tutto va bene, puoi
cancellare la ricetta di prova.

## 6. Collegalo anche su Render

Quando pubblichi il sito su Render (vedi README.md, sezione 5), aggiungi
le STESSE due variabili nella sezione "Environment" di Render:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Da quel momento, anche se Render riavvia il sito, i dati restano intatti:
sono su Turso, non sul disco (non permanente) di Render.

## Domande frequenti

**Devo pagare qualcosa, ora o in futuro?**
No, finché resti nei limiti gratuiti di Turso: 5 GB di spazio e centinaia
di milioni di letture al mese. Per un sito come questo (testo + foto di
ricette) sono limiti enormi, difficili da avvicinare anche dopo anni d'uso.

**Cosa succede se un giorno Turso non fosse più gratis?**
Tutti i dati restano SQLite standard: sono esportabili e trasferibili a
qualunque altro database compatibile con SQLite, senza essere "prigionieri"
del servizio.

**Posso vedere/modificare i dati direttamente da Turso?**
Sì, nella dashboard di Turso c'è di solito una scheda tipo "Studio" o
"Data Browser" che fa vedere le tabelle (`utenti`, `messaggi`, `ricette`,
`impostazioni`) e permette query dirette — utile per controlli, ma per le
normali operazioni di tutti i giorni basta usare il sito.

**Qualcosa non torna / un passaggio dell'interfaccia Turso è diverso da
come lo descrivo qui?**
L'interfaccia dei siti cambia nel tempo. Se un pulsante non si chiama
esattamente come scritto qui, cerca la sezione che parla di "Connect",
"Credentials" o "Tokens" — mandami uno screenshot se ti blocchi e ti aiuto
a trovarlo.
