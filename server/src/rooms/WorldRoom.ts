import { Room, Client } from 'colyseus';
import {
  WorldState,
  Player,
  Bullet,
  Input,
  PLAYER_SPEED,
  TICK_RATE,
} from '../../../shared/src';
import { EnemySpawner, Enemy } from '../systems/EnemySpawner';

export class WorldRoom extends Room<WorldState> {
  private inputBuffer: Record<string, Input[]> = {};
  private bulletCounter = 0;
  private enemySpawner = new EnemySpawner();

  onCreate() {
    this.setState(new WorldState());
    this.setSimulationInterval(() => this.update(), 1000 / TICK_RATE);

    this.onMessage('input', (client, message: Input) => {
      if (!this.inputBuffer[client.sessionId]) {
        this.inputBuffer[client.sessionId] = [];
      }
      this.inputBuffer[client.sessionId].push(message);
    });
  }

  onJoin(client: Client) {
    const player = new Player();
    player.id = client.sessionId;
    this.state.players.set(client.sessionId, player);
    this.inputBuffer[client.sessionId] = [];
    this.broadcast('playerJoined', { id: player.id });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    delete this.inputBuffer[client.sessionId];
    this.broadcast('playerLeft', { id: client.sessionId });
  }

  private update() {
    const dt = 1 / TICK_RATE;
    this.state.players.forEach((player, id) => {
      const buffer = this.inputBuffer[id];
      if (!buffer) return;
      while (buffer.length > 0) {
        const input = buffer.shift()!;
        if (input & Input.LEFT) {
          player.x -= PLAYER_SPEED * dt;
        }
        if (input & Input.RIGHT) {
          player.x += PLAYER_SPEED * dt;
        }
        if (input & Input.UP) {
          player.y -= PLAYER_SPEED * dt;
        }
        if (input & Input.DOWN) {
          player.y += PLAYER_SPEED * dt;
        }
        if (input & Input.SHOOT) {
          const bullet = new Bullet();
          bullet.id = `${this.bulletCounter++}`;
          bullet.x = player.x;
          bullet.y = player.y;
          bullet.vy = -600;
          bullet.vx = 0;
          bullet.life = 1;
          this.state.bullets.set(bullet.id, bullet);
        }
      }
    });

    // update bullets
    this.state.bullets.forEach((bullet, id) => {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0) {
        this.state.bullets.delete(id);
      }
    });

    // update enemies
    this.enemySpawner.update(dt, this.state.players);

    // handle collisions bullet vs enemy
    this.state.bullets.forEach((bullet, id) => {
      this.enemySpawner.enemies.forEach((enemy) => {
        if (this.checkCollision(bullet.x, bullet.y, 5, 5, enemy.x, enemy.y, 20, 20)) {
          enemy.hp -= 10;
          this.state.bullets.delete(id);
        }
      });
    });

    // remove dead enemies and broadcast
    this.enemySpawner.enemies = this.enemySpawner.enemies.filter((enemy) => {
      if (enemy.hp <= 0) {
        this.broadcast('enemyDied', { id: enemy.id });
        return false;
      }
      return true;
    });

    // enemy vs player collisions
    this.enemySpawner.enemies.forEach((enemy) => {
      this.state.players.forEach((player) => {
        if (this.checkCollision(player.x, player.y, 20, 20, enemy.x, enemy.y, 20, 20)) {
          player.hp -= 10;
        }
      });
    });

    // remove dead players
    this.state.players.forEach((player, id) => {
      if (player.hp <= 0) {
        this.state.players.delete(id);
        this.broadcast('playerDied', { id });
        delete this.inputBuffer[id];
      }
    });
  }

  private checkCollision(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number
  ) {
    return (
      Math.abs(x1 - x2) * 2 < w1 + w2 && Math.abs(y1 - y2) * 2 < h1 + h2
    );
  }
}
