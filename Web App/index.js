import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore"; 

const firebaseConfig = { ... };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Writing data
async function saveData() {
  await addDoc(collection(db, "sensors"), {
    sensorName: "Temperature",
    value: 24.5,
    timestamp: new Date()
  });
}

// Reading data
async function readData() {
  const querySnapshot = await getDocs(collection(db, "sensors"));
  querySnapshot.forEach(doc => {
    console.log(doc.id, " => ", doc.data());
  });
}

saveData().then(() => readData());
