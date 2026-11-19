// Heróis da tela "Heróis" do lobby (5 vagas; as vazias mostram "+").
// Para cada herói novo: rode tools/import-herois.py com a arte dele e acrescente uma entrada aqui.
// stats de 0 a 1 (barras). raca → estandarte-<raca>.webp atrás do herói.
export const HEROIS = [
  { id: 'dalarian', jogavel: 'dalarian', nome: 'Dalarian', classe: 'Paladino', raca: 'humanos',
    desc: 'Guerreiro da fé e da justiça, protege os inocentes, fortalece seus aliados e enfrenta as trevas com determinação inabalável.',
    stats: { ataque: 0.62, defesa: 0.78, vida: 0.64, mobilidade: 0.5 } },
];
