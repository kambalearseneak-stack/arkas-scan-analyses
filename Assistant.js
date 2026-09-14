/* =========================================================
   ARKAS SCAN AI V2 — ASSISTANT DE SURVEILLANCE DERIV
   Surveille les positions et alerte pour le break-even.
   Aucun ordre n'est placé automatiquement.
   ========================================================= */

(function () {

    "use strict";

    let derivSocket = null;
    let isConnected = false;
    let isMonitoring = false;
    let currentSubscription = null;
    let reconnectAttempts = 0;

    let monitoredPosition = {
        symbol: null,
        direction: null,
        entry: null,
        sl: null,
        tp: null,
        breakevenTrigger: 1,
        breakEvenDone: false
    };

    let derivToken = null;
    let derivAccountType = "demo";
    let derivLoginId = null;

    /* =========================================================
       RÉFÉRENCES DOM
       ========================================================= */

    const connectBtn = document.getElementById("connect-deriv-btn");
    const tokenInput = document.getElementById("deriv-token");
    const accountSelect = document.getElementById("deriv-account");
    const connectionStatus = document.getElementById("connection-status");

    const connectionPanel = document.getElementById("assistant-connection");
    const positionPanel = document.getElementById("assistant-position");

    const balanceEl = document.getElementById("deriv-balance");
    const loginIdEl = document.getElementById("deriv-loginid");

    const startBtn = document.getElementById("start-monitor-btn");
    const stopBtn = document.getElementById("stop-monitor-btn");
    const monitorStatus = document.getElementById("monitor-status");

    if (positionPanel) positionPanel.classList.add("hidden");

    /* =========================================================
       CONNEXION
       ========================================================= */

    if (connectBtn) {
        connectBtn.addEventListener("click", async () => {

            const token = tokenInput ? tokenInput.value.trim() : "";

            if (!token) {
                setConnectionStatus("error", "❌ Colle ton token Deriv.");
                return;
            }

            derivToken = token;
            derivAccountType = accountSelect ? accountSelect.value : "demo";

            setConnectionStatus("loading", "🔄 Connexion à Deriv…");
            connectBtn.disabled = true;

            try {
                await connectToDeriv();
            } catch (err) {
                console.error("Deriv error:", err);
                setConnectionStatus("error", "❌ Échec : " + err.message);
                connectBtn.disabled = false;
                isConnected = false;
            }
        });
    }

    function connectToDeriv() {

        return new Promise((resolve, reject) => {

            const appId = 1089;
            const url = `wss://ws.derivws.com/websockets/v3?app_id=${appId}&l=FR`;

            try {
                derivSocket = new WebSocket(url);
            } catch (err) {
                reject(new Error("Impossible d'ouvrir la connexion"));
                return;
            }

            const timeout = setTimeout(() => {
                if (derivSocket) derivSocket.close();
                reject(new Error("Délai de connexion dépassé"));
            }, 12000);

            derivSocket.onopen = () => {
                clearTimeout(timeout);
                console.log("🔗 WebSocket Deriv ouvert");
                derivSocket.send(JSON.stringify({ authorize: derivToken }));
            };

            derivSocket.onmessage = (event) => {

                let data;
                try { data = JSON.parse(event.data); } catch { return; }

                /* ---- authorize ---- */
                if (data.msg_type === "authorize") {

                    if (data.error) {
                        reject(new Error(data.error.message || "Token invalide"));
                        return;
                    }

                    if (!data.authorize) {
                        reject(new Error("Réponse authorize invalide"));
                        return;
                    }

                    const auth = data.authorize;
                    derivLoginId = auth.loginid;

                    const isVirtual = auth.loginid.startsWith("VRTC");

                    if (derivAccountType === "demo" && !isVirtual) {
                        reject(new Error("Ce token n'est pas un compte démo."));
                        return;
                    }

                    if (loginIdEl) loginIdEl.textContent = auth.loginid;
                    if (balanceEl) {
                        const cur = auth.currency || "USD";
                        balanceEl.textContent = `${auth.balance} ${cur}`;
                    }

                    isConnected = true;
                    reconnectAttempts = 0;

                    setConnectionStatus("connected", `✅ Connecté (${auth.loginid})`);
                    if (connectionPanel) connectionPanel.classList.add("hidden");
                    if (positionPanel) positionPanel.classList.remove("hidden");
                    connectBtn.disabled = false;

                    sendTelegramNotification(
                        `🤖 ARKAS Assistant\n` +
                        `✅ Connexion Deriv réussie\n` +
                        `Compte : ${auth.loginid}\n` +
                        `Balance : ${auth.balance} ${auth.currency}`
                    );

                    resolve();
                    return;
                }

                handleDerivMessage(data);
            };

            derivSocket.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Erreur de connexion WebSocket"));
            };

            derivSocket.onclose = () => {

                isConnected = false;
                isMonitoring = false;

                if (connectionStatus) {
                    setConnectionStatus("error", "⚠️ Déconnecté de Deriv");
                }

                if (derivToken && reconnectAttempts < 3) {
                    reconnectAttempts++;
                    setTimeout(() => {
                        console.log(`🔄 Reconnexion (${reconnectAttempts}/3)…`);
                        connectToDeriv().catch(() => {});
                    }, 3000 * reconnectAttempts);
                }
            };
        });
    }

    function handleDerivMessage(data) {

        if (data.msg_type === "tick" && data.tick) {

            if (data.subscription) {
                currentSubscription = data.subscription.id;
            }

            if (!isMonitoring) return;

            const currentPrice = parseFloat(data.tick.quote);
            if (!isNaN(currentPrice)) checkBreakEven(currentPrice);
            return;
        }

        if (data.error) {
            console.error("Deriv API error:", data.error);
            updateMonitorStatus("error", "❌ " + (data.error.message || "Erreur Deriv"));
        }
    }

    /* =========================================================
       DÉMARRAGE SURVEILLANCE
       ========================================================= */

    function startMonitoring() {

        if (!isConnected || !derivSocket) {
            updateMonitorStatus("error", "❌ Connecte-toi d'abord à Deriv.");
            return;
        }

        const symbolEl = document.getElementById("pos-symbol");
        const directionEl = document.getElementById("pos-direction");
        const entryEl = document.getElementById("pos-entry");
        const slEl = document.getElementById("pos-sl");
        const tpEl = document.getElementById("pos-tp");
        const beEl = document.getElementById("pos-breakeven-trigger");

        const symbol = symbolEl ? symbolEl.value.trim() : "";
        const direction = directionEl ? directionEl.value : "BUY";
        const entry = entryEl ? parseFloat(entryEl.value) : NaN;
        const sl = slEl ? parseFloat(slEl.value) : NaN;
        const tp = tpEl ? parseFloat(tpEl.value) : NaN;
        const breakevenTrigger = beEl ? parseFloat(beEl.value) : 1;

        if (!symbol) {
            updateMonitorStatus("error", "❌ Symbole manquant.");
            return;
        }

        if (isNaN(entry) || isNaN(sl)) {
            updateMonitorStatus("error", "❌ Entry et SL obligatoires.");
            return;
        }

        if (direction === "BUY" && sl >= entry) {
            updateMonitorStatus("error", "❌ BUY : SL doit être < Entry.");
            return;
        }

        if (direction === "SELL" && sl <= entry) {
            updateMonitorStatus("error", "❌ SELL : SL doit être > Entry.");
            return;
        }

        monitoredPosition = {
            symbol,
            direction,
            entry,
            sl,
            tp: isNaN(tp) ? null : tp,
            breakevenTrigger,
            breakEvenDone: false
        };

        try {
            if (currentSubscription) {
                derivSocket.send(JSON.stringify({ forget: currentSubscription }));
                currentSubscription = null;
            }

            derivSocket.send(JSON.stringify({
                ticks: symbol,
                subscribe: 1
            }));

        } catch (err) {
            console.error("Subscribe error:", err);
            updateMonitorStatus("error", "❌ Impossible de s'abonner aux ticks.");
            return;
        }

        isMonitoring = true;

        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");

        const riskDistance = Math.abs(entry - sl);
        const beTarget = direction === "BUY"
            ? (entry + riskDistance * breakevenTrigger).toFixed(5)
            : (entry - riskDistance * breakevenTrigger).toFixed(5);

        updateMonitorStatus(
            "success",
            `👀 Surveillance active sur ${symbol}\n` +
            `Break-even à ${beTarget} (+${breakevenTrigger}R)`
        );

        sendTelegramNotification(
            `🤖 ARKAS Assistant\n` +
            `▶️ Surveillance démarrée\n` +
            `Symbole : ${symbol}\n` +
            `Direction : ${direction}\n` +
            `Entry : ${entry}\n` +
            `SL : ${sl}\n` +
            (monitoredPosition.tp ? `TP : ${monitoredPosition.tp}\n` : "") +
            `Break-even après +${breakevenTrigger}R (prix ${beTarget})`
        );
    }

    /* =========================================================
       BREAK-EVEN
       ========================================================= */

    function checkBreakEven(currentPrice) {

        const pos = monitoredPosition;
        if (!pos || !pos.entry || !pos.sl) return;
        if (pos.breakEvenDone) return;

        const risk = Math.abs(pos.entry - pos.sl);
        if (risk === 0) return;

        const targetMove = risk * pos.breakevenTrigger;

        if (pos.direction === "BUY") {

            const targetPrice = pos.entry + targetMove;

            if (currentPrice >= targetPrice) {

                pos.breakEvenDone = true;

                updateMonitorStatus(
                    "success",
                    `🔒 BREAK-EVEN atteint à ${currentPrice}\n` +
                    `➡️ Déplace ton SL à ${pos.entry}`
                );

                sendTelegramNotification(
                    `🔒 ARKAS Assistant — BREAK-EVEN\n` +
                    `Symbole : ${pos.symbol}\n` +
                    `Direction : BUY\n` +
                    `Prix actuel : ${currentPrice}\n` +
                    `🎯 Cible atteinte : ${targetPrice}\n` +
                    `➡️ Déplace ton SL à : ${pos.entry}`
                );
            }
        }

        if (pos.direction === "SELL") {

            const targetPrice = pos.entry - targetMove;

            if (currentPrice <= targetPrice) {

                pos.breakEvenDone = true;

                updateMonitorStatus(
                    "success",
                    `🔒 BREAK-EVEN atteint à ${currentPrice}\n` +
                    `➡️ Déplace ton SL à ${pos.entry}`
                );

                sendTelegramNotification(
                    `🔒 ARKAS Assistant — BREAK-EVEN\n` +
                    `Symbole : ${pos.symbol}\n` +
                    `Direction : SELL\n` +
                    `Prix actuel : ${currentPrice}\n` +
                    `🎯 Cible atteinte : ${targetPrice}\n` +
                    `➡️ Déplace ton SL à : ${pos.entry}`
                );
            }
        }
    }

    /* =========================================================
       ARRÊT
       ========================================================= */

    if (stopBtn) {
        stopBtn.addEventListener("click", () => {

            isMonitoring = false;
            monitoredPosition.breakEvenDone = false;

            if (derivSocket && derivSocket.readyState === WebSocket.OPEN) {
                if (currentSubscription) {
                    derivSocket.send(JSON.stringify({ forget: currentSubscription }));
                    currentSubscription = null;
                }
            }

            if (startBtn) startBtn.classList.remove("hidden");
            if (stopBtn) stopBtn.classList.add("hidden");

            updateMonitorStatus("info", "⏹️ Surveillance arrêtée.");

            sendTelegramNotification(`⏹️ ARKAS Assistant — Surveillance arrêtée`);
        });
    }

    if (startBtn) startBtn.addEventListener("click", startMonitoring);

    /* =========================================================
       NOTIFICATIONS TELEGRAM
       ========================================================= */

    async function sendTelegramNotification(message) {
        try {
            await fetch("/api/notify/telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
        } catch (err) {
            console.warn("Telegram notify failed:", err);
        }
    }

    /* =========================================================
       UI
       ========================================================= */

    function setConnectionStatus(type, message) {

        if (!connectionStatus) return;

        connectionStatus.className = "connection-status";

        if (type === "connected") connectionStatus.classList.add("connected");
        else if (type === "error") connectionStatus.classList.add("error");
        else if (type === "loading") connectionStatus.classList.add("loading");
        else connectionStatus.classList.add("disconnected");

        const textEl = connectionStatus.querySelector("span:last-child");
        if (textEl) textEl.textContent = message;
    }

    function updateMonitorStatus(type, message) {

        if (!monitorStatus) return;
        monitorStatus.textContent = message;
        monitorStatus.className = "monitor-status status-" + type;
        monitorStatus.style.whiteSpace = "pre-line";
    }

    /* =========================================================
       CLEANUP
       ========================================================= */

    window.addEventListener("beforeunload", () => {
        derivToken = null;
        if (derivSocket && derivSocket.readyState === WebSocket.OPEN) {
            derivSocket.close();
        }
    });

})();
