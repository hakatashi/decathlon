import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

initializeApp();
export default getFirestore();
