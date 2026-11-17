import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialTopics } from '../src/content.js';
import { itemHash } from '../src/modelClient.js';

test('live Indonesian instrument matches checkpoint fingerprints, coverage, keys and parallel forms', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../ml/instruments/edubridge.json', import.meta.url), 'utf8'),
  );
  const ids = new Set();
  for (const topic of initialTopics) {
    const calibrated = manifest.topics.find((t) => t.id === topic.id);
    assert.deepEqual(topic.attributes, calibrated.attributes);
    for (const bank of ['pre', 'post']) {
      assert.equal(topic[bank].length, 15);
      for (let attribute = 0; attribute < 3; attribute++)
        assert.equal(topic[bank].filter((q) => q.attributes.includes(attribute)).length, 5);
      for (const q of topic[bank]) {
        assert.equal(ids.has(q.id), false);
        ids.add(q.id);
        assert.equal(q.options.length, 4);
        assert.equal(new Set(q.options).size, 4);
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
        assert.equal(
          itemHash(q),
          calibrated.items.find((item) => item.id === q.id)?.contentHash,
          `Recalibration required: ${q.id}`,
        );
      }
    }
  }
  assert.equal(ids.size, 180);
});
