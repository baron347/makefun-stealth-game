// Synthesized sound only: every effect is a WebAudio oscillator blip, so
// the game ships no audio files and makes no network request.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, gain, slideTo = null, when = 0) {
    if (!ensure() || muted) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // A coin picked up: a bright two-note chime.
  function pickup() {
    blip(880, 0.09, 'sine', 0.5);
    blip(1318, 0.12, 'sine', 0.4, null, 0.07);
  }

  // The meter filled: a low sawtooth warning.
  function alert() {
    blip(220, 0.3, 'sawtooth', 0.35, 165);
  }

  // A wing cleared: a short rising arpeggio.
  function clear() {
    blip(523, 0.12, 'triangle', 0.45);
    blip(659, 0.12, 'triangle', 0.45, null, 0.11);
    blip(784, 0.2, 'triangle', 0.45, null, 0.22);
  }

  // Caught: a falling tone.
  function caught() {
    blip(392, 0.4, 'sawtooth', 0.35, 98);
  }

  // A thrown coin lands: a metallic ping.
  function clink() {
    blip(2093, 0.07, 'square', 0.12);
    blip(1568, 0.1, 'square', 0.1, null, 0.05);
  }

  // Footsteps: a soft tick, quieter the further away, panned by direction.
  // Wren's own steps are always centred and faint; a guard's steps tell the
  // player where the guard is.
  function step(who, x, playerX) {
    if (!ensure() || muted) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const dist = Math.abs(x - playerX);
    const vol = who === 'player' ? 0.05 : Math.max(0, 0.22 * (1 - dist / 340));
    if (vol <= 0.005) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(who === 'player' ? 140 : 110, t0);
    if (pan) pan.pan.value = Math.max(-0.8, Math.min(0.8, (x - playerX) / 300));
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    osc.connect(g);
    if (pan) {
      g.connect(pan);
      pan.connect(master);
    } else {
      g.connect(master);
    }
    osc.start(t0);
    osc.stop(t0 + 0.08);
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  function isMuted() {
    return muted;
  }

  // Touch the context once, from a user gesture, so later blips may sound.
  function unlock() {
    ensure();
  }

  return { pickup, alert, clear, caught, clink, step, setMuted, isMuted, unlock };
}
