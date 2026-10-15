/** Text of the consent form, parsed for display on the iPad and in the patient zone (iteration 5, design D10) */
export type Block = { type: 'h'; text: string } | { type: 'p'; text: string } | { type: 'ul'; items: string[] };

/** Minimal text format for form texts: "## Heading", "- item", blank line between paragraphs. */
export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    let para: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
      para = [];
    };
    for (const line of lines) {
      if (line.startsWith('## ')) {
        flush();
        blocks.push({ type: 'h', text: line.slice(3).trim() });
      } else if (line.startsWith('- ')) {
        flush();
        const last = blocks[blocks.length - 1];
        if (last?.type === 'ul') last.items.push(line.slice(2).trim());
        else blocks.push({ type: 'ul', items: [line.slice(2).trim()] });
      } else para.push(line);
    }
    flush();
  }
  return blocks;
}
