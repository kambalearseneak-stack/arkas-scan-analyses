/* =========================================================
   ARKAS SCAN AI V2 — DASHBOARD MULTI-TIMEFRAME
   Upload multiple + Attribution timeframe + Analyse
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const MAX_IMAGES = 3;
    const MAX_SIZE = 10 * 1024 * 1024;

    let slots = {
        1: { base64: null, mimeType: null },
        2: { base64: null, mimeType: null },
        3: { base64: null, mimeType: null }
    };

    let isProcessing = false;

    /* =========================================================
       RÉFÉRENCES DOM
       ========================================================= */

    const fileInput = document.getElementById("chart-files");
    const importBtn = document.getElementById("import-btn");
    const dropZone = document.getElementById("dropZone");
    const previewContainer = document.getElementById("preview-container");
    const scannerActions = document.getElementById("scanner-actions");
    const analyzeBtn = document.getElementById("analyze-btn");
    const resetBtn = document.getElementById("reset-btn");
    const analysisStatus = document.getElementById("analysis-status");
    const resultsSection = document.getElementById("results-section");
    const resultsContent = document.getElementById("results-content");
    const globalLoader = document.getElementById("global-loader");

    /* =========================================================
       IMPORT
       ========================================================= */

    if (importBtn) {
        importBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isProcessing) fileInput.click();
        });
    }

    if (dropZone) {

        dropZone.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            if (!isProcessing) fileInput.click();
        });

        dropZone.addEventListener("keydown", (e) => {
            if ((e.key === "Enter" || e.key === " ") && !isProcessing) {
                e.preventDefault();
                fileInput.click();
            }
        });

        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("drag-over");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("drag-over");
            if (isProcessing) return;

            const files = Array.from(e.dataTransfer.files).slice(0, MAX_IMAGES);
            if (files.length) handleFiles(files);
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (!fileInput.files || !fileInput.files.length) return;
            const files = Array.from(fileInput.files).slice(0, MAX_IMAGES);
            handleFiles(files);
        });
    }

    /* =========================================================
       COMPRESSION
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
                    (blob) => blob ? resolve(blob) : reject(new Error("Compression échouée")),
                    "image/jpeg",
                    quality
                );
            };

            img.onerror = () => reject(new Error("Lecture échouée"));
            img.src = url;
        });
    }

    /* =========================================================
       TRAITEMENT DES FICHIERS
       ========================================================= */

    async function handleFiles(files) {

        const allowed = ["image/jpeg", "image/png", "image/webp"];

        // Reset
        for (let i = 1; i <= MAX_IMAGES; i++) {
            slots[i] = { base64: null, mimeType: null };
        }

        showStatus(`📷 Traitement de ${files.length} image(s)…`, "info");

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const slotN = i + 1;

            if (!allowed.includes(file.type)) {
                showStatus(`❌ Image ${slotN} : format non supporté.`, "error");
                continue;
            }

            if (file.size > MAX_SIZE) {
                showStatus(`❌ Image ${slotN} : trop lourde (max 10 MB).`, "error");
                continue;
            }

            try {
                const compressed = await compressImage(file);
                const base64 = await blobToDataURL(compressed);

                slots[slotN].base64 = base64;
                slots[slotN].mimeType = "image/jpeg";

            } catch (err) {
                console.error(err);
                showStatus(`❌ Erreur image ${slotN}.`, "error");
            }
        }

        renderPreviews();
        updateAnalyzeButton();
    }

    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /* =========================================================
       AFFICHAGE DES APERÇUS
       ========================================================= */

    function renderPreviews() {

        let hasAny = false;

        for (let i = 1; i <= MAX_IMAGES; i++) {

            const slotEl = document.querySelector(`.tf-slot[data-slot="${i}"]`);
            const imgEl = document.getElementById(`tf-img-${i}`);

            if (slots[i].base64) {
                imgEl.src = slots[i].base64;
                slotEl.style.display = "block";
                hasAny = true;
            } else {
                imgEl.src = "";
                slotEl.style.display = "none";
            }
        }

        if (hasAny) {
            previewContainer.style.display = "block";
            dropZone.style.display = "none";
            scannerActions.style.display = "flex";
        } else {
            previewContainer.style.display = "none";
            dropZone.style.display = "block";
            scannerActions.style.display = "none";
        }
    }

    /* =========================================================
       TIMEFRAME
       ========================================================= */

    for (let i = 1; i <= MAX_IMAGES; i++) {
        const selectEl = document.getElementById(`tf-select-${i}`);
        if (selectEl) {
            selectEl.addEventListener("change", updateAnalyzeButton);
        }
    }

    /* =========================================================
       RETIRER UNE IMAGE
       ========================================================= */

    document.querySelectorAll(".tf-remove-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const slotN = Number(btn.dataset.slot);
            if (slotN) removeSlot(slotN);
        });
    });

    function removeSlot(n) {

        slots[n] = { base64: null, mimeType: null };

        const selectEl = document.getElementById(`tf-select-${n}`);
        if (selectEl) selectEl.value = "";

        renderPreviews();
        updateAnalyzeButton();
    }

    /* =========================================================
       RÉINITIALISER
       ========================================================= */

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {

            for (let i = 1; i <= MAX_IMAGES; i++) {
                slots[i] = { base64: null, mimeType: null };
                const selectEl = document.getElementById(`tf-select-${i}`);
                if (selectEl) selectEl.value = "";
            }

            if (fileInput) fileInput.value = "";

            resultsSection.classList.add("hidden");
            renderPreviews();
            updateAnalyzeButton();
            showStatus("🔄 Réinitialisé.", "info");
        });
    }

    /* =========================================================
       BOUTON ANALYSER
       ========================================================= */

    function updateAnalyzeButton() {

        const filled = [];

        for (let i = 1; i <= MAX_IMAGES; i++) {
            if (!slots[i].base64) continue;
            const tf = document.getElementById(`tf-select-${i}`)?.value;
            if (tf) filled.push({ slot: i, tf });
        }

        const totalFilled = Object.values(slots).filter(s => s.base64).length;

        const can = filled.length >= 1 && !isProcessing;
        analyzeBtn.disabled = !can;

        if (totalFilled === 0) {
            showStatus("Importe au moins 1 capture.", "info");
        } else if (filled.length < totalFilled) {
            showStatus("⚠️ Donne un timeframe à chaque image.", "info");
        } else {
            showStatus(`✅ ${filled.length} image(s) prête(s).`, "success");
        }
    }

    /* =========================================================
       ANALYSE
       ========================================================= */

    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", async () => {
            if (isProcessing) return;
            await analyzeMultiTF();
        });
    }

    async function analyzeMultiTF() {

        const images = [];

        for (let i = 1; i <= MAX_IMAGES; i++) {
            if (!slots[i].base64) continue;

            const tf = document.getElementById(`tf-select-${i}`)?.value;
            if (!tf) continue;

            const clean = slots[i].base64.includes(",")
                ? slots[i].base64.split(",")[1]
                : slots[i].base64;

            images.push({
                timeframe: tf,
                imageBase64: clean,
                mimeType: slots[i].mimeType || "image/jpeg"
            });
        }

        if (!images.length) {
            showStatus("❌ Aucune image valide.", "error");
            return;
        }

        isProcessing = true;
        setButtonsDisabled(true);
        resultsSection.classList.add("hidden");
        globalLoader.classList.remove("hidden");
        showStatus("🔍 Analyse en cours…", "loading");

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    mode: "multi-tf",
                    images: images
                })
            });

            clearTimeout(timeoutId);

            let data;
            try { data = await response.json(); }
            catch { throw new Error("Réponse serveur invalide."); }

            if (!response.ok) throw new Error(data?.error || `Erreur ${response.status}`);
            if (!data) throw new Error("Aucune réponse.");

            renderResults(data);
            showStatus("✅ Analyse terminée.", "success");

        } catch (error) {
            console.error(error);
            showStatus("❌ " + (error?.message || "Erreur."), "error");
        } finally {
            globalLoader.classList.add("hidden");
            isProcessing = false;
            setButtonsDisabled(false);
        }
    }

    /* =========================================================
       RENDU RÉSULTATS
       ========================================================= */

    function renderResults(data) {

        resultsSection.classList.remove("hidden");

        const signal = data.signal || "WAIT";
        const signalClass = getSignalClass(signal);

        const confluenceHtml = data.confluence_status
            ? renderConfluence(data.confluence_status)
            : "";

        const tfHtml = Array.isArray(data.tf_analysis) && data.tf_analysis.length
            ? `
                <div class="tf-analysis-section">
                    <h3 class="zones-title">🔍 Analyse par timeframe</h3>
                    <div class="tf-analysis-grid">
                        ${data.tf_analysis.map(tf => `
                            <div class="tf-analysis-card">
                                <div class="tf-analysis-header">
                                    <strong>${escapeHtml(tf.timeframe || "—")}</strong>
                                    <span class="tf-bias tf-bias-${(tf.bias || "neutral").toLowerCase()}">
                                        ${escapeHtml(tf.bias || "—")}
                                    </span>
                                </div>
                                <p>${escapeHtml(tf.structure || "—")}</p>
                                ${tf.key_zone ? `<small>📍 ${escapeHtml(tf.key_zone)}</small>` : ""}
                            </div>
                        `).join("")}
                    </div>
                </div>
            `
            : "";

        const zonesHtml = Array.isArray(data.zones) && data.zones.length
            ? `
                <div class="zones-section">
                    <h3 class="zones-title">🎯 Scénarios multiples</h3>
                    <div class="zones-grid">
                        ${data.zones.map(z => renderZone(z)).join("")}
                    </div>
                </div>
            `
            : "";

        resultsContent.innerHTML = `
            <div class="result-main ${signalClass}">
                <div class="result-signal">${escapeHtml(signal)}</div>
                <div class="result-meta">
                    Actif : <strong>${escapeHtml(data.asset || "—")}</strong>
                </div>
                <div class="strategy-badge">
                    ${escapeHtml(data.strategy_applied || "MULTI_TF")}
                    <span class="market-type">${escapeHtml(data.market_type || "—")}</span>
                </div>
            </div>

            ${confluenceHtml}
            ${tfHtml}

            <div class="result-grid">
                ${resultCard("🎯 Entry", formatNumber(data.entry))}
                ${resultCard("🛑 Stop Loss", formatNumber(data.sl))}
                ${resultCard("💰 TP1", formatNumber(data.tp1))}
                ${resultCard("💰 TP2", formatNumber(data.tp2))}
                ${resultCard("💰 TP3", formatNumber(data.tp3))}
                ${resultCard("📊 RR", safe(data.rr, "—"))}
                ${resultCard("🎯 Confiance", safe(data.confidence_percent, "—") + "%")}
                ${resultCard("⭐ Score", safe(data.arkas_score, "—"))}
            </div>

            <div class="analysis-details">
                ${detailBlock("📈 Structure", safe(data.structure, "—"))}
                ${detailBlock("🧠 Pourquoi ?", safe(data.reason, "—"))}
                ${detailBlock("🎯 Scénario principal", safe(data.primary_scenario, "—"))}
                ${detailBlock("⚠️ Invalidation", safe(data.invalidation, "—"))}
            </div>

            ${zonesHtml}

            <div class="copy-signal-area">
                <button type="button" class="copy-signal-btn" id="copy-signal-btn">
                    📋 Copier le signal
                </button>
            </div>
        `;

        attachCopyButton(data);
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderConfluence(status) {
        const map = {
            ALIGNED:      { cls: "confluence-aligned",      label: "✅ Timeframes alignés" },
            PARTIAL:      { cls: "confluence-partial",      label: "⚠️ Alignement partiel" },
            DISAGREEMENT: { cls: "confluence-disagreement", label: "❌ Désaccord entre timeframes" },
            NEUTRAL:      { cls: "confluence-neutral",      label: "➖ Neutre" }
        };
        const info = map[status] || map.NEUTRAL;
        return `<div class="confluence-banner ${info.cls}"><strong>Confluence :</strong> ${escapeHtml(info.label)}</div>`;
    }

    function renderZone(zone) {
        const typeClass = String(zone.type || "").includes("BUY") ? "zone-buy" : "zone-sell";

        return `
            <div class="zone-card ${typeClass}">
                <div class="zone-header">
                    <span class="zone-id">${escapeHtml(zone.id || "A")}</span>
                    <span class="zone-type">${escapeHtml(String(zone.type || "").replace("_", " "))}</span>
                    <span class="zone-priority">P${zone.priority || 1}</span>
                </div>
                <div class="zone-label">${escapeHtml(zone.zone_label || "")}</div>
                ${zone.zone_price ? `<div class="zone-price">📍 ${escapeHtml(zone.zone_price)}</div>` : ""}
                <div class="zone-levels">
                    <div><span>Entry</span><strong>${escapeHtml(String(zone.entry ?? "—"))}</strong></div>
                    <div><span>SL</span><strong>${escapeHtml(String(zone.sl ?? "—"))}</strong></div>
                    <div><span>TP1</span><strong>${escapeHtml(String(zone.tp1 ?? "—"))}</strong></div>
                    <div><span>TP2</span><strong>${escapeHtml(String(zone.tp2 ?? "—"))}</strong></div>
                    <div><span>TP3</span><strong>${escapeHtml(String(zone.tp3 ?? "—"))}</strong></div>
                    <div><span>RR</span><strong>${escapeHtml(String(zone.rr ?? "—"))}</strong></div>
                </div>
            </div>
        `;
    }

    /* =========================================================
       COPIER
       ========================================================= */

    function attachCopyButton(data) {
        const btn = document.getElementById("copy-signal-btn");
        if (!btn) return;

        btn.addEventListener("click", async () => {
            const text = buildSignalText(data);
            try {
                await navigator.clipboard.writeText(text);
                btn.textContent = "✅ Signal copié !";
                saveToHistory(data);
                renderHistory();
                setTimeout(() => { btn.textContent = "📋 Copier le signal"; }, 2000);
            } catch (err) {
                btn.textContent = "❌ Copie impossible";
            }
        });
    }

    function buildSignalText(data) {
        return [
            "🎯 ARKAS SIGNAL",
            "",
            `Actif : ${data.asset || "—"}`,
            `Signal : ${data.signal || "WAIT"}`,
            `Direction : ${data.direction || "—"}`,
            "",
            `Entry : ${data.entry ?? "—"}`,
            `SL : ${data.sl ?? "—"}`,
            `TP1 : ${data.tp1 ?? "—"}`,
            `TP2 : ${data.tp2 ?? "—"}`,
            `TP3 : ${data.tp3 ?? "—"}`,
            `RR : ${data.rr ?? "—"}`,
            "",
            `Confiance : ${data.confidence_percent ?? "—"}%`,
            `Score : ${data.arkas_score ?? "—"}`,
            "",
            "Généré par ARKAS SCAN AI"
        ].join("\n");
    }

    /* =========================================================
       HISTORIQUE
       ========================================================= */

    function saveToHistory(data) {
        try {
            const key = "arkas_signals_history";
            const history = JSON.parse(localStorage.getItem(key) || "[]");
            history.unshift({
                id: Date.now(),
                asset: data.asset || "—",
                signal: data.signal || "WAIT",
                direction: data.direction || "—",
                entry: data.entry,
                sl: data.sl,
                tp1: data.tp1,
                tp2: data.tp2,
                tp3: data.tp3,
                rr: data.rr,
                confidence: data.confidence_percent,
                score: data.arkas_score,
                result: "PENDING",
                date: new Date().toISOString()
            });
            localStorage.setItem(key, JSON.stringify(history.slice(0, 50)));
        } catch (e) {}
    }

    function renderHistory() {

        const container = document.getElementById("history-content");
        const statsEl = {
            total: document.getElementById("stat-total"),
            win: document.getElementById("stat-win"),
            loss: document.getElementById("stat-loss"),
            rate: document.getElementById("stat-rate")
        };

        if (!container) return;

        let history = [];
        try { history = JSON.parse(localStorage.getItem("arkas_signals_history") || "[]"); } catch {}

        if (!history.length) {
            container.innerHTML = `
                <div class="empty-result">
                    <div>📭</div>
                    <h3>Aucun signal enregistré</h3>
                    <p>Les signaux copiés apparaîtront ici.</p>
                </div>
            `;
            if (statsEl.total) statsEl.total.textContent = "0";
            if (statsEl.win) statsEl.win.textContent = "0";
            if (statsEl.loss) statsEl.loss.textContent = "0";
            if (statsEl.rate) statsEl.rate.textContent = "—";
            return;
        }

        const total = history.length;
        const wins = history.filter(h => h.result === "WIN").length;
        const losses = history.filter(h => h.result === "LOSS").length;
        const rate = total ? Math.round((wins / total) * 100) : 0;

        if (statsEl.total) statsEl.total.textContent = total;
        if (statsEl.win) statsEl.win.textContent = wins;
        if (statsEl.loss) statsEl.loss.textContent = losses;
        if (statsEl.rate) statsEl.rate.textContent = `${rate}%`;

        container.innerHTML = `
            <div class="history-list">
                ${history.map(h => `
                    <div class="history-item">
                        <div class="history-line">
                            <strong>${escapeHtml(h.asset)}</strong>
                            <span class="history-signal">${escapeHtml(h.signal)}</span>
                        </div>
                        <div class="history-line">
                            <small>${new Date(h.date).toLocaleString("fr-FR")}</small>
                        </div>
                        <div class="history-line">
                            <span>Entry : ${h.entry ?? "—"}</span>
                            <span>SL : ${h.sl ?? "—"}</span>
                            <span>TP1 : ${h.tp1 ?? "—"}</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    /* =========================================================
       HELPERS
       ========================================================= */

    function setButtonsDisabled(d) {
        if (analyzeBtn) analyzeBtn.disabled = d;
        if (resetBtn) resetBtn.disabled = d;
        if (importBtn) importBtn.disabled = d;
    }

    function showStatus(msg, type = "info") {
        if (!analysisStatus) return;
        analysisStatus.textContent = msg;
        analysisStatus.className = "analysis-status status-" + type;
    }

    function resultCard(title, value) {
        return `<div class="result-card"><span class="result-card-title">${escapeHtml(title)}</span><strong class="result-card-value">${escapeHtml(String(value))}</strong></div>`;
    }

    function detailBlock(title, value) {
        return `<div class="detail-block"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(String(value))}</p></div>`;
    }

    function safe(v, f = "—") {
        if (v === null || v === undefined || v === "") return f;
        return v;
    }

    function formatNumber(v) {
        if (v === null || v === undefined || v === "") return "—";
        return String(v);
    }

    function getSignalClass(signal) {
        const s = String(signal).toUpperCase();
        if (s.includes("BUY")) return "signal-buy";
        if (s.includes("SELL")) return "signal-sell";
        return "signal-wait";
    }

    function escapeHtml(v) {
        return String(v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =========================================================
       INITIALISATION
       ========================================================= */

    renderPreviews();
    updateAnalyzeButton();
    renderHistory();

});
