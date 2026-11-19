// Missões do quadro da taverna. Cada papel abre um mapa (índice em ROOMS) com um objetivo.
// Para criar uma missão nova: arte do papel em src/assets/lobby/<papel>.webp + uma entrada aqui.
//   plantas: quantas plantas raras coletáveis aparecem (0 = nenhuma)
//   inimigos: quantos escorpiões ficam no mapa desde o início (não renascem)
// As duas são do deserto: mapa 0 = Cânion, mapa 1 = Ninho (mesmas peças, estrutura diferente).
export const MISSIONS = [
  { id: 'plantas', papel: 'missao-plantas', mapa: 0, nome: 'Plantas raras do Desfiladeiro', plantas: 14, inimigos: 0,
    objetivo: { tipo: 'coletar', alvo: 10, texto: 'Colete 10 plantas raras' } },
  { id: 'escorpioes', papel: 'missao-escorpioes', mapa: 1, nome: 'Praga de escorpiões', plantas: 0, inimigos: 20,
    objetivo: { tipo: 'matar', alvo: 20, texto: 'Mate 20 escorpiões' } },
];
