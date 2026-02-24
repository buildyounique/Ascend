import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Play, Send, Trophy, AlertCircle, LogOut, ChevronRight } from 'lucide-react';

interface PlayerInfo {
  id: string;
  name: string;
  cardCount: number;
}

interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  cardCount: number;
}

interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  playedCards: number[];
  lastPlayedCard: number | null;
  missedCards: number[];
  players: PlayerInfo[];
  myCards: number[];
  myId: string;
}

const COLORS = [
  'bg-[#FF5555]', // Red
  'bg-[#5555FF]', // Blue
  'bg-[#55AA55]', // Green
  'bg-[#FFAA00]', // Yellow
];

const AVATARS = ['🚀', '👾', '🦊', '🐱', '🐶', '🦁', '🐯', '🐼', '🐨', '🐸'];

// Sound Utility
const playSound = (type: 'play' | 'error' | 'win' | 'start') => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'play':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'error':
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'start':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;
    case 'win':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.5);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
  }
};

export default function App() {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('ascend_name') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('ascend_avatar') || AVATARS[0]);
  const [roomId, setRoomId] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    localStorage.setItem('ascend_name', playerName);
    localStorage.setItem('ascend_avatar', avatar);
  }, [playerName, avatar]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const connect = () => {
    if (!playerName || !roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'JOIN_ROOM',
        payload: { roomId, playerName, avatar }
      }));
      setJoined(true);
      playSound('start');
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'ROOM_STATE') {
        const oldState = gameState;
        setGameState(message.payload);
        setError(null);

        // Sound effects for state changes
        if (oldState) {
          if (message.payload.lastPlayedCard !== oldState.lastPlayedCard) {
            playSound('play');
          }
          if (message.payload.status === 'finished' && oldState.status !== 'finished') {
            playSound('win');
          }
        }
      } else if (message.type === 'ERROR') {
        setError(message.payload);
        playSound('error');
        if (message.payload === "Game already in progress") {
           setJoined(false);
        }
      }
    };

    socket.onclose = () => {
      setJoined(false);
      setGameState(null);
    };
  };

  const startGame = () => {
    socketRef.current?.send(JSON.stringify({ type: 'START_GAME' }));
  };

  const playCard = (cardValue: number) => {
    socketRef.current?.send(JSON.stringify({
      type: 'PLAY_CARD',
      payload: { cardValue }
    }));
  };

  const leaveRoom = () => {
    socketRef.current?.close();
    setJoined(false);
    setGameState(null);
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4 font-sans overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#FF5555] rounded-full blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5555FF] rounded-full blur-[120px] opacity-20 animate-pulse delay-700" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#1E1E1E] border border-white/10 rounded-[2rem] p-10 shadow-2xl relative z-10"
        >
          <div className="text-center mb-10">
            <div className="inline-block px-4 py-1 bg-white/5 rounded-full border border-white/10 mb-4">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em]">Real-Time Edition</span>
            </div>
            <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none mb-2 italic">
              ASCEND
            </h1>
            <p className="text-white/40 text-sm font-medium">Cooperative Number Chaos</p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center gap-2 mb-4 overflow-x-auto py-2 scrollbar-hide">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAvatar(a); playSound('play'); }}
                  className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl transition-all ${avatar === a ? 'bg-white scale-110' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  {a}
                </button>
              ))}
            </div>

            <div className="group">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 ml-1 group-focus-within:text-[#FF5555] transition-colors">
                Your Alias
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Type name..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-[#FF5555] focus:ring-1 focus:ring-[#FF5555] text-white font-bold text-lg transition-all placeholder:text-white/10"
              />
            </div>

            <div className="group">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 ml-1 group-focus-within:text-[#5555FF] transition-colors">
                Room Code
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter code..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-[#5555FF] focus:ring-1 focus:ring-[#5555FF] text-white font-bold text-lg transition-all placeholder:text-white/10"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 text-[#FF5555] font-bold text-xs bg-[#FF5555]/10 p-4 rounded-2xl border border-[#FF5555]/20"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}

            <button
              onClick={connect}
              disabled={!playerName || !roomId}
              className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-20 disabled:hover:scale-100"
            >
              Enter Arena <ChevronRight size={20} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans overflow-hidden flex flex-col selection:bg-white selection:text-black">
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-black font-black text-xl italic">{avatar}</span>
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter italic">Ascend</h2>
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Session: {gameState.id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {gameState.status === 'playing' && (
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-[#55AA55] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Real-Time Play Enabled
              </span>
            </div>
          )}
          <button 
            onClick={leaveRoom}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-white/40 hover:text-white"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 md:p-10 relative overflow-hidden">
        {gameState.status === 'waiting' ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl bg-[#1E1E1E] border border-white/10 rounded-[2.5rem] p-12 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#5555FF]/20 rounded-2xl flex items-center justify-center text-[#5555FF]">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Lobby</h3>
                    <p className="text-xs text-white/40 font-medium">Waiting for players to join...</p>
                  </div>
                </div>
                <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10">
                  <span className="text-xs font-bold text-white/60">{gameState.players.length} Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {gameState.players.map((p, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={p.id} 
                    className="flex items-center gap-4 p-5 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                  >
                    <div className={`w-12 h-12 ${COLORS[idx % COLORS.length]} rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-110 transition-transform`}>
                      {p.avatar || p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="block font-bold text-lg leading-none mb-1">{p.name}</span>
                      <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
                        {p.id === gameState.myId ? 'Commander' : 'Ally'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={startGame}
                disabled={gameState.players.length < 1}
                className="w-full bg-[#55AA55] text-white py-6 rounded-3xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xl shadow-[0_20px_40px_rgba(85,170,85,0.2)] disabled:opacity-20"
              >
                <Play fill="currentColor" size={24} /> Launch Game
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Players Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {gameState.players.map((p, idx) => (
                <motion.div 
                  key={p.id} 
                  className="p-5 rounded-[2rem] border-2 border-white/5 bg-white/5 transition-all relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-8 h-8 ${COLORS[idx % COLORS.length]} rounded-lg flex items-center justify-center text-white font-black text-xs`}>
                      {p.avatar || p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Cards</span>
                      <span className="text-sm font-black">{p.cardCount}</span>
                    </div>
                  </div>
                  <div className="font-black text-lg truncate uppercase tracking-tighter italic">{p.name}</div>
                </motion.div>
              ))}
            </div>

            {/* Game Table */}
            <div className="flex-1 flex items-center justify-center relative">
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                <span className="text-[25vw] font-black uppercase tracking-tighter italic">ASCEND</span>
              </div>

              <AnimatePresence mode="popLayout">
                {gameState.lastPlayedCard !== null && (
                  <motion.div
                    key={gameState.lastPlayedCard}
                    initial={{ scale: 0, opacity: 0, rotate: -45, y: 200 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
                    exit={{ scale: 1.5, opacity: 0, y: -200 }}
                    className="w-56 h-80 bg-white rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative overflow-hidden"
                  >
                    <div className="absolute inset-4 border-2 border-black/5 rounded-[1.5rem]" />
                    <div className="absolute top-6 left-8 text-black font-black text-3xl italic">{gameState.lastPlayedCard}</div>
                    <div className="text-[10rem] font-black text-black leading-none italic tracking-tighter">
                      {gameState.lastPlayedCard}
                    </div>
                    <div className="absolute bottom-6 right-8 text-black font-black text-3xl italic rotate-180">{gameState.lastPlayedCard}</div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[60%] bg-black/5 rounded-[100%] -rotate-45 -z-10" />
                  </motion.div>
                )}
              </AnimatePresence>

              {gameState.status === 'finished' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 rounded-[3rem]"
                >
                  <div className="text-center max-w-lg p-12">
                    <div className="w-24 h-24 bg-[#FFAA00] rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_20px_40px_rgba(255,170,0,0.3)]">
                      <Trophy className="text-white" size={48} />
                    </div>
                    <h2 className="text-7xl font-black uppercase tracking-tighter italic mb-4">Victory</h2>
                    <p className="text-white/40 text-sm font-medium mb-10">The sequence is complete</p>
                    
                    <div className="bg-white/5 rounded-[2rem] border border-white/10 p-8 mb-10">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-6 text-left">Final Standings</h3>
                      <div className="space-y-4">
                        {gameState.players.sort((a, b) => a.cardCount - b.cardCount).map((p, i) => (
                          <div key={p.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-[#FFAA00] text-black' : 'bg-white/10 text-white'}`}>
                                {i + 1}
                              </span>
                              <span className="font-bold text-lg">{p.avatar} {p.name}</span>
                            </div>
                            <span className="font-mono text-sm text-white/40">{p.cardCount} Left</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={startGame}
                      className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl"
                    >
                      New Session
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* My Hand */}
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Your Arsenal</h3>
                </div>
                
                {gameState.missedCards.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#FF5555]/10 text-[#FF5555] rounded-full border border-[#FF5555]/20 text-[8px] font-black uppercase tracking-widest">
                    <AlertCircle size={10} /> {gameState.missedCards.length} Missed Opportunities
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-4 justify-center items-end h-56">
                {gameState.myCards.map((card, idx) => {
                  const isPlayable = gameState.lastPlayedCard === null || card > gameState.lastPlayedCard;
                  return (
                    <motion.button
                      key={card}
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={isPlayable ? { y: -40, scale: 1.1, rotate: 0 } : {}}
                      whileTap={isPlayable ? { scale: 0.9 } : {}}
                      onClick={() => isPlayable && playCard(card)}
                      disabled={!isPlayable}
                      className={`w-28 h-44 rounded-2xl flex flex-col items-center justify-center relative group transition-all duration-300 ${
                        isPlayable 
                          ? 'bg-white text-black cursor-pointer shadow-[0_20px_40px_rgba(0,0,0,0.3)]' 
                          : 'bg-white/5 text-white/10 border border-white/5 cursor-not-allowed grayscale'
                      }`}
                      style={{ 
                        transform: `rotate(${(idx - (gameState.myCards.length - 1) / 2) * 4}deg)`,
                        zIndex: idx
                      }}
                    >
                      <div className="absolute top-3 left-4 font-black text-lg italic">{card}</div>
                      <div className="text-5xl font-black italic tracking-tighter group-hover:scale-110 transition-transform">
                        {card}
                      </div>
                      <div className="absolute bottom-3 right-4 font-black text-lg italic rotate-180">{card}</div>
                      {isPlayable && (
                        <div className="absolute inset-0 rounded-2xl bg-white blur-xl opacity-0 group-hover:opacity-20 transition-opacity" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 bg-[#FF5555] text-white rounded-2xl font-bold shadow-2xl flex items-center gap-3"
          >
            <AlertCircle size={20} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>
    </div>
  );
}
