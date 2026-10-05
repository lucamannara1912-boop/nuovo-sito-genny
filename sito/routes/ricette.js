// routes/ricette.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const { verificaToken, verificaEditor } = require('../middleware/auth');

// Le foto NON vengono più scritte su disco: restano in memoria per il tempo
// della richiesta e vengono salvate come testo (base64) dentro il database
// (Turso, se configurato) insieme al resto della ricetta. Così le foto sono
// permanenti quanto messaggi e ricette, anche su hosting con disco non
// permanente come Render — non serve più una cartella "uploads".
const ESTENSIONI_CONSENTITE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MIME_CONSENTITI = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
    if (!MIME_CONSENTITI.has(file.mimetype) || !ESTENSIONI_CONSENTITE.has(ext)) {
      return cb(new Error('Formato immagine non consentito (usa JPG, PNG, WEBP o GIF).'));
    }
    cb(null, true);
  }
});

function gestisciErroreUpload(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ errore: 'Immagine troppo grande (massimo 5 MB).' });
    return res.status(400).json({ errore: 'Errore nel caricamento del file.' });
  }
  if (err) return res.status(400).json({ errore: err.message || 'Errore nel caricamento del file.' });
  next();
}

const CATEGORIE_VALIDE = new Set(['colazione', 'pranzo', 'cena', 'snack']);

function normalizzaCategorie(input) {
  const lista = Array.isArray(input) ? input : (input ? [input] : []);
  const pulite = [...new Set(lista.map(c => String(c).trim().toLowerCase()).filter(c => CATEGORIE_VALIDE.has(c)))];
  return pulite.join(',');
}

function numeroOppureNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET: tutte le ricette, fissate prima
router.get('/', async (req, res) => {
  try {
    const ricette = await db.prepare('SELECT * FROM ricette ORDER BY fissata DESC, id DESC').all();
    res.json(ricette.map(r => ({ ...r, fissata: !!r.fissata })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: 'Errore nel recupero delle ricette.' });
  }
});

// GET: il consiglio del giorno (pubblico)
router.get('/consiglio', async (req, res) => {
  try {
    const riga = await db.prepare('SELECT valore FROM impostazioni WHERE chiave = ?').get('consiglio_giorno');
    res.json({ testo: riga ? riga.valore : 'Bevi molta acqua e privilegia alimenti freschi e di stagione: il tuo corpo ti ringrazierà.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: 'Errore nel recupero del consiglio del giorno.' });
  }
});

// PUT: aggiorna il consiglio del giorno (solo editor)
router.put('/consiglio', verificaToken, verificaEditor, async (req, res) => {
  const testo = String(req.body.testo || '').trim();
  if (!testo) return res.status(400).json({ errore: 'Il consiglio non può essere vuoto.' });
  if (testo.length > 500) return res.status(400).json({ errore: 'Testo troppo lungo (massimo 500 caratteri).' });

  try {
    await db.prepare(`
      INSERT INTO impostazioni (chiave, valore) VALUES ('consiglio_giorno', ?)
      ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore
    `).run(testo);

    res.json({ successo: true, testo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: 'Errore durante il salvataggio del consiglio.' });
  }
});

// POST: nuova ricetta (solo editor)
router.post('/', verificaToken, verificaEditor, (req, res, next) => {
  upload.single('foto')(req, res, (err) => err ? gestisciErroreUpload(err, req, res, next) : next());
}, async (req, res) => {
  const titolo = String(req.body.titolo || '').trim();
  const ingredienti = String(req.body.ingredienti || '').trim();
  const procedimento = String(req.body.procedimento || '').trim();

  if (!titolo || !ingredienti || !procedimento) {
    return res.status(400).json({ errore: 'Titolo, ingredienti e procedimento sono obbligatori.' });
  }

  const categoria = normalizzaCategorie(req.body.categorie) || 'generale';
  // L'immagine diventa una "data URL" (es. data:image/jpeg;base64,....), pronta
  // per essere usata direttamente in un <img src="...">, senza bisogno di una
  // rotta separata che serva i file: il browser la legge così com'è dal database.
  const fotoDataUrl = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;

  try {
    const risultato = await db.prepare(`
      INSERT INTO ricette (titolo, foto, ingredienti, procedimento, calorie, proteine, carboidrati, grassi, categoria, fissata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      titolo, fotoDataUrl, ingredienti, procedimento,
      numeroOppureNull(req.body.calorie), numeroOppureNull(req.body.proteine),
      numeroOppureNull(req.body.carboidrati), numeroOppureNull(req.body.grassi),
      categoria
    );
    res.status(201).json({ successo: true, messaggio: 'Ricetta pubblicata con successo!', id: risultato.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: 'Errore durante il salvataggio della ricetta.' });
  }
});

// PATCH: metti/togli "in evidenza" (solo editor)
router.patch('/:id/fissa', verificaToken, verificaEditor, async (req, res) => {
  const { id } = req.params;
  try {
    const ricetta = await db.prepare('SELECT fissata FROM ricette WHERE id = ?').get(id);
    if (!ricetta) return res.status(404).json({ errore: 'Ricetta non trovata.' });

    const nuovoStato = ricetta.fissata ? 0 : 1;
    await db.prepare('UPDATE ricette SET fissata = ? WHERE id = ?').run(nuovoStato, id);
    res.json({ successo: true, messaggio: 'Stato aggiornato.', fissata: !!nuovoStato });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: 'Errore durante l\'aggiornamento dello stato.' });
  }
});

// DELETE: elimina una ricetta (solo editor)
router.delete('/:id', verificaToken, verificaEditor, async (req, res) => {
  const { id } = req.params;
  try {
    const ricetta = await db.prepare('SELECT id FROM ricette WHERE id = ?').get(id);
    if (!ricetta) return res.status(404).json({ errore: 'Ricetta non trovata.' });

    await db.prepare('DELETE FROM ricette WHERE id = ?').run(id);
    res.json({ successo: true, messaggio: 'Ricetta eliminata con successo.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: 'Errore durante l\'eliminazione della ricetta.' });
  }
});

module.exports = router;
