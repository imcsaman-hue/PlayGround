// Tiny procedural synth soundtrack + SFX. Everything is generated in the browser,
// so the game ships with no external music files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.delay = null;
    this.timer = null;
    this.nextTime = 0;
    this.step = 0;
    this.theme = null;
    this.muted = false;
    this.musicOn = false;
    this.noise = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.75;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.48;
      this.sfxBus.connect(this.master);

      this.delay = this.ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.22;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.26;
      this.delay.connect(fb);
      fb.connect(this.delay);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.34;
      this.delay.connect(wet);
      wet.connect(this.musicBus);

      // reusable noise buffer
      const len = this.ctx.sampleRate * 1;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.03);
    if (muted) this.stopMusic();
    else if (this.theme && this.musicOn) this.startMusic(this.theme);
  }

  startMusic(theme) {
    this.theme = theme;
    this.musicOn = true;
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;
    this.stopScheduler();
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.scheduler(), 28);
  }

  stopMusic() {
    this.musicOn = false;
    this.stopScheduler();
  }

  stopScheduler() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  scheduler() {
    if (!this.ctx || this.muted || !this.theme) return;
    const bpm = this.theme.bpm || 150;
    const stepDur = 60 / bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.13) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, time, dur) {
    const theme = this.theme;
    const scale = theme.scale || [0, 2, 3, 7, 10];
    const root = theme.root || 45;
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;

    // Kick
    if (s % 4 === 0) this.kick(time);
    // Snare
    if (s === 4 || s === 12) this.snare(time);
    // Hats
    if (s % 2 === 0) this.hat(time, s % 4 === 2 ? 0.055 : 0.03);
    if (bar === 3 && s >= 12 && s % 2 === 1) this.hat(time, 0.022, true);

    // Bass
    if ([0, 3, 6, 8, 11, 14].includes(s)) {
      const degree = scale[(step + bar * 2) % scale.length];
      const octave = s < 8 ? 0 : -12;
      this.bass(time, root + degree + octave, dur * 1.4);
    }

    // Arpeggio
    if (s % 2 === 0 && bar !== 2) {
      const note = root + 12 + scale[(step * 3) % scale.length] + (bar === 3 ? 12 : 0);
      this.lead(time, note, dur * 0.72, 0.045);
    }

    // Chord stab
    if (s === 0) {
      [0, 4, 7].forEach((offset, i) => {
        this.pad(time, root + 12 + scale[0] + offset, dur * 14, 0.011 + i * 0.002);
      });
    }
  }

  kick(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(128, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    g.gain.setValueAtTime(0.62, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    o.connect(g); g.connect(this.musicBus);
    o.start(time); o.stop(time + 0.22);
  }

  snare(time) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    src.connect(f); f.connect(g); g.connect(this.musicBus);
    src.start(time); src.stop(time + 0.15);
  }

  hat(time, gain, open = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.08 : 0.035));
    src.connect(f); f.connect(g); g.connect(this.musicBus);
    src.start(time); src.stop(time + 0.1);
  }

  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  bass(time, midi, len) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = this.mtof(midi - 12);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(480, time);
    f.Q.value = 7;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.13, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(time); o.stop(time + len + 0.02);
  }

  lead(time, midi, len, gain) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = this.mtof(midi);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    o.connect(g); g.connect(this.musicBus); g.connect(this.delay);
    o.start(time); o.stop(time + len + 0.02);
  }

  pad(time, midi, len, gain) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = this.mtof(midi);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    o.connect(g); g.connect(this.musicBus);
    o.start(time); o.stop(time + len + 0.02);
  }

  sfxJump() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(980, t + 0.09);
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.12);
  }

  sfxCoin() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.05);
      g.gain.linearRampToValueAtTime(0.11, t + i * 0.05 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.16);
      o.connect(g); g.connect(this.sfxBus);
      o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.18);
    });
  }

  sfxDeath() {
    this.stopMusic();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.55);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.66);
  }

  sfxWin() {
    this.stopMusic();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [0, 4, 7, 12, 16, 19, 24];
    notes.forEach((n, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = this.mtof(60 + n);
      const st = t + i * 0.085;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.12, st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.42);
      o.connect(g); g.connect(this.sfxBus);
      o.start(st); o.stop(st + 0.45);
    });
  }
}
