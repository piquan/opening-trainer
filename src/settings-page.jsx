import * as React from 'react';

import { Divider, Input, Slider, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import Grid from '@mui/material/Unstable_Grid2';

import { SettingsContext, UpdateSettingsContext, ValidRatings, NumRatings, MinRating, MaxRating, MinDate, MaxDate } from './settings';

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

function EvalDepthSetting() {
    const settings = React.useContext(SettingsContext);
    const evalDepth = settings.evalDepth;
    const updateSettings = React.useContext(UpdateSettingsContext);
    const updateEvalDepth = (newValue) =>
          updateSettings({evalDepth: newValue});

    const handleSliderChange = (e, newValue) => updateEvalDepth(newValue);
    const handleInputChange = e => updateEvalDepth(Number(e.target.value));

    return <Grid container spacing={2} alignItems="center">
               <Grid xs>
                   <Slider value={evalDepth}
                           onChange={handleSliderChange}
                           step={1} min={0} max={30}
                           valueLabelDisplay="auto" />
               </Grid>
               <Grid>
                   <Input value={evalDepth} size="small"
                          inputProps={{step:1, min:0, max:30, type: 'number'}}
                          onChange={handleInputChange} />
               </Grid>
           </Grid>;
}

function RatingsSettings() {
    const settings = React.useContext(SettingsContext);
    const updateSettings = React.useContext(UpdateSettingsContext);
    const handleChange = (event, newRatings) => {
        if (newRatings[0] === newRatings[1]) {
            // Don't allow empty ranges.
            return;
        }
        updateSettings({ratings: newRatings.map(ratingDisplayedToValid)});
    };

    return <Slider value={settings.ratings} onChange={handleChange}
                   marks={ratingsTickMarks} step={null} disableSwap
                   min={minDisplayedRating} max={maxDisplayedRating} />
}

function TimeControlsSettings() {
    const settings = React.useContext(SettingsContext);
    const updateSettings = React.useContext(UpdateSettingsContext);
    const handleChange = (event, newTimeControls) => {
        if (newTimeControls.length === 0) {
            // Don't allow empty time control sets
            return;
        }
        updateSettings({timeControls: newTimeControls});
    };
    return (
        <ToggleButtonGroup value={settings.timeControls} onChange={handleChange}
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

function DateRangeSettings() {
    const settings = React.useContext(SettingsContext);
    const updateSettings = React.useContext(UpdateSettingsContext);
    const [since, until] = settings.dateRange;

    const handleSince = function(newSince) {
        updateSettings({dateRange: [newSince, until]});
    }
    const handleUntil = function(newUntil) {
        updateSettings({dateRange: [since, newUntil]});
    }

    return (
        <Stack direction="row" sx={{pt: 1}}>
            <DatePicker label="Since" value={since} onChange={handleSince}
                        views={['year', 'month']} disableFuture
                        minDate={MinDate} maxDate={until} />
            <DatePicker label="Until" value={until} onChange={handleUntil}
                        views={['year', 'month']}
                        minDate={since} maxDate={MaxDate} />
        </Stack>
    );
}

export function SearchSettings() {
    return (
        <Stack xs={3}>
            <Typography variant="h5">App Settings</Typography>
            <Divider textAlign="left" sx={{pt: 2}}>Eval Depth</Divider>
            <EvalDepthSetting/>
            <Typography variant="h5">Search Settings</Typography>
            <Divider textAlign="left" sx={{pt: 2}}>Ratings</Divider>
            <RatingsSettings />
            <Divider textAlign="left" sx={{pt: 2}}>Time Controls</Divider>
            <TimeControlsSettings />
            <Divider textAlign="left" sx={{pt: 2}}>Date Range</Divider>
            <DateRangeSettings />
        </Stack>
    );
}
