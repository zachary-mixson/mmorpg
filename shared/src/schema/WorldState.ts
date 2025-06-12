import { Schema, type, MapSchema } from '@colyseus/schema';
import { Player } from './Player';
import { Bullet } from './Bullet';
import { GoldCoin } from './GoldCoin';

export class WorldState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  @type({ map: Bullet })
  bullets = new MapSchema<Bullet>();

  @type({ map: GoldCoin })
  coins = new MapSchema<GoldCoin>();
}
