# API System — Landing Page (panduan integrasi untuk AI berikutnya)

Frontend statis (tanpa build, tanpa CDN). three.js r186 (WebGL2) ada di `vendor/`.
Tema/warna/animasi mengikuti `texture-main` (kaca terang, partikel, transisi panjang).

## Struktur
| File | Isi |
|---|---|
| `index.html` | Kerangka UI (header, label, legenda, panel info, opening, editor mount) |
| `styles/landing.css` | Tema (variabel `--acc`, `--acc2`, `--t`) |
| `src/data.js` | **NODES** (34 bubble: data, backend, tool, runtime), **EDGES** (relasi), **I18N** (JA utama / EN) |
| `src/config.js` | **Hook editor** — tempat mengisi URL builder |
| `src/main.js` | Scene three.js, interaksi, opening, bahasa |

## Penanda integrasi (cari `[[API_SYSTEM:`)
- `[[API_SYSTEM:EDITOR_URL]]` → `src/config.js`, `EDITOR_HOOK.url` (sengaja `null`).
- `[[API_SYSTEM:EDITOR_OPEN]]` → `openEditorHook()`: dipanggil setelah opening selesai.
- `[[API_SYSTEM:EDITOR_MOUNT]]` → `#editor-mount` di `index.html` (untuk mode `iframe`).
- `[[API_SYSTEM:EDITOR_OPENING]]` → overlay animasi opening.
- `[[API_SYSTEM:NODES]]` → daftar bubble; tambah objek baru, bubble & legenda otomatis muncul.
- `[[API_SYSTEM:PUBLIC_API]]` → `window.APISystem` (`openEditor, closeEditor, select, setLang, nodes, edges, onEditorOpen`).

## Cara menyambungkan ke builder
1. Isi `EDITOR_HOOK.url` mis. `'./builder/'` dan `openMode: 'navigate'` (atau `'iframe'`).
2. Atau tanpa mengubah file: `window.addEventListener('apisystem:editor-open', e => {...})`.
3. Builder yang ada (`RUN_API_SYSTEM.bat`) berjalan di `http://localhost:8000/builder/`.

## Perilaku
- Klik bubble tengah → opening ~3 dtk (zoom, gelombang cincin, grid partikel) → editor/hook.
- Klik bubble kecil → kamera memutar bubble ke kiri + panel keterangan (peran, field output, tautan, tahap).
- Drag = putar, wheel = zoom, `Esc` = tutup panel/kembali. Bahasa disimpan di `localStorage` (`apisys-lang`).
