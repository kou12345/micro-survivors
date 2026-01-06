import Phaser from 'phaser';
import { CONFIG } from './config.js';
import { WEAPONS, PASSIVES, ENEMY_TYPES } from './weapons.js';
import { Sound } from './sound.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init() {
        // Game state
        this.gameState = 'start';
        this.gameTime = 0;
        this.killCount = 0;

        // Wave system
        this.currentWave = 0;
        this.nextWaveTime = 0;
        this.waveWarningShown = false;

        // Player stats
        this.playerStats = {
            hp: CONFIG.PLAYER_MAX_HP,
            maxHp: CONFIG.PLAYER_MAX_HP,
            level: 1,
            xp: 0,
            xpToNext: CONFIG.XP_TO_LEVEL(1),
            weapons: { antibody: { level: 1, angle: 0, lastAttack: 0 } },
            passives: {},
            damageMultiplier: 1,
            xpMultiplier: 1,
            defenseMultiplier: 0,
            speedMultiplier: 1,
            cooldownMultiplier: 1,
            invincible: 0,
            facingAngle: 0,
        };

        // Joystick state
        this.joystick = {
            active: false,
            dx: 0,
            dy: 0,
        };
    }

    create() {
        // Set world bounds
        this.physics.world.setBounds(0, 0, CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE);

        // Create background
        this.createBackground();

        // Create groups
        this.enemies = this.physics.add.group();
        this.projectiles = this.physics.add.group();
        this.xpOrbs = this.physics.add.group();
        this.antibodies = this.add.group();

        // Create player
        this.createPlayer();

        // Setup camera
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1);

        // Setup input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        });

        // Setup mobile joystick
        this.setupJoystick();

        // Setup audio unlock
        this.setupAudioUnlock();

        // Collision handlers
        this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        this.physics.add.overlap(this.projectiles, this.enemies, this.handleProjectileEnemyCollision, null, this);
        this.physics.add.overlap(this.player, this.xpOrbs, this.handleXpCollection, null, this);

        // Expose to window for HTML buttons
        window.gameInstance = this;
    }

    createBackground() {
        // Dark background
        this.add.rectangle(CONFIG.WORLD_SIZE / 2, CONFIG.WORLD_SIZE / 2, CONFIG.WORLD_SIZE, CONFIG.WORLD_SIZE, 0x0a192f);

        // Grid
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x4ecdc4, 0.1);
        const gridSize = 50;
        for (let x = 0; x <= CONFIG.WORLD_SIZE; x += gridSize) {
            graphics.lineBetween(x, 0, x, CONFIG.WORLD_SIZE);
        }
        for (let y = 0; y <= CONFIG.WORLD_SIZE; y += gridSize) {
            graphics.lineBetween(0, y, CONFIG.WORLD_SIZE, y);
        }

        // Floating bubbles (static decoration)
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * CONFIG.WORLD_SIZE;
            const y = Math.random() * CONFIG.WORLD_SIZE;
            const r = 10 + Math.random() * 20;
            const circle = this.add.circle(x, y, r, 0x4ecdc4, 0.1);
        }
    }

    createPlayer() {
        // Create player graphics
        this.player = this.add.container(CONFIG.WORLD_SIZE / 2, CONFIG.WORLD_SIZE / 2);

        // Body
        const body = this.add.graphics();
        body.fillStyle(0xf8f8f8);
        body.fillCircle(0, 0, 20);
        body.lineStyle(2, 0xdddddd);
        body.strokeCircle(0, 0, 20);

        // Nucleus
        const nucleus = this.add.circle(0, 0, 8, 0xa29bfe);

        // Eyes
        const leftEye = this.add.circle(-5, -3, 3, 0x2d3436);
        const rightEye = this.add.circle(5, -3, 3, 0x2d3436);

        this.player.add([body, nucleus, leftEye, rightEye]);

        // Add physics body
        this.physics.world.enable(this.player);
        this.player.body.setCircle(20, -20, -20);
        this.player.body.setCollideWorldBounds(true);

        // Store reference to body graphics for animation
        this.playerBodyGraphics = body;
    }

    setupJoystick() {
        const joystickContainer = document.getElementById('joystickContainer');
        const joystickBase = document.getElementById('joystickBase');
        const joystickStick = document.getElementById('joystickStick');

        if (!joystickContainer) return;

        const maxDistance = 35;

        const handleTouchStart = (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            const rect = joystickBase.getBoundingClientRect();
            this.joystick.active = true;
            this.joystick.startX = rect.left + rect.width / 2;
            this.joystick.startY = rect.top + rect.height / 2;
            this.joystick.touchId = touch.identifier;
            this.updateJoystickPosition(touch.clientX, touch.clientY, maxDistance, joystickStick);
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            if (!this.joystick.active) return;
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.joystick.touchId) {
                    this.updateJoystickPosition(touch.clientX, touch.clientY, maxDistance, joystickStick);
                    break;
                }
            }
        };

        const handleTouchEnd = (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === this.joystick.touchId) {
                    this.joystick.active = false;
                    this.joystick.dx = 0;
                    this.joystick.dy = 0;
                    joystickStick.style.transform = 'translate(-50%, -50%)';
                    break;
                }
            }
        };

        joystickContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        joystickContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        joystickContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
        joystickContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }

    updateJoystickPosition(touchX, touchY, maxDistance, joystickStick) {
        let dx = touchX - this.joystick.startX;
        let dy = touchY - this.joystick.startY;

        const distance = Math.hypot(dx, dy);
        if (distance > maxDistance) {
            dx = (dx / distance) * maxDistance;
            dy = (dy / distance) * maxDistance;
        }

        this.joystick.dx = dx / maxDistance;
        this.joystick.dy = dy / maxDistance;

        joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    setupAudioUnlock() {
        const unlockAudio = () => {
            Sound.unlock();
        };
        document.addEventListener('touchstart', unlockAudio, { passive: true });
        document.addEventListener('click', unlockAudio, { passive: true });
        document.addEventListener('keydown', unlockAudio, { passive: true });
    }

    update(time, delta) {
        if (this.gameState !== 'playing') return;

        this.gameTime += delta;

        // Check win condition
        if (this.gameTime >= CONFIG.GAME_DURATION) {
            this.gameWin();
            return;
        }

        this.updatePlayer(delta);
        this.updateEnemies(delta);
        this.updateProjectiles(delta);
        this.updateXpOrbs(delta);
        this.updateWeapons(time);
        this.updateWaveSystem();
        this.spawnEnemies(delta);
        this.updateUI();
    }

    updatePlayer(delta) {
        let dx = 0, dy = 0;

        // Keyboard input
        if (this.cursors.up.isDown || this.wasd.up.isDown) dy = -1;
        if (this.cursors.down.isDown || this.wasd.down.isDown) dy = 1;
        if (this.cursors.left.isDown || this.wasd.left.isDown) dx = -1;
        if (this.cursors.right.isDown || this.wasd.right.isDown) dx = 1;

        // Joystick input
        if (this.joystick.active) {
            dx = this.joystick.dx;
            dy = this.joystick.dy;
        }

        // Normalize for keyboard
        if (!this.joystick.active && (dx !== 0 || dy !== 0)) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        if (dx !== 0 || dy !== 0) {
            this.playerStats.facingAngle = Math.atan2(dy, dx);
        }

        const speed = CONFIG.PLAYER_SPEED * this.playerStats.speedMultiplier;
        this.player.body.setVelocity(dx * speed, dy * speed);

        // Invincibility timer
        if (this.playerStats.invincible > 0) {
            this.playerStats.invincible -= delta;
            this.player.alpha = Math.floor(this.playerStats.invincible / 50) % 2 ? 0.5 : 1;
        } else {
            this.player.alpha = 1;
        }
    }

    updateWeapons(time) {
        const stats = this.playerStats;

        for (const [type, weapon] of Object.entries(stats.weapons)) {
            const def = WEAPONS[type];
            const cooldown = def.cooldown * stats.cooldownMultiplier;

            if (type === 'antibody') {
                weapon.angle += def.speed * (1 + weapon.level * 0.2);
                const orbits = def.orbits + Math.floor(weapon.level / 2);
                const range = def.range + weapon.level * 10;

                // Update or create antibody visuals
                this.updateAntibodies(orbits, range, weapon);
            } else if (type === 'enzyme' && time - weapon.lastAttack > cooldown) {
                weapon.lastAttack = time;
                Sound.shoot();
                this.fireEnzyme(weapon, def);
            } else if (type === 'atp' && time - weapon.lastAttack > cooldown) {
                weapon.lastAttack = time;
                this.placeATP(weapon, def);
            } else if (type === 'cilia' && time - weapon.lastAttack > cooldown) {
                weapon.lastAttack = time;
                this.useCilia(weapon, def);
            }
        }
    }

    updateAntibodies(orbits, range, weapon) {
        // Clear existing antibodies
        this.antibodies.clear(true, true);

        const damage = WEAPONS.antibody.damage * this.playerStats.damageMultiplier * (1 + weapon.level * 0.2);

        for (let i = 0; i < orbits; i++) {
            const angle = weapon.angle + (Math.PI * 2 / orbits) * i;
            const ox = this.player.x + Math.cos(angle) * range;
            const oy = this.player.y + Math.sin(angle) * range;

            // Create antibody visual
            const antibody = this.add.circle(ox, oy, 10 + weapon.level, WEAPONS.antibody.color);
            const highlight = this.add.circle(ox - 3, oy - 3, 3, 0xffffff);
            this.antibodies.add(antibody);
            this.antibodies.add(highlight);

            // Check collision with enemies
            this.enemies.getChildren().forEach(enemy => {
                if (!enemy.active) return;
                const dist = Phaser.Math.Distance.Between(ox, oy, enemy.x, enemy.y);
                if (dist < enemy.getData('size') + 15) {
                    const now = this.time.now;
                    const lastHit = enemy.getData('lastHitAntibody') || 0;
                    if (now - lastHit > 200) {
                        enemy.setData('lastHitAntibody', now);
                        this.damageEnemy(enemy, damage);
                        this.createHitEffect(ox, oy, WEAPONS.antibody.color);
                    }
                }
            });
        }
    }

    fireEnzyme(weapon, def) {
        const target = this.findNearestEnemy();
        const angle = target
            ? Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y)
            : this.playerStats.facingAngle;
        const count = 1 + Math.floor(weapon.level / 3);
        const damage = def.damage * this.playerStats.damageMultiplier * (1 + weapon.level * 0.2);

        for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 0.15;
            const projectile = this.add.circle(this.player.x, this.player.y, 6 + weapon.level, def.color);
            this.physics.world.enable(projectile);
            projectile.body.setCircle(6 + weapon.level);

            const vx = Math.cos(angle + spread) * def.speed;
            const vy = Math.sin(angle + spread) * def.speed;
            projectile.body.setVelocity(vx, vy);

            projectile.setData('type', 'enzyme');
            projectile.setData('damage', damage);
            projectile.setData('range', def.range + weapon.level * 30);
            projectile.setData('traveled', 0);
            projectile.setData('startX', this.player.x);
            projectile.setData('startY', this.player.y);

            this.projectiles.add(projectile);
        }
    }

    placeATP(weapon, def) {
        const damage = def.damage * this.playerStats.damageMultiplier * (1 + weapon.level * 0.3);
        const radius = def.radius + weapon.level * 15;

        const atp = this.add.circle(this.player.x, this.player.y, 15, def.color);
        atp.setData('type', 'atp');
        atp.setData('damage', damage);
        atp.setData('radius', radius);
        atp.setData('timer', def.delay);

        // Warning circle
        const warning = this.add.circle(this.player.x, this.player.y, radius, 0xffa502, 0);
        warning.setStrokeStyle(2, 0xffa502, 0.3);
        atp.setData('warning', warning);

        this.projectiles.add(atp);
    }

    useCilia(weapon, def) {
        const target = this.findNearestEnemy();
        const baseAngle = target
            ? Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y)
            : this.playerStats.facingAngle;
        const range = def.range + weapon.level * 15;
        const arc = def.arc + weapon.level * 0.1;
        const damage = def.damage * this.playerStats.damageMultiplier * (1 + weapon.level * 0.2);

        // Visual effect
        const graphics = this.add.graphics();
        graphics.fillStyle(def.color, 0.5);
        graphics.slice(this.player.x, this.player.y, range, baseAngle - arc / 2, baseAngle + arc / 2, false);
        graphics.fillPath();

        this.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 200,
            onComplete: () => graphics.destroy(),
        });

        // Hit enemies in arc
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (dist < range + enemy.getData('size')) {
                const enemyAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                let angleDiff = enemyAngle - baseAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                if (Math.abs(angleDiff) < arc / 2) {
                    this.damageEnemy(enemy, damage);
                    this.createHitEffect(enemy.x, enemy.y, def.color);
                }
            }
        });
    }

    updateEnemies(delta) {
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;

            // Move towards player
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            const speed = enemy.getData('speed');
            enemy.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

            // Update wobble animation
            const wobble = enemy.getData('wobble') + 0.1;
            enemy.setData('wobble', wobble);
        });
    }

    updateProjectiles(delta) {
        this.projectiles.getChildren().forEach(projectile => {
            if (!projectile.active) return;

            const type = projectile.getData('type');

            if (type === 'enzyme') {
                const traveled = Phaser.Math.Distance.Between(
                    projectile.getData('startX'),
                    projectile.getData('startY'),
                    projectile.x,
                    projectile.y
                );
                if (traveled > projectile.getData('range')) {
                    projectile.destroy();
                }
            } else if (type === 'atp') {
                let timer = projectile.getData('timer') - delta;
                projectile.setData('timer', timer);

                // Pulse effect
                const scale = 1 + Math.sin(this.time.now / 100) * 0.2;
                projectile.setScale(scale);

                // Update warning
                const warning = projectile.getData('warning');
                if (warning) {
                    const progress = 1 - timer / WEAPONS.atp.delay;
                    warning.setStrokeStyle(2, 0xffa502, 0.3 + progress * 0.5);
                    warning.setScale(progress);
                }

                if (timer <= 0) {
                    this.explodeATP(projectile);
                }
            }
        });
    }

    explodeATP(atp) {
        Sound.explosion();
        const damage = atp.getData('damage');
        const radius = atp.getData('radius');
        const warning = atp.getData('warning');

        // Damage enemies
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(atp.x, atp.y, enemy.x, enemy.y);
            if (dist < radius + enemy.getData('size')) {
                this.damageEnemy(enemy, damage);
            }
        });

        // Explosion effect
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const particle = this.add.circle(atp.x, atp.y, 8, WEAPONS.atp.color);
            this.tweens.add({
                targets: particle,
                x: atp.x + Math.cos(angle) * 80,
                y: atp.y + Math.sin(angle) * 80,
                alpha: 0,
                scale: 0,
                duration: 400,
                onComplete: () => particle.destroy(),
            });
        }

        if (warning) warning.destroy();
        atp.destroy();
    }

    updateXpOrbs(delta) {
        const collectRange = 100 + this.playerStats.level * 5;

        this.xpOrbs.getChildren().forEach(orb => {
            if (!orb.active) return;

            const dist = Phaser.Math.Distance.Between(orb.x, orb.y, this.player.x, this.player.y);

            if (dist < collectRange) {
                // Attract to player
                const angle = Phaser.Math.Angle.Between(orb.x, orb.y, this.player.x, this.player.y);
                const speed = Math.max(100, 300 - dist);
                orb.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            } else {
                orb.body.setVelocity(0, 0);
            }
        });
    }

    updateWaveSystem() {
        const timeUntilNextWave = this.nextWaveTime - this.gameTime;

        if (timeUntilNextWave <= CONFIG.WAVE_WARNING_TIME && timeUntilNextWave > 0 && !this.waveWarningShown) {
            this.waveWarningShown = true;
            this.showWaveWarning(this.currentWave + 1);
        }

        if (this.gameTime >= this.nextWaveTime) {
            this.currentWave++;
            this.spawnWave(this.currentWave);
            this.hideWaveWarning();
            this.waveWarningShown = false;
            this.nextWaveTime = this.gameTime + CONFIG.WAVE_INTERVAL;
        }
    }

    spawnWave(waveNumber) {
        const progress = this.gameTime / CONFIG.GAME_DURATION;
        const enemyCount = CONFIG.WAVE_BASE_ENEMIES + (waveNumber - 1) * CONFIG.WAVE_ENEMIES_INCREMENT;

        const types = ['germ'];
        if (progress > 0.1) types.push('virus');
        if (progress > 0.3) types.push('bacteria');

        for (let i = 0; i < enemyCount; i++) {
            const angle = (Math.PI * 2 / enemyCount) * i + Math.random() * 0.3;
            const dist = Math.max(this.scale.width, this.scale.height) / 2 + 80 + Math.random() * 100;
            const x = this.player.x + Math.cos(angle) * dist;
            const y = this.player.y + Math.sin(angle) * dist;

            if (x > 0 && x < CONFIG.WORLD_SIZE && y > 0 && y < CONFIG.WORLD_SIZE) {
                let type;
                if (waveNumber >= 3 && types.includes('bacteria') && Math.random() < 0.3) {
                    type = 'bacteria';
                } else if (waveNumber >= 2 && types.includes('virus') && Math.random() < 0.4) {
                    type = 'virus';
                } else {
                    type = types[Math.floor(Math.random() * types.length)];
                }

                const hpMultiplier = (1 + progress * 2) * (1 + waveNumber * 0.1);
                this.spawnEnemy(type, x, y, hpMultiplier);
            }
        }

        Sound.explosion();
    }

    spawnEnemies(delta) {
        const progress = this.gameTime / CONFIG.GAME_DURATION;
        const spawnRate = 1000 - Math.min(this.gameTime / 1000, 800);

        if (Math.random() < delta / spawnRate) {
            const types = ['germ'];
            if (progress > 0.1) types.push('virus');
            if (progress > 0.3) types.push('bacteria');

            const type = types[Math.floor(Math.random() * types.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.max(this.scale.width, this.scale.height) / 2 + 100;
            const x = this.player.x + Math.cos(angle) * dist;
            const y = this.player.y + Math.sin(angle) * dist;

            if (x > 0 && x < CONFIG.WORLD_SIZE && y > 0 && y < CONFIG.WORLD_SIZE) {
                const hpMultiplier = 1 + progress * 2;
                this.spawnEnemy(type, x, y, hpMultiplier);
            }
        }
    }

    spawnEnemy(type, x, y, hpMultiplier = 1) {
        const def = ENEMY_TYPES[type];
        const enemy = this.add.graphics();

        enemy.setPosition(x, y);
        this.drawEnemy(enemy, type, def);

        this.physics.world.enable(enemy);
        enemy.body.setCircle(def.size, -def.size, -def.size);

        enemy.setData('type', type);
        enemy.setData('hp', def.hp * hpMultiplier);
        enemy.setData('maxHp', def.hp * hpMultiplier);
        enemy.setData('speed', def.speed);
        enemy.setData('damage', def.damage);
        enemy.setData('xp', def.xp);
        enemy.setData('size', def.size);
        enemy.setData('color', def.color);
        enemy.setData('wobble', Math.random() * Math.PI * 2);

        this.enemies.add(enemy);
    }

    drawEnemy(graphics, type, def) {
        graphics.clear();

        if (type === 'germ') {
            graphics.fillStyle(def.color);
            graphics.fillCircle(0, 0, def.size);
        } else if (type === 'virus') {
            graphics.fillStyle(def.color);
            graphics.fillCircle(0, 0, def.size);
            graphics.lineStyle(2, def.color);
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                graphics.lineBetween(
                    Math.cos(angle) * def.size,
                    Math.sin(angle) * def.size,
                    Math.cos(angle) * (def.size + 6),
                    Math.sin(angle) * (def.size + 6)
                );
            }
        } else if (type === 'bacteria') {
            graphics.fillStyle(def.color);
            graphics.fillRoundedRect(-def.width / 2, -def.height / 2, def.width, def.height, def.height / 2);
        }
    }

    handlePlayerEnemyCollision(player, enemy) {
        if (!enemy.active || this.playerStats.invincible > 0) return;

        const damage = enemy.getData('damage') * (1 - this.playerStats.defenseMultiplier);
        this.playerStats.hp -= damage;
        this.playerStats.invincible = 500;
        this.createHitEffect(this.player.x, this.player.y, 0xff6b6b);
        Sound.playerDamage();

        if (this.playerStats.hp <= 0) {
            this.gameOver();
        }
    }

    handleProjectileEnemyCollision(projectile, enemy) {
        if (!projectile.active || !enemy.active) return;
        if (projectile.getData('type') !== 'enzyme') return;

        const damage = projectile.getData('damage');
        this.damageEnemy(enemy, damage);
        this.createHitEffect(projectile.x, projectile.y, WEAPONS.enzyme.color);
        projectile.destroy();
    }

    handleXpCollection(player, orb) {
        if (!orb.active) return;

        const dist = Phaser.Math.Distance.Between(orb.x, orb.y, this.player.x, this.player.y);
        if (dist < 20) {
            const value = orb.getData('value');
            this.addXP(value);
            Sound.xpPickup();
            orb.destroy();
        }
    }

    damageEnemy(enemy, amount) {
        let hp = enemy.getData('hp') - amount;
        enemy.setData('hp', hp);

        if (hp <= 0) {
            this.killEnemy(enemy);
        }
    }

    killEnemy(enemy) {
        this.killCount++;
        Sound.enemyDeath();

        // Drop XP
        const xpValue = enemy.getData('xp');
        this.spawnXpOrb(enemy.x, enemy.y, xpValue);

        // Death effect
        const color = enemy.getData('color');
        for (let i = 0; i < 5; i++) {
            const particle = this.add.circle(enemy.x, enemy.y, 4, color);
            this.tweens.add({
                targets: particle,
                x: enemy.x + (Math.random() - 0.5) * 60,
                y: enemy.y + (Math.random() - 0.5) * 60,
                alpha: 0,
                duration: 300,
                onComplete: () => particle.destroy(),
            });
        }

        enemy.destroy();
    }

    spawnXpOrb(x, y, value) {
        const size = 5 + Math.min(value, 10);
        const orb = this.add.circle(x, y, size, 0x4ecdc4);
        this.physics.world.enable(orb);
        orb.body.setCircle(size);
        orb.setData('value', value);
        this.xpOrbs.add(orb);

        // Glow effect
        const glow = this.add.circle(x, y, size * 2, 0x4ecdc4, 0.3);
        orb.setData('glow', glow);

        // Update glow position
        this.tweens.add({
            targets: glow,
            alpha: 0.1,
            yoyo: true,
            repeat: -1,
            duration: 500,
        });
    }

    addXP(amount) {
        this.playerStats.xp += amount * this.playerStats.xpMultiplier;
        while (this.playerStats.xp >= this.playerStats.xpToNext) {
            this.playerStats.xp -= this.playerStats.xpToNext;
            this.playerStats.level++;
            this.playerStats.xpToNext = CONFIG.XP_TO_LEVEL(this.playerStats.level);
            this.showLevelUpMenu();
        }
    }

    createHitEffect(x, y, color) {
        for (let i = 0; i < 3; i++) {
            const particle = this.add.circle(x, y, 3, color);
            this.tweens.add({
                targets: particle,
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                alpha: 0,
                duration: 200,
                onComplete: () => particle.destroy(),
            });
        }
    }

    findNearestEnemy() {
        let nearest = null;
        let nearestDist = Infinity;

        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        });

        return nearest;
    }

    showWaveWarning(waveNumber) {
        const warning = document.getElementById('waveWarning');
        const waveNum = document.getElementById('waveNumber');
        if (warning && waveNum) {
            waveNum.textContent = waveNumber;
            warning.classList.add('active');
        }
    }

    hideWaveWarning() {
        const warning = document.getElementById('waveWarning');
        if (warning) {
            warning.classList.remove('active');
        }
    }

    showLevelUpMenu() {
        this.gameState = 'levelup';
        Sound.levelUp();

        const menu = document.getElementById('levelUpMenu');
        const options = document.getElementById('upgradeOptions');
        options.innerHTML = '';

        const choices = this.generateUpgradeChoices();
        choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.className = 'upgrade-btn';
            btn.innerHTML = `
                <div class="name">${choice.emoji} ${choice.name} ${choice.levelText || ''}</div>
                <div class="desc">${choice.desc}</div>
            `;
            btn.onclick = () => this.selectUpgrade(choice);
            options.appendChild(btn);
        });

        menu.style.display = 'flex';
    }

    generateUpgradeChoices() {
        const choices = [];
        const allOptions = [];

        for (const [type, def] of Object.entries(WEAPONS)) {
            if (!this.playerStats.weapons[type]) {
                allOptions.push({
                    type: 'weapon',
                    key: type,
                    name: def.name,
                    desc: def.desc,
                    emoji: def.emoji,
                    levelText: 'NEW!',
                });
            } else if (this.playerStats.weapons[type].level < 8) {
                allOptions.push({
                    type: 'weapon',
                    key: type,
                    name: def.name,
                    desc: `レベル ${this.playerStats.weapons[type].level + 1} に強化`,
                    emoji: def.emoji,
                    levelText: `Lv.${this.playerStats.weapons[type].level} → ${this.playerStats.weapons[type].level + 1}`,
                });
            }
        }

        for (const [type, def] of Object.entries(PASSIVES)) {
            const count = this.playerStats.passives[type] || 0;
            if (count < 5) {
                allOptions.push({
                    type: 'passive',
                    key: type,
                    name: def.name,
                    desc: def.desc,
                    emoji: def.emoji,
                    levelText: count > 0 ? `x${count + 1}` : '',
                });
            }
        }

        while (choices.length < 3 && allOptions.length > 0) {
            const idx = Math.floor(Math.random() * allOptions.length);
            choices.push(allOptions.splice(idx, 1)[0]);
        }

        return choices;
    }

    selectUpgrade(choice) {
        Sound.click();

        if (choice.type === 'weapon') {
            if (this.playerStats.weapons[choice.key]) {
                this.playerStats.weapons[choice.key].level++;
            } else {
                this.playerStats.weapons[choice.key] = { level: 1, lastAttack: 0, angle: 0 };
            }
        } else if (choice.type === 'passive') {
            this.playerStats.passives[choice.key] = (this.playerStats.passives[choice.key] || 0) + 1;
            PASSIVES[choice.key].effect(this.playerStats);
        }

        this.updateWeaponDisplay();
        document.getElementById('levelUpMenu').style.display = 'none';
        this.gameState = 'playing';
    }

    updateWeaponDisplay() {
        const display = document.getElementById('weaponDisplay');
        display.innerHTML = '';
        for (const [type, weapon] of Object.entries(this.playerStats.weapons)) {
            const def = WEAPONS[type];
            const div = document.createElement('div');
            div.className = 'weapon-icon';
            div.style.position = 'relative';
            div.innerHTML = `${def.emoji}<span class="weapon-level">${weapon.level}</span>`;
            display.appendChild(div);
        }
    }

    updateUI() {
        document.getElementById('hpFill').style.width = `${(this.playerStats.hp / this.playerStats.maxHp) * 100}%`;
        document.getElementById('xpFill').style.width = `${(this.playerStats.xp / this.playerStats.xpToNext) * 100}%`;
        document.getElementById('levelDisplay').textContent = this.playerStats.level;

        const remaining = Math.max(0, CONFIG.GAME_DURATION - this.gameTime);
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        document.getElementById('timer').textContent =
            `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    startGame() {
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('levelUpMenu').style.display = 'none';

        const joystickContainer = document.getElementById('joystickContainer');
        if (joystickContainer) {
            joystickContainer.classList.add('active');
        }

        if (!Sound.ctx) Sound.init();
        Sound.resume();
        Sound.click();
        Sound.startBGM();

        // Reset game state
        this.gameState = 'playing';
        this.gameTime = 0;
        this.killCount = 0;
        this.currentWave = 0;
        this.nextWaveTime = CONFIG.WAVE_INTERVAL;
        this.waveWarningShown = false;
        this.hideWaveWarning();

        // Reset player stats
        this.playerStats = {
            hp: CONFIG.PLAYER_MAX_HP,
            maxHp: CONFIG.PLAYER_MAX_HP,
            level: 1,
            xp: 0,
            xpToNext: CONFIG.XP_TO_LEVEL(1),
            weapons: { antibody: { level: 1, angle: 0, lastAttack: 0 } },
            passives: {},
            damageMultiplier: 1,
            xpMultiplier: 1,
            defenseMultiplier: 0,
            speedMultiplier: 1,
            cooldownMultiplier: 1,
            invincible: 0,
            facingAngle: 0,
        };

        // Clear entities
        this.enemies.clear(true, true);
        this.projectiles.clear(true, true);
        this.xpOrbs.getChildren().forEach(orb => {
            const glow = orb.getData('glow');
            if (glow) glow.destroy();
        });
        this.xpOrbs.clear(true, true);
        this.antibodies.clear(true, true);

        // Reset player position
        this.player.setPosition(CONFIG.WORLD_SIZE / 2, CONFIG.WORLD_SIZE / 2);

        this.updateWeaponDisplay();
    }

    setGameTime(minutes) {
        CONFIG.GAME_DURATION = minutes * 60 * 1000;
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.textContent === `${minutes} min`) {
                btn.classList.add('selected');
            }
        });
        Sound.click?.();
    }

    gameOver() {
        this.gameState = 'gameover';
        Sound.stopBGM();
        Sound.playerDamage();

        const joystickContainer = document.getElementById('joystickContainer');
        if (joystickContainer) {
            joystickContainer.classList.remove('active');
        }

        document.getElementById('finalTime').textContent = document.getElementById('timer').textContent;
        document.getElementById('finalLevel').textContent = this.playerStats.level;
        document.getElementById('finalKills').textContent = this.killCount;

        const screen = document.getElementById('gameOverScreen');
        screen.querySelector('h2').textContent = 'GAME OVER';
        screen.querySelector('h2').style.color = '#ff6b6b';
        screen.style.display = 'flex';
    }

    gameWin() {
        this.gameState = 'gameover';
        Sound.stopBGM();
        Sound.levelUp();

        const joystickContainer = document.getElementById('joystickContainer');
        if (joystickContainer) {
            joystickContainer.classList.remove('active');
        }

        const screen = document.getElementById('gameOverScreen');
        screen.querySelector('h2').textContent = 'VICTORY!';
        screen.querySelector('h2').style.color = '#4ecdc4';
        document.getElementById('finalTime').textContent = document.getElementById('timer').textContent;
        document.getElementById('finalLevel').textContent = this.playerStats.level;
        document.getElementById('finalKills').textContent = this.killCount;
        screen.style.display = 'flex';
    }
}
