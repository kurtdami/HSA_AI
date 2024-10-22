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

console.log("Firebase config:", JSON.stringify(firebaseConfig, null, 2));

let app: FirebaseApp | undefined;
let auth: Auth;
let provider: GoogleAuthProvider;
let db: Firestore;
let analytics: Analytics | undefined;

if (!process.env.NEXT_PUBLIC_apiKey) {
  console.error("Firebase API key is missing. Check your .env.local file.");
}

if (typeof window !== 'undefined' && !getApps().length) {
  try {
    if (!firebaseConfig.apiKey) {
      throw new Error("Firebase API key is missing");
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    db = getFirestore(app);
    if (process.env.NEXT_PUBLIC_measurementId) {
      analytics = getAnalytics(app);
    }
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization error", error);
  }
} else {
  console.log("Firebase app already initialized or running on server");
}

export { app, auth, provider, db, analytics };
