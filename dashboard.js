// ============================================================
// CONFIGURATION DU PROXY SÉCURISÉ (VERCEL / SERVERLESS)
// ============================================================
// Remplacez cette URL par l'URL exacte générée lors de votre déploiement Vercel
const PROXY_API_URL = "https://votre-projet.vercel.app/api/analyze";

/**
 * Fonction d'analyse graphique SMC via le proxy Serverless
 * @param {string} base64Image - L'image du graphique encodée en Base64 (sans le prefixe data:image/...)
 * @param {string} customPrompt - Instructions spécifiques pour l'analyse Smart Money Concepts
 */
async function analyzeChartSMC(base64Image, customPrompt) {
  const defaultPrompt = "Analyse ce graphique de trading selon la stratégie Smart Money Concepts (SMC). " +
                        "Identifie les structures clés : Order Blocks (OB), Fair Value Gaps (FVG), " +
                        "Liquidity Sweeps, Break of Structure (BOS), et Change of Character (CHoCH). " +
                        "Fournis un plan de trade précis avec point d'entrée, Stop Loss et Take Profit.";

  const promptToSend = customPrompt || defaultPrompt;

  // Notification visuelle de début de traitement
  showLoader(true);

  try {
    const response = await fetch(PROXY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageBase64: base64Image,
        prompt: promptToSend
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur serveur: ${response.status}`);
    }

    const data = await response.json();
    
    // Traitement et affichage des résultats Gemini
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const analysisResult = data.candidates[0].content.parts[0].text;
      displayResults(analysisResult);
    } else {
      throw new Error("Format de réponse invalide ou analyse vide.");
    }

  } catch (error) {
    console.error("Erreur lors de l'analyse SMC :", error);
    displayError("Impossible de réaliser l'analyse. " + error.message);
  } finally {
    showLoader(false);
  }
}

// ============================================================
// FONCTIONS UTILITAIRES ET GESTION DE L'INTERFACE (UI)
// ============================================================

/**
 * Convertit un fichier Image issu d'un input HTML en chaîne Base64
 * @param {File} file 
 * @returns {Promise<string>}
 */
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Enlève le préfixe data:image/png;base64, pour ne garder que les données brutes
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Gestionnaire d'événement sur l'envoi du formulaire ou du bouton de scan
 */
document.getElementById('scanForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fileInput = document.getElementById('chartInput');
  const promptInput = document.getElementById('promptInput');

  if (!fileInput || !fileInput.files[0]) {
    alert("Veuillez sélectionner une capture d'écran du graphique.");
    return;
  }

  try {
    const file = fileInput.files[0];
    const base64Image = await convertFileToBase64(file);
    const promptText = promptInput ? promptInput.value : "";

    await analyzeChartSMC(base64Image, promptText);
  } catch (err) {
    displayError("Erreur lors de la lecture de l'image.");
  }
});

/**
 * Affiche ou masque l'indicateur de chargement
 */
function showLoader(isLoading) {
  const loader = document.getElementById('loadingSpinner');
  if (loader) {
    loader.style.display = isLoading ? 'block' : 'none';
  }
}

/**
 * Injection du résultat de l'analyse dans le DOM
 */
function displayResults(text) {
  const outputContainer = document.getElementById('analysisOutput');
  if (outputContainer) {
    // Si vous utilisez une librairie comme marked.js, vous pouvez convertir le markdown en HTML
    outputContainer.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : `<pre>${text}</pre>`;
  }
}

/**
 * Affichage des messages d'erreur
 */
function displayError(errorMessage) {
  const outputContainer = document.getElementById('analysisOutput');
  if (outputContainer) {
    outputContainer.innerHTML = `<div class="error-box" style="color: red; font-weight: bold;">⚠️ ${errorMessage}</div>`;
  }
}
