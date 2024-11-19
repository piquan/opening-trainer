import * as React from 'react';

import { Chess } from 'chess.js'

// Test making a move.  Return the move as an object if it's
// allowable, or null if not.
function testMoveOnChess(chess, move) {
    // Operate on a copy.
    const c = new Chess();
    c.loadPgn(chess.pgn())
    try {
        return c.move(move);
    } catch (e) {
        if (e.message.startsWith('Invalid move:')) {
            return null;
        }
        throw e;
    }
}

function stateFromChess(chess) {
    // We only precompute the things that are used quite frequently.  We
    // defer things that aren't as often used, by sending them as functions.
    const history = chess.history({verbose: true});
    return {
        'fen': chess.fen(),
        'pgn': chess.pgn(),
        'turn': chess.turn(),
        'history': {
            'empty': history.length === 0,
            'obj': history,
            'san': history.map(m => m.san),
            'lan': history.map(m => m.lan),
        },
        'gameOver': (chess.isCheckmate() ? 'Checkmate' :
                     chess.isStalemate() ? 'Stalemate' :
                     chess.isInsufficientMaterial() ? 'Draw by insufficient material' :
                     chess.isThreefoldRepetition() ? 'Draw by threefold repetition' :
                     // I think the only remaining draw is the 50-move rule.
                     chess.isDraw() ? 'Draw' :
                     // I don't think we can get a generic game over.
                     chess.isGameOver() ? 'Game Over' :
                     null),
        'movesFrom': s => chess.moves({square: s, verbose: true})
                               .map(m => m.to),
        'testMove': m => testMoveOnChess(chess, m),
    };
}

function chessReducer(state, action) {
    const chess = new Chess();
    chess.loadPgn(state.pgn);

    switch (action.type) {
        case 'move':
            chess.move(action.move);
            break;
        case 'reset':
            chess.reset();
            break;
        case 'undo':
            chess.undo();
            break;
        case 'undoToPlayer':
            // Undo enough to give the player a new move.
            if (!(action.player === 'w' || action.player === 'b'))
                throw new Error("invalid player");
            do {
                if (!chess.undo()) // History is empty
                    break;
            } while (chess.turn() !== action.player);
            break;
        default:
            throw new Error(`Unknown action ${action.type}`);
    }

    return stateFromChess(chess);
}

function initChess({pgn, fen}) {
    const chess = ((typeof fen !== "undefined" && fen !== null &&
                    fen.trim() !== '') ?
                   new Chess(fen) : new Chess());
    if (typeof pgn !== "undefined" && pgn !== null && pgn.trim() !== '')
        chess.loadPgn(pgn);
    return stateFromChess(chess);
}

export function useChess(init) {
    return React.useReducer(chessReducer, init, initChess);
}
