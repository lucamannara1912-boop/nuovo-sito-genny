'use strict';

const dashboard = document.getElementById('dashboard');
const tastoScorri = document.getElementById('tastoScorri');

const widgetLogin = document.getElementById('widgetLogin');
const loginSi = document.getElementById('loginSi');
const overlayLogin = document.getElementById('overlayLogin');
const chiudiLogin = document.getElementById('chiudiLogin');
const tabBtns = document.querySelectorAll('.tab-btn');

const formAccedi = document.getElementById('formAccedi');
const formRegistrati = document.getElementById('formRegistrati');

const loginContenutoNonLoggato = document.getElementById('loginContenutoNonLoggato');
const loginContenutoLoggato = document.getElementById('loginContenutoLoggato');
const loginIconaContainer = document.getElementById('loginIconaContainer');
const badgeIniziali = document.getElementById('badgeIniziali');
const profiloNome = document.getElementById('profiloNome');
const profiloRuolo = document.getElementById('profiloRuolo');
const profiloAvatar = document.getElementById('profiloAvatar');
const btnLogout = document.getElementById('btnLogout');

// Indirizzo del backend: stessa origine del sito (funziona sia in locale che online)
const API = `${window.location.origin}/api`;

// Mostra messaggi a tema grafico anziché gli alert nativi del browser.
// Il callback viene salvato su una variabile "viva" (overlay._callback) e letto
// al momento della chiusura: così ogni chiamata usa il callback giusto, anche se
// l'overlay era già stato creato in precedenza da un altro messaggio.
function mostraMessaggioTema(testo, callbackAzione = null) {
  let overlay = document.getElementById('overlayMessaggioCustom');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlayMessaggioCustom';
    overlay.className = 'overlay-messaggio-personalizzato';
    overlay.innerHTML = `
      <div class="scheda-messaggio-personalizzato">
        <p class="testo-messaggio-personalizzato" id="testoMessaggioCustom"></p>
        <button type="button" class="btn-chiudi-messaggio" id="btnChiudiMsgCustom">Capito</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const chiudi = () => {
      overlay.classList.remove('visibile');
      const cb = overlay._callback;
      overlay._callback = null;
      if (typeof cb === 'function') cb();
    };
    overlay.querySelector('#btnChiudiMsgCustom').addEventListener('click', chiudi);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudi(); });
  }

  overlay._callback = callbackAzione;
  document.getElementById('testoMessaggioCustom').textContent = testo;
  overlay.classList.add('visibile');
}

if (tastoScorri && dashboard) {
  tastoScorri.addEventListener('click', () => {
    dashboard.classList.toggle('nascosta');
    document.body.classList.toggle('dashboard-chiusa');
  });
}

if (loginSi) {
  loginSi.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (overlayLogin) overlayLogin.classList.add('visibile');
    if (widgetLogin) widgetLogin.classList.remove('aperto');
  });
}

if (chiudiLogin) {
  chiudiLogin.addEventListener('click', () => {
    if (overlayLogin) overlayLogin.classList.remove('visibile');
  });
}

if (overlayLogin) {
  overlayLogin.addEventListener('click', (e) => {
    if (e.target === overlayLogin) overlayLogin.classList.remove('visibile');
  });
}

if (tabBtns.length > 0) {
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('attivo'));
      btn.classList.add('attivo');
      const tab = btn.dataset.tab;
      if (formAccedi && formRegistrati) {
        if (tab === 'accedi') {
          formAccedi.classList.add('is-attivo');
          formRegistrati.classList.remove('is-attivo');
        } else {
          formAccedi.classList.remove('is-attivo');
          formRegistrati.classList.add('is-attivo');
        }
      }
    });
  });
}

document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const inputPass = document.getElementById(targetId);
    if (!inputPass) return;
    if (inputPass.type === 'password') {
      inputPass.type = 'text';
      btn.textContent = '🔒';
    } else {
      inputPass.type = 'password';
      btn.textContent = '👁️';
    }
  });
});

function impostaCaricamento(bottone, inCorso, testoNormale) {
  if (!bottone) return;
  bottone.disabled = inCorso;
  bottone.textContent = inCorso ? 'Attendere...' : testoNormale;
}

// ---------- LOGIN ----------
if (formAccedi) {
  formAccedi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dati = Object.fromEntries(new FormData(formAccedi));
    const bottone = formAccedi.querySelector('button[type="submit"]');
    impostaCaricamento(bottone, true, 'Accedi');

    try {
      const risposta = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dati)
      });
      const risultato = await risposta.json();

      if (!risposta.ok) {
        mostraMessaggioTema(risultato.errore || 'Credenziali non valide o email non verificata.');
        return;
      }

      localStorage.setItem('token', risultato.token);
      localStorage.setItem('nome', risultato.nome);
      localStorage.setItem('cognome', risultato.cognome);
      localStorage.setItem('email', risultato.email);
      localStorage.setItem('ruolo', risultato.ruolo);
      localStorage.setItem('titolo', risultato.titolo);

      formAccedi.reset();
      if (overlayLogin) overlayLogin.classList.remove('visibile');
      aggiornaStatoAccesso();

      mostraMessaggioTema(`Benvenuta/o, ${risultato.nome}! Accesso effettuato con successo.`, () => {
        window.location.reload();
      });
    } catch (errore) {
      console.error('Errore:', errore);
      mostraMessaggioTema('Impossibile contattare il server. Controlla la connessione e riprova.');
    } finally {
      impostaCaricamento(bottone, false, 'Accedi');
    }
  });
}

// ---------- REGISTRAZIONE ----------
if (formRegistrati) {
  formRegistrati.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dati = Object.fromEntries(new FormData(formRegistrati));

    if (dati.conferma !== undefined && dati.password !== dati.conferma) {
      mostraMessaggioTema('Le password non coincidono.');
      return;
    }
    if (dati.password && dati.password.length < 8) {
      mostraMessaggioTema('La password deve avere almeno 8 caratteri.');
      return;
    }

    const bottone = formRegistrati.querySelector('button[type="submit"]');
    impostaCaricamento(bottone, true, 'Registrati');

    try {
      const risposta = await fetch(`${API}/auth/registrati`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: dati.nome,
          cognome: dati.cognome,
          email: dati.email,
          password: dati.password
        })
      });
      const risultato = await risposta.json();

      if (!risposta.ok) {
        mostraMessaggioTema(risultato.errore || 'Errore durante la registrazione.');
        return;
      }

      mostraMessaggioTema(risultato.messaggio || 'Registrazione completata! Controlla la tua email per attivare l\'account.');
      formRegistrati.reset();

      formRegistrati.classList.remove('is-attivo');
      if (formAccedi) formAccedi.classList.add('is-attivo');
      tabBtns.forEach((btn) => btn.classList.toggle('attivo', btn.dataset.tab === 'accedi'));
    } catch (errore) {
      console.error('Errore:', errore);
      mostraMessaggioTema('Impossibile contattare il server. Controlla la connessione e riprova.');
    } finally {
      impostaCaricamento(bottone, false, 'Registrati');
    }
  });
}

// ---------- STATO ACCESSO (widget in basso) ----------
function aggiornaStatoAccesso() {
  const token = localStorage.getItem('token');
  const nome = localStorage.getItem('nome') || 'Utente';
  const cognome = localStorage.getItem('cognome') || '';
  const titolo = localStorage.getItem('titolo') || 'Visitatore';

  if (token) {
    if (loginContenutoNonLoggato) loginContenutoNonLoggato.setAttribute('hidden', 'true');
    if (loginContenutoLoggato) loginContenutoLoggato.removeAttribute('hidden');

    const iniziali = `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase() || 'U';
    if (badgeIniziali) { badgeIniziali.textContent = iniziali; badgeIniziali.removeAttribute('hidden'); }
    const svgIcon = loginIconaContainer ? loginIconaContainer.querySelector('svg') : null;
    if (svgIcon) svgIcon.setAttribute('hidden', 'true');

    if (profiloNome) profiloNome.textContent = `${nome} ${cognome}`.trim();
    if (profiloRuolo) profiloRuolo.textContent = titolo;
    if (profiloAvatar) profiloAvatar.textContent = iniziali;
  } else {
    if (loginContenutoLoggato) loginContenutoLoggato.setAttribute('hidden', 'true');
    if (loginContenutoNonLoggato) loginContenutoNonLoggato.removeAttribute('hidden');
    if (badgeIniziali) badgeIniziali.setAttribute('hidden', 'true');
    const svgIcon = loginIconaContainer ? loginIconaContainer.querySelector('svg') : null;
    if (svgIcon) svgIcon.removeAttribute('hidden');
  }
}
aggiornaStatoAccesso();

