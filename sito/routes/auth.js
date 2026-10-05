// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const rateLimit = require('../middleware/rateLimit');
const { JWT_SECRET } = require('../config');
const { trovaEditor } = require('../config/editors');
const { inviaEmailVerifica } = require('../mailer');

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseUrl(req) {
  // Toglie sempre eventuali "/" finali (es. "https://sito.it/" -> "https://sito.it"):
  // senza questo, un BASE_URL con lo slash finale genera link con doppio "//"
  // (es. https://sito.it//api/auth/verifica) che il browser non trova.
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return base.replace(/\/+$/, '');
}

function datiPubbliciUtente(utente) {
  const editor = trovaEditor(utente.email);
  return {
    email: utente.email,
    nome: utente.nome || utente.email.split('@')[0],
    cognome: utente.cognome || '',
    ruolo: editor ? 'editor' : 'visitatore',
    titolo: editor ? editor.titolo : 'Visitatore'
  };
}

// ---------- REGISTRAZIONE ----------
router.post('/registrati', rateLimit({ finestraMs: 15 * 60 * 1000, max: 8, messaggio: 'Troppi tentativi di registrazione. Riprova più tardi.' }), async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const cognome = String(req.body.cognome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!nome || !cognome || !email || !password) {
      return res.status(400).json({ errore: 'Tutti i campi sono obbligatori.' });
    }
    if (!REGEX_EMAIL.test(email)) {
      return res.status(400).json({ errore: 'Inserisci un indirizzo email valido.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ errore: 'La password deve avere almeno 8 caratteri.' });
    }

    const esistente = await db.prepare('SELECT id, verificato FROM utenti WHERE email = ?').get(email);
    if (esistente && esistente.verificato) {
      return res.status(400).json({ errore: 'Questa email è già registrata. Prova ad accedere.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const token_verifica = crypto.randomBytes(32).toString('hex');
    const token_scadenza = Date.now() + 24 * 60 * 60 * 1000; // 24 ore

    if (esistente) {
      // Si era registrato ma non aveva mai verificato: aggiorniamo i dati e rimandiamo l'email
      await db.prepare(`
        UPDATE utenti SET nome = ?, cognome = ?, password_hash = ?, token_verifica = ?, token_scadenza = ?
        WHERE id = ?
      `).run(nome, cognome, password_hash, token_verifica, token_scadenza, esistente.id);
    } else {
      await db.prepare(`
        INSERT INTO utenti (email, password_hash, ruolo, nome, cognome, verificato, token_verifica, token_scadenza)
        VALUES (?, ?, 'visitatore', ?, ?, 0, ?, ?)
      `).run(email, password_hash, nome, cognome, token_verifica, token_scadenza);
    }

    const link = `${baseUrl(req)}/api/auth/verifica?token=${token_verifica}`;
    try {
      await inviaEmailVerifica(email, nome, link);
    } catch (errMail) {
      console.error('Invio email di verifica fallito:', errMail.message);
      return res.status(201).json({
        successo: true,
        messaggio: 'Registrazione salvata, ma non siamo riusciti a inviare l\'email di verifica. Riprova più tardi o contattaci.'
      });
    }

    res.status(201).json({
      successo: true,
      messaggio: 'Registrazione completata! Ti abbiamo inviato un\'email di verifica: apri il link per attivare l\'account prima di accedere.'
    });
  } catch (err) {
    console.error('Errore registrazione:', err);
    res.status(500).json({ errore: 'Errore del server durante la registrazione.' });
  }
});

// ---------- VERIFICA EMAIL ----------
router.get('/verifica', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    const utente = token ? await db.prepare('SELECT * FROM utenti WHERE token_verifica = ?').get(token) : null;

    const pagina = (titolo, testo, ok) => res.status(ok ? 200 : 400).send(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titolo}</title>
      <style>body{font-family:'Manrope',Arial,sans-serif;background:#FFFCF7;color:#1F4C34;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:20px}
      .box{max-width:440px;text-align:center;background:#fff;padding:40px 30px;border-radius:20px;border:1px solid #E5C585;box-shadow:0 20px 40px rgba(31,76,52,.1)}
      a{display:inline-block;margin-top:20px;background:#1F4C34;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold}</style></head>
      <body><div class="box"><h1>${ok ? '✅' : '⚠️'} ${titolo}</h1><p>${testo}</p><a href="/home.html">Torna al sito</a></div></body></html>`);

    if (!utente) return pagina('Link non valido', 'Questo link di verifica non è valido o è già stato usato.', false);
    if (utente.verificato) return pagina('Email già verificata', 'Il tuo account è già attivo: puoi accedere normalmente.', true);
    if (utente.token_scadenza && Date.now() > utente.token_scadenza) {
      return pagina('Link scaduto', 'Questo link è scaduto. Registrati di nuovo per ricevere una nuova email di verifica.', false);
    }

    await db.prepare('UPDATE utenti SET verificato = 1, token_verifica = NULL, token_scadenza = NULL WHERE id = ?').run(utente.id);
    pagina('Email verificata!', 'Il tuo account è ora attivo. Puoi tornare al sito ed effettuare l\'accesso.', true);
  } catch (err) {
    console.error('Errore verifica email:', err);
    res.status(500).send('Errore del server durante la verifica.');
  }
});

// ---------- LOGIN ----------
router.post('/login', rateLimit({
  finestraMs: 15 * 60 * 1000, max: 12,
  messaggio: 'Troppi tentativi di accesso. Riprova tra qualche minuto.',
  chiave: (req) => `${req.ip}:${String(req.body.email || '').toLowerCase()}`
}), async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ errore: 'E-mail e password sono obbligatorie.' });

    const utente = await db.prepare('SELECT * FROM utenti WHERE email = ?').get(email);
    // Messaggio identico che l'utente esista o no, per non rivelare quali email sono registrate
    if (!utente) return res.status(401).json({ errore: 'Credenziali non valide.' });

    const passwordValida = await bcrypt.compare(password, utente.password_hash);
    if (!passwordValida) return res.status(401).json({ errore: 'Credenziali non valide.' });

    if (!utente.verificato) {
      return res.status(403).json({ errore: 'Devi prima verificare la tua email. Controlla la posta (anche lo spam).' });
    }

    const dati = datiPubbliciUtente(utente);
    const token = jwt.sign({ email: utente.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ successo: true, token, ...dati });
  } catch (err) {
    console.error('Errore login:', err);
    res.status(500).json({ errore: 'Errore del server durante il login.' });
  }
});

module.exports = router;
