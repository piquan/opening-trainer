import * as React from 'react';
import * as _ from 'lodash-es';
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
const kSfMaxSkill = 20;

export class StockfishManager extends EventTarget {
    // Overview: The state is maintained as uci (startup), isready
    // (waiting to get to a state where we can send new positions),
    // and run (evaluating or idle).  We maintain the most recent
    // requests we got from the UI for the (position, depth) tuple.
    // When we get new versions, we send commands to move the engine to
    // the isready state.  When the engine acknowledges that it's ready,
    // then we send the commands to start evaluation.
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

    #worker = (typeof Worker === "undefined" ? null : new Worker(kEngine));

    // The name is used for debug messages.
    #name = ""

    // State: uci, isready, run, idle
    #state = 'uci';

    // These are the values we want to have; we'll send them to Stockfish
    // once it's initialized, or reports it's ready.
    #newCommands = {position: 'startpos', depth: 0, skill: kSfMaxSkill};

    // sideFactor is 1 if the engine is evaluating white, -1 if
    // black.  This is because eval output is from the current side's
    // POV, while it's presented as + for white and - for black.
    // It's updated when a new "go" command is sent.
    #sideFactor = null;

    // The "info" object gives the evaluation information, which is given
    // in "info" lines.
    //
    // Users can subscribe by setting an addEventListener for the "info"
    // event on this object.  They'll get an event with the info in
    // e.detail.  However, because we're using useSyncExternalStore,
    // our users actually use `subscribe` and `getInfo`.
    #info = {};

    // The bestmove is used when using this Stockfish as an opponent.
    // It indicates that the evaluation is complete, and gives the
    // chosen move.
    #bestmove = null;

    constructor(name) {
        super();
        this.#name = name;
        this.#worker.onmessage = (e => this.#handleMessage(e.data));
        this.#sendCommand("uci");
    }

    #sendCommand (msg) {
        console.debug("[%s] stockfish[%s]> %s", this.#state, this.#name, msg);
        this.#worker?.postMessage(msg);
    }

    #handleMessage (msg) {
        console.debug("[%s] stockfish[%s]< %s", this.#state, this.#name, msg);
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
                newInfo.mate = this.#sideFactor * rawMate;
            }
            if (typeof infoMatch.groups.cp !== "undefined") {
                const rawCp = Number.parseInt(infoMatch.groups.cp, 10);
                newInfo.pawns = this.#sideFactor * rawCp * 0.01;
            }
            if (Object.keys(newInfo).length !== 0) {
                this.#info = newInfo;
                const e = new CustomEvent("info", {detail: newInfo});
                this.dispatchEvent(e);
            }
            return;
        }

        if (this.#state === "uci") {
            if (msg !== "uciok") {
                return;
            }
            this.#sendCommand('setoption name Use NNUE value true');
            this.#sendCommand('isready');
            this.#state = 'isready';
        } else if (this.#state === 'isready') {
            // We transition to the 'isready' state when we have new
            // data to send.
            if (msg !== 'readyok') {
                return;
            }
            const { position, depth, skill } = this.#newCommands;
            if (depth > 0) {
                this.#sendCommand(`setoption name Skill Level value ${skill}`);
                this.#sendCommand(`position ${position}`);
                this.#sendCommand(`go depth ${depth}`);
                // Parse the position, so we can load it into chess.js
                // to find whose turn it is.  That will be the sideFactor.
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
                this.#sideFactor = chess.turn() === "w" ? 1 : -1;
            }
            // Even if we're not actually running, we put our state machine
            // in the 'run' state, since our transition table is the same.
            this.#state = 'run';
        } else if (this.#state === "run") {
            // If we're in the "run" state, we only care about the "bestmove"
            // and "info" lines.  We already checked for the "info" lines.
            // We couldn't check for "bestmove" before, since if we were in
            // "isready" mode trying to send a new position, then we can
            // get a "bestmove" line from the old position before the "stop"
            // completes.  Indeed, a "bestmove" is always supposed to be
            // set in a go->stop transition.
            const bestmoveMatch = msg.match(/^\s*bestmove\s*(?<bestmove>\S+)/);
            if (bestmoveMatch) {
                const bestmove = bestmoveMatch.groups.bestmove;
                this.#bestmove = bestmove;
                const e = new CustomEvent("bestmove", {detail: bestmove});
                this.dispatchEvent(e);
            }
        }
    }

    // Example for "commands":
    // {position: 'startpos', depth: 0, skill: 20}
    // The position needs to be what you'd have after a UCI
    // 'position' command, such as 'startpos' or
    // 'fen blah/blah moves e24' or whatever.
    setCommands(commands) {
        if (_.isEqual(commands, this.#newCommands)) {
            // We've sent, or arranged to send, this information already.
            // (This may happen on rerenders or something.)
            return;
        }
        this.#newCommands = commands;

        if (this.#state === "run") {
            // Even if we've finished the entire eval depth, or haven't sent
            // a "go" (because we're not evaluating), we can still send
            // a "stop" command without problems.
            this.#sendCommand("stop");
        }
        // Make sure that we've gotten to a ready state.  Once we have,
        // the state machine will update it with our new position.
        // Don't send a new isready if we're already in a state that will
        // bring us there.
        if (this.#state !== "uci" && this.#state !== "isready") {
            this.#sendCommand("isready");
            this.#state = "isready";
        }
    }

    // These are defined as arrow functions so that `this` is appropriately
    // set, even if they are passed as function objects to
    // useSyncExternalStore.  Normally, `const a = foo.method;`
    // doesn't retain `this` when `a()` is called.  But with this syntax,
    // it does.
    subscribeInfo = callback => {
        const newcb = e => callback();
        this.addEventListener("info", newcb);
        const unsubscribe = () => this.removeEventListener("info", newcb);
        return unsubscribe;
    }
    getInfo = () => this.#info;

    subscribeBestmove = callback => {
        const newcb = e => callback();
        this.addEventListener("bestmove", newcb);
        const unsubscribe = () => this.removeEventListener("bestmove", newcb);
        return unsubscribe;
    }
    getBestmove = () => this.#bestmove;

    close() {
        this.#sendCommand("quit");
    }
}

export function useStockfishEval({lanHistory, depth}) {
    const mgr = React.useMemo(() => new StockfishManager("eval"), []);
    React.useEffect(() => {
        mgr.setCommands({position: "startpos moves " + lanHistory.join(" "),
                         depth: depth,
                         skill: kSfMaxSkill});
    }, [lanHistory, depth, mgr]);
    const info = React.useSyncExternalStore(mgr.subscribeInfo, mgr.getInfo);
    return info;
}

export function useStockfishOpponent({lanHistory, depth, skill}) {
    const mgr = React.useMemo(() => new StockfishManager("opponent"), []);
    React.useEffect(() => {
        mgr.setCommands({position: "startpos moves " + lanHistory.join(" "),
                         depth: depth,
                         skill: skill});
    }, [lanHistory, depth, skill, mgr]);
    const bestmove = React.useSyncExternalStore(
        mgr.subscribeBestmove, mgr.getBestmove);
    return bestmove;
}
