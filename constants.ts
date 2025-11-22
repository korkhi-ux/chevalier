export const TILE_SIZE = 40;
export const MAP_W = 50;
export const MAP_H = 50;
export const WORLD_W = MAP_W * TILE_SIZE;
export const WORLD_H = MAP_H * TILE_SIZE;
export const SCREEN_W = 800;
export const SCREEN_H = 600;

export const SWORD_COLORS = ['#95a5a6', '#3498db', '#2ecc71', '#e74c3c'];
export const FORGE_COSTS = [80, 250, 600];

// Key mappings
export const KEYS = {
  UP: 'z',
  DOWN: 's',
  LEFT: 'q',
  RIGHT: 'f', // As per original spec
  INTERACT_FORGE: 'e',
  INTERACT_ALTAR: 'r',
  PAUSE: 'p',
  ULTIMATE: ' ', // Space
};
