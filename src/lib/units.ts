// Units a product can be sold in. Shared by the web and Android product forms and the Excel import.
// scale 1000 = sold with 3 decimals (stored in grams / millilitres / millimetres).
export const UNITS: { code: string; label: string; scale: 1 | 1000 }[] = [
  { code: "pcs", label: "Pieces (pcs)", scale: 1 },
  { code: "box", label: "Box", scale: 1 },
  { code: "pack", label: "Pack", scale: 1 },
  { code: "pair", label: "Pair", scale: 1 },
  { code: "dozen", label: "Dozen", scale: 1 },
  { code: "set", label: "Set", scale: 1 },
  { code: "bottle", label: "Bottle", scale: 1 },
  { code: "strip", label: "Strip", scale: 1 },
  { code: "kg", label: "Kilogram (kg, 3 decimals)", scale: 1000 },
  { code: "l", label: "Litre (l, 3 decimals)", scale: 1000 },
  { code: "m", label: "Metre (m, 3 decimals)", scale: 1000 },
];

export const unitScale = (code: string): 1 | 1000 => UNITS.find((u) => u.code === code)?.scale ?? 1;
