// createContext doesn't work in SSR, so this is client-side code.
'use client';

import * as React from 'react';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)

export const ValidRatings = [0, 1000, 1200, 1400, 1600, 1800,
                             2000, 2200, 2500, Infinity];
export const NumRatings = ValidRatings.length;
export const MinRating = ValidRatings[0];
export const MaxRating = ValidRatings[NumRatings - 1];
export const MinDate = dayjs(new Date(1952, 0, 1));
export const MaxDate = dayjs(new Date(3000, 11, 1));

export const SettingsContext = React.createContext(null);
export const UpdateSettingsContext = React.createContext(null);

const initialSettings = {
    ratings: [0, 1200],
    timeControls: ["blitz", "rapid", "classical", "correspondence"],
    dateRange: [MinDate, MaxDate],
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
