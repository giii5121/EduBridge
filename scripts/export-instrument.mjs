import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { initialTopics } from '../server/src/content.js';
const topics = initialTopics.map((topic, ti) => ({
  ...topic,
  conceptIds: topic.attributes.map((_, index) => 11001 + ti * 3 + index),
  items: [...topic.pre, ...topic.post].map((q, qi) => ({
    ...q,
    questionId: 110001 + ti * 100 + qi,
    contentHash: createHash('sha256')
      .update(JSON.stringify([q.text, q.options, q.answer, q.attributes]))
      .digest('hex'),
  })),
}));
mkdirSync(new URL('../server/ml/instruments/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../server/ml/instruments/edubridge.json', import.meta.url),
  JSON.stringify({ version: 'edubridge-xi-v1', topics }, null, 2) + '\n',
);
console.log(
  `Exported ${topics.length} topics, ${topics.flatMap((t) => t.items).length} items, 18 attributes.`,
);
