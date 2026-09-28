// bus.js
// Глобальна шина подій, щоб рушій гри не залежав напряму від audio або UI
export const gameBus = new EventTarget();