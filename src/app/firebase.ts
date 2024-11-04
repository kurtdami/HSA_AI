import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth as getFirebaseAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
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

// Initialize Firebase only on client side
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | undefined;
const provider = new GoogleAuthProvider();

// Initialize Firebase
if (typeof window !== 'undefined') {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    } else {
      app = getApps()[0];
    }

    // Initialize services
    auth = getFirebaseAuth(app);
    db = getFirestore(app);
    
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_measurementId) {
      analytics = getAnalytics(app);
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw new Error('Failed to initialize Firebase');
  }
} else {
  // Provide mock implementations for server-side
  const mockApp = {} as FirebaseApp;
  const mockAuth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
  } as unknown as Auth;
  const mockDb = {} as Firestore;
  
  app = mockApp;
  auth = mockAuth;
  db = mockDb;
}

export { app, auth, provider, db, analytics };
