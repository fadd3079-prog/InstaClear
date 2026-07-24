# Product Requirements Document (PRD)
**Project Name:** InstaClear - Safe IG Unfollow Dashboard
**Version:** 1.0.0
**Document Status:** Final/Approved
**Platform:** Client-Side Web Application (Vercel + Supabase)

## 1. Executive Summary
InstaClear adalah aplikasi web *client-side* berbasis arsitektur *serverless* yang dirancang untuk memproses, membandingkan, dan memfilter data mentah HTML hasil ekspor Meta (Instagram). Tujuan utama sistem ini adalah mengeleminasi risiko pemblokiran akun (*Action Block/Banned*) yang sering terjadi pada penggunaan *bot automation*, dengan cara menyediakan Dasbor Interaktif untuk eksekusi *unfollow* secara manual namun terukur. Sistem mengandalkan penyimpanan berbasis *cloud* (Supabase) untuk melacak kemajuan (*state management*) secara *real-time*.

## 2. Product Objectives & Goals
*   **Keamanan Ekstrem:** Memproses file HTML secara lokal di memori *browser* klien (DOM Parsing) tanpa mengunggah data sensitif ke server.
*   **Akurasi Presisi:** Membandingkan berbagai lapisan data (Followers, Following, Pending, Recent, Blacklist) menggunakan operasi himpunan (*Set Mathematics*).
*   **Sinkronisasi Real-time:** Menjaga agar daftar target *unfollow* tetap tersinkronisasi lintas perangkat menggunakan Supabase PostgreSQL.
*   **Profesionalisme UI/UX:** Menyajikan antarmuka pengguna yang bersih, profesional, bebas gangguan, dan sesuai standar korporat tanpa penggunaan ornamen informal (seperti emoji).

## 3. Technology Stack
*   **Frontend Core:** HTML5, Vanilla JavaScript (ES6+), CSS3.
*   **Styling:** Tailwind CSS (via CDN untuk efisiensi awal, atau *build step* ringan).
*   **Database & Auth (Opsional/Anonymous):** Supabase JS Client.
*   **Hosting & CI/CD:** Vercel (terhubung langsung ke GitHub Repo).
*   **Iconography:** SVG Icons (Lucide / Heroicons). *Dilarang keras menggunakan Emoji bawaan OS.*

## 4. Data Processing Architecture (Core Logic)
Sistem membaca dan mengekstrak *username* dari 6 file HTML ekspor Meta yang diunggah pengguna ke area *Dropzone*. Pola ekstraksi didasarkan pada struktur DOM asli:

1.  **Dataset Utama (A & B):** 
    *   File `following.html` (Set A): Diekstrak dari tag `<a>` yang mengandung *path* `_u/`[cite: 20].
    *   File `followers_1.html` (Set B): Diekstrak dari tag tautan `<a>` yang langsung mengarah ke *username*[cite: 19].
2.  **Dataset Menunggu (C & D):**
    *   File `pending_follow_requests.html` (Set C): Diekstrak dari elemen bersarang tabel HTML `<td>` bersanding[cite: 15].
    *   File `recent_follow_requests.html` (Set D): Diekstrak dari struktur tabel yang sama[cite: 16], berfungsi sebagai masa tenggang (*Grace Period*).
3.  **Dataset Blacklist (E & F):**
    *   File `recently_unfollowed_profiles.html` (Set E)[cite: 17] dan `removed_suggestions.html` (Set F)[cite: 18]. Kedua file ini diekstrak dari tabel untuk menjadi daftar blokir agar tidak dimunculkan di dasbor.

**Algoritma Kalkulasi Himpunan:**
`Target Akhir = ((Set A - Set B) ∪ Set C) - (Set D ∪ Set E ∪ Set F)`

## 5. Fitur Utama & Fungsionalitas
1.  **Local Dropzone API:** Area unggah file interaktif yang memvalidasi ekstensi `.html` dan menolak unggahan ke server. Menggunakan `FileReader` untuk membaca struktur DOM.
2.  **Audit Engine:** Mesin kalkulasi *client-side* yang menjalankan algoritma himpunan di atas.
3.  **Actionable Data Grid:** Tabel dasbor yang menampilkan *username*, status eksekusi, dan dua tombol aksi (Ikon 'Buka Tautan' dan Ikon 'Tandai Selesai').
4.  **Supabase Sync State:** Setiap tombol 'Tandai Selesai' ditekan, JavaScript mengirim *payload* asinkronus ke Supabase untuk mencatat `username` dengan bendera `is_unfollowed = true`. Baris pada tabel UI akan secara otomatis disembunyikan atau diubah desainnya (warna pudar).

