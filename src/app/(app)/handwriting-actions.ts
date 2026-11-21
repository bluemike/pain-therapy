'use server';

import { getLocale } from 'next-intl/server';
import type { NoteInputMode } from '@prisma/client';
import { INPUT_MODES } from '@pain-therapy/shared/ink';
import { requireUser } from '@/lib/session';
import {
  recognize,
  RecognitionError,
  RECOGNIZABLE_FIELDS,
  setInputMode,
  type RecognizableField,
} from '@/lib/handwriting';

export type RecognizeResult = { text: string } | { error: RecognitionError['code'] };

/** handwriting-recognition (iteration 10, design D4): «Erkennen» and «In Text umwandeln» */
export async function recognizeHandwriting(fd: FormData): Promise<RecognizeResult> {
  const actor = await requireUser();
  const field = String(fd.get('field') ?? '') as RecognizableField;
  const image = fd.get('image');
  if (!RECOGNIZABLE_FIELDS.includes(field) || !(image instanceof File)) return { error: 'invalid' };
  try {
    const text = await recognize(actor, field, new Uint8Array(await image.arrayBuffer()), await getLocale());
    return { text };
  } catch (e) {
    if (e instanceof RecognitionError) return { error: e.code };
    throw e;
  }
}

/** note-input (design D3): switching a field sets the default of the user, without saving the form */
export async function saveInputMode(mode: NoteInputMode): Promise<void> {
  const actor = await requireUser();
  if (!INPUT_MODES.includes(mode)) return;
  await setInputMode(actor, mode);
}
