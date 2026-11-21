/** Remark fields with handwriting (iteration 10); importable from client components. */
export const RECOGNIZABLE_FIELDS = [
  'treatment.diagnosis',
  'consultation.diagnosis',
  'consultation.comparison',
  'anamnesis.furtherDiagnoses',
] as const;
export type RecognizableField = (typeof RECOGNIZABLE_FIELDS)[number];
