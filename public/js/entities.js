import { CONFIG } from './config.js';
import { WEAPONS, ENEMY_TYPES } from './weapons.js';
import { Sound } from './sound.js';
import {
    enemies, projectiles, effects, xpOrbs, camera,
    findNearestEnemy, createHitEffect, createDamageText
} from './state.js';

// Forward declarations for game functions (set by game.js)
let _showLevelUpMenu = null;
let _gameOver = null;
let _incrementKillCount = null;

export function setLevelUpCallback(fn) {
    _showLevelUpMenu = fn;
}

export function setGameOverCallback(fn) {
    _gameOver = fn;
}

export function setKillCountCallback(fn) {
    _incrementKillCount = fn;
}

// Player Class
export class Player {
    constructor() {
        this.x = CONFIG.WORLD_SIZE / 2;
        this.y = CONFIG.WORLD_SIZE / 2;
        this.size = 20;
        this.hp = CONFIG.PLAYER_MAX_HP;
        this.maxHp = CONFIG.PLAYER_MAX_HP;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = CONFIG.XP_TO_LEVEL(1);
        this.weapons = { antibody: { level: 1, angle: 0, lastAttack: 0 } };
        this.passives = {};
        this.damageMultiplier = 1;
        this.xpMultiplier = 1;
        this.defenseMultiplier = 0;
        this.speedMultiplier = 1;
        this.cooldownMultiplier = 1;
        this.invincible = 0;
        this.facingAngle = 0;
    }

    update(dt, keys, joystick = null) {
        let dx = 0, dy = 0;

        // Keyboard input
        if (keys['w'] || keys['arrowup']) dy = -1;
        if (keys['s'] || keys['arrowdown']) dy = 1;
        if (keys['a'] || keys['arrowleft']) dx = -1;
        if (keys['d'] || keys['arrowright']) dx = 1;

        // Joystick input (override keyboard if active)
        if (joystick && joystick.active) {
            dx = joystick.dx;
            dy = joystick.dy;
        }

        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            // Only normalize if using keyboard (discrete) input
            if (!joystick || !joystick.active) {
                dx /= len;
                dy /= len;
            }
            this.facingAngle = Math.atan2(dy, dx);
        }

        const speed = CONFIG.PLAYER_SPEED * this.speedMultiplier;
        this.x += dx * speed;
        this.y += dy * speed;

        // World bounds
        this.x = Math.max(this.size, Math.min(CONFIG.WORLD_SIZE - this.size, this.x));
        this.y = Math.max(this.size, Math.min(CONFIG.WORLD_SIZE - this.size, this.y));

        if (this.invincible > 0) this.invincible -= dt;

