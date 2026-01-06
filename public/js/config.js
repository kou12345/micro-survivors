// Game Configuration
export const CONFIG = {
    CANVAS_SIZE: 800,
    WORLD_SIZE: 2000,
    GAME_DURATION: 10 * 60 * 1000, // 10 minutes default
    PLAYER_SPEED: 3,
    PLAYER_MAX_HP: 100,
    XP_TO_LEVEL: level => Math.floor(10 * Math.pow(1.2, level - 1)),
};

// Time selection helper
export function setGameTime(minutes) {
    CONFIG.GAME_DURATION = minutes * 60 * 1000;
}
