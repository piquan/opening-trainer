import * as React from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query'

import { MinDate, MaxDate, ValidRatings, SettingsContext } from "./settings";

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

export function useLichess({chess}) {
    const {ratings, timeControls, dateRange, evalDepth} =
          React.useContext(SettingsContext);

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
        gcTime: 15 * 60 * 1000,
    });

    const success = (status === "success");

    const noMoves = (success && data.moves.length === 0);

    const [chosenMove, setChosenMove] = React.useState(null);
    React.useEffect(() => {
        if (!success)
            return;
        if (noMoves)
            return;
        setChosenMove(randomMove(data));
    }, [success, noMoves, data]);

    const numFound = (success ?
                      data.white + data.draws + data.black :
                      null);

    const opening = (chess.history.empty ? "Starting Position" :
                     !success ? "" :
                     !data.opening ? "" :
                     `[${data.opening.eco}] ${data.opening.name}`);

    return { status, noMoves, numFound, opening, chosenMove };
}
