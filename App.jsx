import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';

const GAME_DURATION = 80;

const SevenSegment = ({ value, x, y, size = 1 }) => {
  const s = size * 12;
  const segs = {
    0: [1,1,1,1,1,1,0], 1: [0,1,1,0,0,0,0], 2: [1,1,0,1,1,0,1], 3: [1,1,1,1,0,0,1],
    4: [0,1,1,0,0,1,1], 5: [1,0,1,1,0,1,1], 6: [1,0,1,1,1,1,1], 7: [1,1,1,0,0,0,0],
    8: [1,1,1,1,1,1,1], 9: [1,1,1,1,0,1,1]
  };
  const seg = segs[value] || segs[0];
  const color = "#00a0ff";
  const dim = "#0a1525";
  return (
    <g transform={`translate(${x},${y})`} style={{filter: 'drop-shadow(0 0 3px #00a0ff)'}}>
      <rect x={2} y={0} width={s-4} height={3} fill={seg[0] ? color : dim}/>
      <rect x={s-3} y={2} width={3} height={s/2-2} fill={seg[1] ? color : dim}/>
      <rect x={s-3} y={s/2+2} width={3} height={s/2-2} fill={seg[2] ? color : dim}/>
      <rect x={2} y={s-3} width={s-4} height={3} fill={seg[3] ? color : dim}/>
      <rect x={0} y={s/2+2} width={3} height={s/2-2} fill={seg[4] ? color : dim}/>
      <rect x={0} y={2} width={3} height={s/2-2} fill={seg[5] ? color : dim}/>
      <rect x={2} y={s/2-1} width={s-4} height={3} fill={seg[6] ? color : dim}/>
    </g>
  );
};

const Score = ({ value, x, y }) => (
  <g>
    <SevenSegment value={Math.floor(value / 10)} x={x} y={y} size={2.5}/>
    <SevenSegment value={value % 10} x={x + 35} y={y} size={2.5}/>
  </g>
);

const UFOSprite = ({ x, y }) => (
  <g transform={`translate(${x}, ${y})`} style={{filter: 'drop-shadow(0 0 2px #00a0ff)'}}>
    <ellipse cx="0" cy="0" rx="10" ry="3" fill="#00a0ff"/>
    <ellipse cx="0" cy="-3" rx="3" ry="2" fill="#00a0ff"/>
  </g>
);

const MissileSprite = ({ x, y }) => (
  <g transform={`translate(${x}, ${y})`} style={{filter: 'drop-shadow(0 0 2px #00a0ff)'}}>
    <polygon points="0,-8 -3,-3 3,-3" fill="#00a0ff"/>
    <rect x="-3" y="-3" width="6" height="10" fill="#00a0ff"/>
    <polygon points="-3,4 -7,9 -3,7" fill="#00a0ff"/>
    <polygon points="3,4 7,9 3,7" fill="#00a0ff"/>
  </g>
);

const ExplosionSprite = ({ x, y }) => (
  <g transform={`translate(${x}, ${y})`} style={{filter: 'drop-shadow(0 0 3px #00a0ff)'}}>
    <line x1="0" y1="-10" x2="0" y2="10" stroke="#00a0ff" strokeWidth="2"/>
    <line x1="-10" y1="0" x2="10" y2="0" stroke="#00a0ff" strokeWidth="2"/>
    <line x1="-7" y1="-7" x2="7" y2="7" stroke="#00a0ff" strokeWidth="2"/>
    <line x1="-7" y1="7" x2="7" y2="-7" stroke="#00a0ff" strokeWidth="2"/>
  </g>
);

