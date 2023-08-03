// Much of what we use here doesn't work in SSR (even useState), so
// tell next.js that this is client-only code.
'use client';

import * as React from 'react';
import { Alert, Box, Button, Collapse, Divider, Paper, Snackbar, Stack, Typography } from '@mui/material';

import { useQuery } from '@tanstack/react-query'
import axios from 'axios';
import { cloneDeep } from 'lodash-es';
import { Chess } from 'chess.js'
import { Chessboard } from "react-chessboard";

import { MinDate, MaxDate, ValidRatings, SettingsContext } from "./settings";
import { StockfishManager } from "./stockfish";
import { EvalBar } from "./evalbar";

function GetOpenings({queryKey}) {
    const params = queryKey[0];
    return axios.get("https://explorer.lichess.ovh/lichess",
                     {params: params})
                .then(res => res.data);
}

function computeRetryDelay(attempt, error) {
    if (error.response && error.response.status === 429) {
        // The API docs ask us to wait one minute between 429 statuses.
        return 60 * 1000;
    }
    // Otherwise, use exponential backoff up to 30 seconds.
    return Math.min(attempt > 1 ? 2 ** attempt * 1000 : 1000,
                    30 * 1000)
}

function randomMove(data) {
    const moves = data.moves;
    var total = 0;
    for (const move of moves) {
        total += move.white + move.draws + move.black;
    }
    var random = Math.floor(Math.random() * total);
    for (const move of moves) {
        random -= move.white + move.draws + move.black;
        if (random <= 0) {
            return move;
        }
    }
    throw new Error("randomMove did not terminate");
}

// This shouldn't be called during a render, only in a useEffect.
function fragmentSearchParameters() {
    if (typeof window === "undefined") {
        return new URLSearchParams();
    }
    const hash = window.location.hash;
    if (hash === "") {
        // It's empty if the URL doesn't have a fragment identifier.
        return new URLSearchParams();
    }
    // Otherwise, it starts with a #.
    const fragment = hash.substr(1);
    return new URLSearchParams(fragment);
}

function fragmentGet(key) {
    return fragmentSearchParameters().get(key);
}

function fragmentSet(key, value) {
    const usp = fragmentSearchParameters();
    if (usp.get(key) === value.toString()) {
        return;
    }
    usp.set(key, value);
    const newFragment = usp.toString();
    const url = new URL(window.location);
    url.hash = "#" + newFragment;
    window.history.replaceState(window.history.state, "", url.toString());
}

function fragmentDel(key) {
    const usp = fragmentSearchParameters();
    if (!usp.has(key)) {
        return;
    }
    usp.delete(key);
    const newFragment = usp.toString();
    const url = new URL(window.location);
    // Leave the # in place even if there's nothing after it; if we
    // remove the #, then it triggers a load (at least on Chrome).
    url.hash = "#" + newFragment;
    window.history.replaceState(window.history.state, "", url.toString());
}

