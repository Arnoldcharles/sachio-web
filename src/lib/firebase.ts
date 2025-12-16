import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA59q1Xf0JqGWzNxHh0ORiXUSN5v_hvcwI",
  authDomain: "sachio-mobile-toilets-ed86d.firebaseapp.com",
  databaseURL: "https://sachio-mobile-toilets-ed86d-default-rtdb.firebaseio.com",
  projectId: "sachio-mobile-toilets-ed86d",
  storageBucket: "sachio-mobile-toilets-ed86d.firebasestorage.app",
  messagingSenderId: "1052577492056",
  appId: "1:1052577492056:web:ab73160d1adf6186a4ae2d",
  measurementId: "G-WSZ8JN7WNZ",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);

