// Local, conservative checks that run before any AI call (and even when AI is unavailable).
// They don't diagnose anything; they surface emergency guidance when wording suggests urgency.

const MEDICAL = [
  /chest (pain|pressure|tightness)/i,
  /(can'?t|cannot|unable to|hard to|struggling to) breathe/i,
  /short(ness)? of breath/i,
  /face (is )?droop/i,
  /slurred speech/i,
  /(stroke|heart attack|seizure|unconscious|fainted|passed out)/i,
  /(severe|heavy|won'?t stop) bleeding/i,
  /(throat|tongue|lips?) (is |are )?swell/i,
  /anaphyla/i,
  /overdos/i,
  /poison(ed|ing)/i,
];

const CRISIS = [/suicid/i, /kill (myself|me)/i, /end (my|it all|my life)/i, /self[- ]?harm/i, /hurt(ing)? myself/i, /want to die/i];

export type SafetyFlag = { kind: 'medical' | 'crisis' } | null;

export function checkSafety(text: string): SafetyFlag {
  if (CRISIS.some((r) => r.test(text))) return { kind: 'crisis' };
  if (MEDICAL.some((r) => r.test(text))) return { kind: 'medical' };
  return null;
}

export const EMERGENCY_COPY = {
  medical:
    'This could be urgent. Call your local emergency number now (for example 1122 in Pakistan, 911 in the US, 112 in the EU, 999 in the UK) or go to the nearest emergency department. Knivy can’t assess emergencies.',
  crisis:
    'You don’t have to go through this alone. If you might act on these thoughts, call your local emergency number now. You can also reach a crisis line in your country — findahelpline.com lists free, confidential services worldwide.',
};
