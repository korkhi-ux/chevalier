import {
  TILE_SIZE,
  MAP_W,
  MAP_H,
  WORLD_W,
  WORLD_H,
  SCREEN_W,
  SCREEN_H,
  SWORD_COLORS,
  KEYS,
  FORGE_COSTS,
} from '../constants';
import { Player, Enemy, Prop, Room, Entity, GameStats, Vector } from '../types';

export class GameEngine {
  ctx: CanvasRenderingContext2D;
  fogCanvas: HTMLCanvasElement;
  fogCtx: CanvasRenderingContext2D;
  onUiUpdate: (stats: GameStats) => void;

  // State
  active: boolean = true;
  paused: boolean = false;
  keys: { [key: string]: boolean } = {};
  mouse: { x: number; y: number; screenX: number; screenY: number } = {
    x: 0,
    y: 0,
    screenX: 0,
    screenY: 0,
  };
  camera: { x: number; y: number } = { x: 0, y: 0 };

  // Entities
  player: Player;
  map: number[][] = [];
  rooms: Room[] = [];
  spawnGates: { x: number; y: number }[] = [];
  enemies: Enemy[] = [];
  projectiles: any[] = [];
  particles: any[] = [];
  items: any[] = [];
  props: Prop[] = [];
  decorations: any[] = []; // carpets, torches

