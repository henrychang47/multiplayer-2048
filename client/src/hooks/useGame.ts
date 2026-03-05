import { useState, useEffect, useCallback } from 'react';
import { GameState, createInitialState, move, Direction } from '../logic/game';

export const useGame = (disabled: boolean = false) => {
    const [gameState, setGameState] = useState<GameState>(createInitialState());

    const handleMove = useCallback((direction: Direction) => {
        if (disabled) return;
        setGameState(prev => {
            if (prev.hasWon || prev.hasLost) return prev;
            return move(prev, direction);
        });
    }, [disabled]);

    useEffect(() => {
        if (disabled) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
            switch (e.key) {
                case 'ArrowUp': handleMove('UP'); break;
                case 'ArrowDown': handleMove('DOWN'); break;
                case 'ArrowLeft': handleMove('LEFT'); break;
                case 'ArrowRight': handleMove('RIGHT'); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleMove, disabled]);

    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

    // Touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStart) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;

        // Require a minimum swipe distance to prevent accidental triggers
        if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) handleMove('RIGHT');
            else handleMove('LEFT');
        } else {
            if (dy > 0) handleMove('DOWN');
            else handleMove('UP');
        }
        setTouchStart(null);
    }, [touchStart, handleMove]);

    const resetGame = useCallback(() => {
        setGameState(createInitialState());
    }, []);

    return { gameState, setGameState, handleMove, handleTouchStart, handleTouchEnd, resetGame };
};
