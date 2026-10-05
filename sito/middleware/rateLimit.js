// Limitatore semplice in memoria (basta per un sito piccolo con un solo processo)
function rateLimit({ finestraMs, max, messaggio, chiave }) {
  const contatori = new Map();
  setInterval(() => {
    const ora = Date.now();
    for (const [k, v] of contatori) if (v.scade <= ora) contatori.delete(k);
  }, 60000).unref();

  return (req, res, next) => {
    const k = chiave ? chiave(req) : req.ip;
    const ora = Date.now();
    let c = contatori.get(k);
    if (!c || c.scade <= ora) { c = { n: 0, scade: ora + finestraMs }; contatori.set(k, c); }
    c.n++;
    if (c.n > max) {
      res.set('Retry-After', String(Math.ceil((c.scade - ora) / 1000)));
      return res.status(429).json({ errore: messaggio || 'Troppe richieste, riprova più tardi.' });
    }
    next();
  };
}
module.exports = rateLimit;
