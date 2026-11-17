/**
 * Legacy evidence scoring, retained ONLY for historical demo fixtures and migration.
 * Live assessments use modelClient.js and the supplied Python P-DINA implementation.
 * Input: topic.attributes, question Q-matrix rows, ordered response indices.
 * Output contract is consumed unchanged by both student and teacher views.
 */
export function diagnose(topic, questions, responses) {
  const attributes = topic.attributes.map((name, index) => {
    const items = questions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => q.attributes.includes(index));
    const correct = items.filter(({ q, i }) => responses[i] === q.answer).length;
    const mastery = items.length ? Math.round((correct / items.length) * 100) : null;
    return {
      id: index,
      name,
      mastery,
      evidence: items.length,
      correct,
      status:
        mastery === null
          ? 'unknown'
          : mastery >= 75
            ? 'mastered'
            : mastery >= 50
              ? 'developing'
              : 'gap',
    };
  });
  const correctCount = questions.filter((q, i) => responses[i] === q.answer).length;
  return {
    provider: 'pdina-dummy',
    simulated: true,
    version: '1.0',
    score: Math.round((correctCount / questions.length) * 100),
    correctCount,
    total: questions.length,
    attributes,
    gapCount: attributes.filter((a) => a.mastery !== null && a.mastery < 75).length,
    recommendations: attributes
      .filter((a) => a.mastery !== null && a.mastery < 75)
      .sort((a, b) => a.mastery - b.mastery)
      .map((a) => ({
        attributeId: a.id,
        title: topic.blocks[a.id]?.title ?? a.name,
        reason: `Penguatan ${a.name.toLowerCase()}`,
        blockIndex: a.id,
      })),
  };
}

export function compareDiagnoses(pre, post) {
  if (!pre || !post) return null;
  const comparable = pre.provider === post.provider && pre.version === post.version;
  return {
    comparable,
    scoreChange: post.score - pre.score,
    gapsClosed: comparable ? pre.attributes.filter(
      (a) =>
        a.status === 'gap' &&
        post.attributes.find((b) => b.id === a.id)?.status === 'mastered',
    ).length : 0,
    newGaps: comparable ? post.attributes.filter(
      (a) =>
        a.status === 'gap' &&
        pre.attributes.find((b) => b.id === a.id)?.status === 'mastered',
    ).length : 0,
    preGapCount: pre.gapCount,
    postGapCount: post.gapCount,
    attributes: pre.attributes.map((a) => ({
      ...a,
      pre: a.mastery,
      post: post.attributes.find((b) => b.id === a.id)?.mastery ?? null,
      preStatus: a.status,
      postStatus: post.attributes.find((b) => b.id === a.id)?.status ?? 'unknown',
    })),
  };
}
