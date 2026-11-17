// Habilidades dos heróis (valores das fichas do Rafael).
// dano: fração do dano de ataque do herói.
export const ABILITIES = {
  dalarian: {
    basico: { nome: 'Ataque Básico', icone: 'dalarian-basico.png', recarga: 0.55, dano: 1.0, alcance: 2.2 },
    q: { nome: 'Consagração do Martelo', icone: 'dalarian-consagracao.png', recarga: 18, duracao: 6, danoPorSeg: 0.2, raio: 3 },
    e: { nome: 'Proteção de Luz', icone: 'dalarian-protecao.png', recarga: 25, duracao: 3 },
    r: null, // 3ª habilidade: a definir
  },
};
