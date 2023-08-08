import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';

import styles from './evalbar.module.css';

export function EvalBar({value, boardOrientation}) {
    const separator =
        (value === Infinity) ? 0 :
        (value === -Infinity) ? 8 :
        (value <= -4) ? 0.25 :
        (value >= 4) ? 7.75 :
        4 - value;
    const barStyle = {
        scale: `1 ${separator}`,
    };

    const evalFmt =
          (value === Infinity) ? "+M" :
          (value === -Infinity) ? "-M" :
          (value <= -10) ? value.toFixed(0) :
          (value >= 10) ? "+" + value.toFixed(0) :
          (value < 0) ? value.toFixed(1) :
          "+" + value.toFixed(1);

    const theme = useTheme();

    const barTransform =
          (boardOrientation === "white" ? "none" :
           "translate(0 480) scale(1 -1)");

    // We say the viewbox is 30x480 (the approximate size), but we're
    // actually contained in a Stack.  That will scale us to fit the
    // space available horizontally and the adjacent typography
    // vertically, so our viewBox is really very much just notional.
    //
    // This SVG is almost entirely static.  The only thing that's dynamic
    // is the style being passed to the white bar.  The reason we pass that
    // as a style that scales the box instead of as a width is so that
    // the CSS transition can animate the changes.
    return (
        <svg viewBox="0 0 15 480" preserveAspectRatio="none" width="100%">
            <rect x="0" y="0" width="100%" height="100%"
                  stroke="none" fill="white" />
            <g transform={barTransform}>
                <rect x="0" y="0" width="100%" height="60" fill="black"
                      style={barStyle} className={styles.EvalBarInnerBar} />
            </g>
            <line x1="0" y1="60" x2="5" y2="60"
                  stroke={theme.palette.primary.main} />
            <line x1="0" y1="120" x2="5" y2="120"
                  stroke={theme.palette.primary.main} />
            <line x1="0" y1="180" x2="5" y2="180"
                  stroke={theme.palette.primary.main} />
            <line x1="0" y1="240" x2="10" y2="240"
                  stroke={theme.palette.primary.main} />
            <line x1="0" y1="300" x2="5" y2="300"
                  stroke={theme.palette.primary.main} />
            <line x1="0" y1="360" x2="5" y2="360"
                  stroke={theme.palette.primary.main} />
            <line x1="0" y1="420" x2="5" y2="420"
                  stroke={theme.palette.primary.main} />
            <text x="2" y="475" font-size="6px" stroke="none"
                  fill={theme.palette.primary.main}>
                {evalFmt}
            </text>
            <rect x="0" y="0" width="15" height="480" fill="none"
                  stroke={theme.palette.primary.main} />
        </svg>);
}
EvalBar.propTypes = {
    value: PropTypes.number.isRequired,
};