  // Locations
  forge: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 40, h: 30 };
  altar: { x: number; y: number; w: number; h: number; unlocked: boolean } = {
    x: 0,
    y: 0,
    w: 30,
    h: 40,
    unlocked: false,
  };

  // Wave Logic
  wave = {
    current: 1,
    max: 10,
    totalEnemies: 0,
    killedInWave: 0,
    timer: 0,
    nextTriggered: false,
  };

  // Modal State for Engine control
  modalState: 'none' | 'forge' | 'altar' = 'none';
  gameOver = false;
  victory = false;

  constructor(
    ctx: CanvasRenderingContext2D,
    onUiUpdate: (stats: GameStats) => void
  ) {
    this.ctx = ctx;
    this.onUiUpdate = onUiUpdate;

    // Init Fog
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = WORLD_W;
    this.fogCanvas.height = WORLD_H;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.fogCtx.fillStyle = 'black';
    this.fogCtx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Init Player default
    this.player = {
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      w: 14,
      h: 18,
      vx: 0,
      vy: 0,
      speed: 2.3,
      hp: 100,
      maxHp: 100,
      mana: 100,
      maxMana: 100,
      gold: 0,
      blood: 0,
      kills: 0,
      swordLevel: 0,
      baseDmg: 30,
      swinging: false,
      swingAngle: 0,
      swingBaseAngle: 0,
      swingProgress: 0,
      hitList: [],
      lightRadius: 200,
      isUlting: false,
      ultTimer: 0,
      ultDir: 0,
      hasMagnet: false,
      hasMinimap: false,
      canPause: false,
      type: 'player',
    };

    this.init();
  }

  init() {
    this.generateDungeon();
    // Initial props
    for (let i = 0; i < 60; i++) this.spawnRandomProp();
    this.startWave(1);
  }

  // --- GENERATION ---
  generateDungeon() {
    this.map = Array(MAP_H)
      .fill(0)
      .map(() => Array(MAP_W).fill(1)); // 1 = Wall
    this.rooms = [];

    const roomCount = 16;
    for (let i = 0; i < roomCount; i++) {
      let w = Math.floor(Math.random() * 6) + 4;
      let h = Math.floor(Math.random() * 6) + 4;
      let x = Math.floor(Math.random() * (MAP_W - w - 2)) + 1;
      let y = Math.floor(Math.random() * (MAP_H - h - 2)) + 1;

      if (i === 0) {
        x = Math.floor(MAP_W / 2 - w / 2);
        y = Math.floor(MAP_H / 2 - h / 2);
      }

      const newRoom = {
        x,
        y,
        w,
        h,
        cx: x + Math.floor(w / 2),
        cy: y + Math.floor(h / 2),
      };

      // Carve room
      for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
          this.map[ry][rx] = 0;
        }
      }
      this.rooms.push(newRoom);

      if (i > 0) {
        const prev = this.rooms[i - 1];
        this.createCorridor(prev.cx, prev.cy, newRoom.cx, newRoom.cy);
      }
    }

    // Generate Walls/Props from map
    this.props = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (this.map[y][x] === 1) {
          this.props.push({
            x: x * TILE_SIZE,
            y: y * TILE_SIZE,
            w: TILE_SIZE,
            h: TILE_SIZE,
            type: 'wall',
            vx: 0,
            vy: 0,
            hp: 9999,
          });
        }
      }
    }

    // Setup Locations
    this.player.x = this.rooms[0].cx * TILE_SIZE;
    this.player.y = this.rooms[0].cy * TILE_SIZE;

    this.forge.x = this.rooms[1].cx * TILE_SIZE;
    this.forge.y = this.rooms[1].cy * TILE_SIZE;
    this.altar.x = this.rooms[2].cx * TILE_SIZE;
    this.altar.y = this.rooms[2].cy * TILE_SIZE;

    // Spawn Gates
    const sortedByY = [...this.rooms].sort((a, b) => a.y - b.y);
    const sortedByX = [...this.rooms].sort((a, b) => a.x - b.x);
    this.spawnGates = [
      { x: sortedByY[0].cx * TILE_SIZE, y: sortedByY[0].cy * TILE_SIZE }, // North
      {
        x: sortedByY[sortedByY.length - 1].cx * TILE_SIZE,
        y: sortedByY[sortedByY.length - 1].cy * TILE_SIZE,
      }, // South
      { x: sortedByX[0].cx * TILE_SIZE, y: sortedByX[0].cy * TILE_SIZE }, // West
      {
        x: sortedByX[sortedByX.length - 1].cx * TILE_SIZE,
        y: sortedByX[sortedByX.length - 1].cy * TILE_SIZE,
      }, // East
    ];

    // Decor
    this.decorations = [];
    this.rooms.forEach((r) => {
      this.decorations.push({
        x: r.cx * TILE_SIZE - 10,
        y: r.cy * TILE_SIZE - 10,
        w: 20,
        h: 20,
        type: 'carpet',
      });
      if (this.map[r.y - 1][r.cx] === 1)
        this.decorations.push({
          x: r.cx * TILE_SIZE + 16,
          y: r.y * TILE_SIZE,
          type: 'torch',
        });
      if (this.map[r.y - 1][r.cx + 1] === 1)
        this.decorations.push({
          x: (r.cx + 1) * TILE_SIZE + 16,
          y: r.y * TILE_SIZE,
          type: 'torch',
        });
    });
  }

  createCorridor(x1: number, y1: number, x2: number, y2: number) {
    let x = x1;
    while (x !== x2) {
      this.map[y1][x] = 0;
      x += x2 > x ? 1 : -1;
    }
    let y = y1;
    while (y !== y2) {
      this.map[y][x2] = 0;
      y += y2 > y ? 1 : -1;
    }
  }

  spawnRandomProp() {
    const r = this.rooms[Math.floor(Math.random() * this.rooms.length)];
    const px = (r.x + Math.random() * r.w) * TILE_SIZE;
    const py = (r.y + Math.random() * r.h) * TILE_SIZE;
    if (Math.hypot(px - this.player.x, py - this.player.y) > 100) {
      this.props.push({
        x: px,
        y: py,
        w: 24,
        h: 24,
        type: 'crate',
        active: true,
        hp: 20,
        vx: 0,
        vy: 0,
      });
    }
  }

  startWave(n: number) {
    this.wave.current = n;
    this.wave.killedInWave = 0;
    this.wave.nextTriggered = false;
    this.wave.timer = 0;
    const count = 8 + Math.floor(n * 3);
    this.wave.totalEnemies = count;

    let spawned = 0;
    const interval = setInterval(() => {
      if (spawned >= count || !this.active || this.paused || this.gameOver) {
        if (spawned >= count) clearInterval(interval);
        return;
      }
      this.spawnEnemy(this.wave.current);
      spawned++;
    }, 800);
  }

  spawnEnemy(level: number) {
    const gate =
      this.spawnGates[Math.floor(Math.random() * this.spawnGates.length)];
    const ex = gate.x + (Math.random() - 0.5) * 40;
    const ey = gate.y + (Math.random() - 0.5) * 40;

    const typeList = ['skeleton'];
    if (level > 1) typeList.push('zombie');
    if (level > 3) typeList.push('bat');
    if (level > 4) typeList.push('archer');
    if (level > 6) typeList.push('ghost');

    const type = typeList[Math.floor(Math.random() * typeList.length)];
    const hpMult = 1 + level * 0.15;

    const e: Enemy = {
      x: ex,
      y: ey,
      type,
      vx: 0,
      vy: 0,
      w: 14,
      h: 16,
      hp: 30 * hpMult,
      maxHp: 30 * hpMult,
      baseSpeed: 0,
    };

    if (type === 'bat') {
      e.hp = 15 * hpMult;
      e.baseSpeed = 2.6;
      e.w = 12;
      e.h = 10;
    } else if (type === 'zombie') {
      e.hp = 70 * hpMult;
      e.baseSpeed = 0.7;
      e.w = 16;
      e.h = 18;
    } else if (type === 'skeleton') {
      e.hp = 40 * hpMult;
      e.baseSpeed = 1.4;
    } else if (type === 'ghost') {
      e.hp = 50 * hpMult;
      e.baseSpeed = 0.6;
    } else if (type === 'archer') {
      e.hp = 35 * hpMult;
      e.baseSpeed = 1.1;
      e.range = 280;
      e.shootCd = 0;
    }

    e.maxHp = e.hp;
    e.timer = 0; // for bats
    this.enemies.push(e);
  }

  // --- CORE LOOP ---
  update() {
    if (!this.active || this.paused || this.gameOver || this.victory) {
      this.reportState(); // Keep reporting state for UI even if paused
      return;
    }

    // Respawn crates
    const crates = this.props.filter((p) => p.active && p.type === 'crate');
    if (crates.length < 30 && Math.random() < 0.02) this.spawnRandomProp();

    // Wave Logic
    const percent = Math.min(
      100,
      Math.floor((this.wave.killedInWave / this.wave.totalEnemies) * 100)
    );
    if (
      percent >= 85 &&
      !this.wave.nextTriggered &&
      this.wave.current < this.wave.max
    ) {
      this.wave.nextTriggered = true;
      this.wave.timer = 500; // frames
    }

    if (this.wave.nextTriggered) {
      this.wave.timer--;
      if (this.wave.timer <= 0) this.startWave(this.wave.current + 1);
    } else if (
      percent >= 100 &&
      this.wave.current === this.wave.max &&
      this.enemies.length === 0
    ) {
      this.victory = true;
      this.active = false;
    }

    // Player Movement
    let ax = 0,
      ay = 0;
    if (!this.player.isUlting) {
      if (this.keys[KEYS.UP]) ay = -1;
      if (this.keys[KEYS.DOWN]) ay = 1;
      if (this.keys[KEYS.LEFT]) ax = -1;
      if (this.keys[KEYS.RIGHT]) ax = 1;

      if (ax !== 0 || ay !== 0) {
        const l = Math.hypot(ax, ay);
        this.player.vx += (ax / l) * 0.6;
        this.player.vy += (ay / l) * 0.6;
      }
      this.player.vx *= 0.8;
      this.player.vy *= 0.8;
    } else {
      // Ulting
      this.player.vx = Math.cos(this.player.ultDir) * 14;
      this.player.vy = Math.sin(this.player.ultDir) * 14;
      this.createPart(this.player.x + 7, this.player.y + 9, '#e74c3c', 4);

      // Ult Damage Logic (Triangle)
      const backLen = 100;
      const backAngleL = this.player.ultDir + Math.PI - 0.6;
      const backAngleR = this.player.ultDir + Math.PI + 0.6;
      const p1 = { x: this.player.x + 7, y: this.player.y + 9 };
      const p2 = {
        x: p1.x + Math.cos(backAngleL) * backLen,
        y: p1.y + Math.sin(backAngleL) * backLen,
      };
      const p3 = {
        x: p1.x + Math.cos(backAngleR) * backLen,
        y: p1.y + Math.sin(backAngleR) * backLen,
      };

      this.enemies.forEach((e) => {
        if (this.pointInTriangle({ x: e.x + 7, y: e.y + 8 }, p1, p2, p3)) {
          this.damageEnemy(e, 5);
          this.createPart(e.x, e.y, '#e74c3c', 1);
        }
        if (this.checkCollide(this.player, e)) this.damageEnemy(e, 10);
      });

      this.props.forEach((p) => {
        if (
          p.active &&
          p.type === 'crate' &&
          this.pointInTriangle({ x: p.x + 10, y: p.y + 10 }, p1, p2, p3)
        ) {
          p.hp -= 5;
          if (p.hp <= 0) this.breakProp(p);
        }
      });

      this.player.ultTimer--;
      if (this.player.ultTimer <= 0) this.player.isUlting = false;
    }

    this.player.x += this.player.vx;
    this.player.y += this.player.vy;
    this.checkWallCollisions(this.player);

    // Camera
    this.camera.x = this.player.x + this.player.w / 2 - SCREEN_W / 2;
    this.camera.y = this.player.y + this.player.h / 2 - SCREEN_H / 2;
    this.mouse.x = this.mouse.screenX + this.camera.x;
    this.mouse.y = this.mouse.screenY + this.camera.y;

    // Fog & Mana
    this.updateFog(this.player.x + 7, this.player.y + 9, this.player.lightRadius);
    this.player.mana = Math.min(this.player.maxMana, this.player.mana + 0.15);

    // Interactions
    if (
      this.keys[KEYS.INTERACT_FORGE] &&
      Math.hypot(this.forge.x + 20 - this.player.x, this.forge.y + 15 - this.player.y) <
        60
    ) {
      this.openModal('forge');
    }
    if (
      this.keys[KEYS.INTERACT_ALTAR] &&
      this.altar.unlocked &&
      Math.hypot(this.altar.x + 15 - this.player.x, this.altar.y + 20 - this.player.y) <
        60
    ) {
      this.openModal('altar');
    }
    if (this.player.kills >= 10) this.altar.unlocked = true;

    this.updateSwing();
    this.updateEntities();
    this.reportState();
  }

  reportState() {
    this.onUiUpdate({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      mana: this.player.mana,
      maxMana: this.player.maxMana,
      gold: this.player.gold,
      blood: this.player.blood,
      kills: this.player.kills,
      wave: this.wave.current,
      maxWave: this.wave.max,
      waveProgress: Math.min(
        100,
        Math.floor((this.wave.killedInWave / this.wave.totalEnemies) * 100)
      ),
      waveTimer: this.wave.nextTriggered ? Math.ceil(this.wave.timer / 60) : null,
      swordLevel: this.player.swordLevel,
      hasMagnet: this.player.hasMagnet,
      hasMinimap: this.player.hasMinimap,
      canPause: this.player.canPause,
      forgeUnlocked: true,
      altarUnlocked: this.altar.unlocked,
      isPaused: this.paused,
      gameOver: this.gameOver,
      victory: this.victory,
      activeModal: this.modalState,
    });
  }

  updateFog(x: number, y: number, r: number) {
    this.fogCtx.globalCompositeOperation = 'destination-out';
    this.fogCtx.beginPath();
    this.fogCtx.arc(x, y, r, 0, Math.PI * 2);
    this.fogCtx.fill();
    this.fogCtx.globalCompositeOperation = 'source-over';
  }

  checkWallCollisions(ent: Entity) {
    const cx = Math.floor((ent.x + ent.w / 2) / TILE_SIZE);
    const cy = Math.floor((ent.y + ent.h / 2) / TILE_SIZE);

    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
          if (this.map[y][x] === 1 && ent.type !== 'ghost') {
            const wall = {
              x: x * TILE_SIZE,
              y: y * TILE_SIZE,
              w: TILE_SIZE,
              h: TILE_SIZE,
            };
            this.resolveCollision(ent, wall);
          }
        }
      }
    }
    this.props.forEach((p) => {
      if (p.active && p.type === 'crate' && this.checkCollide(ent, p)) {
        this.resolveCollision(ent, p);
      }
    });
  }

  resolveCollision(ent: Entity, wall: { x: number; y: number; w: number; h: number }) {
    if (this.checkCollide(ent, wall)) {
      const dx = ent.x + ent.w / 2 - (wall.x + wall.w / 2);
      const dy = ent.y + ent.h / 2 - (wall.y + wall.h / 2);
      if (Math.abs(dx) > Math.abs(dy)) {
        ent.x = dx > 0 ? wall.x + wall.w : wall.x - ent.w;
      } else {
        ent.y = dy > 0 ? wall.y + wall.h : wall.y - ent.h;
      }
    }
  }

  updateEntities() {
    // Enemies
    this.enemies.forEach((e) => {
      const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
      const isSeen = dist < this.player.lightRadius + 50;
      const speedFactor = !isSeen || dist > 500 ? 0.5 : 1.0;
      const currentSpeed = e.baseSpeed * speedFactor;

      if (dist < 1000) {
        let move = true;
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);

        if (e.type === 'archer') {
          if (dist < 120 && isSeen) {
            e.vx = -Math.cos(angle) * currentSpeed;
            e.vy = -Math.sin(angle) * currentSpeed;
          } else if (dist > e.range! || !isSeen) {
            e.vx = Math.cos(angle) * currentSpeed;
            e.vy = Math.sin(angle) * currentSpeed;
          } else {
            move = false;
            e.vx = 0;
            e.vy = 0;
            e.shootCd = (e.shootCd || 0) + 1;
            if (e.shootCd > 90) {
              this.projectiles.push({
                x: e.x + 7,
                y: e.y + 8,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                hostile: true,
                life: 60,
                type: 'arrow',
              });
              e.shootCd = 0;
            }
          }
        } else {
          e.vx = Math.cos(angle) * currentSpeed;
          e.vy = Math.sin(angle) * currentSpeed;
          if (e.type === 'bat') {
            e.timer = (e.timer || 0) + 0.2;
            e.vx += Math.sin(e.timer);
            e.vy += Math.cos(e.timer);
          }
        }

        if (move) {
          e.x += e.vx;
          e.y += e.vy;
          if (e.type !== 'ghost' && e.type !== 'bat')
            this.checkWallCollisions(e);
        }
      }

      if (this.checkCollide(e, this.player)) {
        this.player.hp -= 0.5;
        if (this.player.hp <= 0) {
            this.player.hp = 0;
            this.gameOver = true;
            this.active = false;
        }
      }
    });

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.type === 'fireball') {
        p.life--;
        const age = 80 - p.life;
        p.x += p.vx + -p.vy * 0.5 * Math.cos(age * 0.3) * 0.1;
        p.y += p.vy + p.vx * 0.5 * Math.cos(age * 0.3) * 0.1;
        this.createPart(p.x + 4, p.y + 4, '#e67e22', 1);
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      }

      let hit = false;
      const pRect = {
        x: p.x,
        y: p.y,
        w: p.type === 'fireball' ? 12 : 4,
        h: p.type === 'fireball' ? 12 : 4,
      };

      const tx = Math.floor(p.x / TILE_SIZE);
      const ty = Math.floor(p.y / TILE_SIZE);
      if (
        tx >= 0 &&
        tx < MAP_W &&
        ty >= 0 &&
        ty < MAP_H &&
        this.map[ty][tx] === 1
      )
        hit = true;

      this.props.forEach((pr) => {
        if (pr.active && pr.type === 'crate' && this.checkCollide(pRect, pr)) {
          hit = true;
          pr.hp -= 10;
          if (pr.hp <= 0) this.breakProp(pr);
        }
      });

      if (p.hostile && this.checkCollide(pRect, this.player)) {
        this.player.hp -= 10;
        if (this.player.hp <= 0) {
             this.player.hp = 0;
             this.gameOver = true;
             this.active = false;
        }
        hit = true;
      } else if (!p.hostile) {
        this.enemies.forEach((e) => {
          if (this.checkCollide(pRect, e)) {
            this.damageEnemy(e, p.type === 'fireball' ? 40 : 20);
            hit = true;
          }
        });
      }
      if (p.life <= 0 || hit) this.projectiles.splice(i, 1);
    }

    // Items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (
        this.player.hasMagnet &&
        Math.hypot(this.player.x - it.x, this.player.y - it.y) < 150
      ) {
        it.x += (this.player.x - it.x) * 0.1;
        it.y += (this.player.y - it.y) * 0.1;
      }
      if (this.checkCollide(this.player, { x: it.x, y: it.y, w: 8, h: 8 })) {
        if (it.type === 'food')
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
        else if (it.type === 'blood') this.player.blood += 1;
        else this.player.gold += it.val;
        this.items.splice(i, 1);
      }
    }

    // Dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].hp <= 0) {
        this.player.kills++;
        this.wave.killedInWave++;
        this.createPart(this.enemies[i].x, this.enemies[i].y, '#c0392b', 8);

        this.items.push({
          x: this.enemies[i].x,
          y: this.enemies[i].y,
          type: 'gold',
          val: 10,
        });
        if (Math.random() < 0.2)
          this.items.push({
            x: this.enemies[i].x + 5,
            y: this.enemies[i].y + 5,
            type: 'blood',
            val: 1,
          });

        this.enemies.splice(i, 1);
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.ctx.save();
    this.ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

    const cx = Math.floor(this.camera.x / TILE_SIZE);
    const cy = Math.floor(this.camera.y / TILE_SIZE);
    const cw = Math.ceil(SCREEN_W / TILE_SIZE) + 1;
    const ch = Math.ceil(SCREEN_H / TILE_SIZE) + 1;

    for (let y = cy; y < cy + ch; y++) {
      for (let x = cx; x < cx + cw; x++) {
        if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
          if (this.map[y][x] === 1) {
            this.ctx.fillStyle = '#34495e';
            this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.fillRect(
              x * TILE_SIZE + 2,
              y * TILE_SIZE + 2,
              TILE_SIZE - 4,
              TILE_SIZE - 4
            );
          } else {
            this.ctx.fillStyle = '#151515';
            this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            this.ctx.strokeStyle = '#222';
            this.ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    this.decorations.forEach((d) => {
      if (d.type === 'carpet') {
        this.ctx.fillStyle = '#7f0000';
        this.ctx.fillRect(d.x, d.y, d.w, d.h);
        this.ctx.strokeStyle = '#c0392b';
        this.ctx.strokeRect(d.x, d.y, d.w, d.h);
      } else if (d.type === 'torch') {
        this.ctx.fillStyle = '#8e44ad';
        this.ctx.fillRect(d.x, d.y, 4, 10);
        this.ctx.fillStyle = Math.random() > 0.5 ? '#f1c40f' : '#e67e22';
        this.ctx.fillRect(d.x - 1, d.y - 4, 6, 6);
      }
    });

    this.props.forEach((p) => {
      if (!p.active || p.type === 'wall') return;
      if (p.type === 'crate') {
        this.ctx.fillStyle = '#5d4037';
        this.ctx.fillRect(p.x, p.y, p.w, p.h);
        this.ctx.fillStyle = '#8d6e63';
        this.ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
      }
    });

    this.ctx.fillStyle = '#7f8c8d';
    this.ctx.fillRect(this.forge.x, this.forge.y + 15, 40, 15);
    this.ctx.fillStyle = '#bdc3c7';
    this.ctx.fillRect(this.forge.x + 10, this.forge.y + 5, 20, 10);
    this.ctx.fillStyle = '#e67e22';
    this.ctx.fillRect(this.forge.x + 12, this.forge.y + 6, 16, 8);

    if (this.altar.unlocked) {
      this.ctx.fillStyle = '#4a0000';
      this.ctx.fillRect(this.altar.x, this.altar.y + 20, 30, 20);
      this.ctx.fillStyle = '#7f0000';
      this.ctx.fillRect(this.altar.x + 5, this.altar.y + 10, 20, 10);
      this.ctx.fillStyle = '#ff0000';
      this.ctx.fillRect(this.altar.x + 10, this.altar.y, 10, 10);
    }

    this.items.forEach((i) => {
      if (i.type === 'blood') {
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(i.x + 4, i.y + 4, 3, 0, 6.28);
        this.ctx.fill();
      } else if (i.type === 'gold') {
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.fillRect(i.x, i.y + 2, 6, 4);
      } else if (i.type === 'food') {
        this.ctx.fillStyle = '#d35400';
        this.ctx.fillRect(i.x, i.y, 8, 6);
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fillRect(i.x + 2, i.y - 2, 2, 2);
      }
    });

    this.enemies.forEach((e) => {
      if (
        Math.abs(e.x - this.player.x) < SCREEN_W &&
        Math.abs(e.y - this.player.y) < SCREEN_H
      )
        this.drawEnemySprite(e);
    });

    if (this.player.isUlting) {
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#e74c3c';
      this.ctx.fillStyle = '#f1c40f';
      this.ctx.fillRect(this.player.x - 2, this.player.y - 2, 18, 22);
      this.ctx.shadowBlur = 0;
    }
    this.ctx.fillStyle = '#95a5a6';
    this.ctx.fillRect(this.player.x, this.player.y, 14, 18);
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(this.player.x + 4, this.player.y + 4, 6, 2);
    this.ctx.fillStyle = '#7f8c8d';
    this.ctx.fillRect(this.player.x + 2, this.player.y + 8, 10, 8);
    if (this.player.swordLevel === 3) {
      this.ctx.fillStyle = '#e74c3c';
      this.ctx.fillRect(this.player.x + 6, this.player.y + 10, 2, 2);
    }

    if (this.player.swinging) {
      this.ctx.save();
      this.ctx.translate(this.player.x + 7, this.player.y + 9);
      this.ctx.rotate(this.player.swingAngle);
      const len = 20 + this.player.swordLevel * 5;
      const col = SWORD_COLORS[this.player.swordLevel];
      this.ctx.fillStyle = '#5d4037';
      this.ctx.fillRect(0, -4, 4, 8);
      this.ctx.fillStyle = '#7f8c8d';
      this.ctx.fillRect(4, -6, 4, 12);
      this.ctx.fillStyle = col;
      this.ctx.fillRect(8, -2, len, 4);
      this.ctx.restore();
    }

    this.projectiles.forEach((p) => {
      if (p.type === 'fireball') {
        this.ctx.fillStyle = '#e67e22';
        this.ctx.fillRect(p.x - 2, p.y - 4, 12, 12);
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.fillRect(p.x, p.y - 2, 8, 8);
      } else {
        this.ctx.fillStyle = p.hostile ? '#fff' : '#f1c40f';
        this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    });

    this.particles.forEach((p) => {
      this.ctx.fillStyle = p.c;
      this.ctx.fillRect(p.x, p.y, 2, 2);
    });

    this.ctx.restore();
    this.ctx.drawImage(
      this.fogCanvas,
      this.camera.x,
      this.camera.y,
      SCREEN_W,
      SCREEN_H,
      0,
      0,
      SCREEN_W,
      SCREEN_H
    );
    
    if (this.player.hasMinimap) this.drawMinimap();
  }

  drawMinimap() {
      let size = 150, mx = 10, my = SCREEN_H - size - 10;
      this.ctx.fillStyle = 'rgba(0,0,0,0.8)'; this.ctx.fillRect(mx, my, size, size);
      this.ctx.strokeStyle = '#fff'; this.ctx.strokeRect(mx, my, size, size);
      let sc = size / WORLD_W;
      this.ctx.fillStyle = '#3498db'; this.ctx.fillRect(mx+this.player.x*sc, my+this.player.y*sc, 3, 3);
      this.ctx.fillStyle = '#e74c3c'; this.enemies.forEach(e => this.ctx.fillRect(mx+e.x*sc, my+e.y*sc, 2, 2));
      this.ctx.fillStyle = '#7f8c8d'; this.ctx.fillRect(mx+this.forge.x*sc, my+this.forge.y*sc, 4, 4);
      if(this.altar.unlocked) { this.ctx.fillStyle='#ff0000'; this.ctx.fillRect(mx+this.altar.x*sc, my+this.altar.y*sc, 4, 4); }
  }

  drawEnemySprite(e: Enemy) {
    const x = e.x,
      y = e.y;
    if (e.type === 'skeleton') {
      this.ctx.fillStyle = '#ecf0f1';
      this.ctx.fillRect(x + 4, y, 6, 6);
      this.ctx.fillStyle = '#bdc3c7';
      this.ctx.fillRect(x + 6, y + 6, 2, 8);
      this.ctx.fillRect(x + 3, y + 8, 8, 1);
    } else if (e.type === 'zombie') {
      this.ctx.fillStyle = '#586e48';
      this.ctx.fillRect(x, y, 16, 18);
      this.ctx.fillStyle = '#3e2723';
      this.ctx.fillRect(x + 2, y + 6, 12, 10);
    } else if (e.type === 'bat') {
      this.ctx.fillStyle = '#5e35b1';
      this.ctx.fillRect(x, y, 4, 4);
      this.ctx.fillRect(x + 8, y, 4, 4);
      this.ctx.fillStyle = '#8e44ad';
      this.ctx.fillRect(x + 4, y + 3, 4, 4);
    } else if (e.type === 'ghost') {
      this.ctx.globalAlpha = 0.6;
      this.ctx.fillStyle = '#b2ebf2';
      this.ctx.fillRect(x + 2, y, 10, 12);
      this.ctx.globalAlpha = 1;
    } else if (e.type === 'archer') {
      this.ctx.fillStyle = '#ecf0f1';
      this.ctx.fillRect(x + 4, y, 6, 6);
      this.ctx.fillStyle = '#bdc3c7';
      this.ctx.fillRect(x + 6, y + 6, 2, 8);
      this.ctx.fillStyle = '#8d6e63';
      this.ctx.fillRect(x + 12, y + 4, 2, 10);
    }

    if (e.hp! < e.maxHp!) {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(x, y - 4, 14, 2);
      this.ctx.fillStyle = '#e74c3c';
      this.ctx.fillRect(x, y - 4, 14 * (e.hp! / e.maxHp!), 2);
    }
  }

  // --- HELPERS ---
  damageEnemy(e: Enemy, amt: number) {
    e.hp! -= amt;
    this.createPart(e.x, e.y, '#fff', 2);
  }

  breakProp(p: Prop) {
    p.active = false;
    this.createPart(p.x, p.y, '#8d6e63', 6);
    if (Math.random() > 0.5) {
      this.items.push({
        x: p.x + 5,
        y: p.y + 5,
        type: Math.random() > 0.7 ? 'food' : 'gold',
        val: 10,
      });
    }
  }

  checkCollide(r1: any, r2: any) {
    return (
      r1.x < r2.x + (r2.w || r2.width || 0) &&
      r1.x + (r1.w || r1.width || 0) > r2.x &&
      r1.y < r2.y + (r2.h || r2.height || 0) &&
      r1.y + (r1.h || r1.height || 0) > r2.y
    );
  }

  pointInTriangle(p: Vector, p0: Vector, p1: Vector, p2: Vector) {
    const s =
      p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * p.x + (p0.x - p2.x) * p.y;
    const t =
      p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * p.x + (p1.x - p0.x) * p.y;
    const A =
      -p1.y * p2.x + p0.y * (p2.x - p1.x) + p0.x * (p1.y - p2.y) + p1.x * p2.y;
    return A < 0
      ? s <= 0 && s + t >= A
      : s >= 0 && s + t <= A;
  }

  createPart(x: number, y: number, c: string, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 15,
        c: c,
      });
    }
  }

  // Combat actions
  startSwing() {
    if (this.player.swinging || this.player.isUlting) return;
    this.player.swinging = true;
    this.player.swingProgress = 0;
    this.player.hitList = [];
    this.player.swingBaseAngle = Math.atan2(
      this.mouse.y - (this.player.y + 9),
      this.mouse.x - (this.player.x + 7)
    );
  }

  updateSwing() {
    if (!this.player.swinging) return;
    this.player.swingProgress += 0.12;
    const current =
      this.player.swingBaseAngle - 1.1 + 2.2 * Math.min(1, this.player.swingProgress);
    this.player.swingAngle = current;
    const len = 28 + this.player.swordLevel * 8;
    const tipX = this.player.x + 7 + Math.cos(current) * len;
    const tipY = this.player.y + 9 + Math.sin(current) * len;
    const hitBox = { x: tipX - 8, y: tipY - 8, w: 16, h: 16 };

    this.enemies.forEach((e) => {
      if (!this.player.hitList.includes(e) && this.checkCollide(hitBox, e)) {
        this.damageEnemy(e, this.player.baseDmg + this.player.swordLevel * 15);
        e.x += Math.cos(current) * 15;
        e.y += Math.sin(current) * 15;
        this.player.hitList.push(e);
      }
    });
    this.props.forEach((p) => {
      if (p.active && p.type === 'crate' && this.checkCollide(hitBox, p)) {
        p.hp -= 15;
        this.createPart(p.x, p.y, '#ddd', 2);
        if (p.hp <= 0) this.breakProp(p);
      }
    });
    if (this.player.swingProgress >= 1) this.player.swinging = false;
  }

  fireFireball() {
    if (this.player.mana < 25) return;
    this.player.mana -= 25;
    const a = Math.atan2(
      this.mouse.y - (this.player.y + 9),
      this.mouse.x - (this.player.x + 7)
    );
    this.projectiles.push({
      x: this.player.x + 7,
      y: this.player.y + 9,
      vx: Math.cos(a) * 4,
      vy: Math.sin(a) * 4,
      hostile: false,
      life: 80,
      type: 'fireball',
    });
  }

  triggerUltimate() {
    if (this.player.mana < 50 || this.player.isUlting) return;
    this.player.mana -= 50;
    this.player.isUlting = true;
    this.player.ultTimer = 30;
    this.player.ultDir = Math.atan2(
      this.mouse.y - this.player.y,
      this.mouse.x - this.player.x
    );
  }

  // Modal Actions
  openModal(type: 'forge' | 'altar') {
    this.paused = true;
    this.modalState = type;
  }
  
  closeModal() {
    this.paused = false;
    this.modalState = 'none';
  }

  upgradeSword() {
    const cost = FORGE_COSTS[this.player.swordLevel];
    if (cost && this.player.gold >= cost) {
      this.player.gold -= cost;
      this.player.swordLevel++;
      this.closeModal();
      this.openModal('forge'); // Re-open to show new status
    }
  }

  buyAltar(upg: 'magnet' | 'minimap' | 'pause') {
    if (upg === 'magnet' && this.player.blood >= 15) {
      this.player.blood -= 15;
      this.player.hasMagnet = true;
    }
    if (upg === 'minimap' && this.player.blood >= 25) {
      this.player.blood -= 25;
      this.player.hasMinimap = true;
    }
    if (upg === 'pause' && this.player.blood >= 10) {
      this.player.blood -= 10;
      this.player.canPause = true;
    }
    this.closeModal();
    this.openModal('altar');
  }
  
  togglePause() {
      if (!this.active) return;
      this.paused = !this.paused;
  }

  reset() {
      // Clean hard reload
      window.location.reload();
  }
}