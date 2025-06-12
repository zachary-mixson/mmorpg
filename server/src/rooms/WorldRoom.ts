import { Room, Client } from 'colyseus';
import {
  WorldState,
  Player,
  Input,
  PLAYER_SPEED,
  TICK_RATE,
} from '../../../shared/src';

export class WorldRoom extends Room<WorldState> {
  private inputBuffer: Record<string, Input[]> = {};

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
      }
    });
  }
}
