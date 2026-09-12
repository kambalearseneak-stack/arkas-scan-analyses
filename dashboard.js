// ============================================================
// ARKAS SCAN AI V2 - DASHBOARD.JS
// Import automatique + détection actif/timeframe
// ============================================================

const fileInput = document.getElementById("chart-file");
const dropZone = document.getElementById("dropZone");
const importBtn = document.getElementById("import-btn");

const previewContainer = document.getElementById("preview-container");
const imagePreview = document.getElementById("image-preview");
const fileNameEl = document.getElementById("file-name");

const detectedInfo = document.getElementById("detected-info");
const detectedAsset = document.getElementById("detected-asset");
const detectedTimeframe = document.getElementById("detected-timeframe");

const scannerActions = document.getElementById("scanner-actions");
const analyzeBtn = document.getElementById("analyze-btn");
const auditBtn = document.getElementById("auditBtn");

const analysisStatus = document.getElementById("analysis-status");
const resultsContent = document.getElementById("results-content");
const resultsSection = document.getElementById("results-section");

let selectedFile = null;
let selectedBase64 = null;
let selectedMimeType = null;
let isProcessing = false;

// ============================================================
// INITIALISATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    setupUpload();
    setupButtons();
});

// ============================================================
// IMPORT IMAGE
// ============================================================

function setupUpload() {

    // Bouton principal
    if (importBtn) {
        importBtn.addEventListener("click", (event) => {
            event.stopPropagation();

            if (fileInput) {
                fileInput.value = "";
                fileInput.click();
            }
        });
    }

    // Zone entière
    if (dropZone) {
        dropZone.addEventListener("click", (event) => {

            // Ne pas déclencher deux fois si on clique sur le bouton
            if (event.target.closest("#import-btn")) {
                return;
            }

            if (fileInput) {
                fileInput.value = "";
                fileInput.click();
            }
        });

        // Clavier
        dropZone.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();

                if (fileInput) {
                    fileInput.value = "";
                    fileInput.click();
                }
            }
        });

        // Drag & Drop ordinateur
        dropZone.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropZone.classList.add("drag-active");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-active");
        });

        dropZone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropZone.classList.remove("drag-active");

            const files = event.dataTransfer.files;

            if (files && files.length > 0) {
                handleFile(files[0]);
            }
        });
    }

    // Sélection depuis Android / ordinateur
    if (fileInput) {
        fileInput.addEventListener("change", (event) => {

            const files = event.target.files;

            if (!files || files.length === 0) {
                return;
            }

            handleFile(files[0]);
        });
    }
}

// ============================================================
// VALIDATION DU FICHIER
// ============================================================

function handleFile(file) {

    if (!file) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const maxSize = 10 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
        showStatus(
            "❌ Format non supporté. Utilise JPG, PNG ou WEBP.",
            "error"
        );
        return;
    }

    if (file.size > maxSize) {
        showStatus(
            "❌ Image trop lourde. Maximum : 10 MB.",
            "error"
        );
        return;
    }

    selectedFile = file;
    selectedMimeType = file.type;

    showStatus(
        "⏳ Chargement de la capture...",
        "loading"
    );

    readImage(file);
}

// ============================================================
// LECTURE IMAGE
// ============================================================

