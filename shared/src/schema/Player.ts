import { Schema, type } from '@colyseus/schema';
import { PLAYER_SPEED } from '../constants';

export class Player extends Schema {
  @type('string')
  id: string = '';

  @type('number')
  x: number = 0;

  @type('number')
  y: number = 0;

  @type('number')
  hp: number = 100;

  @type('number')
  rotation: number = 0;

  @type('number')
  xp: number = 0;

  @type('number')
  level: number = 1;

  @type('number')
  gold: number = 0;

  @type('number')
  speed: number = PLAYER_SPEED;
}
