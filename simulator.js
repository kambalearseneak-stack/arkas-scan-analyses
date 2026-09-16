/* =========================================================
   ARKAS SCAN AI V2 — SIMULATEUR DE TRADE
   Suit les signaux copiés en temps réel via Deriv WebSocket public
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       CONFIGURATION DERIV (SANS TOKEN, PUBLIC)
       ========================================================= */

    const DERIV_APP_ID = 1089;
    const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}&l=FR`;

    /* =========================================================
       MAPPING DES SYMBOLES
       ========================================================= */

    const SYMBOL_MAP = {
        "XAUUSD": "frxXAUUSD",
        "GOLD": "frxXAUUSD",
        "EURUSD": "frxEURUSD",
        "GBPUSD": "frxGBPUSD",
        "USDJPY": "frxUSDJPY",
        "USDCHF": "frxUSDCHF",
        "AUDUSD": "frxAUDUSD",
        "USDCAD": "frxUSDCAD",
        "NZDUSD": "frxNZDUSD",
        "EURJPY": "frxEURJPY",
        "GBPJPY": "frxGBPJPY",
        "BTCUSD": "cryBTCUSD",
        "BTCUSDT": "cryBTCUSD",
        "ETHUSD": "cryETHUSD",
        "ETHUSDT": "cryETHUSD",
        "R_10": "R_10",
        "R_25": "R_25",
        "R_50": "R_50",
        "R_75": "R_75",
        "R_100": "R_100"
    };

    /* =========================================================
       ÉTAT
       ========================================================= */

    let socket = null;
    let isConnected = false;
    let activeSubscriptions = {}; // { symbol: subscriptionId }
    let monitoredTrades = {};     // { tradeId: trade }
    let reconnectTimer = null;

    /* =========================================================
       INITIALISATION
       ========================================================= */

    function init() {
        console.log("🔵 Simulator initialisé");
        loadTrades();
        connectDeriv();
        startPeriodicCheck();
    }

    /* =========================================================
       CONNEXION DERIV
       ========================================================= */

    function connectDeriv() {

        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            socket = new WebSocket(DERIV_WS_URL);
        } catch (e) {
            console.error("❌ WebSocket error:", e);
            scheduleReconnect();
            return;
        }

        socket.onopen = () => {
            console.log("🟢 Simulator connecté à Deriv");
            isConnected = true;

            // Re-souscrire aux symboles actifs
            Object.keys(activeSubscriptions).forEach(symbol => {
                subscribeToSymbol(symbol);
            });
        };

        socket.onmessage = (event) => {
            let data;
            try { data = JSON.parse(event.data); } catch { return; }

            if (data.msg_type === "tick" && data.tick) {
                handleTick(data.tick);
            }

            if (data.error) {
                console.warn("⚠️ Deriv error:", data.error);
            }
        };

        socket.onerror = () => {
            console.warn("⚠️ Simulator WebSocket error");
        };

        socket.onclose = () => {
            console.log("🔌 Simulator déconnecté");
            isConnected = false;
            scheduleReconnect();
        };
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectDeriv();
        }, 5000);
    }

    /* =========================================================
       SOUSCRIPTION À UN SYMBOLE
       ========================================================= */

    function subscribeToSymbol(symbol) {

        if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (activeSubscriptions[symbol]) {
            return; // Déjà abonné
        }

        try {
            socket.send(JSON.stringify({
                ticks: symbol,
                subscribe: 1
            }));
            activeSubscriptions[symbol] = true;
            console.log("📡 Abonné à", symbol);
        } catch (e) {
            console.error("Erreur souscription:", e);
        }
    }

    function unsubscribeFromSymbol(symbol) {

        if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            socket.send(JSON.stringify({ forget_all: "ticks" }));
            delete activeSubscriptions[symbol];
        } catch (e) {}
    }

    /* =========================================================
       TRAITEMENT D'UN TICK
       ========================================================= */

    function handleTick(tick) {

        const symbol = tick.symbol;
        const price = parseFloat(tick.quote);

        if (isNaN(price)) return;

        // Vérifier tous les trades pour ce symbole
        Object.values(monitoredTrades).forEach(trade => {
            if (trade.derivSymbol === symbol && trade.status === "PENDING") {
                checkTrade(trade, price);
            }
        });
    }

    /* =========================================================
       VÉRIFICATION D'UN TRADE
       ========================================================= */

    function checkTrade(trade, currentPrice) {

        const { direction, entry, sl, tp1 } = trade;

        let result = null;

        if (direction === "BUY") {
            if (currentPrice <= sl) {
                result = "LOSS";
            } else if (currentPrice >= tp1) {
                result = "WIN";
            }
        } else if (direction === "SELL") {
            if (currentPrice >= sl) {
                result = "LOSS";
            } else if (currentPrice <= tp1) {
                result = "WIN";
            }
        }

        if (result) {
            updateTradeResult(trade.id, result, currentPrice);
        }
    }

    function updateTradeResult(tradeId, result, closePrice) {

        const trade = monitoredTrades[tradeId];
        if (!trade) return;

        trade.status = result;
        trade.closePrice = closePrice;
        trade.closedAt = new Date().toISOString();

        console.log(`🎯 Trade ${tradeId} → ${result} @ ${closePrice}`);

        // Mise à jour localStorage
        saveTrades();

        // Notification UI
        notifyResult(trade);
    }

    /* =========================================================
       GESTION DES TRADES
       ========================================================= */

    function loadTrades() {

        try {
            const stored = localStorage.getItem("arkas_monitored_trades");
            monitoredTrades = stored ? JSON.parse(stored) : {};

            // Ré-abonner aux symboles nécessaires
            const symbolsToWatch = new Set();
            Object.values(monitoredTrades).forEach(t => {
                if (t.status === "PENDING" && t.derivSymbol) {
                    symbolsToWatch.add(t.derivSymbol);
                }
            });

            symbolsToWatch.forEach(sym => {
                if (isConnected) subscribeToSymbol(sym);
            });

            console.log(`📂 ${Object.keys(monitoredTrades).length} trade(s) chargé(s)`);

        } catch (e) {
            console.warn("Erreur chargement trades:", e);
            monitoredTrades = {};
        }
    }

    function saveTrades() {
        try {
            localStorage.setItem("arkas_monitored_trades", JSON.stringify(monitoredTrades));
        } catch (e) {}
    }

    /* =========================================================
       API PUBLIQUE (appelée depuis dashboard.js)
       ========================================================= */

    window.ARKAS_SIMULATOR = {

        /**
         * Ajoute un trade à surveiller
         */
        addTrade: function (data) {

            const asset = (data.asset || "").toUpperCase().trim();

            // Vérifier si le symbole est disponible
            const derivSymbol = SYMBOL_MAP[asset];

            if (!derivSymbol) {
                return {
                    success: false,
                    message: `⚠️ Simulation non disponible pour "${asset}".\n\nSymboles supportés : XAUUSD, EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, R_10, R_25, R_50, R_75, R_100...`
                };
            }

            // Validation des niveaux
            const { signal, direction, entry, sl, tp1 } = data;

            if (!entry || !sl) {
                return {
                    success: false,
                    message: "❌ Entry et SL obligatoires pour la simulation."
                };
            }

            if (!tp1) {
                return {
                    success: false,
                    message: "❌ Au moins TP1 est nécessaire pour la simulation."
                };
            }

            // Déterminer la direction
            let dir = (direction || "").toUpperCase();
            if (!dir || dir === "UNKNOWN") {
                if (signal && signal.includes("BUY")) dir = "BUY";
                else if (signal && signal.includes("SELL")) dir = "SELL";
                else {
                    return {
                        success: false,
                        message: "❌ Signal BUY ou SELL requis pour simuler."
                    };
                }
            }

            // Validation sens
            if (dir === "BUY" && sl >= entry) {
                return {
                    success: false,
                    message: "❌ BUY : SL doit être < Entry."
                };
            }

            if (dir === "SELL" && sl <= entry) {
                return {
                    success: false,
                    message: "❌ SELL : SL doit être > Entry."
                };
            }

            const tradeId = "TRD_" + Date.now();

            monitoredTrades[tradeId] = {
                id: tradeId,
                asset: asset,
                derivSymbol: derivSymbol,
                signal: signal,
                direction: dir,
                entry: Number(entry),
                sl: Number(sl),
                tp1: Number(tp1),
                tp2: data.tp2 ? Number(data.tp2) : null,
                tp3: data.tp3 ? Number(data.tp3) : null,
                rr: data.rr || null,
                status: "PENDING",
                createdAt: new Date().toISOString()
            };

            saveTrades();

            // S'abonner au symbole
            subscribeToSymbol(derivSymbol);

            console.log(`➕ Trade ajouté : ${tradeId} (${asset} → ${derivSymbol})`);

            return {
                success: true,
                tradeId: tradeId,
                message: `✅ Trade ajouté à la simulation.\nSuivi de ${asset} en temps réel.`
            };
        },

        /**
         * Retourne tous les trades
         */
        getTrades: function () {
            return Object.values(monitoredTrades).sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
        },

        /**
         * Supprime un trade
         */
        deleteTrade: function (tradeId) {
            if (monitoredTrades[tradeId]) {
                delete monitoredTrades[tradeId];
                saveTrades();
                return true;
            }
            return false;
        },

        /**
         * Retourne les statistiques
         */
        getStats: function () {
            const trades = Object.values(monitoredTrades);
            const total = trades.length;
            const wins = trades.filter(t => t.status === "WIN").length;
            const losses = trades.filter(t => t.status === "LOSS").length;
            const pending = trades.filter(t => t.status === "PENDING").length;
            const winRate = (wins + losses) > 0
                ? Math.round((wins / (wins + losses)) * 100)
                : 0;

            return { total, wins, losses, pending, winRate };
        }
    };

    /* =========================================================
       NOTIFICATION RÉSULTAT
       ========================================================= */

    function notifyResult(trade) {

        // Déclencher un événement custom
        window.dispatchEvent(new CustomEvent("arkas:trade-result", {
            detail: trade
        }));

        // Notification native si autorisée
        if ("Notification" in window && Notification.permission === "granted") {
            const emoji = trade.status === "WIN" ? "🎉" : "😢";
            new Notification(`${emoji} Trade ${trade.status}`, {
                body: `${trade.asset} ${trade.direction}\nEntry: ${trade.entry}\nClose: ${trade.closePrice}`
            });
        }
    }

    /* =========================================================
       VÉRIFICATION PÉRIODIQUE
       ========================================================= */

    function startPeriodicCheck() {
        setInterval(() => {
            // Re-vérifier les trades en cours
            const trades = Object.values(monitoredTrades);
            trades.forEach(t => {
                if (t.status === "PENDING" && t.derivSymbol) {
                    subscribeToSymbol(t.derivSymbol);
                }
            });
        }, 30000);
    }

    /* =========================================================
       DÉMARRAGE
       ========================================================= */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
