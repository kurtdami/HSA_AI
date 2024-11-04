import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from "firebase/firestore";
import { getAnalytics, Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_apiKey,
  authDomain: process.env.NEXT_PUBLIC_authDomain,
  projectId: process.env.NEXT_PUBLIC_projectId,
  storageBucket: process.env.NEXT_PUBLIC_storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_messagingSenderId,
  appId: process.env.NEXT_PUBLIC_appId,
  measurementId: process.env.NEXT_PUBLIC_measurementId
};

// Add error handling and initialization checks
const initializeFirebase = () => {
  if (typeof window === 'undefined') return null;

  try {
    // Check if all required config values are present
    const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
    const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
    
    if (missingKeys.length > 0) {
      throw new Error(`Missing required Firebase config keys: ${missingKeys.join(', ')}`);
    }

    if (!getApps().length) {
      return initializeApp(firebaseConfig);
    }
    return getApps()[0];
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return null;
  }
};

const app = initializeFirebase();
const auth = app ? getAuth(app) : undefined;
const provider = new GoogleAuthProvider();
const db = app ? getFirestore(app) : undefined;
const analytics = app && process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_measurementId 
  ? getAnalytics(app) 
  : undefined;

export { app, auth, provider, db, analytics };
