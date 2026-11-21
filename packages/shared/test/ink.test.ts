import { describe, expect, it } from 'vitest';
import {
  asInk,
  INK_LINE_HEIGHT,
  INK_MAX_POINTS,
  INK_MAX_STROKES,
  inkDataUrl,
  inkFromJson,
  InkError,
  insertRecognized,
  joinRecognizedLines,
} from '../src/ink';

const h = 4 * INK_LINE_HEIGHT;
const line: [number, number, number][] = [
  [10, 20, 0.5],
  [60, 40, 0.6],
  [120, 30, 0.7],
];

describe('handwriting (iteration 10)', () => {
  it('builds the stored note from raw strokes; the SVG holds paths only', () => {
    const ink = inkFromJson(JSON.stringify({ h, strokes: [line] }))!;
    // written on the first line only: the stored note is one line high
    expect(ink).toMatchObject({ v: 1, w: 1000, h: INK_LINE_HEIGHT });
    expect(ink.svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(ink.svg).toContain('<path d="M');
    expect(ink.svg).not.toMatch(/<script|on\w+=|href/);
    expect(asInk(ink)).toBe(ink);
    expect(inkDataUrl(ink)).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  });

  it('clamps points into the writing area and ignores anything but numbers', () => {
    const ink = inkFromJson(JSON.stringify({ h, strokes: [[[-5, 9999, 3]]], svg: '<script>' }))!;
    expect(ink.strokes).toEqual([[[0, h, 1]]]);
    expect(ink.svg).not.toContain('script');
  });

  it('returns null for an empty pad and rejects broken or oversized input', () => {
    expect(inkFromJson(JSON.stringify({ h, strokes: [] }))).toBeNull();
    for (const bad of [
      '{',
      '"x"',
      JSON.stringify({ h: 5, strokes: [line] }),
      JSON.stringify({ h, strokes: [[['a', 1, 1]]] }),
    ])
      expect(() => inkFromJson(bad)).toThrow(InkError);
    const many = Array.from({ length: INK_MAX_STROKES + 1 }, () => [[1, 1, 0.5]]);
    expect(() => inkFromJson(JSON.stringify({ h, strokes: many }))).toThrow('inkTooLarge');
    const long = [Array.from({ length: INK_MAX_POINTS + 1 }, () => [1, 1, 0.5])];
    expect(() => inkFromJson(JSON.stringify({ h, strokes: long }))).toThrow('inkTooLarge');
  });

  it('joins recognised lines and inserts them at the cursor', () => {
    expect(joinRecognizedLines(['  Schulter re, ', '', 'Abduktion  eingeschränkt'])).toBe(
      'Schulter re,\nAbduktion eingeschränkt',
    );
    expect(insertRecognized('', 'neu', null)).toBe('neu');
    expect(insertRecognized('LWS', 're', null)).toBe('LWS\nre');
    expect(insertRecognized('LWS links', 'und', 4)).toBe('LWS und links');
    expect(insertRecognized('LWS', '', null)).toBe('LWS');
  });
});
