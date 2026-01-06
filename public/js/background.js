// background.js - Interactive background system with climax progression
import { CONFIG } from './config.js';

// Background state
const bgState = {
    // Color progression (0-1 based on game progress)
    progress: 0,

    // Pulsation
    pulsePhase: 0,
    pulseSpeed: 1,

    // Particles (flowing plasma/blood cells)
    particles: [],

    // Ripples (from enemy deaths, attacks)
    ripples: [],

    // Wave warning state
    waveWarning: false,
    waveFlash: 0,

    // Player state for vignette
    playerHpRatio: 1,

    // Bubbles (enhanced from original)
    bubbles: []
};

// Color palettes for different stages
const COLOR_STAGES = [
    { // 0-30% - Peaceful blue-green
        bg: { r: 10, g: 25, b: 47 },
        accent: { r: 78, g: 205, b: 196 },
        glow: { r: 50, g: 150, b: 140 }
    },
    { // 30-60% - Tense purple-blue
        bg: { r: 20, g: 15, b: 50 },
        accent: { r: 150, g: 100, b: 200 },
        glow: { r: 100, g: 70, b: 160 }
    },
    { // 60-90% - Dangerous red-purple
        bg: { r: 35, g: 10, b: 40 },
        accent: { r: 200, g: 80, b: 150 },
        glow: { r: 150, g: 50, b: 100 }
    },
    { // 90-100% - Climax deep red
        bg: { r: 45, g: 5, b: 20 },
        accent: { r: 255, g: 60, b: 80 },
        glow: { r: 200, g: 40, b: 60 }
    }
];

// Initialize background system
export function initBackground() {
    bgState.particles = [];
    bgState.ripples = [];
    bgState.bubbles = [];
    bgState.progress = 0;
    bgState.pulsePhase = 0;
    bgState.waveWarning = false;
    bgState.waveFlash = 0;

    // Create initial particles
    for (let i = 0; i < 50; i++) {
        bgState.particles.push(createParticle());
    }

    // Create bubbles
    for (let i = 0; i < 25; i++) {
        bgState.bubbles.push(createBubble(i));
    }
}

function createParticle() {
    return {
        x: Math.random() * CONFIG.WORLD_SIZE,
        y: Math.random() * CONFIG.WORLD_SIZE,
        size: 2 + Math.random() * 4,
        speed: 0.3 + Math.random() * 0.5,
        angle: Math.random() * Math.PI * 2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.5 + Math.random() * 1,
        alpha: 0.3 + Math.random() * 0.4
    };
}

function createBubble(index) {
    return {
        x: Math.random() * CONFIG.WORLD_SIZE,
        y: Math.random() * CONFIG.WORLD_SIZE,
        baseSize: 15 + (index % 6) * 8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.3,
        wobbleX: Math.random() * Math.PI * 2,
        wobbleY: Math.random() * Math.PI * 2
    };
}

// Add ripple effect (call when enemy dies or big attack happens)
export function addRipple(x, y, maxRadius = 100, duration = 800) {
    bgState.ripples.push({
        x,
        y,
        radius: 0,
        maxRadius,
        duration,
        elapsed: 0
    });
}

// Set wave warning state
export function setWaveWarning(active) {
    bgState.waveWarning = active;
    if (active) {
        bgState.waveFlash = 1;
    }
}

