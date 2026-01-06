import { CONFIG, setGameTime, updateCanvasSize } from './config.js';
import { Sound } from './sound.js';
import { WEAPONS, PASSIVES, SYNERGIES } from './weapons.js';
import { Player, Enemy, setLevelUpCallback, setGameOverCallback, setKillCountCallback, setEnemyDeathCallback, setSynergyCallback } from './entities.js';
import {
    gameState, setGameState, setPlayer,
    enemies, xpOrbs, projectiles, enemyProjectiles, effects, camera,
    createHitEffect
} from './state.js';
import {
    initBackground, updateBackground, drawBackground,
    addRipple, setWaveWarning
} from './background.js';

// Local state
let canvas, ctx;
let gameTime = 0;
let lastTime = 0;
let keys = {};
let killCount = 0;

// Wave system state
let currentWave = 0;
let nextWaveTime = 0;
let waveWarningShown = false;

// Synergy notification state
let synergyNotifications = [];

// Mobile touch controls
let joystick = {
    active: false,
    touchId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dy: 0
};

// Local player reference
let _player = null;

// Spawn enemy
function spawnEnemy() {
    const progress = gameTime / CONFIG.GAME_DURATION;
    const types = ['germ'];
    if (progress > 0.1) types.push('virus');
    if (progress > 0.3) types.push('bacteria');
    if (progress > 0.2) types.push('spore');

    const type = types[Math.floor(Math.random() * types.length)];

    // Spawn at edge of screen
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT) / 2 + 100;
    const x = _player.x + Math.cos(angle) * dist;
    const y = _player.y + Math.sin(angle) * dist;

    if (x > 0 && x < CONFIG.WORLD_SIZE && y > 0 && y < CONFIG.WORLD_SIZE) {
        const enemy = new Enemy(type, x, y);
        // Scale HP with time
        enemy.hp *= 1 + progress * 2;
        enemy.maxHp = enemy.hp;
        enemies.push(enemy);
    }
}

// Wave system - spawn a wave of enemies
function spawnWave(waveNumber) {
    const progress = gameTime / CONFIG.GAME_DURATION;
    const enemyCount = CONFIG.WAVE_BASE_ENEMIES + (waveNumber - 1) * CONFIG.WAVE_ENEMIES_INCREMENT;

    // Determine available enemy types based on progress
    const types = ['germ'];
    if (progress > 0.1) types.push('virus');
    if (progress > 0.3) types.push('bacteria');
    if (progress > 0.2) types.push('spore');

    // Spawn enemies in a circle around the player
    for (let i = 0; i < enemyCount; i++) {
        const angle = (Math.PI * 2 / enemyCount) * i + Math.random() * 0.3;
        const dist = Math.max(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT) / 2 + 80 + Math.random() * 100;
        const x = _player.x + Math.cos(angle) * dist;
        const y = _player.y + Math.sin(angle) * dist;

        if (x > 0 && x < CONFIG.WORLD_SIZE && y > 0 && y < CONFIG.WORLD_SIZE) {
            // Higher waves have more dangerous enemies
            let type;
            if (waveNumber >= 3 && types.includes('bacteria') && Math.random() < 0.3) {
                type = 'bacteria';
            } else if (waveNumber >= 2 && types.includes('virus') && Math.random() < 0.4) {
                type = 'virus';
            } else {
                type = types[Math.floor(Math.random() * types.length)];
            }

            const enemy = new Enemy(type, x, y);
            // Scale HP with time and wave number
            enemy.hp *= (1 + progress * 2) * (1 + waveNumber * 0.1);
            enemy.maxHp = enemy.hp;
            enemies.push(enemy);
        }
    }

    // Spawn boss at random position around player (always spawns, clamped to world bounds)
    const bossAngle = Math.random() * Math.PI * 2;
    const bossDist = Math.max(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT) / 2 + 150;
    const bossX = Math.max(50, Math.min(CONFIG.WORLD_SIZE - 50, _player.x + Math.cos(bossAngle) * bossDist));
    const bossY = Math.max(50, Math.min(CONFIG.WORLD_SIZE - 50, _player.y + Math.sin(bossAngle) * bossDist));

    const boss = new Enemy('boss', bossX, bossY);
    // Scale boss with wave number
    boss.hp *= 1 + waveNumber * 0.5;
    boss.maxHp = boss.hp;
    boss.damage *= 1 + waveNumber * 0.2;
    boss.xp *= 1 + waveNumber * 0.3;
    enemies.push(boss);

    Sound.explosion(); // Wave arrival sound
}

