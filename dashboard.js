/* =========================================================
   ARKAS SCAN AI V2 — DASHBOARD
   Scanner + Audit + Détection automatique
   + Effet visuel SCAN AI
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("chart-file");
    const importBtn = document.getElementById("import-btn");
    const dropZone = document.getElementById("dropZone");

    const previewContainer = document.getElementById("preview-container");
    const imagePreview = document.getElementById("image-preview");
    const fileName = document.getElementById("file-name");

    const detectedInfo = document.getElementById("detected-info");
    const detectedAsset = document.getElementById("detected-asset");
    const detectedTimeframe = document.getElementById("detected-timeframe");

    const scannerActions = document.getElementById("scanner-actions");
    const analyzeBtn = document.getElementById("analyze-btn");
    const auditBtn = document.getElementById("auditBtn");

    const analysisStatus = document.getElementById("analysis-status");

    const resultsSection = document.getElementById("results-section");
    const resultsContent = document.getElementById("results-content");

    let selectedFile = null;
    let selectedBase64 = null;
    let selectedMimeType = null;
    let isProcessing = false;

    /* =========================================================
       INITIALISATION
       ========================================================= */

    if (scannerActions) {
        scannerActions.style.display = "none";
    }

    if (detectedInfo) {
        detectedInfo.style.display = "none";
    }

    if (resultsSection) {
        resultsSection.style.display = "none";
    }

    /* =========================================================
       IMPORTATION
       ========================================================= */

    if (importBtn && fileInput) {
        importBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!isProcessing) {
                fileInput.click();
            }
        });
    }

    if (dropZone && fileInput) {
        dropZone.addEventListener("click", (event) => {

            if (event.target.closest("button")) {
                return;
            }

            if (!isProcessing) {
                fileInput.click();
            }
        });

        dropZone.addEventListener("keydown", (event) => {
            if (
                (event.key === "Enter" || event.key === " ") &&
                !isProcessing
            ) {
                event.preventDefault();
                fileInput.click();
            }
        });

        dropZone.addEventListener("dragover", (event) => {
            event.preventDefault();

            if (!isProcessing) {
                dropZone.classList.add("drag-over");
            }
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropZone.classList.remove("drag-over");

            if (isProcessing) return;

            const files = event.dataTransfer.files;

            if (files && files.length > 0) {
                handleFile(files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {

            if (!fileInput.files || !fileInput.files.length) {
                return;
            }

            handleFile(fileInput.files[0]);
        });
    }

    /* =========================================================
       GESTION DU FICHIER
       ========================================================= */

    function handleFile(file) {

        if (!file) return;

        stopScanAnimation();

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
            "📷 Capture importée. Préparation du scanner…",
            "info"
        );

        const reader = new FileReader();

        reader.onload = (event) => {

            selectedBase64 = event.target.result;

            if (imagePreview) {
                imagePreview.src = selectedBase64;
                imagePreview.style.display = "block";
            }

            if (fileName) {
                fileName.textContent = file.name;
            }

            if (previewContainer) {
                previewContainer.style.display = "block";
            }

            if (detectedInfo) {
                detectedInfo.style.display = "block";
            }

            if (detectedAsset) {
                detectedAsset.textContent = "Détection automatique…";
            }

            if (detectedTimeframe) {
                detectedTimeframe.textContent = "Détection automatique…";
            }

            if (scannerActions) {
                scannerActions.style.display = "flex";
            }

            if (resultsSection) {
                resultsSection.style.display = "none";
            }

            setupScanOverlay();

            showStatus(
                "✅ Capture prête. Choisis SCANNER ou AUDITER.",
                "success"
            );

            if (scannerActions) {
                scannerActions.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            }
        };

        reader.onerror = () => {

            showStatus(
                "❌ Impossible de lire cette image.",
                "error"
            );
        };

        reader.readAsDataURL(file);
    }

    /* =========================================================
       EFFET SCAN — CRÉATION AUTOMATIQUE
       ========================================================= */

    function setupScanOverlay() {

        if (!imagePreview) return null;

        let wrapper = imagePreview.closest(".scan-image-wrapper");

        if (wrapper) {
            return wrapper;
        }

        wrapper = document.createElement("div");
        wrapper.className = "scan-image-wrapper";

        imagePreview.parentNode.insertBefore(
            wrapper,
            imagePreview
        );

        wrapper.appendChild(imagePreview);

        const overlay = document.createElement("div");
        overlay.className = "scan-overlay";

        overlay.innerHTML = `
            <div class="scan-grid"></div>

            <div class="scan-line"></div>

            <div class="scan-corners">
                <span class="corner top-left"></span>
                <span class="corner top-right"></span>
                <span class="corner bottom-left"></span>
                <span class="corner bottom-right"></span>
            </div>

            <div class="scan-center">
                <div class="scan-loader"></div>
                <div class="scan-label">
                    ARKAS SCAN EN COURS…
                </div>
                <div class="scan-subtitle">
                    PRICE ACTION • SMC
                </div>
            </div>

            <div class="scan-status">
                <span class="scan-dot"></span>
                <span class="scan-status-text">
                    ANALYZING
                </span>
            </div>
        `;

        wrapper.appendChild(overlay);

        return wrapper;
    }

    /* =========================================================
       DÉMARRER LE SCAN
       ========================================================= */

    function startScanAnimation(mode = "scan") {

        const wrapper = setupScanOverlay();

        if (!wrapper) return;

        const label = wrapper.querySelector(".scan-label");
        const subtitle = wrapper.querySelector(".scan-subtitle");
        const statusText = wrapper.querySelector(".scan-status-text");

        if (mode === "audit") {

            if (label) {
                label.textContent =
                    "ARKAS AUDIT EN COURS…";
            }

            if (subtitle) {
                subtitle.textContent =
                    "VÉRIFICATION DE L’ANALYSE";
            }

            if (statusText) {
                statusText.textContent =
                    "AUDITING";
            }

        } else {

            if (label) {
                label.textContent =
                    "ARKAS SCAN EN COURS…";
            }

            if (subtitle) {
                subtitle.textContent =
                    "PRICE ACTION • SMC";
            }

            if (statusText) {
                statusText.textContent =
                    "ANALYZING";
            }
        }

        wrapper.classList.add("is-scanning");
    }

    /* =========================================================
       ARRÊTER LE SCAN
       ========================================================= */

    function stopScanAnimation() {

        const wrapper =
            document.querySelector(".scan-image-wrapper");

        if (!wrapper) return;

        wrapper.classList.remove("is-scanning");
    }

    /* =========================================================
       BOUTON SCANNER
       ========================================================= */

    if (analyzeBtn) {

        analyzeBtn.addEventListener("click", async () => {

            if (isProcessing) return;

            await analyzeImage("scan");
        });
    }

    /* =========================================================
       BOUTON AUDIT
       ========================================================= */

    if (auditBtn) {

        auditBtn.addEventListener("click", async () => {

            if (isProcessing) return;

            await analyzeImage("audit");
        });
    }

    /* =========================================================
       ANALYSE PRINCIPALE
       ========================================================= */

    async function analyzeImage(mode) {

        if (!selectedBase64) {

            showStatus(
                "⚠️ Importe d’abord une capture.",
                "error"
            );

            return;
        }

        if (isProcessing) return;

        isProcessing = true;

        setButtonsDisabled(true);

        if (resultsSection) {
            resultsSection.style.display = "none";
        }

        /*
         * DÉMARRAGE DE L'EFFET VISUEL
         */
        startScanAnimation(mode);

        showStatus(
            mode === "audit"
                ? "🔍 ARKAS vérifie ton analyse…"
                : "🔍 ARKAS analyse le graphique…",
            "loading"
        );

        const cleanBase64 =
            selectedBase64.includes(",")
                ? selectedBase64.split(",")[1]
                : selectedBase64;

        const prompt =
            mode === "audit"
                ? buildAuditPrompt()
                : buildScanPrompt();

        try {

            const response = await fetch(
                "/api/analyze",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        imageBase64: cleanBase64,

                        mimeType:
                            selectedMimeType ||
                            "image/jpeg",

                        asset: "AUTO",

                        timeframe: "AUTO",

                        mode,

                        prompt
                    })
                }
            );

            let data = null;

            try {
                data = await response.json();
            } catch (jsonError) {
                throw new Error(
                    "Réponse serveur invalide."
                );
            }

            if (!response.ok) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    `Erreur serveur ${response.status}`
                );
            }

            if (!data) {
                throw new Error(
                    "Aucune réponse reçue."
                );
            }

            /*
             * FIN DU SCAN
             */
            stopScanAnimation();

            updateDetectedInfo(data);

            renderResults(data, mode);

            showStatus(
                mode === "audit"
                    ? "✅ Audit terminé."
                    : "✅ Analyse terminée.",
                "success"
            );

        } catch (error) {

            console.error(
                "ARKAS SCAN ERROR:",
                error
            );

            stopScanAnimation();

            showStatus(
                "❌ " +
                (
                    error?.message ||
                    "Impossible de terminer l’analyse."
                ),
                "error"
            );

        } finally {

            isProcessing = false;

            setButtonsDisabled(false);
        }
    }

    /* =========================================================
       PROMPT SCAN
       ========================================================= */

    function buildScanPrompt() {

        return `
Tu es ARKAS SCAN AI, un analyste spécialisé en Price Action et Smart Money Concepts.

Analyse cette capture de graphique.

IMPORTANT :

1. IDENTIFIE AUTOMATIQUEMENT :
- l'actif
- le timeframe

Tu ne dois PAS demander à l'utilisateur de sélectionner l'actif ou le timeframe.

Actifs possibles :
- XAUUSD / GOLD
- BTCUSD / BTCUSDT
- ETHUSD / ETHUSDT
- autres cryptomonnaies
- Forex
- indices
- autres marchés visibles

Si l'actif ou le timeframe n'est pas suffisamment visible :
retourne UNKNOWN.
N'invente jamais.

2. ANALYSE :
- tendance
- structure
- BOS
- CHoCH
- liquidité
- Order Block
- FVG
- support/résistance
- Price Action
- momentum
- qualité de l'entrée

3. SIGNAL :
Choisis UNE seule possibilité :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

Si une entrée immédiate n'est pas suffisamment propre,
préfère LIMIT ou WAIT.

4. DONNE :
- Entry
- Stop Loss
- TP1
- TP2
- TP3
- Risk/Reward
- confiance %
- ARKAS Score
- risque
- scénario principal
- scénario alternatif
- invalidation

5. NE FORCE PAS UN TRADE.

Une bonne analyse peut parfaitement conclure WAIT.

6. NEWS :
Ne fabrique aucune actualité.
Si tu ne peux pas vérifier une news réelle :
indique simplement que les news ne sont pas vérifiées.

Réponds uniquement avec les données structurées
attendues par l'application.
`;
    }

    /* =========================================================
       PROMPT AUDIT
       ========================================================= */

    function buildAuditPrompt() {

        return `
Tu es ARKAS SCAN AI en mode AUDIT.

La capture contient potentiellement une analyse déjà dessinée
par l'utilisateur.

Ton travail est de vérifier cette analyse.

NE considère PAS automatiquement les annotations comme correctes.

Vérifie indépendamment :

- direction
- entrée
- Stop Loss
- TP1
- TP2
- TP3
- BOS
- CHoCH
- Order Block
- FVG
- liquidité
- structure
- Price Action
- logique du trade
- risque/rendement

Détermine l'un des statuts :

VALIDATED
CORRECT
PREMATURE
INVALID
UNCLEAR

Définitions :

VALIDATED :
l'analyse est cohérente et l'entrée est valide.

CORRECT :
l'idée est correcte mais certains détails doivent être améliorés.

PREMATURE :
la direction est cohérente mais l'entrée est trop précoce.

INVALID :
l'analyse contredit clairement la structure du marché.

UNCLEAR :
la capture ne permet pas une conclusion fiable.

Si l'analyse est incorrecte ou améliorable,
propose une analyse corrigée.

Ne force jamais un signal.

Identifie automatiquement :
- actif
- timeframe

Si impossible :
UNKNOWN.

Ne fabrique aucune actualité économique.

Réponds uniquement avec les données structurées
attendues par l'application.
`;
    }

    /* =========================================================
       DÉTECTION ACTIF / TIMEFRAME
       ========================================================= */

    function updateDetectedInfo(data) {

        if (!detectedInfo) return;

        detectedInfo.style.display = "block";

        if (detectedAsset) {

            detectedAsset.textContent =
                data.asset &&
                data.asset !== "UNKNOWN"
                    ? data.asset
                    : "Non identifié";
        }

        if (detectedTimeframe) {

            detectedTimeframe.textContent =
                data.timeframe &&
                data.timeframe !== "UNKNOWN"
                    ? data.timeframe
                    : "Non identifié";
        }
    }

    /* =========================================================
       AFFICHAGE DES RÉSULTATS
       ========================================================= */

    function renderResults(data, mode) {

        if (!resultsSection || !resultsContent) {
            return;
        }

        resultsSection.style.display = "block";

        if (mode === "audit") {

            resultsContent.innerHTML =
                renderAuditResults(data);

        } else {

            resultsContent.innerHTML =
                renderScanResults(data);
        }

        attachCopyButton();

        resultsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    /* =========================================================
       RÉSULTATS SCAN
       ========================================================= */

    function renderScanResults(data) {

        const signal =
            safe(data.signal, "WAIT");

        const direction =
            safe(data.direction, "—");

        const entry =
            formatNumber(data.entry);

        const sl =
            formatNumber(data.sl);

        const tp1 =
            formatNumber(data.tp1);

        const tp2 =
            formatNumber(data.tp2);

        const tp3 =
            formatNumber(data.tp3);

        const rr =
            safe(data.rr, "—");

        const confidence =
            safe(data.confidence_percent, "—");

        const score =
            safe(data.arkas_score, "—");

        const structure =
            safe(data.structure, "—");

        const reason =
            safe(data.reason, "—");

        const invalidation =
            safe(data.invalidation, "—");

        const scenario =
            safe(data.primary_scenario, "—");

        const alternative =
            safe(data.alternative_scenario, "—");

        const risk =
            safe(data.risk_management, "—");

        const news =
            safe(data.economic_news, "Non vérifiées");

        const signalClass =
            getSignalClass(signal);

        return `
            <div class="result-main ${signalClass}">

                <div class="result-signal">
                    ${escapeHtml(signal)}
                </div>

                <div class="result-meta">
                    Direction :
                    <strong>
                        ${escapeHtml(direction)}
                    </strong>
                </div>

            </div>

            <div class="result-grid">

                ${resultCard(
                    "🎯 Entry",
                    entry
                )}

                ${resultCard(
                    "🛑 Stop Loss",
                    sl
                )}

                ${resultCard(
                    "💰 TP1",
                    tp1
                )}

                ${resultCard(
                    "💰 TP2",
                    tp2
                )}

                ${resultCard(
                    "💰 TP3",
                    tp3
                )}

                ${resultCard(
                    "📊 Risk / Reward",
                    rr
                )}

                ${resultCard(
                    "🎯 Confiance",
                    confidence + "%"
                )}

                ${resultCard(
                    "⭐ ARKAS Score",
                    score
                )}

            </div>

            <div class="analysis-details">

                ${detailBlock(
                    "📈 Structure",
                    structure
                )}

                ${detailBlock(
                    "🧠 Pourquoi ?",
                    reason
                )}

                ${detailBlock(
                    "🎯 Scénario principal",
                    scenario
                )}

                ${detailBlock(
                    "🔄 Scénario alternatif",
                    alternative
                )}

                ${detailBlock(
                    "⚠️ Invalidation",
                    invalidation
                )}

                ${detailBlock(
                    "🛡️ Risk Management",
                    risk
                )}

                ${detailBlock(
                    "📰 Economic News",
                    news
                )}

            </div>

            <div class="copy-signal-area">

                <button
                    type="button"
                    id="copy-signal-btn"
                    class="copy-signal-btn"
                >
                    📋 Copier le signal
                </button>

            </div>
        `;
    }

    /* =========================================================
       RÉSULTATS AUDIT
       ========================================================= */

    function renderAuditResults(data) {

        const audit =
            data.audit || {};

        const status =
            safe(
                audit.status,
                "UNCLEAR"
            );

        const verdict =
            safe(
                audit.verdict,
                "Audit non disponible."
            );

        const strengths =
            safeList(
                audit.strengths
            );

        const errors =
            safeList(
                audit.errors
            );

        const corrections =
            safeList(
                audit.corrections
            );

        const corrected =
            audit.corrected_trade || {};

        const statusInfo =
            getAuditStatus(status);

        return `
            <div class="audit-verdict ${statusInfo.className}">

                <div class="audit-icon">
                    ${statusInfo.icon}
                </div>

                <div>
                    <div class="audit-title">
                        ${escapeHtml(
                            statusInfo.title
                        )}
                    </div>

                    <div class="audit-description">
                        ${escapeHtml(verdict)}
                    </div>
                </div>

            </div>

            <div class="audit-columns">

                <div class="audit-box">
                    <h3>✅ Points positifs</h3>

                    ${
                        renderList(strengths)
                    }
                </div>

                <div class="audit-box">
                    <h3>⚠️ Points à corriger</h3>

                    ${
                        renderList(errors)
                    }
                </div>

            </div>

            <div class="audit-box correction-box">

                <h3>
                    🛠️ Corrections proposées
                </h3>

                ${
                    renderList(corrections)
                }

            </div>

            <div class="corrected-trade">

                <h3>
                    🎯 Analyse corrigée
                </h3>

                <div class="result-grid">

                    ${resultCard(
                        "Signal",
                        safe(
                            corrected.signal,
                            "WAIT"
                        )
                    )}

                    ${resultCard(
                        "Entry",
                        formatNumber(
                            corrected.entry
                        )
                    )}

                    ${resultCard(
                        "SL",
                        formatNumber(
                            corrected.sl
                        )
                    )}

                    ${resultCard(
                        "TP1",
                        formatNumber(
                            corrected.tp1
                        )
                    )}

                    ${resultCard(
                        "TP2",
                        formatNumber(
                            corrected.tp2
                        )
                    )}

                    ${resultCard(
                        "TP3",
                        formatNumber(
                            corrected.tp3
                        )
                    )}

                    ${resultCard(
                        "RR",
                        safe(
                            corrected.rr,
                            "—"
                        )
                    )}

                </div>

                <div class="copy-signal-area">

                    <button
                        type="button"
                        id="copy-signal-btn"
                        class="copy-signal-btn"
                    >
                        📋 Copier le signal corrigé
                    </button>

                </div>

            </div>
        `;
    }

    /* =========================================================
       OUTILS AFFICHAGE
       ========================================================= */

    function resultCard(title, value) {

        return `
            <div class="result-card">
                <span class="result-card-title">
                    ${escapeHtml(title)}
                </span>

                <strong class="result-card-value">
                    ${escapeHtml(String(value))}
                </strong>
            </div>
        `;
    }

    function detailBlock(title, value) {

        return `
            <div class="detail-block">
                <h3>
                    ${escapeHtml(title)}
                </h3>

                <p>
                    ${escapeHtml(String(value))}
                </p>
            </div>
        `;
    }

    function renderList(items) {

        if (!items.length) {
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
                        ${escapeHtml(String(item))}
                    </li>
                `).join("")}
            </ul>
        `;
    }

    function safe(value, fallback = "—") {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return fallback;
        }

        return value;
    }

    function safeList(value) {

        if (Array.isArray(value)) {
            return value.filter(Boolean);
        }

        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return [value];
        }

        return [];
    }

    function formatNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "—";
        }

        return String(value);
    }

    function getSignalClass(signal) {

        const s =
            String(signal)
                .toUpperCase();

        if (s.includes("BUY")) {
            return "signal-buy";
        }

        if (s.includes("SELL")) {
            return "signal-sell";
        }

        return "signal-wait";
    }

    function getAuditStatus(status) {

        switch (
            String(status).toUpperCase()
        ) {

            case "VALIDATED":
                return {
                    icon: "✅",
                    title: "ANALYSE VALIDÉE",
                    className:
                        "audit-valid"
                };

            case "CORRECT":
                return {
                    icon: "⚠️",
                    title:
                        "ANALYSE À CORRIGER",
                    className:
                        "audit-correct"
                };

            case "PREMATURE":
                return {
                    icon: "🟡",
                    title:
                        "ANALYSE CORRECTE MAIS ENTRÉE PRÉMATURÉE",
                    className:
                        "audit-premature"
                };

            case "INVALID":
                return {
                    icon: "❌",
                    title:
                        "ANALYSE INVALIDÉE",
                    className:
                        "audit-invalid"
                };

            default:
                return {
                    icon: "❓",
                    title:
                        "ANALYSE NON DÉTERMINÉE",
                    className:
                        "audit-unclear"
                };
        }
    }

    /* =========================================================
       COPIER LE SIGNAL
       ========================================================= */

    function attachCopyButton() {

        const copyBtn =
            document.getElementById(
                "copy-signal-btn"
            );

        if (!copyBtn) return;

        copyBtn.addEventListener(
            "click",
            async () => {

                const text =
                    createCopyText();

                try {

                    await navigator.clipboard.writeText(
                        text
                    );

                    copyBtn.textContent =
                        "✅ Signal copié !";

                    setTimeout(() => {

                        copyBtn.textContent =
                            "📋 Copier le signal";

                    }, 2000);

                } catch (error) {

                    console.error(
                        "Copy error:",
                        error
                    );

                    copyBtn.textContent =
                        "❌ Copie impossible";
                }
            }
        );
    }

    function createCopyText() {

        if (!resultsContent) {
            return "";
        }

        return resultsContent.innerText.trim();
    }

    /* =========================================================
       BOUTONS
       ========================================================= */

    function setButtonsDisabled(disabled) {

        if (analyzeBtn) {
            analyzeBtn.disabled = disabled;
        }

        if (auditBtn) {
            auditBtn.disabled = disabled;
        }

        if (importBtn) {
            importBtn.disabled = disabled;
        }

        if (dropZone) {
            dropZone.classList.toggle(
                "scanner-disabled",
                disabled
            );
        }
    }

    /* =========================================================
       STATUS
       ========================================================= */

    function showStatus(message, type = "info") {

        if (!analysisStatus) return;

        analysisStatus.textContent =
            message;

        analysisStatus.className =
            "analysis-status status-" +
            type;
    }

    /* =========================================================
       ESCAPE HTML
       ========================================================= */

    function escapeHtml(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

});
