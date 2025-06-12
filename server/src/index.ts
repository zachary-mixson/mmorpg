import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import { Room, Client } from 'colyseus';
import { PlayerState } from '../shared/src';

class MyRoom extends Room<PlayerState> {
  onCreate() {
    this.setState({ x: 0, y: 0 });
  }

  onJoin(client: Client) {
    console.log('Client joined', client.sessionId);
  }

  onLeave(client: Client) {
    console.log('Client left', client.sessionId);
  }
}

const app = express();
const gameServer = new Server({ server: createServer(app) });

gameServer.define('room', MyRoom);

gameServer.listen(2567);
console.log('Colyseus listening on ws://localhost:2567');