// Show wave warning UI
function showWaveWarning(waveNumber) {
    const warning = document.getElementById('waveWarning');
    const waveNum = document.getElementById('waveNumber');
    if (warning && waveNum) {
        waveNum.textContent = waveNumber;
        warning.classList.add('active');
    }
    setWaveWarning(true);
}

// Hide wave warning UI
function hideWaveWarning() {
    const warning = document.getElementById('waveWarning');
    if (warning) {
        warning.classList.remove('active');
    }
    setWaveWarning(false);
}

// Level Up System
function showLevelUpMenu() {
    setGameState('levelup');
    Sound.levelUp();
    const menu = document.getElementById('levelUpMenu');
    const options = document.getElementById('upgradeOptions');
    options.innerHTML = '';

    const choices = generateUpgradeChoices();
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'upgrade-btn';
        btn.innerHTML = `
            <div class="name">${choice.emoji} ${choice.name} ${choice.levelText || ''}</div>
            <div class="desc">${choice.desc}</div>
            <div class="science">📚 ${choice.science}</div>
        `;
        btn.onclick = () => selectUpgrade(choice);
        options.appendChild(btn);
    });

    menu.style.display = 'flex';
}

function generateUpgradeChoices() {
    const choices = [];
    const allOptions = [];

    // Weapons player doesn't have
    for (const [type, def] of Object.entries(WEAPONS)) {
        if (!_player.weapons[type]) {
            allOptions.push({
                type: 'weapon',
                key: type,
                name: def.name,
                desc: def.desc,
                emoji: def.emoji,
                levelText: 'NEW!',
                science: def.science,
            });
        } else if (_player.weapons[type].level < 8) {
            allOptions.push({
                type: 'weapon',
                key: type,
                name: def.name,
                desc: `レベル ${_player.weapons[type].level + 1} に強化`,
                emoji: def.emoji,
                levelText: `Lv.${_player.weapons[type].level} → ${_player.weapons[type].level + 1}`,
                science: def.science,
            });
        }
    }

    // Passives
    for (const [type, def] of Object.entries(PASSIVES)) {
        const count = _player.passives[type] || 0;
        if (count < 5) {
            allOptions.push({
                type: 'passive',
                key: type,
                name: def.name,
                desc: def.desc,
                emoji: def.emoji,
                levelText: count > 0 ? `x${count + 1}` : '',
                science: def.science,
            });
        }
    }

    // Pick 3 random
    while (choices.length < 3 && allOptions.length > 0) {
        const idx = Math.floor(Math.random() * allOptions.length);
        choices.push(allOptions.splice(idx, 1)[0]);
    }

    return choices;
}

function selectUpgrade(choice) {
    Sound.click();
    if (choice.type === 'weapon') {
        if (_player.weapons[choice.key]) {
            _player.weapons[choice.key].level++;
        } else {
            _player.weapons[choice.key] = { level: 1, lastAttack: 0, angle: 0 };
        }
    } else if (choice.type === 'passive') {
        _player.passives[choice.key] = (_player.passives[choice.key] || 0) + 1;
        PASSIVES[choice.key].effect(_player);
    }

    // Check for newly activated synergies
    _player.checkSynergies();

    updateWeaponDisplay();
    updateSynergyDisplay();
    document.getElementById('levelUpMenu').style.display = 'none';
    setGameState('playing');
}

function updateWeaponDisplay() {
    const display = document.getElementById('weaponDisplay');
    display.innerHTML = '';
    for (const [type, weapon] of Object.entries(_player.weapons)) {
        const def = WEAPONS[type];
        const div = document.createElement('div');
        div.className = 'weapon-icon';
        div.style.position = 'relative';
        div.innerHTML = `${def.emoji}<span class="weapon-level">${weapon.level}</span>`;
        display.appendChild(div);
    }
}

function updateSynergyDisplay() {
    const display = document.getElementById('synergyDisplay');
    if (!display) return;

    display.innerHTML = '';
    for (const [id, active] of Object.entries(_player.activeSynergies)) {
        if (active) {
            const synergy = SYNERGIES[id];
            const div = document.createElement('div');
            div.className = 'synergy-icon';
            div.title = `${synergy.name}: ${synergy.desc}`;
            div.innerHTML = synergy.emoji;
            display.appendChild(div);
        }
    }
}

