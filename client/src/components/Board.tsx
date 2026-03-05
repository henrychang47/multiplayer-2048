import React from 'react';
import { GameState } from '../logic/game';
import '../index.css';

interface BoardProps {
    gameState: GameState;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

export const Board: React.FC<BoardProps> = ({ gameState, onTouchStart, onTouchEnd }) => {
    // Use a fixed board size for rendering calculation (e.g. 400px width minus padding minus gap)
    // But using percentage is more responsive.
    // We have a 4x4 grid. The position calculation can be done in CSS via inline styles using %!

    // 4 columns, 3 gaps. Let's rely on standard calculation:
    // Tile width is ~25% minus gaps.
    // Actually, position absolute using Left and Top.
    // If board padding is 3% and gaps are 3%, tile is 21.25%.
    // Let's just calculate based on constants and let CSS do scaling if needed.

    const getPositionStyle = (r: number, c: number) => {
        // Correct calculation for 4x4 grid with 12px padding and 12px gaps:
        // Total horizontal space for gutters = 12px (left) + 3*12px (gaps) + 12px (right) = 60px
        // Width of one tile = (100% - 60px) / 4 = 25% - 15px
        // Position = Padding + Index * (Width + Gap) = 12px + Index * (25% - 15px + 12px) = 12px + Index * (25% - 3px)
        return {
            top: `calc(${r} * (25% - 3px) + 12px)`,
            left: `calc(${c} * (25% - 3px) + 12px)`,
            width: `calc(25% - 15px)`,
            height: `calc(25% - 15px)`,
        };
    };

    return (
        <div
            className="board"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* Background cells */}
            {Array(4).fill(0).map((_, r) =>
                Array(4).fill(0).map((_, c) => (
                    <div key={`cell-${r}-${c}`} className="cell" />
                ))
            )}

            {/* Tiles */}
            {gameState.tiles.map(tile => (
                <div
                    key={tile.id}
                    className={`tile tile-${tile.value}${tile.isNew ? ' tile-new' : ''}${tile.mergedFrom ? ' tile-merged' : ''}`}
                    style={getPositionStyle(tile.position[0], tile.position[1])}
                >
                    <div className="tile-inner">
                        {tile.value}
                    </div>
                </div>
            ))}

            {/* Overlays for win/loss */}
            {(gameState.hasLost || gameState.hasWon) && (
                <div className="absolute inset-0 bg-black bg-opacity-50 z-20 flex flex-col items-center justify-center rounded-2xl" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                    <h2 className="text-4xl font-bold text-white mb-4" style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white', marginBottom: '1rem' }}>
                        {gameState.hasWon ? 'You Win!' : 'Game Over'}
                    </h2>
                    <p className="text-xl text-white mb-6" style={{ fontSize: '1.25rem', color: 'white', marginBottom: '1.5rem' }}>Score: {gameState.score}</p>
                </div>
            )}
        </div>
    );
};