## 6. Project Directory & File Structure
Struktur repositori dirancang modular agar mudah diskalakan:

```text
InstaClear/
├── src/
│   ├── js/
│   │   ├── app.js            # Inisialisasi utama dan DOM Listeners
│   │   ├── parser.js         # Logika DOMParsing untuk 6 file HTML Meta
│   │   ├── calculator.js     # Logika Set Mathematics
│   │   └── supabase-client.js# Konfigurasi dan API Wrapper untuk Supabase
│   ├── css/
│   │   └── tailwind-custom.css # Kelas kustom melengkapi Tailwind
│   └── assets/
│       └── icons/            # Kumpulan file .svg murni (Lucide/Heroicons)
├── index.html                # Kerangka antarmuka utama pengguna (UI)
├── DESIGN.md                 # Standarisasi desain UI/UX 
├── README.md                 # Dokumentasi publik GitHub
└── PRD.md                    # Dokumen persyaratan ini

```

## 7. Detailed Function Specifications (JavaScript)

### A. Modul `parser.js`

* `parseLinkBasedHTML(htmlString)`: Menerima *raw string* dari `following.html` atau `followers_1.html`. Menggunakan `DOMParser`, mencari semua `<a>[target="_blank"]`. Menggunakan *Regular Expression* tingkat lanjut untuk mengekstrak *username* dengan mengabaikan elemen `_u/` pada URL. Mengembalikan struktur data `Set`.
* `parseTableBasedHTML(htmlString)`: Menerima *raw string* dari file berbasis tabel (contoh: `pending_follow_requests.html`). Mengiterasi semua `<tr>`, mencari elemen `<td>` yang memiliki teks spesifik (misal: "Nama pengguna"), dan mengambil `textContent` dari elemen `<td>` berikutnya (*sibling*). Mengembalikan struktur data `Set`.

### B. Modul `calculator.js`

* `computeFinalTargets(datasetObject)`: Menerima objek yang berisi keenam `Set` yang telah diekstrak. Mengembalikan Array hasil akhir yang telah disortir berdasarkan abjad.

### C. Modul `supabase-client.js`

* `initializeSupabase(url, key)`: Membangun koneksi ke pangkalan data.
* `fetchUserProgress(sessionId)`: Mengambil daftar *username* yang statusnya sudah `unfollowed` untuk memvalidasi UI saat *refresh*.
* `updateTargetStatus(sessionId, username, status)`: Melakukan metode UPSERT (Update/Insert) ke tabel Supabase saat pengguna menandai sebuah baris.

### D. Modul `app.js`

* `handleDragAndDrop(event)`: Mengelola status visual saat file digeser ke area dropzone.
* `processFiles(fileList)`: Mengkoordinasikan pemanggilan modul parser dan kalkulator, serta merender hasil akhir ke dalam DOM (tabel).

## 8. UI/UX & Writing Guidelines

* **Standar Desain:** Antarmuka harus tunduk sepenuhnya pada pedoman `DESIGN.md`. Tata letak memanfaatkan Tailwind CSS dengan desain *minimalist*, tipografi sans-serif (Inter/Roboto), dan penggunaan ruang putih (*whitespace*) yang optimal.
* **UX Writing:** Gunakan diksi profesional, ringkas, dan instruksional. (Contoh Benar: "Unggah File Ekspor Meta", Contoh Salah: "Yuk masukin file IG kamu disini!").
* **Manajemen Ikon:** DILARANG KERAS menggunakan Emoji Unicode di elemen UI mana pun (contoh: ❌, ✅, 🗑️). Semua representasi visual harus menggunakan grafik vektor (SVG) dari perpustakaan ikon profesional.

## 9. Strict Development Constraints