function showSynergyNotification(synergy) {
    // Add to notification queue
    synergyNotifications.push({
        synergy: synergy,
        startTime: performance.now(),
        duration: 4000, // 4 seconds
    });

    // Also show popup notification
    const popup = document.getElementById('synergyPopup');
    if (popup) {
        popup.querySelector('.synergy-name').textContent = synergy.name;
        popup.querySelector('.synergy-desc').textContent = synergy.desc;
        popup.querySelector('.synergy-emoji').textContent = synergy.emoji;
        popup.querySelector('.synergy-science').textContent = synergy.science;
        popup.classList.add('active');

        setTimeout(() => {
            popup.classList.remove('active');
        }, 4000);
    }

    Sound.levelUp(); // Play activation sound
}

// Pause Menu System
function showPauseMenu() {
    setGameState('paused');
    Sound.click();

    // Update player info
    document.getElementById('infoLevel').textContent = _player.level;
    document.getElementById('infoHp').textContent = `${Math.round(_player.hp)} / ${Math.round(_player.maxHp)}`;

    // Update weapons info
    const weaponsDiv = document.getElementById('infoWeapons');
    weaponsDiv.innerHTML = '';
    const weaponEntries = Object.entries(_player.weapons);
    if (weaponEntries.length === 0) {
        weaponsDiv.innerHTML = '<div class="no-items">武器なし</div>';
    } else {
        for (const [type, weapon] of weaponEntries) {
            const def = WEAPONS[type];
            // Match actual damage calculation from entities.js
            const levelMultiplier = type === 'atp' ? 0.3 : 0.2;
            const damage = Math.round(def.damage * _player.damageMultiplier * (1 + weapon.level * levelMultiplier));
            const cooldown = Math.round(def.cooldown * _player.cooldownMultiplier);
            const div = document.createElement('div');
            div.className = 'info-item';
            div.innerHTML = `
                <div class="info-item-icon">${def.emoji}</div>
                <div class="info-item-details">
                    <div class="info-item-name">${def.name}</div>
                    <div class="info-item-level">Lv.${weapon.level}</div>
                    <div class="info-item-desc">ダメージ: ${damage} / CD: ${cooldown}ms</div>
                </div>
            `;
            weaponsDiv.appendChild(div);
        }
    }

    // Update passives info
    const passivesDiv = document.getElementById('infoPassives');
    passivesDiv.innerHTML = '';
    const passiveEntries = Object.entries(_player.passives);
    if (passiveEntries.length === 0) {
        passivesDiv.innerHTML = '<div class="no-items">パッシブなし</div>';
    } else {
        for (const [type, count] of passiveEntries) {
            const def = PASSIVES[type];
            const div = document.createElement('div');
            div.className = 'info-item';
            div.innerHTML = `
                <div class="info-item-icon">${def.emoji}</div>
                <div class="info-item-details">
                    <div class="info-item-name">${def.name}</div>
                    <div class="info-item-level">x${count}</div>
                    <div class="info-item-desc">${def.desc}</div>
                </div>
            `;
            passivesDiv.appendChild(div);
        }
    }

    // Update synergies info
    const synergiesDiv = document.getElementById('infoSynergies');
    if (synergiesDiv) {
        synergiesDiv.innerHTML = '';
        const activeSynergies = Object.entries(_player.activeSynergies).filter(([id, active]) => active);
        if (activeSynergies.length === 0) {
            synergiesDiv.innerHTML = '<div class="no-items">シナジーなし</div>';
        } else {
            for (const [id, active] of activeSynergies) {
                const synergy = SYNERGIES[id];
                const div = document.createElement('div');
                div.className = 'info-item synergy-item';
                div.innerHTML = `
                    <div class="info-item-icon">${synergy.emoji}</div>
                    <div class="info-item-details">
                        <div class="info-item-name">${synergy.name}</div>
                        <div class="info-item-desc">${synergy.desc}</div>
                        <div class="info-item-science">📚 ${synergy.science}</div>
                    </div>
                `;
                synergiesDiv.appendChild(div);
            }
        }
    }

    document.getElementById('pauseMenu').style.display = 'flex';
}

function hidePauseMenu() {
    document.getElementById('pauseMenu').style.display = 'none';
    setGameState('playing');
    Sound.click();
}

function togglePause() {
    if (gameState === 'playing') {
        showPauseMenu();
    } else if (gameState === 'paused') {
        hidePauseMenu();
    }
}

