// Missões do quadro da taverna. Cada papel abre um mapa (índice em ROOMS) com um objetivo.
// Para criar uma missão nova: arte do papel em src/assets/lobby/<papel>.webp + uma entrada aqui.
export const MISSIONS = [
  { id: 'plantas', papel: 'missao-plantas', mapa: 0, nome: 'Plantas raras do Desfiladeiro',
    objetivo: { tipo: 'coletar', alvo: 10, texto: 'Colete 10 plantas raras' } },
];
