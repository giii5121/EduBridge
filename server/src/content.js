// Author-written XI practice content. Q-matrix rows use local attribute IDs.
import { extendedLessons } from './lessonContent.js';
import { expandBank } from './assessmentBank.js';
const question = (id, text, options, answer, explanation, attribute) => ({
  id,
  text,
  options,
  answer,
  explanation,
  attributes: [attribute],
});
const pair = (prefix, rows) =>
  rows.map((row, i) => question(`${prefix}-${i + 1}`, ...row, Math.floor(i / 2)));
const block = (title, body, example) => ({ title, body, example });

export const legacyTopics = [
  {
    id: 'fungsi',
    title: 'Komposisi & invers fungsi',
    category: 'Fungsi',
    symbol: 'f(x)',
    color: 'blue',
    minutes: 18,
    summary: 'Hubungkan dua fungsi, pahami urutannya, lalu temukan fungsi invers.',
    attributes: ['Evaluasi fungsi', 'Komposisi fungsi', 'Invers fungsi'],
    blocks: [
      block(
        'Mulai dari nilai fungsi',
        'Fungsi memetakan setiap anggota domain ke tepat satu anggota kodomain. Untuk mengevaluasi f(a), ganti setiap x dengan a, lalu hitung sesuai urutan operasi.',
        'f(x) = 2x + 3 → f(4) = 2(4) + 3 = 11.',
      ),
      block(
        'Komposisi: urutan itu penting',
        'Notasi (f ∘ g)(x) berarti f(g(x)). Hitung fungsi yang di dalam terlebih dahulu. Umumnya f ∘ g tidak sama dengan g ∘ f. Pastikan keluaran g termasuk domain f.',
        'f(x) = 2x + 1 dan g(x) = x − 3. Maka (f ∘ g)(x) = 2(x − 3) + 1 = 2x − 5.',
      ),
      block(
        'Invers membalik pemetaan',
        'Untuk fungsi bijektif, tulis y = f(x), tukar x dan y, lalu selesaikan persamaan untuk y. Periksa kembali dengan komposisi: f(f⁻¹(x)) = x pada domain yang sesuai.',
        'y = 3x − 6 → x = 3y − 6 → y = (x + 6)/3. Jadi f⁻¹(x) = (x + 6)/3.',
      ),
    ],
    pre: pair('fun-pre', [
      ['Jika f(x) = 3x − 2, berapakah f(4)?', ['8', '10', '12', '14'], 1, 'f(4) = 3 × 4 − 2 = 10.'],
      [
        'Jika g(x) = x² + 2, berapakah g(−3)?',
        ['−7', '5', '11', '−11'],
        2,
        '(−3)² + 2 = 9 + 2 = 11.',
      ],
      [
        'f(x) = 2x + 1 dan g(x) = x − 3. Bentuk (f ∘ g)(x) adalah …',
        ['2x − 5', '2x − 2', '2x + 4', 'x − 2'],
        0,
        'f(g(x)) = 2(x − 3) + 1 = 2x − 5.',
      ],
      [
        'f(x) = x² dan g(x) = x + 2. Berapakah (g ∘ f)(3)?',
        ['25', '9', '13', '11'],
        3,
        'g(f(3)) = g(9) = 9 + 2 = 11.',
      ],
      [
        'Invers dari f(x) = 2x + 6 adalah …',
        ['2x − 6', '(x − 6)/2', '(x + 6)/2', 'x/2 + 6'],
        1,
        'x = 2y + 6, sehingga y = (x − 6)/2.',
      ],
      [
        'Jika f(x) = 3x − 9, berapakah f⁻¹(6)?',
        ['−1', '3', '5', '9'],
        2,
        'f⁻¹(6) = (6 + 9)/3 = 5.',
      ],
    ]),
    post: pair('fun-post', [
      ['Jika f(x) = 4x − 5, berapakah f(3)?', ['7', '12', '17', '−2'], 0, 'f(3) = 12 − 5 = 7.'],
      ['Jika g(x) = x² − 4, berapakah g(−4)?', ['−20', '20', '8', '12'], 3, 'g(−4) = 16 − 4 = 12.'],
      [
        'f(x) = 3x − 2 dan g(x) = x + 4. Bentuk (f ∘ g)(x) adalah …',
        ['3x + 2', '3x + 10', '3x + 4', '3x − 6'],
        1,
        '3(x + 4) − 2 = 3x + 10.',
      ],
      [
        'f(x) = x + 1 dan g(x) = x². Berapakah (f ∘ g)(4)?',
        ['25', '16', '17', '9'],
        2,
        'f(g(4)) = f(16) = 17.',
      ],
      [
        'Invers dari f(x) = 5x − 10 adalah …',
        ['(x − 10)/5', '5x + 10', '(x + 10)/5', 'x + 2'],
        2,
        'x = 5y − 10, sehingga y = (x + 10)/5.',
      ],
      ['Jika f(x) = 4x + 8, berapakah f⁻¹(20)?', ['3', '7', '5', '12'], 0, '(20 − 8)/4 = 3.'],
    ]),
  },
  {
    id: 'geometri',
    title: 'Lingkaran & garis singgung',
    category: 'Geometri',
    symbol: '◯',
    color: 'teal',
    minutes: 20,
    summary: 'Telusuri hubungan sudut, panjang busur, dan garis singgung lingkaran.',
    attributes: ['Sudut lingkaran', 'Busur dan juring', 'Garis singgung'],
    blocks: [
      block(
        'Sudut pusat dan sudut keliling',
        'Sudut pusat adalah dua kali sudut keliling yang menghadap busur yang sama. Sudut keliling yang menghadap diameter selalu 90°.',
        'Sudut pusat AOB = 100°. Sudut keliling ACB yang menghadap busur AB yang sama = 50°.',
      ),
      block(
        'Panjang busur dan luas juring',
        'Bagian lingkaran sebanding dengan sudut pusatnya. Panjang busur = (θ/360°) × 2πr, sedangkan luas juring = (θ/360°) × πr².',
        'r = 14 cm, θ = 90°, π = 22/7. Panjang busur = ¼ × 88 = 22 cm.',
      ),
      block(
        'Garis singgung dan jari-jari',
        'Jari-jari tegak lurus garis singgung di titik singgung. Untuk titik luar P, pusat O, dan titik singgung T, berlaku PT² = OP² − OT². Dua ruas singgung dari titik luar yang sama panjangnya sama.',
        'OP = 13 cm dan OT = 5 cm → PT = √(169 − 25) = 12 cm.',
      ),
    ],
    pre: pair('geo-pre', [
      [
        'Sudut pusat yang menghadap suatu busur adalah 120°. Sudut keliling yang menghadap busur yang sama adalah …',
        ['30°', '60°', '120°', '240°'],
        1,
        'Sudut keliling = ½ × 120° = 60°.',
      ],
      [
        'Sudut keliling yang menghadap diameter besarnya …',
        ['45°', '60°', '90°', '180°'],
        2,
        'Busur setengah lingkaran memiliki sudut pusat 180°, sehingga sudut kelilingnya 90°.',
      ],
      [
        'r = 14 cm dan sudut pusat 90°. Dengan π = 22/7, panjang busurnya …',
        ['11 cm', '22 cm', '44 cm', '88 cm'],
        1,
        '¼ × 2 × 22/7 × 14 = 22 cm.',
      ],
      [
        'r = 7 cm dan sudut pusat 180°. Dengan π = 22/7, luas juringnya …',
        ['22 cm²', '49 cm²', '77 cm²', '154 cm²'],
        2,
        '½ × 22/7 × 49 = 77 cm².',
      ],
      [
        'Jarak titik P ke pusat lingkaran 13 cm dan jari-jarinya 5 cm. Panjang ruas garis singgung dari P adalah …',
        ['8 cm', '12 cm', '18 cm', '10 cm'],
        1,
        '√(13² − 5²) = √144 = 12 cm.',
      ],
      [
        'PA dan PB adalah ruas garis singgung dari titik P ke lingkaran yang sama. Jika PA = 8 cm, PB = …',
        ['4 cm', '16 cm', '8 cm', '12 cm'],
        2,
        'Dua ruas singgung dari titik luar yang sama memiliki panjang sama.',
      ],
    ]),
    post: pair('geo-post', [
      [
        'Sudut keliling 35° menghadap busur yang sama dengan sudut pusat. Besar sudut pusat adalah …',
        ['17,5°', '35°', '70°', '140°'],
        2,
        'Sudut pusat = 2 × 35° = 70°.',
      ],
      [
        'AB adalah diameter dan C berada pada lingkaran. Besar ∠ACB adalah …',
        ['90°', '60°', '45°', '180°'],
        0,
        'Sudut keliling yang menghadap diameter adalah 90°.',
      ],
      [
        'r = 21 cm, sudut pusat 120°, π = 22/7. Panjang busurnya …',
        ['22 cm', '44 cm', '66 cm', '132 cm'],
        1,
        '⅓ × 2 × 22/7 × 21 = 44 cm.',
      ],
      [
        'r = 14 cm, sudut pusat 90°, π = 22/7. Luas juringnya …',
        ['44 cm²', '77 cm²', '154 cm²', '616 cm²'],
        2,
        '¼ × 22/7 × 196 = 154 cm².',
      ],
      [
        'Jarak titik luar ke pusat 17 cm dan jari-jari 8 cm. Panjang ruas garis singgung adalah …',
        ['9 cm', '15 cm', '25 cm', '12 cm'],
        1,
        '√(17² − 8²) = √225 = 15 cm.',
      ],
      [
        'Sudut antara jari-jari dan garis singgung di titik singgung adalah …',
        ['0°', '45°', '90°', '180°'],
        2,
        'Jari-jari tegak lurus garis singgung di titik singgung.',
      ],
    ]),
  },
  {
    id: 'statistik',
    title: 'Statistika & analisis data',
    category: 'Statistika',
    symbol: 'x̄',
    color: 'orange',
    minutes: 16,
    summary: 'Baca data dengan lebih teliti melalui ukuran pusat dan penyebarannya.',
    attributes: ['Ukuran pemusatan', 'Ukuran penyebaran', 'Interpretasi data'],
    blocks: [
      block(
        'Pusat sekumpulan data',
        'Mean adalah jumlah nilai dibagi banyak data. Median adalah nilai tengah data terurut. Untuk n genap, median adalah rata-rata dua nilai tengah. Modus adalah nilai yang paling sering muncul.',
        'Data 2, 4, 4, 6: mean = 16/4 = 4; median = (4 + 4)/2 = 4; modus = 4.',
      ),
      block(
        'Seberapa tersebar datanya?',
        'Jangkauan = maksimum − minimum. Varians populasi adalah rata-rata kuadrat selisih setiap nilai terhadap mean; simpangan baku adalah akar varians. Bedakan dengan varians sampel yang memakai pembagi n − 1.',
        'Data populasi 2, 4, 6 memiliki mean 4. Varians = (4 + 0 + 4)/3 = 8/3.',
      ),
      block(
        'Menafsirkan tanpa terburu-buru',
        'Outlier dapat menggeser mean lebih kuat daripada median. Rata-rata gabungan harus memperhitungkan banyak anggota setiap kelompok. Korelasi menunjukkan hubungan, tetapi belum membuktikan sebab-akibat.',
        '10 siswa memiliki mean 70 dan 20 siswa mean 85. Mean gabungan = (10 × 70 + 20 × 85)/30 = 80.',
      ),
    ],
    pre: pair('sta-pre', [
      [
        'Rata-rata data 4, 6, 8, 10, 12 adalah …',
        ['6', '7', '8', '10'],
        2,
        'Jumlah 40 dibagi 5 = 8.',
      ],
      ['Median data 3, 5, 7, 9 adalah …', ['5', '6', '7', '8'], 1, '(5 + 7)/2 = 6.'],
      ['Jangkauan data 12, 15, 18, 22 adalah …', ['7', '10', '12', '22'], 1, '22 − 12 = 10.'],
      [
        'Varians populasi data 2, 4, 6 adalah …',
        ['2', '4', '8/3', '8'],
        2,
        'Mean = 4. Varians = (4 + 0 + 4)/3 = 8/3.',
      ],
      [
        'Satu nilai sangat besar ditambahkan ke data. Ukuran yang umumnya paling terpengaruh adalah …',
        ['Mean', 'Median', 'Modus', 'Banyak kategori'],
        0,
        'Mean memakai seluruh besar nilai sehingga peka terhadap outlier.',
      ],
      [
        '10 siswa memiliki rata-rata 70 dan 20 siswa rata-rata 85. Rata-rata gabungan adalah …',
        ['75', '77,5', '80', '85'],
        2,
        '(700 + 1700)/30 = 80.',
      ],
    ]),
    post: pair('sta-post', [
      ['Rata-rata data 5, 7, 9, 11 adalah …', ['7', '8', '9', '10'], 1, '32/4 = 8.'],
      [
        'Median data 2, 4, 6, 8, 20 adalah …',
        ['4', '6', '8', '10'],
        1,
        'Nilai tengah data terurut adalah data ke-3, yaitu 6.',
      ],
      ['Jangkauan data 8, 13, 15, 24 adalah …', ['11', '13', '16', '24'], 2, '24 − 8 = 16.'],
      [
        'Varians populasi data 3, 3, 7, 7 adalah …',
        ['2', '4', '8', '16'],
        1,
        'Mean = 5. Jumlah kuadrat selisih = 16; varians = 16/4 = 4.',
      ],
      [
        'Ada satu pendapatan ekstrem sangat tinggi. Ukuran pusat yang lebih tahan terhadap nilai ekstrem adalah …',
        ['Mean', 'Jumlah', 'Median', 'Jangkauan'],
        2,
        'Median didasarkan pada posisi tengah, sehingga lebih tahan terhadap outlier.',
      ],
      [
        '15 siswa rata-ratanya 80 dan 5 siswa rata-ratanya 60. Rata-rata gabungan adalah …',
        ['70', '72', '75', '80'],
        2,
        '(15 × 80 + 5 × 60)/20 = 75.',
      ],
    ]),
  },
  {
    id: 'peluang',
    title: 'Peluang & kejadian majemuk',
    category: 'Peluang',
    symbol: 'P(A)',
    color: 'purple',
    minutes: 18,
    summary: 'Bangun cara berpikir probabilistik dari ruang sampel hingga peluang bersyarat.',
    attributes: ['Ruang sampel', 'Kejadian majemuk', 'Peluang bersyarat'],
    blocks: [
      block(
        'Peluang dimulai dari ruang sampel',
        'Untuk hasil yang sama mungkin, P(A) = banyak anggota A / banyak anggota ruang sampel. Peluang komplemen adalah 1 − P(A). Nilai peluang selalu antara 0 dan 1.',
        'Dadu adil: peluang muncul angka genap = 3/6 = 1/2.',
      ),
      block(
        'Gabungan dan irisan',
        'P(A ∪ B) = P(A) + P(B) − P(A ∩ B). Jika A dan B saling lepas, irisannya nol. Jika independen, P(A ∩ B) = P(A)P(B). Saling lepas berbeda dari independen.',
        'Dua koin adil: peluang keduanya gambar = 1/2 × 1/2 = 1/4.',
      ),
      block(
        'Ketika informasi baru diketahui',
        'P(A | B) = P(A ∩ B)/P(B), untuk P(B) > 0. Informasi B membatasi ruang sampel. Pada pengambilan tanpa pengembalian, peluang berikutnya berubah.',
        'Kantong berisi 3 bola merah dan 2 biru. Jika merah sudah terambil tanpa dikembalikan, peluang merah berikutnya = 2/4 = 1/2.',
      ),
    ],
    pre: pair('pel-pre', [
      [
        'Pada dadu adil, peluang muncul bilangan prima adalah …',
        ['1/6', '1/3', '1/2', '2/3'],
        2,
        'Bilangan prima 2, 3, 5: ada 3 dari 6 hasil.',
      ],
      [
        'P(A) = 0,3. Peluang komplemen A adalah …',
        ['0,3', '0,5', '0,7', '1,3'],
        2,
        '1 − 0,3 = 0,7.',
      ],
      [
        'Dua koin adil dilempar. Peluang keduanya gambar adalah …',
        ['1/2', '1/4', '3/4', '1'],
        1,
        '1/2 × 1/2 = 1/4.',
      ],
      [
        'P(A) = 0,4; P(B) = 0,3; P(A ∩ B) = 0,1. P(A ∪ B) = …',
        ['0,12', '0,6', '0,7', '0,8'],
        1,
        '0,4 + 0,3 − 0,1 = 0,6.',
      ],
      [
        'P(A ∩ B) = 0,2 dan P(B) = 0,5. P(A | B) = …',
        ['0,1', '0,2', '0,4', '0,7'],
        2,
        '0,2/0,5 = 0,4.',
      ],
      [
        'Ada 3 bola merah dan 2 biru. Satu bola merah diambil tanpa pengembalian. Peluang bola berikutnya merah adalah …',
        ['1/5', '2/5', '1/2', '3/5'],
        2,
        'Tersisa 2 merah dari 4 bola, sehingga 1/2.',
      ],
    ]),
    post: pair('pel-post', [
      [
        'Pada dadu adil, peluang muncul bilangan lebih dari 4 adalah …',
        ['1/6', '1/3', '1/2', '2/3'],
        1,
        'Hasil 5 dan 6: 2/6 = 1/3.',
      ],
      [
        'P(A) = 0,65. Peluang komplemennya adalah …',
        ['0,25', '0,35', '0,65', '1,65'],
        1,
        '1 − 0,65 = 0,35.',
      ],
      [
        'A dan B independen, P(A) = 0,5 dan P(B) = 0,4. P(A ∩ B) = …',
        ['0,1', '0,2', '0,4', '0,9'],
        1,
        '0,5 × 0,4 = 0,2.',
      ],
      [
        'A dan B saling lepas, P(A) = 0,2 dan P(B) = 0,3. P(A ∪ B) = …',
        ['0,06', '0,1', '0,5', '0,6'],
        2,
        'Untuk saling lepas, P(A ∩ B) = 0, sehingga peluang gabungan 0,5.',
      ],
      [
        'P(A ∩ B) = 0,15 dan P(B) = 0,3. P(A | B) = …',
        ['0,045', '0,15', '0,45', '0,5'],
        3,
        '0,15/0,3 = 0,5.',
      ],
      [
        'Ada 4 bola merah dan 2 biru. Satu bola biru diambil tanpa pengembalian. Peluang bola berikutnya merah adalah …',
        ['2/3', '4/5', '1/2', '1/5'],
        1,
        'Tersisa 4 bola merah dari 5 bola: 4/5.',
      ],
    ]),
  },
  {
    id: 'aljabar',
    title: 'Matriks & operasinya',
    category: 'Aljabar',
    symbol: '[A]',
    color: 'pink',
    minutes: 20,
    summary: 'Susun data ke dalam matriks dan gunakan operasi untuk menyelesaikan masalah.',
    attributes: ['Elemen dan ordo', 'Operasi matriks', 'Determinan dan invers'],
    blocks: [
      block(
        'Membaca sebuah matriks',
        'Ordo matriks ditulis banyak baris × banyak kolom. Elemen aᵢⱼ berada pada baris i dan kolom j. Transpose menukar baris dan kolom.',
        'A = [[1, 2, 3], [4, 5, 6]] berordo 2 × 3, dan a₂₃ = 6.',
      ),
      block(
        'Operasi mengikuti aturan',
        'Penjumlahan dilakukan pada elemen yang bersesuaian dan memerlukan ordo sama. Perkalian A berordo m × n dengan B berordo n × p menghasilkan matriks m × p. Entri hasil adalah jumlah hasil kali baris dengan kolom.',
        '[[1, 2], [3, 4]] × [[2], [1]] = [[4], [10]].',
      ),
      block(
        'Determinan dan invers 2 × 2',
        'Untuk A = [[a, b], [c, d]], det(A) = ad − bc. Jika determinan tidak nol, A⁻¹ = 1/det(A) × [[d, −b], [−c, a]]. Matriks dengan determinan nol tidak mempunyai invers.',
        'A = [[2, 1], [1, 1]] → det(A) = 1 → A⁻¹ = [[1, −1], [−1, 2]].',
      ),
    ],
    pre: pair('mat-pre', [
      [
        'Matriks [[1, 2, 3], [4, 5, 6]] memiliki ordo …',
        ['3 × 2', '2 × 3', '2 × 2', '3 × 3'],
        1,
        'Terdapat 2 baris dan 3 kolom.',
      ],
      [
        'Pada A = [[2, 5], [7, 9]], nilai a₂₁ adalah …',
        ['2', '5', '7', '9'],
        2,
        'a₂₁ adalah baris kedua, kolom pertama: 7.',
      ],
      [
        '[[1, 2], [3, 4]] + [[2, 1], [0, 3]] = …',
        ['[[3, 3], [3, 7]]', '[[2, 2], [0, 12]]', '[[3, 1], [3, 1]]', '[[1, 3], [3, 7]]'],
        0,
        'Jumlahkan setiap elemen yang bersesuaian.',
      ],
      [
        'Hasil [[1, 2]] × [[3], [4]] adalah …',
        ['[[3, 8]]', '[[7]]', '[[11]]', '[[14]]'],
        2,
        '1 × 3 + 2 × 4 = 11.',
      ],
      ['Determinan [[2, 1], [3, 4]] adalah …', ['5', '8', '11', '2'], 0, '2 × 4 − 1 × 3 = 5.'],
      [
        'Matriks 2 × 2 memiliki invers jika …',
        ['Semua elemennya positif', 'Determinan = 0', 'Determinan ≠ 0', 'Dua barisnya sama'],
        2,
        'Determinan harus tidak nol agar pembagi dalam rumus invers terdefinisi.',
      ],
    ]),
    post: pair('mat-post', [
      [
        'Transpose matriks berordo 3 × 2 memiliki ordo …',
        ['3 × 2', '2 × 3', '3 × 3', '2 × 2'],
        1,
        'Transpose menukar baris dan kolom.',
      ],
      [
        'A = [[3, 4], [5, 6]]. Nilai a₁₂ adalah …',
        ['3', '4', '5', '6'],
        1,
        'Baris pertama, kolom kedua bernilai 4.',
      ],
      [
        '2 × [[1, 3], [2, 4]] = …',
        ['[[2, 6], [4, 8]]', '[[3, 5], [4, 6]]', '[[1, 6], [2, 8]]', '[[2, 3], [4, 4]]'],
        0,
        'Kalikan semua elemen dengan 2.',
      ],
      [
        'Hasil [[2, 1]] × [[4], [3]] adalah …',
        ['[[8, 3]]', '[[9]]', '[[11]]', '[[14]]'],
        2,
        '2 × 4 + 1 × 3 = 11.',
      ],
      ['Determinan [[3, 2], [1, 4]] adalah …', ['10', '12', '14', '5'], 0, '3 × 4 − 2 × 1 = 10.'],
      [
        'Invers dari [[2, 0], [0, 1]] adalah …',
        ['[[2, 0], [0, 1]]', '[[1/2, 0], [0, 1]]', '[[1, 0], [0, 2]]', '[[0, 2], [1, 0]]'],
        1,
        'Invers matriks diagonal didapat dengan membalik elemen diagonal yang tidak nol.',
      ],
    ]),
  },
  {
    id: 'transformasi',
    title: 'Transformasi geometri',
    category: 'Geometri',
    symbol: '↗',
    color: 'lime',
    minutes: 16,
    summary: 'Lihat bagaimana titik berpindah melalui translasi, refleksi, rotasi, dan dilatasi.',
    attributes: ['Translasi dan refleksi', 'Rotasi', 'Dilatasi'],
    blocks: [
      block(
        'Menggeser dan mencerminkan',
        'Translasi T(a, b) memetakan (x, y) ke (x + a, y + b). Refleksi sumbu x: (x, −y); sumbu y: (−x, y); garis y = x: (y, x).',
        '(2, −1) ditranslasi T(3, 4) menjadi (5, 3). Refleksinya terhadap sumbu x adalah (2, 1).',
      ),
      block(
        'Berputar terhadap titik asal',
        'Rotasi positif berlawanan arah jarum jam. Dengan pusat O, rotasi 90°: (−y, x); rotasi 180°: (−x, −y); rotasi 270°: (y, −x).',
        '(3, 2) diputar 90° berlawanan jarum jam menjadi (−2, 3).',
      ),
      block(
        'Memperbesar dan memperkecil',
        'Dilatasi berpusat O dengan faktor k memetakan (x, y) ke (kx, ky). Panjang berubah dengan faktor |k|, sedangkan luas berubah dengan faktor k².',
        '(2, 3) dengan k = 2 menjadi (4, 6). Bangun berluas 5 menjadi berluas 20.',
      ),
    ],
    pre: pair('tra-pre', [
      [
        'Titik (2, 3) ditranslasi T(4, −1). Bayangannya adalah …',
        ['(6, 2)', '(−2, 4)', '(6, 4)', '(2, 6)'],
        0,
        '(2 + 4, 3 − 1) = (6, 2).',
      ],
      [
        'Refleksi titik (3, −2) terhadap sumbu x adalah …',
        ['(−3, −2)', '(3, 2)', '(−3, 2)', '(−2, 3)'],
        1,
        'Refleksi sumbu x: (x, y) → (x, −y).',
      ],
      [
        'Rotasi (2, 1) sebesar 90° berlawanan jarum jam berpusat O menghasilkan …',
        ['(1, 2)', '(−1, 2)', '(1, −2)', '(−2, −1)'],
        1,
        '(x, y) → (−y, x), sehingga (−1, 2).',
      ],
      [
        'Rotasi (3, −4) sebesar 180° berpusat O menghasilkan …',
        ['(−3, 4)', '(4, 3)', '(−4, −3)', '(3, 4)'],
        0,
        '(x, y) → (−x, −y).',
      ],
      [
        'Dilatasi titik (2, −3) berpusat O dengan faktor 2 menghasilkan …',
        ['(4, −6)', '(4, −3)', '(2, −6)', '(1, −1,5)'],
        0,
        'Kalikan kedua koordinat dengan 2.',
      ],
      [
        'Sebuah bangun berluas 6 didilatasi dengan faktor 3. Luas bayangannya …',
        ['18', '36', '54', '9'],
        2,
        'Luas dikalikan k² = 9, sehingga 6 × 9 = 54.',
      ],
    ]),
    post: pair('tra-post', [
      [
        'Titik (−1, 5) ditranslasi T(3, −2). Bayangannya …',
        ['(2, 3)', '(−4, 7)', '(3, 2)', '(−3, 10)'],
        0,
        '(−1 + 3, 5 − 2) = (2, 3).',
      ],
      [
        'Refleksi titik (4, −3) terhadap sumbu y adalah …',
        ['(4, 3)', '(−4, −3)', '(−4, 3)', '(−3, 4)'],
        1,
        'Refleksi sumbu y: (−x, y).',
      ],
      [
        'Rotasi (1, 3) sebesar 90° berlawanan jarum jam berpusat O menghasilkan …',
        ['(3, 1)', '(−3, 1)', '(3, −1)', '(−1, −3)'],
        1,
        '(−y, x) = (−3, 1).',
      ],
      [
        'Rotasi (−2, 5) sebesar 180° berpusat O menghasilkan …',
        ['(2, −5)', '(5, 2)', '(−5, −2)', '(2, 5)'],
        0,
        '(−x, −y) = (2, −5).',
      ],
      [
        'Dilatasi titik (6, −4) berpusat O dengan faktor 1/2 menghasilkan …',
        ['(12, −8)', '(3, −2)', '(6, −2)', '(3, −4)'],
        1,
        'Kalikan kedua koordinat dengan 1/2.',
      ],
      [
        'Luas bangun 20. Setelah dilatasi dengan faktor 1/2, luasnya …',
        ['10', '40', '5', '80'],
        2,
        '20 × (1/2)² = 5.',
      ],
    ]),
  },
].map((topic, order) => ({ ...topic, order, published: true }));

export const initialTopics = legacyTopics.map((topic) => ({
  ...topic,
  pre: expandBank(topic, 'pre'),
  post: expandBank(topic, 'post'),
  minutes: 30,
  blocks: topic.blocks.map((block, index) => ({ ...block, ...extendedLessons[topic.id][index] })),
}));
