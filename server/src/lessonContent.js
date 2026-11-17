// Extended, author-written concept reinforcement. Practice is formative and carries no extra XP.
const section = (title, body) => ({ title, body });
const check = (id, question, answer, explanation) => ({ id, question, answer, explanation });
const lesson = (body, sections, prompt, steps, conclusion, mistake, correction, practice) => ({
  lessonVersion: 2,
  body,
  sections,
  worked: { prompt, steps, conclusion },
  misconception: { mistake, correction },
  practice,
});

export const extendedLessons = {
  fungsi: [
    lesson(
      'Nilai fungsi adalah keluaran yang diperoleh ketika sebuah masukan dimasukkan ke aturan fungsi. Satu masukan yang berada dalam domain harus mempunyai tepat satu keluaran. Mulailah dengan mengenali aturan, memeriksa apakah masukannya diizinkan, lalu melakukan substitusi secara konsisten. Kebiasaan ini menjadi dasar untuk memahami komposisi dan invers.',
      [
        section(
          'Bedakan aturan, masukan, dan keluaran',
          'Pada f(x) = 2x + 3, huruf x menyatakan masukan dan 2x + 3 menyatakan aturannya. Tulisan f(4) bukan f dikali 4: artinya nilai keluaran ketika x diganti 4. Setiap kemunculan x harus diganti dengan bilangan yang sama.',
        ),
        section(
          'Domain perlu diperiksa dahulu',
          'Untuk fungsi polinomial, setiap bilangan real dapat menjadi masukan. Pada pecahan, penyebut tidak boleh nol. Pada akar kuadrat bernilai real, bagian dalam akar harus tidak negatif. Sebagai contoh, h(x) = √(x − 2) memerlukan x ≥ 2.',
        ),
        section(
          'Gunakan tanda kurung untuk bilangan negatif',
          'Jika x diganti −2, tulis (−2) setiap kali melakukan substitusi. Hitung pangkat terlebih dahulu, lalu perkalian, kemudian penjumlahan. Ingat bahwa (−2)² = 4, sedangkan −2² berarti −(2²) = −4.',
        ),
      ],
      'Tentukan f(−2) untuk f(x) = 2x² − 3x + 1.',
      [
        'Pastikan −2 berada dalam domain. Karena f adalah polinomial, substitusi dapat dilakukan.',
        'Ganti setiap x: f(−2) = 2(−2)² − 3(−2) + 1.',
        'Kerjakan kuadrat dan perkalian: 2(4) + 6 + 1.',
        'Jumlahkan hasilnya: 8 + 6 + 1 = 15.',
      ],
      'Jadi f(−2) = 15. Kamu dapat memeriksa kembali dengan memisahkan tiga sukunya: 8, 6, dan 1.',
      'Mengganti 2x² dengan (2x)², atau menganggap f(4) sebagai perkalian f × 4.',
      'Pangkat hanya berlaku pada bagian yang ditandai. Pada 2x², kuadratkan x dahulu kemudian kalikan 2. Notasi f(a) selalu dibaca sebagai evaluasi aturan fungsi pada a.',
      [
        check(
          'fungsi-0-a',
          'Dengan aturan f(x) = 2x² − 3x + 1, tentukan f(−1).',
          '6',
          'Substitusi memberi 2(−1)² − 3(−1) + 1 = 2 + 3 + 1 = 6.',
        ),
        check(
          'fungsi-0-b',
          'Untuk h(x) = √(x + 4) yang bernilai real, masukan seperti apa yang diperbolehkan?',
          'x ≥ −4',
          'Syaratnya x + 4 ≥ 0. Kurangi kedua ruas dengan 4 untuk memperoleh x ≥ −4.',
        ),
      ],
    ),
    lesson(
      'Komposisi menghubungkan keluaran sebuah fungsi dengan masukan fungsi berikutnya. Bayangkan dua mesin yang disusun berurutan: mesin pertama mengolah masukan, kemudian hasilnya masuk ke mesin kedua. Membaca urutan dengan benar lebih penting daripada langsung menyederhanakan bentuk aljabarnya. Urutan yang tertukar dapat menghasilkan aturan dan nilai yang berbeda.',
      [
        section(
          'Baca dari fungsi yang paling dalam',
          'Notasi (f ∘ g)(x) dibaca f dari g dari x, sehingga g dikerjakan lebih dahulu. Tulis langkah antara u = g(x) jika notasinya terasa rumit. Setelah u didapat, masukkan u ke seluruh tempat x pada aturan f.',
        ),
        section(
          'Substitusikan sebuah bentuk secara utuh',
          'Jika f(x) = 2x + 1 dan g(x) = x² − 3, maka f(g(x)) = 2(x² − 3) + 1. Tanda kurung menjaga agar seluruh keluaran g diproses sebagai satu masukan. Setelah itu gunakan sifat distributif untuk menyederhanakan.',
        ),
        section(
          'Periksa urutan dan domain',
          'Untuk pasangan tadi, f ∘ g = 2x² − 5, sedangkan g ∘ f = (2x + 1)² − 3 = 4x² + 4x − 2. Keduanya berbeda. Selain x harus berada dalam domain fungsi dalam, keluarannya juga harus berada dalam domain fungsi luar.',
        ),
      ],
      'Diberikan f(x) = 2x + 1 dan g(x) = x² − 3. Tentukan (f ∘ g)(4).',
      [
        'Baca f(g(4)): hitung g terlebih dahulu, bukan f.',
        'Hitung g(4) = 4² − 3 = 16 − 3 = 13.',
        'Masukkan 13 ke f: f(13) = 2(13) + 1.',
        'Peroleh 27. Sebagai pemeriksaan, pakai aturan komposisi 2x² − 5 pada x = 4.',
      ],
      'Dua cara memberi hasil yang sama: f(g(4)) = 27 dan 2(4²) − 5 = 27.',
      'Mengira (f ∘ g)(x) selalu sama dengan f(x) × g(x), atau mengerjakan f lebih dahulu karena ditulis di kiri.',
      'Komposisi adalah penyusunan aturan. Fungsi yang berada di dalam tanda kurung dikerjakan lebih dahulu. Perkalian fungsi adalah operasi berbeda yang ditulis (fg)(x).',
      [
        check(
          'fungsi-1-a',
          'Jika f(x) = 3x − 1 dan g(x) = x + 2, tentukan (f ∘ g)(x).',
          '3x + 5',
          'Masukkan x + 2 ke f: 3(x + 2) − 1 = 3x + 6 − 1 = 3x + 5.',
        ),
        check(
          'fungsi-1-b',
          'Jika f(x) = √x dan g(x) = x + 5, apa domain real untuk f ∘ g?',
          'x ≥ −5',
          'Komposisinya √(x + 5). Agar bernilai real, x + 5 harus tidak negatif.',
        ),
      ],
    ),
    lesson(
      'Fungsi invers membalik hubungan masukan dan keluaran. Jika f membawa 5 menjadi 9, inversnya membawa 9 kembali menjadi 5. Sebuah fungsi mempunyai invers yang juga merupakan fungsi ketika pemetaannya bijektif pada domain dan kodomain yang dipilih. Karena itu, menentukan invers tidak cukup hanya memindahkan simbol; hubungan dan batas domainnya juga perlu dipahami.',
      [
        section(
          'Makna notasi invers',
          'Tulisan f⁻¹(x) menyatakan fungsi invers, bukan 1/f(x). Domain invers adalah daerah hasil fungsi semula. Untuk fungsi linear ax + b dengan a ≠ 0 pada bilangan real, invers dapat ditentukan karena setiap keluaran mempunyai satu masukan asal.',
        ),
        section(
          'Tukar peran lalu selesaikan',
          'Mulai dengan y = f(x). Tukar x dan y untuk membalik perannya, lalu nyatakan y sebagai fungsi dari x. Langkah penukaran ini mewakili pembalikan pemetaan, sedangkan manipulasi aljabar memberi aturan inversnya.',
        ),
        section(
          'Uji dengan komposisi dan perhatikan cabang',
          'Periksa f(f⁻¹(x)) = x dan f⁻¹(f(x)) = x pada domain yang sesuai. Fungsi x² pada seluruh bilangan real tidak satu-satu. Jika domainnya dibatasi x ≥ 0, inversnya √x; pembatasan domain menentukan cabang yang dipakai.',
        ),
      ],
      'Tentukan invers f(x) = 3x − 6, lalu hitung f⁻¹(9).',
      [
        'Tulis y = 3x − 6 untuk menamai keluarannya.',
        'Tukar peran: x = 3y − 6.',
        'Tambahkan 6 dan bagi 3: y = (x + 6)/3.',
        'Gunakan aturan invers: f⁻¹(9) = (9 + 6)/3 = 5. Periksa f(5) = 9.',
      ],
      'Aturan inversnya f⁻¹(x) = (x + 6)/3, dan 9 dikembalikan ke masukan asal 5.',
      'Menganggap tanda −1 sebagai pangkat biasa, sehingga invers ditulis 1/(3x − 6).',
      'Bedakan invers pemetaan dan kebalikan suatu nilai. Untuk invers, balik langkah operasinya dalam urutan terbalik: dari dikali 3 lalu dikurangi 6, menjadi ditambah 6 lalu dibagi 3.',
      [
        check(
          'fungsi-2-a',
          'Tentukan invers f(x) = 5x + 10 pada bilangan real.',
          '(x − 10)/5',
          'Dari x = 5y + 10 diperoleh x − 10 = 5y, lalu y = (x − 10)/5.',
        ),
        check(
          'fungsi-2-b',
          'Jika g(x) = 4x − 8, berapakah g⁻¹(12)?',
          '5',
          'Balik operasinya: (12 + 8)/4 = 5. Memasukkan 5 ke g menghasilkan 12.',
        ),
      ],
    ),
  ],
  geometri: [
    lesson(
      'Hubungan sudut pada lingkaran dapat dipahami dengan melihat letak titik sudut dan busur yang dihadapinya. Sudut pusat bertitik sudut di pusat lingkaran, sedangkan sudut keliling bertitik sudut pada lingkaran. Sebelum memakai rumus, tandai kedua ujung busur yang sama. Dua sudut yang tampak berdekatan belum tentu menghadap busur yang sama.',
      [
        section(
          'Kenali sudut dari titik sudutnya',
          'Jika O pusat lingkaran, sudut AOB adalah sudut pusat. Jika C berada pada lingkaran, sudut ACB adalah sudut keliling. Kedua sudut dapat dibandingkan dengan faktor dua hanya apabila keduanya menghadap busur AB yang sama.',
        ),
        section(
          'Gunakan hubungan busur yang sesuai',
          'Sudut pusat besarnya dua kali sudut keliling yang menghadap busur yang sama. Sudut-sudut keliling yang menghadap busur yang sama juga sama besar. Jika busurnya setengah lingkaran, sudut pusatnya 180° dan sudut kelilingnya 90°.',
        ),
        section(
          'Hubungkan dengan segiempat tali busur',
          'Untuk segiempat yang semua titik sudutnya terletak pada lingkaran, jumlah sudut yang berhadapan adalah 180°. Alasannya, kedua sudut tersebut bersama-sama menghadap satu lingkaran penuh, dengan total sudut pusat 360°.',
        ),
      ],
      'Sudut keliling ACB = 48° menghadap busur AB. O adalah pusat lingkaran. Tentukan sudut pusat AOB yang menghadap busur AB yang sama.',
      [
        'Tandai titik A dan B sebagai ujung busur yang sedang dibicarakan.',
        'Pastikan ACB adalah sudut keliling dan AOB sudut pusat pada busur yang sama.',
        'Gunakan ∠AOB = 2 × ∠ACB = 2 × 48°.',
        'Hasilnya 96°. Sudut keliling lain yang menghadap busur AB yang sama juga 48°.',
      ],
      'Sudut pusat yang diminta adalah 96°. Hubungan faktor dua berlaku karena busur acuannya sama.',
      'Mengalikan atau membagi dua setiap pasangan sudut yang berada di dalam sebuah gambar lingkaran.',
      'Periksa jenis sudut dan busurnya dahulu. Jika sudut menghadap busur yang berbeda, tentukan hubungan busurnya sebelum memakai faktor dua.',
      [
        check(
          'geometri-0-a',
          'Sudut pusat yang menghadap busur AB adalah 146°. Berapa sudut keliling yang menghadap busur AB yang sama?',
          '73°',
          'Sudut keliling = 146°/2 = 73°.',
        ),
        check(
          'geometri-0-b',
          'ABCD adalah segiempat tali busur. Jika ∠ABC = 105°, berapa ∠ADC?',
          '75°',
          'Sudut ABC dan ADC berhadapan sehingga jumlahnya 180°. Maka ∠ADC = 180° − 105° = 75°.',
        ),
      ],
    ),
    lesson(
      'Busur dan juring adalah dua bagian berbeda dari sebuah lingkaran. Busur adalah bagian garis lengkung pada keliling, sedangkan juring adalah daerah yang dibatasi dua jari-jari dan sebuah busur. Keduanya menggunakan perbandingan sudut pusat terhadap 360°, tetapi besaran yang dikalikan berbeda: keliling untuk panjang busur dan luas lingkaran untuk luas juring.',
      [
        section(
          'Mulai dari bagian terhadap keseluruhan',
          'Sudut pusat 90° mewakili seperempat lingkaran, 180° setengah lingkaran, dan 45° seperdelapan lingkaran. Hitung θ/360° sebelum melakukan perkalian supaya ukuran bagian yang sedang dihitung lebih mudah dibayangkan.',
        ),
        section(
          'Pilih rumus dan satuan yang tepat',
          'Panjang busur s = (θ/360°) × 2πr, dengan satuan panjang seperti cm. Luas juring L = (θ/360°) × πr², dengan satuan luas seperti cm². Pada kedua rumus ini, θ dinyatakan dalam derajat.',
        ),
        section(
          'Periksa data sebelum menghitung',
          'Jika yang diketahui diameter d, ubah dahulu menjadi jari-jari r = d/2. Gunakan nilai π sesuai petunjuk soal. Jangan mencampurkan derajat dan radian tanpa konversi. Hasil untuk sebuah juring kecil harus lebih kecil daripada seluruh lingkaran.',
        ),
      ],
      'Lingkaran berjari-jari 14 cm mempunyai juring bersudut pusat 45°. Dengan π = 22/7, hitung panjang busur dan luas juringnya.',
      [
        'Tentukan bagiannya: 45/360 = 1/8 lingkaran.',
        'Hitung keliling penuh: 2 × 22/7 × 14 = 88 cm. Busurnya adalah 88/8 = 11 cm.',
        'Hitung luas penuh: 22/7 × 14² = 616 cm². Luas juringnya adalah 616/8 = 77 cm².',
        'Periksa satuan: busur 11 cm dan juring 77 cm². Keduanya seperdelapan ukuran penuhnya.',
      ],
      'Panjang busurnya 11 cm dan luas juringnya 77 cm². Bagian sudutnya sama, tetapi jenis besarannya berbeda.',
      'Memakai diameter sebagai r atau menulis cm² untuk panjang busur.',
      'Tulis r dan θ pada baris pertama penyelesaian, lalu tulis satuan pada setiap hasil. Pemeriksaan sederhana ini membantu membedakan besaran panjang dan luas.',
      [
        check(
          'geometri-1-a',
          'r = 21 cm dan θ = 120°. Dengan π = 22/7, berapa panjang busurnya?',
          '44 cm',
          'Bagian sudutnya 1/3, sedangkan kelilingnya 132 cm. Panjang busur = 132/3 = 44 cm.',
        ),
        check(
          'geometri-1-b',
          'r = 14 cm dan θ = 90°. Dengan π = 22/7, berapa luas juringnya?',
          '154 cm²',
          'Bagian sudutnya 1/4 dan luas lingkaran penuh 616 cm². Jadi luas juring = 616/4 = 154 cm².',
        ),
      ],
    ),
    lesson(
      'Garis singgung menyentuh lingkaran di satu titik. Hubungan terpentingnya adalah bahwa jari-jari ke titik singgung tegak lurus terhadap garis singgung. Dengan menarik garis dari pusat ke titik luar, kamu memperoleh segitiga siku-siku. Karena itu, persoalan panjang garis singgung sering dapat diselesaikan menggunakan Teorema Pythagoras.',
      [
        section(
          'Buat segitiga bantu yang benar',
          'Misalkan O pusat, P titik luar, dan T titik singgung. Hubungkan O ke T dan O ke P. Sudut OTP adalah 90°. Pada segitiga OTP, OP merupakan sisi miring, sedangkan OT adalah jari-jari lingkaran.',
        ),
        section(
          'Tentukan panjang dengan Pythagoras',
          'Karena OP² = OT² + PT², maka PT = √(OP² − OT²). Titik P harus berada di luar lingkaran sehingga OP > OT. Jangan menjumlahkan kuadrat jika yang dicari justru salah satu sisi siku-sikunya.',
        ),
        section(
          'Dua ruas singgung dari titik yang sama',
          'Jika PA dan PB sama-sama menyinggung satu lingkaran dari titik luar P, panjang PA = PB. Pernyataan ini berlaku untuk dua ruas yang berasal dari titik luar yang sama; ruas dari titik luar berbeda tidak otomatis sama panjang.',
        ),
      ],
      'Jarak titik P ke pusat O adalah 17 cm. Jari-jari OT = 8 cm dan PT garis singgung. Tentukan PT.',
      [
        'Gambarkan segitiga OTP dan tandai sudut siku-siku di T.',
        'Tentukan sisi miringnya: OP = 17 cm, bukan PT.',
        'Hitung PT² = 17² − 8² = 289 − 64 = 225.',
        'Ambil akar positif karena panjang tidak negatif: PT = √225 = 15 cm.',
      ],
      'Panjang ruas garis singgung PT adalah 15 cm. Pemeriksaan: 8² + 15² = 17².',
      'Menjadikan garis singgung sebagai sisi miring atau menulis PT = OP − OT.',
      'Tentukan lokasi sudut 90° terlebih dahulu. Sisi yang berhadapan dengan sudut tersebut adalah sisi miring. Selisih panjang tidak menggantikan selisih kuadrat pada Pythagoras.',
      [
        check(
          'geometri-2-a',
          'Jarak titik luar ke pusat 25 cm dan jari-jari 7 cm. Berapa panjang ruas garis singgung?',
          '24 cm',
          'PT = √(25² − 7²) = √(625 − 49) = √576 = 24 cm.',
        ),
        check(
          'geometri-2-b',
          'Dari titik P ditarik ruas singgung PA dan PB. Jika PA = 9 cm, berapa PB?',
          '9 cm',
          'Kedua ruas berasal dari titik luar yang sama dan menyinggung lingkaran yang sama, sehingga panjangnya sama.',
        ),
      ],
    ),
  ],
  statistik: [
    lesson(
      'Ukuran pemusatan merangkum sekumpulan data menjadi nilai yang mewakili pusatnya. Mean, median, dan modus menjawab pertanyaan yang berbeda. Mean memperhitungkan besar semua nilai, median memperhatikan posisi setelah data diurutkan, dan modus memperhatikan frekuensi kemunculan. Memilih ukuran yang sesuai membantu menghindari kesimpulan yang menyesatkan.',
      [
        section(
          'Mean memakai seluruh nilai',
          'Mean = jumlah nilai dibagi banyak data. Jika data disajikan sebagai nilai dan frekuensi, kalikan setiap nilai dengan frekuensinya sebelum menjumlahkan. Banyak data adalah jumlah frekuensi, bukan banyak kategori.',
        ),
        section(
          'Urutkan data sebelum mencari median',
          'Untuk banyak data ganjil, ambil nilai pada posisi (n + 1)/2. Untuk banyak data genap, ambil rata-rata nilai pada posisi n/2 dan n/2 + 1. Median adalah nilai datanya, bukan nomor posisinya.',
        ),
        section(
          'Modus dan pemilihan ukuran',
          'Modus adalah nilai yang paling sering muncul; data dapat memiliki lebih dari satu modus atau tidak memiliki modus tunggal. Nilai ekstrem dapat menggeser mean dengan kuat. Median sering lebih tahan terhadap perubahan ekstrem tersebut.',
        ),
      ],
      'Tentukan mean, median, dan modus data 2, 4, 4, 6, 9.',
      [
        'Data sudah terurut dan terdapat 5 nilai.',
        'Jumlahkan nilainya: 2 + 4 + 4 + 6 + 9 = 25, sehingga mean = 25/5 = 5.',
        'Posisi median adalah (5 + 1)/2 = 3. Nilai pada posisi ketiga adalah 4.',
        'Nilai 4 muncul dua kali, lebih sering daripada nilai lain. Modusnya adalah 4.',
      ],
      'Mean = 5, median = 4, dan modus = 4. Ketiganya tidak harus sama karena menggunakan cara merangkum yang berbeda.',
      'Mengambil nilai yang berada di tengah susunan awal tanpa mengurutkan data.',
      'Urutkan data dahulu untuk median. Jika ada dua nilai tengah, rata-ratakan keduanya. Untuk mean, setiap nilai tetap harus dihitung, termasuk nilai yang berulang.',
      [
        check(
          'statistik-0-a',
          'Cari mean, median, dan modus dari 3, 5, 5, 7, 10.',
          'Mean 6; median 5; modus 5.',
          'Jumlah data 30 dan banyaknya 5, sehingga mean 6. Nilai tengah dan nilai paling sering muncul sama-sama 5.',
        ),
        check(
          'statistik-0-b',
          'Pada data 2, 4, 4, 6, 9, nilai 9 diganti 29. Apa yang terjadi pada mean dan median?',
          'Mean menjadi 9; median tetap 4.',
          'Jumlah baru 45 sehingga mean 45/5 = 9. Posisi tengah masih ditempati 4, menunjukkan median lebih tahan terhadap perubahan ekstrem.',
        ),
      ],
    ),
    lesson(
      'Dua kelompok data dapat mempunyai mean sama tetapi tingkat penyebaran berbeda. Ukuran penyebaran membantu menjelaskan seberapa jauh nilai-nilai berada dari pusat data. Mulailah dari jangkauan, lalu lanjutkan ke varians dan simpangan baku. Perhatikan apakah data dianggap sebagai seluruh populasi atau sampel, karena pembaginya berbeda.',
      [
        section(
          'Jangkauan memberi gambaran awal',
          'Jangkauan = nilai maksimum − minimum. Perhitungannya cepat, tetapi hanya memakai dua nilai terluar. Data yang sangat berbeda pola di bagian tengah tetap dapat memiliki jangkauan yang sama.',
        ),
        section(
          'Varians populasi menimbang semua selisih',
          'Tentukan mean, hitung selisih setiap nilai terhadap mean, kuadratkan selisihnya, kemudian rata-ratakan. Kuadrat mencegah selisih positif dan negatif saling meniadakan. Untuk populasi, pembaginya n; untuk varians sampel yang umum digunakan, pembaginya n − 1.',
        ),
        section(
          'Simpangan baku kembali ke satuan semula',
          'Simpangan baku adalah akar dari varians. Jika datanya dalam cm, varians mempunyai satuan cm² dan simpangan baku kembali dalam cm. Simpangan baku yang lebih kecil menunjukkan nilai-nilai lebih berdekatan dengan mean.',
        ),
      ],
      'Anggap 2, 4, 6, 8 sebagai seluruh populasi. Hitung jangkauan, varians, dan simpangan bakunya.',
      [
        'Mean = (2 + 4 + 6 + 8)/4 = 5. Jangkauan = 8 − 2 = 6.',
        'Selisih dari mean adalah −3, −1, 1, dan 3.',
        'Kuadrat selisihnya 9, 1, 1, dan 9, dengan jumlah 20.',
        'Varians populasi = 20/4 = 5, sehingga simpangan baku = √5 ≈ 2,24.',
      ],
      'Jangkauan 6, varians populasi 5, dan simpangan baku sekitar 2,24. Jika soal menyatakan sampel, variansnya memakai pembagi 3.',
      'Menghitung rata-rata selisih biasa lalu menyimpulkan penyebaran selalu nol.',
      'Selisih terhadap mean memang berjumlah nol. Kuadratkan setiap selisih sebelum menjumlahkannya. Pastikan juga tidak memakai pembagi n dan n − 1 secara bergantian dalam satu perhitungan.',
      [
        check(
          'statistik-1-a',
          'Hitung varians populasi data 1, 3, 5.',
          '8/3',
          'Mean 3. Kuadrat selisihnya 4, 0, 4. Jumlah 8 dibagi banyak data 3, sehingga varians 8/3.',
        ),
        check(
          'statistik-1-b',
          'Dua data memiliki mean sama. Simpangan baku A = 2 dan B = 7. Mana yang lebih rapat di sekitar mean?',
          'Data A.',
          'Simpangan baku A lebih kecil. Nilai-nilainya, secara ukuran penyebaran ini, lebih berdekatan dengan mean.',
        ),
      ],
    ),
    lesson(
      'Menghitung ringkasan data hanyalah awal. Kamu juga perlu menafsirkan apa arti nilai tersebut dalam konteks, mempertimbangkan banyak anggota kelompok, dan menyadari keterbatasan informasi. Ringkasan yang tampak sederhana dapat menyembunyikan ketimpangan atau nilai ekstrem. Biasakan menanyakan data apa yang tersedia dan kesimpulan mana yang benar-benar didukung.',
      [
        section(
          'Rata-rata gabungan memerlukan bobot',
          'Jika dua kelompok memiliki banyak anggota berbeda, rata-rata gabungannya tidak cukup dihitung dengan merata-ratakan dua mean. Hitung total nilai masing-masing kelompok, jumlahkan totalnya, lalu bagi dengan jumlah seluruh anggota.',
        ),
        section(
          'Perhatikan nilai ekstrem dan sebaran',
          'Satu pendapatan sangat tinggi dapat menaikkan mean suatu kelompok meskipun sebagian besar anggotanya berpendapatan rendah. Bandingkan mean dengan median dan lihat sebarannya sebelum mengatakan kelompok tersebut secara umum mengalami peningkatan.',
        ),
        section(
          'Hubungan bukan bukti sebab-akibat',
          'Dua variabel yang bergerak bersama dapat berkorelasi. Namun, faktor ketiga atau cara pengambilan data mungkin ikut berperan. Gunakan bahasa yang sesuai: data menunjukkan hubungan, sedangkan klaim sebab-akibat memerlukan bukti tambahan.',
        ),
      ],
      'Kelompok A berisi 10 siswa dengan mean 70. Kelompok B berisi 20 siswa dengan mean 85. Tentukan mean seluruh siswa.',
      [
        'Hitung total nilai kelompok A: 10 × 70 = 700.',
        'Hitung total nilai kelompok B: 20 × 85 = 1700.',
        'Jumlahkan nilai dan banyak siswa: total 2400 untuk 30 siswa.',
        'Mean gabungan = 2400/30 = 80. Hasil lebih dekat ke 85 karena kelompok B lebih besar.',
      ],
      'Mean gabungan adalah 80. Merata-ratakan 70 dan 85 menjadi 77,5 akan memberi bobot yang sama pada dua kelompok yang ukurannya berbeda.',
      'Menganggap rata-rata dua kelompok selalu merupakan rata-rata sederhana dari kedua mean.',
      'Periksa jumlah anggota kelompok. Rata-rata sederhana dua mean hanya tepat jika bobot kedua kelompok sama. Jika ukuran kelompok tidak diketahui, mean gabungan belum tentu dapat ditentukan.',
      [
        check(
          'statistik-2-a',
          '15 siswa memiliki mean 80 dan 5 siswa memiliki mean 60. Berapa mean gabungannya?',
          '75',
          'Total nilai = 15 × 80 + 5 × 60 = 1500. Jumlah siswa 20, sehingga mean 75.',
        ),
        check(
          'statistik-2-b',
          'Dua kelas memiliki mean 80 dan 60. Banyak siswanya tidak diberikan. Apakah mean gabungannya pasti 70?',
          'Tidak dapat dipastikan.',
          'Nilai 70 tepat jika kedua kelas memiliki banyak siswa sama. Tanpa jumlah anggota, bobot masing-masing mean belum diketahui.',
        ),
      ],
    ),
  ],
  peluang: [
    lesson(
      'Peluang menyatakan seberapa mungkin sebuah kejadian terjadi. Untuk hasil-hasil yang sama mungkin, peluang diperoleh dari banyak hasil yang mendukung kejadian dibagi banyak seluruh hasil. Sebelum menghitung, tulis ruang sampelnya dengan jelas. Dengan cara ini, kamu dapat melihat apakah ada hasil yang terlewat, dihitung berulang, atau sebenarnya tidak sama mungkin.',
      [
        section(
          'Bedakan percobaan, hasil, dan kejadian',
          'Melempar dadu adalah percobaan. Angka 4 adalah salah satu hasil. Kejadian muncul bilangan genap memuat hasil 2, 4, dan 6. Pada dadu adil, keenam hasil mempunyai peluang yang sama, sehingga P(genap) = 3/6.',
        ),
        section(
          'Bangun ruang sampel secara teratur',
          'Untuk dua koin, beri penanda urutan koin pertama dan kedua. Jika A berarti angka dan G gambar, ruang sampelnya AA, AG, GA, GG. AG dan GA berbeda karena menunjukkan hasil pada koin yang berbeda.',
        ),
        section(
          'Gunakan komplemen untuk menghitung lebih singkat',
          'Komplemen A adalah kejadian A tidak terjadi. Karena A dan komplemennya mencakup seluruh ruang sampel tanpa tumpang tindih, P(Aᶜ) = 1 − P(A). Peluang harus berada antara 0 dan 1; hasil di luar rentang itu menandakan perhitungan perlu diperiksa.',
        ),
      ],
      'Dua koin adil dilempar. Tentukan peluang muncul tepat satu gambar.',
      [
        'Tuliskan ruang sampel berurutan: AA, AG, GA, dan GG.',
        'Keempat hasil sama mungkin karena kedua koin adil dan lemparannya independen.',
        'Kejadian tepat satu gambar adalah AG dan GA: ada 2 hasil yang mendukung.',
        'Peluang = 2/4 = 1/2. Perhatikan bahwa GG tidak termasuk karena mempunyai dua gambar.',
      ],
      'Peluang tepat satu gambar adalah 1/2. Kata tepat, paling sedikit, dan paling banyak dapat menghasilkan kejadian yang berbeda.',
      'Menganggap ruang sampel dua koin hanya AA, AG, GG dan memberi peluang 1/3 untuk masing-masing.',
      'Bedakan urutan agar semua hasil elementer sama mungkin. Kejadian campuran mencakup AG dan GA, sehingga tidak mempunyai bobot yang sama dengan satu hasil AA.',
      [
        check(
          'peluang-0-a',
          'Pada satu dadu adil, berapa peluang muncul bilangan prima?',
          '1/2',
          'Bilangan prima pada dadu adalah 2, 3, dan 5. Ada 3 hasil dari 6 hasil yang sama mungkin.',
        ),
        check(
          'peluang-0-b',
          'Dua koin adil dilempar. Berapa peluang muncul paling sedikit satu angka?',
          '3/4',
          'Komplemennya adalah tidak ada angka, yaitu GG dengan peluang 1/4. Maka peluang yang diminta 1 − 1/4 = 3/4.',
        ),
      ],
    ),
    lesson(
      'Kejadian majemuk menggabungkan dua atau lebih kejadian. Kata atau biasanya mengarah pada gabungan, sedangkan dan mengarah pada irisan. Mengenali apakah kejadian tumpang tindih, saling lepas, atau independen akan membantu memilih aturan yang tepat. Ketiga sifat ini tidak boleh dipertukarkan begitu saja.',
      [
        section(
          'Gabungan menghindari penghitungan ganda',
          'Rumus P(A ∪ B) = P(A) + P(B) − P(A ∩ B) mengurangi hasil yang terhitung dua kali. Jika A dan B saling lepas, tidak ada hasil yang masuk keduanya sehingga P(A ∩ B) = 0.',
        ),
        section(
          'Irisan kejadian independen',
          'Jika terjadinya A tidak mengubah peluang B, keduanya independen dan P(A ∩ B) = P(A)P(B). Contohnya, hasil koin pertama tidak mengubah peluang hasil koin kedua ketika percobaan dilakukan secara independen.',
        ),
        section(
          'Saling lepas berbeda dari independen',
          'Kejadian saling lepas tidak dapat terjadi bersamaan. Untuk dua kejadian yang peluangnya positif, mengetahui salah satunya terjadi justru membuat peluang kejadian lainnya menjadi nol. Karena itu, saling lepas tidak otomatis berarti independen.',
        ),
      ],
      'Satu dadu adil dilempar. A adalah kejadian genap dan B kejadian bilangan lebih dari 3. Tentukan P(A ∪ B).',
      [
        'Tuliskan A = {2, 4, 6} dan B = {4, 5, 6}.',
        'Irisannya A ∩ B = {4, 6}, sehingga peluang irisannya 2/6.',
        'Gunakan rumus: 3/6 + 3/6 − 2/6 = 4/6.',
        'Sederhanakan menjadi 2/3. Periksa langsung gabungannya: {2, 4, 5, 6}.',
      ],
      'Peluang muncul bilangan genap atau lebih dari 3 adalah 2/3. Angka 4 dan 6 tidak boleh dihitung dua kali.',
      'Selalu menjumlahkan peluang untuk kata atau tanpa memeriksa irisan.',
      'Cari hasil yang memenuhi kedua kejadian terlebih dahulu. Untuk kata dan, periksa independensi sebelum mengalikan peluang marginalnya.',
      [
        check(
          'peluang-1-a',
          'P(A) = 0,4; P(B) = 0,35; P(A ∩ B) = 0,15. Tentukan P(A ∪ B).',
          '0,6',
          'P(A ∪ B) = 0,4 + 0,35 − 0,15 = 0,6.',
        ),
        check(
          'peluang-1-b',
          'A dan B independen, P(A) = 0,6 dan P(B) = 0,5. Tentukan P(A ∩ B).',
          '0,3',
          'Karena independen, peluang irisan dapat dihitung dengan 0,6 × 0,5 = 0,3.',
        ),
      ],
    ),
    lesson(
      'Peluang bersyarat memperbarui peluang ketika sebuah informasi sudah diketahui. Notasi P(A | B) berarti peluang A dengan syarat B terjadi. Ruang sampel acuan kini terbatas pada B. Bayangkan kamu menyaring semua hasil terlebih dahulu berdasarkan informasi B, lalu menghitung bagian yang juga memenuhi A di dalam kelompok hasil tersebut.',
      [
        section(
          'Syarat menentukan penyebut',
          'Rumusnya P(A | B) = P(A ∩ B)/P(B), dengan P(B) > 0. Penyebutnya adalah peluang kejadian yang sudah diketahui, bukan selalu peluang kejadian yang sedang ditanyakan. Perhatikan bahwa P(A | B) umumnya berbeda dari P(B | A).',
        ),
        section(
          'Tanpa pengembalian mengubah isi ruang sampel',
          'Jika sebuah bola diambil dan tidak dikembalikan, banyak seluruh bola dan banyak bola berwarna terkait harus diperbarui. Jika yang diketahui bola pertama merah, perbarui hitungan berdasarkan informasi merah tersebut sebelum menghitung pengambilan berikutnya.',
        ),
        section(
          'Bedakan peluang bersyarat dan peluang dua kejadian',
          'Peluang merah kedua dengan syarat merah pertama sudah terjadi berbeda dari peluang kedua pengambilan sama-sama merah. Untuk yang kedua, gunakan P(merah pertama) × P(merah kedua | merah pertama).',
        ),
      ],
      'Kantong berisi 4 bola merah dan 3 biru. Bola pertama diketahui merah dan tidak dikembalikan. Berapa peluang bola kedua merah?',
      [
        'Informasi syaratnya adalah merah pertama sudah terjadi. Jangan menghitung ulang peluang kejadian yang sudah diketahui.',
        'Perbarui isi kantong: tersisa 3 merah dan 3 biru, dengan total 6 bola.',
        'Peluang merah berikutnya di antara hasil yang tersisa adalah 3/6 = 1/2.',
        'Sebagai pembeda, peluang dua pengambilan sama-sama merah sejak awal adalah (4/7) × (3/6) = 2/7.',
      ],
      'Jawaban pertanyaan bersyarat adalah 1/2, sedangkan peluang dua merah sejak awal adalah 2/7. Keduanya menjawab pertanyaan berbeda.',
      'Tetap memakai 4/7 untuk pengambilan kedua setelah satu merah diambil tanpa pengembalian.',
      'Gambarkan kondisi kantong setelah informasi syarat diterapkan. Jika bola dikembalikan, komposisi kembali seperti semula; jika tidak, pembilang dan penyebut dapat berubah.',
      [
        check(
          'peluang-2-a',
          'P(A ∩ B) = 0,12 dan P(B) = 0,4. Tentukan P(A | B).',
          '0,3',
          'Gunakan peluang syarat B sebagai penyebut: 0,12/0,4 = 0,3.',
        ),
        check(
          'peluang-2-b',
          'A dan B independen dengan P(A) = 0,25 dan P(B) = 0,6. Berapa P(A | B)?',
          '0,25',
          'Independensi berarti mengetahui B tidak mengubah peluang A. Secara rumus, (0,25 × 0,6)/0,6 = 0,25.',
        ),
      ],
    ),
  ],
  aljabar: [
    lesson(
      'Matriks menyusun bilangan dalam baris dan kolom sehingga informasi dapat dibaca dan diolah secara teratur. Ordo menunjukkan ukuran susunan, sedangkan indeks elemen menunjukkan letak suatu nilai. Ketelitian membaca baris dan kolom merupakan dasar seluruh operasi matriks. Jangan langsung menghitung sebelum posisi dan ukurannya jelas.',
      [
        section(
          'Baca ordo sebagai baris kali kolom',
          'Matriks berordo m × n mempunyai m baris mendatar dan n kolom tegak. Matriks 2 × 3 berbeda ukuran dari matriks 3 × 2 meskipun keduanya sama-sama memiliki enam elemen.',
        ),
        section(
          'Indeks pertama adalah baris',
          'Elemen aᵢⱼ berarti elemen pada baris i dan kolom j. Urutan ini selalu dipertahankan. Dua matriks sama jika ordonya sama dan semua elemen pada posisi yang bersesuaian bernilai sama.',
        ),
        section(
          'Transpose menukar baris dan kolom',
          'Transpose A, ditulis Aᵀ, mengubah baris pertama A menjadi kolom pertama Aᵀ, dan seterusnya. Matriks m × n menjadi n × m. Nilai elemen tidak berubah; posisinya yang dipertukarkan.',
        ),
      ],
      'Diberikan A = [[2, −1, 4], [0, 3, 5]]. Tentukan ordo, elemen a₂₂, dan transpose A.',
      [
        'Hitung baris mendatar: ada 2. Hitung kolom tegak: ada 3. Jadi ordo A adalah 2 × 3.',
        'Elemen a₂₂ terletak di baris kedua, kolom kedua, sehingga nilainya 3.',
        'Baris pertama [2, −1, 4] menjadi kolom pertama transpose; baris kedua [0, 3, 5] menjadi kolom kedua.',
        'Susun Aᵀ = [[2, 0], [−1, 3], [4, 5]], yang berordo 3 × 2.',
      ],
      'Ordo A = 2 × 3, a₂₂ = 3, dan transpose berordo 3 × 2. Notasi [[…], […]] menyatakan baris-baris matriks.',
      'Menukar urutan indeks karena melihat kolom terlebih dahulu, atau mengira transpose mengurutkan besar bilangan.',
      'Baca indeks dengan kalimat lengkap: baris ke-i, lalu kolom ke-j. Untuk transpose, pindahkan posisi berdasarkan baris dan kolom tanpa mengubah nilai.',
      [
        check(
          'aljabar-0-a',
          'A = [[1, 7, 2], [3, 8, 4]]. Berapa a₁₂ dan a₂₃?',
          'a₁₂ = 7 dan a₂₃ = 4.',
          'Baris pertama kolom kedua adalah 7. Baris kedua kolom ketiga adalah 4.',
        ),
        check(
          'aljabar-0-b',
          'Jika B berordo 4 × 2, apa ordo Bᵀ?',
          '2 × 4',
          'Transpose menukar banyak baris dengan banyak kolom.',
        ),
      ],
    ),
    lesson(
      'Operasi matriks mengikuti aturan ukuran dan posisi. Penjumlahan menggabungkan elemen yang bersesuaian, perkalian skalar mengalikan setiap elemen, sedangkan perkalian dua matriks memakai hasil kali baris dan kolom. Memeriksa ordo sebelum menghitung akan menghemat banyak kesalahan, terutama ketika suatu perkalian sebenarnya tidak terdefinisi.',
      [
        section(
          'Penjumlahan dan skalar',
          'Dua matriks hanya dapat dijumlahkan atau dikurangkan jika ordonya sama. Setiap operasi dilakukan pada posisi yang sama. Untuk kA, kalikan semua elemen A dengan skalar k, termasuk elemen negatif dan nol.',
        ),
        section(
          'Syarat perkalian dua matriks',
          'Jika A berordo m × n dan B berordo n × p, AB terdefinisi dan berordo m × p. Banyak kolom A harus sama dengan banyak baris B. Syarat ini tidak otomatis menjamin BA juga terdefinisi.',
        ),
        section(
          'Entri hasil berasal dari baris dan kolom',
          'Entri hasil pada baris i kolom j dihitung dengan mengalikan pasangan elemen baris i dari A dan kolom j dari B, lalu menjumlahkan hasilnya. Umumnya AB ≠ BA. Perkalian elemen seposisi bukan aturan perkalian matriks biasa.',
        ),
      ],
      'Hitung AB untuk A = [[1, 2], [3, 4]] dan B = [[2, 0], [1, 5]].',
      [
        'Kedua matriks berordo 2 × 2. Ukuran dalamnya sama sehingga hasil AB berordo 2 × 2.',
        'Baris pertama: entri (1,1) = 1×2 + 2×1 = 4; entri (1,2) = 1×0 + 2×5 = 10.',
        'Baris kedua: entri (2,1) = 3×2 + 4×1 = 10; entri (2,2) = 3×0 + 4×5 = 20.',
        'Susun hasil sesuai posisi: AB = [[4, 10], [10, 20]].',
      ],
      'AB = [[4, 10], [10, 20]]. Sebagai pembanding, BA = [[2, 4], [16, 22]], sehingga urutan perkalian memang berpengaruh.',
      'Mengalikan elemen pada posisi yang sama dan menyebut hasilnya sebagai AB.',
      'Gunakan satu baris penuh dan satu kolom penuh untuk setiap entri. Tunjuk baris dan kolom yang dipakai sebelum melakukan perkalian.',
      [
        check(
          'aljabar-1-a',
          'Dengan A dan B pada contoh, tentukan 2A − B.',
          '[[0, 4], [5, 3]]',
          '2A = [[2, 4], [6, 8]]. Kurangi elemen B pada posisi yang sama untuk memperoleh [[0, 4], [5, 3]].',
        ),
        check(
          'aljabar-1-b',
          'A berordo 2 × 3 dan B berordo 3 × 4. Apa ordo AB?',
          '2 × 4',
          'Ukuran dalam 3 dan 3 sesuai. Ukuran luar 2 dan 4 menjadi ordo hasil.',
        ),
      ],
    ),
    lesson(
      'Determinan matriks persegi memberikan informasi penting tentang keberadaan invers. Untuk matriks 2 × 2, rumusnya sederhana tetapi tanda dan urutan elemen harus diperhatikan. Invers A adalah matriks yang mengembalikan hasil perkalian ke identitas: AA⁻¹ = A⁻¹A = I. Invers bukan hasil membalik setiap elemen secara terpisah.',
      [
        section(
          'Hitung determinan dengan tanda yang tepat',
          'Untuk A = [[a, b], [c, d]], determinannya ad − bc. Kalikan diagonal utama, lalu kurangi hasil kali diagonal lainnya. Jika elemen bertanda negatif, pakai tanda kurung supaya pengurangannya tidak keliru.',
        ),
        section(
          'Invers memerlukan determinan tidak nol',
          'Jika det(A) ≠ 0, rumus inversnya adalah (1/det(A)) × [[d, −b], [−c, a]]. Tukar dua elemen diagonal utama, ubah tanda dua elemen lainnya, lalu kalikan seluruh matriks dengan 1/det(A).',
        ),
        section(
          'Gunakan identitas untuk memeriksa',
          'Matriks identitas 2 × 2 adalah [[1, 0], [0, 1]]. Kalikan A dengan calon invers untuk memeriksa hasilnya. Jika determinan nol, rumus invers tidak dapat dipakai karena melibatkan pembagian dengan nol.',
        ),
      ],
      'Tentukan invers A = [[3, 2], [1, 1]].',
      [
        'Hitung determinan: 3×1 − 2×1 = 1, sehingga invers ada.',
        'Tukar elemen diagonal utama: 3 dan 1 bertukar posisi.',
        'Ubah tanda elemen lain sehingga diperoleh [[1, −2], [−1, 3]].',
        'Kalikan dengan 1/det(A) = 1. Periksa A × A⁻¹: hasilnya [[1, 0], [0, 1]].',
      ],
      'A⁻¹ = [[1, −2], [−1, 3]]. Untuk determinan selain 1, faktor pengalinya tetap harus diterapkan pada semua elemen.',
      'Mengambil kebalikan setiap elemen, atau mengabaikan syarat determinan ketika memakai rumus invers.',
      'Tuliskan determinan lebih dahulu. Langkah ini memeriksa apakah invers ada dan menyediakan faktor skalar yang diperlukan.',
      [
        check(
          'aljabar-2-a',
          'Berapa determinan [[4, 2], [3, 1]]?',
          '−2',
          'Determinan = 4×1 − 2×3 = 4 − 6 = −2. Determinan negatif tetap dapat menghasilkan invers karena nilainya bukan nol.',
        ),
        check(
          'aljabar-2-b',
          'Apakah [[2, 4], [1, 2]] mempunyai invers?',
          'Tidak.',
          'Determinan = 2×2 − 4×1 = 0. Karena determinannya nol, matriks tidak mempunyai invers.',
        ),
      ],
    ),
  ],
  transformasi: [
    lesson(
      'Transformasi memetakan titik asal ke titik bayangan dengan aturan yang jelas. Translasi menggeser semua titik dengan perpindahan yang sama, sedangkan refleksi mencerminkan titik terhadap suatu garis. Kedua transformasi mempertahankan jarak dan ukuran bangun. Tulis koordinat asal dan aturannya sebelum menghitung agar arah perpindahan tidak tertukar.',
      [
        section(
          'Translasi adalah penambahan vektor',
          'Translasi T(a, b) memetakan (x, y) menjadi (x + a, y + b). Nilai a positif berarti bergerak ke kanan, a negatif ke kiri; b positif ke atas dan b negatif ke bawah. Vektor yang sama berlaku untuk setiap titik bangun.',
        ),
        section(
          'Refleksi mengikuti garis cerminnya',
          'Refleksi terhadap sumbu x mengubah (x, y) menjadi (x, −y); sumbu y menjadi (−x, y); garis y = x menjadi (y, x). Titik pada garis cermin tetap berada di tempatnya, dan jarak ke garis cermin dipertahankan.',
        ),
        section(
          'Untuk rangkaian transformasi, ikuti urutan',
          'Jika sebuah titik ditranslasi lalu direfleksikan, gunakan hasil translasi sebagai masukan refleksi. Menukar urutan dua transformasi umumnya menghasilkan bayangan berbeda. Beri nama titik antara agar langkahnya mudah diperiksa.',
        ),
      ],
      'Titik P(2, −3) ditranslasi T(−4, 5), kemudian direfleksikan terhadap sumbu y. Tentukan bayangan akhirnya.',
      [
        'Tuliskan translasi: (x, y) → (x − 4, y + 5).',
        'Masukkan P: P′ = (2 − 4, −3 + 5) = (−2, 2).',
        'Gunakan P′ sebagai masukan refleksi sumbu y: (x, y) → (−x, y).',
        'Diperoleh P″ = (2, 2). Perubahan terakhir hanya terjadi pada tanda koordinat x.',
      ],
      'Bayangan akhirnya P″(2, 2). Titik antara P′ membantu menjaga urutan dua operasi.',
      'Mengubah kedua tanda koordinat untuk setiap refleksi, tanpa memeriksa sumbu cerminnya.',
      'Pada refleksi sumbu x, hanya y yang berganti tanda. Pada refleksi sumbu y, hanya x yang berganti tanda. Menukar keduanya mempunyai makna transformasi lain.',
      [
        check(
          'transformasi-0-a',
          'Titik (−3, 4) ditranslasi T(5, −1). Tentukan bayangannya.',
          '(2, 3)',
          'Tambahkan vektor translasi: (−3 + 5, 4 − 1) = (2, 3).',
        ),
        check(
          'transformasi-0-b',
          'Apa refleksi titik (1, −2) terhadap garis y = x?',
          '(−2, 1)',
          'Refleksi pada y = x menukar koordinat x dan y tanpa perubahan tanda tambahan.',
        ),
      ],
    ),
    lesson(
      'Rotasi memutar titik terhadap pusat tertentu dengan sudut dan arah tertentu. Jarak titik ke pusat tetap sama. Sebelum memakai aturan koordinat, tentukan pusat rotasi dan arah positifnya. Dalam konvensi biasa, sudut positif berlawanan arah jarum jam. Rumus cepat untuk pusat O tidak boleh langsung dipakai ketika pusatnya berada di titik lain.',
      [
        section(
          'Aturan rotasi berpusat O',
          'Untuk rotasi positif berpusat O(0,0), 90° memetakan (x, y) menjadi (−y, x), 180° menjadi (−x, −y), dan 270° menjadi (y, −x). Rotasi 90° searah jarum jam sama dengan 270° berlawanan arah jarum jam.',
        ),
        section(
          'Pusat lain memerlukan koordinat relatif',
          'Jika pusatnya C(a, b), kurangi koordinat titik dengan (a, b) dahulu. Putar koordinat relatif menggunakan aturan berpusat O, kemudian tambahkan (a, b) untuk mengembalikan letaknya pada bidang semula.',
        ),
        section(
          'Periksa dengan jarak dan arah',
          'Kuadrat jarak ke pusat sebelum dan sesudah rotasi harus sama. Kamu juga dapat memeriksa kuadrannya. Misalnya, titik di sumbu x positif yang diputar 90° berlawanan jarum jam berpindah ke sumbu y positif.',
        ),
      ],
      'Putar P(4, 2) sebesar 90° berlawanan arah jarum jam dengan pusat C(1, 1).',
      [
        'Geser ke koordinat relatif terhadap pusat: (4 − 1, 2 − 1) = (3, 1).',
        'Putar 90° berlawanan jarum jam: (3, 1) → (−1, 3).',
        'Kembalikan pusat: (−1 + 1, 3 + 1) = (0, 4).',
        'Periksa jarak kuadrat: sebelum 3² + 1² = 10 dan sesudah (0 − 1)² + (4 − 1)² = 10.',
      ],
      'Bayangan P adalah (0, 4). Jarak ke pusat C tetap, sesuai sifat rotasi.',
      'Memakai aturan (−y, x) langsung pada P meskipun pusat rotasinya bukan O.',
      'Rumus berpusat O bekerja pada koordinat relatif. Untuk pusat lain, lakukan tiga tahap: geser ke pusat, putar, lalu geser kembali.',
      [
        check(
          'transformasi-1-a',
          'Putar (3, −2) sebesar 90° berlawanan jarum jam berpusat O.',
          '(2, 3)',
          'Gunakan (−y, x): (−(−2), 3) = (2, 3).',
        ),
        check(
          'transformasi-1-b',
          'Putar (3, −2) sebesar 270° berlawanan jarum jam berpusat O.',
          '(−2, −3)',
          'Gunakan (y, −x): (−2, −3). Ini sama dengan rotasi 90° searah jarum jam.',
        ),
      ],
    ),
    lesson(
      'Dilatasi mengubah jarak titik terhadap pusat dengan suatu faktor skala. Jika besar faktornya lebih dari satu, jarak membesar; jika di antara nol dan satu, jarak mengecil. Faktor negatif juga menempatkan bayangan pada arah berlawanan terhadap pusat. Bedakan perubahan panjang, luas, dan koordinat karena masing-masing mempunyai aturan yang terkait tetapi tidak sama.',
      [
        section(
          'Dilatasi berpusat O',
          'Dengan pusat O, aturan Dₖ adalah (x, y) → (kx, ky). Faktor k mengalikan kedua koordinat. Panjang dikalikan |k|; tanda negatif menunjukkan perubahan arah, bukan panjang yang negatif.',
        ),
        section(
          'Pusat C memakai selisih koordinat',
          'Untuk pusat C(a, b), bayangan P(x, y) adalah (a + k(x − a), b + k(y − b)). Kurangi koordinat pusat, kalikan faktor, lalu tambahkan kembali pusat. Pusat dilatasi sendiri selalu tetap.',
        ),
        section(
          'Luas berubah dengan kuadrat faktor',
          'Jika seluruh bangun didilatasi dengan faktor k, luasnya dikalikan k². Jadi faktor panjang 2 menghasilkan faktor luas 4. Ini dapat dibayangkan dari persegi: panjang dan lebarnya masing-masing berubah dengan faktor yang sama.',
        ),
      ],
      'Titik P(3, 5) didilatasi dengan pusat C(1, 2) dan faktor k = 2. Tentukan bayangannya.',
      [
        'Hitung koordinat relatif: P − C = (3 − 1, 5 − 2) = (2, 3).',
        'Kalikan dengan k: 2(2, 3) = (4, 6).',
        'Tambahkan kembali pusat: (1, 2) + (4, 6) = (5, 8).',
        'Periksa bahwa vektor dari C ke bayangan (4, 6) adalah dua kali vektor dari C ke P (2, 3).',
      ],
      'Bayangan P adalah (5, 8). Jarak ke pusat menjadi dua kali, sedangkan luas bangun yang ditransformasikan akan menjadi empat kali.',
      'Mengalikan luas hanya dengan k, atau langsung mengalikan koordinat dengan k untuk pusat yang bukan O.',
      'Tuliskan apa yang ditanyakan: koordinat, panjang, atau luas. Gunakan pusat yang benar untuk koordinat, |k| untuk faktor panjang, dan k² untuk faktor luas.',
      [
        check(
          'transformasi-2-a',
          'P(2, −3) didilatasi berpusat O dengan faktor −2. Apa bayangannya?',
          '(−4, 6)',
          'Kalikan kedua koordinat dengan −2. Tanda negatif memindahkan bayangan ke arah berlawanan terhadap pusat.',
        ),
        check(
          'transformasi-2-b',
          'Bangun berluas 12 satuan² didilatasi dengan faktor 1,5. Berapa luas bayangannya?',
          '27 satuan²',
          'Faktor luasnya 1,5² = 2,25. Luas bayangan = 12 × 2,25 = 27 satuan².',
        ),
      ],
    ),
  ],
};
