// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBx_b6K3gzjsXvlSQW942I5U1hRrlsS_Ko",
  authDomain: "agrisense-c1141.firebaseapp.com",
  projectId: "agrisense-c1141",
  storageBucket: "agrisense-c1141.firebasestorage.app",
  messagingSenderId: "226269682903",
  appId: "1:226269682903:web:668955f91b904d57846492",
  measurementId: "G-LJDG0TL27B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);