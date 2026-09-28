// shared/game-logic.js

export function createInitialState() {
    return {
        players: {}, // id: { x, y, vx, vy, angle, seq }
        bullets: []
    };
}

// Проста детермінована функція оновлення стану для одного гравця за один крок (dt)
export function updatePlayerState(player, input, dt) {
    const SPEED = 200; // пікселів за секунду
    const ROTATION_SPEED = Math.PI; // радіан за секунду

    if (input.turnLeft) {
        player.angle -= ROTATION_SPEED * dt;
    }
    if (input.turnRight) {
        player.angle += ROTATION_SPEED * dt;
    }

    if (input.thrust) {
        player.vx = Math.cos(player.angle) * SPEED;
        player.vy = Math.sin(player.angle) * SPEED;
    } else {
        // Згасання швидкості (тертя)
        player.vx *= 0.95;
        player.vy *= 0.95;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (input.seq) {
        player.seq = input.seq;
    }
}

// Загальна симуляція світу за крок dt
export function simulateWorld(state, inputsMap, dt) {
    // inputsMap - мапа ID гравця до його поточного інпуту
    for (const id in state.players) {
        const player = state.players[id];
        const input = inputsMap[id] || { thrust: false, turnLeft: false, turnRight: false };
        updatePlayerState(player, input, dt);
    }
}