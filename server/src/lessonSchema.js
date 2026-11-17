const text = (value, min, max) =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
export function validLesson(block) {
  if (
    !block ||
    !text(block.title, 3, 100) ||
    !text(block.body, 10, 3000) ||
    !text(block.example, 5, 1000)
  )
    return false;
  if (
    block.sections !== undefined &&
    (!Array.isArray(block.sections) ||
      block.sections.length > 8 ||
      block.sections.some((s) => !s || !text(s.title, 3, 100) || !text(s.body, 5, 3000)))
  )
    return false;
  if (
    block.worked !== undefined &&
    (!block.worked ||
      !text(block.worked.prompt, 5, 1000) ||
      !Array.isArray(block.worked.steps) ||
      block.worked.steps.length < 2 ||
      block.worked.steps.length > 8 ||
      block.worked.steps.some((s) => !text(s, 5, 1000)) ||
      !text(block.worked.conclusion, 5, 1500))
  )
    return false;
  if (
    block.misconception !== undefined &&
    (!block.misconception ||
      !text(block.misconception.mistake, 5, 1500) ||
      !text(block.misconception.correction, 5, 1500))
  )
    return false;
  if (
    block.practice !== undefined &&
    (!Array.isArray(block.practice) ||
      block.practice.length > 5 ||
      block.practice.some(
        (p) =>
          !p ||
          !text(p.id, 3, 80) ||
          !text(p.question, 5, 1500) ||
          !text(p.answer, 1, 1000) ||
          !text(p.explanation, 5, 2000),
      ))
  )
    return false;
  return true;
}
export function normalizeLesson(block) {
  const result = {
    title: block.title.trim(),
    body: block.body.trim(),
    example: block.example.trim(),
  };
  if (block.lessonVersion) result.lessonVersion = block.lessonVersion;
  if (block.sections)
    result.sections = block.sections.map((s) => ({ title: s.title.trim(), body: s.body.trim() }));
  if (block.worked)
    result.worked = {
      prompt: block.worked.prompt.trim(),
      steps: block.worked.steps.map((s) => s.trim()),
      conclusion: block.worked.conclusion.trim(),
    };
  if (block.misconception)
    result.misconception = {
      mistake: block.misconception.mistake.trim(),
      correction: block.misconception.correction.trim(),
    };
  if (block.practice)
    result.practice = block.practice.map((p) => ({
      id: p.id.trim(),
      question: p.question.trim(),
      answer: p.answer.trim(),
      explanation: p.explanation.trim(),
    }));
  return result;
}
