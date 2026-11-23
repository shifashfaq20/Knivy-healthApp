export interface UnitPrefs {
  weight: 'kg' | 'lb';
  distance: 'km' | 'mi';
  height: 'cm' | 'ftin';
  temperature: 'c' | 'f';
  volume: 'ml' | 'oz';
}

export const DEFAULT_UNITS: UnitPrefs = { weight: 'kg', distance: 'km', height: 'cm', temperature: 'c', volume: 'ml' };

const KG_PER_LB = 0.45359237;
const KM_PER_MI = 1.609344;
const ML_PER_OZ = 29.5735;

export function num(n: number, maxDigits = 1) {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxDigits });
}

export const weight = {
  toDisplay: (kg: number, u: UnitPrefs) => (u.weight === 'lb' ? kg / KG_PER_LB : kg),
  fromDisplay: (v: number, u: UnitPrefs) => (u.weight === 'lb' ? v * KG_PER_LB : v),
  unit: (u: UnitPrefs) => u.weight,
  format: (kg: number, u: UnitPrefs) => `${num(weight.toDisplay(kg, u))} ${u.weight}`,
};

export const distance = {
  toDisplay: (km: number, u: UnitPrefs) => (u.distance === 'mi' ? km / KM_PER_MI : km),
  fromDisplay: (v: number, u: UnitPrefs) => (u.distance === 'mi' ? v * KM_PER_MI : v),
  unit: (u: UnitPrefs) => u.distance,
  format: (km: number, u: UnitPrefs) => `${num(distance.toDisplay(km, u), 2)} ${u.distance}`,
};

export const volume = {
  toDisplay: (ml: number, u: UnitPrefs) => (u.volume === 'oz' ? ml / ML_PER_OZ : ml),
  fromDisplay: (v: number, u: UnitPrefs) => (u.volume === 'oz' ? v * ML_PER_OZ : v),
  unit: (u: UnitPrefs) => (u.volume === 'oz' ? 'fl oz' : 'ml'),
  format: (ml: number, u: UnitPrefs) =>
    u.volume === 'oz' ? `${num(ml / ML_PER_OZ, 1)} fl oz` : ml >= 1000 ? `${num(ml / 1000, 2)} L` : `${Math.round(ml)} ml`,
};

export const temperature = {
  toDisplay: (c: number, u: UnitPrefs) => (u.temperature === 'f' ? (c * 9) / 5 + 32 : c),
  fromDisplay: (v: number, u: UnitPrefs) => (u.temperature === 'f' ? ((v - 32) * 5) / 9 : v),
  unit: (u: UnitPrefs) => (u.temperature === 'f' ? '°F' : '°C'),
  format: (c: number, u: UnitPrefs) => `${num(temperature.toDisplay(c, u), 1)} ${temperature.unit(u)}`,
};

export const height = {
  /** In ft/in mode the editable number is total inches. */
  toDisplay: (cm: number, u: UnitPrefs) => (u.height === 'ftin' ? cm / 2.54 : cm),
  fromDisplay: (v: number, u: UnitPrefs) => (u.height === 'ftin' ? v * 2.54 : v),
  unit: (u: UnitPrefs) => (u.height === 'ftin' ? 'in' : 'cm'),
  format: (cm: number, u: UnitPrefs) => {
    if (u.height === 'cm') return `${Math.round(cm)} cm`;
    const totalIn = Math.round(cm / 2.54);
    return `${Math.floor(totalIn / 12)} ft ${totalIn % 12} in`;
  },
};

/** Parses user input like "72,5" or "72.5". Returns null for empty/invalid input. */
export function parseNumber(input: string): number | null {
  const cleaned = input.replace(',', '.').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
