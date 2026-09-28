// client/index.js
import { updatePlayerState } from '../shared/game-logic.js';

let localSeq = 0;
let myPlayerId = 1; // Задай ID свого гравця (або отримуй від сервера при підключенні)
let myState = { x: 400, y: 300, vx: 0, vy: 0, angle: 0 };
const pendingInputs = []; // Черга інпутів для клієнтської реконсиліації

// Метрики для netgraph
export const netgraphData = {
    rtt: 0,
    snapshotAge: 0,
    bytesPerSec: 0,
    inputQueueLength: 0,
    correctionMagnitude: 0
};

const keys = {};

// Слухаємо клавіатуру
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// Головна функція відправки інпутів та локального передбачення (викликай у game loop клієнта, наприклад, на 60fps)
export function clientTick(ws) {
    localSeq++;
    const input = {
        seq: localSeq,
        thrust: keys['ArrowUp'] || keys['KeyW'],
        turnLeft: keys['ArrowLeft'] || keys['KeyA'],
        turnRight: keys['ArrowRight'] || keys['KeyD']
    };

    // Зберігаємо в чергу для перегравання
    pendingInputs.push(input);
    netgraphData.inputQueueLength = pendingInputs.length;

    // 1. Передбачення: одразу рухаємо свій корабель локально
    updatePlayerState(myState, input, 1 / 60);

    // 2. Пакуємо інпут у бінарний формат і відправляємо на сервер
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(serializeInputBinary(input));
    }
}

// Пакування інпуту через DataView (little-endian)
function serializeInputBinary(input) {
    const buffer = new ArrayBuffer(6); // 4 байти seq + 1 байт прапорці + 1 байт резерв
    const view = new DataView(buffer);
    view.setUint32(0, input.seq, true);
    
    let flags = 0;
    if (input.thrust) flags |= 1;
    if (input.turnLeft) flags |= 2;
    if (input.turnRight) flags |= 4;
    view.setUint8(4, flags);

    return buffer;
}

// Обробка бінарного знімка від сервера через DataView з реконсиліацією
export function handleServerSnapshot(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    let offset = 0;

    const version = view.getUint8(offset); offset += 1;
    const playersCount = view.getUint16(offset, true); offset += 2;

    for (let i = 0; i < playersCount; i++) {
        const id = view.getUint32(offset, true); offset += 4;
        const serverX = view.getFloat32(offset, true); offset += 4;
        const serverY = view.getFloat32(offset, true); offset += 4;
        const serverAngle = view.getInt16(offset, true) / 1000; offset += 2;
        const lastSeq = view.getUint32(offset, true); offset += 4;

        if (id === myPlayerId) {
            const oldX = myState.x;
            const oldY = myState.y;

            // 1. Синхронізуємося з авторитетним станом сервера
            myState.x = serverX;
            myState.y = serverY;
            myState.angle = serverAngle;

            // 2. Видаляємо з черги підтверджені сервером інпути
            while (pendingInputs.length > 0 && pendingInputs[0].seq <= lastSeq) {
                pendingInputs.shift();
            }

            // 3. Реконсиліація: заново проігруємо неподтверджені інпути
            for (const input of pendingInputs) {
                updatePlayerState(myState, input, 1 / 60);
            }

            // Фіксуємо величину поправки для netgraph
            netgraphData.correctionMagnitude = Math.hypot(myState.x - oldX, myState.y - oldY);
        }
    }
}