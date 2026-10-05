'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const API = `${window.location.origin}/api`;

  const CATEGORIE_LABEL = { colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', snack: 'Snack / Dolci' };

  function getDatiUtente() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return { email: localStorage.getItem('email') || '', ruolo: localStorage.getItem('ruolo') || 'visitatore' };
  }
  function isEditor() { const d = getDatiUtente(); return !!d && d.ruolo === 'editor'; }
  function mostraAvviso(testo) {
    if (typeof window.mostraMessaggioTema === 'function') window.mostraMessaggioTema(testo);
    else alert(testo);
  }

  /* ---------- TITOLO ANIMATO LETTERA PER LETTERA ---------- */
  const titoloEl = document.getElementById('titoloTestoAnimato');
  if (titoloEl) {
    const testo = titoloEl.textContent;
    titoloEl.textContent = '';
    [...testo].forEach((carattere, i) => {
      const span = document.createElement('span');
      span.className = 'lettera-animata';
      span.textContent = carattere === ' ' ? '\u00A0' : carattere;
      span.style.animationDelay = `${i * 0.045}s`;
      titoloEl.appendChild(span);
    });
  }

  /* ---------- NASTRO CONSIGLIO DEL GIORNO ---------- */
  const nastro = document.getElementById('nastroDietologaContainer');
  const apriNastroBtn = document.getElementById('apriNastroBtn');
  const chiudiNastroBtn = document.getElementById('chiudiNastroBtn');
  const consiglioTesto = document.getElementById('consiglioDietologaTesto');
  const btnModificaConsiglio = document.getElementById('btnModificaConsiglio');
  const boxEditConsiglio = document.getElementById('boxEditConsiglio');
  const inputModificaConsiglio = document.getElementById('inputModificaConsiglio');
  const btnSalvaConsiglio = document.getElementById('btnSalvaConsiglio');

  async function caricaConsiglio() {
    try {
      const res = await fetch(`${API}/ricette/consiglio`);
      const dati = await res.json();
      if (consiglioTesto) consiglioTesto.textContent = `"${dati.testo}"`;
      if (inputModificaConsiglio) inputModificaConsiglio.value = dati.testo;
    } catch (err) {
      console.error('Errore caricamento consiglio:', err);
      if (consiglioTesto) consiglioTesto.textContent = '"Bevi molta acqua e privilegia alimenti freschi e di stagione."';
    }
  }
  caricaConsiglio();

  if (apriNastroBtn && nastro) apriNastroBtn.addEventListener('click', () => nastro.classList.add('aperta'));
  if (chiudiNastroBtn && nastro) chiudiNastroBtn.addEventListener('click', () => {
    nastro.classList.remove('aperta');
    if (boxEditConsiglio) boxEditConsiglio.setAttribute('hidden', 'true');
    if (consiglioTesto) consiglioTesto.hidden = false;
  });
  if (btnModificaConsiglio) btnModificaConsiglio.addEventListener('click', () => {
    if (boxEditConsiglio) boxEditConsiglio.removeAttribute('hidden');
    if (consiglioTesto) consiglioTesto.hidden = true;
  });
  if (btnSalvaConsiglio) btnSalvaConsiglio.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    const testo = (inputModificaConsiglio.value || '').trim();
    if (!testo) { mostraAvviso('Il consiglio non può essere vuoto.'); return; }
    btnSalvaConsiglio.disabled = true;
    try {
      const res = await fetch(`${API}/ricette/consiglio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ testo })
      });
      const dati = await res.json();
      if (!res.ok) { mostraAvviso(dati.errore || 'Errore durante il salvataggio.'); return; }
      if (consiglioTesto) { consiglioTesto.textContent = `"${dati.testo}"`; consiglioTesto.hidden = false; }
      if (boxEditConsiglio) boxEditConsiglio.setAttribute('hidden', 'true');
    } catch (err) {
      console.error(err);
      mostraAvviso('Errore di rete.');
    } finally {
      btnSalvaConsiglio.disabled = false;
    }
  });

  /* ---------- STATO EDITOR (pulsante nuova ricetta, matita consiglio) ---------- */
  function aggiornaStatoEditor() {
    const editor = isEditor();
    const contenitoreBtnEditor = document.getElementById('contenitoreBtnEditor');
    if (contenitoreBtnEditor) contenitoreBtnEditor.hidden = !editor;
    if (btnModificaConsiglio) btnModificaConsiglio.hidden = !editor;
  }
  aggiornaStatoEditor();
  window.addEventListener('storage', () => { aggiornaStatoEditor(); caricaRicette(); });

  /* ---------- PANNELLO "NUOVA RICETTA" ---------- */
  const sezionePannelloEditor = document.getElementById('sezionePannelloEditor');
  const btnApriPannelloEditor = document.getElementById('btnApriPannelloEditor');
  const chiudiPannelloEditor = document.getElementById('chiudiPannelloEditor');
  const formNuovaRicetta = document.getElementById('formNuovaRicetta');

  function apriPannelloEditor() {
    if (!sezionePannelloEditor) return;
    sezionePannelloEditor.hidden = false;
    requestAnimationFrame(() => sezionePannelloEditor.classList.add('attivo'));
    sezionePannelloEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function chiudiPannello() {
    if (!sezionePannelloEditor) return;
    sezionePannelloEditor.classList.remove('attivo');
    setTimeout(() => { sezionePannelloEditor.hidden = true; }, 400);
  }
  if (btnApriPannelloEditor) btnApriPannelloEditor.addEventListener('click', apriPannelloEditor);
  if (chiudiPannelloEditor) chiudiPannelloEditor.addEventListener('click', chiudiPannello);

  if (formNuovaRicetta) {
    formNuovaRicetta.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = localStorage.getItem('token');
      if (!token) { mostraAvviso('Devi effettuare l\'accesso.'); return; }

      const checkboxCategorie = formNuovaRicetta.querySelectorAll('input[name="categorie"]:checked');
      if (checkboxCategorie.length === 0) { mostraAvviso('Seleziona almeno una categoria.'); return; }

      const formData = new FormData(formNuovaRicetta);
      const btnInvia = formNuovaRicetta.querySelector('.btn-pubblica-ricetta');
      const testoOriginale = btnInvia.textContent;
      btnInvia.disabled = true;
      btnInvia.textContent = 'Pubblicazione in corso...';

      try {
        const res = await fetch(`${API}/ricette`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const dati = await res.json();
        if (!res.ok) { mostraAvviso(dati.errore || 'Errore durante la pubblicazione.'); return; }

        mostraAvviso('Ricetta pubblicata con successo!');
        formNuovaRicetta.reset();
        chiudiPannello();
        caricaRicette();
      } catch (err) {
        console.error(err);
        mostraAvviso('Errore di rete durante la pubblicazione.');
      } finally {
        btnInvia.disabled = false;
        btnInvia.textContent = testoOriginale;
      }
    });
  }

  /* ---------- CARICAMENTO E RENDER RICETTE ---------- */
  const listaRicettePubbliche = document.getElementById('listaRicettePubbliche');
  const contenitoreBtnEditor = document.getElementById('contenitoreBtnEditor');
  const inputCercaRicette = document.getElementById('inputCercaRicette');
  const containerFiltriCategoria = document.getElementById('containerFiltriCategoria');

  let tutteLeRicette = [];
  let categoriaAttiva = 'tutte';

  function creaEl(tag, opzioni = {}) {
    const el = document.createElement(tag);
    if (opzioni.classe) el.className = opzioni.classe;
    if (opzioni.testo !== undefined) el.textContent = opzioni.testo;
    return el;
  }

  function mostraSkeleton(n = 4) {
    listaRicettePubbliche.querySelectorAll('.card-ricetta-compatta, .skeleton-card, .stato-vuoto-ricette').forEach(el => el.remove());
    for (let i = 0; i < n; i++) {
      const sk = creaEl('div', { classe: 'skeleton-card' });
      const img = creaEl('div', { classe: 'skeleton-img' });
      const lines = creaEl('div', { classe: 'skeleton-lines' });
      lines.appendChild(creaEl('div', { classe: 'skeleton-line long' }));
      lines.appendChild(creaEl('div', { classe: 'skeleton-line' }));
      lines.appendChild(creaEl('div', { classe: 'skeleton-line' }));
      sk.appendChild(img);
      sk.appendChild(lines);
      listaRicettePubbliche.appendChild(sk);
    }
  }

  function primaCategoria(categoria) {
    return String(categoria || 'generale').split(',')[0].trim() || 'generale';
  }

  function creaCardRicetta(r) {
    const card = creaEl('div', { classe: `card-ricetta-compatta${r.fissata ? ' fissata' : ''}` });
    card.dataset.id = r.id;

    const img = document.createElement('img');
    img.className = 'card-img-piccola';
    img.loading = 'lazy';
    img.alt = r.titolo;
    img.src = r.foto || 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23EAE3D9"/></svg>');
    card.appendChild(img);

    const infoLato = creaEl('div', { classe: 'card-info-lato' });

    const headerLinea = creaEl('div', { classe: 'card-header-linea' });
    const catPrincipale = primaCategoria(r.categoria);
    const tag = creaEl('span', { classe: `tag-categoria-piccolo tag-${catPrincipale}`, testo: CATEGORIE_LABEL[catPrincipale] || 'Ricetta' });
    headerLinea.appendChild(tag);
    if (r.fissata) headerLinea.appendChild(creaEl('span', { classe: 'badge-fissata-card', testo: '⭐ In evidenza' }));
    infoLato.appendChild(headerLinea);

    infoLato.appendChild(creaEl('h3', { classe: 'titolo-card-piccolo', testo: r.titolo }));
    if (r.calorie) infoLato.appendChild(creaEl('span', { classe: 'cal-piccolo', testo: `${r.calorie} kcal` }));

    const anteprima = String(r.ingredienti || '').slice(0, 90);
    infoLato.appendChild(creaEl('p', { classe: 'anteprima-ingredienti', testo: anteprima + (r.ingredienti.length > 90 ? '…' : '') }));

    card.appendChild(infoLato);

    const indicatore = creaEl('div', { classe: 'indicatore-click-card', testo: 'Vedi ricetta →' });
    card.appendChild(indicatore);

    card.addEventListener('click', () => apriModaleRicetta(r));
    return card;
  }

  function applicaFiltri() {
    listaRicettePubbliche.querySelectorAll('.card-ricetta-compatta, .skeleton-card, .stato-vuoto-ricette').forEach(el => el.remove());

    const testoCerca = (inputCercaRicette.value || '').trim().toLowerCase();
    const filtrate = tutteLeRicette.filter(r => {
      const categorieRicetta = String(r.categoria || '').split(',');
      const matchCategoria = categoriaAttiva === 'tutte' || categorieRicetta.includes(categoriaAttiva);
      const matchTesto = !testoCerca || r.titolo.toLowerCase().includes(testoCerca) || String(r.ingredienti).toLowerCase().includes(testoCerca);
      return matchCategoria && matchTesto;
    });

    if (filtrate.length === 0) {
      const vuoto = creaEl('p', { classe: 'stato-vuoto-ricette', testo: 'Nessuna ricetta trovata con questi filtri.' });
      vuoto.style.cssText = 'grid-column: 1/-1; text-align:center; opacity:.7; padding: 30px 0;';
      listaRicettePubbliche.appendChild(vuoto);
      return;
    }

    filtrate.forEach(r => listaRicettePubbliche.appendChild(creaCardRicetta(r)));
  }

  async function caricaRicette() {
    mostraSkeleton();
    try {
      const res = await fetch(`${API}/ricette`);
      tutteLeRicette = await res.json();
      applicaFiltri();
    } catch (err) {
      console.error('Errore caricamento ricette:', err);
      listaRicettePubbliche.querySelectorAll('.skeleton-card').forEach(el => el.remove());
      const errore = creaEl('p', { testo: 'Impossibile caricare le ricette al momento. Riprova più tardi.' });
      errore.style.cssText = 'grid-column: 1/-1; text-align:center; opacity:.7; padding: 30px 0;';
      listaRicettePubbliche.appendChild(errore);
    }
    // Il pulsante "Nuova Ricetta" resta sempre il primo figlio
    if (contenitoreBtnEditor && listaRicettePubbliche.firstChild !== contenitoreBtnEditor) {
      listaRicettePubbliche.insertBefore(contenitoreBtnEditor, listaRicettePubbliche.firstChild);
    }
  }

  if (containerFiltriCategoria) {
    containerFiltriCategoria.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-filtro');
      if (!btn) return;
      containerFiltriCategoria.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('attivo'));
      btn.classList.add('attivo');
      categoriaAttiva = btn.dataset.categoria;
      applicaFiltri();
    });
  }
  if (inputCercaRicette) {
    let timeoutRicerca;
    inputCercaRicette.addEventListener('input', () => {
      clearTimeout(timeoutRicerca);
      timeoutRicerca = setTimeout(applicaFiltri, 200);
    });
  }

  /* ---------- MODALE DETTAGLIO RICETTA ---------- */
  let overlayModale = null;

  function apriModaleRicetta(r) {
    chiudiModale();
    overlayModale = creaEl('div', { classe: 'overlay-modale-ricetta' });
    const scheda = creaEl('div', { classe: 'scheda-modale-dettaglio' });

    const btnChiudi = creaEl('button', { classe: 'chiudi-modale-btn', testo: '×' });
    btnChiudi.type = 'button';
    btnChiudi.addEventListener('click', chiudiModale);
    scheda.appendChild(btnChiudi);

    if (r.foto) {
      const img = document.createElement('img');
      img.className = 'modale-img-grande';
      img.src = r.foto;
      img.alt = r.titolo;
      scheda.appendChild(img);
    }

    scheda.appendChild(creaEl('h2', { classe: 'modale-titolo', testo: r.titolo }));

    const macroBox = creaEl('div', { classe: 'modale-macro-box' });
    const macro = [];
    if (r.calorie) macro.push(`🔥 ${r.calorie} kcal`);
    if (r.proteine) macro.push(`💪 ${r.proteine}g proteine`);
    if (r.carboidrati) macro.push(`🌾 ${r.carboidrati}g carboidrati`);
    if (r.grassi) macro.push(`🥑 ${r.grassi}g grassi`);
    if (macro.length) {
      macro.forEach(m => macroBox.appendChild(creaEl('span', { testo: m })));
      scheda.appendChild(macroBox);
    }

    const ingredientiBox = creaEl('div', { classe: 'modale-sezione-testo' });
    ingredientiBox.appendChild(creaEl('strong', { testo: 'Ingredienti' }));
    ingredientiBox.appendChild(creaEl('p', { testo: r.ingredienti }));
    scheda.appendChild(ingredientiBox);

    const procedimentoBox = creaEl('div', { classe: 'modale-sezione-testo' });
    procedimentoBox.appendChild(creaEl('strong', { testo: 'Procedimento' }));
    procedimentoBox.appendChild(creaEl('p', { testo: r.procedimento }));
    scheda.appendChild(procedimentoBox);

    if (isEditor()) {
      const azioni = creaEl('div', { classe: 'azioni-editor-modale' });

      const btnFissa = creaEl('button', { classe: 'btn-fissa-modale', testo: r.fissata ? '⭐ Togli da evidenza' : '⭐ Metti in evidenza' });
      btnFissa.type = 'button';
      btnFissa.style.cssText = 'background:#E5C585;color:#1F4C34;';
      btnFissa.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        btnFissa.disabled = true;
        try {
          const res = await fetch(`${API}/ricette/${r.id}/fissa`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
          const dati = await res.json();
          if (!res.ok) { mostraAvviso(dati.errore || 'Errore.'); return; }
          chiudiModale();
          caricaRicette();
        } catch (err) { console.error(err); mostraAvviso('Errore di rete.'); }
        finally { btnFissa.disabled = false; }
      });

      const btnElimina = creaEl('button', { classe: 'btn-elimina-ricetta-modale', testo: '🗑️ Elimina ricetta' });
      btnElimina.type = 'button';
      btnElimina.style.cssText = 'background:#c0392b;color:#fff;';
      btnElimina.addEventListener('click', async () => {
        if (!confirm('Eliminare definitivamente questa ricetta?')) return;
        const token = localStorage.getItem('token');
        btnElimina.disabled = true;
        try {
          const res = await fetch(`${API}/ricette/${r.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          const dati = await res.json();
          if (!res.ok) { mostraAvviso(dati.errore || 'Errore.'); return; }
          chiudiModale();
          caricaRicette();
        } catch (err) { console.error(err); mostraAvviso('Errore di rete.'); }
        finally { btnElimina.disabled = false; }
      });

      azioni.appendChild(btnFissa);
      azioni.appendChild(btnElimina);
      scheda.appendChild(azioni);
    }

    overlayModale.appendChild(scheda);
    document.body.appendChild(overlayModale);
    requestAnimationFrame(() => overlayModale.classList.add('visibile'));

    overlayModale.addEventListener('click', (e) => { if (e.target === overlayModale) chiudiModale(); });
    document.addEventListener('keydown', escChiudeModale);
  }

  function escChiudeModale(e) { if (e.key === 'Escape') chiudiModale(); }

  function chiudiModale() {
    if (!overlayModale) return;
    overlayModale.classList.remove('visibile');
    document.removeEventListener('keydown', escChiudeModale);
    const el = overlayModale;
    overlayModale = null;
    setTimeout(() => el.remove(), 400);
  }

  caricaRicette();

  /* ---------- FOGLIE BOTANICHE SFONDO ---------- */
  const numFoglie = 7;
  const iconeBotaniche = ['🌿', '🍃', '🌱', '🍂', '🍀'];
  for (let i = 0; i < numFoglie; i++) {
    const foglia = document.createElement('div');
    foglia.classList.add('particella-botanica');
    foglia.innerHTML = iconeBotaniche[Math.floor(Math.random() * iconeBotaniche.length)];
    foglia.style.left = `${Math.random() * 100}vw`;
    foglia.style.top = `${Math.random() * 100}vh`;
    foglia.style.fontSize = `${Math.random() * 10 + 14}px`;
    foglia.style.opacity = Math.random() * 0.3 + 0.25;
    const durata = Math.random() * 6 + 5;
    foglia.style.animation = `fluttuaParticellaDinamica ${durata}s ease-in-out infinite alternate`;
    foglia.style.animationDelay = `${Math.random() * 5}s`;
    document.body.appendChild(foglia);
  }
});
