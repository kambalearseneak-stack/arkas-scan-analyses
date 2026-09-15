/* =========================================================
   ARKAS SCAN AI V2 — ASSISTANT DE SURVEILLANCE DERIV
   Version WebSocket direct (sans API REST)
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       ÉTAT GLOBAL
       ========================================================= */

    let derivSocket = null;
    let isConnected = false;
    let isMonitoring = false;
    let currentSubscription = null;
    let monitoredPosition = {};
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

    const telegramLink = document.getElementById("telegram-link");
    const telegramStatus = document.getElementById("telegram-status");
    const telegramTestBtn = document.getElementById("telegram-test-btn");
    const telegramDisableBtn = document.getElementById("telegram-disable-btn");

    if (positionPanel) positionPanel.classList.add("hidden");

    /* =========================================================
       CONNEXION DIRECTE VIA WEBSOCKET
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

            setConnectionStatus("loading", "🔄 Connexion à Deriv...");
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

            /* App ID = 1089 (public) pour le WebSocket */
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
                reject(new Error("Délai de connexion dépassé (15s)"));
            }, 15000);

            derivSocket.onopen = () => {
                clearTimeout(timeout);
                console.log("🔗 WebSocket ouvert");

                /* Envoyer la demande d'autorisation */
                derivSocket.send(JSON.stringify({
                    authorize: derivToken
                }));
            };

            derivSocket.onmessage = (event) => {

                let data;
                try { data = JSON.parse(event.data); } catch { return; }

                /* ---- Réponse authorize ---- */
                if (data.msg_type === "authorize") {

                    if (data.error) {
                        reject(new Error(data.error.message || "Token refusé"));
                        return;
                    }

                    if (!data.authorize) {
                        reject(new Error("Réponse authorize invalide"));
                        return;
                    }

                    const auth = data.authorize;
                    derivLoginId = auth.loginid;

                    /* Mise à jour UI */
                    if (loginIdEl) loginIdEl.textContent = auth.loginid;
                    if (balanceEl) {
                        balanceEl.textContent =
                            `${auth.balance} ${auth.currency}`;
                    }

                    isConnected = true;

                    setConnectionStatus("connected",
                        `✅ Connecté (${auth.loginid})`);

                    if (connectionPanel) connectionPanel.classList.add("hidden");
                    if (positionPanel) positionPanel.classList.remove("hidden");
                    connectBtn.disabled = false;

                    console.log("✅ Connecté :", auth.loginid);

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

            derivSocket.onerror = (err) => {
                clearTimeout(timeout);
                reject(new Error("Erreur WebSocket"));
            };

            derivSocket.onclose = () => {
                isConnected = false;
                isMonitoring = false;
                if (connectionStatus) {
                    setConnectionStatus("error", "⚠️ Déconnecté de Deriv");
                }
            };
        });
    }

    /* =========================================================
       MESSAGES DERIV
       ========================================================= */

    function handleDerivMessage(data) {

        if (data.msg_type === "balance" && data.balance) {
            if (balanceEl) {
                balanceEl.textContent =
                    `${data.balance.balance} ${data.balance.currency}`;
            }
            return;
        }

        if (data.msg_type === "tick" && data.tick) {
            if (data.subscription) {
                currentSubscription = data.subscription.id;
            }
            if (isMonitoring) {
                const price = parseFloat(data.tick.quote);
                if (!isNaN(price)) checkBreakEven(price);
            }
            return;
        }

        if (data.error) {
            console.error("Deriv error:", data.error);
            updateMonitorStatus("error",
                "❌ " + (data.error.message || "Erreur Deriv"));
        }
    }

    /* =========================================================
       SURVEILLANCE
       ========================================================= */

    function startMonitoring() {

        if (!isConnected || !derivSocket) {
            updateMonitorStatus("error", "❌ Connecte-toi d'abord à Deriv.");
            return;
        }

        const symbol = document.getElementById("pos-symbol")?.value.trim();
        const direction = document.getElementById("pos-direction")?.value || "BUY";
        const entry = parseFloat(document.getElementById("pos-entry")?.value);
        const sl = parseFloat(document.getElementById("pos-sl")?.value);
        const breakevenTrigger = parseFloat(
            document.getElementById("pos-breakeven-trigger")?.value || "1"
        );

        if (!symbol || isNaN(entry) || isNaN(sl)) {
            updateMonitorStatus("error", "❌ Symbole, Entry et SL obligatoires.");
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
            breakevenTrigger,
            breakEvenDone: false
        };

        if (currentSubscription) {
            derivSocket.send(JSON.stringify({ forget: currentSubscription }));
        }

        derivSocket.send(JSON.stringify({
            ticks: symbol,
            subscribe: 1
        }));

        isMonitoring = true;
        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");

        updateMonitorStatus("success",
            `👀 Surveillance de ${symbol} active.`);

        sendTelegramNotification(`▶️ Surveillance démarrée sur ${symbol}`);
    }

    function checkBreakEven(price) {

        const pos = monitoredPosition;
        if (!pos || pos.breakEvenDone) return;

        const risk = Math.abs(pos.entry - pos.sl);
        if (risk === 0) return;

        const targetMove = risk * pos.breakevenTrigger;

        if (pos.direction === "BUY" && price >= pos.entry + targetMove) {
            pos.breakEvenDone = true;
            const msg =
                `🔒 BREAK-EVEN atteint !\n` +
                `Symbole : ${pos.symbol}\n` +
                `Prix : ${price}\n` +
                `Déplace SL à : ${pos.entry}`;
            updateMonitorStatus("success", msg);
            sendTelegramNotification(msg);
        }

        if (pos.direction === "SELL" && price <= pos.entry - targetMove) {
            pos.breakEvenDone = true;
            const msg =
                `🔒 BREAK-EVEN atteint !\n` +
                `Symbole : ${pos.symbol}\n` +
                `Prix : ${price}\n` +
                `Déplace SL à : ${pos.entry}`;
            updateMonitorStatus("success", msg);
            sendTelegramNotification(msg);
        }
    }

    /* =========================================================
       ARRÊT
       ========================================================= */

    if (stopBtn) {
        stopBtn.addEventListener("click", () => {

            isMonitoring = false;
            monitoredPosition.breakEvenDone = false;

            if (derivSocket && currentSubscription) {
                derivSocket.send(JSON.stringify({ forget: currentSubscription }));
                currentSubscription = null;
            }

            if (startBtn) startBtn.classList.remove("hidden");
            if (stopBtn) stopBtn.classList.add("hidden");
            updateMonitorStatus("info", "⏹️ Surveillance arrêtée.");
            sendTelegramNotification("⏹️ Surveillance arrêtée.");
        });
    }

    if (startBtn) startBtn.addEventListener("click", startMonitoring);

    /* =========================================================
       NOTIFICATIONS TELEGRAM
       ========================================================= */

    async function sendTelegramNotification(message) {

        const userId = getCurrentUserId();
        if (!userId) return;

        try {
            await fetch("/api/notify-telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, message })
            });
        } catch (err) {
            console.warn("Telegram notify failed:", err);
        }
    }

    function getCurrentUserId() {
        return window.currentUser?.uid || null;
    }

    /* =========================================================
       GESTION TELEGRAM — UI
       ========================================================= */

    async function loadTelegramStatus() {

        const userId = getCurrentUserId();
        if (!userId || !telegramStatus) return;

        try {
            const res = await fetch("/api/telegram-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();
            updateTelegramUI(!!data.enabled);

        } catch (err) {
            console.warn("Status check failed:", err);
            updateTelegramUI(false);
        }
    }

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

    function setupTelegramLink() {

        const userId = getCurrentUserId();
        if (!userId || !telegramLink) return;

        const botUsername = "Arkasscanai_bot";
        telegramLink.href = `https://t.me/${botUsername}?start=${userId}`;
    }

    if (telegramTestBtn) {
        telegramTestBtn.addEventListener("click", async () => {

            const userId = getCurrentUserId();
            if (!userId) return;

            telegramTestBtn.disabled = true;
            telegramTestBtn.textContent = "Envoi…";

            try {
                await fetch("/api/notify-telegram", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        message: "🧪 <b>Test ARKAS</b>\n\nSi tu vois ce message, tes notifications fonctionnent !"
                    })
                });

                telegramTestBtn.textContent = "✅ Envoyé !";
            } catch (err) {
                telegramTestBtn.textContent = "❌ Échec";
            }

            setTimeout(() => {
                telegramTestBtn.disabled = false;
                telegramTestBtn.textContent = "🧪 Tester";
            }, 2500);
        });
    }

    if (telegramDisableBtn) {
        telegramDisableBtn.addEventListener("click", async () => {

            const userId = getCurrentUserId();
            if (!userId) return;

            if (!confirm("Désactiver les notifications Telegram ?")) return;

            try {
                await fetch("/api/telegram-disable", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId })
                });

                updateTelegramUI(false);
            } catch (err) {
                alert("Erreur lors de la désactivation.");
            }
        });
    }

    /* =========================================================
       UI HELPERS
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
       CLEANUP
       ========================================================= */

    window.addEventListener("beforeunload", () => {
        derivToken = null;
        if (derivSocket && derivSocket.readyState === WebSocket.OPEN) {
            derivSocket.close();
        }
    });

})();
