// src/audio.ts
import { gameBus } from './bus.js';

// Оголошуємо підтримку префікса webkitAudioContext для Window без використання заборонених any або as
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export class AudioManager {
  // Оголошуємо всі поля класу та їхні точні типи
  ctx: AudioContext | null = null;
  sounds: Record<string, AudioBuffer> = {};
  isUnlocked: boolean = false;

  constructor() {
    this.ctx = null;
    this.sounds = {};
    this.isUnlocked = false;

    // Підписуємося на події гри без прямого імпорту рушія
    gameBus.addEventListener('fired', () => this.play('shoot'));
    gameBus.addEventListener('hit', () => this.play('hit'));
    gameBus.addEventListener('exploded', () => this.play('exploded'));
  }

  getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('AudioContext не підтримується у цьому браузері');
      }
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  // Розблокування аудіоконтексту після жесту гравця
  async unlock(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.isUnlocked = true;
  }

  setSounds(soundBuffers: Record<string, AudioBuffer>): void {
    this.sounds = soundBuffers;
  }

  play(name: string): void {
    // Безпечне отримання звуку з урахуванням noUncheckedIndexedAccess
    const sound = this.sounds[name];
    if (!this.ctx || !sound) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = sound;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch (err: unknown) {
      // Сувора типізація помилки (unknown замість any)
      if (err instanceof Error) {
        console.warn(`Не вдалося відтворити звук ${name}:`, err.message);
      } else {
        console.warn(`Не вдалося відтворити звук ${name}:`, err);
      }
    }
  }
}

export const audioManager = new AudioManager();