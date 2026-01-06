// Shared Game State
// This module holds mutable game state to avoid circular dependencies

export let gameState = 'start';
export let player = null;
export let enemies = [];
export let xpOrbs = [];
export let projectiles = [];
export let effects = [];
export let camera = { x: 0, y: 0 };

// State setters
export function setGameState(state) {
    gameState = state;
}

export function setPlayer(p) {
    player = p;
}

// Helper Functions
export function findNearestEnemy(x, y) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - x, enemy.y - y);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = enemy;
        }
    }
    return nearest;
}

export function createHitEffect(x, y, color) {
    for (let i = 0; i < 3; i++) {
        effects.push({
            type: 'particle',
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            life: 200,
            maxLife: 200,
            color: color,
            size: 3,
        });
    }
}
