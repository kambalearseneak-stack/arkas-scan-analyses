/* =========================================================
   ARKAS SCAN AI V2 — DASHBOARD
   Multi-timeframe + Audit + Simulation
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

    const fileInput = document.getElementById("chart-files");
    const importBtn = document.getElementById("import-btn");
    const dropZone = document.getElementById("dropZone");
    const previewContainer = document.getElementById("preview-container");
    const scannerActions = document.getElementById("scanner-actions");
    const analyzeBtn = document.getElementById("analyze-btn");
    const auditBtn = document.getElementById("audit-btn");
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
                    (blob) => blob ? resolve(blob) : reject(new Error("Erreur")),
                    "image/jpeg", quality
                );
            };
            img.onerror = () => reject(new Error("Erreur"));
            img.src = url;
        });
    }

    async function handleFiles(files) {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        for (let i = 1; i <= MAX_IMAGES; i++) slots[i] = { base64: null, mimeType: null };

        showStatus(`📷 Traitement de ${files.length} image(s)…`, "info");

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const slotN = i + 1;
            if (!allowed.includes(file.type)) continue;
            if (file.size > MAX_SIZE) continue;

            try {
                const compressed = await compressImage(file);
                const base64 = await blobToDataURL(compressed);
                slots[slotN].base64 = base64;
                slots[slotN].mimeType = "image/jpeg";
            } catch (err) { console.error(err); }
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

    function renderPreviews() {
        let hasAny = false;
        for (let i = 1; i <= MAX_IMAGES; i++) {
            const slotEl = document.querySelector(`.tf-slot[data-slot="${i}"]`);
            const imgEl = document.getElementById(`tf-img-${i}`);
            const detectedEl = document.getElementById(`tf-detected-${i}`);
            if (!slotEl) continue;

            if (slots[i].base64) {
                if (imgEl) imgEl.src = slots[i].base64;
                slotEl.style.display = "block";
                hasAny = true;
                if (detectedEl) {
                    detectedEl.classList.add("hidden");
                    detectedEl.textContent = "Détection...";
                }
            } else {
                if (imgEl) imgEl.src = "";
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

    document.querySelectorAll(".tf-remove-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const slotN = Number(btn.dataset.slot);
            if (slotN) removeSlot(slotN);
        });
    });

    function removeSlot(n) {
        slots[n] = { base64: null, mimeType: null };
        renderPreviews();
        updateAnalyzeButton();
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            for (let i = 1; i <= MAX_IMAGES; i++) {
                slots[i] = { base64: null, mimeType: null };
                const scanEl = document.getElementById(`scan-preview-${i}`);
                if (scanEl) scanEl.classList.remove("is-scanning");
            }
            if (fileInput) fileInput.value = "";
            resultsSection.classList.add("hidden");
            renderPreviews();
            updateAnalyzeButton();
            showStatus("🔄 Réinitialisé.", "info");
        });
    }

    function updateAnalyzeButton() {
        const filled = Object.values(slots).filter(s => s.base64).length;
        const can = filled >= 1 && !isProcessing;

        if (analyzeBtn) analyzeBtn.disabled = !can;
        if (auditBtn) auditBtn.disabled = !can;

        if (filled === 0) {
            showStatus("Importe au moins 1 capture.", "info");
        } else {
            showStatus(`✅ ${filled} image(s) prête(s).`, "success");
        }
    }

    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", async () => {
            if (isProcessing) return;
            await analyzeMultiTF(false);
        });
    }

    if (auditBtn) {
        auditBtn.addEventListener("click", async () => {
            if (isProcessing) return;
            await analyzeMultiTF(true);
        });
    }

    function startScanEffect() {
        for (let i = 1; i <= MAX_IMAGES; i++) {
            if (!slots[i].base64) continue;
            const el = document.getElementById(`scan-preview-${i}`);
            if (el) el.classList.add("is-scanning");
        }
    }

    function stopScanEffect() {
        for (let i = 1; i <= MAX_IMAGES; i++) {
            const el = document.getElementById(`scan-preview-${i}`);
            if (el) el.classList.remove("is-scanning");
        }
    }

    async function analyzeMultiTF(isAudit = false) {

        const images = [];
        for (let i = 1; i <= MAX_IMAGES; i++) {
            if (!slots[i].base64) continue;
            const clean = slots[i].base64.includes(",")
                ? slots[i].base64.split(",")[1]
                : slots[i].base64;
            images.push({
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
        showStatus(isAudit ? "🧪 Audit en cours…" : "🔍 Analyse en cours…", "loading");

        startScanEffect();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    mode: isAudit ? "audit" : "multi-tf",
                    images: isAudit ? null : images,
                    imageBase64: isAudit ? images[0].imageBase64 : null,
                    mimeType: isAudit ? images[0].mimeType : null
                })
            });

            clearTimeout(timeoutId);

            let data;
            try { data = await response.json(); }
            catch { throw new Error("Réponse invalide."); }

            if (!response.ok) throw new Error(data?.error || `Erreur ${response.status}`);
            if (!data) throw new Error("Aucune réponse.");

            if (!isAudit) displayDetectedTimeframes(data);
            renderResults(data, isAudit);
            showStatus(isAudit ? "✅ Audit terminé." : "✅ Analyse terminée.", "success");

        } catch (error) {
            console.error(error);
            showStatus("❌ " + (error?.message || "Erreur."), "error");
        } finally {
            stopScanEffect();
            globalLoader.classList.add("hidden");
            isProcessing = false;
            setButtonsDisabled(false);
        }
    }

    function displayDetectedTimeframes(data) {
        const tfAnalysis = Array.isArray(data.tf_analysis) ? data.tf_analysis : [];
        for (let i = 1; i <= MAX_IMAGES; i++) {
            const detectedEl = document.getElementById(`tf-detected-${i}`);
            if (!detectedEl) continue;
            if (!slots[i].base64) { detectedEl.classList.add("hidden"); continue; }
            const tf = tfAnalysis[i - 1];
            if (tf && tf.timeframe) {
                detectedEl.textContent = `📊 ${tf.timeframe} — ${tf.bias || "—"}`;
                detectedEl.classList.remove("hidden");
                detectedEl.className = `tf-detected tf-bias-${(tf.bias || "neutral").toLowerCase()}`;
            } else {
                detectedEl.textContent = "📊 Timeframe non détecté";
                detectedEl.classList.remove("hidden");
            }
        }
    }

    function renderResults(data, isAudit = false) {
        resultsSection.classList.remove("hidden");

        if (isAudit) {
            resultsContent.innerHTML = renderAuditResults(data);
            attachCopyButton(data, true);
            resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

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
                <div class="result-meta">Actif : <strong>${escapeHtml(data.asset || "—")}</strong></div>
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
                <button type="button" class="copy-signal-btn" id="copy-signal-btn">📋 Copier le signal</button>
                <button type="button" class="copy-signal-btn simulate-btn" id="simulate-btn">🎮 Simuler ce trade</button>
            </div>
        `;

        attachCopyButton(data, false);
        attachSimulateButton(data);
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderAuditResults(data) {
        const audit = data.audit || {};
        const status = audit.status || "UNCLEAR";
        const verdict = audit.verdict || "Audit non disponible.";
        const corrected = audit.corrected_trade || {};

        const statusInfo = getAuditStatus(status);

        return `
            <div class="audit-verdict ${statusInfo.className}">
                <div class="audit-icon">${statusInfo.icon}</div>
                <div>
                    <div class="audit-title">${escapeHtml(statusInfo.title)}</div>
                    <div class="audit-description">${escapeHtml(verdict)}</div>
                </div>
            </div>

            <div class="audit-columns">
                <div class="audit-box">
                    <h3>✅ Points positifs</h3>
                    ${renderList(audit.strengths)}
                </div>
                <div class="audit-box">
                    <h3>⚠️ Points à corriger</h3>
                    ${renderList(audit.errors)}
                </div>
            </div>

            <div class="audit-box correction-box">
                <h3>🛠️ Corrections proposées</h3>
                ${renderList(audit.corrections)}
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
                    <button type="button" class="copy-signal-btn" id="copy-signal-btn">
                        📋 Copier le signal corrigé
                    </button>
                </div>
            </div>
        `;
    }

    function renderList(items) {
        if (!Array.isArray(items) || !items.length) {
            return `<p class="empty-list">Aucun élément.</p>`;
        }
        return `<ul>${items.map(i => `<li>${escapeHtml(String(i))}</li>`).join("")}</ul>`;
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

    function attachCopyButton(data, isAudit) {
        const btn = document.getElementById("copy-signal-btn");
        if (!btn) return;
        btn.addEventListener("click", async () => {
            const text = isAudit ? buildAuditText(data) : buildSignalText(data);
            try {
                await navigator.clipboard.writeText(text);
                btn.textContent = "✅ Signal copié !";
                if (!isAudit) { saveToHistory(data); renderHistory(); }
                setTimeout(() => { btn.textContent = "📋 Copier le signal"; }, 2000);
            } catch (err) { btn.textContent = "❌ Copie impossible"; }
        });
    }

    function buildSignalText(data) {
        return [
            "🎯 ARKAS SIGNAL", "",
            `Actif : ${data.asset || "—"}`,
            `Signal : ${data.signal || "WAIT"}`,
            `Direction : ${data.direction || "—"}`, "",
            `Entry : ${data.entry ?? "—"}`,
            `SL : ${data.sl ?? "—"}`,
            `TP1 : ${data.tp1 ?? "—"}`,
            `TP2 : ${data.tp2 ?? "—"}`,
            `TP3 : ${data.tp3 ?? "—"}`,
            `RR : ${data.rr ?? "—"}`, "",
            `Confiance : ${data.confidence_percent ?? "—"}%`,
            `Score : ${data.arkas_score ?? "—"}`, "",
            "Généré par ARKAS SCAN AI"
        ].join("\n");
    }

    function buildAuditText(data) {
        const audit = data.audit || {};
        const c = audit.corrected_trade || {};
        return [
            "🧪 ARKAS AUDIT", "",
            `Statut : ${audit.status || "—"}`,
            `Verdict : ${audit.verdict || "—"}`, "",
            "Analyse corrigée :",
            `Signal : ${c.signal ?? "—"}`,
            `Entry : ${c.entry ?? "—"}`,
            `SL : ${c.sl ?? "—"}`,
            `TP1 : ${c.tp1 ?? "—"}`,
            `RR : ${c.rr ?? "—"}`, "",
            `Probabilité : ${c.validation_probability ?? "—"}%`, "",
            "Généré par ARKAS SCAN AI"
        ].join("\n");
    }

    function attachSimulateButton(data) {
        const btn = document.getElementById("simulate-btn");
        if (!btn) return;
        if (!window.ARKAS_SIMULATOR) {
            btn.disabled = true;
            btn.textContent = "🎮 Simulateur indisponible";
            return;
        }
        btn.addEventListener("click", () => {
            const result = window.ARKAS_SIMULATOR.addTrade(data);
            if (result.success) {
                btn.textContent = "✅ Trade ajouté !";
                btn.disabled = true;
                setTimeout(() => { btn.textContent = "🎮 Simuler ce trade"; btn.disabled = false; }, 2500);
                renderSimulation();
            } else {
                alert(result.message);
            }
        });
    }

    function renderSimulation() {
        const container = document.getElementById("simulation-content");
        const statsEl = {
            total: document.getElementById("sim-total"),
            win: document.getElementById("sim-win"),
            loss: document.getElementById("sim-loss"),
            pending: document.getElementById("sim-pending"),
            rate: document.getElementById("sim-rate")
        };
        if (!container || !window.ARKAS_SIMULATOR) return;

        const trades = window.ARKAS_SIMULATOR.getTrades();
        const stats = window.ARKAS_SIMULATOR.getStats();

        if (statsEl.total) statsEl.total.textContent = stats.total;
        if (statsEl.win) statsEl.win.textContent = stats.wins;
        if (statsEl.loss) statsEl.loss.textContent = stats.losses;
        if (statsEl.pending) statsEl.pending.textContent = stats.pending;
        if (statsEl.rate) statsEl.rate.textContent = stats.winRate ? `${stats.winRate}%` : "—";

        if (!trades.length) {
            container.innerHTML = `<div class="empty-result"><div>🎮</div><h3>Aucune simulation</h3><p>Copie un signal et clique "Simuler".</p></div>`;
            return;
        }

        container.innerHTML = `
            <div class="simulation-list">
                ${trades.map(t => {
                    const cls = t.status === "WIN" ? "sim-win" : t.status === "LOSS" ? "sim-loss" : "sim-pending";
                    const lbl = t.status === "WIN" ? "🎉 GAGNÉ" : t.status === "LOSS" ? "😢 PERDU" : "⏳ EN COURS";
                    return `
                        <div class="simulation-item ${cls}">
                            <div class="sim-line">
                                <strong>${escapeHtml(t.asset)}</strong>
                                <span class="sim-signal ${t.direction === "BUY" ? "signal-buy" : "signal-sell"}">${escapeHtml(t.direction)}</span>
                                <span class="sim-status">${lbl}</span>
                            </div>
                            <div class="sim-line">
                                <span>Entry : ${t.entry}</span>
                                <span>SL : ${t.sl}</span>
                                <span>TP1 : ${t.tp1}</span>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    window.addEventListener("arkas:trade-result", () => renderSimulation());

    function saveToHistory(data) {
        try {
            const key = "arkas_signals_history";
            const history = JSON.parse(localStorage.getItem(key) || "[]");
            history.unshift({
                id: Date.now(),
                asset: data.asset || "—",
                signal: data.signal || "WAIT",
                direction: data.direction || "—",
                entry: data.entry, sl: data.sl,
                tp1: data.tp1, tp2: data.tp2, tp3: data.tp3,
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
        if (!container) return;

        let history = [];
        try { history = JSON.parse(localStorage.getItem("arkas_signals_history") || "[]"); } catch {}

        const statsEl = {
            total: document.getElementById("stat-total"),
            win: document.getElementById("stat-win"),
            loss: document.getElementById("stat-loss"),
            rate: document.getElementById("stat-rate")
        };

        if (!history.length) {
            container.innerHTML = `<div class="empty-result"><div>📭</div><h3>Aucun signal</h3><p>Les signaux copiés apparaîtront ici.</p></div>`;
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
                        <div class="history-line"><small>${new Date(h.date).toLocaleString("fr-FR")}</small></div>
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

    function setButtonsDisabled(d) {
        if (analyzeBtn) analyzeBtn.disabled = d;
        if (auditBtn) auditBtn.disabled = d;
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

    renderPreviews();
    updateAnalyzeButton();
    renderHistory();
    setTimeout(() => renderSimulation(), 500);

});
