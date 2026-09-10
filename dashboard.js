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

// Clé Gemini
const GEMINI_API_KEY = "AIzaSyDu813q7nn6oWDvZHt6lP8ewKlMMtI6SsQ";

let base64Image = null;

// Vérification de la session
onAuthStateChanged(auth, (user) => {
  if (user) {
    const userEmailElement = document.getElementById('user-email');
    if (userEmailElement) userEmailElement.textContent = user.email;
  } else {
    window.location.href = "index.html";
  }
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
  });
}

// Image preview
const chartFileInput = document.getElementById('chart-file');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');

if (chartFileInput) {
  chartFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        if (imagePreview) imagePreview.src = event.target.result;
        if (previewContainer) previewContainer.classList.remove('hidden');
        base64Image = event.target.result.split(',')[1];
      };
      reader.readAsDataURL(file);
    }
  });
}

// Anayser
const analyzeBtn = document.getElementById('analyze-btn');
const resultsContent = document.getElementById('results-content');

if (analyzeBtn && resultsContent) {
  analyzeBtn.addEventListener('click', async () => {
    if (!base64Image) {
      alert("Veuillez d'abord charger une image de graphique.");
      return;
    }

    resultsContent.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem;">
        <p style="color: #00E676; font-size: 1.1rem; font-weight: bold;">🧠 Analyse SMC en cours...</p>
        <p style="font-size: 0.85rem; color: #a0aec0; margin-top: 0.5rem;">Détection des structures, OB et FVG...</p>
      </div>
    `;

    try {
      const analysisData = await appelerGeminiVision(base64Image);
      afficherRapportIA(analysisData);
    } catch (error) {
      console.error(error);
      resultsContent.innerHTML = `<p style="color: #ef4444; padding: 1rem; text-align: center; word-break: break-all;">Erreur : ${error.message}</p>`;
    }
  });
}

async function appelerGeminiVision(base64Data) {
  // Endpoint v1beta
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  
  const prompt = `Tu es un expert en trading Smart Money Concepts (SMC). Analyse précisément ce graphique.
Retourne UNIQUEMENT un objet JSON valide sans balises Markdown ou texte autour, sous ce format exact :
{
  "asset": "nom de l'actif",
  "direction": "BUY LIMIT" ou "SELL LIMIT" ou "BUY NOW" ou "SELL NOW",
  "entry": 0.00,
  "sl": 0.00,
  "tp1": 0.00,
  "tp2": 0.00,
  "rr": "1:3.5",
  "bos_choch": "description de la structure",
  "ob": "description de l'order block",
  "fvg": "description du FVG"
}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64Data } }
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Erreur lors de l'appel API");

  const rawText = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(rawText);
}

function afficherRapportIA(data) {
  const isBullish = data.direction && data.direction.includes("BUY");

  resultsContent.innerHTML = `
    <div class="smc-report">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; padding-bottom: 0.75rem; margin-bottom: 1rem;">
        <div>
          <h4 style="color: ${isBullish ? '#00E676' : '#ef4444'}; margin: 0; font-size: 1.1rem;">
            ${data.asset} : ${data.direction}
          </h4>
        </div>
        <span style="background: rgba(0, 230, 118, 0.15); color: #00E676; border: 1px solid #00E676; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
          Ratio R:R = ${data.rr}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; margin-bottom: 1.2rem;">
        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">ENTRÉE (ENTRY)</small>
          <strong style="color: #ffffff; font-size: 1.1rem;">${data.entry}</strong>
        </div>
        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #ef4444;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">STOP LOSS (SL)</small>
          <strong style="color: #ef4444; font-size: 1.1rem;">${data.sl}</strong>
        </div>
        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #22c55e;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">TAKE PROFIT 1</small>
          <strong style="color: #22c55e; font-size: 1.1rem;">${data.tp1}</strong>
        </div>
        <div style="background: #1e293b; padding: 0.8rem; border-radius: 6px; border-left: 4px solid #10b981;">
          <small style="color: #94a3b8; display: block; font-size: 0.75rem;">TAKE PROFIT 2</small>
          <strong style="color: #10b981; font-size: 1.1rem;">${data.tp2}</strong>
        </div>
      </div>

      <div style="background: rgba(15, 23, 42, 0.8); padding: 0.9rem; border-radius: 6px; border-left: 3px solid #00E676; font-size: 0.85rem; color: #cbd5e1;">
        <strong style="color: #00E676; display: block; margin-bottom: 0.4rem;">📊 Analyse SMC :</strong>
        <ul style="list-style-type: none; padding-left: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem;">
          <li>⚡ <strong>Structure :</strong> ${data.bos_choch}</li>
          <li>🟢 <strong>Order Block :</strong> ${data.ob}</li>
          <li>🟡 <strong>Fair Value Gap :</strong> ${data.fvg}</li>
        </ul>
      </div>
    </div>
  `;
}
