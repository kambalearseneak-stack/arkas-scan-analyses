// ============================================================
// CONFIGURATION DU PROXY SÉCURISÉ (VERCEL)
// ============================================================
const PROXY_API_URL = "https://arkas-scan-analyses.vercel.app/api/analyze";

document.addEventListener('DOMContentLoaded', () => {
  // Masquer le texte "Chargement..." s'il reste bloqué
  const loadingStatus = document.getElementById('user-status') || document.querySelector('.header-status');
  if (loadingStatus) loadingStatus.style.display = 'none';

  // Récupération des éléments du DOM
  const dropZone = document.querySelector('.upload-zone') || document.querySelector('.border-dashed');
  const fileInput = document.getElementById('chartInput') || document.querySelector('input[type="file"]');
  const scanBtn = document.getElementById('scanBtn') || document.querySelector('button[type="submit"]');
  const outputContainer = document.getElementById('analysisOutput') || document.querySelector('.report-container');

  let selectedFile = null;

  // 1. GESTION DU CLIC ET SELECTION DE FICHIER
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  // 2. GESTION DU DRAG & DROP
  if (dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files[0]) {
        handleFileSelect(files[0]);
      }
    });
  }

  // 3. AFFICHAGE DE LA PREVISUALISATION DANS LA ZONE
  function handleFileSelect(file) {
    selectedFile = file;
    const reader = new FileReader();

    reader.onload = (e) => {
      dropZone.innerHTML = `
        <img src="${e.target.result}" style="max-width: 100%; max-height: 180px; border-radius: 8px; object-fit: contain;" />
        <p style="color: #4ed9a2; font-size: 12px; margin-top: 8px;">✓ Image prête pour le scan (Cliquer pour changer)</p>
      `;
    };

    reader.readAsDataURL(file);
  }

  // 4. SOUMISSION DU SCAN
  if (scanBtn) {
    scanBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      if (!selectedFile) {
        alert("Veuillez sélectionner ou glisser-déposer une image avant de lancer l'analyse.");
        return;
      }

      showLoader(true);

      try {
        const base64Image = await convertFileToBase64(selectedFile);
        
        const response = await fetch(PROXY_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Image,
            prompt: "Analyse ce graphique de trading selon la stratégie Smart Money Concepts (SMC). Identifie les Order Blocks (OB), Fair Value Gaps (FVG), Liquidity Sweeps, BOS et CHoCH. Fournis un plan de trade précis avec Entry, Stop Loss (SL) et Take Profit (TP)."
          })
        });

        if (!response.ok) {
          throw new Error(`Erreur serveur (${response.status})`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          displayResults(data.candidates[0].content.parts[0].text);
        } else {
          throw new Error("Réponse vide de l'analyseur.");
        }

      } catch (error) {
        console.error("Erreur de scan :", error);
        displayError(error.message);
      } finally {
        showLoader(false);
      }
    });
  }

  // UTILITAIRES
  function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = err => reject(err);
      reader.readAsDataURL(file);
    });
  }

  function showLoader(isLoading) {
    if (scanBtn) {
      scanBtn.disabled = isLoading;
      scanBtn.innerText = isLoading ? "Analyse SMC en cours..." : "Lancer l'analyse SMC";
    }
  }

  function displayResults(text) {
    if (outputContainer) {
      outputContainer.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : `<pre style="white-space: pre-wrap;">${text}</pre>`;
    }
  }

  function displayError(msg) {
    if (outputContainer) {
      outputContainer.innerHTML = `<div style="color: #ff5555; background: rgba(255,0,0,0.1); padding: 12px; border-radius: 6px;">⚠️ ${msg}</div>`;
    }
  }
});