// Game Loop
function update(dt) {
    if (gameState !== 'playing') return;

    gameTime += dt;

    // Update background with game state
    const playerHpRatio = _player ? _player.hp / _player.maxHp : 1;
    updateBackground(dt, gameTime, CONFIG.GAME_DURATION, playerHpRatio);

    // Check win condition
    if (gameTime >= CONFIG.GAME_DURATION) {
        gameWin();
        return;
    }

    _player.update(dt, keys, joystick);

    // Update camera
    camera.x = _player.x;
    camera.y = _player.y;

    // Update enemies
    for (const enemy of [...enemies]) {
        enemy.update(dt, _player);
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (p.type === 'enzyme') {
            p.x += p.vx;
            p.y += p.vy;
            p.traveled += Math.hypot(p.vx, p.vy);

            // Check collision
            let shouldRemove = false;
            for (const enemy of enemies) {
                // Skip if already hit this enemy (for pierce)
                if (p.pierce && p.hitEnemies && p.hitEnemies.includes(enemy)) continue;

                const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
                if (dist < enemy.size + p.size) {
                    // Calculate damage with ADCC critical bonus
                    let damage = p.damage;
                    if (p.adccCritical && enemy.adccMarked) {
                        damage *= 2; // 2x critical damage on marked enemies
                        createHitEffect(p.x, p.y, '#ff6b6b'); // Red critical effect
                    }

                    enemy.takeDamage(damage, 'enzyme');
                    createHitEffect(p.x, p.y, p.color);

                    if (p.pierce) {
                        // Pierce: track hit enemy and continue
                        p.hitEnemies.push(enemy);
                    } else {
                        shouldRemove = true;
                        break;
                    }
                }
            }

            if (shouldRemove) {
                projectiles.splice(i, 1);
                continue;
            }

            if (p.traveled > p.range) {
                projectiles.splice(i, 1);
            }
        } else if (p.type === 'atp') {
            p.timer -= dt;
            if (p.timer <= 0) {
                // Explode
                Sound.hitAtp();
                for (const enemy of enemies) {
                    const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
                    if (dist < p.radius + enemy.size) {
                        enemy.takeDamage(p.damage, 'atp');
                    }
                }

                // Explosion effect
                for (let j = 0; j < 12; j++) {
                    const angle = (Math.PI * 2 / 12) * j;
                    effects.push({
                        type: 'particle',
                        x: p.x,
                        y: p.y,
                        vx: Math.cos(angle) * 5,
                        vy: Math.sin(angle) * 5,
                        life: 400,
                        maxLife: 400,
                        color: p.color,
                        size: 8,
                    });
                }

                // Synergy: motorEnergy - activate speed boost
                if (p.motorEnergy && !p.isChained) {
                    _player.motorEnergyTimer = 3000; // 3 seconds speed boost
                }

                // Synergy: energyOverload - chain explosion
                if (p.chainExplosion && !p.isChained) {
                    // Spawn 3 smaller chain explosions
                    for (let j = 0; j < 3; j++) {
                        const angle = (Math.PI * 2 / 3) * j + Math.random() * 0.5;
                        const chainDist = p.radius * 0.8;
                        projectiles.push({
                            type: 'atp',
                            x: p.x + Math.cos(angle) * chainDist,
                            y: p.y + Math.sin(angle) * chainDist,
                            damage: p.damage * 0.5, // 50% damage
                            radius: p.radius * 0.6, // 60% radius
                            timer: 300, // Quick explosion
                            color: '#ff7675',
                            chainExplosion: false,
                            motorEnergy: false,
                            isChained: true,
                        });
                    }
                }

                projectiles.splice(i, 1);
            }
        }
    }

    // Update XP orbs
    for (let i = xpOrbs.length - 1; i >= 0; i--) {
        const orb = xpOrbs[i];
        const dist = Math.hypot(orb.x - _player.x, orb.y - _player.y);
        const collectRange = 100 + _player.level * 5;

        if (dist < collectRange) {
            const speed = Math.max(5, 15 - dist / 20);
            const dx = _player.x - orb.x;
            const dy = _player.y - orb.y;
            orb.x += (dx / dist) * speed;
            orb.y += (dy / dist) * speed;
        }

        if (dist < _player.size) {
            _player.addXP(orb.value);
            xpOrbs.splice(i, 1);
            Sound.xpPickup();
        }
    }

    // Update enemy projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.traveled += Math.hypot(p.vx, p.vy);

        // Check collision with player
        const dist = Math.hypot(_player.x - p.x, _player.y - p.y);
        if (dist < _player.size + p.size) {
            _player.takeDamage(p.damage);
            createHitEffect(p.x, p.y, p.color);
            enemyProjectiles.splice(i, 1);
            continue;
        }

        // Remove if traveled too far
        if (p.traveled > p.maxRange) {
            enemyProjectiles.splice(i, 1);
        }
    }

    // Update effects
    for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        if (e.type === 'particle') {
            e.x += e.vx;
            e.y += e.vy;
            e.life -= dt;
            if (e.life <= 0) effects.splice(i, 1);
        } else if (e.type === 'cilia') {
            e.elapsed += dt;
            if (e.elapsed >= e.duration) effects.splice(i, 1);
        } else if (e.type === 'dash') {
            e.elapsed += dt;
            if (e.elapsed >= e.duration) effects.splice(i, 1);
        } else if (e.type === 'damageText') {
            e.y += e.vy;
            e.life -= dt;
            if (e.life <= 0) effects.splice(i, 1);
        }
    }

    // Wave system - check for incoming waves
    const timeUntilNextWave = nextWaveTime - gameTime;

    // Show warning before wave
    if (timeUntilNextWave <= CONFIG.WAVE_WARNING_TIME && timeUntilNextWave > 0 && !waveWarningShown) {
        waveWarningShown = true;
        showWaveWarning(currentWave + 1);
    }

    // Spawn wave when time is up
    if (gameTime >= nextWaveTime) {
        currentWave++;
        spawnWave(currentWave);
        hideWaveWarning();
        waveWarningShown = false;
        nextWaveTime = gameTime + CONFIG.WAVE_INTERVAL;
    }

    // Spawn regular enemies (reduced rate during wave warning)
    const spawnRate = 1000 - Math.min(gameTime / 1000, 800);
    if (Math.random() < dt / spawnRate) {
        spawnEnemy();
    }
}

