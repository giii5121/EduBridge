import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModelClient } from '../src/modelClient.js';
import { initialTopics } from '../src/content.js';

test(
  'one classroom can request 60 simultaneous frozen-model diagnoses without losing results',
  { timeout: 30000 },
  async () => {
    const client = createModelClient();
    const topic = initialTopics[0];
    const answers = topic.pre.map((q) => q.answer);
    const results = await Promise.all(
      Array.from({ length: 60 }, (_, i) =>
        client.diagnose(topic, topic.pre, answers, `class-capacity-${i}`),
      ),
    );
    assert.equal(results.length, 60);
    assert.ok(results.every((r) => r.provider === 'pdina' && r.score === 100 && r.gapCount === 0));
  },
);