* **Clean Code Principle:** Kode sumber (HTML, CSS, JS) harus merepresentasikan kode produksi yang bersih. Penamaan variabel harus deskriptif (contoh: `const pendingRequestsSet`, BUKAN `const prSet`).
* **Zero Comment Policy:** Seluruh berkas `.js` dan `.html` dilarang memuat komentar kode (seperti `// fungsi ini digunakan untuk...` atau `<!-- header -->`). Kode harus mampu mendeskripsikan dirinya sendiri melalui struktur dan penamaan (*self-documenting code*). Komentar hanya diizinkan di dalam dokumentasi Markdown (PRD, README, DESIGN).
* **Error Handling:** JS harus memiliki blok `try...catch` yang secara diam-diam (*silent handle*) menangani kegagalan pembacaan HTML tanpa menghentikan seluruh operasi sistem.

## 10. Database Schema & Data Modeling (Supabase)
Sistem menggunakan PostgreSQL melalui Supabase untuk memastikan sinkronisasi data yang persisten. Skema dirancang tanpa memerlukan autentikasi login (menggunakan Session UUID yang di-generate secara lokal di browser).

### Tabel 1: `audit_sessions`
Berfungsi sebagai entitas induk untuk melacak kapan pengguna melakukan unggah file HTML.
*   `session_id` (UUID) - Primary Key, di-generate oleh `crypto.randomUUID()` di sisi klien.
*   `device_identifier` (Text) - Menyimpan *hash* dari tipe *browser* atau ID unik lokal untuk melacak sesi pengguna yang kembali.
*   `created_at` (Timestamp with Timezone) - Otomatis diisi oleh Supabase `now()`.
*   `total_targets` (Integer) - Total kalkulasi akhir target sebelum dieksekusi.

### Tabel 2: `unfollow_targets`
Berfungsi sebagai entitas relasional untuk mencatat detail setiap target *username*.
*   `target_id` (UUID) - Primary Key.
*   `session_id` (UUID) - Foreign Key, berelasi dengan `audit_sessions(session_id)`. Mode penghapusan: `CASCADE`.
*   `ig_username` (Text) - Menyimpan nama akun Instagram target (harus *lowercase* dan dibersihkan dari spasi/karakter khusus).
*   `source_category` (VarChar) - Menggunakan batasan enum: `NOT_FOLLOWING_BACK` atau `PENDING_REQUEST`.
*   `action_status` (VarChar) - Menggunakan batasan enum: `WAITING`, `UNFOLLOWED`, `IGNORED`. Default: `WAITING`.
*   `executed_at` (Timestamp with Timezone) - Merekam stempel waktu persis saat tombol 'Tandai Selesai' ditekan. Nullable.

## 11. Application Lifecycle & State Management
JavaScript pada sisi klien (`app.js`) harus mengelola siklus hidup aplikasi secara ketat menggunakan pola *Finite State Machine* (FSM).

1.  **State: `IDLE`**
    *   Kondisi: Pengguna baru memuat halaman web.
    *   UI Terlihat: Area *Dropzone* kosong menunggu aksi *drag-and-drop*.
2.  **State: `VALIDATING`**
    *   Kondisi: Pengguna melepaskan file ke area *Dropzone*.
    *   Tindakan: Sistem memvalidasi `File.type` (wajib `text/html`) dan ukuran file. Sistem mengidentifikasi jenis file berdasarkan `File.name` (contoh: mencocokkan regex `/following/i`).
3.  **State: `PARSING_AND_COMPUTING`**
    *   Kondisi: File valid.
    *   Tindakan: Memanggil `new FileReader()` dan membaca sebagai teks menggunakan `readAsText()`. Teks dikirim ke `DOMParser().parseFromString(text, 'text/html')`. Fungsi himpunan matematika dijalankan. UI menampilkan indikator pemrosesan (SVG Spinner) untuk mencegah interaksi ganda.
4.  **State: `READY`**
    *   Kondisi: Algoritma selesai. *Array* target sudah terbentuk.
    *   Tindakan: Menyembunyikan *Dropzone*, merender tabel `Data Grid`, dan mengirim beban data (*payload*) asinkronus pertama ke Supabase untuk membuat baris di tabel `audit_sessions`.
5.  **State: `MUTATING`**
    *   Kondisi: Pengguna mengklik "Tandai Selesai" pada baris tertentu.
    *   Tindakan: Baris tabel terkait mendapatkan *class* CSS `.is-executed` (mengubah opasitas menjadi 0.5 dan memberikan teks coret). Fungsi `supabase-client.js` dipanggil untuk melakukan `UPDATE` pada tabel `unfollow_targets` di mana `ig_username` cocok.

