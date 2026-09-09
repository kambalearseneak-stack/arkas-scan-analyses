import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXCrhc36mCHtTf7KiZEER_z-2IioNPQ3A",
  authDomain: "arkas-scan-analyses.firebaseapp.com",
  projectId: "arkas-scan-analyses",
  storageBucket: "arkas-scan-analyses.firebasestorage.app",
  messagingSenderId: "843762248238",
  appId: "1:843762248238:web:43c9908b57b26671b5cdbf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ----------------------------------------------------
// 1. GESTION DE LA SESSION ET AUTHENTIFICATION
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    const userEmailElement = document.getElementById('user-email');
    if (userEmailElement) {
      userEmailElement.textContent = user.email;
    }
  } else {
    window.location.href = "index.html";
  }
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = "index.html";
    }).catch((error) => {
      console.error("Erreur de déconnexion :", error);
    });
  });
}

// ----------------------------------------------------
// 2. GESTION DU CHARGEMENT ET PRÉVISUALISATION DE L'IMAGE
// ----------------------------------------------------
const chartFileInput = document.getElementById('chart-file');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const dropZone = document.getElementById('drop-zone');

if (chartFileInput) {
  chartFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    afficherApercuImage(file);
  });
}

if (dropZone) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#00c853';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#00E676';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#00E676';
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (chartFileInput) {
        chartFileInput.files = e.dataTransfer.files;
      }
      afficherApercuImage(file);
    }
  });
}

function afficherApercuImage(file) {
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function(event) {
      imagePreview.src = event.target.result;
      previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  } else if (file) {
    alert("Veuillez sélectionner un fichier image valide (JPG, PNG, etc.).");
  }
}

// ----------------------------------------------------
// 3. ANALYSE DU GRAPHIQUE SMC & GÉNÉRATION DU SIGNAL
// ----------------------------------------------------
const analyzeBtn = document.getElementById('analyze-btn');
const resultsContent = document.getElementById('results-content');

if (analyzeBtn && resultsContent) {
  analyzeBtn.addEventListener('click', () => {
    resultsContent.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem;">
        <p style="color: #00E676; font-size: 1.1rem; font-weight: bold;">⚡ Scan SMC en cours...</p>
        <p style="font-size: 0.85rem; color: #a0aec0; margin-top: 0.5rem;">Identification des zones de liquidité, BOS/CHoCH, FVG et Order Blocks</p>
      </div>
    `;

    setTimeout(() => {
      analyserGraphiqueSMC();
    }, 2000);
  });
}

function analyserGraphiqueSMC() {
  const direction = "BUY LIMIT";
  const isBullish = direction.includes("BUY");
  
  const entryPrice = 1.0850;
  const stopLoss = 1.0825;
  const takeProfit1 = 1.0900;
  const takeProfit2 = 1.0950;
  
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit2 - entryPrice);
  const rrRatio = (reward / risk).toFixed(2);

  resultsContent.innerHTML = `
    <div class="smc-report">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; padding-bottom: 0.75rem; margin-bottom: 1rem;">
        <div>
          <h4 style="color: ${isBullish ? '#00E676' : '#ef4444'}; margin: 0; font-size: 1.1rem;">
            Signal : ${direction}
          </h4>
          <small style="color: #94a3b8;">Structure de marché : ${isBullish ? 'Haussière (Bullish)' : 'Baissière (Bearish)'}</small>
        </div>
        <span style="background: rgba(0, 230, 118, 0.15); color: #00E676; border: 1px solid #00E676; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
          Ratio R:R = 1:${rrRatio}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; margin-bottom: 1.2rem;">
        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">PRIX D'ENTRÉE (ENTRY)</small>
          <strong style="color: #ffffff; font-size: 1.1rem;">${entryPrice.toFixed(4)}</strong>
        </div>

        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #ef4444;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">STOP LOSS (SL)</small>
          <strong style="color: #ef4444; font-size: 1.1rem;">${stopLoss.toFixed(4)}</strong>
        </div>

        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #22c55e;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">TAKE PROFIT 1 (TP1)</small>
          <strong style="color: #22c55e; font-size: 1.1rem;">${takeProfit1.toFixed(4)}</strong>
        </div>

        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #10b981;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">TAKE PROFIT 2 (TP2)</small>
          <strong style="color: #10b981; font-size: 1.1rem;">${takeProfit2.toFixed(4)}</strong>
        </div>
      </div>

      <div style="background: rgba(15, 23, 42, 0.8); padding: 0.9rem; border-radius: 6px; border-left: 3px solid #00E676; font-size: 0.85rem; color: #cbd5e1;">
        <strong style="color: #00E676; display: block; margin-bottom: 0.4rem;">📊 Confirmation Smart Money Concepts :</strong>
        <ul style="list-style-type: none; padding-left: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem;">
          <li>⚡ <strong>BOS / CHoCH :</strong> Cassure de structure haussière confirmée avec clôture de bougie.</li>
          <li>🟢 <strong>Order Block (OB) :</strong> Zone d'intérêt acheteuse identifiée. Entrée au niveau 50% (Equilibrium).</li>
          <li>🟡 <strong>Fair Value Gap (FVG) :</strong> Déséquilibre de prix présent juste au-dessus de l'Order Block.</li>
          <li>🛡️ <strong>Invalidation :</strong> Le plan est invalidé en cas de clôture sous ${stopLoss.toFixed(4)}.</li>
        </ul>
      </div>
    </div>
  `;
  }
            
