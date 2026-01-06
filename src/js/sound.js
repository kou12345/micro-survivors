// Sound System using Web Audio API
export const Sound = {
    ctx: null,
    bgmGain: null,
    sfxGain: null,
    bgmPlaying: false,
    initialized: false,

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.3;
        this.bgmGain.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.5;
        this.sfxGain.connect(this.ctx.destination);
        this.initialized = true;
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    unlock() {
        if (!this.ctx) {
            this.init();
        }
        this.resume();
    },

    playTone(freq, duration, type = 'square', gainNode = this.sfxGain, fadeOut = true) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = 0.3;
        if (fadeOut) {
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        }
        osc.connect(gain);
        gain.connect(gainNode);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    hit() {
        if (!this.ctx) return;
        this.playTone(400, 0.05, 'square');
        this.playTone(300, 0.08, 'square');
    },

    enemyDeath() {
        if (!this.ctx) return;
        this.playTone(600, 0.08, 'square');
        setTimeout(() => this.playTone(800, 0.1, 'square'), 50);
    },

    playerDamage() {
        if (!this.ctx) return;
        this.playTone(150, 0.15, 'sawtooth');
        this.playTone(100, 0.2, 'sawtooth');
    },

    xpPickup() {
        if (!this.ctx) return;
        const freq = 500 + Math.random() * 200;
        this.playTone(freq, 0.05, 'sine');
    },

    levelUp() {
        if (!this.ctx) return;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.15, 'square'), i * 80);
        });
    },

    explosion() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        noise.connect(filter);
        filter.connect(this.sfxGain);
        noise.start();
    },

    shoot() {
        if (!this.ctx) return;
        this.playTone(800, 0.03, 'square');
        this.playTone(600, 0.05, 'square');
    },

    click() {
        if (!this.ctx) return;
        this.playTone(700, 0.05, 'sine');
    },

    startBGM() {
        if (!this.ctx || this.bgmPlaying) return;
        this.bgmPlaying = true;
        this.playBGMLoop();
    },

    stopBGM() {
        this.bgmPlaying = false;
    },

    playBGMLoop() {
        if (!this.bgmPlaying || !this.ctx) return;

        const bassNotes = [130.81, 146.83, 164.81, 146.83];
        const tempo = 400;

        bassNotes.forEach((freq, i) => {
            setTimeout(() => {
                if (!this.bgmPlaying) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                gain.gain.value = 0.2;
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
                osc.connect(gain);
                gain.connect(this.bgmGain);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.35);
            }, i * tempo);
        });

        const arpNotes = [261.63, 329.63, 392.00, 329.63, 261.63, 329.63, 392.00, 523.25];
        arpNotes.forEach((freq, i) => {
            setTimeout(() => {
                if (!this.bgmPlaying) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.value = 0.1;
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
                osc.connect(gain);
                gain.connect(this.bgmGain);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.18);
            }, i * (tempo / 2));
        });

        setTimeout(() => this.playBGMLoop(), bassNotes.length * tempo);
    }
};
