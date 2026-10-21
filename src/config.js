/* =====================================================================
 * [[API_SYSTEM:EDITOR_HOOK]]  — TITIK INTEGRASI EDITOR (sengaja belum diisi URL)
 * ---------------------------------------------------------------------
 * Untuk AI/developer berikutnya:
 *  1. Isi `url` di bawah dengan alamat builder (contoh: './builder/' atau
 *     'http://localhost:8000/builder/'). Gunakan path RELATIF untuk deploy.
 *  2. Pilih `openMode`:
 *       'navigate'   -> pindah halaman ke `url` setelah animasi opening
 *       'iframe'     -> tampilkan `url` di dalam #editor-mount
 *       'event-only' -> hanya kirim event (default saat url = null)
 *  3. Atau dengarkan event:  window.addEventListener('apisystem:editor-open', e => {...})
 *  4. Atau definisikan:      window.APISystem.onEditorOpen = (detail) => {...}
 * Semua titik integrasi: cari teks "[[API_SYSTEM:" di seluruh proyek.
 * ===================================================================== */
export const EDITOR_HOOK = {
  url: null,                       // [[API_SYSTEM:EDITOR_URL]]  <- isi di sini
  openMode: 'event-only',          // 'navigate' | 'iframe' | 'event-only'
  mountSelector: '#editor-mount',  // [[API_SYSTEM:EDITOR_MOUNT]] elemen tujuan mode 'iframe'
};

/* [[API_SYSTEM:EDITOR_OPEN]] dipanggil main.js tepat setelah animasi opening selesai */
export function openEditorHook(detail) {
  window.dispatchEvent(new CustomEvent('apisystem:editor-open', { detail }));
  try { if (window.APISystem && typeof window.APISystem.onEditorOpen === 'function') window.APISystem.onEditorOpen(detail); } catch (e) { console.error(e); }
  if (!EDITOR_HOOK.url) return false;
  if (EDITOR_HOOK.openMode === 'navigate') { location.assign(EDITOR_HOOK.url); return true; }
  if (EDITOR_HOOK.openMode === 'iframe') {
    const m = document.querySelector(EDITOR_HOOK.mountSelector);
    if (m) { m.innerHTML = ''; const f = document.createElement('iframe'); f.src = EDITOR_HOOK.url; f.title = 'API System Editor'; m.appendChild(f); m.classList.add('has-frame'); return true; }
  }
  return false;
}
