// ============================================================
// CONFIGURATION DU PROXY SÉCURISÉ (VERCEL)
// ============================================================
const PROXY_API_URL = "https://votre-projet.vercel.app/api/analyze";

// ============================================================
// PREVISUALISATION DE L'IMAGE LORS DE LA SÉLECTION
// ============================================================
const chartInput = document.getElementById('chartInput');
const imagePreview = document.getElementById('imagePreview'); // L'élément <img> pour afficher l'image

if (chartInput) {
  chartInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        if (imagePreview) {
          imagePreview.src = event.target.result;
          imagePreview.style.display = 'block'; // Affiche l'image
        }
      };
      reader.readAsDataURL(file);
    }
  });
}

// ============================================================
// FONCTION D'ANALYSE ET ENVOI AU PROXY
// ============================================================
async function analyzeChartSMC(base64Image, customPrompt) {
  const defaultPrompt = "Analyse ce graphique de trading selon la stratégie Smart Money Concepts (SMC). " +
                        "Identifie les Order Blocks (OB), Fair Value Gaps (FVG), Liquidity Sweeps, BOS et CHoCH. " +
                        "Fournis un plan de trade avec point d'entrée, Stop Loss et Take Profit.";

  const promptToSend = customPrompt || defaultPrompt;

  showLoader(true);

  try {
    const response = await fetch(PROXY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const analysisResult = data.candidates[0].content.parts[0].text;
      displayResults(analysisResult);
    } else {
      throw new Error("Réponse vide du modèle.");
    }

  } catch (error) {
    console.error("Erreur lors de l'analyse :", error);
    displayError("Impossible de réaliser l'analyse : " + error.message);
  } finally {
    showLoader(false);
  }
}

// ============================================================
// CONVERSION FILE TO BASE64 ET SOUMISSION
// ============================================================
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

document.getElementById('scanForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!chartInput || !chartInput.files[0]) {
    alert("Veuillez sélectionner une image avant de lancer le scan.");
    return;
  }

  try {
    const file = chartInput.files[0];
    const base64Image = await convertFileToBase64(file);
    const promptInput = document.getElementById('promptInput');
    const promptText = promptInput ? promptInput.value : "";

    await analyzeChartSMC(base64Image, promptText);
  } catch (err) {
    displayError("Erreur lors du traitement du fichier.");
  }
});

// ============================================================
// AFFICHAGE ET ÉTATS DE L'INTERFACE
// ============================================================
function showLoader(isLoading) {
  const loader = document.getElementById('loadingSpinner');
  if (loader) loader.style.display = isLoading ? 'block' : 'none';
}

function displayResults(text) {
  const outputContainer = document.getElementById('analysisOutput');
  if (outputContainer) {
    outputContainer.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : `<pre>${text}</pre>`;
  }
}

function displayError(errorMessage) {
  const outputContainer = document.getElementById('analysisOutput');
  if (outputContainer) {
    outputContainer.innerHTML = `<div style="color: red; font-weight: bold;">⚠️ ${errorMessage}</div>`;
  }
}
