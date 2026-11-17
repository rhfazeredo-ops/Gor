// Busca um arquivo binário. Onde a hospedagem não aceita a extensão (página
// do Claude), o mesmo arquivo pode vir como <arquivo>.b64.json (base64).
export async function fetchBin(url) {
  const res = await fetch(url).catch(() => null);
  if (res && res.ok && !(res.headers.get('content-type') || '').includes('text/html')) return res.arrayBuffer();
  const alt = await fetch(url + '.b64.json').catch(() => null);
  if (!alt || !alt.ok) return new ArrayBuffer(0);
  const b64 = await alt.json();
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
