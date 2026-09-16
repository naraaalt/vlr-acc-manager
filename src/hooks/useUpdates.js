import { useCallback, useEffect, useState } from 'react';
import { getSetting } from '../lib/settings.js';

// Menjembatani update:check / update:download / update:install. Semua kerja nyata ada di main
// process; hook ini cuma menyimpan status supaya UI bisa menggambarnya.
//
// Cek otomatis dijalankan SEKALI per sesi, setelah window sempat paint, dan hanya kalau
// settingnya hidup: cek update adalah request pihak ketiga, dan app ini sengaja menekan jumlahnya.
export function useUpdates() {
  const [version, setVersion] = useState(null);
  const [release, setRelease] = useState(null);
  const [status, setStatus] = useState('idle');   // idle|checking|available|downloading|ready|installing|error
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Method bridge ini dijamin ada oleh gate `npm run bridge`, jadi try/catch-nya bukan penutup
    // bug: tujuannya memastikan kekurangan apa pun di sisi MOCK tidak bikin app blank saat mount,
    // yang merupakan mode gagal terburuk di sini.
    try {
      window.valorant.getAppVersion().then(setVersion).catch(() => {});
      window.valorant.onUpdateProgress((update) => setProgress(update));
    } catch { /* bridge tanpa method update: panel tetap tampil, versinya kosong */ }
  }, []);

  const check = useCallback(async ({ force = false } = {}) => {
    setStatus('checking');
    setError(null);
    try {
      const response = await window.valorant.checkForUpdates({ force });
      if (!response.ok) throw new Error(response.error);
      setRelease(response.data);
      setStatus(response.data.available ? 'available' : 'idle');
      return response.data;
    } catch (failure) {
      // Kegagalan TIDAK pernah jadi toast saat cek otomatis — keputusan produk: offline harus
      // terasa seperti tidak terjadi apa-apa. Pesannya cuma muncul di baris SYSTEM kalau user
      // sendiri yang mencet CHECK NOW; tombol yang ditekan lalu diam akan terbaca sebagai rusak.
      setError(failure.message);
      setStatus('error');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!getSetting('autoCheckUpdates')) return undefined;
    // Ditunda supaya render pertama (dan dashboard yang mahal) tidak bersaing dengan request ini.
    const timer = setTimeout(() => { check(); }, 2500);
    return () => clearTimeout(timer);
  }, [check]);

  const download = useCallback(async () => {
    if (!release?.installer) return null;
    setStatus('downloading');
    setError(null);
    setProgress(null);
    try {
      const response = await window.valorant.downloadUpdate(release);
      if (!response.ok) throw new Error(response.error);
      setStatus('ready');
      return response.data;
    } catch (failure) {
      // Unduhan gagal itu BUKAN keadaan senyap: user baru saja mengonfirmasi dialog, jadi ia
      // harus tahu. Kembali ke 'available' supaya pill-nya menawarkan percobaan kedua.
      setError(failure.message);
      setStatus('available');
      return null;
    }
  }, [release]);

  const install = useCallback(async () => {
    setStatus('installing');
    const response = await window.valorant.installUpdate();
    if (!response.ok) { setError(response.error); setStatus('ready'); return false; }
    // Kalau sukses, app-nya keluar sebentar lagi — tidak ada state yang perlu dirapikan.
    return true;
  }, []);

  return { version, release, status, progress, error, check, download, install };
}