import type { IconName } from '../../components/ui/Icon';
import { repos } from '../../repositories';
import type { Repository } from '../../db/repository';
import { formatDate, formatDateTime } from '../../utils/date';

export type FieldType = 'text' | 'multiline' | 'date' | 'datetime' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  keyboard?: 'default' | 'phone-pad' | 'email-address';
  /** Words used in "Enter …" when a required field is empty. */
  requiredLabel?: string;
  /** Extra format check for text fields. */
  format?: 'email' | 'phone';
  /** Dates that must not be in the future. */
  notFuture?: boolean;
  /** Maximum length for text fields. */
  max?: number;
}

export interface RecordKind {
  id: 'allergies' | 'conditions' | 'vaccinations' | 'appointments' | 'contacts';
  title: string;
  singular: string;
  icon: IconName;
  repo: Repository<Record<string, unknown>>;
  fields: FieldDef[];
  titleOf: (d: Record<string, unknown>) => string;
  subtitleOf: (d: Record<string, unknown>) => string | null;
}

const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(', ') || null;

export const RECORD_KINDS: RecordKind[] = [
  {
    id: 'allergies',
    title: 'Allergies',
    singular: 'allergy',
    icon: 'alert-circle-outline',
    repo: repos.allergies as unknown as Repository<Record<string, unknown>>,
    fields: [
      { key: 'allergen', label: 'Allergen', type: 'text', required: true, requiredLabel: 'the allergen', max: 60, placeholder: 'e.g. Penicillin' },
      { key: 'reaction', label: 'Reaction', type: 'text', max: 80, placeholder: 'e.g. Hives' },
      { key: 'severity', label: 'Severity', type: 'select', options: ['Mild', 'Moderate', 'Severe'] },
      { key: 'note', label: 'Notes', type: 'multiline' },
    ],
    titleOf: (d) => s(d.allergen) ?? 'Allergy',
    subtitleOf: (d) => join(s(d.severity), s(d.reaction)),
  },
  {
    id: 'conditions',
    title: 'Medical history',
    singular: 'condition',
    icon: 'document-text-outline',
    repo: repos.conditions as unknown as Repository<Record<string, unknown>>,
    fields: [
      { key: 'name', label: 'Condition or procedure', type: 'text', required: true, requiredLabel: 'the condition or procedure' },
      { key: 'since', label: 'Since', type: 'date', notFuture: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Ongoing', 'Resolved'] },
      { key: 'note', label: 'Notes', type: 'multiline' },
    ],
    titleOf: (d) => s(d.name) ?? 'Condition',
    subtitleOf: (d) => join(s(d.status), s(d.since) ? `Since ${formatDate(String(d.since), true)}` : null),
  },
  {
    id: 'vaccinations',
    title: 'Vaccinations',
    singular: 'vaccination',
    icon: 'shield-checkmark-outline',
    repo: repos.vaccinations as unknown as Repository<Record<string, unknown>>,
    fields: [
      { key: 'name', label: 'Vaccine', type: 'text', required: true, requiredLabel: 'the vaccine name' },
      { key: 'date', label: 'Date given', type: 'date', notFuture: true },
      { key: 'dose', label: 'Dose', type: 'text', max: 40, placeholder: 'e.g. Booster' },
      { key: 'provider', label: 'Given by', type: 'text' },
      { key: 'note', label: 'Notes', type: 'multiline' },
    ],
    titleOf: (d) => s(d.name) ?? 'Vaccination',
    subtitleOf: (d) => join(s(d.date) ? formatDate(String(d.date), true) : null, s(d.dose)),
  },
  {
    id: 'appointments',
    title: 'Appointments',
    singular: 'appointment',
    icon: 'calendar-outline',
    repo: repos.appointments as unknown as Repository<Record<string, unknown>>,
    fields: [
      { key: 'title', label: 'What for', type: 'text', required: true, requiredLabel: 'what the appointment is for' },
      { key: 'dateTime', label: 'When', type: 'datetime' },
      { key: 'provider', label: 'With', type: 'text' },
      { key: 'location', label: 'Where', type: 'text' },
      { key: 'note', label: 'Notes', type: 'multiline' },
    ],
    titleOf: (d) => s(d.title) ?? 'Appointment',
    subtitleOf: (d) => join(s(d.dateTime) ? formatDateTime(String(d.dateTime)) : null, s(d.provider)),
  },
  {
    id: 'contacts',
    title: 'Care team',
    singular: 'contact',
    icon: 'people-outline',
    repo: repos.contacts as unknown as Repository<Record<string, unknown>>,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, requiredLabel: 'a name', max: 60 },
      { key: 'role', label: 'Type', type: 'select', options: ['Doctor', 'Clinic', 'Pharmacy', 'Other'] },
      { key: 'specialty', label: 'Specialty', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text', keyboard: 'phone-pad', format: 'phone', max: 30 },
      { key: 'email', label: 'Email', type: 'text', keyboard: 'email-address', format: 'email', max: 120 },
      { key: 'address', label: 'Address', type: 'multiline' },
    ],
    titleOf: (d) => s(d.name) ?? 'Contact',
    subtitleOf: (d) => join(s(d.role), s(d.specialty), s(d.phone)),
  },
];

export function recordKind(id: string) {
  return RECORD_KINDS.find((k) => k.id === id);
}

export const DOCUMENT_CATEGORIES = [
  { value: 'lab-report', label: 'Lab report' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'discharge', label: 'Discharge summary' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
] as const;
