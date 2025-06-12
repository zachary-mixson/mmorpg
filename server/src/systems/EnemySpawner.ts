import { Player } from '../../../shared/src';

export interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
}

export class EnemySpawner {
  private lastSpawn = 0;
  private idCounter = 0;
  public enemies: Enemy[] = [];

  update(dt: number, players: Map<string, Player>) {
    this.lastSpawn += dt;
    if (this.lastSpawn >= 10) {
      this.lastSpawn = 0;
      this.spawn();
    }

    this.enemies.forEach((enemy) => {
      if (players.size === 0) return;
      let nearest: Player | undefined;
      let nearestDist = Infinity;
      players.forEach((p) => {
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      });
      if (!nearest) return;
      const dx = nearest.x - enemy.x;
      const dy = nearest.y - enemy.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        enemy.x += (dx / len) * 80 * dt;
        enemy.y += (dy / len) * 80 * dt;
      }
    });
  }

  private spawn() {
    const enemy: Enemy = {
      id: `${this.idCounter++}`,
      x: Math.random() * 800,
      y: Math.random() * 600,
      hp: 30,
    };
    this.enemies.push(enemy);
  }
}
