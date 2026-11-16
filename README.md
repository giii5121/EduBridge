# EduBridge — Web

Prototype frontend platform pembelajaran matematika untuk siswa. Siswa dapat melihat katalog materi, mengerjakan kuis (pre-test, post-test, remedial), dan memantau progres belajar dalam satu dashboard.

> Status: **prototype frontend**. Data kuis masih statis dan hasil pengerjaan disimpan di `localStorage`; integrasi backend/API direncanakan pada tahap berikutnya.

## Teknologi

- React 19 + Vite
- React Router 7
- Tailwind CSS 3
- Oxlint

## Menjalankan proyek

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

Perintah lain:

```bash
npm run build    # build produksi
npm run preview  # pratinjau hasil build
npm run lint     # cek lint
```

## Halaman

| Route | Halaman |
|---|---|
| `/login` | Login siswa |
| `/register` | Registrasi akun |
| `/dashboard` | Ringkasan belajar, pengingat, pre-test/post-test, grafik progres |
| `/katalog` | Katalog materi, pencarian, filter kategori, reminder belajar |
| `/kuis` | Kuis per topik (pre-test/post-test/remedial), timer, pembahasan |
| `/progres` | Statistik belajar, progres per topik, pencapaian |
| `/profil` | Informasi akun, pencapaian, pengaturan |

## Alur demo yang disarankan

1. `/login` → masuk ke dashboard.
2. `/dashboard` → lihat ringkasan, pengingat, dan grafik.
3. `/katalog` → pilih materi (mis. Aljabar/Geometri).
4. `/kuis` → pilih mode pre-test, kerjakan, lihat hasil & pembahasan.
5. `/progres` → lihat nilai, progres per materi, dan pencapaian.
6. `/profil` → lihat informasi akun, lencana, dan pengaturan.

## Struktur sumber

```text
src/
  assets/images/        # aset gambar & maskot
  components/
    layout/             # AuthLayout, DashboardLayout
    ui/                 # Button, Input, Checkbox
  pages/
    auth/               # Login, Register
    dashboard/          # Dashboard, KatalogMateri, Kuis, Progres, Profil
    dashboard/quizData.js
  routes/AppRouter.jsx  # definisi route aplikasi
  utils/storage.js      # helper localStorage (hasil kuis, profil, preferensi)
```

## Penyimpanan data (sementara)

Data disimpan di browser melalui `localStorage`:

- `edubridge-quiz-attempts` — hasil kuis per topik/mode.
- `edubridge-profile` — data profil yang diubah pengguna.
- `edubridge-notifications` — preferensi pengingat belajar.

Untuk mereset data demo, hapus ketiga key tersebut dari DevTools → Application → Local Storage, lalu muat ulang halaman.

## Rencana berikutnya

- Backend API (controller + route) untuk autentikasi, profil, materi, kuis, dan progres.
- Database terintegrasi (schema + migration + seed).
- Menghubungkan halaman frontend ke API dan mengganti penyimpanan `localStorage`.
