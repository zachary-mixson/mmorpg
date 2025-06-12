import { Schema, type, MapSchema } from '@colyseus/schema';
import { Player } from './Player';

export class WorldState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();
}
