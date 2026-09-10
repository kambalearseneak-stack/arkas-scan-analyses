/* =========================================================
   ARKAS SCAN AI V2
   app.js
   Firebase Authentication
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


/* =========================================================
   FIREBASE CONFIGURATION
   ========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyBXCrhc36mCHtTf7KiZEER_z-2IioNPQ3A",
    authDomain: "arkas-scan-analyses.firebaseapp.com",
    projectId: "arkas-scan-analyses",
    storageBucket: "arkas-scan-analyses.firebasestorage.app",
    messagingSenderId: "843762248238",
    appId: "1:843762248238:web:43c9908b57b26671b5cdbf"
};


/* =========================================================
   INITIALISATION
   ========================================================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


/* =========================================================
   DETECTION DE LA PAGE
   ========================================================= */

const currentPage = window.location.pathname.split("/").pop().toLowerCase();

const isLoginPage =
    currentPage === "" ||
    currentPage === "index.html";

const isDashboardPage =
    currentPage === "dashboard.html";


/* =========================================================
   VARIABLES LOGIN
   ========================================================= */

let isSignUpMode = false;

const loginForm = document.getElementById("login-form")
    || document.querySelector(".login-form");

const formTitle = document.getElementById("form-title");
const formSubtitle = document.getElementById("form-subtitle");

const submitBtn = document.getElementById("submit-btn");

const toggleModeBtn = document.getElementById("toggle-mode");
const toggleText = document.getElementById("toggle-text");

const errorMessage = document.getElementById("error-message");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");


/* =========================================================
   FONCTIONS UTILITAIRES
   ========================================================= */

function showError(message) {

    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
        errorMessage.classList.add("show");
    } else {
        alert(message);
    }
}


function clearError() {

    if (errorMessage) {
        errorMessage.textContent = "";
        errorMessage.style.display = "none";
        errorMessage.classList.remove("show");
    }
}


function setButtonLoading(loading) {

    if (!submitBtn) return;

    submitBtn.disabled = loading;

    if (loading) {

        submitBtn.dataset.originalText =
            isSignUpMode
                ? "S'inscrire"
                : "Se connecter";

        submitBtn.textContent =
            isSignUpMode
                ? "Création du compte..."
                : "Connexion en cours...";

    } else {

        submitBtn.textContent =
            isSignUpMode
                ? "S'inscrire"
                : "Se connecter";
    }
}


/* =========================================================
   MESSAGES FIREBASE EN FRANÇAIS
   ========================================================= */

function getFirebaseErrorMessage(error) {

    if (!error || !error.code) {
        return "Une erreur est survenue. Veuillez réessayer.";
    }

    switch (error.code) {

        case "auth/invalid-email":
            return "L'adresse email n'est pas valide.";

        case "auth/user-not-found":
            return "Aucun compte ne correspond à cet email.";

        case "auth/wrong-password":
            return "Mot de passe incorrect.";

        case "auth/invalid-credential":
            return "Email ou mot de passe incorrect.";

        case "auth/email-already-in-use":
            return "Cet email est déjà utilisé. Connectez-vous plutôt.";

        case "auth/weak-password":
            return "Le mot de passe doit contenir au moins 6 caractères.";

        case "auth/password-does-not-meet-requirements":
            return "Le mot de passe ne respecte pas les exigences de sécurité.";

        case "auth/too-many-requests":
            return "Trop de tentatives. Veuillez patienter quelques minutes.";

        case "auth/network-request-failed":
            return "Problème de connexion Internet. Vérifiez votre réseau.";

        case "auth/operation-not-allowed":
            return "La connexion par email/mot de passe n'est pas activée dans Firebase.";

        case "auth/user-disabled":
            return "Ce compte a été désactivé.";

        case "auth/requires-recent-login":
            return "Veuillez vous reconnecter pour effectuer cette action.";

        default:
            return error.message
                ? error.message.replace("Firebase: ", "")
                : "Une erreur est survenue.";
    }
}


/* =========================================================
   MODE CONNEXION / INSCRIPTION
   ========================================================= */

function updateFormMode() {

    if (isSignUpMode) {

        if (formTitle) {
            formTitle.textContent = "Créer un compte";
        }

        if (formSubtitle) {
            formSubtitle.textContent =
                "Créez votre compte ARKAS SCAN AI pour accéder au scanner SMC";
        }

        if (submitBtn) {
            submitBtn.textContent = "S'inscrire";
        }

        if (toggleText) {
            toggleText.childNodes[0].nodeValue =
                "Vous avez déjà un compte ? ";
        }

        if (toggleModeBtn) {
            toggleModeBtn.textContent = "Se connecter";
        }

        if (passwordInput) {
            passwordInput.setAttribute("autocomplete", "new-password");
        }

    } else {

        if (formTitle) {
            formTitle.textContent = "ARKAS SCAN AI";
        }

        if (formSubtitle) {
            formSubtitle.textContent =
                "Connectez-vous pour accéder à vos analyses SMC";
        }

        if (submitBtn) {
            submitBtn.textContent = "Se connecter";
        }

        if (toggleText) {
            toggleText.childNodes[0].nodeValue =
                "Pas encore de compte ? ";
        }

        if (toggleModeBtn) {
            toggleModeBtn.textContent = "S'inscrire";
        }

        if (passwordInput) {
            passwordInput.setAttribute("autocomplete", "current-password");
        }
    }
}


