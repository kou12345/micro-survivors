// Game Configuration
export const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 800,
    WORLD_SIZE: 2000,
    GAME_DURATION: 10 * 60 * 1000, // 10 minutes default
    PLAYER_SPEED: 3,
    PLAYER_MAX_HP: 100,
    XP_TO_LEVEL: level => Math.floor(10 * Math.pow(1.2, level - 1)),

    // Wave system settings
    WAVE_INTERVAL: 30 * 1000,       // 30秒ごとにウェーブ発生
    WAVE_BASE_ENEMIES: 15,          // 基本敵数
    WAVE_ENEMIES_INCREMENT: 8,      // ウェーブごとに増加する敵数
    WAVE_WARNING_TIME: 3000,        // ウェーブ予告時間（3秒前）
};

// Update canvas size based on screen dimensions
export function updateCanvasSize() {
    CONFIG.CANVAS_WIDTH = window.innerWidth;
    CONFIG.CANVAS_HEIGHT = window.innerHeight;
}

// Time selection helper
export function setGameTime(minutes) {
    CONFIG.GAME_DURATION = minutes * 60 * 1000;
}
