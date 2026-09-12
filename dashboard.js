// ============================================================
// ARKAS SCAN AI V2 — DASHBOARD.JS
// Import image + aperçu + analyse + audit
// ============================================================

(() => {
    "use strict";

    // Évite les doubles initialisations
    if (window.__ARKAS_SCAN_INITIALIZED__) return;
    window.__ARKAS_SCAN_INITIALIZED__ = true;

    // ---------------------------------------------------------
    // CONFIGURATION
    // ---------------------------------------------------------

    const API_URL = "/api/analyze";
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    const ALLOWED_TYPES = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    // ---------------------------------------------------------
    // ELEMENTS
    // ---------------------------------------------------------

    const fileInput = document.getElementById("chart-file");
    const dropZone = document.getElementById("dropZone");

    const previewContainer = document.getElementById("preview-container");
    const imagePreview = document.getElementById("image-preview");
    const fileName = document.getElementById("file-name");

    const analyzeBtn = document.getElementById("analyze-btn");
    const auditBtn = document.getElementById("auditBtn");

    const resultsContent = document.getElementById("results-content");
    const analysisStatus = document.getElementById("analysis-status");

    const assetSelect = document.getElementById("assetSelect");
    const timeframeSelect = document.getElementById("timeframeSelect");

    // ---------------------------------------------------------
    // ETAT
    // ---------------------------------------------------------

    let selectedFile = null;
    let selectedBase64 = null;
    let selectedMimeType = null;

    // ---------------------------------------------------------
    // VERIFICATION ELEMENTS
    // ---------------------------------------------------------

    if (!fileInput) {
        console.error("ARKAS SCAN : #chart-file introuvable.");
        return;
    }

    if (!dropZone) {
        console.error("ARKAS SCAN : #dropZone introuvable.");
        return;
    }

    // ---------------------------------------------------------
    // INITIALISATION
    // ---------------------------------------------------------

    disableButtons();

    if (previewContainer) {
        previewContainer.style.display = "none";
    }

    if (resultsContent) {
        resultsContent.innerHTML = "";
    }

    // ---------------------------------------------------------
    // BOUTONS
    // ---------------------------------------------------------

    function disableButtons() {
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.classList.add("disabled");
        }

        if (auditBtn) {
            auditBtn.disabled = true;
            auditBtn.classList.add("disabled");
        }
    }

    function enableButtons() {
        if (!selectedFile) return;

        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.classList.remove("disabled");
        }

        if (auditBtn) {
            auditBtn.disabled = false;
            auditBtn.classList.remove("disabled");
        }
    }

    // ---------------------------------------------------------
    // OUVERTURE GALERIE / FICHIERS
    // ---------------------------------------------------------

    function openFilePicker(event) {
        // Empêche les comportements inattendus
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        fileInput.value = "";

        // Ouvre le sélecteur de fichiers du téléphone
        fileInput.click();
    }

    // ---------------------------------------------------------
    // CLICK SUR ZONE
    // ---------------------------------------------------------

    dropZone.addEventListener("click", (event) => {

        // Si l'utilisateur clique directement sur l'input,
        // on ne relance pas fileInput.click()
        if (event.target === fileInput) return;

        openFilePicker(event);
    });

    // ---------------------------------------------------------
    // CLAVIER
    // ---------------------------------------------------------

    dropZone.addEventListener("keydown", (event) => {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {
            openFilePicker(event);
        }
    });

    // ---------------------------------------------------------
    // SELECTION FICHIER
    // ---------------------------------------------------------

    fileInput.addEventListener("change", (event) => {

        const files = event.target.files;

        if (!files || files.length === 0) {
            return;
        }

        handleFile(files[0]);
    });

    // ---------------------------------------------------------
    // DRAG & DROP
    // ---------------------------------------------------------

    dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (event) => {

        event.preventDefault();
        event.stopPropagation();

        dropZone.classList.remove("drag-over");

        const files = event.dataTransfer.files;

        if (!files || files.length === 0) {
            return;
        }

        handleFile(files[0]);
    });

    // ---------------------------------------------------------
    // TRAITEMENT DU FICHIER
    // ---------------------------------------------------------

    function handleFile(file) {

        // Reset
        selectedFile = null;
        selectedBase64 = null;
        selectedMimeType = null;

        disableButtons();

        if (resultsContent) {
            resultsContent.innerHTML = "";
        }

        // Vérification type
        const type = (file.type || "").toLowerCase();

        if (!ALLOWED_TYPES.includes(type)) {

            showStatus(
                "❌ Format non supporté. Utilise JPG, PNG ou WebP.",
                "error"
            );

            resetPreview();

            return;
        }

        // Vérification taille
        if (file.size > MAX_FILE_SIZE) {

            showStatus(
                "❌ Image trop lourde. Maximum : 10 MB.",
                "error"
            );

            resetPreview();

            return;
        }

        // Sauvegarde
        selectedFile = file;
        selectedMimeType = type;

        // Nom
        if (fileName) {
            fileName.textContent = file.name;
        }

        // Affichage immédiat
        const reader = new FileReader();

        reader.onload = function(event) {

            const result = event.target.result;

            if (!result || typeof result !== "string") {

                showStatus(
                    "❌ Impossible de lire cette image.",
                    "error"
                );

                resetPreview();
                return;
            }

            // Stockage de l'image complète
            selectedBase64 = result;

            // Affichage
            if (imagePreview) {

                imagePreview.src = result;

                imagePreview.style.display = "block";

                imagePreview.onload = function() {

                    if (previewContainer) {
                        previewContainer.style.display = "block";
                    }

                    enableButtons();

                    showStatus(
                        "✅ Capture importée. Elle est prête à être analysée.",
                        "success"
                    );
                };

                imagePreview.onerror = function() {

                    showStatus(
                        "❌ L'image ne peut pas être affichée.",
                        "error"
                    );

                    resetPreview();
                };
            } else {

                showStatus(
                    "❌ Élément image #image-preview introuvable.",
                    "error"
                );

                resetPreview();
            }
        };

        reader.onerror = function() {

            showStatus(
                "❌ Erreur lors de la lecture de la capture.",
                "error"
            );

            resetPreview();
        };

        // Lit réellement le fichier
        reader.readAsDataURL(file);
    }

    // ---------------------------------------------------------
    // RESET APERCU
    // ---------------------------------------------------------

    function resetPreview() {

        selectedFile = null;
        selectedBase64 = null;
        selectedMimeType = null;

        if (imagePreview) {
            imagePreview.removeAttribute("src");
            imagePreview.style.display = "none";
        }

        if (previewContainer) {
            previewContainer.style.display = "none";
        }

        if (fileName) {
            fileName.textContent = "";
        }

        disableButtons();

        // Permet de sélectionner à nouveau la même image
        fileInput.value = "";
    }

    // ---------------------------------------------------------
    // STATUS
    // ---------------------------------------------------------

    function showStatus(message, type = "info") {

        if (!analysisStatus) return;

        analysisStatus.textContent = message;

        analysisStatus.className = "";

        analysisStatus.classList.add(
            "analysis-status",
            `status-${type}`
        );
    }

    // ---------------------------------------------------------
    // EXTRACTION BASE64
    // ---------------------------------------------------------

    function getCleanBase64(dataUrl) {

        if (!dataUrl) {
            return null;
        }

        if (!dataUrl.includes(",")) {
            return dataUrl;
        }

        return dataUrl.split(",")[1];
    }

    // ---------------------------------------------------------
    // PROMPT SCAN
    // ---------------------------------------------------------

    function buildScanPrompt() {

        const asset = assetSelect
            ? assetSelect.value
            : "AUTO";

        const timeframe = timeframeSelect
            ? timeframeSelect.value
            : "AUTO";

        return `
Tu es ARKAS SCAN AI V2.

Analyse cette capture de graphique de trading avec une approche Price Action + Smart Money Concepts.

Actif demandé : ${asset}
Timeframe demandé : ${timeframe}

Analyse notamment :

- tendance
- structure du marché
- BOS
- CHoCH
- support
- résistance
- liquidité
- Order Block
- Fair Value Gap
- zones d'achat
- zones de vente
- momentum
- qualité de l'entrée
- risque/rendement

Je veux une décision claire :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

Si une entrée immédiate n'est pas suffisamment confirmée,
indique clairement une entrée conditionnelle.

Donne :

Entry
Stop Loss
TP1
TP2
TP3
RR
Confiance %
ARKAS Score
Invalidation
Scénario principal
Scénario alternatif

Si la capture contient déjà une analyse, vérifie aussi la logique
des annotations visibles.

Ne fabrique jamais une information qui n'est pas visible ou déductible
du graphique.

Réponds uniquement avec le JSON demandé par le serveur.
        `.trim();
    }

    // ---------------------------------------------------------
    // PROMPT AUDIT
    // ---------------------------------------------------------

    function buildAuditPrompt() {

        const asset = assetSelect
            ? assetSelect.value
            : "AUTO";

        const timeframe = timeframeSelect
            ? timeframeSelect.value
            : "AUTO";

        return `
Tu es ARKAS SCAN AI V2 en MODE AUDIT.

Cette capture contient potentiellement une analyse de trading déjà faite
par l'utilisateur.

Actif : ${asset}
Timeframe : ${timeframe}

Ta mission est de vérifier cette analyse.

Ne considère PAS automatiquement les annotations comme correctes.

Détermine :

1. Les annotations réellement visibles.
2. La direction proposée.
3. L'entrée proposée.
4. Le Stop Loss.
5. Les Take Profits.
6. Le setup utilisé.
7. Si le setup respecte Price Action / SMC.
8. Si l'entrée est valide.
9. Si l'entrée est prématurée.
10. Si le trade est invalide.

Utilise exactement l'un des statuts :

VALIDATED
CORRECT
PREMATURE
INVALID
UNCLEAR

Si l'analyse est incorrecte ou prématurée,
propose une correction.

Donne également :

Entry corrigée
SL corrigé
TP1 corrigé
TP2 corrigé
TP3 corrigé
RR corrigé
Scénario conditionnel
Invalidation
Confiance %

Ne fabrique jamais de données absentes du graphique.

Réponds uniquement avec le JSON demandé par le serveur.
        `.trim();
    }

    // ---------------------------------------------------------
    // ANALYSE GENERALE
    // ---------------------------------------------------------

    if (analyzeBtn) {

        analyzeBtn.addEventListener("click", async () => {

            if (!selectedFile || !selectedBase64) {

                showStatus(
                    "⚠️ Importe d'abord une capture d'écran.",
                    "warning"
                );

                return;
            }

            await sendAnalysis("scan");
        });
    }

    // ---------------------------------------------------------
    // AUDIT
    // ---------------------------------------------------------

    if (auditBtn) {

        auditBtn.addEventListener("click", async () => {

            if (!selectedFile || !selectedBase64) {

                showStatus(
                    "⚠️ Importe d'abord une capture d'écran.",
                    "warning"
                );

                return;
            }

            await sendAnalysis("audit");
        });
    }

    // ---------------------------------------------------------
    // ENVOI VERS API
    // ---------------------------------------------------------

    async function sendAnalysis(mode) {

        if (!selectedBase64) {

            showStatus(
                "❌ Aucune image disponible.",
                "error"
            );

            return;
        }

        const cleanBase64 = getCleanBase64(selectedBase64);

        if (!cleanBase64) {

            showStatus(
                "❌ Impossible de préparer l'image.",
                "error"
            );

            return;
        }

        // Désactive pendant l'analyse
        if (analyzeBtn) analyzeBtn.disabled = true;
        if (auditBtn) auditBtn.disabled = true;

        showStatus(
            mode === "audit"
                ? "🧪 Vérification de ton analyse en cours..."
                : "🔍 Analyse du graphique en cours...",
            "loading"
        );

        if (resultsContent) {

            resultsContent.innerHTML = `
                <div class="loading-box">
                    <div class="loading-spinner"></div>
                    <p>
                        ARKAS SCAN AI analyse la structure du marché...
                    </p>
                    <small>
                        BOS • CHoCH • Liquidité • OB • FVG • Price Action
                    </small>
                </div>
            `;
        }

        const asset = assetSelect
            ? assetSelect.value
            : "AUTO";

        const timeframe = timeframeSelect
            ? timeframeSelect.value
            : "AUTO";

        const prompt = mode === "audit"
            ? buildAuditPrompt()
            : buildScanPrompt();

        const payload = {

            imageBase64: cleanBase64,

            mimeType: selectedMimeType || selectedFile.type,

            prompt: prompt,

            asset: asset,

            timeframe: timeframe,

            mode: mode
        };

        try {

            const response = await fetch(API_URL, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(payload)
            });

            let data = null;

            try {
                data = await response.json();
            } catch (jsonError) {

                throw new Error(
                    `Réponse serveur invalide (${response.status})`
                );
            }

            if (!response.ok) {

                const message =
                    data?.error ||
                    data?.message ||
                    `Erreur serveur HTTP ${response.status}`;

                throw new Error(message);
            }

            if (!data) {

                throw new Error(
                    "Le serveur n'a retourné aucune donnée."
                );
            }

            // Affichage
            renderResults(data, mode);

            showStatus(
                mode === "audit"
                    ? "✅ Vérification terminée."
                    : "✅ Analyse terminée.",
                "success"
            );

        } catch (error) {

            console.error(
                "ARKAS SCAN API ERROR:",
                error
            );

            if (resultsContent) {

                resultsContent.innerHTML = `
                    <div class="error-box">
                        <h3>❌ Analyse impossible</h3>

                        <p>
                            ${escapeHtml(
                                error?.message ||
                                "Une erreur inconnue est survenue."
                            )}
                        </p>

                        <button
                            type="button"
                            class="retry-btn"
                            id="arkas-retry-btn"
                        >
                            🔄 Réessayer
                        </button>
                    </div>
                `;

                const retryBtn =
                    document.getElementById("arkas-retry-btn");

                if (retryBtn) {

                    retryBtn.addEventListener(
                        "click",
                        () => sendAnalysis(mode)
                    );
                }
            }

            showStatus(
                "❌ Erreur pendant l'analyse.",
                "error"
            );

        } finally {

            // Réactive seulement si une image existe
            enableButtons();
        }
    }

    // ---------------------------------------------------------
    // AFFICHAGE RESULTATS
    // ---------------------------------------------------------

    function renderResults(data, mode) {

        if (!resultsContent) return;

        if (mode === "audit") {

            renderAudit(data);

        } else {

            renderScan(data);
        }
    }

    // ---------------------------------------------------------
    // SCAN
    // ---------------------------------------------------------

    function renderScan(data) {

        const signal =
            data.signal ||
            "WAIT";

        const direction =
            data.direction ||
            "";

        const execution =
            data.execution ||
            "";

        const confidence =
            data.confidence_percent ??
            data.confidence ??
            "—";

        const entry =
            data.entry ?? "—";

        const sl =
            data.sl ?? "—";

        const tp1 =
            data.tp1 ?? "—";

        const tp2 =
            data.tp2 ?? "—";

        const tp3 =
            data.tp3 ?? "—";

        const rr =
            data.rr ?? "—";

        const score =
            data.arkas_score ?? "—";

        const structure =
            data.structure ?? "—";

        const reason =
            data.reason ?? "—";

        const invalidation =
            data.invalidation ?? "—";

        const primary =
            data.primary_scenario ?? "—";

        const alternative =
            data.alternative_scenario ?? "—";

        const risk =
            data.risk_management ?? "—";

        const lot =
            data.lot ??
            data.lot_size ??
            "—";

        const signalClass =
            getSignalClass(signal);

        resultsContent.innerHTML = `

            <div class="analysis-result">

                <div class="result-header ${signalClass}">

                    <div>

                        <span class="result-label">
                            SIGNAL ARKAS
                        </span>

                        <h2>
                            ${escapeHtml(signal)}
                        </h2>

                    </div>

                    <div class="confidence">

                        <strong>
                            ${escapeHtml(String(confidence))}%
                        </strong>

                        <span>
                            confiance
                        </span>

                    </div>

                </div>


                <div class="metrics-grid">

                    ${metricCard(
                        "Actif",
                        data.asset || "AUTO"
                    )}

                    ${metricCard(
                        "Timeframe",
                        data.timeframe || "AUTO"
                    )}

                    ${metricCard(
                        "Direction",
                        direction || "—"
                    )}

                    ${metricCard(
                        "Exécution",
                        execution || "—"
                    )}

                    ${metricCard(
                        "ARKAS Score",
                        score
                    )}

                    ${metricCard(
                        "Structure",
                        structure
                    )}

                </div>


                <div class="trade-box">

                    <h3>
                        🎯 Plan de trading
                    </h3>

                    <div class="trade-grid">

                        ${tradeValue(
                            "Entry",
                            entry
                        )}

                        ${tradeValue(
                            "Stop Loss",
                            sl
                        )}

                        ${tradeValue(
                            "TP1",
                            tp1
                        )}

                        ${tradeValue(
                            "TP2",
                            tp2
                        )}

                        ${tradeValue(
                            "TP3",
                            tp3
                        )}

                        ${tradeValue(
                            "RR",
                            rr
                        )}

                        ${tradeValue(
                            "Lot",
                            lot
                        )}

                    </div>

                </div>


                <div class="reason-box">

                    <h3>
                        🧠 Analyse
                    </h3>

                    <p>
                        ${formatValue(reason)}
                    </p>

                </div>


                <div class="scenario-box">

                    <h3>
                        📌 Scénario principal
                    </h3>

                    <p>
                        ${formatValue(primary)}
                    </p>

                </div>


                <div class="scenario-box">

                    <h3>
                        🔄 Scénario alternatif
                    </h3>

                    <p>
                        ${formatValue(alternative)}
                    </p>

                </div>


                <div class="invalidation-box">

                    <h3>
                        ❌ Invalidation
                    </h3>

                    <p>
                        ${formatValue(invalidation)}
                    </p>

                </div>


                <div class="risk-box">

                    <h3>
                        🛡️ Gestion du risque
                    </h3>

                    <p>
                        ${formatValue(risk)}
                    </p>

                </div>


                <button
                    type="button"
                    class="copy-signal-btn"
                    id="copy-signal-btn"
                >
                    📋 COPIER LE SIGNAL
                </button>

            </div>
        `;

        setupCopyButton(
            buildSignalText(data)
        );
    }

    // ---------------------------------------------------------
    // AUDIT
    // ---------------------------------------------------------

    function renderAudit(data) {

        const audit =
            data.audit || {};

        const status =
            audit.status ||
            "UNCLEAR";

        const detected =
            audit.detected_user_analysis ||
            {};

        const corrected =
            audit.corrected_trade ||
            {};

        const verdict =
            audit.verdict ||
            "—";

        const strengths =
            audit.strengths ||
            [];

        const errors =
            audit.errors ||
            [];

        const corrections =
            audit.corrections ||
            [];

        resultsContent.innerHTML = `

            <div class="audit-result">

                <div class="audit-header ${getAuditClass(status)}">

                    <span>
                        🧪 AUDIT ARKAS
                    </span>

                    <h2>
                        ${auditStatusLabel(status)}
                    </h2>

                </div>


                <div class="audit-verdict">

                    <h3>
                        Verdict
                    </h3>

                    <p>
                        ${formatValue(verdict)}
                    </p>

                </div>


                <div class="audit-section">

                    <h3>
                        🔎 Analyse détectée
                    </h3>

                    <div class="trade-grid">

                        ${tradeValue(
                            "Direction",
                            detected.direction || "—"
                        )}

                        ${tradeValue(
                            "Entry",
                            detected.entry ?? "—"
                        )}

                        ${tradeValue(
                            "SL",
                            detected.sl ?? "—"
                        )}

                        ${tradeValue(
                            "TP1",
                            detected.tp1 ?? "—"
                        )}

                        ${tradeValue(
                            "TP2",
                            detected.tp2 ?? "—"
                        )}

                        ${tradeValue(
                            "TP3",
                            detected.tp3 ?? "—"
                        )}

                    </div>

                    <p>
                        <strong>
                            Setup :
                        </strong>

                        ${formatValue(
                            detected.claimed_setup || "—"
                        )}
                    </p>

                    <p>
                        <strong>
                            Annotations :
                        </strong>

                        ${formatValue(
                            detected.annotations || "—"
                        )}
                    </p>

                </div>


                <div class="audit-section">

                    <h3>
                        ✅ Points forts
                    </h3>

                    ${renderList(strengths)}

                </div>


                <div class="audit-section">

                    <h3>
                        ⚠️ Erreurs / problèmes
                    </h3>

                    ${renderList(errors)}

                </div>


                <div class="audit-section">

                    <h3>
                        🛠️ Corrections
                    </h3>

                    ${renderList(corrections)}

                </div>


                <div class="corrected-trade">

                    <h3>
                        🎯 Signal final corrigé
                    </h3>

                    <div class="trade-grid">

                        ${tradeValue(
                            "Signal",
                            corrected.signal || "—"
                        )}

                        ${tradeValue(
                            "Entry",
                            corrected.entry ?? "—"
                        )}

                        ${tradeValue(
                            "SL",
                            corrected.sl ?? "—"
                        )}

                        ${tradeValue(
                            "TP1",
                            corrected.tp1 ?? "—"
                        )}

                        ${tradeValue(
                            "TP2",
                            corrected.tp2 ?? "—"
                        )}

                        ${tradeValue(
                            "TP3",
                            corrected.tp3 ?? "—"
                        )}

                        ${tradeValue(
                            "RR",
                            corrected.rr ?? "—"
                        )}

                    </div>

                </div>


                <button
                    type="button"
                    class="copy-signal-btn"
                    id="copy-signal-btn"
                >
                    📋 COPIER LE SIGNAL FINAL
                </button>

            </div>
        `;

        setupCopyButton(
            buildAuditSignalText(data)
        );
    }

    // ---------------------------------------------------------
    // LISTE
    // ---------------------------------------------------------

    function renderList(value) {

        if (!value) {
            return "<p>—</p>";
        }

        if (!Array.isArray(value)) {
            return `<p>${formatValue(value)}</p>`;
        }

        if (value.length === 0) {
            return "<p>—</p>";
        }

        return `
            <ul class="analysis-list">
                ${value.map(item => `
                    <li>
                        ${formatValue(item)}
                    </li>
                `).join("")}
            </ul>
        `;
    }

    // ---------------------------------------------------------
    // CARTE METRIQUE
    // ---------------------------------------------------------

    function metricCard(label, value) {

        return `
            <div class="metric-card">

                <span>
                    ${escapeHtml(label)}
                </span>

                <strong>
                    ${formatValue(value)}
                </strong>

            </div>
        `;
    }

    // ---------------------------------------------------------
    // VALEUR TRADE
    // ---------------------------------------------------------

    function tradeValue(label, value) {

        return `
            <div class="trade-value">

                <span>
                    ${escapeHtml(label)}
                </span>

                <strong>
                    ${formatValue(value)}
                </strong>

            </div>
        `;
    }

    // ---------------------------------------------------------
    // SIGNAL CLASS
    // ---------------------------------------------------------

    function getSignalClass(signal) {

        const value =
            String(signal || "")
                .toUpperCase();

        if (value.includes("BUY")) {
            return "signal-buy";
        }

        if (value.includes("SELL")) {
            return "signal-sell";
        }

        return "signal-wait";
    }

    // ---------------------------------------------------------
    // AUDIT CLASS
    // ---------------------------------------------------------

    function getAuditClass(status) {

        switch (
            String(status || "")
                .toUpperCase()
        ) {

            case "VALIDATED":
                return "audit-validated";

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

    // ---------------------------------------------------------
    // AUDIT LABEL
    // ---------------------------------------------------------

    function auditStatusLabel(status) {

        switch (
            String(status || "")
                .toUpperCase()
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
                return "❓ ANALYSE NON CONCLUANTE";
        }
    }

    // ---------------------------------------------------------
    // COPIE
    // ---------------------------------------------------------

    function setupCopyButton(text) {

        const button =
            document.getElementById(
                "copy-signal-btn"
            );

        if (!button) return;

        button.addEventListener(
            "click",
            async () => {

                try {

                    await navigator.clipboard.writeText(
                        text
                    );

                    const oldText =
                        button.textContent;

                    button.textContent =
                        "✅ SIGNAL COPIÉ";

                    setTimeout(() => {

                        button.textContent =
                            oldText;

                    }, 1800);

                } catch (error) {

                    console.error(
                        "Copy error:",
                        error
                    );

                    showStatus(
                        "❌ Impossible de copier le signal.",
                        "error"
                    );
                }
            }
        );
    }

    // ---------------------------------------------------------
    // TEXTE SIGNAL
    // ---------------------------------------------------------

    function buildSignalText(data) {

        return `
ARKAS SCAN AI V2

ACTIF : ${data.asset || "AUTO"}
TIMEFRAME : ${data.timeframe || "AUTO"}

SIGNAL : ${data.signal || "WAIT"}
DIRECTION : ${data.direction || "—"}
EXÉCUTION : ${data.execution || "—"}

ENTRY : ${data.entry ?? "—"}
SL : ${data.sl ?? "—"}
TP1 : ${data.tp1 ?? "—"}
TP2 : ${data.tp2 ?? "—"}
TP3 : ${data.tp3 ?? "—"}

RR : ${data.rr ?? "—"}
CONFIANCE : ${data.confidence_percent ?? "—"}%
ARKAS SCORE : ${data.arkas_score ?? "—"}

STRUCTURE :
${data.structure || "—"}

SCÉNARIO :
${data.primary_scenario || "—"}

ALTERNATIVE :
${data.alternative_scenario || "—"}

INVALIDATION :
${data.invalidation || "—"}

RISQUE :
${data.risk_management || "—"}
        `.trim();
    }

    // ---------------------------------------------------------
    // TEXTE AUDIT
    // ---------------------------------------------------------

    function buildAuditSignalText(data) {

        const audit =
            data.audit || {};

        const corrected =
            audit.corrected_trade ||
            {};

        return `
ARKAS SCAN AI V2 — AUDIT

STATUT :
${auditStatusLabel(audit.status)}

VERDICT :
${audit.verdict || "—"}

SIGNAL FINAL :
${corrected.signal || "—"}

ENTRY :
${corrected.entry ?? "—"}

SL :
${corrected.sl ?? "—"}

TP1 :
${corrected.tp1 ?? "—"}

TP2 :
${corrected.tp2 ?? "—"}

TP3 :
${corrected.tp3 ?? "—"}

RR :
${corrected.rr ?? "—"}

CORRECTIONS :
${Array.isArray(audit.corrections)
    ? audit.corrections.join("\n- ")
    : audit.corrections || "—"}
        `.trim();
    }

    // ---------------------------------------------------------
    // FORMATAGE
    // ---------------------------------------------------------

    function formatValue(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "—";
        }

        if (typeof value === "object") {

            try {

                return escapeHtml(
                    JSON.stringify(
                        value,
                        null,
                        2
                    )
                );

            } catch {
                return "—";
            }
        }

        return escapeHtml(
            String(value)
        ).replace(
            /\n/g,
            "<br>"
        );
    }

    // ---------------------------------------------------------
    // SECURITE HTML
    // ---------------------------------------------------------

    function escapeHtml(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ---------------------------------------------------------
    // FIN
    // ---------------------------------------------------------

    console.log(
        "✅ ARKAS SCAN AI V2 — Dashboard initialisé."
    );

})();
