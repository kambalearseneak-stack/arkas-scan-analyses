/* =========================================================
   ARKAS SCAN AI V2 — SIMULATEUR DE TRADE
   Suit les signaux copiés en temps réel via Deriv WebSocket public
   ========================================================= */

(function () {
    "use strict";

    const DERIV_APP_ID = 1089;
    const DERIV_WS_URL = `wss://derivws.com/websockets/v3?app_id=${DERIV_APP_ID}&l=FR`;

    /* =========================================================
       MAPPING DES SYMBOLES (avec alias)
       ========================================================= */

    const SYMBOL_MAP = {
        // OR
        "XAUUSD": "frxXAUUSD",
        "GOLD": "frxXAUUSD",

        // FOREX
        "EURUSD": "frxEURUSD", "GBPUSD": "frxGBPUSD",
        "USDJPY": "frxUSDJPY", "USDCHF": "frxUSDCHF",
        "AUDUSD": "frxAUDUSD", "USDCAD": "frxUSDCAD",
        "NZDUSD": "frxNZDUSD", "EURJPY": "frxEURJPY",
        "GBPJPY": "frxGBPJPY", "EURGBP": "frxEURGBP",
        "EURCHF": "frxEURCHF", "AUDJPY": "frxAUDJPY",
        "CADJPY": "frxCADJPY", "CHFJPY": "frxCHFJPY",

        // CRYPTO
        "BTCUSD": "cryBTCUSD", "BTCUSDT": "cryBTCUSD", "BITCOIN": "cryBTCUSD",
        "ETHUSD": "cryETHUSD", "ETHUSDT": "cryETHUSD", "ETHEREUM": "cryETHUSD",
        "LTCUSD": "cryLTCUSD", "LTCUSDT": "cryLTCUSD",

        // VOLATILITY
        "R_10": "R_10", "R_25": "R_25", "R_50": "R_50", "R_75": "R_75", "R_100": "R_100",
        "VOLATILITY 10": "R_10", "VOLATILITY 10 INDEX": "R_10",
        "VOLATILITY 25": "R_25", "VOLATILITY 25 INDEX": "R_25",
        "VOLATILITY 50": "R_50", "VOLATILITY 50 INDEX": "R_50",
        "VOLATILITY 75": "R_75", "VOLATILITY 75 INDEX": "R_75",
        "VOLATILITY 100": "R_100", "VOLATILITY 100 INDEX": "R_100",

        // BOOM / CRASH
        "BOOM 500": "BOOM500", "BOOM 1000": "BOOM1000",
        "CRASH 500": "CRASH500", "CRASH 1000": "CRASH1000",

        // STEP / JUMP
        "STEP INDEX": "stpRNG", "STEP": "stpRNG",
        "JUMP 10": "JD10", "JUMP 25": "JD25",
        "JUMP 50": "JD50", "JUMP 75": "JD75", "JUMP 100": "JD100"
    };

    /* =========================================================
       ÉTAT
       ========================================================= */

    let socket = null;
    let isConnected = false;
    let activeSubscriptions = {};
    let monitoredTrades = {};
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
            Object.keys(activeSubscriptions).forEach(symbol => subscribeToSymbol(symbol));
        };

        socket.onmessage = (event) => {
            let data;
            try { data = JSON.parse(event.data); } catch { return; }
            if (data.msg_type === "tick" && data.tick) handleTick(data.tick);
            if (data.error) console.warn("⚠️ Deriv error:", data.error);
        };

        socket.onerror = () => console.warn("⚠️ Simulator WebSocket error");

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
       SOUSCRIPTION
       ========================================================= */

    function subscribeToSymbol(symbol) {
        if (!isConnected || !socket || socket.readyState !== WebSocket.OPEN) return;
        if (activeSubscriptions[symbol]) return;

        try {
            socket.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
            activeSubscriptions[symbol] = true;
            console.log("📡 Abonné à", symbol);
        } catch (e) { console.error(e); }
    }

    /* =========================================================
       TRAITEMENT TICK
       ========================================================= */

    function handleTick(tick) {
        const symbol = tick.symbol;
        const price = parseFloat(tick.quote);
        if (isNaN(price)) return;

        Object.values(monitoredTrades).forEach(trade => {
            if (trade.derivSymbol === symbol && trade.status === "PENDING") {
                checkTrade(trade, price);
            }
        });
    }

    function checkTrade(trade, currentPrice) {
        const { direction, entry, sl, tp1 } = trade;
        let result = null;

        if (direction === "BUY") {
            if (currentPrice <= sl) result = "LOSS";
            else if (currentPrice >= tp1) result = "WIN";
        } else if (direction === "SELL") {
            if (currentPrice >= sl) result = "LOSS";
            else if (currentPrice <= tp1) result = "WIN";
        }

        if (result) updateTradeResult(trade.id, result, currentPrice);
    }

    function updateTradeResult(tradeId, result, closePrice) {
        const trade = monitoredTrades[tradeId];
        if (!trade) return;

        trade.status = result;
        trade.closePrice = closePrice;
        trade.closedAt = new Date().toISOString();

        console.log(`🎯 Trade ${tradeId} → ${result} @ ${closePrice}`);
        saveTrades();
        notifyResult(trade);
    }

    /* =========================================================
       GESTION TRADES
       ========================================================= */

    function loadTrades() {
        try {
            const stored = localStorage.getItem("arkas_monitored_trades");
            monitoredTrades = stored ? JSON.parse(stored) : {};

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
            monitoredTrades = {};
        }
    }

    function saveTrades() {
        try {
            localStorage.setItem("arkas_monitored_trades", JSON.stringify(monitoredTrades));
        } catch (e) {}
    }

    /* =========================================================
       API PUBLIQUE
       ========================================================= */

    window.ARKAS_SIMULATOR = {

        addTrade: function (data) {

            const asset = (data.asset || "").toUpperCase().trim();

            // Recherche intelligente
            let derivSymbol = SYMBOL_MAP[asset];

            if (!derivSymbol) {
                const keys = Object.keys(SYMBOL_MAP);
                const match = keys.find(k => asset.includes(k) || k.includes(asset));
                if (match) derivSymbol = SYMBOL_MAP[match];
            }

            // Alias Volatility
            if (!derivSymbol && asset.includes("VOLATILITY")) {
                const num = asset.match(/\d+/);
                if (num && num[0]) {
                    const rKey = `R_${num[0]}`;
                    if (SYMBOL_MAP[rKey]) derivSymbol = SYMBOL_MAP[rKey];
                }
            }

            if (!derivSymbol) {
                return {
                    success: false,
                    message: `⚠️ Simulation non disponible pour "${asset}".\n\nSymboles supportés : XAUUSD, EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, R_10, R_25, R_50, R_75, R_100, VOLATILITY 75...`
                };
            }

            const { signal, direction, entry, sl, tp1 } = data;

            if (!entry || !sl || !tp1) {
                return {
                    success: false,
                    message: "❌ Entry, SL et TP1 sont obligatoires pour simuler."
                };
            }

            let dir = (direction || "").toUpperCase();
            if (!dir || dir === "UNKNOWN") {
                if (signal && signal.includes("BUY")) dir = "BUY";
                else if (signal && signal.includes("SELL")) dir = "SELL";
                else {
                    return { success: false, message: "❌ Signal BUY ou SELL requis." };
                }
            }

            if (dir === "BUY" && sl >= entry) {
                return { success: false, message: "❌ BUY : SL doit être < Entry." };
            }
            if (dir === "SELL" && sl <= entry) {
                return { success: false, message: "❌ SELL : SL doit être > Entry." };
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
            subscribeToSymbol(derivSymbol);

            console.log(`➕ Trade ajouté : ${tradeId} (${asset} → ${derivSymbol})`);

            return {
                success: true,
                tradeId: tradeId,
                message: `✅ Trade ajouté !\nSuivi de ${asset} en temps réel.`
            };
        },

        getTrades: function () {
            return Object.values(monitoredTrades).sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
        },

        deleteTrade: function (tradeId) {
            if (monitoredTrades[tradeId]) {
                delete monitoredTrades[tradeId];
                saveTrades();
                return true;
            }
            return false;
        },

        getStats: function () {
            const trades = Object.values(monitoredTrades);
            const total = trades.length;
            const wins = trades.filter(t => t.status === "WIN").length;
            const losses = trades.filter(t => t.status === "LOSS").length;
            const pending = trades.filter(t => t.status === "PENDING").length;
            const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
            return { total, wins, losses, pending, winRate };
        }
    };

    /* =========================================================
       NOTIFICATION RÉSULTAT
       ========================================================= */

    function notifyResult(trade) {
        window.dispatchEvent(new CustomEvent("arkas:trade-result", { detail: trade }));

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
