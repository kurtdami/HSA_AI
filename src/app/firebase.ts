import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { 
  getAuth as getFirebaseAuth, 
  GoogleAuthProvider, 
  Auth, 
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';

import { FirebaseConfig } from '../types/auth';

import { getFirestore, Firestore } from "firebase/firestore";
import { getAnalytics, Analytics } from "firebase/analytics";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let analytics: Analytics | undefined;
let provider: GoogleAuthProvider | null = null;

export async function initializeFirebase(config: FirebaseConfig) {
  // Initialize provider outside the if(!app) block since it needs to be set every time
  provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  if (!app) {
    try {
      app = initializeApp(config);
      auth = getFirebaseAuth(app);
      db = getFirestore(app);
      
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
        analytics = getAnalytics(app);
      }

      // Set persistence immediately
      await setPersistence(auth, browserLocalPersistence);
      console.log('Firebase initialized successfully');
      console.log('Firebase provider initialized successfully');

      // Ensure the state check is after all initializations
      console.log('Final state check:', {
        hasApp: !!app,
        hasAuth: !!auth,
        hasProvider: !!provider,
        hasDb: !!db
      });
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  // Ensure this check is after the provider initialization
  if (!auth || !provider || !db) {
    console.error('Pre-return state check failed:', {
      hasApp: !!app,
      hasAuth: !!auth,
      hasProvider: !!provider,
      hasDb: !!db,
      // Add actual values for debugging
      authType: auth?.constructor?.name,
      providerType: provider?.constructor?.name,
      dbType: db?.constructor?.name
    });
    throw new Error('Firebase initialization failed');
  }

  return { app, auth, provider, db, analytics };
}

// Export initialized instances for convenience, but they might be null initially
export { app, auth, provider, db, analytics };