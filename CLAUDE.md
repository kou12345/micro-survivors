# CLAUDE.md - AI Assistant Guide for Micro Survivors

## Project Overview

**Micro Survivors** is a browser-based roguelike survivor action game inspired by Vampire Survivors. Set in a microscopic world, the player controls an immune cell (white blood cell) fighting off waves of germs, viruses, and bacteria. The game features auto-attack mechanics, level-up progression, and wave-based enemy spawning.

- **Genre**: Roguelike Survivor Action
- **Platform**: Browser (deployed to Cloudflare Workers)
- **Technology**: Vanilla JavaScript with HTML5 Canvas (no frameworks)
- **Language**: UI text is in Japanese, code comments/names in English

## Codebase Structure

```
micro-survivors/
├── public/                     # Static assets served by Cloudflare Workers
│   ├── index.html             # Main entry point, game HTML structure
│   ├── css/
│   │   └── style.css          # All game styles, responsive design, UI components
│   └── js/
│       ├── game.js            # Main game loop, initialization, UI handlers
│       ├── config.js          # Game configuration constants (speeds, durations, wave settings)
│       ├── entities.js        # Player and Enemy classes
│       ├── weapons.js         # Weapon and passive item definitions
│       ├── state.js           # Shared mutable game state (avoids circular dependencies)
│       └── sound.js           # Web Audio API sound system (procedural audio)
├── docs/
│   └── GAME_DESIGN.md         # Japanese game design document with future plans
├── .github/workflows/
│   └── deploy.yml             # GitHub Actions CI/CD for Cloudflare deployment
├── wrangler.toml              # Cloudflare Workers configuration
└── package.json               # NPM scripts (dev, deploy, preview)
```

## Key Files and Their Responsibilities

### `public/js/game.js` (Main Entry Point)
- Game initialization (`init()` function exported and called on window load)
- Main game loop (`update()` and `draw()`)
- Wave system management (spawns enemy waves every 30 seconds)
- Level-up menu UI handling
- Mobile joystick controls
- Keyboard input handling (WASD/Arrow keys)

### `public/js/config.js`
- `CONFIG` object with all game constants:
  - Canvas dimensions (dynamically sized to window)
  - World size (2000x2000)
  - Game duration (default 10 minutes, selectable 3/5/10/15)
  - Player stats (speed, HP)
  - Wave system settings (interval, enemy counts)

### `public/js/entities.js`
- `Player` class: movement, weapons, damage, XP/leveling
- `Enemy` class: AI movement (chase player), damage, death/XP drops
- Uses callback pattern for cross-module communication (`setLevelUpCallback`, `setGameOverCallback`)

### `public/js/weapons.js`
- `WEAPONS`: Weapon definitions (antibody, enzyme, atp, cilia)
- `PASSIVES`: Passive buff definitions (mitochondria, ribosome, membrane, flagellum, nucleus)
- `ENEMY_TYPES`: Enemy stat definitions (germ, virus, bacteria)

### `public/js/state.js`
- Shared mutable state to avoid circular dependencies
- Arrays: `enemies`, `xpOrbs`, `projectiles`, `effects`
- Helper functions: `findNearestEnemy()`, `createHitEffect()`, `createDamageText()`

### `public/js/sound.js`
- Web Audio API-based procedural sound system
- Sound effects: hit, enemyDeath, playerDamage, xpPickup, levelUp, explosion, shoot
- Simple procedural BGM loop

## Development Workflow

### Local Development
```bash
npm install              # Install wrangler dependency
npm run dev             # Start local dev server with hot reload
npm run preview         # Local preview mode
```

### Deployment
```bash
npm run deploy          # Deploy to Cloudflare Workers
```

Deployment is automated via GitHub Actions on push to `main` branch. Requires `CLOUDFLARE_API_TOKEN` secret.

### Testing
- No automated tests currently implemented
- Manual testing in browser (desktop + mobile responsive)
- Test on actual mobile devices for touch controls

## Code Conventions

### JavaScript Style
- ES6 modules with explicit imports/exports
- No TypeScript, no build step for JS
- Classes for complex entities (Player, Enemy)
- Object literals for data definitions (WEAPONS, PASSIVES, ENEMY_TYPES)
- Callback patterns for cross-module events

### Naming Conventions
- camelCase for variables and functions
- PascalCase for classes
- UPPER_SNAKE_CASE for constants in CONFIG
- Descriptive names preferred (e.g., `createDamageText`, `findNearestEnemy`)

