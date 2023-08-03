import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';

import styles from './evalbar.module.css';

export function EvalBar({value}) {
    const separator =
        (value === Infinity) ? 0 :
        (value === -Infinity) ? 8 :
        (value <= -4) ? 0.25 :
        (value >= 4) ? 7.75 :
        value + 4;
    const barStyle = {
        scale: `${separator} 1`,
    };

    const theme = useTheme();

    // We say the viewbox is 800x20, but we're actually contained in a
    // Stack.  That will scale us to fit the space available horizontally
    // and the adjacent typography vertically, so our viewBox is really
    // very much just notional.
    //
    // This SVG is almost entirely static.  The only thing that's dynamic
    // is the style being passed to the white bar.  The reason we pass that
    // as a style that scales the box instead of as a width is so that
    // the CSS transition can animate the changes.
    return (
        <svg viewBox="0 0 800 20" preserveAspectRatio="none" width="100%">
            <rect x="0" y="0" width="100%" height="100%"
                  stroke="none" fill="black" />
            <rect x="0" y="0" width="100" height="100%" fill="white"
                  style={barStyle} className={styles.EvalBarInnerBar}  />
            <line x1="100" y1="0" x2="100" y2="10"
                  stroke={theme.palette.primary.main} strokeWidth="2px" />
            <line x1="200" y1="0" x2="200" y2="10"
                  stroke={theme.palette.primary.main} strokeWidth="2px" />
            <line x1="300" y1="0" x2="300" y2="10"
                  stroke={theme.palette.primary.main} strokeWidth="2px" />
            <line x1="400" y1="0" x2="400" y2="20"
                  stroke={theme.palette.primary.main} strokeWidth="2px" />
            <line x1="500" y1="0" x2="500" y2="10"
                  stroke={theme.palette.primary.main} strokeWidth="2px" />
            <line x1="600" y1="0" x2="600" y2="10"
                  stroke={theme.palette.primary.main} strokeWidth="2px" />
            <line x1="700" y1="0" x2="700" y2="10"
                  stroke={theme.palette.primary.main} strokeWidth="2px" />
            <rect x="1" y="0" width="798" height="20" fill="none"
                  strokeWidth="2px"
                  stroke={theme.palette.primary.main} />
        </svg>);
}
EvalBar.propTypes = {
    value: PropTypes.number.isRequired,
};
