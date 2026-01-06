// Shared Game State
// This module holds mutable game state to avoid circular dependencies

export let gameState = 'start';
export let player = null;
export let enemies = [];
export let xpOrbs = [];
export let projectiles = [];
export let enemyProjectiles = [];
export let effects = [];
export let camera = { x: 0, y: 0 };

// Mutation System - tracks weapon usage and enemy resistance
// When a weapon is used too much, new enemies gain resistance to it
export let mutationCounter = {};  // { weaponType: killCount }
export const MUTATION_THRESHOLDS = [50, 100, 200];  // Kills needed for each resistance level
export const MUTATION_RESISTANCE = [0.25, 0.50, 0.75];  // Damage reduction per level

// Get current mutation level for a weapon (0-3)
export function getMutationLevel(weaponType) {
    const kills = mutationCounter[weaponType] || 0;
    for (let i = MUTATION_THRESHOLDS.length - 1; i >= 0; i--) {
        if (kills >= MUTATION_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 0;
}

// Increment kill counter for a weapon
export function incrementMutationCounter(weaponType) {
    if (!weaponType) return;
    mutationCounter[weaponType] = (mutationCounter[weaponType] || 0) + 1;
}

// Get resistance value (damage reduction) for a mutation level
export function getResistanceValue(level) {
    if (level <= 0 || level > MUTATION_RESISTANCE.length) return 0;
    return MUTATION_RESISTANCE[level - 1];
}

// Reset mutation counters (for new game)
export function resetMutationCounters() {
    mutationCounter = {};
}

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

export function createDamageText(x, y, damage) {
    effects.push({
        type: 'damageText',
        x: x + (Math.random() - 0.5) * 20,
        y: y - 10,
        damage: Math.round(damage),
        life: 600,
        maxLife: 600,
        vy: -1.5,
    });
}
