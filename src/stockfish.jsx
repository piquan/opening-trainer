import { Chess } from 'chess.js'

// The multithreaded versions requires SharedArrayBuffer objects.
// Those require the page to have a certain level of CORS restriction.
//
// https://github.com/lichess-org/stockfish.wasm#requirements
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
//
// These are not set on GitHub Pages, so I'm restricted to single
// threads.  That's not a big deal, though.
const kEngine = 'stockfish-nnue-16-single.js';

// In single-threaded mode, it only seems to respond to "stop" when it
// gets to a depth boundary.  That means that at deep depths, then it
// may not respond quickly.  But we really don't care about doing a lot
// of deep analysis anyway: we're looking for a basic sense of when the
// opening went off the rails.
const kGoDepthCommand = "go depth 10";

export function StockfishManager() {
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

    // State: uci, isready, go, idle
    var state = 'uci';
    // curMoves is a string with the UCI moves, including the 'startpos'.
    var curPos = null;
    // curSideFactor is 1 if the engine is evaluating white, -1 if
    // black.  This is because eval output is from the current side's
    // POV, while it's presented as + for white and - for black.
    var curSideFactor = null;
    // These are the values we want to have; we'll send them to Stockfish
    // once it's initialized.
    var newPos = 'startpos';
    var newSideFactor = 1;
    // Users subscribe by setting adding callbacks to oninfo.  They
    // also can read the latest info.
    var info = {};
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
                newInfo.mate = curSideFactor * rawMate;
            }
            if (typeof infoMatch.groups.cp !== "undefined") {
                const rawCp = Number.parseInt(infoMatch.groups.cp, 10);
                newInfo.pawns = curSideFactor * rawCp * 0.01;
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
            if (msg !== 'readyok') {
                return;
            }
            if (newPos === curPos) {
                // I don't know why we'd send "isready" if we don't have a
                // new position to send.
                console.warn("Stockfish is now idle, for no apparent reason.");
                state = 'idle';
                return;
            }
            sendCommand("position " + newPos);
            curPos = newPos;
            curSideFactor = newSideFactor;
            sendCommand(kGoDepthCommand);
            state = 'go';
        } else if (state === "idle") {
            console.warn("An idle Stockfish is talking to us.");
        } else if (state === "go") {
            // In go state, we don't care about anything other than the info
            // lines we already checked for.
        }
    }

    this.close = function () {
        sendCommand("quit");
    };
    this.setPosition = function (position) {
        // The position needs to be what you'd have after a UCI
        // 'position' command, such as 'startpos' or
        // 'fen blah/blah moves e24' or whatever.
        if (newPos === position) {
            return;
        }
        newPos = position;
        // Parse the position, so we can load it into chess.js to find whose
        // move it is.
        const posMatch = position.match(/^\s*(?:(?<startpos>startpos)|fen\s+(?<fen>[^m]+))(?:\s+moves\s+(?<moves>.*))?$/)
        const chess = new Chess();
        if (typeof posMatch.groups.fen !== "undefined") {
            chess.load(posMatch.groups.fen);
        }
        if (typeof posMatch.groups.moves !== "undefined" &&
            posMatch.groups.moves.trim() !== "") {
            const movelist = posMatch.groups.moves.trim().split(/\s+/);
            movelist.forEach(m => chess.move(m));
        }
        newSideFactor = chess.turn() === "w" ? 1 : -1;
        if (state === "go") {
            sendCommand("stop");
        }
        // Make sure that we've gotten to a ready state.  Once we have,
        // the state machine will update it with our new position.
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
