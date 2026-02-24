import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;

interface Player {
  id: string;
  name: string;
  cards: number[];
  ws: WebSocket;
}

interface GameRoom {
  id: string;
  players: Player[];
  playedCards: number[];
  status: 'waiting' | 'playing' | 'finished';
  lastPlayedCard: number | null;
  missedCards: number[];
}

const rooms: Map<string, GameRoom> = new Map();

wss.on('connection', (ws) => {
  const playerId = uuidv4();
  let currentRoomId: string | null = null;

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'JOIN_ROOM': {
        const { roomId, playerName, avatar } = message.payload;
        currentRoomId = roomId;
        
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            players: [],
            playedCards: [],
            status: 'waiting',
            lastPlayedCard: null,
            missedCards: []
          });
        }

        const room = rooms.get(roomId)!;
        if (room.status !== 'waiting') {
          ws.send(JSON.stringify({ type: 'ERROR', payload: 'Game already in progress' }));
          return;
        }

        const player: Player & { avatar?: string } = { id: playerId, name: playerName, avatar, cards: [], ws };
        room.players.push(player);

        broadcastRoomState(room);
        break;
      }

      case 'START_GAME': {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room || room.players.length < 1) return;

        // Initialize deck
        const deck = Array.from({ length: 100 }, (_, i) => i + 1);
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        // Deal cards
        const cardsPerPlayer = Math.min(10, Math.floor(100 / room.players.length));

        room.players.forEach((player, index) => {
          player.cards = deck.slice(index * cardsPerPlayer, (index + 1) * cardsPerPlayer).sort((a, b) => a - b);
        });

        room.status = 'playing';
        room.playedCards = [];
        room.lastPlayedCard = 0;
        room.missedCards = [];

        broadcastRoomState(room);
        break;
      }

      case 'PLAY_CARD': {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room || room.status !== 'playing') return;

        const { cardValue } = message.payload;
        const player = room.players.find(p => p.id === playerId);
        
        if (!player || !player.cards.includes(cardValue)) return;

        // Ascending order validation
        if (room.lastPlayedCard !== null && cardValue <= room.lastPlayedCard) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: "Card must be higher than the last played card!" }));
          return;
        }

        // Check for missed cards (cards lower than cardValue still in hands of ANY player)
        room.players.forEach(p => {
          const missed = p.cards.filter(c => c < cardValue);
          if (missed.length > 0) {
            room.missedCards.push(...missed);
          }
        });

        // Remove card from player's hand
        player.cards = player.cards.filter(c => c !== cardValue);
        
        room.playedCards.push(cardValue);
        room.lastPlayedCard = cardValue;

        // Check if game finished
        const allCardsCleared = room.players.every(p => p.cards.length === 0);
        if (allCardsCleared) {
          room.status = 'finished';
        } else {
          // Check if any player has playable cards
          const anyPlayable = room.players.some(p => p.cards.some(c => c > (room.lastPlayedCard || 0)));
          if (!anyPlayable) {
            room.status = 'finished';
          }
        }

        broadcastRoomState(room);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== playerId);
        if (room.players.length === 0) {
          rooms.delete(currentRoomId);
        } else {
          broadcastRoomState(room);
        }
      }
    }
  });
});

function broadcastRoomState(room: GameRoom) {
  const state = {
    id: room.id,
    status: room.status,
    playedCards: room.playedCards,
    lastPlayedCard: room.lastPlayedCard,
    missedCards: room.missedCards,
    players: room.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      cardCount: p.cards.length,
    }))
  };

  room.players.forEach(p => {
    p.ws.send(JSON.stringify({
      type: 'ROOM_STATE',
      payload: {
        ...state,
        myCards: p.cards,
        myId: p.id
      }
    }));
  });
}

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
