import * as React from 'react';
import { Alert, Box, Button, Collapse, Divider, Paper, Snackbar, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';

import { useQuery } from '@tanstack/react-query'
import axios from 'axios';
import { Chessboard } from "react-chessboard";

import { MinDate, MaxDate, ValidRatings, SettingsContext } from "./settings";
import { StockfishManager } from "./stockfish";
import { EvalBar } from "./evalbar";
import { useChess } from './use-chess';

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
    throw new Error("Unexpected mismatch picking randomMove");
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
    // doesn't lose all our state.
    const [boardOrientation, setBoardOrientation] = React.useState(() => {
        return fragmentGet("color") === "black" ? "b" : "w";
    });
    const longBoardOrientation = boardOrientation === "b" ? "black" : "white";

    // XXX We're only supposed to use fragmentGet during an effect.  Does
    // this matter?  (We could factor it out of ChessField to the top level!)
    const fragmentPgn = fragmentGet("pgn");
    const [chess, chessDispatch] = useChess({pgn: fragmentPgn});

    // Every time the game changes, update the fragment to include the
    // new state.
    React.useEffect(() => {
        const shortPgn = chess.pgn.replace(/ ?\. ?/g, '.');
        if (shortPgn === "") {
            fragmentDel("pgn");
        } else {
            fragmentSet("pgn", shortPgn);
        }
        if (longBoardOrientation === "white" && shortPgn === "") {
            fragmentDel("color");
        } else {
            fragmentSet("color", longBoardOrientation);
        }
    }, [chess.pgn, longBoardOrientation]);

    function makeAMove(move) {
        const moveObj = chess.testMove(move);
        if (moveObj !== null) {
            chessDispatch({type: 'move', move: move});
            return moveObj;
        } else {
            return null;
        }
    }

    const undoDisabled = chess.history.empty;
    function handleUndo() {
        chessDispatch({type: 'undoToPlayer', player: boardOrientation});
    }

    function handleFlip() {
        setBoardOrientation(boardOrientation === "w" ? "b" : "w");
    }

    function handleReset() {
        chessDispatch({type: 'reset'});
    }

    function handleDrop(sourceSquare, targetSquare, piece) {
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

    // eslint-disable-next-line no-unused-vars
    function isDraggablePiece({ piece, sourceSquare }) {
        // The piece is like "wP" for white pawn.
        return piece[0] === boardOrientation &&
               boardOrientation === chess.turn &&
               !chess.gameOver;
    }

    // FIXME Make a more general way to handle snackbar messages
    // throughout the app.
    const [endOfGameMessage, setEndOfGameMessage] = React.useState(null);
    const [showedEndOfGameMessage, setShowedEndOfGameMessage] =
        React.useState(false);
    if (showedEndOfGameMessage) {
        if (chess.gameOver === null) {
            // We've reverted to a non game-over state, so remove our
            // notes that we've ended the game.
            setEndOfGameMessage(null);
            setShowedEndOfGameMessage(false);
        }
    } else {
        if (chess.gameOver !== null) {
            setShowedEndOfGameMessage(true);
            setEndOfGameMessage(chess.gameOver);
        }
    }
    function handleSnackbarClose(event, reason) {
        if (reason === 'clickaway') {
            return;
        }
        setEndOfGameMessage(null);
    }

    const {ratings, timeControls, dateRange, evalDepth} =
          React.useContext(SettingsContext);

    const sfManager = React.useMemo(() => new StockfishManager(), []);
    const stockfishInfo = React.useSyncExternalStore(
        sfManager.subscribe,
        sfManager.getInfo);
    const lanHistory = chess.history.lan;
    React.useEffect(() => {
        sfManager.setPosDepth("startpos moves " + lanHistory.join(" "),
                              evalDepth);
    }, [lanHistory, evalDepth, sfManager]);
    const evalBar = (
        evalDepth > 0 ?
                    <EvalBar evalInfo={stockfishInfo}
                             boardOrientation={boardOrientation} /> :
        <></>);

    const queryParams = {
        fen: chess.history.empty ? chess.fen : chess.history.obj[0].before,
        play: chess.history.lan.join(','),
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
        queryParams.since = dateRange[0].format('YYYY-MM');
    }
    if (dateRange[1] !== MaxDate) {
        queryParams.until = dateRange[1].format('YYYY-MM');
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
        if (boardOrientation !== chess.turn && !chess.gameOver) {
            if (data.moves.length === 0) {
                if (!noMoves)
                    setNoMoves(true);
            } else {
                if (noMoves)
                    setNoMoves(false);
                const explorerMove = randomMove(data);
                makeAMove(explorerMove.san);
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
    } else if (chess.history.empty) {
        const newOpening = "Starting Position";
        if (newOpening !== opening)
            setOpening(newOpening);
    }

    const analysisUrl = `https://lichess.org/analysis/pgn/${encodeURIComponent(chess.pgn)}?color=${longBoardOrientation}`;

    return (
        <Stack spacing={2}
               divider={<Divider orientation="vertical" flexItem />}>
            <Box xs={4}>
                <Paper square elevation={12}>
                    <Grid container columns={33}>
                        <Grid xs={evalDepth > 0 ? 1 : 0}>
                            {evalBar}
                        </Grid>
                        <Grid xs={evalDepth > 0 ? 32 : 33}>
                            <Chessboard boardOrientation={longBoardOrientation}
                                        isDraggablePiece={isDraggablePiece}
                                        position={chess.fen}
                                        onPieceDrop={handleDrop} />
                        </Grid>
                    </Grid>
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
            <Box xs={3} sx={{p: 1}}>
                <a href={analysisUrl} target="_blank" rel="noreferrer">
                    Lichess Analysis Board
                </a>
                <Typography>{numFound}</Typography>
                <Divider textAlign="left">Opening</Divider>
                <Typography>{opening}</Typography>
                <Divider textAlign="left">PGN</Divider>
                <Typography>{chess.pgn || "1."}</Typography>
                <Divider textAlign="left">FEN</Divider>
                <Typography>{chess.fen}</Typography>
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
