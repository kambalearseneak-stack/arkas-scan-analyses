/* =========================================================
   ARKAS SCAN AI V2 — ASSISTANT DE SURVEILLANCE DERIV
   Version WebSocket directe

   Corrections :
   - Gestion propre WebSocket
   - Reconnexion automatique
   - Une seule connexion à la fois
   - Gestion robuste des subscriptions
   - Validation des positions
   - Break-Even en R
   - Telegram avec vérification HTTP
   - Nettoyage propre
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       CONFIGURATION
       ========================================================= */

    const DERIV_APP_ID = "34pbyNrTVwNMucC6ssXhH";
    const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}&l=FR`;

    const CONNECTION_TIMEOUT = 15000;
    const RECONNECT_DELAY = 3000;
    const MAX_RECONNECT_ATTEMPTS = 5;

    /* =========================================================
       ÉTAT GLOBAL
       ========================================================= */

    let derivSocket = null;
    let isConnected = false;
    let isMonitoring = false;
    let isConnecting = false;
    let manualDisconnect = false;

    let currentSubscription = null;

    let derivToken = null;
    let derivAccountType = "demo";
    let derivLoginId = null;
    let derivCurrency = null;

    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let connectionTimeout = null;

    let monitoredPosition = null;

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

    const telegramLink = document.getElementById("telegram-link");
    const telegramStatus = document.getElementById("telegram-status");
    const telegramTestBtn = document.getElementById("telegram-test-btn");
    const telegramDisableBtn = document.getElementById("telegram-disable-btn");

    /* =========================================================
       INITIAL UI
       ========================================================= */

    if (positionPanel) positionPanel.classList.add("hidden");
    if (stopBtn) stopBtn.classList.add("hidden");

    /* =========================================================
       CONNEXION DERIV
       ========================================================= */

    if (connectBtn) {
        connectBtn.addEventListener("click", async function () {

            if (isConnecting) return;

            if (isConnected) {
                disconnectFromDeriv(true);
                return;
            }

            const token = tokenInput ? tokenInput.value.trim() : "";

            if (!token) {
                setConnectionStatus("error", "❌ Colle ton token Deriv.");
                return;
            }

            derivToken = token;
            derivAccountType = accountSelect ? accountSelect.value : "demo";
            manualDisconnect = false;
            reconnectAttempts = 0;

            setConnectionStatus("loading", "🔄 Connexion à Deriv...");
            connectBtn.disabled = true;

            try {
                await connectToDeriv();
            } catch (error) {
                console.error("ARKAS Deriv connection error:", error);
                isConnected = false;
                isConnecting = false;
                setConnectionStatus("error", "❌ " + (error.message || "Connexion impossible"));
                connectBtn.disabled = false;
            }
        });
    }

    /* =========================================================
       OUVERTURE WEBSOCKET
       ========================================================= */

    function connectToDeriv() {

        return new Promise((resolve, reject) => {

            if (!derivToken) {
                reject(new Error("Token Deriv manquant."));
                return;
            }

            if (derivSocket && (
                derivSocket.readyState === WebSocket.OPEN ||
                derivSocket.readyState === WebSocket.CONNECTING
            )) {
                reject(new Error("Une connexion existe déjà."));
                return;
            }

            isConnecting = true;

            let settled = false;

            function finishResolve() {
                if (settled) return;
                settled = true;
                clearConnectionTimeout();
                isConnecting = false;
                resolve();
            }

            function finishReject(error) {
                if (settled) return;
                settled = true;
                clearConnectionTimeout();
                isConnecting = false;
                reject(error);
            }

            try {
                derivSocket = new WebSocket(DERIV_WS_URL);
            } catch (error) {
                finishReject(new Error("Impossible d'ouvrir WebSocket."));
                return;
            }

            connectionTimeout = setTimeout(() => {
                if (derivSocket && derivSocket.readyState !== WebSocket.OPEN) {
                    try { derivSocket.close(); } catch (_) {}
                }
                finishReject(new Error("Délai de connexion dépassé (15s)."));
            }, CONNECTION_TIMEOUT);

            derivSocket.onopen = function () {
                console.log("🔗 WebSocket Deriv ouvert.");
                setConnectionStatus("loading", "🔐 Authentification Deriv...");
                sendDeriv({ authorize: derivToken });
            };

            derivSocket.onmessage = function (event) {

                let data;
                try { data = JSON.parse(event.data); }
                catch (error) {
                    console.warn("Réponse Deriv invalide.", event.data);
                    return;
                }

                /* ---- AUTORISATION ---- */
                if (data.msg_type === "authorize") {

                    if (data.error) {
                        finishReject(new Error(data.error.message || "Token Deriv refusé."));
                        return;
                    }

                    if (!data.authorize) {
                        finishReject(new Error("Réponse authorize invalide."));
                        return;
                    }

                    const auth = data.authorize;

                    derivLoginId = auth.loginid || null;
                    derivCurrency = auth.currency || null;
                    isConnected = true;
                    reconnectAttempts = 0;

                    updateAccountUI(auth);
                    setConnectionStatus("connected", `✅ Connecté (${auth.loginid})`);
                    showConnectedPanel();
                    updateConnectButton();
                    finishResolve();

                    sendTelegramNotification(
                        `🤖 <b>ARKAS Assistant</b>\n\n` +
                        `✅ Connexion Deriv réussie\n` +
                        `Compte : ${auth.loginid}\n` +
                        `Balance : ${auth.balance} ${auth.currency}`
                    );

                    requestBalanceSubscription();
                    return;
                }

                handleDerivMessage(data);
            };

            derivSocket.onerror = function (error) {
                console.warn("⚠️ WebSocket Deriv error:", error);
                if (!settled) {
                    finishReject(new Error("Erreur WebSocket Deriv."));
                }
            };

            derivSocket.onclose = function () {

                console.warn("🔌 WebSocket Deriv fermé.");

                clearConnectionTimeout();

                const wasConnected = isConnected;

                isConnected = false;
                isConnecting = false;
                updateConnectButton();

                if (wasConnected) {
                    setConnectionStatus("error", "⚠️ Connexion Deriv perdue.");
                    if (!manualDisconnect) {
                        scheduleReconnect();
                    }
                }
            };
        });
    }

    /* =========================================================
       MESSAGES DERIV
       ========================================================= */

    function handleDerivMessage(data) {

        if (!data) return;

        if (data.msg_type === "balance" && data.balance) {
            updateBalance(data.balance.balance, data.balance.currency);
            return;
        }

        if (data.msg_type === "tick" && data.tick) {

            if (data.subscription && data.subscription.id) {
                currentSubscription = data.subscription.id;
            }

            const price = Number(data.tick.quote);

            if (Number.isFinite(price) && isMonitoring) {
                checkBreakEven(price);
                checkStopLoss(price);
            }
            return;
        }

        if (data.error) {
            const message = data.error.message || "Erreur Deriv.";
            console.error("Deriv API error:", data.error);
            updateMonitorStatus("error", "❌ " + message);
        }
    }

    /* =========================================================
       ENVOI WEBSOCKET
       ========================================================= */

    function sendDeriv(payload) {

        if (!derivSocket || derivSocket.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket non disponible.");
            return false;
        }

        try {
            derivSocket.send(JSON.stringify(payload));
            return true;
        } catch (error) {
            console.error("Erreur envoi Deriv:", error);
            return false;
        }
    }

    /* =========================================================
       BALANCE TEMPS RÉEL
       ========================================================= */

    function requestBalanceSubscription() {
        sendDeriv({ balance: 1, subscribe: 1 });
    }

    function updateBalance(balance, currency) {

        if (!balanceEl) return;

        const numericBalance = Number(balance);

        if (Number.isFinite(numericBalance)) {
            balanceEl.textContent = `${numericBalance.toFixed(2)} ${currency || ""}`;
        } else {
            balanceEl.textContent = `${balance} ${currency || ""}`;
        }
    }

    /* =========================================================
       UI COMPTE
       ========================================================= */

    function updateAccountUI(auth) {

        if (loginIdEl) loginIdEl.textContent = auth.loginid || "—";
        updateBalance(auth.balance, auth.currency);
    }

    function showConnectedPanel() {
        if (connectionPanel) connectionPanel.classList.add("hidden");
        if (positionPanel) positionPanel.classList.remove("hidden");
    }

    function updateConnectButton() {

        if (!connectBtn) return;

        if (isConnected) {
            connectBtn.disabled = false;
            connectBtn.textContent = "🔌 Déconnecter";
        } else {
            connectBtn.disabled = false;
            connectBtn.textContent = "🔗 Connecter Deriv";
        }
    }

    /* =========================================================
       SURVEILLANCE
       ========================================================= */

    function startMonitoring() {

        if (!isConnected || !derivSocket || derivSocket.readyState !== WebSocket.OPEN) {
            updateMonitorStatus("error", "❌ Connecte-toi d'abord à Deriv.");
            return;
        }

        const symbolEl = document.getElementById("pos-symbol");
        const directionEl = document.getElementById("pos-direction");
        const entryEl = document.getElementById("pos-entry");
        const slEl = document.getElementById("pos-sl");
        const triggerEl = document.getElementById("pos-breakeven-trigger");

        const symbol = symbolEl ? symbolEl.value.trim() : "";
        const direction = directionEl ? directionEl.value : "BUY";
        const entry = entryEl ? Number(entryEl.value) : NaN;
        const sl = slEl ? Number(slEl.value) : NaN;
        const breakevenTrigger = triggerEl ? Number(triggerEl.value || 1) : 1;

        if (!symbol) {
            updateMonitorStatus("error", "❌ Symbole obligatoire.");
            return;
        }

        if (!Number.isFinite(entry) || !Number.isFinite(sl)) {
            updateMonitorStatus("error", "❌ Entry et SL doivent être numériques.");
            return;
        }

        if (!Number.isFinite(breakevenTrigger) || breakevenTrigger <= 0) {
            updateMonitorStatus("error", "❌ Le trigger doit être supérieur à 0.");
            return;
        }

        if (direction === "BUY" && sl >= entry) {
            updateMonitorStatus("error", "❌ BUY : SL doit être inférieur à Entry.");
            return;
        }

        if (direction === "SELL" && sl <= entry) {
            updateMonitorStatus("error", "❌ SELL : SL doit être supérieur à Entry.");
            return;
        }

        forgetCurrentSubscription();

        monitoredPosition = {
            symbol: symbol,
            direction: direction,
            entry: entry,
            sl: sl,
            breakevenTrigger: breakevenTrigger,
            breakEvenDone: false,
            stopAlerted: false,
            startedAt: Date.now()
        };

        const sent = sendDeriv({ ticks: symbol, subscribe: 1 });

        if (!sent) {
            monitoredPosition = null;
            updateMonitorStatus("error", "❌ Impossible de démarrer les ticks.");
            return;
        }

        isMonitoring = true;

        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");

        updateMonitorStatus(
            "success",
            `👀 Surveillance active : ${symbol}\n` +
            `Direction : ${direction}\n` +
            `Entry : ${entry}\n` +
            `SL : ${sl}\n` +
            `Break-Even : ${breakevenTrigger}R`
        );

        sendTelegramNotification(
            `▶️ <b>Surveillance démarrée</b>\n\n` +
            `Symbole : ${symbol}\n` +
            `Direction : ${direction}\n` +
            `Entry : ${entry}\n` +
            `SL : ${sl}\n` +
            `BE : ${breakevenTrigger}R`
        );
    }

    /* =========================================================
       BREAK-EVEN
       ========================================================= */

    function checkBreakEven(price) {

        const pos = monitoredPosition;

        if (!isMonitoring || !pos || pos.breakEvenDone) return;

        const risk = Math.abs(pos.entry - pos.sl);
        if (!Number.isFinite(risk) || risk <= 0) return;

        const targetMove = risk * pos.breakevenTrigger;

        let reached = false;

        if (pos.direction === "BUY") {
            reached = price >= pos.entry + targetMove;
        } else if (pos.direction === "SELL") {
            reached = price <= pos.entry - targetMove;
        }

        if (!reached) return;

        pos.breakEvenDone = true;

        const message =
            `🔒 <b>BREAK-EVEN ATTEINT</b>\n\n` +
            `Symbole : ${pos.symbol}\n` +
            `Direction : ${pos.direction}\n` +
            `Prix actuel : ${price}\n` +
            `Entry : ${pos.entry}\n` +
            `Niveau BE : ${pos.entry}\n` +
            `Déclenchement : ${pos.breakevenTrigger}R\n\n` +
            `⚠️ Déplace le SL à ${pos.entry}.`;

        updateMonitorStatus("success", message.replace(/<[^>]*>/g, ""));
        sendTelegramNotification(message);
    }

    /* =========================================================
       SURVEILLANCE SL
       ========================================================= */

    function checkStopLoss(price) {

        const pos = monitoredPosition;

        if (!isMonitoring || !pos || pos.stopAlerted) return;

        let slReached = false;

        if (pos.direction === "BUY") {
            slReached = price <= pos.sl;
        } else if (pos.direction === "SELL") {
            slReached = price >= pos.sl;
        }

        if (!slReached) return;

        pos.stopAlerted = true;

        const message =
            `🚨 <b>SL ATTEINT</b>\n\n` +
            `Symbole : ${pos.symbol}\n` +
            `Direction : ${pos.direction}\n` +
            `Prix : ${price}\n` +
            `SL : ${pos.sl}`;

        updateMonitorStatus("error", message.replace(/<[^>]*>/g, ""));
        sendTelegramNotification(message);
    }

    /* =========================================================
       ARRÊT SURVEILLANCE
       ========================================================= */

    if (stopBtn) {
        stopBtn.addEventListener("click", function () {
            stopMonitoring();
        });
    }

    function stopMonitoring() {

        isMonitoring = false;

        if (monitoredPosition) {
            monitoredPosition.breakEvenDone = false;
            monitoredPosition.stopAlerted = false;
        }

        forgetCurrentSubscription();
        monitoredPosition = null;

        if (startBtn) startBtn.classList.remove("hidden");
        if (stopBtn) stopBtn.classList.add("hidden");

        updateMonitorStatus("info", "⏹️ Surveillance arrêtée.");
        sendTelegramNotification("⏹️ <b>Surveillance arrêtée.</b>");
    }

    if (startBtn) {
        startBtn.addEventListener("click", startMonitoring);
    }

    /* =========================================================
       OUBLIER SUBSCRIPTION
       ========================================================= */

    function forgetCurrentSubscription() {

        if (currentSubscription && derivSocket && derivSocket.readyState === WebSocket.OPEN) {
            sendDeriv({ forget: currentSubscription });
        }
        currentSubscription = null;
    }

    /* =========================================================
       DÉCONNEXION DERIV
       ========================================================= */

    function disconnectFromDeriv(notify = true) {

        manualDisconnect = true;
        clearReconnectTimer();
        clearConnectionTimeout();

        isMonitoring = false;
        forgetCurrentSubscription();

        if (derivSocket && derivSocket.readyState !== WebSocket.CLOSED) {
            try { derivSocket.close(); } catch (_) {}
        }

        derivSocket = null;
        isConnected = false;
        isConnecting = false;
        monitoredPosition = null;
        derivLoginId = null;
        derivCurrency = null;
        derivToken = null;

        if (startBtn) startBtn.classList.remove("hidden");
        if (stopBtn) stopBtn.classList.add("hidden");
        if (positionPanel) positionPanel.classList.add("hidden");
        if (connectionPanel) connectionPanel.classList.remove("hidden");

        setConnectionStatus("disconnected", "🔌 Déconnecté de Deriv.");
        updateConnectButton();

        if (notify) {
            sendTelegramNotification("🔌 <b>ARKAS</b>\nConnexion Deriv fermée.");
        }
    }

    /* =========================================================
       RECONNEXION AUTOMATIQUE
       ========================================================= */

    function scheduleReconnect() {

        if (manualDisconnect) return;
        if (reconnectTimer) return;

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus("error", "❌ Reconnexion abandonnée après plusieurs essais.");
            return;
        }

        reconnectAttempts++;

        setConnectionStatus("loading", `🔄 Reconnexion ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);

        reconnectTimer = setTimeout(async function () {

            reconnectTimer = null;

            if (manualDisconnect || !derivToken) return;

            try {
                await connectToDeriv();

                if (monitoredPosition && !isMonitoring) {
                    restartMonitoringAfterReconnect();
                }
            } catch (error) {
                console.warn("Reconnexion échouée:", error);
                scheduleReconnect();
            }
        }, RECONNECT_DELAY);
    }

    function restartMonitoringAfterReconnect() {

        const pos = monitoredPosition;
        if (!pos) return;

        const previousPosition = { ...pos };
        monitoredPosition = null;

        const success = sendDeriv({ ticks: previousPosition.symbol, subscribe: 1 });
        if (!success) return;

        monitoredPosition = previousPosition;
        isMonitoring = true;

        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");

        updateMonitorStatus("success", `🔄 Surveillance reprise : ${previousPosition.symbol}`);

        sendTelegramNotification(
            `🔄 <b>Surveillance reprise</b>\n\n` +
            `Symbole : ${previousPosition.symbol}`
        );
    }

    /* =========================================================
       TELEGRAM
       ========================================================= */

    async function sendTelegramNotification(message) {

        const userId = getCurrentUserId();
        if (!userId) return false;

        try {
            const response = await fetch("/api/notify-telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, message })
            });

            if (!response.ok) {
                const text = await response.text();
                console.warn("Telegram API HTTP error:", response.status, text);
                return false;
            }

            return true;
        } catch (error) {
            console.warn("Telegram notify failed:", error);
            return false;
        }
    }

    function getCurrentUserId() {
        return (window.currentUser && window.currentUser.uid) || null;
    }

    /* =========================================================
       TELEGRAM STATUS
       ========================================================= */

    async function loadTelegramStatus() {

        const userId = getCurrentUserId();
        if (!userId || !telegramStatus) return;

        try {
            const response = await fetch("/api/telegram-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            updateTelegramUI(data.enabled === true);

        } catch (error) {
            console.warn("Telegram status failed:", error);
            updateTelegramUI(false);
        }
    }

    /* =========================================================
       TELEGRAM UI
       ========================================================= */

    function updateTelegramUI(enabled) {

        if (!telegramStatus) return;

        if (enabled) {

            telegramStatus.className = "telegram-status enabled";
            telegramStatus.innerHTML = `
                <span class="dot"></span>
                <span>✅ Notifications activées</span>
            `;

            if (telegramTestBtn) telegramTestBtn.classList.remove("hidden");
            if (telegramDisableBtn) telegramDisableBtn.classList.remove("hidden");
            if (telegramLink) telegramLink.classList.add("hidden");

        } else {

            telegramStatus.className = "telegram-status disabled";
            telegramStatus.innerHTML = `
                <span class="dot"></span>
                <span>❌ Non activé</span>
            `;

            if (telegramTestBtn) telegramTestBtn.classList.add("hidden");
            if (telegramDisableBtn) telegramDisableBtn.classList.add("hidden");
            if (telegramLink) telegramLink.classList.remove("hidden");
        }
    }

    /* =========================================================
       LIEN TELEGRAM
       ========================================================= */

    function setupTelegramLink() {

        const userId = getCurrentUserId();
        if (!userId || !telegramLink) return;

        const botUsername = "Arkasscanai_bot";
        telegramLink.href = `https://t.me/${botUsername}?start=${encodeURIComponent(userId)}`;
    }

    /* =========================================================
       TEST TELEGRAM
       ========================================================= */

    if (telegramTestBtn) {
        telegramTestBtn.addEventListener("click", async function () {

            const userId = getCurrentUserId();
            if (!userId) {
                telegramTestBtn.textContent = "❌ Utilisateur non connecté";
                return;
            }

            telegramTestBtn.disabled = true;
            telegramTestBtn.textContent = "Envoi…";

            try {
                const response = await fetch("/api/notify-telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        message: "🧪 <b>Test ARKAS SCAN AI</b>\n\n✅ Si tu vois ce message, tes notifications Telegram fonctionnent."
                    })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                telegramTestBtn.textContent = "✅ Envoyé !";

            } catch (error) {
                console.error("Telegram test:", error);
                telegramTestBtn.textContent = "❌ Échec";
            }

            setTimeout(() => {
                telegramTestBtn.disabled = false;
                telegramTestBtn.textContent = "🧪 Tester";
            }, 2500);
        });
    }

    /* =========================================================
       DÉSACTIVER TELEGRAM
       ========================================================= */

    if (telegramDisableBtn) {
        telegramDisableBtn.addEventListener("click", async function () {

            const userId = getCurrentUserId();
            if (!userId) return;

            if (!confirm("Désactiver les notifications Telegram ?")) return;

            telegramDisableBtn.disabled = true;

            try {
                const response = await fetch("/api/telegram-disable", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                updateTelegramUI(false);

            } catch (error) {
                console.error("Telegram disable:", error);
                alert("Erreur lors de la désactivation.");
            } finally {
                telegramDisableBtn.disabled = false;
            }
        });
    }

    /* =========================================================
       UI STATUS CONNEXION
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
        else connectionStatus.textContent = message;
    }

    /* =========================================================
       UI MONITORING
       ========================================================= */

    function updateMonitorStatus(type, message) {

        if (!monitorStatus) return;

        monitorStatus.textContent = message;
        monitorStatus.className = "monitor-status status-" + type;
        monitorStatus.style.whiteSpace = "pre-line";
    }

    /* =========================================================
       UTILITAIRES TIMERS
       ========================================================= */

    function clearReconnectTimer() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function clearConnectionTimeout() {
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }
    }

    /* =========================================================
       INITIALISATION TELEGRAM
       ========================================================= */

    function initTelegram() {

        if (getCurrentUserId()) {
            loadTelegramStatus();
            setupTelegramLink();
        } else {
            setTimeout(() => {
                loadTelegramStatus();
                setupTelegramLink();
            }, 1500);
        }
    }

    initTelegram();

    /* =========================================================
       NETTOYAGE
       ========================================================= */

    window.addEventListener("beforeunload", function () {

        manualDisconnect = true;
        clearReconnectTimer();
        clearConnectionTimeout();
        isMonitoring = false;
        forgetCurrentSubscription();

        if (derivSocket && derivSocket.readyState === WebSocket.OPEN) {
            try { derivSocket.close(); } catch (_) {}
        }

        derivToken = null;
    });

})();
