import { Schema, type } from '@colyseus/schema';

export class Bullet extends Schema {
  @type('string')
  id: string = '';

  @type('number')
  x: number = 0;

  @type('number')
  y: number = 0;

  @type('number')
  vx: number = 0;

  @type('number')
  vy: number = 0;

  @type('number')
  life: number = 1;

  @type('string')
  ownerId: string = '';
}
