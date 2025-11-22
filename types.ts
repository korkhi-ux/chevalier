export interface Vector {
  x: number;
  y: number;
}

export interface Rect extends Vector {
  w: number;
  h: number;
}

export interface Entity extends Rect {
  vx: number;
  vy: number;
  type: string;
  active?: boolean;
  hp?: number;
  maxHp?: number;
  life?: number; // For particles/projectiles
  color?: string;
  hostile?: boolean; // For projectiles
  val?: number; // For items
}

export interface Enemy extends Entity {
  baseSpeed: number;
  range?: number; // Archer
  shootCd?: number; // Archer
  timer?: number; // Bat oscillation
}

export interface Player extends Entity {
  speed: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  gold: number;
  blood: number;
  kills: number;
  swordLevel: number;
  baseDmg: number;
  lightRadius: number;
  // Combat
  swinging: boolean;
  swingAngle: number;
  swingBaseAngle: number;
  swingProgress: number;
  hitList: Enemy[];
  // Ult
  isUlting: boolean;
  ultTimer: number;
  ultDir: number;
  // Upgrades
  hasMagnet: boolean;
  hasMinimap: boolean;
  canPause: boolean;
}

export interface GameStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  gold: number;
  blood: number;
  kills: number;
  wave: number;
  maxWave: number;
  waveProgress: number;
  waveTimer: number | null; // null if not counting down
  swordLevel: number;
  hasMagnet: boolean;
  hasMinimap: boolean;
  canPause: boolean;
  forgeUnlocked: boolean; // Actually based on distance
  altarUnlocked: boolean;
  isPaused: boolean;
  gameOver: boolean;
  victory: boolean;
  activeModal: 'none' | 'forge' | 'altar';
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface Prop extends Entity {
  hp: number;
}