function draw() {
    // Draw interactive background
    drawBackground(ctx, camera);

    // Draw XP orbs
    for (const orb of xpOrbs) {
        const sx = orb.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
        const sy = orb.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;

        // Opsonized orbs have golden glow
        const glowColor = orb.opsonized ? 'rgba(255, 215, 0, 0.8)' : 'rgba(78, 205, 196, 0.8)';
        const glowColorOut = orb.opsonized ? 'rgba(255, 215, 0, 0)' : 'rgba(78, 205, 196, 0)';
        const orbColor = orb.opsonized ? '#ffd700' : '#4ecdc4';

        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, orb.size * 2);
        glow.addColorStop(0, glowColor);
        glow.addColorStop(1, glowColorOut);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, orb.size * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = orbColor;
        ctx.beginPath();
        ctx.arc(sx, sy, orb.size, 0, Math.PI * 2);
        ctx.fill();

        // Opsonized orbs have a sparkle
        if (orb.opsonized) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - orb.size - 2, sy);
            ctx.lineTo(sx + orb.size + 2, sy);
            ctx.moveTo(sx, sy - orb.size - 2);
            ctx.lineTo(sx, sy + orb.size + 2);
            ctx.stroke();
        }
    }

    // Draw projectiles
    for (const p of projectiles) {
        const sx = p.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
        const sy = p.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;

        if (p.type === 'enzyme') {
            // Pierce projectiles have a trail
            if (p.pierce) {
                ctx.save();
                const angle = Math.atan2(p.vy, p.vx);
                ctx.translate(sx, sy);
                ctx.rotate(angle);
                ctx.fillStyle = 'rgba(123, 237, 159, 0.3)';
                ctx.beginPath();
                ctx.ellipse(-p.size, 0, p.size * 2, p.size * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
            ctx.fill();

            // ADCC projectiles have a red glow
            if (p.adccCritical) {
                ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size + 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (p.type === 'atp') {
            const pulse = 1 + Math.sin(performance.now() / 100) * 0.2;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, 15 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Warning circle
            ctx.strokeStyle = `rgba(255, 165, 2, ${0.3 + (1 - p.timer / 1500) * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, p.radius * (1 - p.timer / 1500), 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Draw enemy projectiles
    for (const p of enemyProjectiles) {
        const sx = p.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
        const sy = p.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;

        // Glow effect
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size * 2);
        glow.addColorStop(0, p.color);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw enemies
    for (const enemy of enemies) {
        enemy.draw(ctx, _player);
    }

    // Draw effects
    for (const e of effects) {
        if (e.type === 'particle') {
            const sx = e.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
            const sy = e.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;
            const alpha = e.life / e.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(sx, sy, e.size * alpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        } else if (e.type === 'cilia') {
            const sx = e.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
            const sy = e.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;
            const progress = e.elapsed / e.duration;
            const alpha = 1 - progress;

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(e.angle);
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, e.range, -e.arc / 2, e.arc / 2);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        } else if (e.type === 'dash') {
            const sx = e.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
            const sy = e.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;
            const progress = e.elapsed / e.duration;
            const alpha = 1 - progress;

            ctx.save();
            ctx.globalAlpha = alpha * 0.6;
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(e.angle) * 40, sy + Math.sin(e.angle) * 40);
            ctx.stroke();

            // Dash trail particles
            for (let i = 0; i < 3; i++) {
                const t = i / 3;
                const px = sx + Math.cos(e.angle) * 40 * t;
                const py = sy + Math.sin(e.angle) * 40 * t;
                ctx.fillStyle = e.color;
                ctx.beginPath();
                ctx.arc(px, py, 3 * (1 - t), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        } else if (e.type === 'damageText') {
            const sx = e.x - camera.x + CONFIG.CANVAS_WIDTH / 2;
            const sy = e.y - camera.y + CONFIG.CANVAS_HEIGHT / 2;
            const progress = 1 - e.life / e.maxLife;
            const alpha = 1 - progress;
            const scale = 1 + progress * 0.3;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${Math.round(16 * scale)}px Arial`;
            ctx.fillStyle = '#ffeb3b';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.textAlign = 'center';
            ctx.strokeText(e.damage, sx, sy);
            ctx.fillText(e.damage, sx, sy);
            ctx.restore();
        }
    }

    // Draw player
    if (gameState !== 'start') {
        _player.draw(ctx);
    }

    // Update UI
    document.getElementById('hpFill').style.width = `${(_player.hp / _player.maxHp) * 100}%`;
    document.getElementById('xpFill').style.width = `${(_player.xp / _player.xpToNext) * 100}%`;
    document.getElementById('levelDisplay').textContent = _player.level;

    const remaining = Math.max(0, CONFIG.GAME_DURATION - gameTime);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    document.getElementById('timer').textContent =
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function gameLoop(timestamp) {
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// Game State Functions
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('levelUpMenu').style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'none';

    // Show pause button
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.classList.add('active');
    }

    // Show joystick on mobile
    const joystickContainer = document.getElementById('joystickContainer');
    if (joystickContainer) {
        joystickContainer.classList.add('active');
    }

    // Initialize and start sound
    if (!Sound.ctx) Sound.init();
    Sound.resume();
    Sound.click();
    Sound.startBGM();

    setGameState('playing');
    gameTime = 0;
    killCount = 0;

    // Reset wave system
    currentWave = 0;
    nextWaveTime = CONFIG.WAVE_INTERVAL; // First wave after 30 seconds
    waveWarningShown = false;
    hideWaveWarning();

    // Initialize background
    initBackground();

    // Clear arrays
    enemies.length = 0;
    xpOrbs.length = 0;
    projectiles.length = 0;
    enemyProjectiles.length = 0;
    effects.length = 0;

    _player = new Player();
    setPlayer(_player);
    updateWeaponDisplay();
    synergyNotifications = [];
    updateSynergyDisplay();
}

function gameOver() {
    setGameState('gameover');
    Sound.stopBGM();
    Sound.playerDamage();

    // Hide joystick and pause button
    const joystickContainer = document.getElementById('joystickContainer');
    if (joystickContainer) {
        joystickContainer.classList.remove('active');
    }
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.classList.remove('active');
    }

    document.getElementById('finalTime').textContent = document.getElementById('timer').textContent;
    document.getElementById('finalLevel').textContent = _player.level;
    document.getElementById('finalKills').textContent = killCount;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function gameWin() {
    setGameState('gameover');
    Sound.stopBGM();
    Sound.levelUp();

    // Hide joystick and pause button
    const joystickContainer = document.getElementById('joystickContainer');
    if (joystickContainer) {
        joystickContainer.classList.remove('active');
    }
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.classList.remove('active');
    }

    const screen = document.getElementById('gameOverScreen');
    screen.querySelector('h2').textContent = 'VICTORY!';
    screen.querySelector('h2').style.color = '#4ecdc4';
    document.getElementById('finalTime').textContent = '15:00';
    document.getElementById('finalLevel').textContent = _player.level;
    document.getElementById('finalKills').textContent = killCount;
    screen.style.display = 'flex';
}

// Time selection handler
function handleSetGameTime(minutes) {
    setGameTime(minutes);
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.textContent === `${minutes} min`) {
            btn.classList.add('selected');
        }
    });
    Sound.click?.();
}

