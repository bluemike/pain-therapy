import { describe, expect, it } from 'vitest';
import { mailHtml } from '@/lib/mail-html';

/** Iteration 13: HTML part of the mails, built from the plain text */
describe('mailHtml', () => {
  it('sets phrases and links in bold, keeps paragraphs and escapes the text', () => {
    const html = mailHtml(
      'Guten Tag <Anna>\n\nPhysio & Co lädt Sie ein.\nLink:\nhttps://pain-therapy.online/einladung/abc?x=1&y=2.\n\nPhysio & Co',
      ['Physio & Co'],
    );
    expect(html).toContain('Guten Tag &lt;Anna&gt;');
    expect(html).toContain('<strong>Physio &amp; Co</strong> lädt Sie ein.<br>Link:<br>');
    expect(html).toContain(
      '<a href="https://pain-therapy.online/einladung/abc?x=1&amp;y=2" style="color:#8a6a1c;font-weight:700;word-break:break-all">https://pain-therapy.online/einladung/abc?x=1&amp;y=2</a>.',
    );
    expect(html.match(/<p /g)).toHaveLength(3);
    expect(html).not.toMatch(/<img|<script/);
  });

  it('never breaks a link with a bold phrase', () => {
    const html = mailHtml('https://patient.pain-therapy.online/l/tok', ['pain']);
    expect(html).toContain('href="https://patient.pain-therapy.online/l/tok"');
    expect(html).not.toContain('<strong>pain</strong>');
  });
});