function readImage(file) {

    const reader = new FileReader();

    reader.onload = function(event) {

        try {

            const result = event.target.result;

            if (!result || typeof result !== "string") {
                throw new Error("Image illisible");
            }

            selectedBase64 = result;

            // Aperçu immédiat
            if (imagePreview) {
                imagePreview.src = result;
            }

            if (fileNameEl) {
                fileNameEl.textContent = file.name;
            }

            if (previewContainer) {
                previewContainer.style.display = "block";
            }

            if (detectedInfo) {
                detectedInfo.style.display = "grid";
            }

            if (scannerActions) {
                scannerActions.style.display = "flex";
            }

            if (detectedAsset) {
                detectedAsset.textContent = "Détection automatique";
            }

            if (detectedTimeframe) {
                detectedTimeframe.textContent = "Détection automatique";
            }

            if (dropZone) {
                dropZone.classList.add("has-image");
            }

            showStatus(
                "✅ Capture chargée. ARKAS peut maintenant l'analyser.",
                "success"
            );

            // Aller doucement vers les boutons sur mobile
            setTimeout(() => {
                if (scannerActions) {
                    scannerActions.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                }
            }, 250);

        } catch (error) {

            console.error(error);

            resetImage();

            showStatus(
                "❌ Impossible de lire cette image.",
                "error"
            );
        }
    };

    reader.onerror = function() {

        resetImage();

        showStatus(
            "❌ Erreur pendant le chargement de l'image.",
            "error"
        );
    };

    reader.readAsDataURL(file);
}

// ============================================================
// BOUTONS
// ============================================================

function setupButtons() {

    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", () => {
            sendAnalysis("scan");
        });
    }

    if (auditBtn) {
        auditBtn.addEventListener("click", () => {
            sendAnalysis("audit");
        });
    }
}

// ============================================================
// ANALYSE / AUDIT
// ============================================================

async function sendAnalysis(mode) {

    if (isProcessing) {
        return;
    }

    if (!selectedBase64) {
        showStatus(
            "⚠️ Importe d'abord une capture.",
            "error"
        );
        return;
    }

    isProcessing = true;

    setButtonsLoading(true);

    if (mode === "audit") {

        showStatus(
            "🧪 ARKAS vérifie ton analyse...",
            "loading"
        );

    } else {

        showStatus(
            "🔍 ARKAS analyse la capture...",
            "loading"
        );
    }

    if (resultsContent) {
        resultsContent.innerHTML = `
            <div class="empty-result">
                <div>🧠</div>
                <h3>Analyse en cours...</h3>
                <p>ARKAS examine la structure, la liquidité et le Price Action.</p>
            </div>
        `;
    }

    try {

        const cleanBase64 = selectedBase64.includes(",")
            ? selectedBase64.split(",")[1]
            : selectedBase64;

        const prompt =
            mode === "audit"
                ? buildAuditPrompt()
                : buildScanPrompt();

        const response = await fetch("/api/analyze", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                imageBase64: cleanBase64,

                mimeType: selectedMimeType,

                asset: "AUTO",

                timeframe: "AUTO",

                mode: mode,

                prompt: prompt
            })
        });

        const rawText = await response.text();

        let data;

        try {
            data = JSON.parse(rawText);
        } catch (error) {

            console.error("Réponse serveur non JSON :", rawText);

            throw new Error(
                "Le serveur a retourné une réponse invalide."
            );
        }

        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                `Erreur serveur HTTP ${response.status}`
            );
        }

        if (!data) {
            throw new Error("Réponse vide du serveur.");
        }

        // Mise à jour détection
        updateDetection(data);

        // Affichage résultat
        if (mode === "audit") {
            renderAudit(data);
        } else {
            renderScan(data);
        }

        showStatus(
            mode === "audit"
                ? "✅ Vérification terminée."
                : "✅ Analyse terminée.",
            "success"
        );

        if (resultsSection) {
            setTimeout(() => {
                resultsSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }, 250);
        }

    } catch (error) {

        console.error("ARKAS ERROR:", error);

        if (resultsContent) {

            resultsContent.innerHTML = `
                <div class="empty-result error-result">
                    <div>❌</div>
                    <h3>Analyse impossible</h3>
                    <p>${escapeHtml(error.message)}</p>
                </div>
            `;
        }

        showStatus(
            "❌ " + error.message,
            "error"
        );

    } finally {

        isProcessing = false;

        setButtonsLoading(false);
    }
}

// ============================================================
// PROMPT SCAN
// ============================================================

