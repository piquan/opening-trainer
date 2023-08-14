import { Chess } from 'chess.js'

// The multithreaded versions requires SharedArrayBuffer objects.
// Those require the page to have a certain level of CORS restriction.
//
// https://github.com/lichess-org/stockfish.wasm#requirements
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
//
// These are not set on GitHub Pages, so I'm restricted to single
// threads.  For this application, that's not a big deal, though.
const kEngine = 'stockfish-nnue-16-single.js';

export function StockfishManager() {
    // Overview: The state is maintained as uci (startup), isready
    // (waiting to get to a state where we can send new positions),
    // and run (evaluating or idle).  We maintain the
    // (position, depth) tuple that we sent the engine when we most
    // recently went to the run state (cur*), as well as the most recent
    // requests we got from the UI (new*).  When the UI sends us a new
    // (position, depth) tuple, we send commands to move the engine to
    // the isready state.  When the engine acknowledges that it's ready,
    // then we send the commands to start evaluation, and then copy
    // new* into cur*.
    //
    // We present as an object with four methods: close, setPosDepth,
    // subscribe, and getInfo.  We don't ever use this.* attributes; I
    // was having problems with the methods not getting the correct "this",
    // so just moved to the current setup.
    //
    // The close and setPosDepth are state mutators; they should be called
    // in React effects.  The subscribe method follows the
    // React.useSyncExternalStore convention.  The getInfo method
    // returns the most recent info.

    // Recent versions of webpack give us ways to use webworkers in
    // a packed system; see https://webpack.js.org/guides/web-workers/
    // However, the build environment is sufficiently different from
    // the runtime environment that it doesn't work.  I also doubt
    // it would like being unable to access the wasm or nnue files.
    // Instead, we symlink to the required files as static files,
    // and just load them here.  That also helps with not having
    // useless reloads every time I rebuild.
    const worker = (typeof Worker === "undefined" ? null :
                    new Worker(kEngine));

    // State: uci, isready, run, idle
    let state = 'uci';
    // cur* are what the engine is currently using for its evaluation,
    // while new* are the most recent requests we got from the UI.

    // curMoves is a string with the UCI moves, including the 'startpos'.
    let curPos = null;
    let curEvalDepth = null;
    // These are the values we want to have; we'll send them to Stockfish
    // once it's initialized.
    let newPos = 'startpos';
    let newEvalDepth = 0;
    // sideFactor is 1 if the engine is evaluating white, -1 if
    // black.  This is because eval output is from the current side's
    // POV, while it's presented as + for white and - for black.
    // It's updated when a new "go" command is sent.
    let sideFactor = null;
    // Users subscribe by setting adding callbacks to oninfo.  They
    // also can read the latest info.
    let info = {};
    const oninfo = [];

    function sendCommand (msg) {
        console.debug("[%s] stockfish> %s", state, msg);
        worker.postMessage(msg);
    }

    function handleMessage (msg) {
        console.debug("[%s] stockfish< %s", state, msg);

        // When we get "info" lines, we just handle them without bothering with
        // the state machine.
        const infoMatch = msg.match(/^\s*info\s.*(?:\bdepth\s+(?<depth>\d+))\b.*\bscore\s+(?:mate\s+(?<mate>-?\d+)|cp\s+(?<cp>-?\d+))/);
        if (infoMatch) {
            const newInfo = {};
            if (typeof infoMatch.groups.depth !== "undefined") {
                newInfo.depth = Number.parseInt(infoMatch.groups.depth, 10);
            }
            if (typeof infoMatch.groups.mate !== "undefined") {
                const rawMate = Number.parseInt(infoMatch.groups.mate, 10);
                newInfo.mate = sideFactor * rawMate;
            }
            if (typeof infoMatch.groups.cp !== "undefined") {
                const rawCp = Number.parseInt(infoMatch.groups.cp, 10);
                newInfo.pawns = sideFactor * rawCp * 0.01;
            }
            if (Object.keys(newInfo).length !== 0) {
                info = newInfo;
                oninfo.forEach(c => c(newInfo));
            }
            return;
        }

        if (state === "uci") {
            if (msg !== "uciok") {
                return;
            }
            sendCommand('setoption name Use NNUE value true');
            sendCommand('isready');
            state = 'isready';
        } else if (state === 'isready') {
            // We transition to the 'isready' state when we have new
            // data to send.
            if (msg !== 'readyok') {
                return;
            }
            curPos = newPos;
            curEvalDepth = newEvalDepth;
            if (newEvalDepth > 0) {
                sendCommand("position " + newPos);
                sendCommand(`go depth ${newEvalDepth}`);

                // Parse the position, so we can load it into chess.js
                // to find whose turn it is.  That will be the sideFactor.
                const posMatch = newPos.match(/^\s*(?:(?<startpos>startpos)|fen\s+(?<fen>[^m]+))(?:\s+moves\s+(?<moves>.*))?$/)
                const chess = new Chess();
                if (typeof posMatch.groups.fen !== "undefined") {
                    chess.load(posMatch.groups.fen);
                }
                if (typeof posMatch.groups.moves !== "undefined" &&
                    posMatch.groups.moves.trim() !== "") {
                    const movelist = posMatch.groups.moves.trim().split(/\s+/);
                    movelist.forEach(m => chess.move(m));
                }
                sideFactor = chess.turn() === "w" ? 1 : -1;
            }
            // Even if we're not actually running, we put our state machine
            // in the 'run' state, since our transition table is the same.
            state = 'run';
        } else if (state === "run") {
            // In run state, we don't care about anything other than the info
            // lines we already checked for.
        }
    }

    this.close = function () {
        sendCommand("quit");
    };
    this.setPosDepth = function (position, evalDepth) {
        // The position needs to be what you'd have after a UCI
        // 'position' command, such as 'startpos' or
        // 'fen blah/blah moves e24' or whatever.
        if (position === newPos && evalDepth === newEvalDepth) {
            // We've sent, or arranged to send, this information already.
            // (This may happen on rerenders or something.)
            return;
        }
        newPos = position;
        newEvalDepth = evalDepth;

        if (state === "run") {
            // Even if we've finished the entire eval depth, or haven't sent
            // a "go" (because we're not evaluating), we can still send
            // a "stop" command without problems.
            sendCommand("stop");
        }
        // Make sure that we've gotten to a ready state.  Once we have,
        // the state machine will update it with our new position.
        // Don't send a new isready if we're already in a state that will
        // bring us there.
        if (state !== "uci" && state !== "isready") {
            sendCommand("isready");
            state = "isready";
        }
    };
    this.subscribe = function (callback) {
        oninfo.push(callback);
        return () => {
            const index = oninfo.indexOf(callback);
            if (index > -1) {
                oninfo.splice(index, 1);
            }
        };
    };
    this.getInfo = function () {
        return info;
    };

    // We've now set ourselves, so we can (in the right order) start
    // the worker.
    if (worker !== null) {
        worker.onmessage = (e => handleMessage(e.data));
        sendCommand("uci");
    }
}