// Mobile joystick setup
function setupJoystick() {
    const joystickContainer = document.getElementById('joystickContainer');
    const joystickBase = document.getElementById('joystickBase');
    const joystickStick = document.getElementById('joystickStick');

    if (!joystickContainer) return;

    const maxDistance = 35; // Maximum stick travel distance

    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        joystick.active = true;
        joystick.touchId = touch.identifier;
        joystick.startX = centerX;
        joystick.startY = centerY;
        joystick.currentX = touch.clientX;
        joystick.currentY = touch.clientY;

        updateJoystickPosition(touch.clientX, touch.clientY);
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (!joystick.active) return;

        for (const touch of e.changedTouches) {
            if (touch.identifier === joystick.touchId) {
                joystick.currentX = touch.clientX;
                joystick.currentY = touch.clientY;
                updateJoystickPosition(touch.clientX, touch.clientY);
                break;
            }
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === joystick.touchId) {
                joystick.active = false;
                joystick.touchId = null;
                joystick.dx = 0;
                joystick.dy = 0;
                joystickStick.style.transform = 'translate(-50%, -50%)';
                break;
            }
        }
    }

    function updateJoystickPosition(touchX, touchY) {
        let dx = touchX - joystick.startX;
        let dy = touchY - joystick.startY;

        const distance = Math.hypot(dx, dy);
        if (distance > maxDistance) {
            dx = (dx / distance) * maxDistance;
            dy = (dy / distance) * maxDistance;
        }

        // Normalize for game input (-1 to 1)
        joystick.dx = dx / maxDistance;
        joystick.dy = dy / maxDistance;

        // Update visual position
        joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    // Add touch event listeners
    joystickContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    joystickContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    joystickContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
    joystickContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Prevent default touch behavior on canvas to avoid scrolling
    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
}

