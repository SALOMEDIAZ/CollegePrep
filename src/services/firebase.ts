import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDRo65WY6UkjSPjyYzkUHV0lUmK-6vTI9o",
  authDomain: "collegeprep-433f2.firebaseapp.com",
  projectId: "collegeprep-433f2",
  storageBucket: "collegeprep-433f2.firebasestorage.app",
  messagingSenderId: "482320266458",
  appId: "1:482320266458:web:1a90568daa0740923821e3",
  measurementId: "G-TJ5L4EYQ1Q",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