export default function App() {
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [speed, setSpeed] = useState(1);
  const [ufos, setUfos] = useState([]);
  const [missile, setMissile] = useState(null);
  const [missileCol, setMissileCol] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [explosions, setExplosions] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 200, height: 400 });
  
  const synthRef = useRef(null);
  const gameLoopRef = useRef(null);
  const timerRef = useRef(null);
  const ufoIdRef = useRef(0);
  const missileColRef = useRef(1);
  const containerRef = useRef(null);

  useEffect(() => {
    const updateDimensions = () => {
      const maxW = Math.min(window.innerWidth - 32, 300);
      const maxH = Math.min(window.innerHeight - 200, 500);
      const aspect = 0.5;
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) { h = maxH; w = h * aspect; }
      setDimensions({ width: Math.max(180, w), height: Math.max(360, h) });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const GAME_WIDTH = dimensions.width;
  const GAME_HEIGHT = dimensions.height;
  const COLUMNS = [GAME_WIDTH * 0.25, GAME_WIDTH * 0.5, GAME_WIDTH * 0.75];
  const ALTITUDES = [
    GAME_HEIGHT * 0.85, GAME_HEIGHT * 0.73, GAME_HEIGHT * 0.61,
    GAME_HEIGHT * 0.49, GAME_HEIGHT * 0.37, GAME_HEIGHT * 0.25, GAME_HEIGHT * 0.15
  ];

  useEffect(() => { missileColRef.current = missileCol; }, [missileCol]);

  useEffect(() => {
    synthRef.current = new Tone.Synth().toDestination();
    return () => { synthRef.current?.dispose(); };
  }, []);

  const playSound = useCallback((type) => {
    if (!synthRef.current) return;
    const s = synthRef.current;
    try {
      if (type === 'fire') s.triggerAttackRelease('C5', '0.05');
      else if (type === 'hit') s.triggerAttackRelease('G5', '0.15');
      else if (type === 'ufo') s.triggerAttackRelease('E3', '0.08');
      else if (type === 'lose') s.triggerAttackRelease('C2', '0.3');
      else if (type === 'win') s.triggerAttackRelease('C6', '0.2');
    } catch(e) {}
  }, []);

  const spawnUfo = useCallback(() => {
    const col = Math.floor(Math.random() * 3);
    ufoIdRef.current++;
    playSound('ufo');
    return { id: ufoIdRef.current, col, altitude: 6, dir: Math.random() > 0.5 ? 1 : -1 };
  }, [playSound]);

  const startGame = useCallback(async () => {
    await Tone.start();
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setUfos([spawnUfo()]);
    setMissile(null);
    setMissileCol(1);
    setExplosions([]);
    setGameState('playing');
  }, [spawnUfo]);

  const endGame = useCallback((won) => {
    setGameState(won ? 'won' : 'lost');
    playSound(won ? 'win' : 'lose');
    if (score > highScore) setHighScore(score);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [score, highScore, playSound]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endGame(false); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, endGame]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    let lastSpawn = Date.now();
    const spawnInterval = [1800, 1200, 800][speed - 1];
    const ufoSpeed = [0.03, 0.045, 0.065][speed - 1];
    
    const loop = () => {
      const now = Date.now();
      if (now - lastSpawn > spawnInterval) {
        setUfos(prev => prev.length < 4 ? [...prev, spawnUfo()] : prev);
        lastSpawn = now;
      }
      setUfos(prev => {
        const updated = prev.map(u => {
          let newAlt = u.altitude - ufoSpeed;
          let newCol = u.col, newDir = u.dir;
          if (Math.random() < 0.015) {
            if (u.col === 0) { newCol = 1; newDir = 1; }
            else if (u.col === 2) { newCol = 1; newDir = -1; }
            else { if (Math.random() > 0.5) { newCol = 0; newDir = -1; } else { newCol = 2; newDir = 1; } }
          }
          return { ...u, altitude: newAlt, col: newCol, dir: newDir };
        });
        const attacking = updated.find(u => u.altitude <= 0);
        if (attacking) { endGame(false); return []; }
        return updated;
      });
      setMissile(prev => {
        if (!prev) return null;
        const newAlt = prev.altitude + 0.12;
        if (newAlt > 7) return null;
        return { ...prev, prevAlt: prev.altitude, altitude: newAlt, col: missileColRef.current };
      });
      setExplosions(prev => prev.filter(e => Date.now() - e.time < 200));
      gameLoopRef.current = requestAnimationFrame(loop);
    };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState, speed, spawnUfo, endGame]);

  useEffect(() => {
    if (!missile || gameState !== 'playing') return;
    setUfos(prev => {
      let hit = null;
      const remaining = prev.filter(u => {
        if (u.col !== missile.col) return true;
        const ufoAlt = u.altitude, missileNow = missile.altitude, missilePrev = missile.prevAlt ?? -1;
        if (ufoAlt >= 0 && ufoAlt <= 6.5) {
          if ((missileNow >= ufoAlt - 0.5 && missilePrev < ufoAlt + 0.5) ||
              (missileNow >= ufoAlt - 0.5 && missileNow <= ufoAlt + 0.5)) { hit = u; return false; }
        }
        return true;
      });
      if (hit) {
        const points = Math.max(1, Math.min(6, Math.ceil(hit.altitude)));
        setScore(s => { const newScore = Math.min(99, s + points); if (newScore >= 99) setTimeout(() => endGame(true), 100); return newScore; });
        setExplosions(prev => [...prev, { col: hit.col, altitude: hit.altitude, time: Date.now() }]);
        setMissile(null);
        playSound('hit');
      }
      return remaining;
    });
  }, [missile, gameState, endGame, playSound]);

  const fireMissile = useCallback(() => {
    if (missile || gameState !== 'playing') return;
    playSound('fire');
    setMissileCol(1);
    setMissile({ col: 1, altitude: -0.5, prevAlt: -0.5 });
  }, [missile, gameState, playSound]);

  const moveLeft = useCallback(() => { if (missile) setMissileCol(c => Math.max(0, c - 1)); }, [missile]);
  const moveRight = useCallback(() => { if (missile) setMissileCol(c => Math.min(2, c + 1)); }, [missile]);

  const handleKeyDown = useCallback((e) => {
    if (gameState === 'menu' && (e.key === ' ' || e.key === 'Enter')) { startGame(); return; }
    if (gameState !== 'playing') return;
    if (e.key === 'ArrowLeft') moveLeft();
    else if (e.key === 'ArrowRight') moveRight();
    else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); fireMissile(); }
  }, [gameState, fireMissile, startGame, moveLeft, moveRight]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    document.body.addEventListener('touchmove', prevent, { passive: false });
    return () => document.body.removeEventListener('touchmove', prevent);
  }, []);

  const buttonClass = "select-none touch-none active:scale-95 transition-transform flex items-center justify-center font-bold rounded-lg shadow-lg";

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4 select-none">
        <div className="bg-gray-200 p-2 sm:p-3 rounded-xl shadow-2xl w-full max-w-xs">
          <div className="bg-indigo-900 p-2 rounded-lg">
            <div className="rounded-lg p-4 flex flex-col items-center" style={{background: '#0a0a18'}}>
              <div className="text-red-500 font-bold text-lg px-3 py-1 bg-white rounded mb-2">Just for fun</div>
              <h1 className="text-blue-400 font-bold text-center text-sm sm:text-base" style={{textShadow: '0 0 6px #00a0ff'}}>UFO MASTER BLASTER</h1>
              <h2 className="text-blue-300 text-xs sm:text-sm mb-4" style={{textShadow: '0 0 4px #00a0ff'}}>STATION™</h2>
              <svg width="80" height="50" className="mb-3" style={{background: '#0a0a18'}}>
                <UFOSprite x={40} y={15}/><MissileSprite x={40} y={38}/>
              </svg>
              <div className="mb-4 w-full">
                <p className="mb-2 text-center text-blue-400 text-xs">Speed:</p>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3].map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`px-3 py-2 text-xs sm:text-sm rounded-lg font-bold transition-all ${speed === s ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-blue-400 border border-blue-800'}`}>
                      {s === 1 ? 'Novice' : s === 2 ? 'Mini' : 'Master'}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={startGame} className="w-full py-3 bg-orange-500 text-white font-bold text-lg rounded-lg active:bg-orange-600 shadow-lg">START</button>
              <div className="mt-3 text-xs text-center text-blue-600"><p>SPACE: Fire | ← →: Move</p></div>
              {highScore > 0 && <p className="mt-2 text-blue-400 text-xs">Best: {highScore}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'won' || gameState === 'lost') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4 select-none">
        <div className="bg-gray-200 p-2 sm:p-3 rounded-xl shadow-2xl w-full max-w-xs">
          <div className="bg-indigo-900 p-2 rounded-lg">
            <div className="rounded-lg p-6 flex flex-col items-center" style={{background: '#0a0a18'}}>
              <h1 className={`text-xl sm:text-2xl font-bold mb-4 ${gameState === 'won' ? 'text-yellow-400' : 'text-red-500'}`}
                style={{textShadow: `0 0 8px ${gameState === 'won' ? '#fbbf24' : '#ef4444'}`}}>
                {gameState === 'won' ? 'MASTER BLASTER!' : 'GAME OVER'}
              </h1>
              <svg width="60" height="40" className="mb-2" style={{background: '#0a0a18'}}>
                {gameState === 'won' ? <UFOSprite x={30} y={20}/> : <ExplosionSprite x={30} y={20}/>}
              </svg>
              <p className="text-blue-400 text-3xl font-bold mb-4" style={{textShadow: '0 0 6px #00a0ff'}}>{score}</p>
              <button onClick={() => setGameState('menu')} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg active:bg-blue-700 shadow-lg">PLAY AGAIN</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-2 select-none touch-none">
      <div className="bg-gray-200 p-2 rounded-xl shadow-2xl">
        <div className="bg-indigo-900 p-2 rounded-lg">
          <svg width={GAME_WIDTH} height={GAME_HEIGHT} className="rounded" style={{background: '#0a0a18'}}>
            <Score value={score} x={GAME_WIDTH/2 - 35} y={10}/>
            <text x={GAME_WIDTH - 30} y={22} fill="#00a0ff" fontSize="12" fontWeight="bold" style={{filter: 'drop-shadow(0 0 2px #00a0ff)'}}>{timeLeft}</text>
            {ALTITUDES.map((y, i) => (<text key={i} x="8" y={y + 4} fill="#1a2a40" fontSize="10">{6 - i}</text>))}
            {ufos.map(u => (<UFOSprite key={u.id} x={COLUMNS[u.col]} y={ALTITUDES[Math.min(6, Math.max(0, Math.floor(u.altitude)))]}/>))}
            {explosions.map((e, i) => (<ExplosionSprite key={i} x={COLUMNS[e.col]} y={ALTITUDES[Math.min(6, Math.max(0, Math.floor(e.altitude)))]}/>))}
            {missile && (<MissileSprite x={COLUMNS[missile.col]} y={ALTITUDES[Math.min(6, Math.max(0, Math.floor(missile.altitude)))]}/>)}
            {!missile && <MissileSprite x={COLUMNS[1]} y={GAME_HEIGHT - 25}/>}
            {COLUMNS.map((x, i) => (<rect key={i} x={x - 12} y={GAME_HEIGHT - 8} width="24" height="3" fill={i === 1 && !missile ? "#00a0ff" : "#0a1525"} style={{filter: i === 1 && !missile ? 'drop-shadow(0 0 2px #00a0ff)' : 'none'}}/>))}
          </svg>
        </div>
        <div className="bg-gray-200 pt-3 pb-2 px-1">
          <div className="flex gap-2 justify-center items-center">
            <button onTouchStart={(e) => { e.preventDefault(); moveLeft(); }} onMouseDown={moveLeft}
              className={`${buttonClass} w-16 h-14 sm:w-20 sm:h-16 bg-indigo-800 text-white text-2xl sm:text-3xl active:bg-indigo-600`}>◀</button>
            <button onTouchStart={(e) => { e.preventDefault(); fireMissile(); }} onMouseDown={fireMissile}
              className={`${buttonClass} w-20 h-14 sm:w-24 sm:h-16 text-sm sm:text-base ${missile ? 'bg-gray-500 text-gray-400' : 'bg-orange-500 text-white active:bg-orange-600'}`}>FIRE</button>
            <button onTouchStart={(e) => { e.preventDefault(); moveRight(); }} onMouseDown={moveRight}
              className={`${buttonClass} w-16 h-14 sm:w-20 sm:h-16 bg-indigo-800 text-white text-2xl sm:text-3xl active:bg-indigo-600`}>▶</button>
          </div>
        </div>
      </div>
    </div>
  );
}
