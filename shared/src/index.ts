export { Input } from './Input';
export { TICK_RATE, WORLD_SIZE, PLAYER_SPEED } from './constants';
export { Player } from './schema/Player';
export { WorldState } from './schema/WorldState';
export { Bullet } from './schema/Bullet';

export interface PlayerState {
  x: number;
  y: number;
}
