import { Room, Client } from 'colyseus';
import {
  WorldState,
  Player,
  Bullet,
  Input,
  PLAYER_SPEED,
  TICK_RATE,
  GoldCoin,
} from '../../../shared/src';
import { EnemySpawner, Enemy } from '../systems/EnemySpawner';

export class WorldRoom extends Room<WorldState> {
  private inputBuffer: Record<string, Input[]> = {};
  private bulletCounter = 0;
  private coinCounter = 0;
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
    player.speed = PLAYER_SPEED;
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
          player.x -= player.speed * dt;
        }
        if (input & Input.RIGHT) {
          player.x += player.speed * dt;
        }
        if (input & Input.UP) {
          player.y -= player.speed * dt;
        }
        if (input & Input.DOWN) {
          player.y += player.speed * dt;
        }
        if (input & Input.SHOOT) {
          const bullet = new Bullet();
          bullet.id = `${this.bulletCounter++}`;
          bullet.x = player.x;
          bullet.y = player.y;
          bullet.vy = -600;
          bullet.vx = 0;
          bullet.life = 1;
          bullet.ownerId = player.id;
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
    const killed: { enemy: Enemy; ownerId: string }[] = [];
    this.state.bullets.forEach((bullet, id) => {
      this.enemySpawner.enemies.forEach((enemy) => {
        if (this.checkCollision(bullet.x, bullet.y, 5, 5, enemy.x, enemy.y, 20, 20)) {
          enemy.hp -= 10;
          this.state.bullets.delete(id);
          if (enemy.hp <= 0) {
            killed.push({ enemy, ownerId: bullet.ownerId });
          }
        }
      });
    });

    // reward kills and drop loot
    killed.forEach(({ enemy, ownerId }) => {
      const player = this.state.players.get(ownerId);
      if (player) {
        player.xp += 10;
        while (player.xp >= 100) {
          player.xp -= 100;
          player.level += 1;
          player.speed *= 1.05;
        }
      }
      if (Math.random() < 0.2) {
        const coin = new GoldCoin();
        coin.id = `${this.coinCounter++}`;
        coin.x = enemy.x;
        coin.y = enemy.y;
        this.state.coins.set(coin.id, coin);
      }
    });

    // remove dead enemies and broadcast
    this.enemySpawner.enemies = this.enemySpawner.enemies.filter((enemy) => enemy.hp > 0);
    killed.forEach(({ enemy }) => {
      this.broadcast('enemyDied', { id: enemy.id });
    });

    // enemy vs player collisions
    this.enemySpawner.enemies.forEach((enemy) => {
      this.state.players.forEach((player) => {
        if (this.checkCollision(player.x, player.y, 20, 20, enemy.x, enemy.y, 20, 20)) {
          player.hp -= 10;
        }
      });
    });

    // coin pickups
    this.state.coins.forEach((coin, id) => {
      this.state.players.forEach((player) => {
        if (this.checkCollision(player.x, player.y, 20, 20, coin.x, coin.y, 10, 10)) {
          player.gold += 1;
          this.state.coins.delete(id);
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