function buildScanPrompt() {

    return `
Tu es ARKAS SCAN AI, un analyste spécialisé en Price Action et Smart Money Concepts.

IMPORTANT :
L'utilisateur ne choisit NI l'actif NI le timeframe.

Tu dois donc analyser directement la capture d'écran.

DÉTECTION AUTOMATIQUE :
1. Identifie l'actif si son nom ou symbole est visible.
2. Identifie le timeframe si celui-ci est visible.
3. Tu peux détecter notamment :
   - XAUUSD / GOLD
   - BTCUSD / BTCUSDT
   - ETHUSD / ETHUSDT
   - autres cryptomonnaies
   - EURUSD
   - GBPUSD
   - USDJPY
   - AUDUSD
   - USDCAD
   - USDCHF
   - indices
   - autres instruments.
4. Ne devine jamais un actif ou timeframe qui n'est pas suffisamment visible.
5. Si impossible à déterminer, retourne "UNKNOWN".

ANALYSE :
- Structure du marché
- Tendance
- BOS
- CHoCH
- Liquidité
- Liquidity sweep
- Order Block
- Fair Value Gap
- Support
- Résistance
- Price Action
- Breakout
- Retest
- Confirmation
- Zone d'achat
- Zone de vente

DÉCISION :
Tu dois choisir parmi :
- BUY NOW
- SELL NOW
- BUY LIMIT
- SELL LIMIT
- WAIT

Ne donne pas BUY ou SELL simplement parce que le graphique monte ou descend.

Pour BUY NOW ou SELL NOW :
donne Entry, SL, TP1, TP2, TP3 et RR.

Pour BUY LIMIT :
donne le prix exact de l'entrée limite.

Pour SELL LIMIT :
donne le prix exact de l'entrée limite.

Si la configuration n'est pas suffisamment confirmée :
WAIT.

DONNE :
- signal
- direction
- execution
- confidence_percent
- asset
- timeframe
- entry
- sl
- tp1
- tp2
- tp3
- rr
- ARKAS score
- BOS
- CHoCH
- liquidity
- order block
- FVG
- price action
- scénario principal
- scénario alternatif
- invalidation
- gestion du risque
- explication claire.

Si des annotations existent déjà sur la capture, observe-les mais ne les considère PAS automatiquement comme correctes.

Ne fabrique aucune actualité économique.
Si aucune actualité n'est visible ou vérifiable, indique simplement qu'elle n'est pas disponible depuis la capture.

Réponds uniquement avec le JSON attendu par le serveur.
`;
}

// ============================================================
// PROMPT AUDIT
// ============================================================

function buildAuditPrompt() {

    return `
Tu es ARKAS SCAN AI en MODE AUDIT.

Analyse la capture d'écran comme un contrôleur indépendant.

L'utilisateur peut avoir déjà placé :
- BUY
- SELL
- Entry
- SL
- TP
- lignes
- zones
- flèches
- BOS
- CHoCH
- Order Blocks
- FVG
- autres annotations.

IMPORTANT :
Ne considère JAMAIS une annotation comme correcte simplement parce qu'elle est présente.

Tu dois déterminer :
1. L'actif visible.
2. Le timeframe visible.
3. La structure réelle du marché.
4. Si l'analyse de l'utilisateur est cohérente.
5. Si l'entrée est confirmée ou prématurée.
6. Si le SL est logique.
7. Si les TP sont logiques.
8. Si le RR est acceptable.
9. Si les zones correspondent réellement au Price Action.

STATUT D'AUDIT :
- VALIDATED = analyse correctement confirmée
- CORRECT = analyse globalement correcte mais améliorable
- PREMATURE = direction potentiellement correcte mais entrée trop tôt
- INVALID = analyse incorrecte
- UNCLEAR = capture insuffisante

Si l'analyse est incorrecte ou prématurée :
propose une correction.

La correction doit inclure :
- signal
- entry
- sl
- tp1
- tp2
- tp3
- rr

DÉTECTION AUTOMATIQUE :
L'utilisateur n'a choisi aucun actif ni timeframe.
Détecte-les depuis la capture.
Si impossible : "UNKNOWN".

Ne fabrique aucune actualité économique.

Réponds uniquement avec le JSON attendu par le serveur.
`;
}