// Update background state
export function updateBackground(dt, gameTime, gameDuration, playerHpRatio) {
    // Update progress (0 to 1)
    bgState.progress = Math.min(1, gameTime / gameDuration);
    bgState.playerHpRatio = playerHpRatio;

    // Update pulse speed based on progress
    // Slow at start, fast at climax
    bgState.pulseSpeed = 1 + bgState.progress * 3;
    if (bgState.waveWarning) {
        bgState.pulseSpeed *= 1.5;
    }
    if (playerHpRatio < 0.3) {
        bgState.pulseSpeed *= 1.3;
    }

    bgState.pulsePhase += dt * 0.003 * bgState.pulseSpeed;

    // Update wave flash
    if (bgState.waveFlash > 0) {
        bgState.waveFlash -= dt * 0.003;
    }

    // Update particles
    const baseFlowAngle = Math.PI * 0.25; // Diagonal flow
    const flowSpeed = 1 + bgState.progress * 2;

    for (const p of bgState.particles) {
        p.wobble += dt * 0.001 * p.wobbleSpeed;

        // Flow direction with wobble
        const wobbleOffset = Math.sin(p.wobble) * 0.3;
        const flowAngle = baseFlowAngle + wobbleOffset;

        p.x += Math.cos(flowAngle) * p.speed * flowSpeed * (dt / 16);
        p.y += Math.sin(flowAngle) * p.speed * flowSpeed * (dt / 16);

        // Wrap around world
        if (p.x > CONFIG.WORLD_SIZE) p.x = 0;
        if (p.y > CONFIG.WORLD_SIZE) p.y = 0;
        if (p.x < 0) p.x = CONFIG.WORLD_SIZE;
        if (p.y < 0) p.y = CONFIG.WORLD_SIZE;
    }

    // Update bubbles
    for (const b of bgState.bubbles) {
        b.phase += dt * 0.001;
        b.wobbleX += dt * 0.0005;
        b.wobbleY += dt * 0.0007;

        b.x += Math.sin(b.wobbleX) * b.speed * (dt / 16);
        b.y += Math.cos(b.wobbleY) * b.speed * (dt / 16) - b.speed * 0.5 * (dt / 16);

        // Wrap around world
        if (b.x > CONFIG.WORLD_SIZE) b.x = 0;
        if (b.y > CONFIG.WORLD_SIZE) b.y = 0;
        if (b.x < 0) b.x = CONFIG.WORLD_SIZE;
        if (b.y < 0) b.y = CONFIG.WORLD_SIZE;
    }

    // Update ripples
    for (let i = bgState.ripples.length - 1; i >= 0; i--) {
        const r = bgState.ripples[i];
        r.elapsed += dt;
        r.radius = (r.elapsed / r.duration) * r.maxRadius;

        if (r.elapsed >= r.duration) {
            bgState.ripples.splice(i, 1);
        }
    }
}

// Interpolate between colors
function lerpColor(c1, c2, t) {
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
}

// Get current colors based on progress
function getCurrentColors() {
    const progress = bgState.progress;
    let stageIndex, stageProgress;

    if (progress < 0.3) {
        stageIndex = 0;
        stageProgress = progress / 0.3;
    } else if (progress < 0.6) {
        stageIndex = 1;
        stageProgress = (progress - 0.3) / 0.3;
    } else if (progress < 0.9) {
        stageIndex = 2;
        stageProgress = (progress - 0.6) / 0.3;
    } else {
        stageIndex = 3;
        stageProgress = 0;
    }

    const current = COLOR_STAGES[stageIndex];
    const next = COLOR_STAGES[Math.min(stageIndex + 1, COLOR_STAGES.length - 1)];

    return {
        bg: lerpColor(current.bg, next.bg, stageProgress),
        accent: lerpColor(current.accent, next.accent, stageProgress),
        glow: lerpColor(current.glow, next.glow, stageProgress)
    };
}

