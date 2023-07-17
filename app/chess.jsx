// The chessboard doesn't work with SSR, so this is a client component.
'use client';

import * as React from 'react';
import {Link, Collapse, Slider, Tooltip, Alert, Snackbar, Button, Box, Divider, Typography, ToggleButtonGroup, ToggleButton, Paper, Stack} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2'; // Grid version 2
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)
import { cloneDeep } from 'lodash-es';
import { Chess } from 'chess.js'
import { Chessboard } from "react-chessboard";

const ValidRatings = [0, 1000, 1200, 1400, 1600, 1800,
                      2000, 2200, 2500, Infinity];
const MinDate = dayjs(new Date(1952, 0, 1));
const MaxDate = dayjs(new Date(3000, 11, 1));

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
    const [boardOrientation, setBoardOrientation] = React.useState('white');
    const playerLetter = boardOrientation[0];
    
    const [game, setGame] = React.useState(() => new Chess());

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

    const [ratings, setRatings] = React.useState(() => [800, 1200]);
    const handleRatings = (event, newRatings) => {
        setRatings(newRatings);
    };
    const ratingsMarks =
        [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500, 2800].map(
            x => {return {"value": x, "label": x.toString()}});
    ratingsMarks[0].label = '<';
    ratingsMarks[ratingsMarks.length - 1].label = '>';
    const minRating = ratings[0] == 800 ? 0 : ratings[0];
    const maxRating = ratings[0] == 2800 ? Infinity : ratings[1];

    const [timeControls, setTimeControls] = React.useState(() =>
        ["blitz", "rapid", "classical", "correspondence"]);
    const handleTimeControls = (event, newTimeControls) => {
        setTimeControls(newTimeControls);
    };

    const [since, setSince] = React.useState(MinDate);
    const [until, setUntil] = React.useState(MaxDate);

    const history = game.history({verbose: true});
    const queryParams = {
        fen: history.length ? history[0].before : game.fen(),
        play: history.map(x=>x.lan).join(','),
        topGames: 0,
        recentGames: 0,
    };
    if (minRating !== 0 || maxRating !== Infinity) {
        const queryRatings = ValidRatings
            .filter(r => (r >= minRating && r < maxRating))
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
                <Link href={analysisUrl}>Lichess Analysis Board</Link>
                <Typography>{numFound}</Typography>
                <Divider textAlign="left">Opening</Divider>
                <Typography>{opening}</Typography>
                <Divider textAlign="left">PGN</Divider>
                <Typography>{game.pgn() || "1."}</Typography>
                <Divider textAlign="left">FEN</Divider>
                <Typography>{game.fen()}</Typography>
            </Box>
            <Stack xs={3}>
                <Typography variant="h5">Search Settings</Typography>
                <Divider textAlign="left" sx={{pt: 2}}>Ratings</Divider>
                <Slider value={ratings} onChange={handleRatings} step={null}
                        marks={ratingsMarks} min={800} max={2800}
                        disableSwap/>
                <Divider textAlign="left" sx={{pt: 2}}>Time Controls</Divider>
                <ToggleButtonGroup value={timeControls}
                                   onChange={handleTimeControls}
                                   aria-label="time controls"
                                   color="primary" fullWidth>
                    <ToggleButton value="ultraBullet">
                        <Tooltip arrow title="Under 30 seconds">
                            <Typography>UltraBullet</Typography>
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="bullet">
                        <Tooltip arrow title="30 seconds &ndash; 3 minutes">
                            <Typography>Bullet</Typography>
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="blitz">
                        <Tooltip arrow title="3 &ndash; 8 minutes">
                            <Typography>Blitz</Typography>
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="rapid">
                        <Tooltip arrow title="8 &ndash; 25 minutes">
                            <Typography>Rapid</Typography>
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="classical">
                        <Tooltip arrow title="Over 25 minutes">
                            <Typography>Classical</Typography>
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="correspondence">
                        <Tooltip arrow title="Days">
                            <Typography>Correspondence</Typography>
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
                <Divider textAlign="left" sx={{pt: 2}}>Date Range</Divider>
                <Stack direction="row" sx={{pt: 1}}>
                    <DatePicker label="Since" value={since} onChange={setSince}
                                views={['year', 'month']} disableFuture
                                minDate={MinDate} maxDate={until} />
                    <DatePicker label="Until" value={until} onChange={setUntil}
                                views={['year', 'month']}
                                minDate={since} maxDate={MaxDate} />
                </Stack>
            </Stack>
        </Stack>
        <Snackbar open={!!endOfGameMessage} autoHideDuration={6000}
                  onClose={handleSnackbarClose}>
            <Alert severity="info" sx={{ width: '100%' }}
                   onClose={handleSnackbarClose}>
                {endOfGameMessage}
            </Alert>
        </Snackbar>
    </>);
}
