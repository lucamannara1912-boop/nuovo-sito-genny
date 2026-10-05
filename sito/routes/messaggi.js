// routes/messaggi.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificaToken } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// GET: elenco messaggi. L'editor vede tutti (tranne quelli che ha nascosto per sé),
// il visitatore vede solo i propri.
router.get('/', verificaToken, async (req, res) => {
  try {
    let righe;
    if (req.utente.ruolo === 'editor') {
      righe = await db.prepare('SELECT * FROM messaggi WHERE nascostoPerDottoressa = 0 ORDER BY id DESC').all();
    } else {
      righe = await db.prepare('SELECT * FROM messaggi WHERE user_email = ? ORDER BY id DESC').all(req.utente.email);
    }

    const messaggi = righe.map(m => ({
      ...m,
      nascostoPerDottoressa: !!m.nascostoPerDottoressa,
      conversazione: (() => { try { return JSON.parse(m.conversazione || '[]'); } catch { return []; } })()
    }));

    res.json(messaggi);
  } catch (err) {
    console.error('Errore GET messaggi:', err);
    res.status(500).json({ errore: 'Errore nel recupero dei messaggi.' });
  }
});

// POST: nuova domanda
router.post('/', verificaToken, rateLimit({ finestraMs: 60 * 1000, max: 5, messaggio: 'Aspetta qualche secondo prima di inviare un\'altra domanda.', chiave: r => r.utente.email }), async (req, res) => {
  const domanda = String(req.body.domanda || '').trim();
  if (!domanda) return res.status(400).json({ errore: 'La domanda non può essere vuota.' });
  if (domanda.length > 3000) return res.status(400).json({ errore: 'Domanda troppo lunga (massimo 3000 caratteri).' });

  try {
    await db.prepare(`
      INSERT INTO messaggi (user_email, user_name, domanda, stato, nascostoPerDottoressa, conversazione)
      VALUES (?, ?, ?, 'in_attesa', 0, '[]')
    `).run(req.utente.email, req.utente.nomePubblico, domanda);

    res.status(201).json({ successo: true, messaggio: 'Domanda inviata con successo.' });
  } catch (err) {
    console.error('Errore POST messaggio:', err);
    res.status(500).json({ errore: 'Errore durante l\'invio della domanda.' });
  }
});

function puoVedere(msg, utente) {
  return utente.ruolo === 'editor' || msg.user_email === utente.email;
}

// PATCH /:id/rispondi — aggiunge una replica alla conversazione (usata sia dall'editor che dal visitatore)
router.patch('/:id/rispondi', verificaToken, async (req, res) => {
  const { id } = req.params;
  const risposta = String(req.body.risposta || '').trim();
  if (!risposta) return res.status(400).json({ errore: 'La risposta non può essere vuota.' });
  if (risposta.length > 3000) return res.status(400).json({ errore: 'Risposta troppo lunga.' });

  try {
    const msg = await db.prepare('SELECT * FROM messaggi WHERE id = ?').get(id);
    if (!msg) return res.status(404).json({ errore: 'Messaggio non trovato.' });
    if (!puoVedere(msg, req.utente)) return res.status(403).json({ errore: 'Non autorizzato.' });

    let conversazione = [];
    try { conversazione = JSON.parse(msg.conversazione || '[]'); } catch {}
    conversazione.push({
      idReplica: 'rep_' + Date.now(),
      autoreEmail: req.utente.email,
      autoreNome: req.utente.nomePubblico,
      ruolo: req.utente.ruolo,
      testo: risposta,
      data: new Date().toISOString()
    });

    const nuovoStato = req.utente.ruolo === 'editor' ? 'risposto' : 'in_attesa';
    // Se risponde l'editor, il messaggio resta con l'ultima risposta "ufficiale";
    // se risponde il visitatore, la card torna visibile all'editor anche se l'aveva nascosta.
    const nuovoNascondi = req.utente.ruolo === 'editor' ? msg.nascostoPerDottoressa : 0;
    const nuovaRisposta = req.utente.ruolo === 'editor' ? risposta : msg.risposta;

    await db.prepare(`
      UPDATE messaggi SET risposta = ?, stato = ?, conversazione = ?, nascostoPerDottoressa = ?
      WHERE id = ?
    `).run(nuovaRisposta, nuovoStato, JSON.stringify(conversazione), nuovoNascondi ? 1 : 0, id);

    res.json({ successo: true, messaggio: 'Risposta inviata con successo.' });
  } catch (err) {
    console.error('Errore PATCH rispondi:', err);
    res.status(500).json({ errore: 'Errore durante il salvataggio.' });
  }
});

// DELETE /:id — l'editor "nasconde per sé" (soft delete), il visitatore elimina davvero il proprio messaggio
router.delete('/:id', verificaToken, async (req, res) => {
  const { id } = req.params;
  try {
    const msg = await db.prepare('SELECT * FROM messaggi WHERE id = ?').get(id);
    if (!msg) return res.status(404).json({ errore: 'Messaggio non trovato.' });
    if (!puoVedere(msg, req.utente)) return res.status(403).json({ errore: 'Non autorizzato.' });

    if (req.utente.ruolo === 'editor') {
      await db.prepare('UPDATE messaggi SET nascostoPerDottoressa = 1 WHERE id = ?').run(id);
      res.json({ successo: true, messaggio: 'Messaggio rimosso dalla tua visualizzazione.' });
    } else {
      await db.prepare('DELETE FROM messaggi WHERE id = ?').run(id);
      res.json({ successo: true, messaggio: 'Messaggio eliminato.' });
    }
  } catch (err) {
    console.error('Errore DELETE:', err);
    res.status(500).json({ errore: 'Errore durante l\'eliminazione.' });
  }
});

module.exports = router;
