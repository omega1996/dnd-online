// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBigm60Zwfkys2MI85oKjPCP8joIgNpa4g",
  authDomain: "dnd-online-3e483.firebaseapp.com",
  projectId: "dnd-online-3e483",
  storageBucket: "dnd-online-3e483.firebasestorage.app",
  messagingSenderId: "119081191002",
  appId: "1:119081191002:web:e4420c0eb394f74842fa63",
  measurementId: "G-13PTZH7WZ0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics only in browser environment
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { app, auth, db, analytics };