/* =========================================================
   BASCULER ENTRE LOGIN ET SIGNUP
   ========================================================= */

if (toggleModeBtn) {

    toggleModeBtn.addEventListener("click", function (event) {

        event.preventDefault();

        isSignUpMode = !isSignUpMode;

        clearError();

        updateFormMode();

        if (emailInput) {
            emailInput.focus();
        }
    });
}


/* =========================================================
   CONNEXION / INSCRIPTION
   ========================================================= */

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        clearError();

        const email =
            emailInput
                ? emailInput.value.trim()
                : "";

        const password =
            passwordInput
                ? passwordInput.value
                : "";


        /* -------------------------------------------------
           VALIDATION
           ------------------------------------------------- */

        if (!email) {
            showError("Veuillez entrer votre adresse email.");
            if (emailInput) emailInput.focus();
            return;
        }

        if (!password) {
            showError("Veuillez entrer votre mot de passe.");
            if (passwordInput) passwordInput.focus();
            return;
        }

        if (password.length < 6) {
            showError(
                "Le mot de passe doit contenir au moins 6 caractères."
            );
            if (passwordInput) passwordInput.focus();
            return;
        }


        /* -------------------------------------------------
           CHARGEMENT
           ------------------------------------------------- */

        setButtonLoading(true);


        try {

            if (isSignUpMode) {

                /* =========================================
                   CREATION DU COMPTE
                   ========================================= */

                const userCredential =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                console.log(
                    "Compte créé :",
                    userCredential.user.email
                );

                /*
                 * Firebase connecte automatiquement
                 * l'utilisateur après la création.
                 */

                window.location.replace("dashboard.html");

            } else {

                /* =========================================
                   CONNEXION
                   ========================================= */

                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                console.log(
                    "Connexion réussie :",
                    userCredential.user.email
                );

                window.location.replace("dashboard.html");
            }

        } catch (error) {

            console.error(
                "Erreur Firebase :",
                error
            );

            setButtonLoading(false);

            showError(
                getFirebaseErrorMessage(error)
            );
        }
    });
}


/* =========================================================
   PROTECTION DU DASHBOARD
   ========================================================= */

onAuthStateChanged(auth, function (user) {

    /* =====================================================
       PAGE DE CONNEXION
       ===================================================== */

    if (isLoginPage) {

        if (user) {

            /*
             * L'utilisateur est déjà connecté.
             * Il n'a pas besoin de revoir la page login.
             */

            console.log(
                "Utilisateur déjà connecté :",
                user.email
            );

            window.location.replace("dashboard.html");
        }

        return;
    }


    /* =====================================================
       PAGE DASHBOARD
       ===================================================== */

    if (isDashboardPage) {

        if (!user) {

            /*
             * Aucun utilisateur connecté.
             * Retour obligatoire vers la connexion.
             */

            console.log(
                "Accès dashboard refusé : utilisateur non connecté."
            );

            window.location.replace("index.html");

            return;
        }


        /* -------------------------------------------------
           UTILISATEUR CONNECTÉ
           ------------------------------------------------- */

        console.log(
            "Utilisateur authentifié :",
            user.email
        );


        /* -------------------------------------------------
           AFFICHER EMAIL
           ------------------------------------------------- */

        const userEmail =
            document.getElementById("user-email");

        if (userEmail) {

            userEmail.textContent =
                user.email || "Utilisateur";
        }


        /* -------------------------------------------------
           STATUS
           ------------------------------------------------- */

        const userStatus =
            document.getElementById("user-status");

        if (userStatus) {

            userStatus.textContent = "Connecté";
        }


        const analysisStatus =
            document.getElementById("analysis-status");

        if (analysisStatus) {

            analysisStatus.textContent =
                "Prêt";
        }
    }
});


/* =========================================================
   DECONNEXION
   ========================================================= */

const logoutBtn =
    document.getElementById("logout-btn");


if (logoutBtn) {

    logoutBtn.addEventListener("click", async function () {

        const originalText =
            logoutBtn.textContent;

        logoutBtn.disabled = true;
        logoutBtn.textContent = "Déconnexion...";

        try {

            await signOut(auth);

            console.log(
                "Utilisateur déconnecté."
            );

            window.location.replace("index.html");

        } catch (error) {

            console.error(
                "Erreur de déconnexion :",
                error
            );

            logoutBtn.disabled = false;
            logoutBtn.textContent = originalText;

            showError(
                getFirebaseErrorMessage(error)
            );
        }
    });
}


/* =========================================================
   INITIALISATION
   ========================================================= */

updateFormMode();

console.log(
    "ARKAS SCAN AI V2 — Firebase Authentication chargé."
);
