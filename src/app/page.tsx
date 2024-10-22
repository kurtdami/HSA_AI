'use client'
import React, { useEffect, useState } from 'react';
import { auth, provider } from './firebase';
import { signInWithPopup, getRedirectResult, Auth, GoogleAuthProvider, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from './authcontext';
import { UserIcon } from '@heroicons/react/16/solid';

const HomePage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        if (!auth) {
          console.error("Auth is not initialized");
          setLoading(false);
          return;
        }
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Sign-in successful", result.user);
          router.push('/expenses');
        } else if (user) {
          console.log("User already signed in", user);
          router.push('/expenses');
        }
      } catch (error) {
        console.error("Error handling redirect result:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [user, router]);

  const signInWithGoogle = async () => {
    try {
      if (!auth || !provider) {
        console.error("Firebase auth is not initialized", { auth, provider });
        return;
      }
      const result = await signInWithPopup(auth, provider);
      console.log("Sign-in successful", result.user);
      router.push('/expenses');
    } catch (error) {
      console.error("Error initiating sign-in:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <div>Redirecting to expenses...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-r from-slate-400 via-slate-600 to-slate-800 items-center justify-center">
      <div className="flex flex-col items-center justify-center w-full lg:w-1/2 p-6">
        <div className="mb-8 flex flex-col items-center">
          <h1 className="text-white text-3xl font-bold mt-4">Welcome to HSA Expense Tracker</h1>
        </div>
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <p className="text-black text-center mb-6">Please sign in to manage your HSA expenses.</p>
          <button
            onClick={signInWithGoogle}
            className="flex items-center bg-blue-500 text-white py-3 px-6 rounded-lg shadow-lg hover:bg-blue-600 transition duration-300 mx-auto"
          >
            <UserIcon className="mr-2 h-6 w-6" />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
