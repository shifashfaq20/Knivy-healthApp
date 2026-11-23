import type { IconName } from '../../components/ui/Icon';
import type { MeasurementType } from '../../types/models';
import { height, temperature, weight, type UnitPrefs } from '../../utils/units';

export interface MeasurementDef {
  type: MeasurementType;
  label: string;
  icon: IconName;
  /** Valid range in canonical units, used for validation. */
  min: number;
  max: number;
  decimals: number;
  unit: (u: UnitPrefs) => string;
  toDisplay: (v: number, u: UnitPrefs) => number;
  fromDisplay: (v: number, u: UnitPrefs) => number;
  hint?: string;
  twoValues?: boolean;
}

const identity = (v: number) => v;

export const MEASUREMENTS: Record<MeasurementType, MeasurementDef> = {
  heart_rate: {
    type: 'heart_rate',
    label: 'Heart rate',
    icon: 'pulse-outline',
    min: 25,
    max: 250,
    decimals: 0,
    unit: () => 'bpm',
    toDisplay: identity,
    fromDisplay: identity,
    hint: 'From a watch, chest strap or a manual pulse count.',
  },
  resting_heart_rate: {
    type: 'resting_heart_rate',
    label: 'Resting heart rate',
    icon: 'heart-outline',
    min: 25,
    max: 200,
    decimals: 0,
    unit: () => 'bpm',
    toDisplay: identity,
    fromDisplay: identity,
    hint: 'Best measured after waking, before getting up.',
  },
  blood_pressure: {
    type: 'blood_pressure',
    label: 'Blood pressure',
    icon: 'speedometer-outline',
    min: 50,
    max: 260,
    decimals: 0,
    unit: () => 'mmHg',
    toDisplay: identity,
    fromDisplay: identity,
    twoValues: true,
    hint: 'Your phone can’t measure this. Use a validated cuff.',
  },
  spo2: {
    type: 'spo2',
    label: 'Blood oxygen',
    icon: 'water-outline',
    min: 50,
    max: 100,
    decimals: 0,
    unit: () => '%',
    toDisplay: identity,
    fromDisplay: identity,
    hint: 'From a pulse oximeter or compatible watch.',
  },
  temperature: {
    type: 'temperature',
    label: 'Body temperature',
    icon: 'thermometer-outline',
    min: 30,
    max: 45,
    decimals: 1,
    unit: (u) => temperature.unit(u),
    toDisplay: (v, u) => temperature.toDisplay(v, u),
    fromDisplay: (v, u) => temperature.fromDisplay(v, u),
    hint: 'Your phone can’t measure this. Use a thermometer.',
  },
  weight: {
    type: 'weight',
    label: 'Weight',
    icon: 'scale-outline',
    min: 20,
    max: 400,
    decimals: 1,
    unit: (u) => weight.unit(u),
    toDisplay: (v, u) => weight.toDisplay(v, u),
    fromDisplay: (v, u) => weight.fromDisplay(v, u),
  },
  height: {
    type: 'height',
    label: 'Height',
    icon: 'resize-outline',
    min: 50,
    max: 250,
    decimals: 0,
    unit: (u) => height.unit(u),
    toDisplay: (v, u) => height.toDisplay(v, u),
    fromDisplay: (v, u) => height.fromDisplay(v, u),
  },
  steps: {
    type: 'steps',
    label: 'Steps',
    icon: 'footsteps-outline',
    min: 1,
    max: 150000,
    decimals: 0,
    unit: () => 'steps',
    toDisplay: identity,
    fromDisplay: identity,
    hint: 'Add steps from a pedometer or another app.',
  },
};

export const VITAL_TYPES: MeasurementType[] = ['heart_rate', 'resting_heart_rate', 'blood_pressure', 'spo2', 'temperature', 'weight', 'height'];

export function formatMeasurement(type: MeasurementType, value: number, value2: number | null | undefined, u: UnitPrefs) {
  const def = MEASUREMENTS[type];
  if (type === 'blood_pressure') return `${Math.round(value)}/${Math.round(value2 ?? 0)} mmHg`;
  if (type === 'height') return height.format(value, u);
  const shown = def.toDisplay(value, u);
  return `${shown.toLocaleString(undefined, { maximumFractionDigits: def.decimals })} ${def.unit(u)}`;
}

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** WHO adult categories. Shown as general information only. */
export function bmiCategory(value: number) {
  if (value < 18.5) return 'Below the healthy range';
  if (value < 25) return 'Within the healthy range';
  if (value < 30) return 'Above the healthy range';
  return 'Well above the healthy range';
}

/** Accepted range for a measurement, in the user's display units (for validation messages). */
export function displayRange(type: MeasurementType, u: UnitPrefs) {
  const d = MEASUREMENTS[type];
  const f = 10 ** d.decimals;
  return { min: Math.ceil(d.toDisplay(d.min, u) * f) / f, max: Math.floor(d.toDisplay(d.max, u) * f) / f, unit: d.unit(u) };
}