// Draw background
export function drawBackground(ctx, camera) {
    const width = CONFIG.CANVAS_WIDTH;
    const height = CONFIG.CANVAS_HEIGHT;
    const colors = getCurrentColors();

    // Pulse factor (0.9 to 1.1)
    const pulse = 1 + Math.sin(bgState.pulsePhase) * 0.1;

    // Base background with pulse
    const bgPulse = Math.sin(bgState.pulsePhase) * 0.15;
    const bgColor = {
        r: Math.min(255, colors.bg.r + colors.bg.r * bgPulse),
        g: Math.min(255, colors.bg.g + colors.bg.g * bgPulse),
        b: Math.min(255, colors.bg.b + colors.bg.b * bgPulse)
    };
    ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
    ctx.fillRect(0, 0, width, height);

    // Wave flash overlay
    if (bgState.waveFlash > 0) {
        ctx.fillStyle = `rgba(${colors.accent.r}, ${colors.accent.g}, ${colors.accent.b}, ${bgState.waveFlash * 0.3})`;
        ctx.fillRect(0, 0, width, height);
    }

    // Center glow (petri dish effect) with pulse
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) / 2;
    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxRadius * pulse
    );
    gradient.addColorStop(0, `rgba(${colors.glow.r}, ${colors.glow.g}, ${colors.glow.b}, ${0.15 * pulse})`);
    gradient.addColorStop(0.5, `rgba(${colors.glow.r}, ${colors.glow.g}, ${colors.glow.b}, ${0.07 * pulse})`);
    gradient.addColorStop(1, `rgba(${colors.glow.r}, ${colors.glow.g}, ${colors.glow.b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Grid with color adaptation
    const gridAlpha = 0.08 + bgState.progress * 0.05;
    ctx.strokeStyle = `rgba(${colors.accent.r}, ${colors.accent.g}, ${colors.accent.b}, ${gridAlpha})`;
    ctx.lineWidth = 1;
    const gridSize = 50;
    const offsetX = camera.x % gridSize;
    const offsetY = camera.y % gridSize;

    for (let x = -offsetX; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = -offsetY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Draw flowing particles
    const particleAlpha = 0.2 + bgState.progress * 0.3;
    for (const p of bgState.particles) {
        const sx = p.x - camera.x + width / 2;
        const sy = p.y - camera.y + height / 2;

        // Only draw if on screen (with margin)
        if (sx > -50 && sx < width + 50 && sy > -50 && sy < height + 50) {
            const size = p.size * pulse;
            ctx.fillStyle = `rgba(${colors.accent.r}, ${colors.accent.g}, ${colors.accent.b}, ${p.alpha * particleAlpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw bubbles
    const bubbleAlpha = 0.06 + Math.sin(bgState.pulsePhase * 0.5) * 0.03;
    for (const b of bgState.bubbles) {
        const sx = b.x - camera.x + width / 2;
        const sy = b.y - camera.y + height / 2;

        if (sx > -100 && sx < width + 100 && sy > -100 && sy < height + 100) {
            const size = b.baseSize + Math.sin(b.phase) * 5;
            ctx.fillStyle = `rgba(${colors.accent.r}, ${colors.accent.g}, ${colors.accent.b}, ${bubbleAlpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw ripples
    for (const r of bgState.ripples) {
        const sx = r.x - camera.x + width / 2;
        const sy = r.y - camera.y + height / 2;
        const progress = r.elapsed / r.duration;
        const alpha = (1 - progress) * 0.5;

        ctx.strokeStyle = `rgba(${colors.accent.r}, ${colors.accent.g}, ${colors.accent.b}, ${alpha})`;
        ctx.lineWidth = 2 * (1 - progress);
        ctx.beginPath();
        ctx.arc(sx, sy, r.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Low HP vignette effect
    if (bgState.playerHpRatio < 0.5) {
        const vignetteIntensity = (0.5 - bgState.playerHpRatio) * 2; // 0 to 1
        const vignettePulse = 0.5 + Math.sin(bgState.pulsePhase * 2) * 0.5;
        const vignetteAlpha = vignetteIntensity * 0.4 * vignettePulse;

        const vignetteGradient = ctx.createRadialGradient(
            centerX, centerY, Math.min(width, height) * 0.3,
            centerX, centerY, Math.max(width, height) * 0.7
        );
        vignetteGradient.addColorStop(0, 'rgba(180, 0, 0, 0)');
        vignetteGradient.addColorStop(1, `rgba(180, 0, 0, ${vignetteAlpha})`);
        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, width, height);
    }

    // Climax effect (last 10%)
    if (bgState.progress > 0.9) {
        const climaxIntensity = (bgState.progress - 0.9) * 10; // 0 to 1
        const climaxPulse = Math.sin(bgState.pulsePhase * 3) * 0.5 + 0.5;

        // Screen edge glow
        const edgeGradient = ctx.createRadialGradient(
            centerX, centerY, Math.min(width, height) * 0.4,
            centerX, centerY, Math.max(width, height) * 0.8
        );
        edgeGradient.addColorStop(0, 'rgba(255, 60, 80, 0)');
        edgeGradient.addColorStop(1, `rgba(255, 60, 80, ${climaxIntensity * 0.2 * climaxPulse})`);
        ctx.fillStyle = edgeGradient;
        ctx.fillRect(0, 0, width, height);
    }
}
