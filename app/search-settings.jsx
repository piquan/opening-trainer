import { Divider, Slider, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';

import { MinDate, MinRating, MaxDate, MaxRating, NumRatings, ValidRatings } from './utils.jsx';

// Most of this revolves around replacing the lowest and highest values
// with some that are more useful for display, and undoing that when
// we call back up.
const minDisplayedRating =
    ValidRatings[1] - (ValidRatings[2] - ValidRatings[1]);
const maxDisplayedRating = (
    ValidRatings[NumRatings - 2] +
   (ValidRatings[NumRatings - 2] - ValidRatings[NumRatings - 3]));
const displayedRatings = [...ValidRatings];
displayedRatings[0] = minDisplayedRating;
displayedRatings[NumRatings - 1] = maxDisplayedRating;
const ratingsTickMarks = displayedRatings.map(
    x => {return {"value": x, "label": x.toString()}});
ratingsTickMarks[0].label = '<';
ratingsTickMarks[NumRatings - 1].label = '>';

function ratingDisplayedToValid(displayed) {
    if (displayed === minDisplayedRating) {
        return MinRating;
    }
    if (displayed === maxDisplayedRating) {
        return MaxRating;
    }
    return displayed;
}

function RatingsSettings({ratings, setRatings}) {
    const handleChange = (event, newRatings) => {
        if (newRatings[0] === newRatings[1]) {
            // Don't allow empty ranges.
            return;
        }
        setRatings(newRatings.map(ratingDisplayedToValid));
    };

    return <Slider value={ratings} onChange={handleChange}
                   marks={ratingsTickMarks} step={null} disableSwap
                   min={minDisplayedRating} max={maxDisplayedRating} />
}

function TimeControlsSettings({timeControls, setTimeControls}) {
    const handleChange = (event, newTimeControls) => {
        if (newTimeControls.length === 0) {
            // Don't allow empty time control sets
            return;
        }
        setTimeControls(newTimeControls);
    };
    return (
        <ToggleButtonGroup value={timeControls} onChange={handleChange}
                           aria-label="time controls" color="primary"
                           fullWidth>
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
    );
}

function DateRangeSettings({dateRange, setDateRange}) {
    const [since, until] = dateRange;

    const setSince = function(event, newSince) {
        setDateRange([newSince, until]);
    }
    const setUntil = function(event, newUntil) {
        setDateRange([since, newUntil]);
    }

    return (
        <Stack direction="row" sx={{pt: 1}}>
            <DatePicker label="Since" value={since} onChange={setSince}
                        views={['year', 'month']} disableFuture
                        minDate={MinDate} maxDate={until} />
            <DatePicker label="Until" value={until} onChange={setUntil}
                        views={['year', 'month']}
                        minDate={since} maxDate={MaxDate} />
        </Stack>
    );
}

export function SearchSettings(
    {ratings, setRatings, timeControls, setTimeControls,
     dateRange, setDateRange}) {
    return (
        <Stack xs={3}>
            <Typography variant="h5">Search Settings</Typography>
            <Divider textAlign="left" sx={{pt: 2}}>Ratings</Divider>
            <RatingsSettings ratings={ratings} setRatings={setRatings} />
            <Divider textAlign="left" sx={{pt: 2}}>Time Controls</Divider>
            <TimeControlsSettings timeControls={timeControls}
                                  setTimeControls={setTimeControls} />
            <Divider textAlign="left" sx={{pt: 2}}>Date Range</Divider>
            <DateRangeSettings dateRange={dateRange}
                               setDateRange={setDateRange} />
        </Stack>
    );
}
