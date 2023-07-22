// Much of what we use here doesn't work in SSR (even useState), so
// tell next.js that this is client-only code.
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, Box, Button, Collapse, Divider, Link, Paper, Snackbar, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2'; // Grid version 2
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import axios from 'axios';
import { cloneDeep } from 'lodash-es';
import { Chess } from 'chess.js'
import { Chessboard } from "react-chessboard";

import { MinDate, MaxDate, ValidRatings } from './utils.jsx';
import { SearchSettings } from "./search-settings.jsx";

function GetOpenings({queryKey}) {
    const params = queryKey[0];
    return axios.get("https://explorer.lichess.ovh/lichess",
                     {params: params})
                .then(res => res.data);
}

function computeRetryDelay(attempt, error) {
    if (error.response && error.response.status == 429) {
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

const queryClient = new QueryClient();

export default function ChessField() {
    return (<QueryClientProvider client={queryClient}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ChessFieldQuerying/>
        </LocalizationProvider>
    </QueryClientProvider>);
}

function ChessFieldQuerying() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // We include the PGN and orientation in the query string to allow
    // bookmarking, and moreover, so that browser nav away and back
    // doesn't lose all our state.  We'll later include the db search
    // params in cookies.
    //
    // FIXME Right now, we include this in the query string, but I'd
    // rather have it in the fragment.  That's because each change of
    // the query string invokes a reload from the server, and one that
    // probably breaks CDN caching too.
    const [boardOrientation, setBoardOrientation] = React.useState(() => {
        return searchParams.get("color") === "black" ? "black" : "white";
    });
    const playerLetter = boardOrientation[0];

    const [game, setGame] = React.useState(() => {
        const rv = new Chess();
        if (searchParams && searchParams.has("pgn")) {
            rv.loadPgn(searchParams.get("pgn"));
        }
        return rv;
    });

    const params = new URLSearchParams(
        searchParams === null ? "" : searchParams.toString());
    const pgn = game.pgn().replace(/ ?\. ?/g, '.');
    if (pgn === "") {
        params.delete("pgn");
    } else {
        params.set("pgn", pgn);
    }
    params.set("color", boardOrientation);
    router.replace("?" + params.toString(),
                   {scroll: false, shallow: true});

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
        } while (newGame.turn() != playerLetter);
        setGame(newGame);
    }

    function handleFlip() {
        setBoardOrientation(boardOrientation == "white" ? "black" : "white");
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

    function isDraggablePiece({ piece, sourceSquare }) {
        // The piece is like "wP" for white pawn.
        return piece[0] === playerLetter &&
               playerLetter === game.turn() &&
               !game.isGameOver();
    }

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
    };

    const [ratings, setRatings] = React.useState(() =>
        [0, 1200]);
    const [timeControls, setTimeControls] = React.useState(() =>
        ["blitz", "rapid", "classical", "correspondence"]);
    const [dateRange, setDateRange] = React.useState(() =>
        [MinDate, MaxDate]);

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
    queryParams.speeds = timeControls.join(',');
    const {data, status, error} = useQuery({
        queryKey: [queryParams],
        queryFn: GetOpenings,
        retryDelay: computeRetryDelay,
        staleTime: 24 * 60 * 60 * 1000,
        cacheTime: Infinity,
    });

    const [noMoves, setNoMoves] = React.useState(false);
    if (status == "success") {
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
    if (status == "success") {
        const numFoundInt = data.white + data.draws + data.black;
        const numFoundStr =
            numFoundInt === 0 ? "" :
            numFoundInt === 1 ? "1 game in the database" :
            `${numFoundInt.toLocaleString()} games in the database`;
        if (numFoundStr != numFound)
            setNumFound(numFoundStr);
    }

    const [opening, setOpening] = React.useState("");
    if (status == "success" && data.opening) {
        const newOpening = `[${data.opening.eco}] ${data.opening.name}`;
        if (newOpening != opening)
            setOpening(newOpening);
    } else if (game.history().length === 0) {
        const newOpening = "Starting Position";
        if (newOpening != opening)
            setOpening(newOpening);
    }

    const analysisUrl = `https://lichess.org/analysis/pgn/${encodeURIComponent(game.pgn())}?color=${boardOrientation}`;

    return (<>
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
                    <Button variant="contained" onClick={handleFlip}>Flip</Button>
                    <Button variant="contained" onClick={handleReset}>Reset</Button>
                </Stack>
                <Collapse in={noMoves}>
                    <Alert severity="info">There are no moves are in
                        the database from this position.</Alert>
                </Collapse>
            </Box>
            <Box xs={3} sx={{p: 1}}>
                <a href={analysisUrl} target="_blank" rel="noopener">
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
        </Stack>
        <SearchSettings ratings={ratings} setRatings={setRatings}
                        timeControls={timeControls}
                        setTimeControls={setTimeControls}
                        dateRange={dateRange}
                        setDateRange={setDateRange} />
        <Snackbar open={!!endOfGameMessage} autoHideDuration={6000}
                  onClose={handleSnackbarClose}>
            <Alert severity="info" sx={{ width: '100%' }}
                   onClose={handleSnackbarClose}>
                {endOfGameMessage}
            </Alert>
        </Snackbar>
    </>);
}
