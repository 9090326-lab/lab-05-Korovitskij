// 1. Vector2 з чистими методами (не мутують поточний об'єкт)
export class Vector2 {
  x: number;
  y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  mult(n: number): Vector2 {
    return new Vector2(this.x * n, this.y * n);
  }

  mag(): number {
    return Math.hypot(this.x, this.y);
  }

  normalize(): Vector2 {
    const m = this.mag();
    return m === 0 ? new Vector2() : new Vector2(this.x / m, this.y / m);
  }
}

// 2. Базовий клас Entity з приватним лічильником #id
export class Entity {
  static #nextId = 1;
  #id: number;

  pos: Vector2;
  vel: Vector2;
  radius: number;
  kind: string;
  isDead: boolean = false;

  constructor(pos: Vector2, vel: Vector2, radius: number, kind: string) {
    this.#id = Entity.#nextId++;
    this.pos = pos;
    this.vel = vel;
    this.radius = radius;
    this.kind = kind; // 'ship', 'bullet', 'asteroid', 'pickup'
    this.isDead = false;
  }

  get id(): number {
    return this.#id;
  }

  update(dt: number, _world?: World): void {
    this.pos = this.pos.add(this.vel.mult(dt));
  }
}

// 3. Корабель з лаби 1 (один рівень extends, приватне #hp)
export class Ship extends Entity {
  #hp: number = 100;

  angle: number = 0;
  rotationSpeed: number = 3.5;
  thrust: number = 220;
  respawnTimer: number = 0;
  fire: (world: World) => void;

  constructor(pos: Vector2) {
    super(pos, new Vector2(0, 0), 18, 'ship');
    this.angle = 0;
    this.rotationSpeed = 3.5;
    this.thrust = 220;
    this.respawnTimer = 0;

    // Фікс втрати контексту this (варіант 1)
    this.fire = this.fireMethod.bind(this);
  }

  get hp(): number {
    return this.#hp;
  }

  takeDamage(amount: number): void {
    this.#hp = Math.max(0, this.#hp - amount);
    if (this.#hp === 0) {
      this.respawnTimer = 2.0; // затримка респауну 2 с
    }
  }

  respawn(pos: Vector2): void {
    this.#hp = 100;
    this.pos = pos;
    this.vel = new Vector2(0, 0);
    this.respawnTimer = 0;
  }

  // Постріл з носа корабля
  private fireMethod(world: World): void {
    if (this.#hp <= 0) return;
    const dir = new Vector2(Math.cos(this.angle), Math.sin(this.angle));
    const nosePos = this.pos.add(dir.mult(this.radius + 4));
    const bulletVel = this.vel.add(dir.mult(400));
    world.spawn(new Bullet(nosePos, bulletVel));
  }

  override update(dt: number): void {
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn(new Vector2(400, 300));
      }
      return;
    }
    super.update(dt);
    // Демпфування швидкості
    this.vel = this.vel.mult(0.99);
  }
}

// 4. Куля з TTL (Time To Live)
export class Bullet extends Entity {
  ttl: number;
  homing: HomingBehavior | null = null; // слот для композиції

  constructor(pos: Vector2, vel: Vector2, ttl: number = 1.8) {
    super(pos, vel, 3, 'bullet');
    this.ttl = ttl;
    this.homing = null;
  }

  override update(dt: number, world?: World): void {
    if (this.homing && world) {
      this.homing.update(this, dt, world);
    }
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) this.isDead = true;
  }
}

// 5. Астероїд / перешкода
export class Asteroid extends Entity {
  constructor(pos: Vector2, vel: Vector2, radius: number = 25) {
    super(pos, vel, radius, 'asteroid');
  }
}

// 6. Фіча 1 через композицію: Самонаведення (Homing)
export class HomingBehavior {
  targetKind: string;
  turnRate: number;

  constructor(targetKind: string = 'asteroid', turnRate: number = 5) {
    this.targetKind = targetKind;
    this.turnRate = turnRate;
  }

  update(entity: Entity, dt: number, world: World): void {
    let nearest: Entity | null = null;
    let minDist = Infinity;

    for (const target of world.ofKind(this.targetKind)) {
      const d = target.pos.sub(entity.pos).mag();
      if (d < minDist) {
        minDist = d;
        nearest = target;
      }
    }

    if (nearest) {
      const currentSpeed = entity.vel.mag() || 300;
      const desiredDir = nearest.pos.sub(entity.pos).normalize();
      const currentDir = entity.vel.normalize();
      const newDir = currentDir.add(desiredDir.sub(currentDir).mult(this.turnRate * dt)).normalize();
      entity.vel = newDir.mult(currentSpeed);
    }
  }
}

// 7. Фіча 2 через композицію: Pickup (бонус, що стоїть і підбирається)
export class Pickup extends Entity {
  effectType: string;

  constructor(pos: Vector2, effectType: string = 'heal') {
    super(pos, new Vector2(0, 0), 12, 'pickup');
    this.effectType = effectType;
  }

  apply(_ship: Ship): void {
    if (this.effectType === 'heal') {
      // при підборі відновити стан корабля
    }
    this.isDead = true;
  }
}

// 8. World поверх Map<id, Entity>
export class World {
  entities: Map<number, Entity> = new Map();
  score: number = 0;

  constructor() {
    this.entities = new Map();
    this.score = 0;
  }

  spawn<T extends Entity>(entity: T): T {
    this.entities.set(entity.id, entity);
    return entity;
  }

  despawn(id: number): void {
    const e = this.entities.get(id);
    if (e) e.isDead = true;
  }

  // Генератор ofKind
  *ofKind(kind: string): Generator<Entity, void, unknown> {
    for (const entity of this.entities.values()) {
      if (entity.kind === kind && !entity.isDead) {
        yield entity;
      }
    }
  }

  step(dt: number): void {
    // 1. Оновлення всіх сутностей
    for (const entity of this.entities.values()) {
      entity.update(dt, this);
    }

    // 2. Очищення мертвих сутностей
    for (const [id, entity] of this.entities) {
      if (entity.isDead) {
        this.entities.delete(id);
      }
    }
  }

  #handleHit(_a: Entity, _b: Entity): void {
    this.score += 100;
  }
}