### State Management
- Mutable shared state in `state.js` to avoid circular dependencies
- Game state enum: `'start'`, `'playing'`, `'levelup'`, `'gameover'`
- Arrays modified in-place (splice for removal)

### Canvas Rendering
- Camera follows player, centered on screen
- Screen coordinates calculated as: `screenX = worldX - camera.x + CANVAS_WIDTH/2`
- All drawing in `draw()` function, called every frame
- Effects rendered with alpha/fade based on lifetime

## Game Mechanics Reference

### Weapons (Auto-attack)
| Weapon | Type | Behavior |
|--------|------|----------|
| antibody | Orbiting | Circles around player, damages on contact |
| enzyme | Projectile | Fires toward nearest enemy or facing direction |
| atp | Area | Places bomb that explodes after delay |
| cilia | Arc | Sweeps arc in front of player |

### Enemy Types
| Type | Speed | HP | Damage | XP |
|------|-------|-----|--------|-----|
| germ | 1 | 15 | 5 | 3 |
| virus | 2.5 | 8 | 8 | 5 |
| bacteria | 0.8 | 40 | 12 | 10 |

### Progression
- Enemies drop XP orbs on death
- XP required per level: `10 * 1.2^(level-1)`
- Level up offers 3 random choices (new weapon or upgrade)
- Weapons max level: 8
- Passives max stacks: 5
- Win condition: Survive until timer reaches 0

## Mobile Support

- Virtual joystick appears on screens ≤600px width
- Touch controls implemented in `setupJoystick()` in game.js
- Audio unlock required on first user interaction (iOS/Safari requirement)
- Responsive CSS breakpoints: 850px (tablet), 600px (mobile), 400px (small)

## Common Tasks

### Adding a New Weapon
1. Add definition to `WEAPONS` in `weapons.js`
2. Add attack logic in `Player.updateWeapons()` in `entities.js`
3. Add projectile rendering in `draw()` in `game.js` if needed

### Adding a New Enemy Type
1. Add definition to `ENEMY_TYPES` in `weapons.js`
2. Add drawing logic in `Enemy.draw()` in `entities.js`
3. Update spawn logic in `spawnEnemy()` / `spawnWave()` in `game.js`

### Adding a New Passive
1. Add definition to `PASSIVES` in `weapons.js`
2. Effect function receives player object, modifies multipliers

### Modifying Game Balance
- Tune values in `CONFIG` (config.js)
- Weapon/enemy stats in `weapons.js`
- Wave timing: `WAVE_INTERVAL`, `WAVE_BASE_ENEMIES`, `WAVE_ENEMIES_INCREMENT`

## Architecture Notes

### No Build Step
The game uses vanilla ES6 modules served directly. No transpilation, bundling, or minification. This keeps development simple but means:
- No npm dependencies in game code
- Browser must support ES6 modules
- Assets in `/public` are served as-is

### Circular Dependency Handling
`state.js` exists specifically to break circular dependencies between game.js, entities.js, and other modules. All shared mutable state lives there.

### Cloudflare Workers Static Site
The `wrangler.toml` configures Cloudflare Workers to serve static assets from `./public`. There is no server-side logic - it's purely a static site deployment.

## Documentation Convention

### docs/ フォルダについて
- **ドキュメントは日本語で記述**
- **コードとドキュメントは常に同期させる**
- コードを変更したら、対応するドキュメントも更新すること

### ドキュメント構成
| ファイル | 内容 |
|----------|------|
| `docs/GAME_DESIGN.md` | ゲーム全体のコンセプト・デザイン |
| `docs/WEAPONS.md` | 武器・パッシブアイテムの仕様 |
| `docs/ENEMIES.md` | 敵キャラクターの仕様 |
| `docs/SYSTEMS.md` | ゲームシステム（レベルアップ、ウェーブ等）|

### ドキュメント更新ルール
1. 新しい武器/敵/システムを追加 → 対応するドキュメントを更新
2. パラメータを変更 → ドキュメントの数値も更新
3. 機能を削除 → ドキュメントからも削除

## Future Improvements (from GAME_DESIGN.md)
- Additional player characters (T-cell, Macrophage, etc.)
- More enemy types (parasites, resistant bacteria, boss enemies)
- Additional stages (blood vessel, intestine, wound)
- Weapon evolution system
- More visual polish (pixel art style)
