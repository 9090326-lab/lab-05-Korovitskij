// src/assetLoader.ts

export interface AssetManifest {
  images?: Record<string, string>;
  audio?: Record<string, string>;
}

export interface LoadedAssets {
  images: Record<string, HTMLImageElement>;
  audio: Record<string, AudioBuffer>;
}

// Завантаження одного зображення через Promise
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не вдалося завантажити зображення: ${src}`));
    img.src = src;
  });
}

// Завантаження одного аудіофайлу у буфер Web Audio API
export async function loadAudio(url: string, audioCtx: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP помилка при завантаженні аудіо: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

// Універсальний завантажувач маніфесту ресурсів
export async function loadAssets(
  manifest: AssetManifest,
  audioCtx?: AudioContext
): Promise<LoadedAssets> {
  const loadedImages: Record<string, HTMLImageElement> = {};
  const loadedAudio: Record<string, AudioBuffer> = {};

  if (manifest.images) {
    const imagePromises = Object.entries(manifest.images).map(async ([key, src]) => {
      loadedImages[key] = await loadImage(src);
    });
    await Promise.all(imagePromises);
  }

  if (manifest.audio && audioCtx) {
    const audioPromises = Object.entries(manifest.audio).map(async ([key, src]) => {
      loadedAudio[key] = await loadAudio(src, audioCtx);
    });
    await Promise.all(audioPromises);
  }

  return {
    images: loadedImages,
    audio: loadedAudio,
  };
}