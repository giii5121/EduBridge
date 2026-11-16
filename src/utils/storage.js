export const QUIZ_ATTEMPTS_KEY = 'edubridge-quiz-attempts';
export const PROFILE_KEY = 'edubridge-profile';
export const NOTIFICATIONS_KEY = 'edubridge-notifications';

export const DEFAULT_QUIZ_RESULTS = {
  attempts: {},
  lastTopic: 'aljabar',
  lastMode: 'pretest',
};

export function readStorage(key, fallback, label = 'data') {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error(`Gagal membaca ${label}:`, error);
    return fallback;
  }
}

export function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readQuizResults() {
  const saved = readStorage(QUIZ_ATTEMPTS_KEY, null, 'hasil kuis');

  if (!saved || typeof saved !== 'object') {
    return { ...DEFAULT_QUIZ_RESULTS, attempts: {} };
  }

  return {
    ...DEFAULT_QUIZ_RESULTS,
    ...saved,
    attempts: saved.attempts ?? {},
  };
}

export function saveQuizResults(results) {
  writeStorage(QUIZ_ATTEMPTS_KEY, results);
}
