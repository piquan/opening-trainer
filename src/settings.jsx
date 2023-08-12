import * as React from 'react';
import PropTypes from 'prop-types';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc)

export const ValidRatings = [0, 1000, 1200, 1400, 1600, 1800,
                             2000, 2200, 2500, Infinity];
export const NumRatings = ValidRatings.length;
export const MinRating = ValidRatings[0];
export const MaxRating = ValidRatings[NumRatings - 1];
export const MinDate = dayjs.utc(new Date(1952, 0, 1));
// The actual default max data is December 3000.  However, on my
// Chromebook, some things max out at 2099, even with the same version of
// the libraries as on thor.
export const MaxDate = dayjs.utc(new Date(2099, 11, 1));

export const SettingsContext = React.createContext(null);
export const UpdateSettingsContext = React.createContext(null);

const defaultSettings = {
    ratings: [0, Infinity],
    timeControls: ["blitz", "rapid", "classical", "correspondence"],
    dateRange: [MinDate, MaxDate],
    evalDepth: 20,
};

function settingsFromString(settingsStr) {
    var settings = {};
    try {
        settings = JSON.parse(settingsStr);
    } catch (e) {
        // If there's a parsing error, just ignore the settings contents.
        console.error("Cannot parse settings string %s.  Error: %o",
                      settingsStr, e);
    }
    // Make sure that whatever we parsed from local storage is really
    // an object.
    if (!(settings instanceof Object)) {
        settings = {};
    }
    if ('dateRange' in settings) {
        // Fix the dateRange; it got changed to an ISO timestamp during the
        // JSON stringification.
        settings.dateRange = settings.dateRange.map(dayjs.utc);
    }
    if ('ratings' in settings) {
        // The Infinity rating gets changed to null in stringification.
        settings.ratings = settings.ratings.map(
            r => r === null ? Infinity : r);
    }
    // Only keep settings that are still part of defaultSettings
    settings = Object.fromEntries(
        Object.entries(settings)
              .filter(([k]) => k in defaultSettings));
    return settings;
}

export function SettingsContexts({children}) {
    // This gets fired if a different window updates the settings.  We
    // rely on the fact that Object.is compares identical strings as equal.
    const [settings, updateSettings] = React.useReducer(
        (oldSettings, newSettings) => {
            return {...oldSettings, ...newSettings};
        },
        null,
        () => {
            let settingStr;
            try {
                settingStr = localStorage.getItem('settings');
            } catch (e) {
                console.error("Cannot load existing settings: %o", e);
                // If there's an error loading from localStorage,
                // just ignore the settings contents.
                return {...defaultSettings};
            }
            if (settingStr === null) {
                return {...defaultSettings};
            }
            return {...defaultSettings, ...settingsFromString(settingStr)};
    });

    // If we have new settings, then update localStorage.
    React.useEffect(() => {
        try {
            localStorage.setItem('settings', JSON.stringify(settings));
        } catch (e) {
            // Catch errors in case the user has localStorage disabled.
            console.warn("Cannot save settings: %o", e);
        }
    }, [settings]);

    // FIXME I haven't found a good way to subscribe to the 'storage' event.
    
    return <SettingsContext.Provider value={settings}>
        <UpdateSettingsContext.Provider value={updateSettings}>
            {children}
        </UpdateSettingsContext.Provider>
    </SettingsContext.Provider>;
}
SettingsContexts.propTypes = {
    children: PropTypes.element,
};
