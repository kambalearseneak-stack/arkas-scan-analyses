/* =========================================================
   ARKAS SCAN AI V2 — ASSISTANT DE SURVEILLANCE DERIV
   OTP + Break-even + Notifications Telegram
   Chemins API : /api/deriv-accounts, /api/deriv-otp,
                 /api/notify-telegram, /api/telegram-status,
                 /api/telegram-disable
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

    // Telegram
    const telegramLink = document.getElementById("telegram-link");
    const telegramStatus = document.getElementById("telegram-status");
    const telegramTestBtn = document.getElementById("telegram-test-btn");
    const telegramDisableBtn = document.getElementById("telegram-disable-btn");

    if (positionPanel) positionPanel.classList.add("hidden");

    /* =========================================================
       CONNEXION VIA OTP
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
                await connectViaOTP();
            } catch (err) {
                console.error("Deriv error:", err);
                setConnectionStatus("error", "❌ Échec : " + err.message);
                connectBtn.disabled = false;
                isConnected = false;
            }
        });
    }

    async function connectViaOTP() {

        /* 1. Récupérer la liste des comptes */
        const accountsResponse = await fetch("/api/deriv-accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ derivToken })
        });

        const accountsData = await accountsResponse.json();

        if (!accountsResponse.ok) {
            throw new Error(accountsData.error || "Impossible de lister les comptes.");
        }

        const accounts = accountsData.accounts || [];
        const isVirtual = derivAccountType === "demo";

        const targetAccount = accounts.find(acc =>
            isVirtual ? acc.account_type === "virtual" : acc.account_type === "real"
        ) || accounts[0];

        if (!targetAccount) {
            throw new Error("Aucun compte trouvé pour ce token.");
        }

        derivLoginId = targetAccount.account_id;

        /* 2. Obtenir l'URL OTP */
        const otpResponse = await fetch("/api/deriv-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accountId: derivLoginId,
                derivToken: derivToken
            })
        });

        const otpData = await otpResponse.json();

        if (!otpResponse.ok) {
            throw new Error(otpData.error || "Impossible d'obtenir l'URL OTP.");
        }

        /* 3. Se connecter au WebSocket */
        return new Promise((resolve, reject) => {

            derivSocket = new WebSocket(otpData.wsUrl);

            const timeout = setTimeout(() => {
                if (derivSocket) derivSocket.close();
                reject(new Error("Délai de connexion dépassé."));
            }, 15000);

            derivSocket.onopen = () => {
                clearTimeout(timeout);
                console.log("🔗 WebSocket Deriv connecté via OTP");

                isConnected = true;

                if (loginIdEl) loginIdEl.textContent = derivLoginId;
                if (balanceEl) balanceEl.textContent = "Chargement...";

                setConnectionStatus("connected", `✅ Connecté (${derivLoginId})`);
                if (connectionPanel) connectionPanel.classList.add("hidden");
                if (positionPanel) positionPanel.classList.remove("hidden");
                connectBtn.disabled = false;

                derivSocket.send(JSON.stringify({ balance: 1, subscribe: 1 }));

                sendTelegramNotification(
                    `🤖 ARKAS Assistant\n` +
                    `✅ Connexion Deriv réussie\n` +
                    `Compte : ${derivLoginId}`
                );

                resolve();
            };

            derivSocket.onmessage = (event) => {
                let data;
                try { data = JSON.parse(event.data); } catch { return; }
                handleDerivMessage(data);
            };

            derivSocket.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Erreur de connexion WebSocket."));
            };

            derivSocket.onclose = () => {
                isConnected = false;
                isMonitoring = false;
                setConnectionStatus("error", "⚠️ Déconnecté de Deriv.");
            };
        });
    }

    /* =========================================================
       MESSAGES DERIV
       ========================================================= */

    function handleDerivMessage(data) {

        if (data.msg_type === "balance" && data.balance) {
            if (balanceEl) {
                balanceEl.textContent = `${data.balance.balance} ${data.balance.currency}`;
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
            updateMonitorStatus("error", "❌ " + (data.error.message || "Erreur Deriv"));
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
        derivSocket.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));

        isMonitoring = true;
        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");

        updateMonitorStatus("success", `👀 Surveillance de ${symbol} active.`);
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

        // ⚠️ Remplace par le username de ton bot
        const botUsername = "Arkasscanai_bot";

        telegramLink.href = `https://t.me/${botUsername}?start=${userId}`;
    }

    /* ---- Bouton Test ---- */
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
                        message:
                            "🧪 <b>Test ARKAS</b>\n\n" +
                            "Si tu vois ce message, tes notifications fonctionnent !"
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

    /* ---- Bouton Désactiver ---- */
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