// ============================================================
// DÉTECTION
// ============================================================

function updateDetection(data) {

    const asset =
        data.asset ||
        data.detected_asset ||
        data.instrument ||
        "UNKNOWN";

    const timeframe =
        data.timeframe ||
        data.detected_timeframe ||
        "UNKNOWN";

    if (detectedAsset) {
        detectedAsset.textContent = formatDetectedValue(asset);
    }

    if (detectedTimeframe) {
        detectedTimeframe.textContent =
            formatDetectedValue(timeframe);
    }

    if (detectedInfo) {
        detectedInfo.style.display = "grid";
    }
}

// ============================================================
// AFFICHAGE SCAN
// ============================================================

function renderScan(data) {

    const signal = data.signal || "WAIT";
    const direction = data.direction || "-";

    const execution = data.execution || "-";
    const confidence = data.confidence_percent ?? "-";

    const entry = data.entry ?? "-";
    const sl = data.sl ?? "-";
    const tp1 = data.tp1 ?? "-";
    const tp2 = data.tp2 ?? "-";
    const tp3 = data.tp3 ?? "-";
    const rr = data.rr ?? "-";

    const score = data.arkas_score ?? "-";

    if (!resultsContent) {
        return;
    }

    resultsContent.innerHTML = `

        <div class="result-card">

            <div class="signal-header">

                <div>
                    <span class="result-label">SIGNAL ARKAS</span>

                    <h2 class="${getSignalClass(signal)}">
                        ${escapeHtml(signal)}
                    </h2>

                    <p>
                        Direction :
                        <strong>${escapeHtml(direction)}</strong>
                    </p>

                </div>

                <div class="confidence-box">
                    <span>Confiance</span>
                    <strong>${escapeHtml(confidence)}%</strong>
                </div>

            </div>

            <div class="metrics-grid">

                ${metric("Actif", data.asset || "UNKNOWN")}

                ${metric("Timeframe", data.timeframe || "UNKNOWN")}

                ${metric("Exécution", execution)}

                ${metric("ARKAS Score", score)}

            </div>

            <div class="trade-plan">

                <h3>🎯 PLAN DE TRADE</h3>

                ${tradeRow("Entry", entry)}

                ${tradeRow("Stop Loss", sl)}

                ${tradeRow("TP1", tp1)}

                ${tradeRow("TP2", tp2)}

                ${tradeRow("TP3", tp3)}

                ${tradeRow("Risk / Reward", rr)}

            </div>

            <div class="analysis-details">

                ${detailBlock(
                    "📐 Structure",
                    data.structure
                )}

                ${detailBlock(
                    "💧 Liquidité",
                    data.liquidity
                )}

                ${detailBlock(
                    "🧱 Order Block",
                    data.order_block
                )}

                ${detailBlock(
                    "📦 FVG",
                    data.fvg
                )}

                ${detailBlock(
                    "📈 Price Action",
                    data.price_action
                )}

                ${detailBlock(
                    "🧠 Scénario principal",
                    data.primary_scenario
                )}

                ${detailBlock(
                    "🔄 Scénario alternatif",
                    data.alternative_scenario
                )}

                ${detailBlock(
                    "🚨 Invalidation",
                    data.invalidation
                )}

            </div>

            <div class="reason-box">

                <h3>🧠 Pourquoi ?</h3>

                <p>
                    ${escapeHtml(
                        data.reason ||
                        "Aucune explication fournie."
                    )}
                </p>

            </div>

            <button
                type="button"
                class="copy-signal-btn"
                id="copySignalBtn">
                📋 COPIER LE SIGNAL
            </button>

        </div>
    `;

    const copyBtn = document.getElementById("copySignalBtn");

    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            copySignal(data);
        });
    }
}

// ============================================================
// AFFICHAGE AUDIT
// ============================================================

