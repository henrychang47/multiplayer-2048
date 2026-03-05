import { useState, useEffect, useRef } from 'react';
import { Board } from './components/Board';
import { useGame } from './hooks/useGame';
import './index.css';

const generateRoomId = () => Math.random().toString(36).substring(2, 8);

function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<'player1' | 'player2' | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [opponentState, setOpponentState] = useState<{ board: number[][], score: number } | null>(null);
  const [timeLimit, setTimeLimit] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const { gameState, handleTouchStart, handleTouchEnd, resetGame } = useGame(!gameStarted || isTimeUp);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setRoomId(room);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const clientId = Math.random().toString(36).substring(2, 10);
    const envUrl = import.meta.env.VITE_WS_URL;
    let socketUrl = '';

    if (envUrl) {
      // If VITE_WS_URL is provided (e.g., wss://api.example.com), use it
      socketUrl = `${envUrl}/ws/${roomId}/${clientId}`;
    } else {
      // Fallback for local development
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socketUrl = `${protocol}//${host}/ws/${roomId}/${clientId}`;
    }

    ws.current = new WebSocket(socketUrl);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'role_assignment':
          setRole(data.role);
          if (data.players) setPlayers(data.players);
          if (data.settings?.time_limit) {
            setTimeLimit(data.settings.time_limit);
            setTimeLeft(data.settings.time_limit);
          }
          break;
        case 'player_joined':
          if (data.players) setPlayers(data.players);
          break;
        case 'game_start':
          setTimeLimit(data.settings.time_limit);
          setTimeLeft(data.settings.time_limit);
          setGameStarted(true);
          setIsTimeUp(false);
          resetGame(); // Ensure fresh board
          break;
        case 'game_state_update':
          setOpponentState(data);
          break;
        case 'settings_updated':
          setTimeLimit(data.settings.time_limit);
          setTimeLeft(data.settings.time_limit);
          break;
        case 'lobby_return':
          setGameStarted(false);
          setIsTimeUp(false);
          setOpponentState(null);
          break;
        case 'host_migration':
          setRole(data.role);
          if (data.players) setPlayers(data.players);
          break;
        case 'player_disconnected':
          setPlayers(data.players || []);
          setGameStarted((prev) => {
            if (prev) alert('Opponent disconnected');
            return false;
          });
          break;
        default:
          break;
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [roomId, resetGame]);

  // Timer logic
  useEffect(() => {
    if (!gameStarted || isTimeUp) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, isTimeUp]);

  // Sync game state when it changes
  useEffect(() => {
    if (gameStarted && !isTimeUp && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'game_state_update',
        board: gameState.board,
        score: gameState.score,
        hasLost: gameState.hasLost,
        hasWon: gameState.hasWon
      }));
    }
  }, [gameState.board, gameState.score, gameState.hasLost, gameState.hasWon, gameStarted, isTimeUp]);

  const createRoom = () => {
    const newRoom = generateRoomId();
    window.history.pushState({}, '', `?room=${newRoom}`);
    setRoomId(newRoom);
  };

  const updateTimeLimit = (newLimit: number) => {
    if (role === 'player1' && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'update_settings',
        settings: { time_limit: newLimit }
      }));
    }
  };

  const startGame = () => {
    if (role === 'player1' && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'start_game' }));
    }
  };

  const requestRestart = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'restart_request' }));
    }
  };

  const leaveRoom = () => {
    ws.current?.close();
    setRoomId(null);
    setRole(null);
    setGameStarted(false);
    setPlayers([]);
    window.history.pushState({}, '', window.location.pathname);
  };

  const inviteLink = typeof window !== 'undefined' ? window.location.href : '';

  if (!roomId) {
    return (
      <div className="container full-center">
        <div className="glass-panel home-panel">
          <h1 className="title">Multiplayer<br />2048</h1>
          <p className="subtitle" style={{ marginBottom: '2rem' }}>Play 2048 in Versus Mode against a friend in real-time!</p>
          <button className="btn-primary" onClick={createRoom} style={{ width: '100%' }}>
            Create Game Room
          </button>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="container full-center">
        <div className="glass-panel home-panel">
          <h2 className="title" style={{ fontSize: '2rem' }}>{role === 'player1' ? 'Room Lobby' : 'Joining Lobby...'}</h2>

          <div className="player-list">
            <label className="lobby-label">PLAYERS IN ROOM</label>
            <div className="player-card glass-panel" style={{ border: role === 'player1' ? '1px solid var(--accent)' : '1px solid var(--glass-border)' }}>
              <div className="player-status-dot" style={{ background: '#10b981' }}></div>
              <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, textAlign: 'left' }}>You {role === 'player1' ? '(Host)' : ''}</div>
            </div>
            {players.filter(p => p !== role).map(p => (
              <div key={p} className="player-card glass-panel">
                <div className="player-status-dot" style={{ background: '#3b82f6' }}></div>
                <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, textAlign: 'left' }}>Opponent joined</div>
              </div>
            ))}
            {players.length < 2 && (
              <div className="player-card" style={{ border: '1px dashed var(--glass-border)', opacity: 0.5 }}>
                <div className="player-status-dot" style={{ background: 'var(--text-secondary)' }}></div>
                <div style={{ flex: 1, fontSize: '0.875rem', textAlign: 'left' }}>Waiting for opponent...</div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <label className="lobby-label">INVITE LINK</label>
            <div className="invite-link-box">
              <input type="text" readOnly value={inviteLink} onClick={e => (e.target as HTMLInputElement).select()} style={{ flex: 1 }} />
              <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.875rem' }} onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</button>
            </div>
          </div>

          <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
            <label className="lobby-label">GAME DURATION</label>
            <div className="duration-grid">
              <button
                disabled={role !== 'player1'}
                onClick={() => updateTimeLimit(30)}
                className="btn-duration"
                style={{
                  background: timeLimit === 30 ? 'var(--accent)' : 'var(--glass-bg)',
                  color: timeLimit === 30 ? 'white' : 'var(--text-primary)',
                  cursor: role === 'player1' ? 'pointer' : 'default',
                  opacity: role !== 'player1' && timeLimit !== 30 ? 0.5 : 1
                }}
              >30 Seconds</button>
              <button
                disabled={role !== 'player1'}
                onClick={() => updateTimeLimit(60)}
                className="btn-duration"
                style={{
                  background: timeLimit === 60 ? 'var(--accent)' : 'var(--glass-bg)',
                  color: timeLimit === 60 ? 'white' : 'var(--text-primary)',
                  cursor: role === 'player1' ? 'pointer' : 'default',
                  opacity: role !== 'player1' && timeLimit !== 60 ? 0.5 : 1
                }}
              >60 Seconds</button>
            </div>
          </div>

          {role === 'player1' ? (
            <button
              className="btn-primary"
              onClick={startGame}
              disabled={players.length < 2}
              style={{ width: '100%', opacity: players.length < 2 ? 0.5 : 1, cursor: players.length < 2 ? 'not-allowed' : 'pointer' }}
            >
              Start Game
            </button>
          ) : (
            <div className="waiting-msg">
              Waiting for host...
            </div>
          )}

          <button className="btn-text" style={{ marginTop: '2rem' }} onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  // Determine winner when time is up
  let winnerText = "";
  if (isTimeUp) {
    if (gameState.score > (opponentState?.score || 0)) {
      winnerText = "You Win!";
    } else if (gameState.score < (opponentState?.score || 0)) {
      winnerText = "Opponent Wins!";
    } else {
      winnerText = "It's a Tie!";
    }
  }

  return (
    <div className="game-layout">
      <div className="game-header">

        {/* Timer Bar */}
        <div className="timer-bar-container">
          <div className="timer-bar" style={{
            width: `${(timeLeft / timeLimit) * 100}%`,
            background: timeLeft < 10 ? '#ef4444' : 'var(--accent)',
          }} />
        </div>

        <div className="header-top">
          <h1 className="title" style={{ fontSize: '1.5rem', margin: 0 }}>Multiplayer 2048</h1>
          <div className="glass-panel timer-display" style={{ color: timeLeft < 10 ? '#ef4444' : 'var(--accent)' }}>
            {timeLeft}s
          </div>
        </div>

        <div className="score-row">
          <div className="glass-panel score-panel">
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>YOUR SCORE</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#60a5fa' }}>{gameState.score}</div>
          </div>

          <div className="vs-divider">VS</div>

          <div className="glass-panel score-panel">
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>OPPONENT SCORE</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171' }}>{opponentState?.score || 0}</div>
          </div>
        </div>
      </div>

      <div className="game-content" style={{ flex: 1, width: '100%', maxWidth: '800px', position: 'relative' }}>

        {/* Final Result Overlay */}
        {isTimeUp && (
          <div className="glass-panel result-overlay">
            <h2 className="result-title" style={{ color: winnerText === "You Win!" ? '#60a5fa' : '#f87171' }}>{winnerText}</h2>
            <p style={{ fontSize: '1.25rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>Final Score: {gameState.score}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={requestRestart}>Restart & Back to Lobby</button>
              <button className="btn-text" onClick={leaveRoom}>
                Exit to Home
              </button>
            </div>
          </div>
        )}

        {/* Main Board */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', opacity: isTimeUp ? 0.3 : 1, transition: 'opacity 0.5s' }}>
          <Board gameState={gameState} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} />
        </div>

        {/* Mini Opponent Board */}
        {opponentState && (
          <div className="mini-board-wrapper" style={{ opacity: isTimeUp ? 0.3 : 1 }}>
            <div className="mini-board-title">
              <div className="mini-board-dot"></div>
              <h3 className="mini-board-label">OPPONENT BOARD</h3>
            </div>
            <div className="mini-board glass-panel">
              {opponentState.board.map((row: number[], r: number) =>
                row.map((val: number, c: number) => {
                  let bgColor = 'var(--cell-bg)';
                  if (val > 0) bgColor = `var(--tile-${val > 2048 ? 'super' : val})`;
                  return (
                    <div key={`mini-${r}-${c}`} className="mini-cell">
                      <div className="mini-tile-inner" style={{ background: bgColor }}></div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

export default App;
