import * as React from 'react';
import { Alert, Box, Button, Collapse, Divider, Link, Paper, Snackbar, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';

import { Chessboard } from "react-chessboard";

import { useLichess } from "./lichess";
import { useStockfishEval, useStockfishOpponent } from "./stockfish";
import { EvalBar } from "./evalbar";
import { useChess } from './use-chess';
import { SettingsContext } from "./settings";

const kStartFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
    usp.sort();  // Put the pgn at the end for easy editing
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

    const {evalDepth} = React.useContext(SettingsContext);

    const stockfishInfo = useStockfishEval({lanHistory: chess.history.lan,
                                            depth: evalDepth});
    const evalBar = (
        evalDepth > 0 ?
                    <EvalBar evalInfo={stockfishInfo}
                             boardOrientation={boardOrientation} /> :
        <></>);

    const analysisUrl = `https://lichess.org/analysis/pgn/${encodeURIComponent(chess.pgn)}?color=${longBoardOrientation}`;

    const practiceUrlParams = new URLSearchParams({
        color: longBoardOrientation,
        fen: kStartFen,
        is960: "false",
        moveList: chess.history.lan.join(' '),
    }).toString();
    const practiceUrl = new URL(`https://www.chess.com/practice/custom?${practiceUrlParams}`).href;

    const {status, noMoves, numFound, opening, chosenMove} =
          useLichess({chess});
    const numFoundStr =
          !numFound ? "" :
          numFound === 1 ? "1 game in the database" :
          `${numFound.toLocaleString()} games in the database`;

    // We disable Stockfish when it's not its turn by setting the depth to 0.
    // XXX Disable it when that's not the opponent we're using.
    const opponentDepth =
          boardOrientation !== chess.turn && !chess.gameOver ? 3 : 0;
    const bestmove = useStockfishOpponent({lanHistory: chess.history.lan,
                                           depth: opponentDepth, skill: 0});

    // This chooses between the two opponent types.
    const opponentMove = false ? chosenMove : bestmove;

    React.useEffect(() => {
        if (boardOrientation !== chess.turn && !chess.gameOver && bestmove) {
            makeAMove(bestmove);
        }
    }, [boardOrientation, chess.turn, chess.gameOver, bestmove]);

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
                <Box>
                    <Link href={analysisUrl} target="_blank" rel="noreferrer">
                        Lichess Analysis Board
                    </Link>
                    <Link href={practiceUrl} target="_blank" rel="noreferrer" sx={{ml: 2}}>
                        Practice on chess.com
                    </Link>
                </Box>
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
