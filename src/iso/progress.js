// Contador de downloads (para a barra da tela de carregamento).
export const progress = { total: 0, done: 0 };
export function track(p) { progress.total++; return p.finally(() => { progress.done++; }); }
