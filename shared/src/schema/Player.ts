import { Schema, type } from '@colyseus/schema';

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
}
