import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';

initializeApp();

export const db = getFirestore();
export const storage = getStorage();
