// mailer.js — invio email di verifica.
// Modalità 1: Brevo via HTTPS (BREVO_API_KEY)  -> funziona ovunque, anche dove SMTP è bloccato
// Modalità 2: SMTP con nodemailer (SMTP_USER + SMTP_PASS)
// Modalità 3: solo sviluppo -> stampa il link in console
const { PRODUCTION } = require('./config');

const outbox = []; // usata solo dai test automatici

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function inviaMail({ to, subject, html, text }) {
  if (process.env.NODE_ENV === 'test') {
    outbox.push({ to, subject, html, text });
    return { modalita: 'test' };
  }

  if (process.env.BREVO_API_KEY) {
    const mittente = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
    if (!mittente) throw new Error('MAIL_FROM_EMAIL mancante');
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || 'Dott.ssa Genny Ferrara', email: mittente },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text
      })
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
    return { modalita: 'brevo' };
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || 'Dott.ssa Genny Ferrara'}" <${process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER}>`,
      to, subject, html, text
    });
    return { modalita: 'smtp' };
  }

  if (PRODUCTION) throw new Error('Email non configurata (imposta BREVO_API_KEY oppure SMTP_USER/SMTP_PASS).');
  console.log(`\n[EMAIL NON CONFIGURATA - modalità sviluppo]\nA: ${to}\n${subject}\n${text}\n`);
  return { modalita: 'console' };
}

async function inviaEmailVerifica(email, nome, link) {
  const text = `Ciao ${nome},\nper attivare il tuo account apri questo link (valido 24 ore):\n${link}\n\nSe non sei stato tu, ignora questa email.`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #E5C585;border-radius:16px;background:#FFFCF7;color:#1F4C34">
    <h2 style="margin-top:0">Benvenuto/a, ${esc(nome)}!</h2>
    <p>Grazie per esserti registrato/a sul sito della <strong>Dott.ssa Genny Ferrara</strong>.<br>Conferma il tuo indirizzo email per attivare l'account:</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${esc(link)}" style="background:#1F4C34;color:#fff;padding:14px 26px;border-radius:12px;text-decoration:none;font-weight:bold">Verifica la mia email</a>
    </p>
    <p style="font-size:13px;opacity:.8">Il link è valido 24 ore. Se il pulsante non funziona copia questo indirizzo nel browser:<br>${esc(link)}</p>
    <p style="font-size:12px;opacity:.7">Se non hai richiesto tu la registrazione, ignora questa email.</p>
  </div>`;
  return inviaMail({ to: email, subject: 'Conferma la tua email — Dott.ssa Genny Ferrara', html, text });
}

module.exports = { inviaMail, inviaEmailVerifica, outbox };
