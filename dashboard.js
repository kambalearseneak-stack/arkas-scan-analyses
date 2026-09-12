// ============================================================
// ARKAS SCAN AI V2
// dashboard.js
// Frontend -> Proxy Vercel -> Gemini Vision
// SCAN + AUDIT DE L'ANALYSE EXISTANTE
// ============================================================

const PROXY_API_URL =
  "https://arkas-scan-analyses.vercel.app/api/analyze";

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================================
  // ELEMENTS
  // ==========================================================

  const loadingStatus =
    document.getElementById("user-status") ||
    document.querySelector(".header-status");

  const dropZone =
    document.getElementById("dropZone") ||
    document.querySelector(".upload-zone") ||
    document.querySelector(".border-dashed");

  const fileInput =
    document.getElementById("chartInput") ||
    document.getElementById("chart-file") ||
    document.querySelector('input[type="file"]');

  const scanBtn =
    document.getElementById("scanBtn") ||
    document.getElementById("analyze-btn");

  const auditBtn =
    document.getElementById("auditBtn") ||
    document.getElementById("verify-analysis-btn");

  const outputContainer =
    document.getElementById("analysisOutput") ||
    document.getElementById("results-content") ||
    document.querySelector(".report-container");

  const assetSelect =
    document.getElementById("assetSelect") ||
    document.getElementById("marketSelect");

  const timeframeSelect =
    document.getElementById("timeframeSelect");

  let selectedFile = null;
  let currentAnalysis = null;
  let currentMode = null;

  // ==========================================================
  // INITIALISATION
  // ==========================================================

  if (loadingStatus) {
    loadingStatus.style.display = "none";
  }

  if (!dropZone) {
    console.warn("ARKAS : zone d'upload introuvable.");
  }

  if (!fileInput) {
    console.warn("ARKAS : input fichier introuvable.");
  }

  if (!scanBtn) {
    console.warn("ARKAS : bouton analyse introuvable.");
  }

  if (!auditBtn) {
    console.warn(
      "ARKAS : bouton vérification introuvable. Ajoutez id='auditBtn'."
    );
  }

  // ==========================================================
  // CLIC ZONE UPLOAD
  // ==========================================================

  if (dropZone && fileInput) {

    dropZone.addEventListener("click", (event) => {

      if (event.target === fileInput) {
        return;
      }

      fileInput.click();

    });

  }

  // ==========================================================
  // CHOIX FICHIER
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
  // DRAG & DROP
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
  // VALIDATION FICHIER
  // ==========================================================

  function handleFileSelect(file) {

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

      displayError(
        "Format non supporté. Utilisez JPG, PNG ou WebP."
      );

      selectedFile = null;
      return;

    }

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {

      displayError(
        "Image trop volumineuse. Maximum : 10 MB."
      );

      selectedFile = null;
      return;

    }

    selectedFile = file;

    showPreview(file);

    clearResults();

  }

  // ==========================================================
  // PREVISUALISATION
  // ==========================================================

  function showPreview(file) {

    if (!dropZone) {
      return;
    }

    const reader =
      new FileReader();

    reader.onload = (event) => {

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

      image.src =
        event.target.result;

      image.alt =
        "Graphique sélectionné";

      image.style.maxWidth =
        "100%";

      image.style.maxHeight =
        "260px";

      image.style.borderRadius =
        "12px";

      image.style.objectFit =
        "contain";

      const status =
        document.createElement("p");

      status.textContent =
        "✓ Image prête";

      status.style.color =
        "#4ed9a2";

      status.style.fontSize =
        "12px";

      status.style.marginTop =
        "8px";

      const filename =
        document.createElement("small");

      filename.textContent =
        file.name;

      filename.style.opacity =
        "0.65";

      filename.style.fontSize =
        "11px";

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
  // BOUTON ANALYSER
  // ==========================================================

  if (scanBtn) {

    scanBtn.addEventListener(
      "click",
      (event) => {

        event.preventDefault();

        runAnalysis("scan");

      }
    );

  }

  // ==========================================================
  // BOUTON VERIFIER
  // ==========================================================

  if (auditBtn) {

    auditBtn.addEventListener(
      "click",
      (event) => {

        event.preventDefault();

        runAnalysis("audit");

      }
    );

  }

  // ==========================================================
  // ANALYSE PRINCIPALE
  // ==========================================================

  async function runAnalysis(mode) {

    if (!selectedFile) {

      displayError(
        mode === "audit"
          ? "Ajoutez d'abord votre graphique avec votre analyse visible."
          : "Ajoutez d'abord un graphique."
      );

      return;

    }

    currentMode = mode;

    setButtonsLoading(true, mode);

    clearResults();

    try {

      const base64Image =
        await convertFileToBase64(
          selectedFile
        );

      const asset =
        assetSelect?.value ||
        "AUTO";

      const timeframe =
        timeframeSelect?.value ||
        "AUTO";

      let prompt = "";

      // ======================================================
      // PROMPT SCAN
      // ======================================================

      if (mode === "scan") {

        prompt = `

Tu es ARKAS SCAN AI V2.

Analyse ce graphique de trading avec une approche
Smart Money Concepts (SMC) + Price Action.

IMPORTANT :
Tu dois utiliser uniquement les informations réellement
visibles sur l'image.

Identifie notamment :

- tendance
- structure
- BOS
- CHoCH
- liquidité
- liquidity sweep
- Order Block
- Fair Value Gap
- Premium / Discount
- support
- résistance
- cassure
- retest
- confirmation Price Action
- zone BUY
- zone SELL

Détermine ensuite le meilleur scénario.

Tu peux retourner :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

Ne force JAMAIS un BUY ou SELL.

Si l'entrée immédiate n'est pas suffisamment confirmée,
tu peux proposer un ordre LIMIT si une zone précise est
visible.

Si aucune configuration suffisamment claire n'existe :
WAIT.

Si tu proposes un trade, donne :

Entry
SL
TP1
TP2
TP3
RR

Donne également :

- confiance en %
- Score ARKAS /100
- scénario principal
- scénario alternatif
- invalidation
- gestion du risque
- raison de la décision

Ne fabrique jamais un prix qui n'est pas raisonnablement
lisible ou déductible du graphique.

`;

      }

      // ======================================================
      // PROMPT AUDIT
      // ======================================================

      if (mode === "audit") {

        prompt = `

Tu es ARKAS SCAN AI V2 en MODE AUDIT.

Le graphique peut déjà contenir une analyse faite par
l'utilisateur.

Cette analyse peut contenir :

- BUY / SELL
- BUY LIMIT / SELL LIMIT
- Entry
- Stop Loss
- Take Profit
- flèches
- lignes
- supports
- résistances
- Order Blocks
- FVG
- BOS
- CHoCH
- zones BUY
- zones SELL
- indicateurs ou annotations diverses

TA MISSION :

1. Lire les annotations visibles de l'utilisateur.
2. Identifier exactement ce que l'utilisateur semble proposer.
3. NE PAS considérer ces annotations comme automatiquement vraies.
4. Faire indépendamment ton propre examen de la structure visible.
5. Comparer l'analyse utilisateur avec la structure réelle.
6. Donner un verdict.

Les verdicts possibles sont :

VALIDATED
CORRECT
PREMATURE
INVALID
UNCLEAR

Signification :

VALIDATED =
l'analyse utilisateur est cohérente et l'entrée est
suffisamment confirmée.

CORRECT =
l'idée générale est correcte mais certains éléments
peuvent être améliorés.

PREMATURE =
l'idée est cohérente mais l'entrée est trop précoce et
une confirmation ou un retest est nécessaire.

INVALID =
l'analyse est incompatible avec la structure visible.

UNCLEAR =
l'image ne permet pas de confirmer correctement.

Tu dois pouvoir être en désaccord avec l'utilisateur.

Si son Entry, SL ou TP est incorrect, propose une correction
uniquement si les niveaux sont réellement visibles ou
raisonnablement déductibles du graphique.

Si l'analyse est invalide, propose le meilleur scénario
alternatif seulement si le graphique permet de le justifier.

Le résultat final doit contenir :

- verdict
- analyse utilisateur détectée
- points forts
- erreurs
- corrections
- trade corrigé
- confiance
- Score ARKAS
- structure
- liquidité
- Order Block
- FVG
- Price Action
- invalidation
- conclusion

IMPORTANT :
Ne transforme jamais une annotation utilisateur en vérité.
Sépare clairement :

"annotation détectée"

et

"annotation validée".

`;

      }

      // ======================================================
      // APPEL VERCEL
      // ======================================================

      const response =
        await fetch(
          PROXY_API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              imageBase64:
                base64Image,

              mimeType:
                selectedFile.type,

              prompt,

              mode,

              asset,

              timeframe

            })

          }
        );

      let data = null;

      try {

        data =
          await response.json();

      } catch {

        throw new Error(
          "Le serveur a retourné une réponse invalide."
        );

      }

      if (!response.ok) {

        throw new Error(
          data?.error ||
          `Erreur serveur (${response.status})`
        );

      }

      if (
        !data ||
        data.success !== true
      ) {

        throw new Error(
          data?.error ||
          "ARKAS n'a pas confirmé l'analyse."
        );

      }

      if (!data.analysis) {

        throw new Error(
          "Aucune analyse reçue."
        );

      }

      currentAnalysis =
        data.analysis;

      // ======================================================
      // AFFICHAGE
      // ======================================================

      if (mode === "audit") {

        displayAuditResults(
          data.analysis
        );

      } else {

        displayResults(
          data.analysis
        );

      }

    } catch (error) {

      console.error(
        "ARKAS SCAN AI :",
        error
      );

      displayError(
        error?.message ||
        "Erreur pendant l'analyse."
      );

    } finally {

      setButtonsLoading(
        false,
        null
      );

    }

  }

  // ==========================================================
  // CONVERSION BASE64
  // ==========================================================

  function convertFileToBase64(file) {

    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();

        reader.onload = () => {

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

        };

        reader.onerror = () => {

          reject(
            new Error(
              "Erreur lors de la lecture de l'image."
            )
          );

        };

        reader.readAsDataURL(file);

      }
    );

  }

  // ==========================================================
  // LOADING BOUTONS
  // ==========================================================

  function setButtonsLoading(
    isLoading,
    mode
  ) {

    if (scanBtn) {

      scanBtn.disabled =
        isLoading;

      scanBtn.style.opacity =
        isLoading ? "0.65" : "";

      scanBtn.style.cursor =
        isLoading ? "wait" : "";

      scanBtn.innerText =
        isLoading && mode === "scan"
          ? "🔎 ARKAS analyse..."
          : "🔍 ANALYSER LE GRAPHIQUE";

    }

    if (auditBtn) {

      auditBtn.disabled =
        isLoading;

      auditBtn.style.opacity =
        isLoading ? "0.65" : "";

      auditBtn.style.cursor =
        isLoading ? "wait" : "";

      auditBtn.innerText =
        isLoading && mode === "audit"
          ? "🧪 Vérification..."
          : "🧪 VÉRIFIER MON ANALYSE";

    }

  }

  // ==========================================================
  // RESULTAT SCAN
  // ==========================================================

  function displayResults(
    analysis
  ) {

    if (!outputContainer) {
      return;
    }

    const signal =
      normalizeExecution(
        analysis.signal ||
        analysis.direction
      );

    const direction =
      normalizeDirection(
        analysis.direction ||
        analysis.signal
      );

    const score =
      safeNumber(
        analysis.arkas_score,
        0
      );

    const confidence =
      safeNumber(
        analysis.confidence_percent,
        0
      );

    const signalColor =
      getSignalColor(direction);

    const signalIcon =
      getSignalIcon(direction);

    const asset =
      escapeHtml(
        analysis.asset ||
        assetSelect?.value ||
        "Marché"
      );

    const timeframe =
      escapeHtml(
        analysis.timeframe ||
        timeframeSelect?.value ||
        "N/A"
      );

    const entry =
      formatPrice(
        analysis.entry
      );

    const sl =
      formatPrice(
        analysis.sl
      );

    const tp1 =
      formatPrice(
        analysis.tp1
      );

    const tp2 =
      formatPrice(
        analysis.tp2
      );

    const tp3 =
      formatPrice(
        analysis.tp3
      );

    const rr =
      formatPrice(
        analysis.rr
      );

    const bias =
      escapeHtml(
        analysis.market_bias ||
        "NEUTRAL"
      );

    const reason =
      escapeHtml(
        analysis.reason ||
        "Aucune conclusion fournie."
      );

    const invalidation =
      escapeHtml(
        analysis.invalidation ||
        "Non précisée."
      );

    const riskWarning =
      escapeHtml(
        analysis.risk_warning ||
        "Gestion du risque indispensable."
      );

    const primary =
      escapeHtml(
        analysis.primary_scenario ||
        "Non précisé."
      );

    const alternative =
      escapeHtml(
        analysis.alternative_scenario ||
        "Non précisé."
      );

    const risk =
      analysis.risk_management ||
      {};

    const lot =
      risk.lot ||
      risk.lots ||
      "—";

    outputContainer.innerHTML = `

      <div class="arkas-analysis">

        ${signalBanner(
          signal,
          signalColor,
          signalIcon,
          confidence
        )}

        <div class="arkas-card">

          <div class="arkas-card-title">
            📌 Marché
          </div>

          <div class="arkas-market-grid">

            ${infoCard(
              "ACTIF",
              asset
            )}

            ${infoCard(
              "TIMEFRAME",
              timeframe
            )}

            ${infoCard(
              "BIAIS",
              bias
            )}

            ${infoCard(
              "CONFIANCE",
              confidence + "%"
            )}

          </div>

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            🎯 PLAN DE TRADE
          </div>

          <div class="arkas-price-grid">

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
              "TP3",
              tp3
            )}

            ${priceCard(
              "RISK / REWARD",
              rr
            )}

          </div>

          <div class="arkas-lot">
            💼 Lot indicatif :
            <strong>
              ${escapeHtml(
                String(lot)
              )}
            </strong>
          </div>

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            📊 SCORE ARKAS
          </div>

          <div class="arkas-score-number">
            ${score}/100
          </div>

          <div class="arkas-progress">
            <div style="
              width:${clamp(score)}%;
              background:${signalColor};
            "></div>
          </div>

          <div class="arkas-score-message">
            ${escapeHtml(
              getScoreMessage(score)
            )}
          </div>

        </div>

        ${renderStructure(
          analysis
        )}

        ${renderLiquidity(
          analysis
        )}

        ${renderOrderBlock(
          analysis
        )}

        ${renderFVG(
          analysis
        )}

        ${renderPriceAction(
          analysis
        )}

        <div class="arkas-card">

          <div class="arkas-card-title">
            🧠 CONCLUSION ARKAS
          </div>

          <p>
            ${reason}
          </p>

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            🔵 SCÉNARIO PRINCIPAL
          </div>

          <p>
            ${primary}
          </p>

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            🟡 SCÉNARIO ALTERNATIF
          </div>

          <p>
            ${alternative}
          </p>

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            🚫 INVALIDATION
          </div>

          <p>
            ${invalidation}
          </p>

        </div>

        <div class="arkas-copy-zone">

          <button
            type="button"
            id="copySignalBtn"
            class="arkas-copy-btn"
          >
            📋 COPIER LE SIGNAL
          </button>

        </div>

        <div class="arkas-warning">
          ⚠️ ${riskWarning}
        </div>

      </div>

    `;

    attachCopyButton(
      analysis,
      false
    );

  }

  // ==========================================================
  // RESULTAT AUDIT
  // ==========================================================

  function displayAuditResults(
    analysis
  ) {

    if (!outputContainer) {
      return;
    }

    const audit =
      analysis.audit ||
      {};

    const status =
      String(
        audit.status ||
        "UNCLEAR"
      ).toUpperCase();

    const detected =
      audit.detected_user_analysis ||
      {};

    const corrected =
      audit.corrected_trade ||
      {};

    const statusInfo =
      getAuditStatus(status);

    const confidence =
      safeNumber(
        analysis.confidence_percent,
        0
      );

    const score =
      safeNumber(
        analysis.arkas_score,
        0
      );

    const detectedDirection =
      escapeHtml(
        detected.direction ||
        "UNKNOWN"
      );

    const detectedEntry =
      formatPrice(
        detected.entry
      );

    const detectedSL =
      formatPrice(
        detected.sl
      );

    const detectedTP1 =
      formatPrice(
        detected.tp1
      );

    const detectedTP2 =
      formatPrice(
        detected.tp2
      );

    const detectedTP3 =
      formatPrice(
        detected.tp3
      );

    const correctedSignal =
      escapeHtml(
        corrected.signal ||
        analysis.signal ||
        "WAIT"
      );

    const correctedEntry =
      formatPrice(
        corrected.entry ??
        analysis.entry
      );

    const correctedSL =
      formatPrice(
        corrected.sl ??
        analysis.sl
      );

    const correctedTP1 =
      formatPrice(
        corrected.tp1 ??
        analysis.tp1
      );

    const correctedTP2 =
      formatPrice(
        corrected.tp2 ??
        analysis.tp2
      );

    const correctedTP3 =
      formatPrice(
        corrected.tp3 ??
        analysis.tp3
      );

    const correctedRR =
      formatPrice(
        corrected.rr ??
        analysis.rr
      );

    outputContainer.innerHTML = `

      <div class="arkas-analysis">

        <div style="
          padding:22px;
          margin-bottom:14px;
          border-radius:15px;
          text-align:center;
          background:${statusInfo.background};
          border:1px solid ${statusInfo.border};
        ">

          <div style="
            font-size:12px;
            opacity:0.75;
          ">
            🧪 ARKAS AUDIT
          </div>

          <div style="
            font-size:27px;
            font-weight:800;
            color:${statusInfo.color};
            margin-top:7px;
          ">
            ${statusInfo.icon}
            ${statusInfo.label}
          </div>

          <div style="
            margin-top:8px;
            font-size:13px;
          ">
            Confiance ARKAS :
            <strong>
              ${confidence}%
            </strong>
          </div>

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            📝 ANALYSE DÉTECTÉE
          </div>

          <div class="arkas-price-grid">

            ${priceCard(
              "DIRECTION",
              detectedDirection
            )}

            ${priceCard(
              "ENTRY",
              detectedEntry
            )}

            ${priceCard(
              "SL",
              detectedSL
            )}

            ${priceCard(
              "TP1",
              detectedTP1
            )}

            ${priceCard(
              "TP2",
              detectedTP2
            )}

            ${priceCard(
              "TP3",
              detectedTP3
            )}

          </div>

          <p style="margin-top:14px;">
            <strong>Setup détecté :</strong>
            ${escapeHtml(
              detected.claimed_setup ||
              "Non précisé."
            )}
          </p>

          ${
            renderArray(
              "Annotations détectées",
              detected.annotations
            )
          }

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            ⚖️ VERDICT ARKAS
          </div>

          <p>
            ${escapeHtml(
              audit.verdict ||
              "Aucun verdict détaillé."
            )}
          </p>

        </div>

        ${
          renderArray(
            "✅ Points forts",
            audit.strengths
          )
        }

        ${
          renderArray(
            "⚠️ Erreurs détectées",
            audit.errors
          )
        }

        ${
          renderArray(
            "🔧 Corrections proposées",
            audit.corrections
          )
        }

        <div class="arkas-card">

          <div class="arkas-card-title">
            🎯 SIGNAL FINAL ARKAS
          </div>

          <div style="
            font-size:24px;
            font-weight:800;
            margin-bottom:15px;
          ">
            ${correctedSignal}
          </div>

          <div class="arkas-price-grid">

            ${priceCard(
              "ENTRY",
              correctedEntry
            )}

            ${priceCard(
              "SL",
              correctedSL
            )}

            ${priceCard(
              "TP1",
              correctedTP1
            )}

            ${priceCard(
              "TP2",
              correctedTP2
            )}

            ${priceCard(
              "TP3",
              correctedTP3
            )}

            ${priceCard(
              "RR",
              correctedRR
            )}

          </div>

        </div>

        <div class="arkas-card">

          <div class="arkas-card-title">
            📊 SCORE ARKAS
          </div>

          <div class="arkas-score-number">
            ${score}/100
          </div>

          <div class="arkas-progress">
            <div style="
              width:${clamp(score)}%;
            "></div>
          </div>

        </div>

        ${renderStructure(
          analysis
        )}

        ${renderLiquidity(
          analysis
        )}

        ${renderOrderBlock(
          analysis
        )}

        ${renderFVG(
          analysis
        )}

        ${renderPriceAction(
          analysis
        )}

        <div class="arkas-card">

          <div class="arkas-card-title">
            🚫 INVALIDATION
          </div>

          <p>
            ${escapeHtml(
              analysis.invalidation ||
              "Non précisée."
            )}
          </p>

        </div>

        <div class="arkas-copy-zone">

          <button
            type="button"
            id="copySignalBtn"
            class="arkas-copy-btn"
          >
            📋 COPIER LE SIGNAL FINAL
          </button>

        </div>

        <div class="arkas-warning">
          ⚠️ L'audit est une aide à la décision.
          Vérifiez toujours le graphique avant toute prise
          de position réelle.
        </div>

      </div>

    `;

    attachCopyButton(
      analysis,
      true
    );

  }

  // ==========================================================
  // BANNIERE SIGNAL
  // ==========================================================

  function signalBanner(
    signal,
    color,
    icon,
    confidence
  ) {

    return `

      <div style="
        padding:22px;
        margin-bottom:14px;
        border-radius:15px;
        text-align:center;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.08);
      ">

        <div style="
          font-size:12px;
          opacity:0.65;
        ">
          SIGNAL ARKAS
        </div>

        <div style="
          color:${color};
          font-size:29px;
          font-weight:900;
          margin-top:5px;
        ">
          ${icon}
          ${escapeHtml(signal)}
        </div>

        <div style="
          margin-top:7px;
          font-size:12px;
          opacity:0.75;
        ">
          Confiance :
          <strong>
            ${confidence}%
          </strong>
        </div>

      </div>

    `;

  }

  // ==========================================================
  // STRUCTURE
  // ==========================================================

  function renderStructure(
    analysis
  ) {

    const structure =
      analysis.structure ||
      {};

    return `

      <div class="arkas-card">

        <div class="arkas-card-title">
          📊 STRUCTURE DU MARCHÉ
        </div>

        <p>
          <strong>BOS :</strong>
          ${escapeHtml(
            structure.bos ||
            "Non identifié"
          )}
        </p>

        <p>
          <strong>CHoCH :</strong>
          ${escapeHtml(
            structure.choch ||
            "Non identifié"
          )}
        </p>

        <p>
          ${escapeHtml(
            structure.description ||
            "Aucune description."
          )}
        </p>

      </div>

    `;

  }

  // ==========================================================
  // LIQUIDITE
  // ==========================================================

  function renderLiquidity(
    analysis
  ) {

    const liquidity =
      analysis.liquidity ||
      {};

    return `

      <div class="arkas-card">

        <div class="arkas-card-title">
          💧 LIQUIDITÉ
        </div>

        <p>
          <strong>Type :</strong>
          ${escapeHtml(
            liquidity.type ||
            "Non identifiée"
          )}
        </p>

        <p>
          ${escapeHtml(
            liquidity.description ||
            "Aucune description."
          )}
        </p>

      </div>

    `;

  }

  // ==========================================================
  // ORDER BLOCK
  // ==========================================================

  function renderOrderBlock(
    analysis
  ) {

    const ob =
      analysis.order_block ||
      {};

    return `

      <div class="arkas-card">

        <div class="arkas-card-title">
          🧱 ORDER BLOCK
        </div>

        <p>
          <strong>Détecté :</strong>
          ${ob.detected ? "Oui" : "Non"}
        </p>

        <p>
          <strong>Type :</strong>
          ${escapeHtml(
            ob.type ||
            "N/A"
          )}
        </p>

        <p>
          <strong>Zone :</strong>
          ${escapeHtml(
            ob.zone ||
            "N/A"
          )}
        </p>

        <p>
          ${escapeHtml(
            ob.description ||
            "Aucune description."
          )}
        </p>

      </div>

    `;

  }

  // ==========================================================
  // FVG
  // ==========================================================

  function renderFVG(
    analysis
  ) {

    const fvg =
      analysis.fvg ||
      {};

    return `

      <div class="arkas-card">

        <div class="arkas-card-title">
          ⚡ FAIR VALUE GAP
        </div>

        <p>
          <strong>Détecté :</strong>
          ${fvg.detected ? "Oui" : "Non"}
        </p>

        <p>
          <strong>Type :</strong>
          ${escapeHtml(
            fvg.type ||
            "N/A"
          )}
        </p>

        <p>
          <strong>Zone :</strong>
          ${escapeHtml(
            fvg.zone ||
            "N/A"
          )}
        </p>

        <p>
          ${escapeHtml(
            fvg.description ||
            "Aucune description."
          )}
        </p>

      </div>

    `;

  }

  // ==========================================================
  // PRICE ACTION
  // ==========================================================

  function renderPriceAction(
    analysis
  ) {

    const pa =
      analysis.price_action ||
      {};

    return `

      <div class="arkas-card">

        <div class="arkas-card-title">
          🕯️ PRICE ACTION
        </div>

        <p>
          <strong>Confirmation :</strong>
          ${escapeHtml(
            pa.confirmation ||
            "N/A"
          )}
        </p>

        <p>
          ${escapeHtml(
            pa.description ||
            "Aucune description."
          )}
        </p>

      </div>

    `;

  }

  // ==========================================================
  // CARTE INFO
  // ==========================================================

  function infoCard(
    label,
    value
  ) {

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
          font-size:14px;
          font-weight:700;
          margin-top:5px;
        ">
          ${escapeHtml(value)}
        </div>

      </div>

    `;

  }

  // ==========================================================
  // CARTE PRIX
  // ==========================================================

  function priceCard(
    label,
    value
  ) {

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
  // LISTE
  // ==========================================================

  function renderArray(
    title,
    array
  ) {

    if (
      !Array.isArray(array) ||
      !array.length
    ) {

      return "";

    }

    return `

      <div class="arkas-card">

        <div class="arkas-card-title">
          ${escapeHtml(title)}
        </div>

        <ul style="
          margin:10px 0 0 18px;
          padding:0;
        ">

          ${array.map(
            item => `
              <li style="
                margin-bottom:7px;
              ">
                ${escapeHtml(
                  String(item)
                )}
              </li>
            `
          ).join("")}

        </ul>

      </div>

    `;

  }

  // ==========================================================
  // COPIER SIGNAL
  // ==========================================================

  function attachCopyButton(
    analysis,
    isAudit
  ) {

    const button =
      document.getElementById(
        "copySignalBtn"
      );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      async () => {

        let text = "";

        if (isAudit) {

          const audit =
            analysis.audit ||
            {};

          const trade =
            audit.corrected_trade ||
            {};

          text = `
ARKAS SCAN AI V2 — AUDIT

Verdict : ${audit.status || "UNCLEAR"}

Signal final : ${
            trade.signal ||
            analysis.signal ||
            "WAIT"
          }

Entry : ${
            formatPrice(
              trade.entry ??
              analysis.entry
            )
          }

SL : ${
            formatPrice(
              trade.sl ??
              analysis.sl
            )
          }

TP1 : ${
            formatPrice(
              trade.tp1 ??
              analysis.tp1
            )
          }

TP2 : ${
            formatPrice(
              trade.tp2 ??
              analysis.tp2
            )
          }

TP3 : ${
            formatPrice(
              trade.tp3 ??
              analysis.tp3
            )
          }

RR : ${
            formatPrice(
              trade.rr ??
              analysis.rr
            )
          }

Score ARKAS : ${
            safeNumber(
              analysis.arkas_score,
              0
            )
          }/100

Confiance : ${
            safeNumber(
              analysis.confidence_percent,
              0
            )
          }%

Verdict :
${
            audit.verdict ||
            ""
          }
`;

        } else {

          text = `
ARKAS SCAN AI V2

Signal : ${
            analysis.signal ||
            analysis.direction ||
            "WAIT"
          }

Actif : ${
            analysis.asset ||
            "N/A"
          }

Timeframe : ${
            analysis.timeframe ||
            "N/A"
          }

Entry : ${
            formatPrice(
              analysis.entry
            )
          }

SL : ${
            formatPrice(
              analysis.sl
            )
          }

TP1 : ${
            formatPrice(
              analysis.tp1
            )
          }

TP2 : ${
            formatPrice(
              analysis.tp2
            )
          }

TP3 : ${
            formatPrice(
              analysis.tp3
            )
          }

RR : ${
            formatPrice(
              analysis.rr
            )
          }

Score ARKAS : ${
            safeNumber(
              analysis.arkas_score,
              0
            )
          }/100

Confiance : ${
            safeNumber(
              analysis.confidence_percent,
              0
            )
          }%

Conclusion :
${
            analysis.reason ||
            ""
          }
`;

        }

        try {

          await navigator.clipboard.writeText(
            text.trim()
          );

          const oldText =
            button.innerText;

          button.innerText =
            "✅ SIGNAL COPIÉ";

          setTimeout(() => {

            button.innerText =
              oldText;

          }, 1800);

        } catch (error) {

          console.error(
            "Copie impossible :",
            error
          );

          displayError(
            "Impossible de copier le signal."
          );

        }

      }
    );

  }

  // ==========================================================
  // SIGNAL
  // ==========================================================

  function normalizeExecution(
    value
  ) {

    const signal =
      String(
        value ||
        "WAIT"
      )
        .trim()
        .toUpperCase();

    const valid = [
      "BUY NOW",
      "SELL NOW",
      "BUY LIMIT",
      "SELL LIMIT",
      "WAIT"
    ];

    if (
      valid.includes(signal)
    ) {

      return signal;

    }

    if (signal.includes("BUY")) {
      return "BUY NOW";
    }

    if (signal.includes("SELL")) {
      return "SELL NOW";
    }

    return "WAIT";

  }

  function normalizeDirection(
    value
  ) {

    const signal =
      String(
        value ||
        ""
      )
        .trim()
        .toUpperCase();

    if (
      signal.includes("BUY")
    ) {

      return "BUY";

    }

    if (
      signal.includes("SELL")
    ) {

      return "SELL";

    }

    return "WAIT";

  }

  function getSignalColor(
    direction
  ) {

    if (direction === "BUY") {
      return "#4ed9a2";
    }

    if (direction === "SELL") {
      return "#ff5c7a";
    }

    return "#9aa4b2";

  }

  function getSignalIcon(
    direction
  ) {

    if (direction === "BUY") {
      return "▲";
    }

    if (direction === "SELL") {
      return "▼";
    }

    return "⏳";

  }

  // ==========================================================
  // AUDIT STATUS
  // ==========================================================

  function getAuditStatus(
    status
  ) {

    const statuses = {

      VALIDATED: {
        icon: "✅",
        label: "ANALYSE VALIDÉE",
        color: "#4ed9a2",
        background:
          "rgba(78,217,162,0.08)",
        border:
          "rgba(78,217,162,0.25)"
      },

      CORRECT: {
        icon: "🟢",
        label: "ANALYSE CORRECTE",
        color: "#4ed9a2",
        background:
          "rgba(78,217,162,0.08)",
        border:
          "rgba(78,217,162,0.25)"
      },

      PREMATURE: {
        icon: "🟡",
        label:
          "ANALYSE CORRECTE MAIS ENTRÉE PRÉMATURÉE",
        color: "#ffc857",
        background:
          "rgba(255,200,87,0.08)",
        border:
          "rgba(255,200,87,0.25)"
      },

      INVALID: {
        icon: "❌",
        label: "ANALYSE INVALIDÉE",
        color: "#ff5c7a",
        background:
          "rgba(255,92,122,0.08)",
        border:
          "rgba(255,92,122,0.25)"
      },

      UNCLEAR: {
        icon: "❔",
        label: "ANALYSE INCERTAINE",
        color: "#9aa4b2",
        background:
          "rgba(154,164,178,0.08)",
        border:
          "rgba(154,164,178,0.25)"
      }

    };

    return (
      statuses[status] ||
      statuses.UNCLEAR
    );

  }

  // ==========================================================
  // SCORE
  // ==========================================================

  function getScoreMessage(
    score
  ) {

    if (score >= 80) {

      return "Configuration forte — plusieurs confirmations sont présentes.";

    }

    if (score >= 65) {

      return "Configuration intéressante — confirmation finale recommandée.";

    }

    if (score >= 50) {

      return "Configuration moyenne — prudence.";

    }

    return "Configuration faible — mieux vaut attendre.";

  }

  // ==========================================================
  // FORMAT PRICE
  // ==========================================================

  function formatPrice(
    value
  ) {

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
  // SAFE NUMBER
  // ==========================================================

  function safeNumber(
    value,
    fallback = 0
  ) {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;

  }

  // ==========================================================
  // CLAMP
  // ==========================================================

  function clamp(
    value
  ) {

    return Math.max(
      0,
      Math.min(
        100,
        safeNumber(
          value,
          0
        )
      )
    );

  }

  // ==========================================================
  // ESCAPE HTML
  // ==========================================================

  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }

  // ==========================================================
  // CLEAR
  // ==========================================================

  function clearResults() {

    if (!outputContainer) {
      return;
    }

    outputContainer.innerHTML = `

      <div style="
        padding:18px;
        text-align:center;
        opacity:0.7;
      ">

        🔎 ARKAS SCAN AI est prêt.

      </div>

    `;

  }

  // ==========================================================
  // ERROR
  // ==========================================================

  function displayError(
    message
  ) {

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
