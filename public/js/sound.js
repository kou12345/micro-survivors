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

    // Call this on any user interaction to unlock audio on mobile
    unlock() {
        if (!this.ctx) {
            this.init();
        }
        this.resume();
    },

    // Simple synth sound generator
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

    // Sound effects
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
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 0.15, 'square'), i * 80);
        });
    },

    explosion() {
        if (!this.ctx) return;
        // White noise burst
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

    // Weapon-specific hit sounds
    hitAntibody() {
        if (!this.ctx) return;
        // Soft bouncy sound for orbiting antibodies
        this.playTone(500, 0.04, 'sine');
        this.playTone(700, 0.03, 'sine');
    },

    hitEnzyme() {
        if (!this.ctx) return;
        // Sharp impact sound for projectiles
        this.playTone(350, 0.06, 'square');
        this.playTone(250, 0.04, 'square');
    },

    hitAtp() {
        if (!this.ctx) return;
        // Explosion sound (enhanced version)
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        noise.connect(filter);
        filter.connect(this.sfxGain);
        noise.start();
        // Add a low boom
        this.playTone(80, 0.2, 'sine');
        this.playTone(60, 0.3, 'sine');
    },

    hitCilia() {
        if (!this.ctx) return;
        // Sweeping whoosh sound for whip attack
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },

    // Enemy-specific death sounds
    deathGerm() {
        if (!this.ctx) return;
        // Squishy pop sound for germ
        this.playTone(400, 0.06, 'sine');
        setTimeout(() => this.playTone(600, 0.08, 'sine'), 30);
    },

    deathVirus() {
        if (!this.ctx) return;
        // Quick sharp burst for virus
        this.playTone(800, 0.04, 'square');
        this.playTone(1000, 0.06, 'square');
        setTimeout(() => this.playTone(1200, 0.04, 'square'), 40);
    },

    deathBacteria() {
        if (!this.ctx) return;
        // Heavy thud for bacteria
        this.playTone(150, 0.15, 'triangle');
        this.playTone(100, 0.2, 'triangle');
        setTimeout(() => this.playTone(200, 0.1, 'sine'), 80);
    },

    // Enemy-specific damage sounds (when enemy takes damage but doesn't die)
    damageGerm() {
        if (!this.ctx) return;
        this.playTone(350, 0.03, 'sine');
    },

    damageVirus() {
        if (!this.ctx) return;
        this.playTone(600, 0.03, 'square');
    },

    damageBacteria() {
        if (!this.ctx) return;
        this.playTone(180, 0.05, 'triangle');
    },

    // Player damage sounds by enemy type
    playerDamageByGerm() {
        if (!this.ctx) return;
        this.playTone(200, 0.1, 'sawtooth');
        this.playTone(150, 0.15, 'sawtooth');
    },

    playerDamageByVirus() {
        if (!this.ctx) return;
        this.playTone(250, 0.08, 'square');
        this.playTone(180, 0.12, 'square');
        setTimeout(() => this.playTone(120, 0.1, 'square'), 50);
    },

    playerDamageByBacteria() {
        if (!this.ctx) return;
        this.playTone(100, 0.2, 'sawtooth');
        this.playTone(80, 0.25, 'triangle');
    },

    // Cancer cell sounds
    damageCancer() {
        if (!this.ctx) return;
        // Squishy unstable sound
        this.playTone(300, 0.04, 'sine');
        this.playTone(350, 0.03, 'sine');
    },

    deathCancer() {
        if (!this.ctx) return;
        // Wet splitting sound
        this.playTone(250, 0.08, 'sine');
        this.playTone(400, 0.06, 'triangle');
        setTimeout(() => this.playTone(300, 0.1, 'sine'), 40);
    },

    split() {
        if (!this.ctx) return;
        // Cell division sound - warbling split
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
        // Pop sound at the end
        setTimeout(() => {
            this.playTone(500, 0.05, 'sine');
            this.playTone(600, 0.04, 'sine');
        }, 100);
    },

    // Parasite sounds
    damageParasite() {
        if (!this.ctx) return;
        // Quick squirmy sound
        this.playTone(450, 0.03, 'sawtooth');
    },

    deathParasite() {
        if (!this.ctx) return;
        // Squirming death sound
        this.playTone(500, 0.06, 'sawtooth');
        this.playTone(400, 0.08, 'sawtooth');
        setTimeout(() => this.playTone(300, 0.1, 'sawtooth'), 50);
    },

    evade() {
        if (!this.ctx) return;
        // Quick dash/whoosh sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    },

    // Exploder sounds
    damageExploder() {
        if (!this.ctx) return;
        // Unstable bubbling sound
        this.playTone(250, 0.04, 'square');
        this.playTone(280, 0.03, 'square');
    },

    deathExploder() {
        if (!this.ctx) return;
        // Already handled by explosion, just a small sound
        this.playTone(200, 0.05, 'sine');
    },

    exploderWarning() {
        if (!this.ctx) return;
        // Urgent warning beeps
        const beep = (delay) => {
            setTimeout(() => {
                if (!this.ctx) return;
                this.playTone(800, 0.08, 'square');
            }, delay);
        };
        beep(0);
        beep(120);
        beep(240);
        beep(360);
    },

    click() {
        if (!this.ctx) return;
        this.playTone(700, 0.05, 'sine');
    },

    // BGM - Simple procedural music
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

        // Simple bass line
        const bassNotes = [130.81, 146.83, 164.81, 146.83]; // C3, D3, E3, D3
        const tempo = 400; // ms per beat

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

        // Simple arpeggio
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

        // Loop
        setTimeout(() => this.playBGMLoop(), bassNotes.length * tempo);
    }
};
