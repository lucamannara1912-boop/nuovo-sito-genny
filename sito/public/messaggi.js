'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const API = `${window.location.origin}/api`;

  function getDatiUtente() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return {
      email: localStorage.getItem('email') || '',
      nome: localStorage.getItem('nome') || '',
      ruolo: localStorage.getItem('ruolo') || 'visitatore'
    };
  }

  const formFaq = document.getElementById('formFaq');
  const avvisoLoginFaq = document.getElementById('avvisoLoginFaq');
  const containerMieiMessaggi = document.getElementById('containerMieiMessaggi');
  const listaMessaggiUtente = document.getElementById('listaMessaggiUtente');

  let criterioOrdinamentoCorrente = 'default';

  async function aggiornaStatoMessaggi() {
    const token = localStorage.getItem('token');
    const datiUtente = getDatiUtente();

    if (token && datiUtente) {
      if (formFaq) formFaq.removeAttribute('hidden');
      if (avvisoLoginFaq) avvisoLoginFaq.style.display = 'none';
      if (containerMieiMessaggi) containerMieiMessaggi.removeAttribute('hidden');
      await caricaMessaggi(token, datiUtente);
    } else {
      if (formFaq) formFaq.setAttribute('hidden', 'true');
      if (avvisoLoginFaq) avvisoLoginFaq.style.display = 'block';
      if (containerMieiMessaggi) containerMieiMessaggi.setAttribute('hidden', 'true');
    }
  }

  function creaEl(tag, opzioni = {}) {
    const el = document.createElement(tag);
    if (opzioni.classe) el.className = opzioni.classe;
    if (opzioni.testo !== undefined) el.textContent = opzioni.testo;
    if (opzioni.html !== undefined) el.innerHTML = opzioni.html;
    if (opzioni.attrs) for (const [k, v] of Object.entries(opzioni.attrs)) el.setAttribute(k, v);
    return el;
  }

  function formattaData(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  function creaRigaReplica(etichetta, testo, data) {
    const box = creaEl('div', { classe: 'blocco-risposta-msg' });
    box.style.cssText = 'background: rgba(46, 107, 73, 0.25); border-left: 3px solid var(--oro-chiaro, #E5C585); padding: 10px 12px; border-radius: 8px; font-size: 14px; margin-top: 5px;';
    const strong = creaEl('strong', { testo: `${etichetta}: ` });
    strong.style.color = 'var(--oro-chiaro, #E5C585)';
    const p = creaEl('p', { testo: testo });
    p.style.cssText = 'margin: 5px 0 0 0; color: #FFF;';
    box.appendChild(strong);
    box.appendChild(p);
    if (data) {
      const small = creaEl('span', { testo: formattaData(data) });
      small.style.cssText = 'display:block; font-size:11px; opacity:.6; margin-top:4px;';
      box.appendChild(small);
    }
    return box;
  }

  function creaCardMessaggio(msg, datiUtente) {
    const cardMsg = creaEl('div');
    cardMsg.style.cssText = 'background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(240, 217, 174, 0.2); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px;';

    const isRisposto = msg.stato === 'risposto' || !!msg.risposta;
    const statoColore = isRisposto ? '#A3E4D7' : '#F9E79F';
    const statoTesto = isRisposto ? 'Risposto' : 'In attesa di risposta';
    const puoEliminare = datiUtente.ruolo === 'editor' || msg.user_email === datiUtente.email;

    const riga = creaEl('div');
    riga.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 12px; opacity: 0.8; flex-wrap: wrap; gap: 6px;';
    const spanDa = creaEl('span');
    spanDa.append('Da: ', creaEl('strong', { testo: msg.user_name || 'Utente' }), ` (${msg.user_email})`);
    const azioni = creaEl('div');
    azioni.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    const badgeStato = creaEl('span', { testo: statoTesto });
    badgeStato.style.cssText = `background: rgba(0,0,0,0.2); padding: 3px 8px; border-radius: 6px; color: ${statoColore}; font-weight: 600;`;
    azioni.appendChild(badgeStato);
    if (puoEliminare) {
      const btnElimina = creaEl('button', { testo: datiUtente.ruolo === 'editor' && isRisposto ? 'Elimina solo per me' : 'Elimina' });
      btnElimina.type = 'button';
      btnElimina.className = 'btn-elimina-domanda';
      btnElimina.dataset.id = msg.id;
      btnElimina.style.cssText = 'background: #c0392b; color: #fff; border: none; padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;';
      azioni.appendChild(btnElimina);
    }
    riga.appendChild(spanDa);
    riga.appendChild(azioni);
    cardMsg.appendChild(riga);

    const domandaEl = creaEl('div', { testo: `Domanda: ${msg.domanda}` });
    domandaEl.style.cssText = 'font-size: 14.5px; font-weight: 600; color: #FFF;';
    cardMsg.appendChild(domandaEl);

    if (msg.conversazione && msg.conversazione.length > 0) {
      msg.conversazione.forEach(c => {
        const etichetta = c.autoreNome ? `Risposta di ${c.autoreNome}` : 'Risposta';
        cardMsg.appendChild(creaRigaReplica(etichetta, c.testo, c.data));
      });
    } else if (isRisposto && msg.risposta) {
      cardMsg.appendChild(creaRigaReplica('Risposta', msg.risposta));
    }

    const boxReplica = creaEl('div');
    boxReplica.style.cssText = 'margin-top: 8px; display: flex; gap: 8px;';
    const input = creaEl('input');
    input.type = 'text';
    input.className = 'input-replica';
    input.placeholder = 'Scrivi una replica...';
    input.style.cssText = 'flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(240,217,174,0.3); background: rgba(255,255,255,0.05); color: #FFF; font-size: 13px; outline: none;';
    const btnInvia = creaEl('button', { testo: 'Invia' });
    btnInvia.type = 'button';
    btnInvia.className = 'btn-invia-replica';
    btnInvia.dataset.id = msg.id;
    btnInvia.style.cssText = 'background: var(--oro-chiaro, #E5C585); color: var(--verde-scuro, #1F4C34); border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;';
    boxReplica.appendChild(input);
    boxReplica.appendChild(btnInvia);
    cardMsg.appendChild(boxReplica);

    return cardMsg;
  }

  async function caricaMessaggi(token, datiUtente) {
    try {
      const res = await fetch(`${API}/messaggi`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { localStorage.clear(); await aggiornaStatoMessaggi(); return; }
      if (!res.ok) return;
      let messaggi = await res.json();

      listaMessaggiUtente.innerHTML = '';

      if (criterioOrdinamentoCorrente === 'recenti') {
        messaggi.sort((a, b) => new Date(b.creato_il || b.id || 0) - new Date(a.creato_il || a.id || 0));
      } else {
        messaggi.sort((a, b) => {
          const aInAttesa = a.stato === 'in_attesa' || !a.risposta;
          const bInAttesa = b.stato === 'in_attesa' || !b.risposta;
          if (aInAttesa && !bInAttesa) return -1;
          if (!aInAttesa && bInAttesa) return 1;
          return new Date(b.creato_il || b.id || 0) - new Date(a.creato_il || a.id || 0);
        });
      }

      if (messaggi.length === 0) {
        const vuoto = creaEl('p', { testo: 'Nessun messaggio presente.' });
        vuoto.style.cssText = 'font-size: 14px; opacity: 0.8; font-style: italic;';
        listaMessaggiUtente.appendChild(vuoto);
        aggiungiSelettoreOrdinamento();
        return;
      }

      aggiungiSelettoreOrdinamento();
      messaggi.forEach(msg => listaMessaggiUtente.appendChild(creaCardMessaggio(msg, datiUtente)));
      attivaAzioniMessaggi(token, datiUtente);
    } catch (err) {
      console.error('Errore caricamento messaggi:', err);
    }
  }

  function aggiungiSelettoreOrdinamento() {
    let select = document.getElementById('selectOrdine');
    if (select) {
      select.value = criterioOrdinamentoCorrente;
      select.onchange = (e) => { criterioOrdinamentoCorrente = e.target.value; aggiornaStatoMessaggi(); };
    }
  }

  function attivaAzioniMessaggi(token, datiUtente) {
    document.querySelectorAll('.btn-invia-replica').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const btnElement = e.currentTarget;
        const msgId = btnElement.getAttribute('data-id');
        const input = btnElement.previousElementSibling;
        const testo = input.value;

        if (!testo.trim()) { mostraAvviso('Scrivi un messaggio valido.'); return; }

        btnElement.disabled = true;
        try {
          const res = await fetch(`${API}/messaggi/${msgId}/rispondi`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ risposta: testo })
          });
          if (res.ok) { input.value = ''; aggiornaStatoMessaggi(); }
          else { const data = await res.json(); mostraAvviso(data.errore || 'Errore durante l\'invio.'); }
        } catch (err) {
          console.error(err);
          mostraAvviso('Errore di connessione.');
        } finally {
          btnElement.disabled = false;
        }
      });
    });

    document.querySelectorAll('.btn-elimina-domanda').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const msgId = e.currentTarget.getAttribute('data-id');
        if (!confirm('Confermi l\'azione?')) return;

        try {
          const res = await fetch(`${API}/messaggi/${msgId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) aggiornaStatoMessaggi();
          else { const data = await res.json(); mostraAvviso(data.errore || 'Impossibile completare l\'operazione.'); }
        } catch (err) {
          console.error(err);
          mostraAvviso('Errore di rete.');
        }
      });
    });
  }

  function mostraAvviso(testo) {
    if (typeof window.mostraMessaggioTema === 'function') window.mostraMessaggioTema(testo);
    else alert(testo);
  }

  aggiornaStatoMessaggi();
  window.addEventListener('storage', () => aggiornaStatoMessaggi());

  if (formFaq) {
    formFaq.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = localStorage.getItem('token');
      const textarea = formFaq.querySelector('textarea');
      const testoDomanda = textarea.value;
      const btnInvia = formFaq.querySelector('button[type="submit"]');

      btnInvia.disabled = true;
      try {
        const res = await fetch(`${API}/messaggi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ domanda: testoDomanda })
        });

        if (res.ok) {
          mostraAvviso('Domanda inviata con successo! La Dott.ssa Genny Ferrara ti risponderà presto.');
          formFaq.reset();
          aggiornaStatoMessaggi();
        } else {
          const data = await res.json();
          mostraAvviso(data.errore || 'Errore durante l\'invio.');
        }
      } catch (err) {
        console.error(err);
        mostraAvviso('Errore di rete.');
      } finally {
        btnInvia.disabled = false;
      }
    });
  }

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
