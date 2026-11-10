export type HapticType = 'click' | 'success' | 'delete' | 'tap';

const TAP_SOUND_KEY = 'catat_tap_sound';

// Getaran singkat seperti haptic native; diabaikan di perangkat tanpa Vibration API (misalnya iOS Safari)
const VIBRATION_PATTERNS: Record<HapticType, number | number[]> = {
  tap: 8,
  click: 8,
  success: [10, 40, 10],
  delete: 20,
};

let audioCtx: AudioContext | null = null;

/** Bunyi ketuk default mati; pengguna bisa menyalakannya di menu profil. */
export function isTapSoundEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(TAP_SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setTapSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(TAP_SOUND_KEY, enabled ? 'on' : 'off');
  } catch {
    // localStorage tidak tersedia; pengaturan hanya berlaku untuk sesi ini
  }
}

function vibrate(type: HapticType): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATION_PATTERNS[type]);
    }
  } catch {
    // Beberapa browser melempar error bila belum ada interaksi pengguna
  }
}

function playTone(type: HapticType): void {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  if (type === 'click' || type === 'tap') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.start(now);
    osc.stop(now + 0.04);
  } else if (type === 'success') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.06);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.16);
  } else if (type === 'delete') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

/**
 * Umpan balik ketuk: getaran singkat bila didukung, bunyi hanya bila diaktifkan pengguna.
 * Nama fungsi dipertahankan agar pemanggil yang ada tidak perlu diubah.
 */
export function playHapticSound(type: HapticType = 'click'): void {
  try {
    if (typeof window === 'undefined') return;
    vibrate(type);
    if (isTapSoundEnabled()) playTone(type);
  } catch {
    // Graceful no-op on autoplay rejection or unsupported audio
  }
}
