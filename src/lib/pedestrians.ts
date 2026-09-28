export type Appearance = {
  age: 'adult' | 'child' | 'senior';
  gender: 'woman' | 'man';
  skin: number;
  hair: number;
  longHair: boolean;
};

export function pedestrianProfile(gx: number, gz: number, slot: number) {
  const seed = Math.abs(gx * 31 + gz * 17);
  const age: Appearance['age'] = slot === 2 ? 'child' : slot === 3 ? 'senior' : 'adult';
  const gender: Appearance['gender'] = slot === 0 || (slot > 1 && seed % 2 === 0) ? 'woman' : 'man';
  const names = gender === 'woman'
    ? age === 'child' ? ['Maya', 'Lily', 'Tara', 'Zoe'] : ['Priya', 'Aisha', 'Meera', 'Sofia']
    : age === 'child' ? ['Leo', 'Arjun', 'Noah', 'Sam'] : ['Ravi', 'Omar', 'James', 'Daniel'];
  return {
    name: names[(seed + slot) % names.length],
    appearance: { age, gender, skin: (seed + slot) % 4, hair: (seed + slot * 3) % 4, longHair: gender === 'woman' && (seed + slot) % 3 !== 1 } satisfies Appearance,
  };
}

export function pedestrianSpeed(appearance?: Appearance) {
  return appearance?.age === 'senior' ? 1.35 : appearance?.age === 'child' ? 1.8 : 2.1;
}
export function pedestrianScale(appearance?: Appearance) {
  return appearance?.age === 'child' ? 0.68 : appearance?.age === 'senior' ? 0.95 : 1;
}
