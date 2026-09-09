import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXCrhc36mChTf77Ki2FER_z-2Ti0NPQ3A",
  authDomain: "arkas-scan-analyses.firebaseapp.com",
  projectId: "arkas-scan-analyses",
  storageBucket: "arkas-scan-analyses.firebasestorage.app",
  messagingSenderId: "843762248238",
  appId: "1:843762248238:web:43c9908b57b26671b5cdbf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let isSignUpMode = false;

const loginForm = document.querySelector('.login-form');
const formSubtitle = document.getElementById('form-subtitle');
const submitBtn = document.getElementById('submit-btn');
const toggleModeBtn = document.getElementById('toggle-mode');
const toggleText = document.getElementById('toggle-text');
const errorMessage = document.getElementById('error-message');

if (toggleModeBtn) {
  toggleModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    if (errorMessage) errorMessage.style.display = 'none';

    if (isSignUpMode) {
      if (formSubtitle) formSubtitle.textContent = "Créez votre compte Arkas Scan Analyses";
      if (submitBtn) submitBtn.textContent = "S'inscrire";
      if (toggleText) toggleText.childNodes[0].nodeValue = "Vous avez déjà un compte ? ";
      toggleModeBtn.textContent = "Se connecter";
    } else {
      if (formSubtitle) formSubtitle.textContent = "Connectez-vous pour accéder à vos analyses SMC";
      if (submitBtn) submitBtn.textContent = "Se connecter";
      if (toggleText) toggleText.childNodes[0].nodeValue = "Pas encore de compte ? ";
      toggleModeBtn.textContent = "S'inscrire";
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorMessage) errorMessage.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
      showError("Veuillez remplir l'email et le mot de passe.");
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      if (isSignUpMode) {
        if (submitBtn) submitBtn.textContent = "Création du compte...";
        await createUserWithEmailAndPassword(auth, email, password);
        window.location.href = "dashboard.html";
      } else {
        if (submitBtn) submitBtn.textContent = "Connexion en cours...";
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "dashboard.html";
      }
    } catch (error) {
      console.error(error);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUpMode ? "S'inscrire" : "Se connecter";
      }
      
      let msg = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        msg = "Email ou mot de passe incorrect (ou compte inexistant).";
      } else if (error.code === 'auth/email-already-in-use') {
        msg = "Cet email est déjà utilisé. Cliquez sur 'Se connecter'.";
      } else if (error.code === 'auth/weak-password') {
        msg = "Le mot de passe doit contenir au moins 6 caractères.";
      } else if (error.code === 'auth/api-key-not-valid') {
        msg = "Clé API Firebase invalide. Vérifiez les paramètres dans la console Firebase.";
      }
      showError(msg);
    }
  });
}

function showError(msg) {
  if (errorMessage) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  } else {
    alert(msg);
  }
}
