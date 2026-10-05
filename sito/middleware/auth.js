const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../config');
const { trovaEditor } = require('../config/editors');

// Ricostruisce l'utente dal DATABASE: il ruolo scritto nel token (o inviato dal browser) non viene mai creduto.
function verificaToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ errore: 'Devi effettuare l\'accesso.' });

  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) return res.status(401).json({ errore: 'Sessione scaduta: effettua di nuovo l\'accesso.' });

    try {
      const utente = await db.prepare('SELECT email, nome, cognome, verificato FROM utenti WHERE email = ?').get(payload.email);
      if (!utente || !utente.verificato) return res.status(401).json({ errore: 'Account non valido.' });

      const editor = trovaEditor(utente.email);
      req.utente = {
        email: utente.email,
        nome: utente.nome || utente.email.split('@')[0],
        cognome: utente.cognome || '',
        ruolo: editor ? 'editor' : 'visitatore',
        titolo: editor ? editor.titolo : 'Visitatore',
        nomePubblico: editor ? editor.nome : [utente.nome, utente.cognome].filter(Boolean).join(' ') || utente.email.split('@')[0]
      };
      next();
    } catch (errDb) {
      next(errDb);
    }
  });
}

function verificaEditor(req, res, next) {
  if (!req.utente || req.utente.ruolo !== 'editor') {
    return res.status(403).json({ errore: 'Accesso negato: solo la dottoressa e l\'operatore possono farlo.' });
  }
  next();
}

module.exports = { verificaToken, verificaEditor };
