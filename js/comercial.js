import { db, collection, addDoc, serverTimestamp } from './firebase.js';
import { onlyDigits } from './ui.js';

export function referralCode(){ return new URLSearchParams(location.search).get('ref') || localStorage.getItem('fretehub_ref') || ''; }
export function captureReferral(){ const ref = new URLSearchParams(location.search).get('ref'); if(ref) localStorage.setItem('fretehub_ref', ref); }
export async function registrarContato({tipo='whatsapp', freteId='', codigo='', origem='', destinoTelefone='', mensagem=''}){
  try { await addDoc(collection(db,'contatos'), { tipo, freteId, codigo, origem, destinoTelefone: onlyDigits(destinoTelefone), mensagem, createdAt: serverTimestamp() }); } catch(e){ console.warn('registro de contato', e); }
}
export function abrirWhatsAppRegistrando(phone, text, meta={}){
  registrarContato({ ...meta, tipo:'whatsapp', destinoTelefone: phone, mensagem: text });
  window.open(`https://wa.me/55${onlyDigits(phone)}?text=${encodeURIComponent(text)}`, '_blank');
}
export function csvDownload(filename, rows){
  const arr = Array.isArray(rows) ? rows : [];
  if(!arr.length) return alert('Nenhum dado para exportar.');
  const headers = Object.keys(arr[0]);
  const esc = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const csv = [headers.join(';'), ...arr.map(r => headers.map(h => esc(r[h])).join(';'))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
export function jsonDownload(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
