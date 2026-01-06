import { CONFIG } from './config.js';
import { WEAPONS, ENEMY_TYPES, SYNERGIES } from './weapons.js';
import { Sound } from './sound.js';
import {
    enemies, projectiles, enemyProjectiles, effects, xpOrbs, camera,
    findNearestEnemy, createHitEffect, createDamageText,
    incrementMutationCounter, getResistanceValue
} from './state.js';

// Forward declarations for game functions (set by game.js)
let _showLevelUpMenu = null;
let _gameOver = null;
let _incrementKillCount = null;
let _onEnemyDeath = null;

export function setLevelUpCallback(fn) {
    _showLevelUpMenu = fn;
}

export function setGameOverCallback(fn) {
    _gameOver = fn;
}

export function setKillCountCallback(fn) {
    _incrementKillCount = fn;
}

export function setEnemyDeathCallback(fn) {
    _onEnemyDeath = fn;
}

// Synergy notification callback
let _onSynergyActivated = null;
export function setSynergyCallback(fn) {
    _onSynergyActivated = fn;
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

        // Synergy system
        this.activeSynergies = {};
        this.synergyCooldownBonus = 0; // For geneExpression synergy
        this.motorEnergyTimer = 0; // For motorEnergy synergy speed boost
    }

    // Check if a synergy is active
    hasSynergy(synergyId) {
        return !!this.activeSynergies[synergyId];
    }

    // Check and update active synergies based on current weapons and passives
    checkSynergies() {
        const previousSynergies = { ...this.activeSynergies };
        this.activeSynergies = {};
        this.synergyCooldownBonus = 0;

        for (const [id, synergy] of Object.entries(SYNERGIES)) {
            const reqWeapons = synergy.requires.weapons || [];
            const reqPassives = synergy.requires.passives || [];

            const hasAllWeapons = reqWeapons.every(w => this.weapons[w]);
            const hasAllPassives = reqPassives.every(p => this.passives[p]);

            if (hasAllWeapons && hasAllPassives) {
                this.activeSynergies[id] = true;

                // Apply geneExpression synergy effect
                if (id === 'geneExpression') {
                    this.synergyCooldownBonus = 0.15;
                }

                // Notify if newly activated
                if (!previousSynergies[id] && _onSynergyActivated) {
                    _onSynergyActivated(synergy);
                }
            }
        }
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

        // Apply motor energy boost if active
        let speedBonus = 1;
        if (this.motorEnergyTimer > 0) {
            speedBonus = 1.5;
            this.motorEnergyTimer -= dt;
        }

        const speed = CONFIG.PLAYER_SPEED * this.speedMultiplier * speedBonus;
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
            // Apply synergy cooldown bonus from geneExpression
            const cooldown = def.cooldown * (this.cooldownMultiplier - this.synergyCooldownBonus);

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
                            enemy.takeDamage(damage, 'antibody');
                            enemy.lastHitBy = enemy.lastHitBy || {};
                            enemy.lastHitBy[type] = now;
                            createHitEffect(ox, oy, def.color);

                            // Synergy: immuneSynapse - slow enemies
                            if (this.hasSynergy('immuneSynapse')) {
                                enemy.slowTimer = 2000; // 2 seconds slow
                                enemy.slowAmount = 0.5; // 50% slow
                            }

                            // Synergy: ADCC - mark enemies for enzyme critical
                            if (this.hasSynergy('adcc')) {
                                enemy.adccMarked = true;
                                enemy.adccTimer = 5000; // 5 seconds mark
                            }

                            // Synergy: opsonization - mark for XP bonus on kill
                            if (this.hasSynergy('opsonization')) {
                                enemy.opsonized = true;
                            }
                        }
                    }
                }
            } else if (type === 'enzyme' && now - weapon.lastAttack > cooldown) {
                weapon.lastAttack = now;
                Sound.shoot();
                const target = findNearestEnemy(this.x, this.y);
                const angle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.facingAngle;
                const count = 1 + Math.floor(weapon.level / 3);

                // Synergy: enzymeActivation - pierce through enemies
                const pierce = this.hasSynergy('enzymeActivation');
                // Synergy: ADCC - critical on marked enemies
                const hasAdcc = this.hasSynergy('adcc');

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
                        pierce: pierce,
                        hitEnemies: pierce ? [] : null, // Track hit enemies for pierce
                        adccCritical: hasAdcc, // ADCC synergy flag
                    });
                }
            } else if (type === 'atp' && now - weapon.lastAttack > cooldown) {
                weapon.lastAttack = now;

                // Synergy: energyOverload - chain explosion
                const chainExplosion = this.hasSynergy('energyOverload');
                // Synergy: motorEnergy - speed boost after explosion
                const motorEnergy = this.hasSynergy('motorEnergy');

                projectiles.push({
                    type: 'atp',
                    x: this.x,
                    y: this.y,
                    damage: def.damage * this.damageMultiplier * (1 + weapon.level * 0.3),
                    radius: def.radius + weapon.level * 15,
                    timer: def.delay,
                    color: def.color,
                    chainExplosion: chainExplosion,
                    motorEnergy: motorEnergy,
                    isChained: false, // Is this a chain explosion?
                });
            } else if (type === 'cilia' && now - weapon.lastAttack > cooldown) {
                weapon.lastAttack = now;
                const target = findNearestEnemy(this.x, this.y);
                const baseAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.facingAngle;
                const range = def.range + weapon.level * 15;
                const arc = def.arc + weapon.level * 0.1;
                const damage = def.damage * this.damageMultiplier * (1 + weapon.level * 0.2);

                // Synergy: coordinatedMovement - dash forward on attack
                if (this.hasSynergy('coordinatedMovement')) {
                    const dashDistance = 40;
                    this.x += Math.cos(baseAngle) * dashDistance;
                    this.y += Math.sin(baseAngle) * dashDistance;
                    // Keep within bounds
                    this.x = Math.max(this.size, Math.min(CONFIG.WORLD_SIZE - this.size, this.x));
                    this.y = Math.max(this.size, Math.min(CONFIG.WORLD_SIZE - this.size, this.y));
                    // Create dash effect
                    effects.push({
                        type: 'dash',
                        x: this.x - Math.cos(baseAngle) * dashDistance,
                        y: this.y - Math.sin(baseAngle) * dashDistance,
                        angle: baseAngle,
                        duration: 300,
                        elapsed: 0,
                        color: '#a29bfe',
                    });
                }

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
                let hitAny = false;
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
                            enemy.takeDamage(damage, 'cilia');
                            createHitEffect(enemy.x, enemy.y, def.color);
                            hitAny = true;
                        }
                    }
                }
                if (hitAny) {
                    Sound.hitCilia();
                }
            } else if (type === 'interferon') {
                // Interferon - continuous damage aura around player
                const range = def.range + weapon.level * 15;
                const damage = def.damage * this.damageMultiplier * (1 + weapon.level * 0.3);

                for (const enemy of enemies) {
                    const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                    if (dist < range + enemy.size && now - (enemy.lastHitBy?.['interferon'] || 0) > cooldown) {
                        enemy.takeDamage(damage, 'interferon');
                        enemy.lastHitBy = enemy.lastHitBy || {};
                        enemy.lastHitBy['interferon'] = now;
                        createHitEffect(enemy.x, enemy.y, def.color);
                    }
                }
            } else if (type === 'lysozyme' && now - weapon.lastAttack > cooldown) {
                // Lysozyme - chain lightning attack
                weapon.lastAttack = now;
                const target = findNearestEnemy(this.x, this.y);
                if (target) {
                    const range = def.range + weapon.level * 20;
                    const dist = Math.hypot(target.x - this.x, target.y - this.y);
                    if (dist < range) {
                        Sound.shoot();
                        const chainCount = def.chainCount + Math.floor(weapon.level / 2);
                        const chainRange = def.chainRange + weapon.level * 10;
                        const damage = def.damage * this.damageMultiplier * (1 + weapon.level * 0.25);

                        // Create chain effect
                        const hitEnemies = [target];
                        let currentEnemy = target;
                        let prevX = this.x;
                        let prevY = this.y;

                        // Hit first enemy
                        currentEnemy.takeDamage(damage, 'lysozyme');
                        createHitEffect(currentEnemy.x, currentEnemy.y, def.color);
                        effects.push({
                            type: 'chain',
                            x1: prevX,
                            y1: prevY,
                            x2: currentEnemy.x,
                            y2: currentEnemy.y,
                            duration: 200,
                            elapsed: 0,
                            color: def.color,
                        });

                        // Chain to additional enemies
                        for (let i = 1; i < chainCount; i++) {
                            let nextEnemy = null;
                            let minDist = chainRange;

                            for (const enemy of enemies) {
                                if (hitEnemies.includes(enemy)) continue;
                                const d = Math.hypot(enemy.x - currentEnemy.x, enemy.y - currentEnemy.y);
                                if (d < minDist) {
                                    minDist = d;
                                    nextEnemy = enemy;
                                }
                            }

                            if (nextEnemy) {
                                prevX = currentEnemy.x;
                                prevY = currentEnemy.y;
                                hitEnemies.push(nextEnemy);
                                const chainDamage = damage * (1 - i * 0.15); // Damage falloff
                                nextEnemy.takeDamage(chainDamage, 'lysozyme');
                                createHitEffect(nextEnemy.x, nextEnemy.y, def.color);
                                effects.push({
                                    type: 'chain',
                                    x1: prevX,
                                    y1: prevY,
                                    x2: nextEnemy.x,
                                    y2: nextEnemy.y,
                                    duration: 200,
                                    elapsed: 0,
                                    color: def.color,
                                });
                                currentEnemy = nextEnemy;
                            } else {
                                break;
                            }
                        }
                    }
                }
            } else if (type === 'phagocyte' && now - weapon.lastAttack > cooldown) {
                // Phagocyte - homing projectile
                weapon.lastAttack = now;
                Sound.shoot();
                const target = findNearestEnemy(this.x, this.y);
                const angle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.facingAngle;
                const count = 1 + Math.floor(weapon.level / 4);

                for (let i = 0; i < count; i++) {
                    const spread = (i - (count - 1) / 2) * 0.3;
                    projectiles.push({
                        type: 'phagocyte',
                        x: this.x,
                        y: this.y,
                        angle: angle + spread,
                        speed: def.speed + weapon.level * 0.3,
                        damage: def.damage * this.damageMultiplier * (1 + weapon.level * 0.2),
                        range: def.range + weapon.level * 50,
                        turnSpeed: def.turnSpeed + weapon.level * 0.01,
                        traveled: 0,
                        color: def.color,
                        size: 8 + weapon.level,
                    });
                }
            }
        }
    }

    takeDamage(amount, enemyType = null) {
        if (this.invincible > 0) return;
        const damage = amount * (1 - this.defenseMultiplier);
        this.hp -= damage;
        this.invincible = 500;
        createHitEffect(this.x, this.y, '#ff6b6b');

        // Play enemy-specific player damage sound
        if (enemyType) {
            switch (enemyType) {
                case 'germ':
                    Sound.playerDamageByGerm();
                    break;
                case 'virus':
                    Sound.playerDamageByVirus();
                    break;
                case 'bacteria':
                    Sound.playerDamageByBacteria();
                    break;
                default:
                    Sound.playerDamage();
            }
        } else {
            Sound.playerDamage();
        }

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

        // Ranged attack properties
        this.isRanged = def.isRanged || false;
        this.attackRange = def.attackRange || 0;
        this.preferredRange = def.preferredRange || 0;
        this.attackCooldown = def.attackCooldown || 0;
        this.projectileSpeed = def.projectileSpeed || 0;
        this.projectileDamage = def.projectileDamage || 0;
        this.projectileSize = def.projectileSize || 0;
        this.projectileColor = def.projectileColor || def.color;
        this.lastAttack = 0;

        // Mutation/Resistance system
        this.resistances = {};  // { weaponType: resistanceLevel }
        this.lastDamagedBy = null;  // Track which weapon killed this enemy

        // Synergy effect states
        this.slowTimer = 0;
        this.slowAmount = 0;
        this.adccMarked = false;
        this.adccTimer = 0;
        this.opsonized = false;
        this.lastDamageSource = null; // Track what weapon dealt the last damage

        // Special behavior properties
        // Cancer cell - splits when damaged
        this.canSplit = def.canSplit || false;
        this.splitThreshold = def.splitThreshold || 0.5;
        this.splitCount = def.splitCount || 2;
        this.hasSplit = false; // Prevents infinite splitting

        // Parasite - evades attacks
        this.canEvade = def.canEvade || false;
        this.evadeDistance = def.evadeDistance || 80;
        this.evadeCooldown = def.evadeCooldown || 2000;
        this.evadeSpeed = def.evadeSpeed || 6;
        this.lastEvadeTime = 0;
        this.isEvading = false;
        this.evadeVx = 0;
        this.evadeVy = 0;
        this.evadeDuration = 0;

        // Exploder - explodes on death
        this.explodesOnDeath = def.explodesOnDeath || false;
        this.explosionRadius = def.explosionRadius || 60;
        this.explosionDamage = def.explosionDamage || 25;
        this.explosionDelay = def.explosionDelay || 500;
        this.isExploding = false; // Prevents movement during explosion countdown
        this.explosionTimer = 0;
    }

    update(dt, player) {
        // Update synergy timers
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
        }
        if (this.adccTimer > 0) {
            this.adccTimer -= dt;
            if (this.adccTimer <= 0) {
                this.adccMarked = false;
            }
        }

        // Handle exploder countdown (stops all movement)
        if (this.isExploding) {
            this.explosionTimer -= dt;
            if (this.explosionTimer <= 0) {
                this.triggerExplosion(player);
            }
            this.wobble += 0.3; // Faster wobble during countdown
            return; // Don't move while exploding
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        // Calculate speed with slow effect
        const slowMult = this.slowTimer > 0 ? (1 - this.slowAmount) : 1;
        const currentSpeed = this.speed * slowMult;

        // Handle parasite evasion
        if (this.isEvading) {
            this.evadeDuration -= dt;
            this.x += this.evadeVx * (dt / 16);
            this.y += this.evadeVy * (dt / 16);
            // Keep within world bounds
            this.x = Math.max(this.size, Math.min(CONFIG.WORLD_SIZE - this.size, this.x));
            this.y = Math.max(this.size, Math.min(CONFIG.WORLD_SIZE - this.size, this.y));
            if (this.evadeDuration <= 0) {
                this.isEvading = false;
            }
            this.wobble += 0.2;
            return; // Don't do normal movement while evading
        }

        if (this.isRanged) {
            // Ranged enemy behavior
            const now = performance.now();

            if (dist > this.attackRange) {
                // Move toward player if too far
                if (dist > 0) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                }
            } else if (dist < this.preferredRange * 0.8) {
                // Move away from player if too close
                if (dist > 0) {
                    this.x -= (dx / dist) * currentSpeed * 0.5;
                    this.y -= (dy / dist) * currentSpeed * 0.5;
                }
            }

            // Fire projectile if in range and cooldown is ready
            if (dist <= this.attackRange && now - this.lastAttack > this.attackCooldown) {
                this.lastAttack = now;
                const angle = Math.atan2(dy, dx);
                enemyProjectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * this.projectileSpeed,
                    vy: Math.sin(angle) * this.projectileSpeed,
                    damage: this.projectileDamage,
                    size: this.projectileSize,
                    color: this.projectileColor,
                    traveled: 0,
                    maxRange: this.attackRange * 1.5,
                });
            }
        } else {
            // Melee enemy behavior (original)
            if (dist > 0) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
        }

        this.wobble += 0.1;

        // Check collision with player (melee damage)
        if (dist < this.size + player.size) {
            player.takeDamage(this.damage, this.type);
        }
    }

    takeDamage(amount, weaponType = null) {
        // Apply resistance if this enemy has resistance to the weapon
        let finalDamage = amount;
        let isResisted = false;
        if (weaponType && this.resistances[weaponType]) {
            const resistLevel = this.resistances[weaponType];
            const reduction = getResistanceValue(resistLevel);
            finalDamage = amount * (1 - reduction);
            isResisted = true;
        }

        this.hp -= finalDamage;
        this.lastDamagedBy = weaponType;
        this.lastDamageSource = weaponType; // Track killing blow source for synergy

        // Show damage text (with "耐性!" indicator if resisted)
        if (isResisted) {
            createDamageText(this.x, this.y, finalDamage);
            // Add resistance indicator
            effects.push({
                type: 'resistText',
                x: this.x,
                y: this.y - 25,
                life: 400,
                maxLife: 400,
                vy: -1,
            });
        } else {
            createDamageText(this.x, this.y, finalDamage);
        }

        // Play weapon-specific hit sound
        if (weaponType) {
            switch (weaponType) {
                case 'antibody':
                    Sound.hitAntibody();
                    break;
                case 'enzyme':
                    Sound.hitEnzyme();
                    break;
                // atp and cilia sounds are played once per attack, not per enemy hit
            }
        }

        // Cancer cell splitting
        if (this.canSplit && !this.hasSplit && this.hp > 0 && this.hp <= this.maxHp * this.splitThreshold) {
            this.split();
        }

        // Parasite evasion when hit
        if (this.canEvade && this.hp > 0) {
            const now = performance.now();
            if (now - this.lastEvadeTime > this.evadeCooldown) {
                this.triggerEvade();
                this.lastEvadeTime = now;
            }
        }

        if (this.hp <= 0) {
            this.die();
        } else {
            // Play enemy-specific damage sound (only if not dying)
            switch (this.type) {
                case 'germ':
                    Sound.damageGerm();
                    break;
                case 'virus':
                    Sound.damageVirus();
                    break;
                case 'bacteria':
                    Sound.damageBacteria();
                    break;
                case 'cancer':
                    Sound.damageCancer();
                    break;
                case 'parasite':
                    Sound.damageParasite();
                    break;
                case 'exploder':
                    Sound.damageExploder();
                    break;
            }
        }
    }

    // Parasite evasion ability
    triggerEvade() {
        this.isEvading = true;
        this.evadeDuration = 200; // 200ms dash
        // Evade in random direction away from current position
        const angle = Math.random() * Math.PI * 2;
        this.evadeVx = Math.cos(angle) * this.evadeSpeed;
        this.evadeVy = Math.sin(angle) * this.evadeSpeed;
        // Create evade effect
        effects.push({
            type: 'evade',
            x: this.x,
            y: this.y,
            duration: 300,
            elapsed: 0,
            color: this.color,
        });
        Sound.evade();
    }

    // Cancer cell split ability
    split() {
        this.hasSplit = true;
        Sound.split();

        // Create split effect
        effects.push({
            type: 'split',
            x: this.x,
            y: this.y,
            duration: 400,
            elapsed: 0,
            color: this.color,
        });

        // Spawn smaller copies
        for (let i = 0; i < this.splitCount; i++) {
            const angle = (Math.PI * 2 / this.splitCount) * i;
            const offsetX = Math.cos(angle) * 25;
            const offsetY = Math.sin(angle) * 25;

            const child = new Enemy('cancer', this.x + offsetX, this.y + offsetY);
            // Smaller size and reduced stats
            child.size = this.size * 0.7;
            child.hp = this.hp * 0.6;
            child.maxHp = child.hp;
            child.damage = this.damage * 0.7;
            child.xp = Math.floor(this.xp * 0.5);
            child.hasSplit = true; // Prevent infinite splitting
            child.canSplit = false;
            // Inherit resistances
            child.resistances = { ...this.resistances };
            enemies.push(child);
        }

        // Remove the parent cell (it has split into children)
        const idx = enemies.indexOf(this);
        if (idx !== -1) enemies.splice(idx, 1);
    }

    // Exploder explosion
    triggerExplosion(player) {
        const idx = enemies.indexOf(this);
        if (idx !== -1) enemies.splice(idx, 1);

        // Increment mutation counter for the weapon that killed this enemy
        if (this.lastDamagedBy) {
            incrementMutationCounter(this.lastDamagedBy);
        }

        if (_incrementKillCount) _incrementKillCount();
        if (_onEnemyDeath) _onEnemyDeath(this.x, this.y, this.size);

        Sound.explosion();

        // Check if player is in explosion radius
        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        if (distToPlayer < this.explosionRadius + player.size) {
            // Damage falls off with distance
            const damageMult = 1 - (distToPlayer / (this.explosionRadius + player.size)) * 0.5;
            player.takeDamage(this.explosionDamage * damageMult);
        }

        // Drop XP (with opsonization bonus only if killed by antibody)
        const opsonBonus = this.opsonized && this.lastDamageSource === 'antibody';
        const xpValue = opsonBonus ? Math.floor(this.xp * 1.5) : this.xp;
        xpOrbs.push({
            x: this.x,
            y: this.y,
            value: xpValue,
            size: 5 + Math.min(xpValue, 10),
            opsonized: opsonBonus,
        });

        // Create explosion visual effect
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 / 16) * i;
            effects.push({
                type: 'particle',
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * 6,
                vy: Math.sin(angle) * 6,
                life: 500,
                maxLife: 500,
                color: '#00ff00',
                size: 10,
            });
        }

        // Explosion ring effect
        effects.push({
            type: 'explosionRing',
            x: this.x,
            y: this.y,
            radius: this.explosionRadius,
            duration: 400,
            elapsed: 0,
            color: '#00ff00',
        });
    }

    die() {
        // Exploder starts explosion countdown instead of dying immediately
        if (this.explodesOnDeath) {
            if (!this.isExploding) {
                // Start the countdown
                this.isExploding = true;
                this.explosionTimer = this.explosionDelay;
                Sound.exploderWarning();
            }
            // Always return - explosion will handle death
            return;
        }

        const idx = enemies.indexOf(this);
        if (idx !== -1) enemies.splice(idx, 1);

        // Increment mutation counter for the weapon that killed this enemy
        if (this.lastDamagedBy) {
            incrementMutationCounter(this.lastDamagedBy);
        }

        if (_incrementKillCount) _incrementKillCount();
        if (_onEnemyDeath) _onEnemyDeath(this.x, this.y, this.size);

        // Play enemy-specific death sound
        switch (this.type) {
            case 'germ':
                Sound.deathGerm();
                break;
            case 'virus':
                Sound.deathVirus();
                break;
            case 'bacteria':
                Sound.deathBacteria();
                break;
            case 'cancer':
                Sound.deathCancer();
                break;
            case 'parasite':
                Sound.deathParasite();
                break;
            case 'exploder':
                Sound.deathExploder();
                break;
            default:
                Sound.enemyDeath();
        }

        // Drop XP (with opsonization bonus only if killed by antibody)
        const opsonBonus = this.opsonized && this.lastDamageSource === 'antibody';
        const xpValue = opsonBonus ? Math.floor(this.xp * 1.5) : this.xp;
        xpOrbs.push({
            x: this.x,
            y: this.y,
            value: xpValue,
            size: 5 + Math.min(xpValue, 10),
            opsonized: opsonBonus, // For visual effect (only if actually got bonus)
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
        } else if (this.type === 'boss') {
            // Large menacing resistant bacteria boss
            const pulse = 1 + Math.sin(this.wobble) * 0.1;

            // Outer glow
            const glow = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.5);
            glow.addColorStop(0, 'rgba(224, 86, 253, 0.3)');
            glow.addColorStop(1, 'rgba(224, 86, 253, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.5 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Main body - bumpy circular shape
            ctx.fillStyle = this.color;
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const angle = (Math.PI * 2 / 16) * i;
                const r = this.size * pulse + Math.sin(this.wobble * 2 + i * 0.8) * 5;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // Inner darker core
            ctx.fillStyle = '#9b27af';
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Angry eyes
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-10, -5, 8, 0, Math.PI * 2);
            ctx.arc(10, -5, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(-10, -5, 4, 0, Math.PI * 2);
            ctx.arc(10, -5, 4, 0, Math.PI * 2);
            ctx.fill();

            // Frowning mouth
            ctx.strokeStyle = '#9b27af';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 10, 12, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
        } else if (this.type === 'spore') {
            // Mushroom/spore-like appearance
            ctx.fillStyle = this.color;

            // Main body (fuzzy circle)
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const angle = (Math.PI * 2 / 16) * i;
                const r = this.size + Math.sin(this.wobble * 2 + i * 0.8) * 2;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // Small spore dots around
            ctx.fillStyle = this.projectileColor;
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i + this.wobble * 0.3;
                const dist = this.size + 4;
                const px = Math.cos(angle) * dist;
                const py = Math.sin(angle) * dist;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Center eye
            ctx.fillStyle = '#2d3436';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'cancer') {
            // Cancer cell - irregular pink blob with multiple nuclei
            const pulse = 1 + Math.sin(this.wobble * 1.5) * 0.15;

            // Outer membrane (irregular shape)
            ctx.fillStyle = this.color;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const angle = (Math.PI * 2 / 10) * i;
                const irregularity = Math.sin(this.wobble * 2 + i * 1.2) * 4;
                const r = this.size * pulse + irregularity;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // Multiple nuclei (characteristic of cancer cells)
            ctx.fillStyle = '#ff1493';
            const nucleiCount = this.hasSplit ? 1 : 3;
            for (let i = 0; i < nucleiCount; i++) {
                const angle = (Math.PI * 2 / nucleiCount) * i + this.wobble * 0.5;
                const dist = this.size * 0.4;
                const nx = Math.cos(angle) * dist;
                const ny = Math.sin(angle) * dist;
                ctx.beginPath();
                ctx.arc(nx, ny, this.size * 0.25, 0, Math.PI * 2);
                ctx.fill();
            }

            // Mitotic spindle effect when about to split
            if (this.canSplit && !this.hasSplit && this.hp <= this.maxHp * 0.6) {
                ctx.strokeStyle = 'rgba(255, 20, 147, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-this.size, 0);
                ctx.lineTo(this.size, 0);
                ctx.stroke();
            }
        } else if (this.type === 'parasite') {
            // Parasite - worm-like golden creature
            const segments = 5;
            const segmentSize = this.size * 0.8;

            // Draw body segments
            ctx.fillStyle = this.color;
            for (let i = 0; i < segments; i++) {
                const offset = Math.sin(this.wobble * 3 + i * 0.8) * 3;
                const segX = -i * segmentSize * 0.6 + offset;
                const segY = Math.sin(this.wobble * 2 + i) * 2;
                const size = segmentSize * (1 - i * 0.1);
                ctx.beginPath();
                ctx.ellipse(segX, segY, size, size * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Head with eyes
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.ellipse(segmentSize * 0.5, 0, segmentSize * 1.2, segmentSize * 0.9, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eyes (beady and alert)
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(segmentSize * 0.7, -segmentSize * 0.3, 2, 0, Math.PI * 2);
            ctx.arc(segmentSize * 0.7, segmentSize * 0.3, 2, 0, Math.PI * 2);
            ctx.fill();

            // Evading indicator
            if (this.isEvading) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(0, 0, this.size + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else if (this.type === 'exploder') {
            // Exploder - toxic green bacteria with warning signs
            const pulse = this.isExploding ? 1 + Math.sin(this.wobble * 5) * 0.3 : 1 + Math.sin(this.wobble) * 0.1;

            // Warning glow when about to explode
            if (this.isExploding) {
                const warningGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, this.explosionRadius);
                warningGlow.addColorStop(0, 'rgba(255, 0, 0, 0.4)');
                warningGlow.addColorStop(0.5, 'rgba(255, 0, 0, 0.2)');
                warningGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.fillStyle = warningGlow;
                ctx.beginPath();
                ctx.arc(0, 0, this.explosionRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            // Main body (bumpy toxic blob)
            ctx.fillStyle = this.isExploding ? '#ff0000' : this.color;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                const bump = Math.sin(this.wobble * 3 + i * 1.5) * 3;
                const r = this.size * pulse + bump;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // Toxic bubbles
            ctx.fillStyle = this.isExploding ? '#ffff00' : '#7fff00';
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI * 2 / 4) * i + this.wobble * 0.5;
                const dist = this.size * 0.5;
                const bx = Math.cos(angle) * dist;
                const by = Math.sin(angle) * dist;
                ctx.beginPath();
                ctx.arc(bx, by, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Warning symbol when exploding
            if (this.isExploding) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('!', 0, 0);
            } else {
                // Normal eyes
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(-3, -2, 2, 0, Math.PI * 2);
                ctx.arc(3, -2, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();

        // Draw synergy effect indicators
        ctx.save();

        // Slow effect indicator (ice/blue glow)
        if (this.slowTimer > 0) {
            ctx.strokeStyle = 'rgba(116, 185, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, this.size + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // ADCC marked indicator (red target)
        if (this.adccMarked) {
            ctx.strokeStyle = 'rgba(255, 107, 107, 0.8)';
            ctx.lineWidth = 2;
            // Crosshair
            ctx.beginPath();
            ctx.arc(sx, sy, this.size + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx - this.size - 10, sy);
            ctx.lineTo(sx + this.size + 10, sy);
            ctx.moveTo(sx, sy - this.size - 10);
            ctx.lineTo(sx, sy + this.size + 10);
            ctx.stroke();
        }

        // Opsonized indicator (antibody marker)
        if (this.opsonized && !this.adccMarked) {
            ctx.fillStyle = 'rgba(78, 205, 196, 0.6)';
            ctx.beginPath();
            ctx.arc(sx, sy - this.size - 5, 4, 0, Math.PI * 2);
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

        // Draw resistance shield aura if enemy has any resistance
        const resistanceCount = Object.keys(this.resistances).length;
        if (resistanceCount > 0) {
            // Find highest resistance level for visual intensity
            const maxResist = Math.max(...Object.values(this.resistances));
            const shieldAlpha = 0.15 + maxResist * 0.1;
            const shieldSize = this.size + 8 + maxResist * 3;
            const pulse = 1 + Math.sin(this.wobble * 2) * 0.1;

            // Shield glow
            ctx.save();
            ctx.globalAlpha = shieldAlpha;
            const gradient = ctx.createRadialGradient(sx, sy, this.size * 0.5, sx, sy, shieldSize * pulse);
            gradient.addColorStop(0, 'rgba(255, 100, 100, 0)');
            gradient.addColorStop(0.7, 'rgba(255, 100, 100, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 50, 50, 0.5)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(sx, sy, shieldSize * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Shield ring
            ctx.strokeStyle = `rgba(255, 80, 80, ${0.4 + maxResist * 0.15})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(sx, sy, shieldSize * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Resistance level indicator (small icon)
            ctx.save();
            ctx.font = 'bold 10px Arial';
            ctx.fillStyle = '#ff6b6b';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.textAlign = 'center';
            const iconY = sy - this.size - 18;
            ctx.strokeText(`🛡${maxResist}`, sx, iconY);
            ctx.fillText(`🛡${maxResist}`, sx, iconY);
            ctx.restore();
        }
    }
}
