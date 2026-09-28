export interface SimState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

export interface SimInput {
  thrust: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

// Переконайтеся, що стоїть слово `export`:
export function updatePlayerState(state: SimState, input: SimInput, dt: number): void {
  const rotationSpeed = 3.5;
  const thrustPower = 220;

  if (input.turnLeft) state.angle -= rotationSpeed * dt;
  if (input.turnRight) state.angle += rotationSpeed * dt;

  if (input.thrust) {
    state.vx += Math.cos(state.angle) * thrustPower * dt;
    state.vy += Math.sin(state.angle) * thrustPower * dt;
  }

  state.x += state.vx * dt;
  state.y += state.vy * dt;

  // Демпфування швидкості (тертя в космосі)
  state.vx *= 0.99;
  state.vy *= 0.99;
}