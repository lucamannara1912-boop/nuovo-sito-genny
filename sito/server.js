require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PRODUCTION } = require('./config');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1); // necessario dietro Render/Railway/Nginx per il rate-limit basato su IP

// CORS: se il frontend è servito dallo stesso server (caso normale) lascialo pure aperto;
// se lo pubblichi su un dominio diverso dal backend, imposta CORS_ORIGIN nel file .env.
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Intestazioni di sicurezza di base (senza dipendenze aggiuntive)
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// File statici del frontend: SOLO dalla cartella "public" (mai la radice del progetto,
// altrimenti .env, il database e il codice sorgente sarebbero scaricabili da chiunque)
app.use(express.static(path.join(__dirname, 'public')));
// Nota: non c'è più una cartella "uploads" da servire — le foto delle ricette
// sono salvate direttamente nel database (vedi routes/ricette.js), così
// restano permanenti anche su hosting con disco non persistente.

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/ricette', require('./routes/ricette'));
app.use('/api/messaggi', require('./routes/messaggi'));

app.get('/api/health', (req, res) => res.json({
  status: 'attivo',
  ambiente: process.env.NODE_ENV || 'sviluppo',
  database: db.tipo === 'turso' ? 'Turso (permanente)' : 'locale (NON permanente su hosting come Render)'
}));

// 404 per le rotte API non trovate
app.use('/api', (req, res) => res.status(404).json({ errore: 'Rotta non trovata.' }));

// Gestore errori generico (evita che il server si blocchi per un errore non previsto)
app.use((err, req, res, next) => {
  console.error('Errore non gestito:', err);
  res.status(500).json({ errore: 'Errore interno del server.' });
});

if (require.main === module) {
  db.pronto
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server avviato su http://localhost:${PORT} in modalità ${process.env.NODE_ENV || 'sviluppo'}`);
        console.log(`Database: ${db.tipo === 'turso' ? 'Turso (permanente)' : 'locale — NON permanente su hosting come Render, vedi TURSO.md'}`);
        if (!PRODUCTION) console.log('Promemoria: per la produzione compila il file .env (vedi .env.example).');
      });
    })
    .catch((err) => {
      console.error('Impossibile inizializzare il database:', err);
      process.exit(1);
    });
}

module.exports = app;
