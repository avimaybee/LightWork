// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyA3XTaqST2wp7JcJyqaRId7Rn8Hhg9lzJY",
    authDomain: "light-work-auth.firebaseapp.com",
    projectId: "light-work-auth",
    storageBucket: "light-work-auth.firebasestorage.app",
    messagingSenderId: "260072821414",
    appId: "1:260072821414:web:c6006db2d005c6a3825a67",
    measurementId: "G-9JE03TM9FL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = getAnalytics(app);
