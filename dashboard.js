import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXCrhc36mChTf77Ki2FER_z-2Ti0NPQ3A",
  authDomain: "arkas-scan-analyses.firebaseapp.com",
  projectId: "arkas-scan-analyses",
  storageBucket: "arkas-scan-analyses.firebasestorage.app",
  messagingSenderId: "843762248238",
  appId: "1:843762248238:web:43c9900b57b26671b5cdb7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Vérifier si l'utilisateur est connecté
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('user-email').textContent = user.email;
  } else {
    // Rediriger vers la page de connexion si non authentifié
    window.location.href = "index.html";
  }
});

// Déconnexion
document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});

// Gestion du chargement de l'image
const chartFileInput = document.getElementById('chart-file');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');

chartFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      imagePreview.src = event.target.result;
      previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
});
