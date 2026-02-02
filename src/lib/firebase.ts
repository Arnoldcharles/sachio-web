import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA_c0E_t-mrUyGJQphVXRJBlZ1S3KF24KU",
  authDomain: "sachio-express-1537f.firebaseapp.com",
  databaseURL: "https://sachio-express-1537f-default-rtdb.firebaseio.com",
  projectId: "sachio-express-1537f",
  storageBucket: "sachio-express-1537f.firebasestorage.app",
  messagingSenderId: "89011298329",
  appId: "1:89011298329:web:1cce246dbee98fd3348a88",
  measurementId: "G-2LCP3DC544",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
