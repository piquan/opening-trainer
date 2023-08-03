import * as React from 'react';
import PropTypes from 'prop-types';

import dayjs from 'dayjs';

export const ValidRatings = [0, 1000, 1200, 1400, 1600, 1800,
                             2000, 2200, 2500, Infinity];
export const NumRatings = ValidRatings.length;
export const MinRating = ValidRatings[0];
export const MaxRating = ValidRatings[NumRatings - 1];
export const MinDate = dayjs(new Date(1952, 0, 1));
// The actual default max data is December 3000.  However, on my
// Chromebook, some things max out at 2099, even with the same version of
// the libraries as on thor.
export const MaxDate = dayjs(new Date(2099, 11, 1));

export const SettingsContext = React.createContext(null);
export const UpdateSettingsContext = React.createContext(null);

const initialSettings = {
    ratings: [0, 1200],
    timeControls: ["blitz", "rapid", "classical", "correspondence"],
    dateRange: [MinDate, MaxDate],
    evaluation: true,
};

export function SettingsContexts({children}) {
    const [settings, updateSettings] = React.useReducer(
        (oldSettings, newSettings) => Object.assign(
            {}, oldSettings, newSettings),
        initialSettings,
    )
    return <SettingsContext.Provider value={settings}>
               <UpdateSettingsContext.Provider value={updateSettings}>
                   {children}
               </UpdateSettingsContext.Provider>
           </SettingsContext.Provider>;
}
SettingsContexts.propTypes = {
    children: PropTypes.element,
};