        // Update weapons
        this.updateWeapons(dt);
    }

    updateWeapons(dt) {
        const now = performance.now();

        for (const [type, weapon] of Object.entries(this.weapons)) {
            const def = WEAPONS[type];
            const cooldown = def.cooldown * this.cooldownMultiplier;

            if (type === 'antibody') {
                weapon.angle += def.speed * (1 + weapon.level * 0.2);
                const orbits = def.orbits + Math.floor(weapon.level / 2);
                const range = def.range + weapon.level * 10;

                for (let i = 0; i < orbits; i++) {
                    const angle = weapon.angle + (Math.PI * 2 / orbits) * i;
                    const ox = this.x + Math.cos(angle) * range;
                    const oy = this.y + Math.sin(angle) * range;

                    // Check collision with enemies
                    for (const enemy of enemies) {
                        const dist = Math.hypot(enemy.x - ox, enemy.y - oy);
                        if (dist < enemy.size + 15 && now - (enemy.lastHitBy?.[type] || 0) > 200) {
                            const damage = def.damage * this.damageMultiplier * (1 + weapon.level * 0.2);
                            enemy.takeDamage(damage);
                            enemy.lastHitBy = enemy.lastHitBy || {};
                            enemy.lastHitBy[type] = now;
                            createHitEffect(ox, oy, def.color);
                        }
                    }
                }
            } else if (type === 'enzyme' && now - weapon.lastAttack > cooldown) {
                weapon.lastAttack = now;
                Sound.shoot();
                const target = findNearestEnemy(this.x, this.y);
                const angle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.facingAngle;
                const count = 1 + Math.floor(weapon.level / 3);

                for (let i = 0; i < count; i++) {
                    const spread = (i - (count - 1) / 2) * 0.15;
                    projectiles.push({
                        type: 'enzyme',
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(angle + spread) * def.speed,
                        vy: Math.sin(angle + spread) * def.speed,
                        damage: def.damage * this.damageMultiplier * (1 + weapon.level * 0.2),
                        range: def.range + weapon.level * 30,
                        traveled: 0,
                        color: def.color,
                        size: 6 + weapon.level,
                    });
                }
            } else if (type === 'atp' && now - weapon.lastAttack > cooldown) {
                weapon.lastAttack = now;
                projectiles.push({
                    type: 'atp',
                    x: this.x,
                    y: this.y,
                    damage: def.damage * this.damageMultiplier * (1 + weapon.level * 0.3),
                    radius: def.radius + weapon.level * 15,
                    timer: def.delay,
                    color: def.color,
                });
            } else if (type === 'cilia' && now - weapon.lastAttack > cooldown) {
                weapon.lastAttack = now;
                const target = findNearestEnemy(this.x, this.y);
                const baseAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.facingAngle;
                const range = def.range + weapon.level * 15;
                const arc = def.arc + weapon.level * 0.1;
                const damage = def.damage * this.damageMultiplier * (1 + weapon.level * 0.2);

                // Create whip effect
                effects.push({
                    type: 'cilia',
                    x: this.x,
                    y: this.y,
                    angle: baseAngle,
                    arc: arc,
                    range: range,
                    duration: 200,
                    elapsed: 0,
                    color: def.color,
                });

                // Hit enemies in arc
                for (const enemy of enemies) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < range + enemy.size) {
                        const enemyAngle = Math.atan2(dy, dx);
                        let angleDiff = enemyAngle - baseAngle;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                        if (Math.abs(angleDiff) < arc / 2) {
                            enemy.takeDamage(damage);
                            createHitEffect(enemy.x, enemy.y, def.color);
                        }
                    }
                }
            }
        }
    }

    takeDamage(amount) {
        if (this.invincible > 0) return;
        const damage = amount * (1 - this.defenseMultiplier);
        this.hp -= damage;
        this.invincible = 500;
        createHitEffect(this.x, this.y, '#ff6b6b');
        Sound.playerDamage();
        if (this.hp <= 0 && _gameOver) {
            _gameOver();
        }
    }

    addXP(amount) {
        this.xp += amount * this.xpMultiplier;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = CONFIG.XP_TO_LEVEL(this.level);
            if (_showLevelUpMenu) {
                _showLevelUpMenu();
            }
        }
    }

    draw(ctx) {
        const sx = this.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
        const sy = this.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;

        // Draw player (white blood cell - amoeba-like)
        ctx.save();
        ctx.translate(sx, sy);

        // Invincibility flash
        if (this.invincible > 0 && Math.floor(this.invincible / 50) % 2) {
            ctx.globalAlpha = 0.5;
        }

        // Body
        ctx.fillStyle = '#f8f8f8';
        ctx.beginPath();
        const time = performance.now() / 200;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const wobble = Math.sin(time + i) * 3;
            const r = this.size + wobble;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Nucleus
        ctx.fillStyle = '#a29bfe';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(-5, -3, 3, 0, Math.PI * 2);
        ctx.arc(5, -3, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Draw antibody orbits
        if (this.weapons.antibody) {
            const weapon = this.weapons.antibody;
            const def = WEAPONS.antibody;
            const orbits = def.orbits + Math.floor(weapon.level / 2);
            const range = def.range + weapon.level * 10;

            for (let i = 0; i < orbits; i++) {
                const angle = weapon.angle + (Math.PI * 2 / orbits) * i;
                const ox = sx + Math.cos(angle) * range;
                const oy = sy + Math.sin(angle) * range;

                ctx.fillStyle = def.color;
                ctx.beginPath();
                ctx.arc(ox, oy, 10 + weapon.level, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(ox - 3, oy - 3, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Enemy Class
export class Enemy {
    constructor(type, x, y) {
        this.type = type;
        const def = ENEMY_TYPES[type];
        this.x = x;
        this.y = y;
        this.size = def.size;
        this.width = def.width || def.size * 2;
        this.height = def.height || def.size * 2;
        this.hp = def.hp;
        this.maxHp = def.hp;
        this.speed = def.speed;
        this.damage = def.damage;
        this.xp = def.xp;
        this.color = def.color;
        this.lastHitBy = {};
        this.wobble = Math.random() * Math.PI * 2;
    }

    update(dt, player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }

        this.wobble += 0.1;

        // Check collision with player
        if (dist < this.size + player.size) {
            player.takeDamage(this.damage);
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        createDamageText(this.x, this.y, amount);
        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        const idx = enemies.indexOf(this);
        if (idx !== -1) enemies.splice(idx, 1);

        if (_incrementKillCount) _incrementKillCount();
        Sound.enemyDeath();

        // Drop XP
        xpOrbs.push({
            x: this.x,
            y: this.y,
            value: this.xp,
            size: 5 + Math.min(this.xp, 10),
        });

        // Death effect
        for (let i = 0; i < 5; i++) {
            effects.push({
                type: 'particle',
                x: this.x,
                y: this.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 300,
                maxLife: 300,
                color: this.color,
                size: 4,
            });
        }
    }

    draw(ctx, player) {
        const sx = this.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
        const sy = this.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;

        ctx.save();
        ctx.translate(sx, sy);

        if (this.type === 'germ') {
            // Green bumpy circle
            ctx.fillStyle = this.color;
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                const r = this.size + Math.sin(this.wobble + i * 0.5) * 3;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'virus') {
            // Red spiky circle
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();

            // Spikes
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i + this.wobble * 0.1;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * this.size, Math.sin(angle) * this.size);
                ctx.lineTo(Math.cos(angle) * (this.size + 6), Math.sin(angle) * (this.size + 6));
                ctx.stroke();
            }
        } else if (this.type === 'bacteria') {
            // Rod-shaped
            ctx.fillStyle = this.color;
            ctx.rotate(Math.atan2(player.y - this.y, player.x - this.x));
            ctx.beginPath();
            ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, this.height / 2);
            ctx.fill();
        }

        ctx.restore();

        // HP bar for tough enemies
        if (this.maxHp > 20 && this.hp < this.maxHp) {
            ctx.fillStyle = '#333';
            ctx.fillRect(sx - 15, sy - this.size - 10, 30, 4);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(sx - 15, sy - this.size - 10, 30 * (this.hp / this.maxHp), 4);
        }
    }
}
