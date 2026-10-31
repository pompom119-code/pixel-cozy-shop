// Synthesized 8-bit chiptune sound effects using Web Audio API

class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'square',
    delaySec = 0,
    gainLevel = 0.055
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec);
  }

  public playPickup() {
    this.playTone(440, 0.05, 'triangle', 0, 0.055);
    this.playTone(587.33, 0.06, 'triangle', 0.03, 0.05);
  }

  public playChop() {
    this.playTone(220, 0.04, 'sawtooth', 0, 0.05);
    this.playTone(660, 0.04, 'triangle', 0.03, 0.05);
  }

  public playPrepComplete() {
    this.playTone(659.25, 0.07, 'square', 0, 0.045);
    this.playTone(880, 0.1, 'square', 0.06, 0.05);
  }

  public playWash() {
    this.playTone(523.25, 0.06, 'sine', 0, 0.06);
    this.playTone(783.99, 0.08, 'sine', 0.05, 0.06);
  }

  public playBurnWarn() {
    this.playTone(880, 0.06, 'square', 0, 0.045);
  }

  public playBurnRuined() {
    this.playTone(196, 0.16, 'sawtooth', 0, 0.06);
    this.playTone(146.83, 0.24, 'sawtooth', 0.12, 0.06);
  }

  public playCoin() {
    this.playTone(987.77, 0.08, 'square', 0, 0.05);
    this.playTone(1318.51, 0.18, 'square', 0.07, 0.05);
  }

  public playCookTap() {
    this.playTone(523.25, 0.06, 'triangle', 0, 0.06);
    this.playTone(659.25, 0.08, 'triangle', 0.05, 0.05);
  }

  public playServe() {
    this.playTone(587.33, 0.07, 'square', 0, 0.045);
    this.playTone(783.99, 0.11, 'square', 0.06, 0.045);
    this.playTone(1046.5, 0.14, 'square', 0.12, 0.05);
  }

  public playPlaceFurniture() {
    this.playTone(261.63, 0.06, 'triangle', 0, 0.07);
    this.playTone(392.0, 0.09, 'square', 0.05, 0.04);
  }

  public playUnlockFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.14, 'square', idx * 0.09, 0.055);
    });
  }

  public playExperimentFail() {
    this.playTone(329.63, 0.1, 'sawtooth', 0, 0.04);
    this.playTone(261.63, 0.18, 'sawtooth', 0.09, 0.04);
  }

  public playHeartStory() {
    const notes = [659.25, 783.99, 987.77, 1318.51];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.16, 'triangle', idx * 0.1, 0.07);
    });
  }
}

export const retroAudio = new RetroSoundEngine();
