/**
 * HTML part of app mails (iteration 13, Mike 20.11.2026: practice name and link in bold). Built from the plain text,
 * which stays the fallback: paragraphs and line breaks as in the text, links bold and clickable, the given phrases
 * (practice name, code) bold. No images, no remote content, no tracking.
 */
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const URL_RE = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)»]/g;

function inline(line: string, bold: string[]): string {
  // Split off links first so that a bold phrase never breaks a URL
  const parts: string[] = [];
  let last = 0;
  for (const m of line.matchAll(URL_RE)) {
    parts.push(boldPhrases(escape(line.slice(last, m.index)), bold));
    const href = escape(m[0]);
    parts.push(`<a href="${href}" style="color:#8a6a1c;font-weight:700;word-break:break-all">${href}</a>`);
    last = m.index + m[0].length;
  }
  parts.push(boldPhrases(escape(line.slice(last)), bold));
  return parts.join('');
}

function boldPhrases(html: string, bold: string[]): string {
  const phrases = [...new Set(bold.map((b) => escape(b.trim())).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!phrases.length) return html;
  const re = new RegExp(phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return html.replace(re, (m) => `<strong>${m}</strong>`);
}

export function mailHtml(text: string, bold: string[] = []): string {
  const body = text
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 14px">${para
          .split('\n')
          .map((l) => inline(l, bold))
          .join('<br>')}</p>`,
    )
    .join('\n');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;color:#1c1a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;font-size:15px;line-height:1.5">\n<div style="max-width:560px">\n${body}\n</div>\n</body></html>`;
}
