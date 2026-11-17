// Parallel, author-written Indonesian items. Each form has five items per attribute.
// IDs and content are fingerprinted in the PDINA instrument; edits require recalibration.
function numeric(id, attribute, text, value, explanation, unit = '') {
  const values = [value, value + 2, value - 1, value + 5];
  const answer = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  [values[0], values[answer]] = [values[answer], values[0]];
  return {
    id,
    text,
    options: values.map((n) => `${n}${unit}`),
    answer,
    explanation,
    attributes: [attribute],
  };
}
export function expandBank(topic, mode) {
  const added = [];
  const offset = mode === 'pre' ? 0 : 4;
  const add = (attr, i, text, answer, explanation, unit) =>
    added.push(
      numeric(`${topic.id}-${mode}-pdina-${attr}-${i}`, attr, text, answer, explanation, unit),
    );
  for (let i = 1; i <= 3; i++) {
    const n = i + offset;
    if (topic.id === 'fungsi') {
      add(
        0,
        i,
        `Diketahui f(x) = ${n + 2}x + ${n}. Berapa nilai f(${n + 1})?`,
        (n + 2) * (n + 1) + n,
        `Substitusikan x = ${n + 1}: (${n + 2})(${n + 1}) + ${n} = ${(n + 2) * (n + 1) + n}.`,
      );
      add(
        1,
        i,
        `f(x) = ${n + 1}x + 2 dan g(x) = x + ${n + 3}. Berapa (f ∘ g)(2)?`,
        (n + 1) * (n + 5) + 2,
        `Hitung g(2) = ${n + 5}, kemudian f(${n + 5}) = ${(n + 1) * (n + 5) + 2}.`,
      );
      add(
        2,
        i,
        `f(x) = ${n + 2}x + ${n + 1}. Berapa f⁻¹(${(n + 2) * (n + 3) + n + 1})?`,
        n + 3,
        `Selesaikan ${(n + 2) * (n + 3) + n + 1} = ${n + 2}x + ${n + 1}; diperoleh x = ${n + 3}.`,
      );
    } else if (topic.id === 'geometri') {
      add(
        0,
        i,
        `Sudut keliling yang menghadap busur AB adalah ${20 + n * 5}°. Berapa sudut pusat yang menghadap busur AB yang sama?`,
        40 + n * 10,
        `Sudut pusat = 2 × sudut keliling = ${40 + n * 10}°.`,
        '°',
      );
      add(
        1,
        i,
        `Jari-jari lingkaran ${7 * n} cm. Dengan π = 22/7, berapa panjang busur setengah lingkaran?`,
        22 * n,
        `Panjang busur setengah lingkaran = πr = (22/7) × ${7 * n} = ${22 * n} cm.`,
        ' cm',
      );
      const [r, t, d] = [
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
      ][i - 1].map((v) => v * (mode === 'pre' ? 1 : 2));
      add(
        2,
        i,
        `Jarak pusat O ke titik luar P adalah ${d} cm dan jari-jari OT ${r} cm. Berapa panjang garis singgung PT?`,
        t,
        `Segitiga OTP siku-siku di T. PT = √(${d}² − ${r}²) = ${t} cm.`,
        ' cm',
      );
    } else if (topic.id === 'statistik') {
      add(
        0,
        i,
        `Berapa rata-rata data ${n}, ${n + 2}, ${n + 4}, ${n + 6}, ${n + 8}?`,
        n + 4,
        `Jumlah data = ${5 * (n + 4)}. Bagi dengan 5, diperoleh ${n + 4}.`,
      );
      add(
        1,
        i,
        `Data pengamatan adalah ${n + 1}, ${n + 4}, ${n + 8}, ${n + 12}. Berapa jangkauannya?`,
        11,
        `Jangkauan = nilai maksimum − minimum = ${n + 12} − ${n + 1} = 11.`,
      );
      add(
        2,
        i,
        `Kelompok A berisi 10 siswa dengan rata-rata ${60 + n}. Kelompok B berisi 10 siswa dengan rata-rata ${80 + n}. Berapa rata-rata gabungan?`,
        70 + n,
        `Rata-rata gabungan = [10(${60 + n}) + 10(${80 + n})]/20 = ${70 + n}.`,
      );
    } else if (topic.id === 'peluang') {
      add(
        0,
        i,
        `Kotak berisi ${n + 2} bola merah dan ${8 - n} bola biru. Jika satu bola dipilih acak, berapa peluang merah dalam persen?`,
        (n + 2) * 10,
        `Ada 10 bola. Peluang merah = ${n + 2}/10 = ${(n + 2) * 10}%.`,
        '%',
      );
      add(
        1,
        i,
        `Kejadian A dan B saling lepas. P(A) = ${10 + n}% dan P(B) = 20%. Berapa P(A ∪ B) dalam persen?`,
        30 + n,
        `Karena saling lepas, P(A ∩ B) = 0. P(A ∪ B) = ${10 + n}% + 20% = ${30 + n}%.`,
        '%',
      );
      add(
        2,
        i,
        `Dari 20 anggota klub sains, ${n + 3} juga mengikuti klub matematika. Jika dipilih seorang anggota klub sains, berapa peluang ia mengikuti matematika dalam persen?`,
        (n + 3) * 5,
        `Sampel bersyarat terdiri dari 20 anggota sains. Peluang = ${n + 3}/20 = ${(n + 3) * 5}%.`,
        '%',
      );
    } else if (topic.id === 'aljabar') {
      add(
        0,
        i,
        `Pada matriks A = [[${n}, ${n + 2}], [${n + 4}, ${n + 6}]], berapa nilai elemen a₂₁?`,
        n + 4,
        `Elemen a₂₁ terletak di baris kedua kolom pertama, yaitu ${n + 4}.`,
      );
      add(
        1,
        i,
        `A = [[${n}, 2], [3, 4]] dan B = [[${n + 1}, 5], [6, 7]]. Berapa elemen baris pertama kolom pertama dari A + B?`,
        2 * n + 1,
        `Penjumlahan matriks dilakukan pada elemen seletak: ${n} + ${n + 1} = ${2 * n + 1}.`,
      );
      add(
        2,
        i,
        `Berapa determinan matriks [[${n + 2}, 1], [2, 3]]?`,
        3 * (n + 2) - 2,
        `Determinan = ad − bc = (${n + 2})(3) − (1)(2) = ${3 * (n + 2) - 2}.`,
      );
    } else if (topic.id === 'transformasi') {
      add(
        0,
        i,
        `Titik (${n}, ${n + 1}) ditranslasi oleh T(3, −2). Berapa koordinat x bayangannya?`,
        n + 3,
        `Translasi menambahkan vektor: (${n} + 3, ${n + 1} − 2). Koordinat x = ${n + 3}.`,
      );
      add(
        1,
        i,
        `Titik (${n + 2}, ${n + 4}) dirotasi 90° berlawanan jarum jam berpusat O. Berapa koordinat x bayangannya?`,
        -(n + 4),
        `Rotasi 90° berlawanan jarum jam memetakan (x, y) ke (−y, x), sehingga x bayangan = ${-(n + 4)}.`,
      );
      add(
        2,
        i,
        `Titik (${n + 1}, ${n + 2}) didilatasi berpusat O dengan faktor 3. Berapa koordinat y bayangannya?`,
        3 * (n + 2),
        `Dilatasi berpusat O memetakan (x, y) ke (3x, 3y). Koordinat y = 3 × ${n + 2} = ${3 * (n + 2)}.`,
      );
    }
  }
  return [...topic[mode], ...added];
}
