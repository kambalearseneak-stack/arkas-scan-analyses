/* =========================================================
   ARKAS SCAN AI V2 — DASHBOARD
   Scanner + Audit + Détection auto + Scénarios multiples
   + Risk Manager + News
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       RÉFÉRENCES DOM
       ========================================================= */

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

    const globalLoader = document.getElementById("global-loader");

    let selectedBase64 = null;
    let selectedMimeType = null;
    let isProcessing = false;

    /* =========================================================
       INITIALISATION
       ========================================================= */

    if (scannerActions) scannerActions.style.display = "none";
    if (detectedInfo) detectedInfo.style.display = "none";
    if (resultsSection) resultsSection.style.display = "none";

    /* =========================================================
       IMPORTATION
       ========================================================= */

    if (importBtn && fileInput) {
        importBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isProcessing) fileInput.click();
        });
    }

    if (dropZone && fileInput) {

        dropZone.addEventListener("click", (event) => {
            if (event.target.closest("button")) return;
            if (!isProcessing) fileInput.click();
        });

        dropZone.addEventListener("keydown", (event) => {
            if ((event.key === "Enter" || event.key === " ") && !isProcessing) {
                event.preventDefault();
                fileInput.click();
            }
        });

        dropZone.addEventListener("dragover", (event) => {
            event.preventDefault();
            if (!isProcessing) dropZone.classList.add("drag-over");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropZone.classList.remove("drag-over");
            if (isProcessing) return;

            const files = event.dataTransfer.files;
            if (files && files.length > 0) handleFile(files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (!fileInput.files || !fileInput.files.length) return;
            handleFile(fileInput.files[0]);
        });
    }

    /* =========================================================
       COMPRESSION IMAGE
       ========================================================= */

    function compressImage(file, maxWidth = 1600, quality = 0.85) {
        return new Promise((resolve, reject) => {

            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => blob
                        ? resolve(blob)
                        : reject(new Error("Compression échouée")),
                    "image/jpeg",
                    quality
                );
            };

            img.onerror = () => reject(new Error("Lecture image échouée"));
            img.src = url;
        });
    }

    /* =========================================================
       GESTION FICHIER
       ========================================================= */

    async function handleFile(file) {

        if (!file) return;

        stopScanAnimation();

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxSize = 10 * 1024 * 1024;

        if (!allowedTypes.includes(file.type)) {
            showStatus("❌ Format non supporté. Utilise JPG, PNG ou WEBP.", "error");
            return;
        }

        if (file.size > maxSize) {
            showStatus("❌ Image trop lourde. Maximum : 10 MB.", "error");
            return;
        }

        selectedMimeType = "image/jpeg";
        showStatus("📷 Capture importée. Préparation du scanner…", "info");

        try {
            const compressedBlob = await compressImage(file);
            const reader = new FileReader();

            reader.onload = (event) => {

                selectedBase64 = event.target.result;

                if (imagePreview) {
                    imagePreview.src = selectedBase64;
                    imagePreview.style.display = "block";
                }

                if (fileName) fileName.textContent = file.name;
                if (previewContainer) previewContainer.style.display = "block";
                if (detectedInfo) detectedInfo.style.display = "block";

                if (detectedAsset) detectedAsset.textContent = "Détection automatique…";
                if (detectedTimeframe) detectedTimeframe.textContent = "Détection automatique…";

                if (scannerActions) scannerActions.style.display = "flex";
                if (resultsSection) resultsSection.style.display = "none";

                setupScanOverlay();
                showStatus("✅ Capture prête. Choisis SCANNER ou AUDITER.", "success");

                if (scannerActions) {
                    setTimeout(() => {
                        scannerActions.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest"
                        });
                    }, 100);
                }

                if (fileInput) fileInput.value = "";
            };

            reader.onerror = () => showStatus("❌ Impossible de lire cette image.", "error");
            reader.readAsDataURL(compressedBlob);

        } catch (err) {
            console.error("Compression error:", err);
            showStatus("❌ Impossible de traiter cette image.", "error");
        }
    }

    /* =========================================================
       EFFET SCAN
       ========================================================= */

    function setupScanOverlay() {

        if (!imagePreview) return null;

        let wrapper = imagePreview.closest(".scan-image-wrapper");
        if (wrapper) return wrapper;

        wrapper = document.createElement("div");
        wrapper.className = "scan-image-wrapper";

        imagePreview.parentNode.insertBefore(wrapper, imagePreview);
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
                <div class="scan-label">ARKAS SCAN EN COURS…</div>
                <div class="scan-subtitle">PRICE ACTION • SMC • ICT</div>
            </div>
            <div class="scan-status">
                <span class="scan-dot"></span>
                <span class="scan-status-text">ANALYZING</span>
            </div>
        `;

        wrapper.appendChild(overlay);
        return wrapper;
    }

    function startScanAnimation(mode = "scan") {

        const wrapper = setupScanOverlay();
        if (!wrapper) return;

        const label = wrapper.querySelector(".scan-label");
        const subtitle = wrapper.querySelector(".scan-subtitle");
        const statusText = wrapper.querySelector(".scan-status-text");

        if (mode === "audit") {
            if (label) label.textContent = "ARKAS AUDIT EN COURS…";
            if (subtitle) subtitle.textContent = "VÉRIFICATION DE L'ANALYSE";
            if (statusText) statusText.textContent = "AUDITING";
        } else {
            if (label) label.textContent = "ARKAS SCAN EN COURS…";
            if (subtitle) subtitle.textContent = "PRICE ACTION • SMC • ICT";
            if (statusText) statusText.textContent = "ANALYZING";
        }

        wrapper.classList.add("is-scanning");
    }

    function stopScanAnimation() {
        const wrapper = document.querySelector(".scan-image-wrapper");
        if (wrapper) wrapper.classList.remove("is-scanning");
    }

    /* =========================================================
       BOUTONS
       ========================================================= */

    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", async () => {
            if (isProcessing) return;
            await analyzeImage("scan");
        });
    }

    if (auditBtn) {
        auditBtn.addEventListener("click", async () => {
            if (isProcessing) return;
            await analyzeImage("audit");
        });
    }

    /* =========================================================
       ANALYSE
       ========================================================= */

    async function analyzeImage(mode) {

        if (!selectedBase64) {
            showStatus("⚠️ Importe d'abord une capture.", "error");
            return;
        }

        if (isProcessing) return;

        isProcessing = true;
        setButtonsDisabled(true);

        if (resultsSection) resultsSection.style.display = "none";
        if (globalLoader) globalLoader.classList.remove("hidden");

        startScanAnimation(mode);

        showStatus(
            mode === "audit"
                ? "🔍 ARKAS vérifie ton analyse…"
                : "🔍 ARKAS analyse le graphique…",
            "loading"
        );

        const cleanBase64 = selectedBase64.includes(",")
            ? selectedBase64.split(",")[1]
            : selectedBase64;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    imageBase64: cleanBase64,
                    mimeType: selectedMimeType || "image/jpeg",
                    asset: "AUTO",
                    timeframe: "AUTO",
                    mode,
                    prompt: ""
                })
            });

            clearTimeout(timeoutId);

            let data = null;
            try {
                data = await response.json();
            } catch {
                throw new Error("Réponse serveur invalide.");
            }

            if (!response.ok) {
                throw new Error(data?.error || `Erreur serveur ${response.status}`);
            }

            if (!data) throw new Error("Aucune réponse reçue.");

            stopScanAnimation();
            updateDetectedInfo(data);
            renderResults(data, mode);

            showStatus(
                mode === "audit" ? "✅ Audit terminé." : "✅ Analyse terminée.",
                "success"
            );

        } catch (error) {

            if (error.name === "AbortError") {
                showStatus("⏱️ Délai dépassé. Réessaie.", "error");
            } else {
                console.error("ARKAS SCAN ERROR:", error);
                showStatus("❌ " + (error?.message || "Erreur."), "error");
            }

            stopScanAnimation();

        } finally {
            if (globalLoader) globalLoader.classList.add("hidden");
            isProcessing = false;
            setButtonsDisabled(false);
        }
    }

    function updateDetectedInfo(data) {

        if (!detectedInfo) return;
        detectedInfo.style.display = "block";

        if (detectedAsset) {
            detectedAsset.textContent =
                data.asset && data.asset !== "UNKNOWN"
                    ? data.asset : "Non identifié";
        }

        if (detectedTimeframe) {
            detectedTimeframe.textContent =
                data.timeframe && data.timeframe !== "UNKNOWN"
                    ? data.timeframe : "Non identifié";
        }
    }

    /* =========================================================
       RENDU RÉSULTATS
       ========================================================= */

    function renderResults(data, mode) {

        if (!resultsSection || !resultsContent) return;

        resultsSection.style.display = "block";
        resultsContent.innerHTML = mode === "audit"
            ? renderAuditResults(data)
            : renderScanResults(data);

        attachCopyButton();

        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderScanResults(data) {

        const signal = safe(data.signal, "WAIT");
        const direction = safe(data.direction, "—");
        const signalClass = getSignalClass(signal);

        const strategyInfo = getStrategyInfo(data);
        const marketInfo = getMarketInfo(data);

        const confluenceHtml = data.confluence_status
            ? renderConfluence(data.confluence_status)
            : "";

        const ictDetails = data.ict_analysis ? `
            ${detailBlock("🎯 OTE", safe(data.ict_analysis.ote, "—"))}
            ${detailBlock("🪤 IDM", safe(data.ict_analysis.idm, "—"))}
            ${detailBlock("🔨 Breaker Block", safe(data.ict_analysis.breaker_block, "—"))}
            ${detailBlock("🛡️ Mitigation Block", safe(data.ict_analysis.mitigation_block, "—"))}
            ${detailBlock("⚖️ Premium/Discount", safe(data.ict_analysis.premium_discount, "—"))}
        ` : "";

        const smcDetails = (
            data.strategy_applied === "SMC" ||
            data.strategy_applied === "SMC_PA_HYBRID" ||
            data.strategy_applied === "ICT"
        ) ? `
            ${detailBlock("💧 Liquidité", safe(data.liquidity, "—"))}
            ${detailBlock("📦 Order Block", safe(data.order_block, "—"))}
            ${detailBlock("📉 FVG", safe(data.fvg, "—"))}
        ` : "";

        const paDetails = `
            ${detailBlock("📏 Supports/Résistances", safe(data.supports_resistances, "—"))}
            ${detailBlock("📐 Trendlines", safe(data.trendlines, "—"))}
            ${detailBlock("💥 Cassure", safe(data.breakout, "—"))}
            ${detailBlock("🔄 Retest", safe(data.retest, "—"))}
            ${detailBlock("⚡ Momentum", safe(data.momentum, "—"))}
        `;

        const zones = Array.isArray(data.zones) ? data.zones : [];
        const zonesHtml = zones.length ? `
            <div class="zones-section">
                <h3 class="zones-title">🎯 Scénarios multiples (${zones.length})</h3>
                <div class="zones-grid">
                    ${zones.map(z => renderZone(z)).join("")}
                </div>
            </div>
        ` : "";

        const riskHtml = renderRiskManager(data.risk_management);

        return `
            <div class="result-main ${signalClass}">
                <div class="result-signal">${escapeHtml(signal)}</div>
                <div class="result-meta">
                    Direction : <strong>${escapeHtml(direction)}</strong>
                </div>
                <div class="strategy-badge ${strategyInfo.class}">
                    ${escapeHtml(strategyInfo.label)}
                    <span class="market-type">${escapeHtml(marketInfo)}</span>
                </div>
            </div>

            ${confluenceHtml}

            <div class="result-grid">
                ${resultCard("🎯 Entry", formatNumber(data.entry))}
                ${resultCard("🛑 Stop Loss", formatNumber(data.sl))}
                ${resultCard("💰 TP1", formatNumber(data.tp1))}
                ${resultCard("💰 TP2", formatNumber(data.tp2))}
                ${resultCard("💰 TP3", formatNumber(data.tp3))}
                ${resultCard("📊 Risk/Reward", safe(data.rr, "—"))}
                ${resultCard("🎯 Confiance", safe(data.confidence_percent, "—") + "%")}
                ${resultCard("⭐ ARKAS Score", safe(data.arkas_score, "—"))}
            </div>

            ${riskHtml}

            <div class="analysis-details">
                ${detailBlock("📈 Structure", safe(data.structure, "—"))}
                ${ictDetails}
                ${smcDetails}
                ${paDetails}
                ${detailBlock("🧠 Pourquoi ?", safe(data.reason, "—"))}
                ${detailBlock("🎯 Scénario principal", safe(data.primary_scenario, "—"))}
                ${detailBlock("🔄 Scénario alternatif", safe(data.alternative_scenario, "—"))}
                ${detailBlock("⚠️ Invalidation", safe(data.invalidation, "—"))}
                ${detailBlock("📰 Economic News", safe(data.economic_news, "Non vérifiées"))}
            </div>

            ${zonesHtml}

            <div class="copy-signal-area">
                <button type="button" class="copy-signal-btn" data-mode="scan">
                    📋 Copier le signal
                </button>
            </div>
        `;
    }

    function renderRiskManager(risk) {

        if (!risk || typeof risk !== "object") return "";

        return `
            <div class="risk-manager">
                <h3>🛡️ Gestionnaire de risque (Assurance)</h3>

                <div class="risk-grid">
                    <div class="risk-item">
                        <span>Risque recommandé</span>
                        <strong>${escapeHtml(risk.risk_percent || "1%")}</strong>
                    </div>
                    <div class="risk-item">
                        <span>RR minimum</span>
                        <strong>${escapeHtml(String(risk.rr_minimum || 1.5))}</strong>
                    </div>
                    <div class="risk-item">
                        <span>Position sizing</span>
                        <strong>${escapeHtml(risk.position_recommendation || "—")}</strong>
                    </div>
                    <div class="risk-item">
                        <span>Invalidation</span>
                        <strong>${escapeHtml(risk.invalidation_condition || "—")}</strong>
                    </div>
                </div>

                ${risk.insurance_note ? `
                    <div class="insurance-note">
                        🔔 <strong>Note d'assurance :</strong> ${escapeHtml(risk.insurance_note)}
                    </div>
                ` : ""}
            </div>
        `;
    }

    function renderZone(zone) {

        const typeClass = zone.type.includes("BUY") ? "zone-buy" : "zone-sell";

        const probClass =
            zone.probability === "haute" ? "prob-high" :
            zone.probability === "basse" ? "prob-low" : "prob-mid";

        return `
            <div class="zone-card ${typeClass}">
                <div class="zone-header">
                    <span class="zone-id">${escapeHtml(zone.id)}</span>
                    <span class="zone-type">${escapeHtml(zone.type.replace("_", " "))}</span>
                    <span class="zone-priority">P${zone.priority}</span>
                </div>

                <div class="zone-label">${escapeHtml(zone.zone_label)}</div>

                ${zone.zone_price ? `
                    <div class="zone-price">📍 ${escapeHtml(zone.zone_price)}</div>
                ` : ""}

                <div class="zone-levels">
                    <div><span>Entry</span><strong>${escapeHtml(String(zone.entry ?? "—"))}</strong></div>
                    <div><span>SL</span><strong>${escapeHtml(String(zone.sl ?? "—"))}</strong></div>
                    <div><span>TP1</span><strong>${escapeHtml(String(zone.tp1 ?? "—"))}</strong></div>
                    <div><span>TP2</span><strong>${escapeHtml(String(zone.tp2 ?? "—"))}</strong></div>
                    <div><span>TP3</span><strong>${escapeHtml(String(zone.tp3 ?? "—"))}</strong></div>
                    <div><span>RR</span><strong>${escapeHtml(String(zone.rr ?? "—"))}</strong></div>
                </div>

                <div class="zone-probability ${probClass}">
                    Probabilité : <strong>${escapeHtml(zone.probability)}</strong>
                </div>

                ${zone.trigger ? `
                    <div class="zone-trigger">
                        ⚡ <strong>Trigger :</strong> ${escapeHtml(zone.trigger)}
                    </div>
                ` : ""}

                ${zone.invalidation ? `
                    <div class="zone-invalidation">
                        ⚠️ <strong>Invalidation :</strong> ${escapeHtml(zone.invalidation)}
                    </div>
                ` : ""}
            </div>
        `;
    }

    function renderAuditResults(data) {

        const audit = data.audit || {};
        const status = safe(audit.status, "UNCLEAR");
        const verdict = safe(audit.verdict, "Audit non disponible.");

        const strengths = safeList(audit.strengths);
        const errors = safeList(audit.errors);
        const corrections = safeList(audit.corrections);
        const corrected = audit.corrected_trade || {};
        const verification = audit.verification || {};

        const statusInfo = getAuditStatus(status);
        const verificationHtml = renderVerification(verification);

        return `
            <div class="audit-verdict ${statusInfo.className}">
                <div class="audit-icon">${statusInfo.icon}</div>
                <div>
                    <div class="audit-title">${escapeHtml(statusInfo.title)}</div>
                    <div class="audit-description">${escapeHtml(verdict)}</div>
                </div>
            </div>

            ${verificationHtml}

            <div class="audit-columns">
                <div class="audit-box">
                    <h3>✅ Points positifs</h3>
                    ${renderList(strengths)}
                </div>
                <div class="audit-box">
                    <h3>⚠️ Points à corriger</h3>
                    ${renderList(errors)}
                </div>
            </div>

            <div class="audit-box correction-box">
                <h3>🛠️ Corrections proposées</h3>
                ${renderList(corrections)}
            </div>

            <div class="corrected-trade">
                <h3>🎯 Analyse corrigée</h3>
                <div class="result-grid">
                    ${resultCard("Signal", safe(corrected.signal, "WAIT"))}
                    ${resultCard("Entry", formatNumber(corrected.entry))}
                    ${resultCard("SL", formatNumber(corrected.sl))}
                    ${resultCard("TP1", formatNumber(corrected.tp1))}
                    ${resultCard("TP2", formatNumber(corrected.tp2))}
                    ${resultCard("TP3", formatNumber(corrected.tp3))}
                    ${resultCard("RR", safe(corrected.rr, "—"))}
                </div>

                <div class="validation-probability">
                    <span>Probabilité de validation :</span>
                    <strong>${escapeHtml(String(corrected.validation_probability ?? "—"))}%</strong>
                </div>

                <div class="copy-signal-area">
                    <button type="button" class="copy-signal-btn" data-mode="audit">
                        📋 Copier le signal corrigé
                    </button>
                </div>
            </div>
        `;
    }

    function renderVerification(v) {

        const items = [
            { label: "SL structure", value: v.sl_structure },
            { label: "RR check", value: v.rr_check },
            { label: "Confluence", value: v.confluence_check },
            { label: "Biais aligné", value: v.bias_alignment },
            { label: "Premium/Discount", value: v.premium_discount },
            { label: "Risque news", value: v.news_risk },
            { label: "Timeframe", value: v.timeframe_check }
        ];

        return `
            <div class="verification-grid">
                ${items.map(item => `
                    <div class="verification-item ${getVerificationClass(item.value)}">
                        <span>${escapeHtml(item.label)}</span>
                        <strong>${escapeHtml(item.value || "—")}</strong>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function getVerificationClass(value) {
        const v = String(value || "").toUpperCase();
        if (v === "PASS") return "verify-pass";
        if (v === "FAIL") return "verify-fail";
        return "verify-unclear";
    }

    function getStrategyInfo(data) {
        switch (data.strategy_applied) {
            case "SMC": return { label: "🎯 SMC Pur", class: "strat-smc" };
            case "ICT": return { label: "🎯 ICT", class: "strat-ict" };
            case "SMC_PA_HYBRID": return { label: "⚡ SMC + PA", class: "strat-hybrid" };
            case "PRICE_ACTION_SIMPLIFIED": return { label: "📊 Price Action", class: "strat-pa" };
            case "AUDIT": return { label: "🧪 Audit", class: "strat-audit" };
            default: return { label: "🔍 Analyse", class: "strat-default" };
        }
    }

    function getMarketInfo(data) {
        switch (data.market_type) {
            case "GOLD": return "🥇 Or";
            case "FOREX": return "💱 Forex";
            case "CRYPTO_MAJOR": return "₿ Crypto";
            case "INDICES": return "📈 Indices";
            case "OTHER": return "🔍 Autre";
            default: return "Détection auto";
        }
    }

    function renderConfluence(status) {
        const map = {
            ALIGNED: { cls: "confluence-aligned", label: "✅ Alignés" },
            PARTIAL: { cls: "confluence-partial", label: "⚠️ Partiel" },
            DISAGREEMENT: { cls: "confluence-disagreement", label: "❌ Désaccord" },
            NEUTRAL: { cls: "confluence-neutral", label: "➖ Neutre" }
        };
        const info = map[status] || map.NEUTRAL;
        return `
            <div class="confluence-banner ${info.cls}">
                <strong>Confluence :</strong> ${escapeHtml(info.label)}
            </div>
        `;
    }

    function resultCard(title, value) {
        return `
            <div class="result-card">
                <span class="result-card-title">${escapeHtml(title)}</span>
                <strong class="result-card-value">${escapeHtml(String(value))}</strong>
            </div>
        `;
    }

    function detailBlock(title, value) {
        return `
            <div class="detail-block">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(String(value))}</p>
            </div>
        `;
    }

    function renderList(items) {
        if (!items.length) return `<p class="empty-list">Aucun élément.</p>`;
        return `
            <ul>
                ${items.map(item => `<li>${escapeHtml(String(item))}</li>`).join("")}
            </ul>
        `;
    }

    function safe(value, fallback = "—") {
        if (value === null || value === undefined || value === "") return fallback;
        return value;
    }

    function safeList(value) {
        if (Array.isArray(value)) return value.filter(Boolean);
        if (typeof value === "string" && value.trim()) return [value];
        return [];
    }

    function formatNumber(value) {
        if (value === null || value === undefined || value === "") return "—";
        return String(value);
    }

    function getSignalClass(signal) {
        const s = String(signal).toUpperCase();
        if (s.includes("BUY")) return "signal-buy";
        if (s.includes("SELL")) return "signal-sell";
        return "signal-wait";
    }

    function getAuditStatus(status) {
        switch (String(status).toUpperCase()) {
            case "VALIDATED": return { icon: "✅", title: "ANALYSE VALIDÉE", className: "audit-valid" };
            case "CORRECT": return { icon: "⚠️", title: "ANALYSE À CORRIGER", className: "audit-correct" };
            case "PREMATURE": return { icon: "🟡", title: "ENTRÉE PRÉMATURÉE", className: "audit-premature" };
            case "INVALID": return { icon: "❌", title: "ANALYSE INVALIDÉE", className: "audit-invalid" };
            default: return { icon: "❓", title: "ANALYSE NON DÉTERMINÉE", className: "audit-unclear" };
        }
    }

    function attachCopyButton() {
        const copyBtns = document.querySelectorAll(".copy-signal-btn");
        copyBtns.forEach((copyBtn) => {
            if (copyBtn.dataset.bound === "true") return;
            copyBtn.dataset.bound = "true";
            copyBtn.addEventListener("click", async () => {
                const text = createCopyText();
                try {
                    await navigator.clipboard.writeText(text);
                    const original = copyBtn.textContent;
                    copyBtn.textContent = "✅ Signal copié !";
                    setTimeout(() => { copyBtn.textContent = original; }, 2000);
                } catch (error) {
                    console.error("Copy error:", error);
                    copyBtn.textContent = "❌ Copie impossible";
                }
            });
        });
    }

    function createCopyText() {
        if (!resultsContent) return "";
        return resultsContent.innerText.trim();
    }

    function setButtonsDisabled(disabled) {
        if (analyzeBtn) analyzeBtn.disabled = disabled;
        if (auditBtn) auditBtn.disabled = disabled;
        if (importBtn) importBtn.disabled = disabled;
        if (dropZone) dropZone.classList.toggle("scanner-disabled", disabled);
    }

    function showStatus(message, type = "info") {
        if (!analysisStatus) return;
        analysisStatus.textContent = message;
        analysisStatus.className = "analysis-status status-" + type;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

});
