const assets = {
  ready: '/assets/mascots/quiz-ready.png',
  thinking: '/assets/mascots/quiz-thinking.png',
  celebrate: '/assets/mascots/quiz-celebrate.png',
};
export default function QuizCompanion({ mood = 'ready', answered = 0, total = 0 }) {
  const text =
    mood === 'celebrate'
      ? 'Usahamu layak dirayakan. Yuk, lihat konsep yang semakin kamu pahami!'
      : mood === 'ready'
        ? 'Kita kerjakan dengan tenang, ya. Setiap jawaban membantu mengenali cara belajarmu.'
        : answered === total && total > 0
          ? 'Semua soal sudah terjawab. Periksa sekali lagi sebelum mengumpulkan, ya!'
          : answered > 0
            ? `${answered} dari ${total} soal sudah kamu jawab. Baca perlahan dan percaya pada prosesmu.`
            : 'Baca soalnya perlahan. Mulai dari informasi yang sudah kamu pahami.';
  return (
    <div className={`quiz-companion ${mood}`}>
      <img
        src={assets[mood]}
        alt={
          mood === 'thinking'
            ? 'Maskot EduBridge berpikir sambil memegang pensil'
            : mood === 'celebrate'
              ? 'Maskot EduBridge merayakan usaha dengan piala bintang'
              : 'Maskot EduBridge siap mendampingi kuis'
        }
      />
      <div className="companion-speech">
        <span>TEMAN BELAJARMU</span>
        <p>{text}</p>
      </div>
    </div>
  );
}
