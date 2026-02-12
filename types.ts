export interface Coordinate {
  x: number;
  y: number;
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum SpeedLevel {
  SLOW = 250,   // Was 180, made slower
  MEDIUM = 180, // Was 150, made slower
  HARD = 80,    // Adjusted slightly
}