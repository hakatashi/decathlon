import dayjs from 'dayjs';
import type {Timestamp} from 'firebase/firestore';

export const formatTimestamp = (timestamp: Timestamp, format = 'YYYY/MM/DD HH:mm:ss') => (
	dayjs(timestamp.toDate()).format(format)
);