export default function ChessField() {
    // We include the PGN and orientation in the URL fragment to allow
    // bookmarking, and moreover, so that browser nav away and back
    // doesn't lose all our state.  We'll later include the db search
    // params in cookies.
    const [boardOrientation, setBoardOrientation] = React.useState(() => {
        return fragmentGet("color") === "black" ? "black" : "white";
    });
    const playerLetter = boardOrientation[0];

    const [game, setGame] = React.useState(() => {return new Chess();});
    // After the first render, update the game with the fragment's
    // PGN.  Give it an explicit empty dependency, because if we do
    // this on subsequent renders, it will fight with makeAMove trying
    // to replace the game.
    React.useEffect(() => {
        const pgn = fragmentGet("pgn");
        if (pgn === null) {
            return;
        }
        const newGame = new Chess();
        newGame.loadPgn(pgn);
        setGame(newGame);
    }, []);

    // Every time the game changes, update the fragment to include the
    // new state.
    React.useEffect(() => {
        const newPgn = game.pgn().replace(/ ?\. ?/g, '.');
        if (newPgn === "") {
            fragmentDel("pgn");
        } else {
            fragmentSet("pgn", newPgn);
        }
        if (boardOrientation === "white" && newPgn === "") {
            fragmentDel("color");
        } else {
            fragmentSet("color", boardOrientation);
        }
    }, [game, boardOrientation]);

    function makeAMove(move) {
        const newGame = cloneDeep(game);
        var updatedMove;
        try {
            updatedMove = newGame.move(move);
        } catch (e) {
            if (e.message.startsWith('Invalid move:')) {
                return null;
            }
            throw e;
        }
        setGame(newGame);
        return updatedMove;
    }

    const undoDisabled = !game.history().length;
    function handleUndo() {
        const newGame = cloneDeep(game);
        // Undo enough to give the player a new move.
        do {
            if (!newGame.undo())
                break;
        } while (newGame.turn() !== playerLetter);
        setGame(newGame);
    }

    function handleFlip() {
        setBoardOrientation(boardOrientation === "white" ? "black" : "white");
    }

    function handleReset() {
        setGame(new Chess());
    }

    function onDrop(sourceSquare, targetSquare, piece) {
        // On promotion, the piece is the new piece.  This is in the form
        // "wQ" for white queen.
        const move = makeAMove({
            from: sourceSquare,
            to: targetSquare,
            promotion: piece[1].toLowerCase(),
        });

        // makeAMove returns the move, or null if it doesn't exist.
        if (move === null) {
            return false;
        } else {
            return true;
        }
    }

    /*eslint no-unused-vars: ["error", {"args": "none"}]*/
    function isDraggablePiece({ piece, sourceSquare }) {
        // The piece is like "wP" for white pawn.
        return piece[0] === playerLetter &&
               playerLetter === game.turn() &&
               !game.isGameOver();
    }

    // FIXME Make a more general way to handle snackbar messages
    // throughout the app.
    const [endOfGameMessage, setEndOfGameMessage] = React.useState(null);
    const [showedEndOfGameMessage, setShowedEndOfGameMessage] =
        React.useState(false);
    if (showedEndOfGameMessage) {
        if (!game.isGameOver()) {
            // We've reverted to a non game-over state, so remove our
            // notes that we've ended the game.
            setEndOfGameMessage(null);
            setShowedEndOfGameMessage(false);
        }
    } else {
        if (game.isGameOver()) {
            setShowedEndOfGameMessage(true);
            setEndOfGameMessage(
                game.isCheckmate() ? "Checkmate" :
                game.isStalemate() ? "Stalemate" :
                game.isInsufficientMaterial() ? "Draw by insufficient material" :
                game.isThreefoldRepetition() ? "Draw by threefold repetition" :
                // I think the only remaining draw is the 50-move rule.
                game.isDraw() ? "Draw" :
                // I don't think this can happen.
                "Game over");
        }
    }
    function handleSnackbarClose(event, reason) {
        if (reason === 'clickaway') {
            return;
        }
        setEndOfGameMessage(null);
    }

    const {ratings, timeControls, dateRange, evaluation} =
          React.useContext(SettingsContext);

    const sfManager = React.useMemo(() => new StockfishManager(), []);
    const stockfishInfo = React.useSyncExternalStore(
        sfManager.subscribe,
        sfManager.getInfo,
        () => {return sfManager.serverInfo;});
    React.useEffect(() => {
        // FIXME Right now, we just stop displaying the eval and
        // sending board updates.  We don't actually stop the current
        // evaluation.
        if (evaluation) {
            const moves = game.history({verbose: true}).map(m => m.lan);
            sfManager.setPosition("startpos moves " + moves.join(" "));
        }
    }, [game, evaluation, sfManager]);
    console.log("Updated info: %o", stockfishInfo);
    const posEval = (
        typeof stockfishInfo === "undefined" ? 0 :
        'mate' in stockfishInfo ? (
            // We use 1/ to distinguish between +/- 0 in a checkmate.
            (1 / stockfishInfo.mate < 0) ? -Infinity : Infinity) :
        'pawns' in stockfishInfo ? stockfishInfo.pawns :
        0);
    const posEvalStr = (
        typeof stockfishInfo === "undefined" ? "" :
        ('mate' in stockfishInfo ? (
            (1 / stockfishInfo.mate < 0) ?
            "M-" + stockfishInfo.mate :
            "M" + stockfishInfo.mate) :
         'pawns' in stockfishInfo ? stockfishInfo.pawns.toFixed(1) :
         ""));
    console.log("Evaluation: %o %o %o", evaluation, posEvalStr, posEval);
    const evaluationSection =
        evaluation ? (
            <Stack direction="row" spacing={1}>
                <Typography>{posEvalStr}</Typography>
                <EvalBar value={posEval} />
            </Stack>) :
        <></>;

    const moveHistory = game.history({verbose: true});
    const queryParams = {
        fen: moveHistory.length ? moveHistory[0].before : game.fen(),
        play: moveHistory.map(x=>x.lan).join(','),
        topGames: 0,
        recentGames: 0,
    };
    if (ratings[0] !== 0 || ratings[1] !== Infinity) {
        const queryRatings = ValidRatings
            .filter(r => (r >= ratings[0] && r < ratings[1]))
            .join(',');
        queryParams.ratings = queryRatings;
    }
    if (dateRange[0] !== MinDate) {
        queryParams.since = dateRange[0];
    }
    if (dateRange[1] !== MaxDate) {
        queryParams.until = dateRange[1];
    }
    queryParams.speeds = timeControls.join(',');
    const {data, status} = useQuery({
        queryKey: [queryParams],
        queryFn: GetOpenings,
        retryDelay: computeRetryDelay,
        staleTime: 24 * 60 * 60 * 1000,
        cacheTime: Infinity,
    });

    const [noMoves, setNoMoves] = React.useState(false);
    if (status === "success") {
        if (playerLetter !== game.turn() &&
            !game.isGameOver()) {
            if (data.moves.length === 0) {
                if (!noMoves)
                    setNoMoves(true);
            } else {
                if (noMoves)
                    setNoMoves(false);
                const explorerMove = randomMove(data);
                // const possibleMoves = game.moves();
                // const randomIndex =
                //     Math.floor(Math.random() * possibleMoves.length);
                // const move = possibleMoves[randomIndex];
                // We use the setTimeout, because if we don't include a redraw
                // before making a new move, we don't get animations.
                setTimeout(() => makeAMove(explorerMove.san), 0);
                //makeAMove(explorerMove.san);
            }
        } else {
            if (noMoves)
                setNoMoves(false);
        }
    }

    const [numFound, setNumFound] = React.useState("");
    if (status === "success") {
        const numFoundInt = data.white + data.draws + data.black;
        const numFoundStr =
            numFoundInt === 0 ? "" :
            numFoundInt === 1 ? "1 game in the database" :
            `${numFoundInt.toLocaleString()} games in the database`;
        if (numFoundStr !== numFound)
            setNumFound(numFoundStr);
    }

    const [opening, setOpening] = React.useState("");
    if (status === "success" && data.opening) {
        const newOpening = `[${data.opening.eco}] ${data.opening.name}`;
        if (newOpening !== opening)
            setOpening(newOpening);
    } else if (game.history().length === 0) {
        const newOpening = "Starting Position";
        if (newOpening !== opening)
            setOpening(newOpening);
    }

    const analysisUrl = `https://lichess.org/analysis/pgn/${encodeURIComponent(game.pgn())}?color=${boardOrientation}`;

    return (
        <Stack spacing={2}
               divider={<Divider orientation="vertical" flexItem />}>
            <Box xs={4}>
                <Paper square elevation={12}>
                    <Chessboard boardOrientation={boardOrientation}
                                isDraggablePiece={isDraggablePiece}
                                position={game.fen()} onPieceDrop={onDrop}
                    />
                </Paper>
                <Stack spacing={2} direction="row" sx={{mt:2}}>
                    <Button variant="contained" disabled={undoDisabled}
                            onClick={handleUndo}>Undo</Button>
                    <Button variant="contained"
                            onClick={handleFlip}>Flip</Button>
                    <Button variant="contained"
                            onClick={handleReset}>Reset</Button>
                </Stack>
                <Collapse in={noMoves}>
                    <Alert severity="info">There are no moves are in
                        the database from this position.</Alert>
                </Collapse>
            </Box>
            {evaluationSection}
            <Box xs={3} sx={{p: 1}}>
                <a href={analysisUrl} target="_blank" rel="noreferrer">
                    Lichess Analysis Board
                </a>
                <Typography>{numFound}</Typography>
                <Divider textAlign="left">Opening</Divider>
                <Typography>{opening}</Typography>
                <Divider textAlign="left">PGN</Divider>
                <Typography>{game.pgn() || "1."}</Typography>
                <Divider textAlign="left">FEN</Divider>
                <Typography>{game.fen()}</Typography>
            </Box>
            <Snackbar open={!!endOfGameMessage} autoHideDuration={6000}
                      onClose={handleSnackbarClose}>
                <Alert severity="info" sx={{ width: '100%' }}
                       onClose={handleSnackbarClose}>
                    {endOfGameMessage}
                </Alert>
            </Snackbar>
        </Stack>
    );
}
