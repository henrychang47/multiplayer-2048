export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface Tile {
    id: string;
    value: number;
    position: [number, number]; // [row, col]
    mergedFrom?: [Tile, Tile];
    isNew?: boolean;
}

export interface GameState {
    tiles: Tile[];
    board: number[][]; // 4x4 matrix
    score: number;
    hasWon: boolean;
    hasLost: boolean;
}

let tileIdCounter = 0;
const getId = () => `tile_${tileIdCounter++}`;

export const getEmptyBoard = () => Array(4).fill(0).map(() => Array(4).fill(0));

export const addRandomTile = (state: GameState): GameState => {
    const emptySpots: [number, number][] = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (state.board[r][c] === 0) emptySpots.push([r, c]);
        }
    }
    if (emptySpots.length === 0) return state;

    const [r, c] = emptySpots[Math.floor(Math.random() * emptySpots.length)];
    const value = Math.random() < 0.9 ? 2 : 4;

    const newTile: Tile = { id: getId(), value, position: [r, c], isNew: true };
    const newBoard = state.board.map(row => [...row]);
    newBoard[r][c] = value;

    return { ...state, board: newBoard, tiles: [...state.tiles, newTile] };
};

export const createInitialState = (): GameState => {
    let state: GameState = { tiles: [], board: getEmptyBoard(), score: 0, hasWon: false, hasLost: false };
    state = addRandomTile(state);
    state = addRandomTile(state);
    return state;
};

export const checkGameOver = (board: number[][]): boolean => {
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board[r][c] === 0) return false;
            if (r < 3 && board[r + 1][c] === board[r][c]) return false;
            if (c < 3 && board[r][c + 1] === board[r][c]) return false;
        }
    }
    return true;
};

export const move = (state: GameState, direction: Direction): GameState => {
    // Only keep top-level tiles (those not consumed by a merge in the last frame)
    // This prevents "ghost" tiles (old parts of a merge) from interfering with logic
    const consumedIds = new Set<string>();
    state.tiles.forEach(t => {
        if (t.mergedFrom) {
            consumedIds.add(t.mergedFrom[0].id);
            consumedIds.add(t.mergedFrom[1].id);
        }
    });

    const oldTiles = state.tiles
        .filter(t => !consumedIds.has(t.id))
        .map(t => ({ ...t, isNew: false, mergedFrom: undefined }));

    const newBoard = getEmptyBoard();
    const nextTiles: Tile[] = [];
    let scoreIncrease = 0;
    let hasMoved = false;

    const tileMap = new Map<string, Tile>();
    oldTiles.forEach(t => tileMap.set(`${t.position[0]},${t.position[1]}`, t));

    // We process rows or columns
    const isVertical = direction === "UP" || direction === "DOWN";
    const isForward = direction === "RIGHT" || direction === "DOWN";

    for (let i = 0; i < 4; i++) {
        const line: { tile: Tile, value: number, merged: boolean, mergedComponents?: [Tile, Tile] }[] = [];

        // Extract line
        for (let j = 0; j < 4; j++) {
            const idx = isForward ? 3 - j : j;
            const r = isVertical ? idx : i;
            const c = isVertical ? i : idx;

            const val = state.board[r][c];
            if (val !== 0) {
                const tile = tileMap.get(`${r},${c}`);
                if (tile) {
                    line.push({ tile, value: val, merged: false });
                }
            }
        }

        // Compress and Merge
        const newLine: { tile: Tile, value: number, merged: boolean, mergedComponents?: [Tile, Tile] }[] = [];
        for (let j = 0; j < line.length; j++) {
            if (
                j < line.length - 1 &&
                line[j].value === line[j + 1].value
            ) {
                // Merge
                newLine.push({
                    tile: line[j].tile,
                    value: line[j].value * 2,
                    merged: true,
                    // Store the actual tiles involved for the UI
                    mergedComponents: [line[j].tile, line[j + 1].tile]
                });
                hasMoved = true; // Any merge is a move
                j++; // Skip next
            } else {
                newLine.push(line[j]);
            }
        }

        // Place back into board and update coordinates
        for (let j = 0; j < newLine.length; j++) {
            const idx = isForward ? 3 - j : j;
            const r = isVertical ? idx : i;
            const c = isVertical ? i : idx;

            const item = newLine[j];
            newBoard[r][c] = item.value;

            if (item.merged) {
                scoreIncrease += item.value;
                const [t1, t2] = item.mergedComponents!;

                // Destination tile
                const mergedTile: Tile = {
                    id: getId(),
                    value: item.value,
                    position: [r, c],
                    mergedFrom: [t1, t2]
                };

                // Update component positions for animation
                t1.position = [r, c];
                t2.position = [r, c];

                nextTiles.push(t1, t2, mergedTile);
            } else {
                const origPos = item.tile.position;
                if (origPos[0] !== r || origPos[1] !== c) {
                    hasMoved = true;
                }
                item.tile.position = [r, c];
                nextTiles.push(item.tile);
            }
        }
    }

    if (!hasMoved) return state;

    let nextState: GameState = {
        ...state,
        board: newBoard,
        tiles: nextTiles,
        score: state.score + scoreIncrease,
    };

    nextState = addRandomTile(nextState);

    // Filter out tiles that were 'consumed' in a previous step so they don't linger forever
    // We keep only tiles that are conceptually 'active'. 
    // Any tile that has `mergedFrom` is active. Any tile in `mergedFrom` is inactive taking effect ONLY during this render pass for animation.
    // Next time we call move(), we drop `mergedFrom` and those old tiles naturally get filtered out because they aren't in the new active set.

    if (checkGameOver(nextState.board)) {
        nextState.hasLost = true;
    }
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (nextState.board[r][c] >= 2048) nextState.hasWon = true;
        }
    }

    return nextState;
};
