import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, limit } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8",
  authDomain: "dedra-mlm.firebaseapp.com",
  projectId: "dedra-mlm",
  storageBucket: "dedra-mlm.firebasestorage.app",
  messagingSenderId: "990762022325",
  appId: "1:990762022325:web:1b238ef6eca4ffb4b795fc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("Fetching products...");
  try {
    const snap = await getDocs(query(collection(db, 'products'), limit(1)));
    console.log("Products snap size:", snap.size);
  } catch (e) {
    console.error("Error fetching products:", e);
  }
}
test();
