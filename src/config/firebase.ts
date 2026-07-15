import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
const apiKey = (rawApiKey && !rawApiKey.startsWith('INSERIR')) ? rawApiKey : "AIzaSyAzR9UQyV0xIwYgU9xoTuiEfqwhIiDvIrU";

const rawAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '';
const authDomain = (rawAuthDomain && !rawAuthDomain.startsWith('INSERIR')) ? rawAuthDomain : "deposito-bebidas-delivery.firebaseapp.com";

const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
const projectId = (rawProjectId && !rawProjectId.startsWith('INSERIR')) ? rawProjectId : "deposito-bebidas-delivery";

const rawStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';
const storageBucket = (rawStorageBucket && !rawStorageBucket.startsWith('INSERIR')) ? rawStorageBucket : "deposito-bebidas-delivery.firebasestorage.app";

const rawSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
const messagingSenderId = (rawSenderId && !rawSenderId.startsWith('INSERIR')) ? rawSenderId : "606684848873";

const rawAppId = import.meta.env.VITE_FIREBASE_APP_ID || '';
const appId = (rawAppId && !rawAppId.startsWith('INSERIR')) ? rawAppId : "1:606684848873:web:e1cb322dd81144026da6a1";

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

