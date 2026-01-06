// Weapon Definitions
export const WEAPONS = {
    antibody: {
        name: '抗体',
        desc: 'プレイヤー周囲を回転して攻撃',
        emoji: '🔵',
        color: '#4ecdc4',
        damage: 10,
        cooldown: 100,
        orbits: 2,
        range: 60,
        speed: 0.05,
    },
    enzyme: {
        name: '酵素弾',
        desc: '前方に発射する弾丸',
        emoji: '💚',
        color: '#7bed9f',
        damage: 15,
        cooldown: 800,
        speed: 8,
        range: 300,
    },
    atp: {
        name: 'ATP爆弾',
        desc: '設置して時間差で爆発',
        emoji: '💥',
        color: '#ffa502',
        damage: 30,
        cooldown: 2000,
        radius: 80,
        delay: 1500,
    },
    cilia: {
        name: '繊毛ウィップ',
        desc: '鞭状に薙ぎ払い',
        emoji: '🌊',
        color: '#a29bfe',
        damage: 20,
        cooldown: 1200,
        range: 100,
        arc: Math.PI * 0.8,
    },
};

// Passive Items
export const PASSIVES = {
    mitochondria: {
        name: 'ミトコンドリア',
        desc: '攻撃力+15%',
        emoji: '🔋',
        effect: (p) => p.damageMultiplier += 0.15,
    },
    ribosome: {
        name: 'リボソーム',
        desc: '経験値+20%',
        emoji: '🧬',
        effect: (p) => p.xpMultiplier += 0.2,
    },
    membrane: {
        name: '細胞膜強化',
        desc: '被ダメージ-15%',
        emoji: '🛡️',
        effect: (p) => p.defenseMultiplier += 0.15,
    },
    flagellum: {
        name: '鞭毛',
        desc: '移動速度+15%',
        emoji: '🏃',
        effect: (p) => p.speedMultiplier += 0.15,
    },
    nucleus: {
        name: '核膜',
        desc: 'クールダウン-10%',
        emoji: '⚡',
        effect: (p) => p.cooldownMultiplier -= 0.1,
    },
};

// Enemy Definitions
export const ENEMY_TYPES = {
    germ: {
        name: '雑菌',
        color: '#2ecc71',
        size: 12,
        hp: 15,
        speed: 1,
        damage: 5,
        xp: 3,
    },
    virus: {
        name: 'ウイルス',
        color: '#e74c3c',
        size: 10,
        hp: 8,
        speed: 2.5,
        damage: 8,
        xp: 5,
    },
    bacteria: {
        name: 'バクテリア',
        color: '#9b59b6',
        size: 20,
        hp: 40,
        speed: 0.8,
        damage: 12,
        xp: 10,
        width: 30,
        height: 12,
    },
};