// Check if device is mobile
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 600);
}

// Resize canvas to fill screen
function resizeCanvas() {
    updateCanvasSize();
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;
}

// Unlock audio on user interaction (required for mobile browsers)
function setupAudioUnlock() {
    const unlockAudio = () => {
        Sound.unlock();
    };

    // Add listeners for various user interactions
    document.addEventListener('touchstart', unlockAudio, { once: false, passive: true });
    document.addEventListener('touchend', unlockAudio, { once: false, passive: true });
    document.addEventListener('click', unlockAudio, { once: false, passive: true });
    document.addEventListener('keydown', unlockAudio, { once: false, passive: true });
}

// Initialization
export function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Set initial canvas size and handle resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Set callbacks for entities
    setLevelUpCallback(showLevelUpMenu);
    setGameOverCallback(gameOver);
    setKillCountCallback(() => killCount++);
    setEnemyDeathCallback((x, y, size) => {
        // Add ripple effect when enemy dies
        addRipple(x, y, 50 + size * 2, 600);
    });
    setSynergyCallback(showSynergyNotification);

    // Setup audio unlock for mobile browsers
    setupAudioUnlock();

    // Input handling - keyboard
    window.addEventListener('keydown', e => {
        keys[e.key.toLowerCase()] = true;
        // Escape key to toggle pause
        if (e.key === 'Escape') {
            togglePause();
        }
    });
    window.addEventListener('keyup', e => {
        keys[e.key.toLowerCase()] = false;
    });

    // Setup pause button
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            togglePause();
        });
    }

    // Setup resume button
    const resumeButton = document.getElementById('resumeButton');
    if (resumeButton) {
        resumeButton.addEventListener('click', () => {
            hidePauseMenu();
        });
    }

    // Setup mobile joystick
    setupJoystick();

    // Initialize empty player for title screen
    _player = new Player();
    setPlayer(_player);

    // Expose functions to window for HTML onclick handlers
    window.startGame = startGame;
    window.setGameTime = handleSetGameTime;

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}
