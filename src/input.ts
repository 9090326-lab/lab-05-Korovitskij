export function createInput() {
  // Явно вказуємо типи для Map: ключ - рядок (код клавіші), значення - булеве
  const keys = new Map<string, boolean>();

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    keys.set(e.code, true);
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    keys.set(e.code, false);
  });

  return {
    // Вказуємо тип аргументу code та тип значення, яке повертає метод
    isPressed(code: string): boolean {
      return keys.get(code) === true;
    }
  };
}