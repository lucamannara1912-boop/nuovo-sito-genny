// Chi ha il ruolo "editor" (può gestire ricette, consiglio del giorno e rispondere ai messaggi).
// Il ruolo NON si sceglie dal browser: si ottiene solo con un'email presente in questa lista
// E dopo aver verificato l'email tramite il link ricevuto.
const EDITORS = [
  { email: 'genny.nutrizione@libero.it',   nome: 'Dott.ssa Genny Ferrara', titolo: 'Dottoressa' },
  { email: 'gennyferrara_1998@hotmail.it', nome: 'Dott.ssa Genny Ferrara', titolo: 'Dottoressa' },
  { email: 'lucamannara53@gmail.com',      nome: 'Luca Mannara',           titolo: 'Operatore' },
  { email: 'lucamannara1912@gmail.com',    nome: 'Luca Mannara',           titolo: 'Operatore' }
];

function trovaEditor(email) {
  const e = String(email || '').trim().toLowerCase();
  return EDITORS.find(x => x.email === e) || null;
}
const isEditorEmail = (email) => !!trovaEditor(email);

module.exports = { EDITORS, trovaEditor, isEditorEmail };
