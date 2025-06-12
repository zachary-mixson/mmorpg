import express from 'express';
import { createServer } from 'http';
import { Server } from 'colyseus';
import { WorldRoom } from './rooms/WorldRoom';

const app = express();
const gameServer = new Server({ server: createServer(app) });

gameServer.define('world', WorldRoom);

gameServer.listen(2567);
console.log('Colyseus listening on ws://localhost:2567');
