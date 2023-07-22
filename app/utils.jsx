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
