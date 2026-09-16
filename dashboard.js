/* =========================================================
   ARKAS SCAN AI V2 — DASHBOARD MULTI-TIMEFRAME
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const MAX_IMAGES = 3;
    const MAX_SIZE = 10 * 1024 * 1024;

    let slots = {
        1: { base64: null, mimeType: null, fileName: null, timeframe: null },
        2: { base64: null, mimeType: null, fileName: null, timeframe: null },
        3: { base64: null, mimeType: null, fileName: null, timeframe: null }
    };

    let isProcessing = false;

    const analyzeBtn = document.getElementById("analyze-btn");
    const resetBtn = document.getElementById("reset-btn");
    const analysisStatus = document.getElementById("analysis-status");
    const resultsSection = document.getElementById("results-section");
    const resultsContent = document.getElementById("results-content");
    const globalLoader = document.getElementById("global-loader");

    /* =========================================================
       SETUP SLOTS
       ========================================================= */

    for (let i = 1; i <= MAX_IMAGES; i++) setupSlot(i);

    function setupSlot(n) {

        const dropEl = document.getElementById(`tf-drop-${n}`);
        const inputEl = document.getElementById(`tf-file-${n}`);
        const selectEl = document.getElementById(`tf-select-${n}`);
        const removeBtn = document.querySelector(`.tf-remove-btn[data-slot="${n}"]`);

        selectEl.addEventListener("change", () => {
            slots[n].timeframe = selectEl.value;
            updateAnalyzeButton();
        });

        dropEl.addEventListener("click", () => {
            if (!isProcessing) inputEl.click();
        });

        dropEl.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropEl.classList.add("drag-over");
        });

        dropEl.addEventListener("dragleave", () => {
            dropEl.classList.remove("drag-over");
        });

        dropEl.addEventListener("drop", (e) => {
            e.preventDefault();
            dropEl.classList.remove("drag-over");
            if (isProcessing) return;
            if (e.dataTransfer.files.length) handleFile(n, e.dataTransfer.files[0]);
        });

        inputEl.addEventListener("change", () => {
            if (inputEl.files.length) handleFile(n, inputEl.files[0]);
        });

        removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            resetSlot(n);
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

            img.onerror = () => reject(new Error("Lecture image échouée"));
            img.src = url;
        });
    }

    /* =========================================================
       TRAITEMENT FICHIER
       ========================================================= */

    async function handleFile(n, file) {

        const allowed = ["image/jpeg", "image/png", "image/webp"];

        if (!allowed.includes(file.type)) {
            showStatus(`❌ Image ${n} : format non supporté.`, "error");
            return;
        }

        if (file.size > MAX_SIZE) {
            showStatus(`❌ Image ${n} : trop lourde.`, "error");
            return;
        }

        showStatus(`📷 Compression image ${n}…`, "info");

        try {
            const compressed = await compressImage(file);
            const reader = new FileReader();

            reader.onload = (event) => {

                slots[n].base64 = event.target.result;
                slots[n].mimeType = "image/jpeg";
                slots[n].fileName = file.name;

                document.getElementById(`tf-img-${n}`).src = event.target.result;
                document.getElementById(`tf-preview-${n}`).classList.remove("hidden");
                document.getElementById(`tf-drop-${n}`).classList.add("hidden");

                updateAnalyzeButton();
                showStatus(`✅ Image ${n} importée.`, "success");
            };

            reader.readAsDataURL(compressed);

        } catch (err) {
            console.error(err);
            showStatus(`❌ Erreur image ${n}.`, "error");
        }
    }

    /* =========================================================
       RESET SLOT
       ========================================================= */

    function resetSlot(n) {

        slots[n] = {
            base64: null,
            mimeType: null,
            fileName: null,
            timeframe: document.getElementById(`tf-select-${n}`).value || null
        };

        document.getElementById(`tf-preview-${n}`).classList.add("hidden");
        document.getElementById(`tf-drop-${n}`).classList.remove("hidden");
        document.getElementById(`tf-file-${n}`).value = "";
        document.getElementById(`tf-img-${n}`).src = "";

        updateAnalyzeButton();
    }

    /* =========================================================
       RESET GLOBAL
       ========================================================= */

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            for (let i = 1; i <= MAX_IMAGES; i++) {
                resetSlot(i);
                document.getElementById(`tf-select-${i}`).value = "";
                slots[i].timeframe = null;
            }
            resultsSection.classList.add("hidden");
            showStatus("🔄 Réinitialisé.", "info");
            updateAnalyzeButton();
        });
    }

    /* =========================================================
       BOUTON ANALYSER
       ========================================================= */

    function updateAnalyzeButton() {

        const filled = Object.values(slots).filter(s => s.base64);
        const allHaveTF = filled.every(s => s.timeframe);
        const can = filled.length >= 1 && allHaveTF && !isProcessing;

        analyzeBtn.disabled = !can;

        if (filled.length === 0) {
            showStatus("Importe au moins 1 capture avec son timeframe.", "info");
        } else if (!allHaveTF) {
            showStatus("⚠️ Sélectionne un timeframe pour chaque image.", "info");
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
            if (slots[i].base64 && slots[i].timeframe) {
                const clean = slots[i].base64.includes(",")
                    ? slots[i].base64.split(",")[1]
                    : slots[i].base64;

                images.push({
                    timeframe: slots[i].timeframe,
                    imageBase64: clean,
                    mimeType: slots[i].mimeType || "image/jpeg"
                });
            }
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

    updateAnalyzeButton();
    renderHistory();

});