## 12. DOM Parsing Strategy & Selectors Strict Rules
Sistem dilarang menggunakan *selector* CSS yang mudah berubah (seperti *class* hasil *obfuscation* contohnya `._3-95`). *Selector* harus menargetkan struktur HTML bawaan yang absolut.

*   **Strategi File `followers` & `following`:**
    Sistem hanya akan mencari elemen menggunakan pemilih: `a[target="_blank"][href*="instagram.com"]`.
    Data diambil melalui ekstraksi atribut `href`. *String* URL akan dibelah (*split*) dan *username* diambil pada segmen jalur (*path segment*) terakhir, memastikan parameter `_u/` atau `?igsh=` dihilangkan dengan metode *Regex*.
*   **Strategi File Berbasis Tabel (`pending_follow_requests`, dll):**
    Sistem akan mencari seluruh tag `<tr>`. Di dalam setiap *node* `<tr>`, sistem mencari elemen `<td>` pertama. Jika `textContent` mengandung *string* absolut "Nama pengguna" atau "Username", sistem akan mengambil `textContent` dari elemen `nextElementSibling` (yaitu `<td>` kedua).

## 13. Edge Cases & Error Handling Specifications
Ketahanan sistem (*Robustness*) harus dijamin dengan menangani anomali berikut:

*   **Error 01: Missing Mandatory Files:**
    Jika pengguna hanya memasukkan `following.html` tanpa `followers_1.html`, kalkulasi tidak bisa dilakukan. 
    *Handling:* UI memblokir transisi ke State `READY` dan merender peringatan berdesain profesional berwarna peringatan: "Berkas Pengikut (Followers) belum disertakan. Kalkulasi himpunan memerlukan data ini."
*   **Error 02: Corrupted HTML Structure:**
    Jika Meta mengubah struktur ekspor HTML mereka di masa depan sehingga DOMParser mengembalikan 0 *username*.
    *Handling:* Tampilkan log diagnosis ke *console* dan tampilkan komponen status kosong (Empty State SVG) dengan teks "Struktur berkas tidak valid atau tidak memuat daftar nama pengguna."
*   **Error 03: Supabase Network Timeout / AdBlocker Block:**
    Jika ekstensi keamanan pengguna memblokir permintaan (*request*) API keluar ke domain Supabase.
    *Handling:* Terapkan metode *Graceful Degradation*. Sistem harus *fallback* (turun tingkat) secara otomatis untuk menggunakan `localStorage` dari *browser*. Data tetap tersimpan di perangkat lokal sehingga pengguna tidak kehilangan kemajuan, dan *console* akan mencatat *silent warning*.

## 14. Security & Content Security Policy (CSP)
Meski aplikasi dijalankan seluruhnya di sisi klien (Client-Side), standar keamanan *enterprise* tetap diterapkan.
*   Tidak ada *string* HTML masukan dari pengguna yang dimuat langsung ke DOM layar (dilarang menggunakan `innerHTML` pada hasil ekstraksi). Ekstraksi *username* hanya mengembalikan tipe *String* murni, yang kemudian disisipkan ke antarmuka menggunakan `textContent` atau pembuatan simpul (*Node Creation* melalui `document.createElement`) untuk menghindari kerentanan *Cross-Site Scripting* (XSS).
*   Kredensial API Supabase (`SUPABASE_URL` dan `SUPABASE_ANON_KEY`) bersifat publik dalam arsitektur aplikasi sisi klien. Oleh karena itu, aturan keamanan tingkat baris (*Row Level Security* / RLS) pada konsol Supabase wajib diaktifkan: pengguna anonim hanya memiliki izin `INSERT` dan `UPDATE` pada sesi miliknya sendiri (berdasarkan UUID lokal), tanpa memiliki izin membaca (`SELECT`) sesi milik pengguna global lainnya.

## 15. Deployment & CI/CD Pipeline (Vercel)
Aplikasi mematuhi integrasi berkelanjutan (*Continuous Integration*).
*   Infrastruktur repositori GitHub dihubungkan secara *webhook* ke Vercel. 
*   Cabang (*branch*) `main` dilindungi (*protected*). Setiap *push* ke cabang `main` akan memicu siklus pembangunan (*build cycle*) otomatis.
*   Variabel lingkungan (*Environment Variables*) untuk kredensial Supabase harus didaftarkan pada dasbor Vercel (menu *Settings > Environment Variables*) dan tidak boleh di- *hardcode* dalam struktur *repository* mentah.