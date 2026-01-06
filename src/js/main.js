import Phaser from 'phaser';
import { GameScene } from './GameScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'gameContainer',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0a192f',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
        activePointers: 3,
    },
};

const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
