// ============================================================
// ARKAS SCAN AI V2
// dashboard.js
// Frontend -> Proxy Vercel -> Gemini Vision
// ============================================================

const PROXY_API_URL =
  "https://arkas-scan-analyses.vercel.app/api/analyze";

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================================
  // ELEMENTS DU DOM
  // ==========================================================

  const loadingStatus =
    document.getElementById("user-status") ||
    document.querySelector(".header-status");

  const dropZone =
    document.querySelector(".upload-zone") ||
    document.querySelector(".border-dashed") ||
    document.getElementById("dropZone");

  const fileInput =
    document.getElementById("chartInput") ||
    document.getElementById("chart-file") ||
    document.querySelector('input[type="file"]');

  const scanBtn =
    document.getElementById("scanBtn") ||
    document.getElementById("analyze-btn") ||
    document.querySelector('button[type="submit"]');

  const outputContainer =
    document.getElementById("analysisOutput") ||
    document.getElementById("results-content") ||
    document.querySelector(".report-container");

  let selectedFile = null;

  // ==========================================================
  // MASQUER CHARGEMENT
  // ==========================================================

  if (loadingStatus) {
    loadingStatus.style.display = "none";
  }

  // ==========================================================
  // INITIALISATION
  // ==========================================================

  if (!dropZone) {
    console.warn("ARKAS : zone d'upload introuvable.");
  }

  if (!fileInput) {
    console.warn("ARKAS : input fichier introuvable.");
  }

  if (!scanBtn) {
    console.warn("ARKAS : bouton de scan introuvable.");
  }

  if (!outputContainer) {
    console.warn("ARKAS : conteneur des résultats introuvable.");
  }

  // ==========================================================
  // 1. CLIC SUR LA ZONE
  // ==========================================================

  if (dropZone && fileInput) {

    dropZone.addEventListener("click", (event) => {

      // Évite de déclencher deux fois si on clique directement
      // sur l'input.
      if (event.target === fileInput) {
        return;
      }

      fileInput.click();
    });

  }

  // ==========================================================
  // 2. SELECTION DU FICHIER
  // ==========================================================

  if (fileInput) {

    fileInput.addEventListener("change", (event) => {

      const files = event.target.files;

      if (!files || !files.length) {
        return;
      }

      handleFileSelect(files[0]);

    });

  }

  // ==========================================================
  // 3. DRAG & DROP
  // ==========================================================

  if (dropZone) {

    [
      "dragenter",
      "dragover",
      "dragleave",
      "drop"
    ].forEach((eventName) => {

      dropZone.addEventListener(
        eventName,
        preventDefaults,
        false
      );

    });

    function preventDefaults(event) {
      event.preventDefault();
      event.stopPropagation();
    }

    [
      "dragenter",
      "dragover"
    ].forEach((eventName) => {

      dropZone.addEventListener(
        eventName,
        () => {
          dropZone.classList.add("drag-active");
        },
        false
      );

    });

    [
      "dragleave",
      "drop"
    ].forEach((eventName) => {

      dropZone.addEventListener(
        eventName,
        () => {
          dropZone.classList.remove("drag-active");
        },
        false
      );

    });

    dropZone.addEventListener("drop", (event) => {

      const files =
        event.dataTransfer &&
        event.dataTransfer.files;

      if (!files || !files.length) {
        return;
      }

      handleFileSelect(files[0]);

    });

  }

  // ==========================================================
  // 4. VALIDATION + PREVISUALISATION
  // ==========================================================

  function handleFileSelect(file) {

    // --------------------------------------------------------
    // Vérification du type
    // --------------------------------------------------------

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

      displayError(
        "Format non supporté. Utilisez une image JPG, PNG ou WebP."
      );

      selectedFile = null;

      return;
    }

    // --------------------------------------------------------
    // Taille maximale : 10 MB côté navigateur
    // --------------------------------------------------------

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {

      displayError(
        "Image trop volumineuse. La taille maximale est de 10 MB."
      );

      selectedFile = null;

      return;
    }

    selectedFile = file;

    // --------------------------------------------------------
    // Prévisualisation
    // --------------------------------------------------------

    const reader = new FileReader();

    reader.onload = (event) => {

      if (!dropZone) {
        return;
      }

      // Ne remplace pas la structure globale de la page.
      dropZone.innerHTML = "";

      const wrapper =
        document.createElement("div");

      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";
      wrapper.style.width = "100%";

      const image =
        document.createElement("img");

      image.src = event.target.result;

      image.alt =
        "Graphique sélectionné pour ARKAS SCAN AI";

      image.style.maxWidth = "100%";
      image.style.maxHeight = "220px";
      image.style.borderRadius = "10px";
      image.style.objectFit = "contain";
      image.style.display = "block";

      const status =
        document.createElement("p");

      status.textContent =
        "✓ Image prête pour le scan";

      status.style.color = "#4ed9a2";
      status.style.fontSize = "12px";
      status.style.marginTop = "8px";

      const filename =
        document.createElement("small");

      filename.textContent =
        file.name;

      filename.style.opacity = "0.65";
      filename.style.fontSize = "11px";
      filename.style.marginTop = "3px";

      wrapper.appendChild(image);
      wrapper.appendChild(status);
      wrapper.appendChild(filename);

      dropZone.appendChild(wrapper);

    };

    reader.onerror = () => {

      selectedFile = null;

      displayError(
        "Impossible de lire cette image."
      );

    };

    reader.readAsDataURL(file);

  }

  // ==========================================================
  // 5. BOUTON SCAN
  // ==========================================================

  if (scanBtn) {

    scanBtn.addEventListener("click", async (event) => {

      event.preventDefault();

      // ------------------------------------------------------
      // Vérification image
      // ------------------------------------------------------

      if (!selectedFile) {

        displayError(
          "Veuillez sélectionner ou glisser-déposer un graphique avant de lancer l'analyse."
        );

        return;
      }

      // ------------------------------------------------------
      // Loading
      // ------------------------------------------------------

      showLoader(true);

      clearResults();

      try {

        // ----------------------------------------------------
        // Conversion Base64
        // ----------------------------------------------------

        const base64Image =
          await convertFileToBase64(selectedFile);

        // ----------------------------------------------------
        // Prompt utilisateur
        // ----------------------------------------------------

        const userPrompt = `
Analyse ce graphique de trading selon Smart Money Concepts
(SMC) et Price Action.

Identifie uniquement les éléments réellement visibles :

- tendance
- structure
- BOS
- CHoCH
- liquidité
- liquidity sweep
- Order Block
- Fair Value Gap
- Premium / Discount
- support et résistance
- confirmation Price Action
- zone BUY
- zone SELL

Si une configuration suffisamment fiable existe,
détermine :

Entry
Stop Loss
TP1
TP2

Ne force jamais un BUY ou SELL.
Si la configuration n'est pas suffisamment confirmée,
retourne WAIT.

Le score ARKAS doit refléter la qualité réelle
de la configuration.
`;

        // ----------------------------------------------------
        // APPEL AU PROXY VERCEL
        // ----------------------------------------------------

        const response =
          await fetch(PROXY_API_URL, {

            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({

              imageBase64:
                base64Image,

              mimeType:
                selectedFile.type,

              prompt:
                userPrompt

            })

          });

        // ----------------------------------------------------
        // Lecture réponse JSON
        // ----------------------------------------------------

        let data = null;

        try {

          data =
            await response.json();

        } catch (jsonError) {

          throw new Error(
            "Le serveur a retourné une réponse invalide."
          );

        }

        // ----------------------------------------------------
        // Gestion erreur API
        // ----------------------------------------------------

        if (!response.ok) {

          throw new Error(
            data?.error ||
            `Erreur serveur (${response.status})`
          );

        }

        if (!data || data.success !== true) {

          throw new Error(
            data?.error ||
            "Le serveur n'a pas confirmé l'analyse."
          );

        }

        // ----------------------------------------------------
        // NOUVELLE STRUCTURE DU PROXY
        //
        // data.analysis
        // ----------------------------------------------------

        if (!data.analysis) {

          throw new Error(
            "Aucune analyse n'a été retournée par ARKAS SCAN AI."
          );

        }

        // ----------------------------------------------------
        // AFFICHAGE
        // ----------------------------------------------------

        displayResults(data.analysis);

      } catch (error) {

        console.error(
          "ARKAS SCAN AI - Erreur :",
          error
        );

        displayError(
          error?.message ||
          "Une erreur est survenue pendant l'analyse."
        );

      } finally {

        showLoader(false);

      }

    });

  }

  // ==========================================================
  // 6. CONVERSION FICHIER -> BASE64
  // ==========================================================

  function convertFileToBase64(file) {

    return new Promise((resolve, reject) => {

      const reader =
        new FileReader();

      reader.onload = () => {

        try {

          const result =
            reader.result;

          if (
            typeof result !== "string" ||
            !result.includes(",")
          ) {

            reject(
              new Error(
                "Impossible de convertir l'image."
              )
            );

            return;
          }

          const base64 =
            result.split(",")[1];

          if (!base64) {

            reject(
              new Error(
                "Image Base64 vide."
              )
            );

            return;
          }

          resolve(base64);

        } catch (error) {

          reject(error);

        }

      };

      reader.onerror = () => {

        reject(
          new Error(
            "Erreur lors de la lecture du fichier."
          )
        );

      };

      reader.readAsDataURL(file);

    });

  }

  // ==========================================================
  // 7. LOADER
  // ==========================================================

  function showLoader(isLoading) {

    if (!scanBtn) {
      return;
    }

    scanBtn.disabled =
      isLoading;

    if (isLoading) {

      scanBtn.innerText =
        "Analyse ARKAS en cours...";

      scanBtn.style.opacity =
        "0.7";

      scanBtn.style.cursor =
        "wait";

    } else {

      scanBtn.innerText =
        "Lancer l'analyse SMC";

      scanBtn.style.opacity =
        "";

      scanBtn.style.cursor =
        "";

    }

  }

  // ==========================================================
  // 8. NETTOYER LES RESULTATS
  // ==========================================================

  function clearResults() {

    if (!outputContainer) {
      return;
    }

    outputContainer.innerHTML = `
      <div style="
        padding:16px;
        text-align:center;
        opacity:0.7;
      ">
        🔎 ARKAS SCAN AI analyse le graphique...
      </div>
    `;

  }

  // ==========================================================
  // 9. AFFICHAGE DES RESULTATS
  // ==========================================================

  function displayResults(analysis) {

    if (!outputContainer) {
      console.warn(
        "Conteneur de résultats introuvable."
      );

      return;
    }

    const direction =
      normalizeSignal(
        analysis.direction ||
        analysis.signal ||
        "WAIT"
      );

    const score =
      safeNumber(
        analysis.arkas_score,
        0
      );

    const entry =
      formatPrice(analysis.entry);

    const sl =
      formatPrice(analysis.sl);

    const tp1 =
      formatPrice(analysis.tp1);

    const tp2 =
      formatPrice(analysis.tp2);

    const rr =
      analysis.rr !== null &&
      analysis.rr !== undefined
        ? escapeHtml(String(analysis.rr))
        : "—";

    const asset =
      escapeHtml(
        analysis.asset ||
        "Marché"
      );

    const timeframe =
      escapeHtml(
        analysis.timeframe ||
        "N/A"
      );

    const bias =
      escapeHtml(
        analysis.market_bias ||
        "NEUTRAL"
      );

    const reason =
      escapeHtml(
        analysis.reason ||
        "Aucune raison fournie."
      );

    const riskWarning =
      escapeHtml(
        analysis.risk_warning ||
        "Utilisez toujours une gestion du risque."
      );

    // --------------------------------------------------------
    // Structure
    // --------------------------------------------------------

    const structure =
      analysis.structure || {};

    const bos =
      escapeHtml(
        structure.bos ||
        "Non identifié"
      );

    const choch =
      escapeHtml(
        structure.choch ||
        "Non identifié"
      );

    const structureDescription =
      escapeHtml(
        structure.description ||
        "Aucune description."
      );

    // --------------------------------------------------------
    // Liquidité
    // --------------------------------------------------------

    const liquidity =
      analysis.liquidity || {};

    const liquidityType =
      escapeHtml(
        liquidity.type ||
        "Non identifiée"
      );

    const liquidityDescription =
      escapeHtml(
        liquidity.description ||
        "Aucune description."
      );

    // --------------------------------------------------------
    // Order Block
    // --------------------------------------------------------

    const orderBlock =
      analysis.order_block || {};

    const obDetected =
      Boolean(orderBlock.detected);

    const obType =
      escapeHtml(
        orderBlock.type ||
        "N/A"
      );

    const obZone =
      escapeHtml(
        orderBlock.zone ||
        "N/A"
      );

    const obDescription =
      escapeHtml(
        orderBlock.description ||
        "Aucune description."
      );

    // --------------------------------------------------------
    // FVG
    // --------------------------------------------------------

    const fvg =
      analysis.fvg || {};

    const fvgDetected =
      Boolean(fvg.detected);

    const fvgType =
      escapeHtml(
        fvg.type ||
        "N/A"
      );

    const fvgZone =
      escapeHtml(
        fvg.zone ||
        "N/A"
      );

    const fvgDescription =
      escapeHtml(
        fvg.description ||
        "Aucune description."
      );

    // --------------------------------------------------------
    // Price Action
    // --------------------------------------------------------

    const priceAction =
      analysis.price_action || {};

    const paConfirmation =
      escapeHtml(
        priceAction.confirmation ||
        "N/A"
      );

    const paDescription =
      escapeHtml(
        priceAction.description ||
        "Aucune description."
      );

    // --------------------------------------------------------
    // Score Breakdown
    // --------------------------------------------------------

    const breakdown =
      analysis.score_breakdown || {};

    const structureScore =
      safeNumber(
        breakdown.structure,
        0
      );

    const liquidityScore =
      safeNumber(
        breakdown.liquidity,
        0
      );

    const orderBlockScore =
      safeNumber(
        breakdown.order_block,
        0
      );

    const fvgScore =
      safeNumber(
        breakdown.fvg,
        0
      );

    const priceActionScore =
      safeNumber(
        breakdown.price_action,
        0
      );

    const rrScore =
      safeNumber(
        breakdown.risk_reward,
        0
      );

    // --------------------------------------------------------
    // Couleur logique
    // --------------------------------------------------------

    let signalColor =
      "#9aa4b2";

    let signalIcon =
      "⏳";

    if (direction === "BUY") {

      signalColor =
        "#4ed9a2";

      signalIcon =
        "▲";

    } else if (direction === "SELL") {

      signalColor =
        "#ff5c7a";

      signalIcon =
        "▼";

    }

    // --------------------------------------------------------
    // HTML
    // --------------------------------------------------------

    outputContainer.innerHTML = `

      <div class="arkas-analysis">

        <!-- ============================================= -->
        <!-- HEADER -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            flex-wrap:wrap;
          ">

            <div>

              <div style="
                font-size:12px;
                opacity:0.65;
              ">
                ARKAS SCAN AI V2
              </div>

              <div style="
                font-size:20px;
                font-weight:700;
                margin-top:4px;
              ">
                ${asset}
              </div>

              <div style="
                font-size:12px;
                opacity:0.7;
                margin-top:4px;
              ">
                Timeframe : ${timeframe}
              </div>

            </div>

            <div style="
              text-align:center;
              min-width:100px;
            ">

              <div style="
                color:${signalColor};
                font-size:27px;
                font-weight:800;
              ">
                ${signalIcon}
                ${escapeHtml(direction)}
              </div>

              <div style="
                font-size:11px;
                opacity:0.7;
                margin-top:3px;
              ">
                Biais : ${bias}
              </div>

            </div>

          </div>

        </div>


        <!-- ============================================= -->
        <!-- SCORE ARKAS -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
          ">

            <strong>
              Score ARKAS
            </strong>

            <strong style="
              font-size:24px;
            ">
              ${score}/100
            </strong>

          </div>

          <div style="
            height:8px;
            margin-top:12px;
            background:rgba(255,255,255,0.08);
            border-radius:20px;
            overflow:hidden;
          ">

            <div style="
              width:${Math.max(0, Math.min(100, score))}%;
              height:100%;
              background:${signalColor};
              border-radius:20px;
            "></div>

          </div>

          <div style="
            margin-top:8px;
            font-size:12px;
            opacity:0.7;
          ">
            ${getScoreMessage(score)}
          </div>

        </div>


        <!-- ============================================= -->
        <!-- PLAN DE TRADE -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3 style="
            margin:0 0 14px 0;
          ">
            Plan de trade
          </h3>

          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
            gap:10px;
          ">

            ${priceCard(
              "ENTRY",
              entry
            )}

            ${priceCard(
              "STOP LOSS",
              sl
            )}

            ${priceCard(
              "TP1",
              tp1
            )}

            ${priceCard(
              "TP2",
              tp2
            )}

            ${priceCard(
              "RISK / REWARD",
              rr
            )}

          </div>

        </div>


        <!-- ============================================= -->
        <!-- STRUCTURE -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3>
            📊 Structure du marché
          </h3>

          <p>
            <strong>BOS :</strong>
            ${bos}
          </p>

          <p>
            <strong>CHoCH :</strong>
            ${choch}
          </p>

          <p>
            ${structureDescription}
          </p>

        </div>


        <!-- ============================================= -->
        <!-- LIQUIDITE -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3>
            💧 Liquidité
          </h3>

          <p>
            <strong>Type :</strong>
            ${liquidityType}
          </p>

          <p>
            ${liquidityDescription}
          </p>

        </div>


        <!-- ============================================= -->
        <!-- ORDER BLOCK -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3>
            🧱 Order Block
          </h3>

          <p>
            <strong>Détecté :</strong>
            ${obDetected ? "Oui" : "Non"}
          </p>

          <p>
            <strong>Type :</strong>
            ${obType}
          </p>

          <p>
            <strong>Zone :</strong>
            ${obZone}
          </p>

          <p>
            ${obDescription}
          </p>

        </div>


        <!-- ============================================= -->
        <!-- FVG -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3>
            ⚡ Fair Value Gap
          </h3>

          <p>
            <strong>Détecté :</strong>
            ${fvgDetected ? "Oui" : "Non"}
          </p>

          <p>
            <strong>Type :</strong>
            ${fvgType}
          </p>

          <p>
            <strong>Zone :</strong>
            ${fvgZone}
          </p>

          <p>
            ${fvgDescription}
          </p>

        </div>


        <!-- ============================================= -->
        <!-- PRICE ACTION -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3>
            🕯️ Price Action
          </h3>

          <p>
            <strong>Confirmation :</strong>
            ${paConfirmation}
          </p>

          <p>
            ${paDescription}
          </p>

        </div>


        <!-- ============================================= -->
        <!-- SCORE DETAIL -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3>
            🎯 Détail du score
          </h3>

          ${scoreLine(
            "Structure",
            structureScore,
            25
          )}

          ${scoreLine(
            "Liquidité",
            liquidityScore,
            20
          )}

          ${scoreLine(
            "Order Block",
            orderBlockScore,
            15
          )}

          ${scoreLine(
            "FVG",
            fvgScore,
            15
          )}

          ${scoreLine(
            "Price Action",
            priceActionScore,
            15
          )}

          ${scoreLine(
            "Risk / Reward",
            rrScore,
            10
          )}

        </div>


        <!-- ============================================= -->
        <!-- RAISON -->
        <!-- ============================================= -->

        <div style="
          padding:18px;
          margin-bottom:14px;
          border-radius:14px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <h3>
            🧠 Conclusion ARKAS
          </h3>

          <p>
            ${reason}
          </p>

        </div>


        <!-- ============================================= -->
        <!-- AVERTISSEMENT -->
        <!-- ============================================= -->

        <div style="
          padding:14px;
          border-radius:10px;
          background:rgba(255,180,0,0.08);
          border:1px solid rgba(255,180,0,0.18);
          font-size:12px;
          opacity:0.85;
        ">

          ⚠️ ${riskWarning}

        </div>

      </div>

    `;

  }

  // ==========================================================
  // 10. CARTE PRIX
  // ==========================================================

  function priceCard(label, value) {

    return `

      <div style="
        padding:12px;
        border-radius:10px;
        background:rgba(255,255,255,0.035);
      ">

        <div style="
          font-size:10px;
          opacity:0.6;
        ">
          ${escapeHtml(label)}
        </div>

        <div style="
          font-size:15px;
          font-weight:700;
          margin-top:5px;
        ">
          ${escapeHtml(value)}
        </div>

      </div>

    `;

  }

  // ==========================================================
  // 11. LIGNE SCORE
  // ==========================================================

  function scoreLine(label, value, max) {

    const percent =
      max > 0
        ? Math.max(
            0,
            Math.min(
              100,
              (value / max) * 100
            )
          )
        : 0;

    return `

      <div style="
        margin-top:12px;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          font-size:12px;
          margin-bottom:5px;
        ">

          <span>
            ${escapeHtml(label)}
          </span>

          <span>
            ${value}/${max}
          </span>

        </div>

        <div style="
          height:5px;
          background:rgba(255,255,255,0.08);
          border-radius:10px;
          overflow:hidden;
        ">

          <div style="
            width:${percent}%;
            height:100%;
            background:currentColor;
            border-radius:10px;
          "></div>

        </div>

      </div>

    `;

  }

  // ==========================================================
  // 12. MESSAGE SCORE
  // ==========================================================

  function getScoreMessage(score) {

    if (score >= 80) {

      return "Configuration forte — plusieurs confirmations sont présentes.";

    }

    if (score >= 65) {

      return "Configuration intéressante — attendre la confirmation finale.";

    }

    if (score >= 50) {

      return "Configuration moyenne — prudence et confirmation recommandée.";

    }

    return "Configuration faible — mieux vaut attendre.";

  }

  // ==========================================================
  // 13. NORMALISATION SIGNAL
  // ==========================================================

  function normalizeSignal(value) {

    const signal =
      String(value || "WAIT")
        .trim()
        .toUpperCase();

    if (
      signal === "BUY" ||
      signal === "SELL"
    ) {

      return signal;

    }

    return "WAIT";

  }

  // ==========================================================
  // 14. FORMAT PRIX
  // ==========================================================

  function formatPrice(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return "—";

    }

    const number =
      Number(value);

    if (!Number.isFinite(number)) {

      return "—";

    }

    return String(number);

  }

  // ==========================================================
  // 15. NOMBRE SÛR
  // ==========================================================

  function safeNumber(value, fallback = 0) {

    const number =
      Number(value);

    if (!Number.isFinite(number)) {

      return fallback;

    }

    return number;

  }

  // ==========================================================
  // 16. PROTECTION HTML
  // ==========================================================

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }

  // ==========================================================
  // 17. ERREUR
  // ==========================================================

  function displayError(message) {

    if (!outputContainer) {
      return;
    }

    outputContainer.innerHTML = `

      <div style="
        color:#ff5c7a;
        background:rgba(255,0,0,0.08);
        border:1px solid rgba(255,0,0,0.18);
        padding:15px;
        border-radius:10px;
      ">

        <strong>
          ⚠️ Erreur ARKAS SCAN AI
        </strong>

        <div style="
          margin-top:7px;
          font-size:13px;
        ">
          ${escapeHtml(message)}
        </div>

      </div>

    `;

  }

});
