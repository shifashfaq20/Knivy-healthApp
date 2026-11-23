export interface BreathPattern {
  id: string;
  name: string;
  description: string;
  phases: { label: 'Breathe in' | 'Hold' | 'Breathe out'; seconds: number }[];
}

export const BREATH_PATTERNS: BreathPattern[] = [
  {
    id: 'box',
    name: 'Box breathing',
    description: 'Four equal counts. Steadying before something demanding.',
    phases: [
      { label: 'Breathe in', seconds: 4 },
      { label: 'Hold', seconds: 4 },
      { label: 'Breathe out', seconds: 4 },
      { label: 'Hold', seconds: 4 },
    ],
  },
  {
    id: 'extended-exhale',
    name: 'Longer out-breath',
    description: 'Exhale longer than you inhale. Helpful for winding down.',
    phases: [
      { label: 'Breathe in', seconds: 4 },
      { label: 'Breathe out', seconds: 6 },
    ],
  },
  {
    id: 'coherent',
    name: 'Even breathing',
    description: 'About six breaths a minute, in and out evenly.',
    phases: [
      { label: 'Breathe in', seconds: 5 },
      { label: 'Breathe out', seconds: 5 },
    ],
  },
];

export interface Practice {
  id: string;
  name: string;
  minutes: number;
  kind: 'meditation' | 'relaxation' | 'mindfulness';
  steps: string[];
}

/** Guided text practices. Each step is shown for an equal share of the session. */
export const PRACTICES: Practice[] = [
  {
    id: 'body-scan',
    name: 'Short body scan',
    minutes: 5,
    kind: 'meditation',
    steps: [
      'Sit or lie comfortably. Let your eyes close or rest your gaze on the floor.',
      'Notice your breathing without changing it.',
      'Bring attention to your feet. Notice warmth, pressure, or nothing at all.',
      'Move slowly up through your legs, letting them feel heavy.',
      'Notice your belly and chest rising and falling.',
      'Soften your shoulders, jaw and the space between your eyebrows.',
      'Take in your whole body at once. When you’re ready, open your eyes.',
    ],
  },
  {
    id: 'grounding',
    name: 'Five senses grounding',
    minutes: 4,
    kind: 'mindfulness',
    steps: [
      'Look around and name five things you can see.',
      'Notice four things you can feel: your clothes, the chair, the air.',
      'Listen for three sounds, near or far.',
      'Notice two things you can smell, or two scents you like.',
      'Notice one thing you can taste, or take a slow sip of water.',
      'Take one slow breath and notice how you feel now.',
    ],
  },
  {
    id: 'muscle-release',
    name: 'Tense and release',
    minutes: 6,
    kind: 'relaxation',
    steps: [
      'Sit comfortably with both feet on the floor.',
      'Curl your toes tightly for five seconds, then let go.',
      'Tighten your calves and thighs, then release them.',
      'Make fists and tense your arms, then let them drop.',
      'Lift your shoulders towards your ears, hold, then let them fall.',
      'Scrunch your face gently, then relax it.',
      'Notice the difference between tension and ease across your body.',
    ],
  },
  {
    id: 'breath-count',
    name: 'Counting breaths',
    minutes: 5,
    kind: 'meditation',
    steps: [
      'Settle into a comfortable position.',
      'On each out-breath, count silently: one.',
      'Continue counting out-breaths up to ten.',
      'If you lose count, that’s normal. Start again at one.',
      'Keep going, gently returning to the count.',
      'Let the counting go and rest for a few breaths before finishing.',
    ],
  },
];

export const MOOD_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
export const STRESS_LABELS = ['Calm', 'Mild', 'Moderate', 'High', 'Very high'];
export const MOOD_TAGS = ['Work', 'Sleep', 'Family', 'Friends', 'Exercise', 'Health', 'Money', 'Weather', 'Food', 'Rest'];
