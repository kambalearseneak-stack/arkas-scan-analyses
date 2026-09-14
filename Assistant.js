/* =========================================================
   ARKAS SCAN AI V2 — ASSISTANT DE SURVEILLANCE DERIV
   Version corrigée : Authentification OTP obligatoire
   ========================================================= */

(function () {
    "use strict";

    // État global
    let derivSocket = null;
    let isConnected = false;
    let isMonitoring = false;
    let currentSubscription = null;
    let monitoredPosition = {};
    let derivToken = null;
    let derivAccountType = "demo";
    let derivLoginId = null;

    // Raccourcis DOM
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
       CONNEXION VIA OTP (NOUVELLE MÉTHODE)
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

    /* =========================================================
       LOGIQUE DE CONNEXION VIA OTP
       ========================================================= */

    async function connectViaOTP() {

        // 1. Récupérer le login ID depuis le token (via un appel REST simple)
        //    Ou demander à l'utilisateur de le saisir si nécessaire.
        //    Ici, on suppose qu'on va l'obtenir après la connexion WebSocket
        //    ou via un appel REST préalable.

        // Pour simplifier, on va demander à Deriv de nous donner les comptes
        // Mais la méthode la plus directe : on appelle d'abord /accounts pour lister les comptes
        const accountsUrl = `https://api.derivws.com/trading/v1/options/accounts`;

        const accountsResponse = await fetch(accountsUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${derivToken}`
            }
        });

        if (!accountsResponse.ok) {
            const errData = await accountsResponse.json().catch(() => ({}));
            throw new Error(errData.error?.message || "Impossible de lister les comptes Deriv.");
        }

        const accountsData = await accountsResponse.json();
        const accounts = accountsData.data || [];

        // Filtrer selon le type de compte choisi
        const isVirtual = derivAccountType === "demo";
        const targetAccount = accounts.find(acc =>
            isVirtual ? acc.account_type === "virtual" : acc.account_type === "real"
        ) || accounts[0];

        if (!targetAccount) {
            throw new Error("Aucun compte trouvé pour ce token.");
        }

        derivLoginId = targetAccount.account_id;

        // 2. Appeler notre API serveur pour obtenir l'URL OTP
        const otpResponse = await fetch("/api/deriv/otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accountId: derivLoginId,
                derivToken: derivToken,
                isDemo: isVirtual
            })
        });

        const otpData = await otpResponse.json();

        if (!otpResponse.ok) {
            throw new Error(otpData.error || "Impossible d'obtenir l'URL OTP.");
        }

        // 3. Se connecter au WebSocket avec l'URL OTP
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

                // Mise à jour UI
                if (loginIdEl) loginIdEl.textContent = derivLoginId;
                if (balanceEl) balanceEl.textContent = "Chargement...";

                setConnectionStatus("connected", `✅ Connecté (${derivLoginId})`);
                if (connectionPanel) connectionPanel.classList.add("hidden");
                if (positionPanel) positionPanel.classList.remove("hidden");
                connectBtn.disabled = false;

                // Demander le solde
                derivSocket.send(JSON.stringify({ balance: 1, subscribe: 1 }));

                // Notification Telegram
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

                // Gérer les messages
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
       GESTION DES MESSAGES DERIV
       ========================================================= */

    function handleDerivMessage(data) {

        // Réponse balance
        if (data.msg_type === "balance" && data.balance) {
            if (balanceEl) {
                balanceEl.textContent = `${data.balance.balance} ${data.balance.currency}`;
            }
            return;
        }

        // Ticks
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

        // Erreurs
        if (data.error) {
            console.error("Deriv error:", data.error);
            updateMonitorStatus("error", "❌ " + (data.error.message || "Erreur Deriv"));
        }
    }

    /* =========================================================
       SURVEILLANCE / BREAK-EVEN
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
        const breakevenTrigger = parseFloat(document.getElementById("pos-breakeven-trigger")?.value || "1");

        if (!symbol || isNaN(entry) || isNaN(sl)) {
            updateMonitorStatus("error", "❌ Symbole, Entry et SL obligatoires.");
            return;
        }

        monitoredPosition = {
            symbol, direction, entry, sl, breakevenTrigger, breakEvenDone: false
        };

        // S'abonner aux ticks
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

        if (pos.direction === "BUY" && price >= pos.entry + (risk * pos.breakevenTrigger)) {
            pos.breakEvenDone = true;
            const msg = `🔒 BREAK-EVEN atteint !\nSymbole: ${pos.symbol}\nPrix: ${price}\nDéplace SL à: ${pos.entry}`;
            updateMonitorStatus("success", msg);
            sendTelegramNotification(msg);
        }

        if (pos.direction === "SELL" && price <= pos.entry - (risk * pos.breakevenTrigger)) {
            pos.breakEvenDone = true;
            const msg = `🔒 BREAK-EVEN atteint !\nSymbole: ${pos.symbol}\nPrix: ${price}\nDéplace SL à: ${pos.entry}`;
            updateMonitorStatus("success", msg);
            sendTelegramNotification(msg);
        }
    }

    /* =========================================================
       HELPERS
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

    async function sendTelegramNotification(message) {
        try {
            await fetch("/api/notify/telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
        } catch (e) { /* Ignorer */ }
    }

    if (stopBtn) stopBtn.addEventListener("click", () => {
        isMonitoring = false;
        if (derivSocket && currentSubscription) {
            derivSocket.send(JSON.stringify({ forget: currentSubscription }));
            currentSubscription = null;
        }
        if (startBtn) startBtn.classList.remove("hidden");
        if (stopBtn) stopBtn.classList.add("hidden");
        updateMonitorStatus("info", "⏹️ Surveillance arrêtée.");
        sendTelegramNotification("⏹️ Surveillance arrêtée.");
    });

    if (startBtn) startBtn.addEventListener("click", startMonitoring);

})();
