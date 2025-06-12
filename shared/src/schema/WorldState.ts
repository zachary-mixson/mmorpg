import { Schema, type, MapSchema } from '@colyseus/schema';
import { Player } from './Player';
import { Bullet } from './Bullet';

export class WorldState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  @type({ map: Bullet })
  bullets = new MapSchema<Bullet>();
}