if (btnLogout) {
  btnLogout.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.clear();
    aggiornaStatoAccesso();
    if (widgetLogin) widgetLogin.classList.remove('aperto');
    mostraMessaggioTema('Logout effettuato con successo.', () => window.location.reload());
  });
}

if (widgetLogin) {
  widgetLogin.addEventListener('click', (e) => {
    if (e.target.closest('#loginSi') || e.target.closest('#btnLogout')) return;
    widgetLogin.classList.toggle('aperto');
  });
}

document.addEventListener('click', (e) => {
  if (widgetLogin && !widgetLogin.contains(e.target)) widgetLogin.classList.remove('aperto');
});

// ---------- SCORRIMENTO 3 FOTO (solo home) ----------
const btnScorriFoto = document.getElementById('btnScorriFoto');
const fotoCards = document.querySelectorAll('.foto-card');

if (btnScorriFoto && fotoCards.length === 3) {
  let posizioni = ['pos-centro', 'pos-destra', 'pos-sinistra'];
  const ruotaFoto = () => {
    posizioni.unshift(posizioni.pop());
    fotoCards.forEach((card, index) => { card.className = `cornice-foto foto-card ${posizioni[index]}`; });
  };
  btnScorriFoto.addEventListener('click', ruotaFoto);
  fotoCards.forEach((card) => {
    card.addEventListener('click', () => { if (!card.classList.contains('pos-centro')) ruotaFoto(); });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const elementiDaAnimare = document.querySelectorAll('.anim-foto, .anim-titolo, .anim-sottotitolo, .anim-blocco');
  setTimeout(() => elementiDaAnimare.forEach((elemento) => elemento.classList.add('attiva')), 150);
});

document.addEventListener('DOMContentLoaded', () => {
  const elementiOsservati = document.querySelectorAll('.card-metodo, .card-scopri, .footer-spettacolare');
  if (elementiOsservati.length === 0) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        const ritardo = (index % 4) * 120;
        setTimeout(() => entry.target.classList.add('visibile'), ritardo);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  elementiOsservati.forEach((elemento) => observer.observe(elemento));
});

/* ---------- FOGLIE BOTANICHE SFONDO DINAMICHE ---------- */
(function particelleBotaniche() {
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
})();

document.addEventListener('DOMContentLoaded', () => {
  const paginaCorrente = window.location.pathname.split('/').pop() || 'home.html';
  document.querySelectorAll('.nav-lista .nav-voce').forEach(voce => {
    voce.classList.remove('attivo');
    const link = voce.querySelector('a');
    if (link && link.getAttribute('href') === paginaCorrente) voce.classList.add('attivo');
  });
});
