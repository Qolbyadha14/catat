# catat by coreboylabs - aset logo

Arah terpilih: **A - Lembar Centang**. Halaman catatan (dokumen dengan sudut terlipat) yang sudah diberi centang, artinya keuangan yang tercatat dan terkendali. Wordmark `catat` huruf kecil dengan garis tunggal yang membulat, sehingga ikon dan huruf memakai bahasa bentuk yang sama.

Dua arah lain yang dieksplorasi: **B - C-Centang** (huruf c yang berubah menjadi centang, lebih abstrak dan tidak ada unsur dokumen) dan **C - Pita Catatan** (pembatas buku bercentang, sangat sederhana tetapi mirip ikon "bookmark" umum). Lembar perbandingannya ada di `../concepts/directions.png`.

## File

| File | Dipakai untuk |
|---|---|
| `catat-logo.svg` | Logo utama horizontal: ikon + `catat` + `by coreboylabs` (latar terang) |
| `catat-logo-dark.svg` | Versi latar gelap |
| `catat-logo-mono.svg` / `catat-logo-mono-white.svg` | Satu warna (navy / putih) |
| `catat-logo-compact.svg` (+ `-dark`, `-mono`) | Sidebar sempit, navigasi mobile: ikon + `catat` tanpa tanda tangan merek |
| `catat-icon.svg` | Ikon aplikasi mandiri (tile emerald), juga untuk PWA |
| `catat-icon-dark.svg` | Ikon aplikasi dengan tile navy |
| `catat-icon-small.svg`, `favicon.svg` | Versi kecil (tanpa garis judul dan lipatan) untuk 16-32 px |
| `catat-icon-maskable.svg`, `apple-touch-icon.svg` | PWA maskable dan layar utama iOS |
| `catat-mark*.svg` | Ikon saja tanpa tile (terang, gelap, mono) |
| `catat-wordmark*.svg` | Wordmark saja |
| `png/` | Pratinjau PNG (logo, ikon, compact) |
| `web/` | `favicon.ico` (16/32/48), PNG 16-64, `apple-touch-icon.png`, `icon-192/512`, `icon-maskable-512`, `site.webmanifest`, `head-snippet.html` |
| `catat-brand-preview.png` | Ringkasan visual semua variasi |

`../public/` berisi salinan siap pakai untuk Vite (favicon, ikon PWA, manifest, dan semua SVG di `public/brand/`). Skrip pembuatnya ada di `../tools/build_catat.py`; jalankan ulang untuk membangun semua aset dari geometri.

## Warna

| Nama | HEX | Dipakai |
|---|---|---|
| Emerald | `#059669` | Primer di latar terang |
| Emerald terang | `#10B981` | Primer di latar gelap |
| Navy | `#111827` | Wordmark, lipatan, tile gelap |
| Slate | `#64748B` / `#94A3B8` | `by coreboylabs` (terang / gelap) |
| Abu muda | `#F3F4F6` | Latar netral |

Kontras (WCAG): navy pada putih 17,7:1 · slate pada putih 4,8:1 · emerald `#059669` pada putih 3,8:1 (cukup untuk logo dan elemen besar, bukan untuk teks kecil) · emerald pada navy 4,7:1 · `#10B981` pada navy 7,0:1 · slate terang pada navy 6,9:1. Emerald `#10B981` murni hanya 2,5:1 pada putih, karena itu versi terang memakai `#059669`.

## Pemakaian

- **Ruang bebas**: 1 x di semua sisi, x = lebar lipatan ikon (sepertiga lebar halaman).
- **Ukuran minimum**: logo utama 200 px lebar (di bawah itu pakai compact) · compact 80 px · ikon saja 16 px (pakai `favicon.svg` / versi kecil di bawah 32 px).
- **Jangan**: meregangkan, memutar, mengganti warna di luar palet, menambah bayangan atau gradien, menaruh versi berwarna di atas foto yang ramai, atau mengetik ulang wordmark dengan font biasa.

## Vite + React

Salin isi `public/` ke folder `public/` proyek, lalu di `index.html`:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#111827" />
```

Logo yang otomatis mengikuti mode terang/gelap:

```jsx
<picture>
  <source srcSet="/brand/catat-logo-dark.svg" media="(prefers-color-scheme: dark)" />
  <img src="/brand/catat-logo.svg" alt="catat by coreboylabs" height="40" />
</picture>
```

Jika aplikasi punya toggle tema sendiri (bukan `prefers-color-scheme`), pilih file berdasarkan state tema.

## Catatan teknis

- Ikon berupa bentuk terisi dengan lubang sungguhan (`evenodd`), sehingga versi satu warna, gelap, dan tile memakai bentuk yang sama.
- Wordmark `catat` digambar dengan goresan (satu ketebalan, ujung bulat), jadi bobotnya mudah diedit; ubah `stroke-width` untuk menebalkan. Ekspor ke outline di editor vektor bila percetakan membutuhkannya.
- `by coreboylabs` sudah diubah menjadi outline dari Poppins Medium (lisensi SIL OFL), jadi tidak butuh font saat dipakai. Teks persisnya ada di `<title>` setiap SVG.
- Tidak ada teks hidup, gradien, filter, mask, atau gambar raster di file SVG.
- Belum dilakukan: pemeriksaan kemiripan dan hak merek, uji cetak, dan versi PDF/EPS.
