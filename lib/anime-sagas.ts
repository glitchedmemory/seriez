export interface AnimeSaga {
  name: string;
  start: number;
  end: number;
}

export const ONE_PIECE_SAGAS: AnimeSaga[] = [
  { name: "East Blue", start: 1, end: 61 },
  { name: "Alabasta", start: 62, end: 135 },
  { name: "Sky Island", start: 136, end: 206 },
  { name: "Water 7", start: 207, end: 325 },
  { name: "Thriller Bark", start: 326, end: 384 },
  { name: "Summit War", start: 385, end: 516 },
  { name: "Fish-Man Island", start: 517, end: 574 },
  { name: "Dressrosa", start: 575, end: 746 },
  { name: "Whole Cake Island", start: 747, end: 889 },
  { name: "Wano Country", start: 890, end: 1085 },
  { name: "Final Saga", start: 1086, end: 9999 },
];

export function getAnimeSagas(anilistId: number): AnimeSaga[] | null {
  if (anilistId === 21) return ONE_PIECE_SAGAS;
  return null;
}