function renderAudit(data) {

    const audit = data.audit || {};

    const status = audit.status || "UNCLEAR";

    const detected =
        audit.detected_user_analysis || {};

    const corrected =
        audit.corrected_trade || {};

    if (!resultsContent) {
        return;
    }

    resultsContent.innerHTML = `

        <div class="result-card">

            <div class="audit-header">

                <span class="result-label">
                    RÉSULTAT DE L'AUDIT
                </span>

                <h2 class="${getAuditClass(status)}">
                    ${getAuditLabel(status)}
                </h2>

            </div>

            <div class="audit-verdict">

                <h3>🔎 Verdict</h3>

                <p>
                    ${escapeHtml(
                        audit.verdict ||
                        "Aucun verdict disponible."
                    )}
                </p>

            </div>

            <div class="metrics-grid">

                ${metric(
                    "Actif détecté",
                    data.asset || "UNKNOWN"
                )}

                ${metric(
                    "Timeframe détecté",
                    data.timeframe || "UNKNOWN"
                )}

                ${metric(
                    "Direction détectée",
                    detected.direction || "-"
                )}

                ${metric(
                    "Entrée détectée",
                    detected.entry ?? "-"
                )}

            </div>

            <div class="audit-columns">

                <div class="audit-box">

                    <h3>✅ Points forts</h3>

                    ${renderList(
                        audit.strengths
                    )}

                </div>

                <div class="audit-box">

                    <h3>⚠️ Erreurs / corrections</h3>

                    ${renderList(
                        audit.errors
                    )}

                    ${renderList(
                        audit.corrections
                    )}

                </div>

            </div>

            <div class="trade-plan">

                <h3>🎯 TRADE CORRIGÉ</h3>

                ${tradeRow(
                    "Signal",
                    corrected.signal || "-"
                )}

                ${tradeRow(
                    "Entry",
                    corrected.entry ?? "-"
                )}

                ${tradeRow(
                    "SL",
                    corrected.sl ?? "-"
                )}

                ${tradeRow(
                    "TP1",
                    corrected.tp1 ?? "-"
                )}

                ${tradeRow(
                    "TP2",
                    corrected.tp2 ?? "-"
                )}

                ${tradeRow(
                    "TP3",
                    corrected.tp3 ?? "-"
                )}

                ${tradeRow(
                    "RR",
                    corrected.rr ?? "-"
                )}

            </div>

            <button
                type="button"
                class="copy-signal-btn"
                id="copyAuditSignalBtn">
                📋 COPIER LE SIGNAL CORRIGÉ
            </button>

        </div>
    `;

    const copyBtn =
        document.getElementById(
            "copyAuditSignalBtn"
        );

    if (copyBtn) {

        copyBtn.addEventListener("click", () => {

            copySignal({
                signal: corrected.signal,
                direction: corrected.signal,
                asset: data.asset,
                timeframe: data.timeframe,
                entry: corrected.entry,
                sl: corrected.sl,
                tp1: corrected.tp1,
                tp2: corrected.tp2,
                tp3: corrected.tp3,
                rr: corrected.rr
            });

        });
    }
}

// ============================================================
// HELPERS AFFICHAGE
// ============================================================

function metric(label, value) {

    return `
        <div class="metric-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value ?? "-")}</strong>
        </div>
    `;
}

function tradeRow(label, value) {

    return `
        <div class="trade-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value ?? "-")}</strong>
        </div>
    `;
}

function detailBlock(title, value) {

    if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === "-"
    ) {
        return "";
    }

    return `
        <div class="detail-block">

            <h4>${escapeHtml(title)}</h4>

            <p>
                ${escapeHtml(
                    typeof value === "object"
                        ? JSON.stringify(value)
                        : value
                )}
            </p>

        </div>
    `;
}

function renderList(items) {

    if (!Array.isArray(items) || items.length === 0) {

        return `
            <p class="empty-list">
                Aucun élément.
            </p>
        `;
    }

    return `
        <ul>
            ${items.map(item => `
                <li>
                    ${escapeHtml(
                        typeof item === "object"
                            ? JSON.stringify(item)
                            : item
                    )}
                </li>
            `).join("")}
        </ul>
    `;
}

