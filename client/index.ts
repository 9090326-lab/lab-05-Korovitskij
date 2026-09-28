// client/index.ts
import { updatePlayerState } from '../shared/game-logic.js';

// ДОДАНО: Описуємо типи для стану гравця та інпуту
export interface ClientPlayerState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
}

export interface ClientInput {
    seq: number;
    thrust: boolean;
    turnLeft: boolean;
    turnRight: boolean;
}

let localSeq = 0;
let myPlayerId = 1; // Задай ID свого гравця (або отримуй від сервера при підключенні)
// ДОДАНО: Вказуємо тип для myState
let myState: ClientPlayerState = { x: 400, y: 300, vx: 0, vy: 0, angle: 0 };
// ДОДАНО: Явно вказуємо, що це масив наших інпутів
const pendingInputs: ClientInput[] = []; 

// Метрики для netgraph
export const netgraphData = {
    rtt: 0,
    snapshotAge: 0,
    bytesPerSec: 0,
    inputQueueLength: 0,
    correctionMagnitude: 0
};

// ДОДАНО: Типізуємо об'єкт клавіш (ключ - рядок, значення - булеве)
const keys: Record<string, boolean> = {};

// Слухаємо клавіатуру (ДОДАНО: типізація події KeyboardEvent)
window.addEventListener('keydown', (e: KeyboardEvent) => { keys[e.code] = true; });
window.addEventListener('keyup', (e: KeyboardEvent) => { keys[e.code] = false; });

// Головна функція відправки інпутів та локального передбачення
// ДОДАНО: типізація ws як WebSocket
export function clientTick(ws: WebSocket | null | undefined) {
    localSeq++;
    
    // ДОДАНО: Приводимо значення до чіткого boolean за допомогою !! (бо keys може повернути undefined)
    const input: ClientInput = {
        seq: localSeq,
        thrust: !!(keys['ArrowUp'] || keys['KeyW']),
        turnLeft: !!(keys['ArrowLeft'] || keys['KeyA']),
        turnRight: !!(keys['ArrowRight'] || keys['KeyD'])
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
// ДОДАНО: типізація аргументу input та типу повернення ArrayBuffer
function serializeInputBinary(input: ClientInput): ArrayBuffer {
    const buffer = new ArrayBuffer(6); // 4 байти seq + 1 байт пропорці + 1 байт резерв
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
// ДОДАНО: типізація аргументу arrayBuffer
export function handleServerSnapshot(arrayBuffer: ArrayBuffer) {
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
            // ДОДАНО: Знак оклику ! каже компілятору, що елемент [0] точно існує, бо ми перевірили length > 0
            while (pendingInputs.length > 0 && pendingInputs[0]!.seq <= lastSeq) {
                pendingInputs.shift();
            }

            // 3. Реконсиліація: заново програємо непідтверджені інпути
            for (const input of pendingInputs) {
                updatePlayerState(myState, input, 1 / 60);
            }

            // Фіксуємо величину поправки для netgraph
            netgraphData.correctionMagnitude = Math.hypot(myState.x - oldX, myState.y - oldY);
        }
    }
}