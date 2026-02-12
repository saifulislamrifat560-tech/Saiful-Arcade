export const GRID_SIZE = 20;
export const CELL_SIZE_PX = 20; // Only used for calculation if needed, grid is responsive
export const INITIAL_SNAKE = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];
export const INITIAL_DIRECTION = { x: 0, y: -1 }; // Moving Up
export const LEVEL_UP_SCORE_THRESHOLD = 5;
export const SPEED_DECREMENT_PER_LEVEL = 5; // ms faster per level
export const MIN_SPEED_MS = 40; // Cap max speed