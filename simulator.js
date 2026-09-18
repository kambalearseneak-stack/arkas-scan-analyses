/* =========================================================
   ARKAS SCAN AI V2 — SIMULATEUR DE TRADE
   VERSION : 3.0
   ---------------------------------------------------------
   États :
   - WAITING_ENTRY : ordre limite en attente
   - RUNNING       : trade activé / déclaré
   - TP1           : TP1 atteint
   - TP2           : TP2 atteint
   - TP3           : TP3 atteint
   - SL            : Stop Loss atteint
   - INVALID       : signal invalide
   - CANCELLED     : annulé
   - CLOSED        : terminé
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const DERIV_APP_ID = 1089;

    const DERIV_WS_URL =
        `wss://derivws.com/websockets/v3?app_id=${DERIV_APP_ID}&l=FR`;

    const STORAGE_KEY = "arkas_monitored_trades";

    /* =====================================================
       MAPPING DES ACTIFS
    ===================================================== */

    const SYMBOL_MAP = {

        /* GOLD */
        "XAUUSD": "frxXAUUSD",
        "GOLD": "frxXAUUSD",

        /* FOREX */
        "EURUSD": "frxEURUSD",
        "GBPUSD": "frxGBPUSD",
        "USDJPY": "frxUSDJPY",
        "USDCHF": "frxUSDCHF",
        "AUDUSD": "frxAUDUSD",
        "USDCAD": "frxUSDCAD",
        "NZDUSD": "frxNZDUSD",

        "EURJPY": "frxEURJPY",
        "GBPJPY": "frxGBPJPY",
        "EURGBP": "frxEURGBP",
        "EURCHF": "frxEURCHF",
        "AUDJPY": "frxAUDJPY",
        "CADJPY": "frxCADJPY",
        "CHFJPY": "frxCHFJPY",

        /* CRYPTO */
        "BTCUSD": "cryBTCUSD",
        "BTCUSDT": "cryBTCUSD",
        "BITCOIN": "cryBTCUSD",

        "ETHUSD": "cryETHUSD",
        "ETHUSDT": "cryETHUSD",
        "ETHEREUM": "cryETHUSD",

        "LTCUSD": "cryLTCUSD",
        "LTCUSDT": "cryLTCUSD",

        /* VOLATILITY */
        "R_10": "R_10",
        "R_25": "R_25",
        "R_50": "R_50",
        "R_75": "R_75",
        "R_100": "R_100",

        "VOLATILITY 10": "R_10",
        "VOLATILITY 10 INDEX": "R_10",

        "VOLATILITY 25": "R_25",
        "VOLATILITY 25 INDEX": "R_25",

        "VOLATILITY 50": "R_50",
        "VOLATILITY 50 INDEX": "R_50",

        "VOLATILITY 75": "R_75",
        "VOLATILITY 75 INDEX": "R_75",

        "VOLATILITY 100": "R_100",
        "VOLATILITY 100 INDEX": "R_100",

        /* BOOM / CRASH */
        "BOOM 500": "BOOM500",
        "BOOM 1000": "BOOM1000",

        "CRASH 500": "CRASH500",
        "CRASH 1000": "CRASH1000",

        /* STEP */
        "STEP INDEX": "stpRNG",
        "STEP": "stpRNG",

        /* JUMP */
        "JUMP 10": "JD10",
        "JUMP 25": "JD25",
        "JUMP 50": "JD50",
        "JUMP 75": "JD75",
        "JUMP 100": "JD100"
    };

    /* =====================================================
       VARIABLES
    ===================================================== */

    let socket = null;
    let isConnected = false;

    let activeSubscriptions = {};
    let monitoredTrades = {};

    let reconnectTimer = null;

    /* =====================================================
       INITIALISATION
    ===================================================== */

    function init() {

        console.log("🔵 ARKAS SIMULATOR V3 initialisé");

        loadTrades();

        connectDeriv();

        startPeriodicCheck();
    }

    /* =====================================================
       CONNEXION DERIV
    ===================================================== */

    function connectDeriv() {

        if (
            socket &&
            (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
            )
        ) {
            return;
        }

        try {

            socket = new WebSocket(DERIV_WS_URL);

        } catch (error) {

            console.error(
                "❌ Impossible de créer WebSocket :",
                error
            );

            scheduleReconnect();

            return;
        }

        socket.onopen = function () {

            isConnected = true;

            console.log(
                "🟢 ARKAS Simulator connecté à Deriv"
            );

            /*
             * Reprendre automatiquement les symboles
             * des trades encore actifs.
             */

            Object.values(monitoredTrades).forEach(trade => {

                if (
                    trade.derivSymbol &&
                    (
                        trade.status === "WAITING_ENTRY" ||
                        trade.status === "RUNNING"
                    )
                ) {

                    subscribeToSymbol(trade.derivSymbol);
                }
            });

            dispatchSimulatorEvent(
                "connection",
                {
                    connected: true
                }
            );
        };

        socket.onmessage = function (event) {

            let data;

            try {

                data = JSON.parse(event.data);

            } catch (error) {

                return;
            }

            if (data.msg_type === "tick" && data.tick) {

                handleTick(data.tick);
            }

            if (data.error) {

                console.warn(
                    "⚠️ Erreur Deriv :",
                    data.error
                );
            }
        };

        socket.onerror = function (error) {

            console.warn(
                "⚠️ Erreur WebSocket ARKAS",
                error
            );

            dispatchSimulatorEvent(
                "connection",
                {
                    connected: false
                }
            );
        };

        socket.onclose = function () {

            console.log(
                "🔌 ARKAS Simulator déconnecté"
            );

            isConnected = false;

            dispatchSimulatorEvent(
                "connection",
                {
                    connected: false
                }
            );

            /*
             * On autorise les nouvelles souscriptions
             * après reconnexion.
             */

            Object.keys(activeSubscriptions).forEach(symbol => {

                activeSubscriptions[symbol] = false;
            });

            scheduleReconnect();
        };
    }

    /* =====================================================
       RECONNEXION
    ===================================================== */

    function scheduleReconnect() {

        if (reconnectTimer) {
            return;
        }

        reconnectTimer = setTimeout(() => {

            reconnectTimer = null;

            connectDeriv();

        }, 5000);
    }

    /* =====================================================
       ABONNEMENT À UN SYMBOLE
    ===================================================== */

    function subscribeToSymbol(symbol) {

        if (
            !isConnected ||
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        if (activeSubscriptions[symbol]) {
            return;
        }

        try {

            socket.send(
                JSON.stringify({
                    ticks: symbol,
                    subscribe: 1
                })
            );

            activeSubscriptions[symbol] = true;

            console.log(
                "📡 Surveillance :",
                symbol
            );

        } catch (error) {

            console.error(
                "❌ Erreur abonnement :",
                error
            );
        }
    }

    /* =====================================================
       TICK EN TEMPS RÉEL
    ===================================================== */

    function handleTick(tick) {

        const symbol = tick.symbol;

        const currentPrice = Number(tick.quote);

        if (!Number.isFinite(currentPrice)) {
            return;
        }

        /*
         * Informer le dashboard du prix actuel.
         */

        dispatchSimulatorEvent(
            "price",
            {
                symbol: symbol,
                price: currentPrice,
                timestamp: Date.now()
            }
        );

        Object.values(monitoredTrades).forEach(trade => {

            if (
                trade.derivSymbol !== symbol
            ) {
                return;
            }

            /*
             * Sauvegarde du dernier prix.
             */

            trade.lastPrice = currentPrice;

            /*
             * ORDRE LIMITE
             */

            if (trade.status === "WAITING_ENTRY") {

                checkPendingEntry(
                    trade,
                    currentPrice
                );

                return;
            }

            /*
             * TRADE ACTIVÉ
             */

            if (trade.status === "RUNNING") {

                checkRunningTrade(
                    trade,
                    currentPrice
                );

                return;
            }
        });

        saveTrades();
    }

    /* =====================================================
       VÉRIFICATION ORDRE LIMITE
    ===================================================== */

    function checkPendingEntry(
        trade,
        currentPrice
    ) {

        let activated = false;

        if (trade.direction === "BUY") {

            /*
             * BUY LIMIT :
             * prix descend jusqu'à l'entrée
             */

            if (currentPrice <= trade.entry) {

                activated = true;
            }

        } else if (trade.direction === "SELL") {

            /*
             * SELL LIMIT :
             * prix monte jusqu'à l'entrée
             */

            if (currentPrice >= trade.entry) {

                activated = true;
            }
        }

        if (!activated) {

            /*
             * Vérification éventuelle
             * de l'invalidation.
             */

            if (isTradeInvalid(trade, currentPrice)) {

                invalidateTrade(
                    trade,
                    currentPrice
                );
            }

            return;
        }

        activateTrade(
            trade,
            currentPrice
        );
    }

    /* =====================================================
       ACTIVATION DU TRADE
    ===================================================== */

    function activateTrade(
        trade,
        fillPrice
    ) {

        trade.status = "RUNNING";

        trade.activatedAt =
            new Date().toISOString();

        trade.fillPrice =
            Number(fillPrice);

        trade.lastPrice =
            Number(fillPrice);

        trade.message =
            "ENTRÉE TOUCHÉE — TRADE ACTIVÉ";

        trade.event =
            "ENTRY_TRIGGERED";

        saveTrades();

        console.log(
            `🟢 ${trade.asset} → ENTRÉE TOUCHÉE @ ${fillPrice}`
        );

        notifyTradeEvent(
            trade,
            "ENTRY_TRIGGERED"
        );

        dispatchTradeUpdate(
            trade
        );

        /*
         * Vérifier immédiatement si le prix
         * est déjà au niveau SL / TP.
         */

        checkRunningTrade(
            trade,
            Number(fillPrice)
        );
    }

    /* =====================================================
       TRADE MARKET
    ===================================================== */

    function activateMarketTrade(
        trade,
        currentPrice
    ) {

        trade.status = "RUNNING";

        trade.activatedAt =
            new Date().toISOString();

        trade.fillPrice =
            Number(currentPrice);

        trade.lastPrice =
            Number(currentPrice);

        trade.message =
            "TRADE DÉCLARÉ — ENTRÉE AU PRIX DU MARCHÉ";

        trade.event =
            "ENTRY_TRIGGERED";

        saveTrades();

        console.log(
            `🟢 ${trade.asset} → TRADE DÉCLARÉ @ ${currentPrice}`
        );

        notifyTradeEvent(
            trade,
            "ENTRY_TRIGGERED"
        );

        dispatchTradeUpdate(
            trade
        );
    }

    /* =====================================================
       VÉRIFICATION SL / TP
    ===================================================== */

    function checkRunningTrade(
        trade,
        currentPrice
    ) {

        if (!trade.direction) {
            return;
        }

        const entry =
            Number(trade.fillPrice || trade.entry);

        const sl =
            Number(trade.sl);

        const tp1 =
            Number(trade.tp1);

        const tp2 =
            Number(trade.tp2);

        const tp3 =
            Number(trade.tp3);

        /*
         * =================================================
         * BUY
         * =================================================
         */

        if (trade.direction === "BUY") {

            /*
             * SL
             */

            if (
                Number.isFinite(sl) &&
                currentPrice <= sl
            ) {

                closeTrade(
                    trade,
                    "SL",
                    currentPrice,
                    "STOP LOSS ATTEINT"
                );

                return;
            }

            /*
             * TP3
             */

            if (
                Number.isFinite(tp3) &&
                currentPrice >= tp3
            ) {

                closeTrade(
                    trade,
                    "TP3",
                    currentPrice,
                    "TP3 ATTEINT"
                );

                return;
            }

            /*
             * TP2
             */

            if (
                Number.isFinite(tp2) &&
                currentPrice >= tp2
            ) {

                markTakeProfit(
                    trade,
                    "TP2",
                    currentPrice
                );

                return;
            }

            /*
             * TP1
             */

            if (
                Number.isFinite(tp1) &&
                currentPrice >= tp1
            ) {

                markTakeProfit(
                    trade,
                    "TP1",
                    currentPrice
                );

                return;
            }
        }

        /*
         * =================================================
         * SELL
         * =================================================
         */

        if (trade.direction === "SELL") {

            /*
             * SL
             */

            if (
                Number.isFinite(sl) &&
                currentPrice >= sl
            ) {

                closeTrade(
                    trade,
                    "SL",
                    currentPrice,
                    "STOP LOSS ATTEINT"
                );

                return;
            }

            /*
             * TP3
             */

            if (
                Number.isFinite(tp3) &&
                currentPrice <= tp3
            ) {

                closeTrade(
                    trade,
                    "TP3",
                    currentPrice,
                    "TP3 ATTEINT"
                );

                return;
            }

            /*
             * TP2
             */

            if (
                Number.isFinite(tp2) &&
                currentPrice <= tp2
            ) {

                markTakeProfit(
                    trade,
                    "TP2",
                    currentPrice
                );

                return;
            }

            /*
             * TP1
             */

            if (
                Number.isFinite(tp1) &&
                currentPrice <= tp1
            ) {

                markTakeProfit(
                    trade,
                    "TP1",
                    currentPrice
                );

                return;
            }
        }

        /*
         * Mise à jour du statut visuel
         */

        trade.lastPrice =
            Number(currentPrice);

        dispatchTradeUpdate(
            trade
        );
    }

    /* =====================================================
       TAKE PROFIT
    ===================================================== */

    function markTakeProfit(
        trade,
        tpName,
        price
    ) {

        /*
         * Éviter de déclarer deux fois
         * le même TP.
         */

        if (!Array.isArray(trade.hitTPs)) {
            trade.hitTPs = [];
        }

        if (
            trade.hitTPs.includes(tpName)
        ) {
            return;
        }

        trade.hitTPs.push(tpName);

        trade.lastTP =
            tpName;

        trade.lastTPPrice =
            Number(price);

        trade.lastTPAt =
            new Date().toISOString();

        /*
         * TP3 = trade terminé.
         */

        if (tpName === "TP3") {

            closeTrade(
                trade,
                "TP3",
                price,
                "TP3 ATTEINT — TRADE GAGNANT"
            );

            return;
        }

        /*
         * TP1 / TP2 restent en cours
         * jusqu'au TP3 ou SL.
         */

        trade.status = "RUNNING";

        trade.event =
            tpName + "_HIT";

        trade.message =
            `${tpName} ATTEINT @ ${price}`;

        saveTrades();

        console.log(
            `🎯 ${trade.asset} → ${tpName} @ ${price}`
        );

        notifyTradeEvent(
            trade,
            tpName + "_HIT"
        );

        dispatchTradeUpdate(
            trade
        );
    }

    /* =====================================================
       FERMETURE
    ===================================================== */

    function closeTrade(
        trade,
        result,
        closePrice,
        message
    ) {

        if (
            trade.status === "SL" ||
            trade.status === "TP3" ||
            trade.status === "CLOSED" ||
            trade.status === "INVALID" ||
            trade.status === "CANCELLED"
        ) {
            return;
        }

        trade.status =
            result === "SL"
                ? "SL"
                : result === "TP3"
                    ? "TP3"
                    : "CLOSED";

        trade.result =
            result;

        trade.closePrice =
            Number(closePrice);

        trade.closedAt =
            new Date().toISOString();

        trade.message =
            message;

        trade.event =
            result + "_HIT";

        saveTrades();

        console.log(
            `🏁 ${trade.asset} → ${message} @ ${closePrice}`
        );

        notifyTradeEvent(
            trade,
            result + "_HIT"
        );

        dispatchTradeUpdate(
            trade
        );
    }

    /* =====================================================
       INVALIDATION
    ===================================================== */

    function isTradeInvalid(
        trade,
        currentPrice
    ) {

        /*
         * Pour BUY LIMIT :
         * si le prix casse fortement le SL avant
         * que l'ordre soit considéré comme exécuté,
         * on peut déclarer le setup invalide.
         */

        if (trade.direction === "BUY") {

            if (
                Number.isFinite(Number(trade.sl)) &&
                currentPrice < Number(trade.sl)
            ) {
                return true;
            }
        }

        if (trade.direction === "SELL") {

            if (
                Number.isFinite(Number(trade.sl)) &&
                currentPrice > Number(trade.sl)
            ) {
                return true;
            }
        }

        return false;
    }

    function invalidateTrade(
        trade,
        currentPrice
    ) {

        trade.status =
            "INVALID";

        trade.result =
            "INVALID";

        trade.closePrice =
            Number(currentPrice);

        trade.closedAt =
            new Date().toISOString();

        trade.message =
            "SIGNAL INVALIDÉ AVANT L'ENTRÉE";

        trade.event =
            "SIGNAL_INVALID";

        saveTrades();

        console.log(
            `⚫ ${trade.asset} → SIGNAL INVALIDÉ @ ${currentPrice}`
        );

        notifyTradeEvent(
            trade,
            "SIGNAL_INVALID"
        );

        dispatchTradeUpdate(
            trade
        );
    }

    /* =====================================================
       NORMALISATION SIGNAL
    ===================================================== */

    function normalizeSignal(
        data
    ) {

        const action =
            String(
                data.action ||
                data.signal ||
                ""
            )
            .toUpperCase()
            .trim();

        if (
            action.includes("BUY LIMIT")
        ) {
            return "BUY LIMIT";
        }

        if (
            action.includes("SELL LIMIT")
        ) {
            return "SELL LIMIT";
        }

        if (
            action.includes("BUY NOW")
        ) {
            return "BUY NOW";
        }

        if (
            action.includes("SELL NOW")
        ) {
            return "SELL NOW";
        }

        if (action === "BUY") {
            return "BUY NOW";
        }

        if (action === "SELL") {
            return "SELL NOW";
        }

        return "WAIT";
    }

    /* =====================================================
       DIRECTION
    ===================================================== */

    function normalizeDirection(
        data,
        normalizedSignal
    ) {

        const direct =
            String(
                data.direction || ""
            )
            .toUpperCase()
            .trim();

        if (
            direct === "BUY" ||
            direct === "SELL"
        ) {
            return direct;
        }

        if (
            normalizedSignal.startsWith("BUY")
        ) {
            return "BUY";
        }

        if (
            normalizedSignal.startsWith("SELL")
        ) {
            return "SELL";
        }

        return "WAIT";
    }

    /* =====================================================
       RECHERCHE SYMBOLE
    ===================================================== */

    function findDerivSymbol(
        asset
    ) {

        const clean =
            String(asset || "")
            .toUpperCase()
            .trim();

        if (
            SYMBOL_MAP[clean]
        ) {
            return SYMBOL_MAP[clean];
        }

        const keys =
            Object.keys(SYMBOL_MAP);

        const match =
            keys.find(
                key =>
                    clean.includes(key) ||
                    key.includes(clean)
            );

        if (match) {
            return SYMBOL_MAP[match];
        }

        /*
         * Volatility dynamique
         */

        if (
            clean.includes("VOLATILITY")
        ) {

            const number =
                clean.match(/\d+/);

            if (
                number &&
                number[0]
            ) {

                const key =
                    `R_${number[0]}`;

                if (
                    SYMBOL_MAP[key]
                ) {
                    return SYMBOL_MAP[key];
                }
            }
        }

        return null;
    }

    /* =====================================================
       VALIDATION NIVEAUX
    ===================================================== */

    function validateLevels(
        direction,
        entry,
        sl,
        tp1,
        tp2,
        tp3
    ) {

        if (
            !Number.isFinite(entry) ||
            !Number.isFinite(sl) ||
            !Number.isFinite(tp1)
        ) {
            return {
                valid: false,
                message:
                    "Entry, SL et TP1 sont obligatoires."
            };
        }

        if (direction === "BUY") {

            if (sl >= entry) {

                return {
                    valid: false,
                    message:
                        "BUY invalide : SL doit être inférieur à l'Entry."
                };
            }

            if (tp1 <= entry) {

                return {
                    valid: false,
                    message:
                        "BUY invalide : TP1 doit être supérieur à l'Entry."
                };
            }

            if (
                Number.isFinite(tp2) &&
                tp2 <= tp1
            ) {

                return {
                    valid: false,
                    message:
                        "BUY invalide : TP2 doit être supérieur à TP1."
                };
            }

            if (
                Number.isFinite(tp3) &&
                tp2 &&
                tp3 <= tp2
            ) {

                return {
                    valid: false,
                    message:
                        "BUY invalide : TP3 doit être supérieur à TP2."
                };
            }
        }

        if (direction === "SELL") {

            if (sl <= entry) {

                return {
                    valid: false,
                    message:
                        "SELL invalide : SL doit être supérieur à l'Entry."
                };
            }

            if (tp1 >= entry) {

                return {
                    valid: false,
                    message:
                        "SELL invalide : TP1 doit être inférieur à l'Entry."
                };
            }

            if (
                Number.isFinite(tp2) &&
                tp2 >= tp1
            ) {

                return {
                    valid: false,
                    message:
                        "SELL invalide : TP2 doit être inférieur à TP1."
                };
            }

            if (
                Number.isFinite(tp3) &&
                tp2 &&
                tp3 >= tp2
            ) {

                return {
                    valid: false,
                    message:
                        "SELL invalide : TP3 doit être inférieur à TP2."
                };
            }
        }

        return {
            valid: true
        };
    }

    /* =====================================================
       AJOUT D'UN TRADE
    ===================================================== */

    function addTrade(
        data
    ) {

        data = data || {};

        const asset =
            String(
                data.asset || ""
            )
            .toUpperCase()
            .trim();

        if (!asset) {

            return {
                success: false,
                message:
                    "❌ Actif manquant."
            };
        }

        const derivSymbol =
            findDerivSymbol(asset);

        if (!derivSymbol) {

            return {
                success: false,

                message:
                    `⚠️ Simulation non disponible pour "${asset}".\n\n` +
                    `Actifs supportés : XAUUSD, EURUSD, GBPUSD, USDJPY, BTCUSD, ETHUSD, ` +
                    `R_10, R_25, R_50, R_75, R_100...`
            };
        }

        const normalizedSignal =
            normalizeSignal(data);

        if (
            normalizedSignal === "WAIT"
        ) {

            return {
                success: false,
                message:
                    "⏳ WAIT : aucun trade n'est créé."
            };
        }

        const direction =
            normalizeDirection(
                data,
                normalizedSignal
            );

        const entry =
            Number(data.entry);

        const sl =
            Number(data.sl);

        const tp1 =
            Number(data.tp1);

        const tp2 =
            Number(data.tp2);

        const tp3 =
            Number(data.tp3);

        const validation =
            validateLevels(
                direction,
                entry,
                sl,
                tp1,
                tp2,
                tp3
            );

        if (!validation.valid) {

            return {
                success: false,
                message:
                    "⚫ SIGNAL INVALIDE\n\n" +
                    validation.message
            };
        }

        const tradeId =
            "TRD_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 7);

        const isLimit =
            normalizedSignal === "BUY LIMIT" ||
            normalizedSignal === "SELL LIMIT";

        const trade = {

            id: tradeId,

            asset: asset,

            derivSymbol:
                derivSymbol,

            signal:
                data.signal || normalizedSignal,

            action:
                normalizedSignal,

            direction:
                direction,

            entry:
                entry,

            sl:
                sl,

            tp1:
                tp1,

            tp2:
                Number.isFinite(tp2)
                    ? tp2
                    : null,

            tp3:
                Number.isFinite(tp3)
                    ? tp3
                    : null,

            rr:
                data.rr || null,

            confidence_percent:
                data.confidence_percent || null,

            arkas_score:
                data.arkas_score || null,

            status:
                isLimit
                    ? "WAITING_ENTRY"
                    : "RUNNING",

            result:
                null,

            fillPrice:
                null,

            lastPrice:
                null,

            hitTPs:
                [],

            createdAt:
                new Date().toISOString(),

            activatedAt:
                null,

            closedAt:
                null,

            closePrice:
                null,

            message:
                isLimit
                    ? "ORDRE LIMITE EN ATTENTE"
                    : "TRADE DÉCLARÉ — EN COURS",

            event:
                isLimit
                    ? "WAITING_ENTRY"
                    : "ENTRY_TRIGGERED"
        };

        /*
         * Pour BUY/SELL NOW :
         * le prix réel sera pris au premier tick.
         */

        monitoredTrades[tradeId] =
            trade;

        saveTrades();

        subscribeToSymbol(
            derivSymbol
        );

        /*
         * Notification immédiate.
         */

        notifyTradeEvent(
            trade,
            trade.event
        );

        dispatchTradeUpdate(
            trade
        );

        /*
         * Si marché immédiat mais que le dashboard
         * nous donne déjà un prix actuel.
         */

        if (
            !isLimit &&
            Number.isFinite(
                Number(data.currentPrice)
            )
        ) {

            activateMarketTrade(
                trade,
                Number(data.currentPrice)
            );
        }

        console.log(
            `➕ ${asset} → ${normalizedSignal}`
        );

        return {

            success: true,

            tradeId:
                tradeId,

            status:
                trade.status,

            message:
                isLimit
                    ? `🟡 ${normalizedSignal}\nEn attente de l'entrée ${entry}`
                    : `🔵 ${normalizedSignal}\nTrade déclaré et suivi en temps réel.`
        };
    }

    /* =====================================================
       NOTIFICATION
    ===================================================== */

    function notifyTradeEvent(
        trade,
        event
    ) {

        let title =
            "ARKAS SCAN AI";

        let body =
            "";

        if (
            event === "WAITING_ENTRY"
        ) {

            title =
                "🟡 ORDRE EN ATTENTE";

            body =
                `${trade.asset} ${trade.direction}\n` +
                `Entrée : ${trade.entry}`;
        }

        else if (
            event === "ENTRY_TRIGGERED"
        ) {

            title =
                "🔵 TRADE DÉCLARÉ";

            body =
                `${trade.asset} ${trade.direction}\n` +
                `Entrée touchée : ${trade.fillPrice || trade.entry}`;
        }

        else if (
            event === "TP1_HIT"
        ) {

            title =
                "🟢 TP1 ATTEINT";

            body =
                `${trade.asset}\nTP1 : ${trade.tp1}`;
        }

        else if (
            event === "TP2_HIT"
        ) {

            title =
                "🟢 TP2 ATTEINT";

            body =
                `${trade.asset}\nTP2 : ${trade.tp2}`;
        }

        else if (
            event === "TP3_HIT"
        ) {

            title =
                "🏆 TP3 ATTEINT";

            body =
                `${trade.asset}\nTrade terminé en gain.`;
        }

        else if (
            event === "SL_HIT"
        ) {

            title =
                "🔴 STOP LOSS";

            body =
                `${trade.asset}\nSL atteint : ${trade.sl}`;
        }

        else if (
            event === "SIGNAL_INVALID"
        ) {

            title =
                "⚫ SIGNAL INVALIDE";

            body =
                `${trade.asset}\nLe niveau d'entrée n'a pas été atteint.`;
        }

        /*
         * Événement pour le dashboard
         */

        if (
            typeof window !== "undefined"
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "arkas:notification",
                    {
                        detail: {
                            title: title,
                            body: body,
                            trade: trade,
                            event: event
                        }
                    }
                )
            );
        }

        /*
         * Notification navigateur
         */

        if (
            "Notification" in window &&
            Notification.permission === "granted"
        ) {

            try {

                new Notification(
                    title,
                    {
                        body: body
                    }
                );

            } catch (error) {}
        }

        console.log(
            `🔔 ${title} — ${body}`
        );
    }

    /* =====================================================
       EVENT TRADE UPDATE
    ===================================================== */

    function dispatchTradeUpdate(
        trade
    ) {

        if (
            typeof window === "undefined"
        ) {
            return;
        }

        /*
         * Événement principal.
         *
         * Le dashboard peut écouter :
         *
         * window.addEventListener(
         *   "arkas:trade-update",
         *   function(e) {
         *      console.log(e.detail);
         *   }
         * );
         */

        window.dispatchEvent(
            new CustomEvent(
                "arkas:trade-update",
                {
                    detail: {
                        ...trade
                    }
                }
            )
        );

        /*
         * Compatibilité avec l'ancien dashboard.
         */

        window.dispatchEvent(
            new CustomEvent(
                "arkas:trade-result",
                {
                    detail: {
                        ...trade
                    }
                }
            )
        );
    }

    /* =====================================================
       EVENT SIMULATEUR
    ===================================================== */

    function dispatchSimulatorEvent(
        type,
        data
    ) {

        if (
            typeof window === "undefined"
        ) {
            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                `arkas:simulator-${type}`,
                {
                    detail: data
                }
            )
        );
    }

    /* =====================================================
       CHARGEMENT
    ===================================================== */

    function loadTrades() {

        try {

            const stored =
                localStorage.getItem(
                    STORAGE_KEY
                );

            monitoredTrades =
                stored
                    ? JSON.parse(stored)
                    : {};

            /*
             * Préparer les symboles à surveiller.
             */

            Object.values(
                monitoredTrades
            ).forEach(trade => {

                if (
                    trade.derivSymbol &&
                    (
                        trade.status ===
                            "WAITING_ENTRY" ||
                        trade.status ===
                            "RUNNING"
                    )
                ) {

                    activeSubscriptions[
                        trade.derivSymbol
                    ] = false;
                }
            });

            console.log(
                `📂 ${Object.keys(monitoredTrades).length} trade(s) chargé(s)`
            );

        } catch (error) {

            console.error(
                "❌ Erreur chargement trades",
                error
            );

            monitoredTrades = {};
        }
    }

    /* =====================================================
       SAUVEGARDE
    ===================================================== */

    function saveTrades() {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    monitoredTrades
                )
            );

        } catch (error) {

            console.warn(
                "⚠️ Impossible de sauvegarder",
                error
            );
        }
    }

    /* =====================================================
       SUPPRESSION
    ===================================================== */

    function deleteTrade(
        tradeId
    ) {

        if (
            monitoredTrades[tradeId]
        ) {

            delete monitoredTrades[
                tradeId
            ];

            saveTrades();

            return true;
        }

        return false;
    }

    /* =====================================================
       ANNULATION
    ===================================================== */

    function cancelTrade(
        tradeId
    ) {

        const trade =
            monitoredTrades[tradeId];

        if (!trade) {

            return false;
        }

        if (
            trade.status !==
                "WAITING_ENTRY"
        ) {

            return false;
        }

        trade.status =
            "CANCELLED";

        trade.result =
            "CANCELLED";

        trade.closedAt =
            new Date().toISOString();

        trade.message =
            "ORDRE LIMITE ANNULÉ";

        trade.event =
            "CANCELLED";

        saveTrades();

        notifyTradeEvent(
            trade,
            "CANCELLED"
        );

        dispatchTradeUpdate(
            trade
        );

        return true;
    }

    /* =====================================================
       STATS
    ===================================================== */

    function getStats() {

        const trades =
            Object.values(
                monitoredTrades
            );

        const total =
            trades.length;

        const wins =
            trades.filter(
                t =>
                    t.status === "TP3"
            ).length;

        const losses =
            trades.filter(
                t =>
                    t.status === "SL"
            ).length;

        const waitingEntry =
            trades.filter(
                t =>
                    t.status ===
                    "WAITING_ENTRY"
            ).length;

        const running =
            trades.filter(
                t =>
                    t.status ===
                    "RUNNING"
            ).length;

        const invalid =
            trades.filter(
                t =>
                    t.status ===
                    "INVALID"
            ).length;

        const cancelled =
            trades.filter(
                t =>
                    t.status ===
                    "CANCELLED"
            ).length;

        const completed =
            wins + losses;

        const winRate =
            completed > 0
                ? Math.round(
                    (
                        wins /
                        completed
                    ) * 100
                )
                : 0;

        return {

            total,

            wins,

            losses,

            waitingEntry,

            running,

            invalid,

            cancelled,

            completed,

            winRate
        };
    }

    /* =====================================================
       DEMANDE NOTIFICATION
    ===================================================== */

    function requestNotificationPermission() {

        if (
            "Notification" in window
        ) {

            Notification
                .requestPermission()
                .then(permission => {

                    console.log(
                        "Notification :",
                        permission
                    );
                });
        }
    }

    /* =====================================================
       RECHECK
    ===================================================== */

    function startPeriodicCheck() {

        setInterval(
            function () {

                Object.values(
                    monitoredTrades
                ).forEach(trade => {

                    if (
                        trade.derivSymbol &&
                        (
                            trade.status ===
                                "WAITING_ENTRY" ||
                            trade.status ===
                                "RUNNING"
                        )
                    ) {

                        subscribeToSymbol(
                            trade.derivSymbol
                        );
                    }
                });

            },
            30000
        );
    }

    /* =====================================================
       API PUBLIQUE
    ===================================================== */

    window.ARKAS_SIMULATOR = {

        addTrade:
            addTrade,

        getTrades:
            function () {

                return Object.values(
                    monitoredTrades
                ).sort(
                    (a, b) =>
                        new Date(b.createdAt) -
                        new Date(a.createdAt)
                );
            },

        getTrade:
            function (tradeId) {

                return monitoredTrades[
                    tradeId
                ] || null;
            },

        deleteTrade:
            deleteTrade,

        cancelTrade:
            cancelTrade,

        getStats:
            getStats,

        requestNotificationPermission:
            requestNotificationPermission,

        isConnected:
            function () {

                return isConnected;
            },

        reconnect:
            function () {

                if (socket) {

                    try {
                        socket.close();
                    } catch (error) {}
                }

                connectDeriv();
            }
    };

    /* =====================================================
       DÉMARRAGE
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();
    }

})();