// ============================================================
// COPIER LE SIGNAL
// ============================================================

async function copySignal(data) {

    const text = `
ARKAS SCAN AI

Actif : ${data.asset || "UNKNOWN"}
Timeframe : ${data.timeframe || "UNKNOWN"}

Signal : ${data.signal || "-"}
Direction : ${data.direction || "-"}

Entry : ${data.entry ?? "-"}
SL : ${data.sl ?? "-"}
TP1 : ${data.tp1 ?? "-"}
TP2 : ${data.tp2 ?? "-"}
TP3 : ${data.tp3 ?? "-"}

RR : ${data.rr ?? "-"}
ARKAS Score : ${data.arkas_score ?? "-"}

⚠️ Gestion du risque : toujours confirmer le signal avant de prendre une position.
`.trim();

    try {

        await navigator.clipboard.writeText(text);

        showStatus(
            "📋 Signal copié.",
            "success"
        );

    } catch (error) {

        console.error(error);

        showStatus(
            "❌ Impossible de copier automatiquement.",
            "error"
        );
    }
}

// ============================================================
// BOUTONS LOADING
// ============================================================

function setButtonsLoading(loading) {

    if (analyzeBtn) {

        analyzeBtn.disabled = loading;

        analyzeBtn.textContent =
            loading
                ? "⏳ ANALYSE..."
                : "🔍 SCANNER LA CAPTURE";
    }

    if (auditBtn) {

        auditBtn.disabled = loading;

        auditBtn.textContent =
            loading
                ? "⏳ VÉRIFICATION..."
                : "🧪 VÉRIFIER MON ANALYSE";
    }
}

// ============================================================
// STATUS
// ============================================================

function showStatus(message, type = "") {

    if (!analysisStatus) {
        return;
    }

    analysisStatus.textContent = message;

    analysisStatus.className =
        "analysis-status " + type;
}

// ============================================================
// RESET
// ============================================================

function resetImage() {

    selectedFile = null;
    selectedBase64 = null;
    selectedMimeType = null;

    if (fileInput) {
        fileInput.value = "";
    }

    if (imagePreview) {
        imagePreview.removeAttribute("src");
    }

    if (previewContainer) {
        previewContainer.style.display = "none";
    }

    if (detectedInfo) {
        detectedInfo.style.display = "none";
    }

    if (scannerActions) {
        scannerActions.style.display = "none";
    }
}

// ============================================================
// SIGNAL CLASS
// ============================================================

function getSignalClass(signal) {

    const value =
        String(signal || "").toUpperCase();

    if (
        value.includes("BUY")
    ) {
        return "signal-buy";
    }

    if (
        value.includes("SELL")
    ) {
        return "signal-sell";
    }

    return "signal-wait";
}

function getAuditClass(status) {

    switch (
        String(status || "").toUpperCase()
    ) {

        case "VALIDATED":
            return "audit-valid";

        case "CORRECT":
            return "audit-correct";

        case "PREMATURE":
            return "audit-premature";

        case "INVALID":
            return "audit-invalid";

        default:
            return "audit-unclear";
    }
}

function getAuditLabel(status) {

    switch (
        String(status || "").toUpperCase()
    ) {

        case "VALIDATED":
            return "✅ ANALYSE VALIDÉE";

        case "CORRECT":
            return "⚠️ ANALYSE À CORRIGER";

        case "PREMATURE":
            return "🟡 ENTRÉE PRÉMATURÉE";

        case "INVALID":
            return "❌ ANALYSE INVALIDÉE";

        default:
            return "❔ ANALYSE INCERTAINE";
    }
}

// ============================================================
// FORMAT
// ============================================================

function formatDetectedValue(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return "UNKNOWN";
    }

    return String(value);
}

// ============================================================
// SÉCURITÉ HTML
// ============================================================

function escapeHtml(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
