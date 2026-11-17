# Referensi endpoint EduBridge

- **GET /api/health** — Kesehatan API aplikasi. Akses: publik. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/ready** — Kesiapan database dan layanan diagnosis. Akses: publik. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/config** — Konfigurasi publik aplikasi. Akses: publik. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/auth/login** — Masuk dan membuat cookie sesi. Akses: publik. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/auth/register** — Mendaftarkan siswa ke kelas. Akses: publik. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/auth/logout** — Keluar dan mencabut sesi. Akses: pengguna terautentikasi. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/auth/me** — Identitas pengguna yang sedang masuk. Akses: pengguna terautentikasi. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/bootstrap** — Data awal, katalog, progres, dan kelas. Akses: pengguna terautentikasi. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **PATCH /api/profile** — Mengubah profil dan preferensi. Akses: pengguna terautentikasi. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/profile/password** — Mengganti password dan mencabut sesi lama. Akses: pengguna terautentikasi. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/assessments** — Memulai atau melanjutkan asesmen. Akses: student. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/assessments/{assessmentId}** — Membaca asesmen milik siswa. Akses: student. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **PATCH /api/assessments/{assessmentId}** — Menyimpan jawaban sementara. Akses: student. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/assessments/{assessmentId}/submit** — Mengumpulkan dan mendiagnosis jawaban. Akses: student. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/topics/{topicId}/lesson** — Menyelesaikan materi dalam siklus pembelajaran. Akses: student. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/assistant** — Pendamping konsep di luar asesmen aktif. Akses: student. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/assessments/{assessmentId}/narrative** — Ringkasan hasil asesmen dari fakta diagnosis. Akses: student. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/classes** — Daftar kelas sesuai kepemilikan. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/classes** — Membuat kelas XI. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/classes/{classId}** — Detail kelas, siswa, dan penguasaan atribut. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/classes/{classId}/narrative** — Ringkasan kebutuhan konsep satu kelas. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **PATCH /api/classes/{classId}/phase** — Mengatur fase pretest, pembelajaran, atau posttest. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/classes/{classId}/export** — Ekspor hasil kelas dalam CSV. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/admin/overview** — Pengguna, kelas, materi, audit, dan status layanan. Akses: admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/admin/users** — Membuat akun siswa, guru, atau admin. Akses: admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **PATCH /api/admin/users/{userId}** — Mengaktifkan atau menonaktifkan akun. Akses: admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **PATCH /api/admin/topics/{topicId}** — Mengedit materi inti dan bank soal terkontrol. Akses: admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/materials** — Daftar materi sesuai izin dan kelas. Akses: pengguna terautentikasi. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/materials** — Membuat materi kelas atau materi umum. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **GET /api/materials/{materialId}** — Membaca isi materi. Akses: pengguna terautentikasi. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **PATCH /api/materials/{materialId}** — Mengedit materi dengan pengecekan versi. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **DELETE /api/materials/{materialId}** — Menghapus materi secara logis. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.
- **POST /api/materials/generate** — Menyusun draf AI yang wajib ditinjau manusia. Akses: teacher, admin. Kepemilikan kelas/asesmen diperiksa kembali di backend.

## FastAPI

- **GET /health** — Health
- **GET /ready** — Ready
- **GET /v1/models** — Models
- **POST /v1/diagnose** — Diagnose
- **POST /v1/compare** — Compare
- **POST /v1/narrative** — Narrative
- **POST /v1/tutor** — Tutor
- **POST /v1/materials/generate** — Generate a lesson draft requiring human review
- **POST /v1/class-narrative** — Class Narrative
