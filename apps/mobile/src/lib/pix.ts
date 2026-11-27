// Pix "copia e cola" com valor (BR Code estático, padrão do Banco Central), sem processador de pagamentos.

const field = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no campo 63. */
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Texto sem acento e só com caracteres aceitos pelos bancos. */
const plain = (s: string, max: number) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9 .\-]/g, '').trim().slice(0, max).toUpperCase();

function validCpf(d: string) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Normaliza a chave como o banco espera: e-mail, CPF, CNPJ, telefone (+55…) ou chave aleatória. */
export function normalizeKey(raw: string) {
  const k = raw.trim();
  if (k.includes('@')) return k.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
  const d = k.replace(/\D/g, '');
  if (k.startsWith('+')) return '+' + d;
  if (d.length === 14) return d; // CNPJ
  if (d.length === 11 && validCpf(d)) return d; // CPF
  if (d.length === 10 || d.length === 11) return '+55' + d; // celular/fixo com DDD
  if (d.length === 12 || d.length === 13) return '+' + d;
  return k;
}

/** Monta o Pix copia e cola. `txid`: até 25 letras/números, identifica a contribuição. */
export function pixPayload({ key, name, city, cents, txid }: { key: string; name: string; city: string; cents: number; txid: string }) {
  const account = field('00', 'br.gov.bcb.pix') + field('01', normalizeKey(key));
  const body =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (cents > 0 ? field('54', (cents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', plain(name, 25) || 'IGREJA') +
    field('60', plain(city, 15) || 'BRASIL') +
    field('62', field('05', txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***')) +
    '6304';
  return body + crc16(body);
}

export const newTxid = () => ('APP' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase().slice(0, 25);
