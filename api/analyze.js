// ============================================================
// ARKAS SCAN AI V2
// api/analyze.js
// Gemini 3.6 Flash Vision — Stratégie adaptative par marché
// SMC (Or) / SMC+PA (Forex) / PA simplifiée (Indices+Crypto)
// + Scénarios multiples (zones)
// ============================================================

export default async function handler(req, res) {

    /* ========================================================
       CORS
       ======================================================== */

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Méthode non autorisée. Utilisez POST."
        });
    }

    try {

        /* ====================================================
           API KEY
           ==================================================== */

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: "GEMINI_API_KEY est absente des variables d'environnement Vercel."
            });
        }

        /* ====================================================
           BODY
           ==================================================== */

        const body = req.body || {};

        const imageBase64 = body.imageBase64;
        const mimeType = body.mimeType || "image/jpeg";
        const mode = body.mode === "audit" ? "audit" : "scan";
        const asset = body.asset || "AUTO";
        const timeframe = body.timeframe || "AUTO";
        const userPrompt = body.prompt || "";

        /* ====================================================
           VALIDATION
           ==================================================== */

        if (!imageBase64) {
            return res.status(400).json({
                error: "Aucune image n'a été envoyée."
            });
        }

        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedMimeTypes.includes(mimeType)) {
            return res.status(400).json({
                error: "Format non supporté. Utilisez JPG, PNG ou WebP."
            });
        }

        if (imageBase64.length > 12000000) {
            return res.status(413).json({
                error: "Image trop volumineuse pour l'analyse."
            });
        }

        /* ====================================================
           CHOIX DU PROMPT
           ==================================================== */

        let finalPrompt;

        if (mode === "audit") {

            finalPrompt = buildAuditPrompt(asset, timeframe, userPrompt);

        } else {

            const marketType = classifyMarket(asset);

            console.log("🎯 Marché classifié :", marketType, "| Actif :", asset);

            switch (marketType) {

                case "GOLD":
                    finalPrompt = buildGoldSMCPrompt(asset, timeframe, userPrompt);
                    break;

                case "FOREX":
                    finalPrompt = buildForexHybridPrompt(asset, timeframe, userPrompt);
                    break;

                case "CRYPTO_MAJOR":
                case "INDICES":
                case "OTHER":
                default:
                    finalPrompt = buildSimplePriceActionPrompt(
                        asset,
                        timeframe,
                        marketType,
                        userPrompt
                    );
                    break;
            }
        }

        /* ====================================================
           GEMINI 3.6 FLASH
           ==================================================== */

        const model = "gemini-3.6-flash";

        const endpoint =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const geminiResponse = await fetch(endpoint, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },

            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: finalPrompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: imageBase64
                                }
                            }
                        ]
                    }
                ],

                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        /* ====================================================
           ERREUR GEMINI
           ==================================================== */

        if (!geminiResponse.ok) {

            const errorText = await geminiResponse.text();

            console.error("Gemini error:", errorText);

            return res.status(geminiResponse.status).json({
                error: "Gemini a refusé ou n'a pas pu traiter la demande.",
                details: safeGeminiError(errorText)
            });
        }

        /* ====================================================
           RÉPONSE
           ==================================================== */

        const geminiData = await geminiResponse.json();

        const rawText = geminiData
            ?.candidates?.[0]
            ?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (!rawText) {
            return res.status(502).json({
                error: "Gemini n'a retourné aucun résultat exploitable."
            });
        }

        /* ====================================================
           PARSING
           ==================================================== */

        const parsed = parseJsonSafely(rawText);

        if (!parsed) {
            console.error("Gemini JSON invalide:", rawText);
            return res.status(502).json({
                error: "Gemini a retourné un JSON invalide."
            });
        }

        /* ====================================================
           NORMALISATION + VALIDATION
           ==================================================== */

        const result = normalizeResult(parsed, asset, timeframe, mode);
        validateTradeLevels(result);

        return res.status(200).json(result);

    } catch (error) {

        console.error("ARKAS API ERROR:", error);

        return res.status(500).json({
            error: error.message || "Erreur interne du serveur."
        });
    }
}


/* ============================================================
   CLASSIFICATION DU MARCHÉ
   ============================================================ */

function classifyMarket(asset) {

    const a = String(asset || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (a.includes("XAU") || a.includes("GOLD")) {
        return "GOLD";
    }

    const forexPairs = [
        "EURUSD", "GBPUSD", "USDJPY", "USDCHF",
        "AUDUSD", "NZDUSD", "USDCAD",
        "EURJPY", "GBPJPY", "EURGBP", "EURCHF",
        "EURAUD", "EURCAD", "EURNZD",
        "GBPCHF", "GBPAUD", "GBPCAD", "GBPNZD",
        "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD",
        "NZDJPY", "NZDCHF", "NZDCAD",
        "CADJPY", "CADCHF", "CHFJPY",
        "USDMXN", "USDZAR", "USDTRY", "USDNOK",
        "USDSEK", "USDSGD", "USDHKD", "USDPLN",
        "EURTRY", "EURZAR", "EURMXN", "EURPLN",
        "GBPTRY", "GBPZAR", "ZARJPY", "TRYJPY"
    ];

    if (forexPairs.some(pair => a.includes(pair))) {
        return "FOREX";
    }

    if (/^[A-Z]{6}$/.test(a)) {
        return "FOREX";
    }

    if (a.includes("BTC") || a.includes("ETH")) {
        return "CRYPTO_MAJOR";
    }

    const indices = [
        "US30", "DJ30", "DOW", "WS30",
        "US100", "NAS100", "USTEC", "NDX",
        "US500", "SP500", "SPX",
        "US2000", "RUSSELL",
        "GER40", "DAX", "DE40",
        "UK100", "FTSE",
        "FRA40", "CAC",
        "EU50", "STOXX",
        "ESP35", "IBEX",
        "ITA40", "FTSE MIB",
        "NETH25", "AEX",
        "SWI20", "SMI",
        "JP225", "NIKKEI",
        "HK50", "HSI",
        "CHINA50", "CN50",
        "AUS200", "ASX",
        "IND50", "NIFTY"
    ];

    if (indices.some(idx => a.includes(idx))) {
        return "INDICES";
    }

    return "OTHER";
}


/* ============================================================
   PROMPT 1 — OR (SMC PUR)
   ============================================================ */

function buildGoldSMCPrompt(asset, timeframe, userPrompt) {
    return `
Tu es ARKAS SCAN AI, expert en Smart Money Concepts.

============================================================
MARCHÉ : ${asset} (OR — SMC PUR)
TIMEFRAME : ${timeframe}
============================================================

============================================================
RÈGLE FONDAMENTALE — NE JAMAIS RESTER PASSIF
============================================================

❌ NE RETOURNE PAS "WAIT" SANS AVOIR CHERCHÉ DE SCÉNARIOS.

✅ MÊME si l'entrée immédiate n'est pas propre, tu DOIS :
   1. Identifier toutes les zones SMC visibles (OB, FVG, liquidité)
   2. Proposer AU MOINS 2 scénarios BUY LIMIT / SELL LIMIT
   3. Donner les prix exacts de chaque zone
   4. Expliquer le déclencheur attendu dans chaque zone

WAIT n'est autorisé QUE si :
- Le graphique est illisible (flou, trop zoomé, surchargé)
- Aucune zone identifiable
- Marché en range total sans direction ni niveaux clairs

============================================================
ANALYSE SMC
============================================================

- Structure : tendance, BOS, CHoCH
- Liquidité : equal highs/lows, sweeps
- Order Blocks : haussiers et baissiers
- FVG : non comblés
- Premium / Discount

============================================================
SIGNAL PRINCIPAL
============================================================

- BUY NOW / SELL NOW  → entrée immédiate propre
- BUY LIMIT / SELL LIMIT → attente retour sur zone
- WAIT → UNIQUEMENT si vraiment illisible

============================================================
SCÉNARIOS MULTIPLES (OBLIGATOIRE)
============================================================

Fournis AU MOINS 2 scénarios, jusqu'à 4.

Chaque scénario contient :
- id          : "A", "B", "C", "D"
- type        : "BUY_LIMIT" | "SELL_LIMIT" | "BUY_NOW" | "SELL_NOW"
- zone_label  : "OB haussier H1" | "FVG non comblé" | "Equal lows"
- zone_price  : prix exact ou plage (ex: "2645.50 - 2648.00")
- entry, sl, tp1, tp2, tp3, rr
- trigger     : condition déclenchante
- probability : "haute" | "moyenne" | "basse"
- invalidation: condition qui annule le scénario
- priority    : 1 (meilleur) à 4

============================================================
NIVEAUX
============================================================

BUY  : SL < Entry < TP1 < TP2 < TP3
SELL : TP3 < TP2 < TP1 < Entry < SL
Si TP3 incertain : null

============================================================
SESSIONS (Or)
============================================================

- Londres 08-11h GMT : ✅✅
- NY 13-16h GMT : ✅✅
- Overlap : ✅✅✅
- Asie : -30%

============================================================
FORMAT JSON (aucun Markdown, aucun texte autour)
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "GOLD",
  "strategy_applied": "SMC",
  "signal": "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",
  "direction": "BUY|SELL|WAIT|UNKNOWN",
  "confidence_percent": 0,
  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "tp3": null,
  "rr": null,
  "arkas_score": 0,

  "structure": "",
  "liquidity": "",
  "order_block": "",
  "fvg": "",
  "price_action": "",

  "zones": [
    {
      "id": "A",
      "type": "BUY_LIMIT",
      "zone_label": "",
      "zone_price": "",
      "entry": null,
      "sl": null,
      "tp1": null,
      "tp2": null,
      "tp3": null,
      "rr": null,
      "trigger": "",
      "probability": "haute|moyenne|basse",
      "invalidation": "",
      "priority": 1
    }
  ],

  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "reason": "",
  "risk_management": {
    "risk_percent": "",
    "recommendation": ""
  },
  "economic_news": "Non disponible — vérifier le calendrier.",
  "risk_warning": ""
}

============================================================
PROMPT UTILISATEUR
============================================================

${userPrompt}
`;
}


/* ============================================================
   PROMPT 2 — FOREX (SMC + PRICE ACTION HYBRIDE)
   ============================================================ */

function buildForexHybridPrompt(asset, timeframe, userPrompt) {
    return `
Tu es ARKAS SCAN AI, expert en SMC ET Price Action.

============================================================
MARCHÉ : ${asset} (FOREX — STRATÉGIE HYBRIDE)
TIMEFRAME : ${timeframe}
============================================================

============================================================
RÈGLE FONDAMENTALE — NE JAMAIS RESTER PASSIF
============================================================

❌ NE RETOURNE PAS "WAIT" SANS AVOIR CHERCHÉ DE SCÉNARIOS.

✅ MÊME si SMC et PA ne sont pas alignés, tu DOIS proposer
   AU MOINS 2 scénarios BUY LIMIT / SELL LIMIT sur les zones clés.

WAIT n'est autorisé QUE si :
- Graphique illisible
- Aucune zone exploitable
- Range sans niveaux clairs

============================================================
DOUBLE ANALYSE
============================================================

ANALYSE 1 — SMC :
- BOS, CHoCH, Order Block, FVG, Liquidity Sweep

ANALYSE 2 — PRICE ACTION :
- Supports / Résistances, Trendlines, Cassure, Retest, Momentum

CONFLUENCE :
✅ BOTH alignés → BUY NOW / SELL NOW
🟡 PARTIEL → LIMIT (confiance -20%)
❌ DÉSACCORD → LIMIT sur les deux zones opposées

============================================================
SCÉNARIOS MULTIPLES (OBLIGATOIRE)
============================================================

Fournis AU MOINS 2 scénarios, jusqu'à 4.

Chaque scénario :
- id, type, zone_label, zone_price
- entry, sl, tp1, tp2, tp3, rr
- trigger, probability, invalidation, priority

============================================================
SESSIONS
============================================================

- Londres 08-11h GMT : ✅✅
- NY 13-16h GMT : ✅✅
- Overlap : ✅✅✅
- Asie : -40% (sauf JPY/AUD/NZD)
- Vendredi après 20h GMT : WAIT

============================================================
NIVEAUX
============================================================

BUY  : SL < Entry < TP1 < TP2 < TP3
SELL : TP3 < TP2 < TP1 < Entry < SL
RR minimum : 1.5

============================================================
FORMAT JSON (aucun Markdown, aucun texte autour)
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "FOREX",
  "strategy_applied": "SMC_PA_HYBRID",
  "signal": "",
  "direction": "",
  "confidence_percent": 0,
  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "tp3": null,
  "rr": null,
  "arkas_score": 0,

  "smc_analysis": {
    "structure": "",
    "bos": "",
    "choch": "",
    "order_block": "",
    "fvg": "",
    "liquidity": "",
    "bias": "BUY|SELL|NEUTRAL"
  },

  "pa_analysis": {
    "supports_resistances": "",
    "trendlines": "",
    "breakout": "",
    "retest": "",
    "momentum": "",
    "bias": "BUY|SELL|NEUTRAL"
  },

  "confluence_status": "ALIGNED|PARTIAL|DISAGREEMENT|NEUTRAL",

  "structure": "",
  "liquidity": "",
  "order_block": "",
  "fvg": "",
  "price_action": "",
  "supports_resistances": "",
  "trendlines": "",
  "breakout": "",
  "retest": "",

  "zones": [
    {
      "id": "A",
      "type": "BUY_LIMIT",
      "zone_label": "",
      "zone_price": "",
      "entry": null,
      "sl": null,
      "tp1": null,
      "tp2": null,
      "tp3": null,
      "rr": null,
      "trigger": "",
      "probability": "haute|moyenne|basse",
      "invalidation": "",
      "priority": 1
    }
  ],

  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "reason": "",
  "risk_management": {
    "risk_percent": "",
    "recommendation": ""
  },
  "economic_news": "Non disponible — vérifier le calendrier.",
  "risk_warning": ""
}

============================================================
PROMPT UTILISATEUR
============================================================

${userPrompt}
`;
}


/* ============================================================
   PROMPT 3 — INDICES + CRYPTO (PA SIMPLIFIÉE)
   ============================================================ */

function buildSimplePriceActionPrompt(asset, timeframe, marketType, userPrompt) {
    return `
Tu es ARKAS SCAN AI en mode PRICE ACTION SIMPLIFIÉE.

============================================================
MARCHÉ : ${asset} (${marketType})
TIMEFRAME : ${timeframe}
============================================================

============================================================
RÈGLE FONDAMENTALE — NE JAMAIS RESTER PASSIF
============================================================

❌ NE RETOURNE PAS "WAIT" SANS AVOIR CHERCHÉ DE SCÉNARIOS.

✅ MÊME sans configuration parfaite, tu DOIS proposer AU MOINS
   2 scénarios BUY LIMIT / SELL LIMIT sur :
   - Supports majeurs
   - Résistances majeures
   - Trendlines
   - Zones de cassure/retest

WAIT n'est autorisé QUE si :
- Graphique illisible
- Aucune zone identifiable
- Marché totalement plat

============================================================
OUTILS AUTORISÉS
============================================================

1. Supports / Résistances
2. Trendlines
3. Cassure (breakout)
4. Retest
5. Momentum
6. Structure simplifiée (HH/HL ou LH/LL)

============================================================
OUTILS INTERDITS
============================================================

❌ Order Block → "N/A (Price Action simplifiée)"
❌ FVG → idem
❌ CHoCH SMC → idem
❌ Liquidity sweep → idem

============================================================
PRUDENCE
============================================================

Indices :
- Ouverture US (15h30-16h00 GMT) : WAIT
- Timeframe minimum : M15

Crypto (BTC/ETH) :
- Volatilité 3-5x
- Week-end : -30%
- Timeframe minimum : H1

Altcoins / Autres :
- Timeframe minimum : H4
- Confiance max : 50%

============================================================
SCÉNARIOS MULTIPLES (OBLIGATOIRE)
============================================================

Fournis AU MOINS 2 scénarios, jusqu'à 4.
Exemples :
- "BUY LIMIT sur support majeur à 4250"
- "SELL LIMIT sur résistance à 4320"
- "BUY LIMIT sur retest trendline à 4270"

============================================================
NIVEAUX
============================================================

BUY  : SL < Entry < TP1 < TP2 < TP3
SELL : TP3 < TP2 < TP1 < Entry < SL
RR minimum : 1.5

============================================================
FORMAT JSON (aucun Markdown, aucun texte autour)
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "${marketType}",
  "strategy_applied": "PRICE_ACTION_SIMPLIFIED",
  "signal": "",
  "direction": "",
  "confidence_percent": 0,
  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "tp3": null,
  "rr": null,
  "arkas_score": 0,

  "structure": "",
  "supports_resistances": "",
  "trendlines": "",
  "breakout": "",
  "retest": "",
  "momentum": "",

  "liquidity": "N/A (Price Action simplifiée)",
  "order_block": "N/A (Price Action simplifiée)",
  "fvg": "N/A (Price Action simplifiée)",

  "zones": [
    {
      "id": "A",
      "type": "BUY_LIMIT",
      "zone_label": "",
      "zone_price": "",
      "entry": null,
      "sl": null,
      "tp1": null,
      "tp2": null,
      "tp3": null,
      "rr": null,
      "trigger": "",
      "probability": "haute|moyenne|basse",
      "invalidation": "",
      "priority": 1
    }
  ],

  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "reason": "",
  "risk_management": {
    "risk_percent": "",
    "recommendation": ""
  },
  "economic_news": "Non disponible — vérifier le calendrier.",
  "risk_warning": ""
}

============================================================
PROMPT UTILISATEUR
============================================================

${userPrompt}
`;
}


/* ============================================================
   PROMPT AUDIT
   ============================================================ */

function buildAuditPrompt(asset, timeframe, userPrompt) {
    return `
Tu es ARKAS SCAN AI en MODE AUDIT.

============================================================
MARCHÉ : ${asset}
TIMEFRAME : ${timeframe}
============================================================

La capture contient potentiellement une analyse utilisateur.
Ne considère PAS les annotations comme correctes par défaut.

============================================================
ÉTAPES
============================================================

1. Lire l'analyse utilisateur (flèches, lignes, texte, niveaux)
2. Faire une analyse indépendante
3. Comparer
4. Statuer : VALIDATED / CORRECT / PREMATURE / INVALID / UNCLEAR
5. Proposer une correction si nécessaire

============================================================
FORMAT JSON (aucun Markdown)
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "",
  "strategy_applied": "AUDIT",
  "signal": "",
  "direction": "",
  "confidence_percent": 0,
  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "tp3": null,
  "rr": null,
  "arkas_score": 0,
  "structure": "",
  "liquidity": "",
  "order_block": "",
  "fvg": "",
  "price_action": "",
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "reason": "",
  "risk_management": {},
  "economic_news": "Non disponible — vérifier le calendrier.",
  "risk_warning": "",
  "zones": [],
  "audit": {
    "status": "VALIDATED|CORRECT|PREMATURE|INVALID|UNCLEAR",
    "detected_user_analysis": {
      "direction": "BUY|SELL|WAIT|UNKNOWN",
      "entry": null,
      "sl": null,
      "tp1": null,
      "tp2": null,
      "tp3": null,
      "annotations": [],
      "claimed_setup": ""
    },
    "verdict": "",
    "strengths": [],
    "errors": [],
    "corrections": [],
    "corrected_trade": {
      "signal": "",
      "entry": null,
      "sl": null,
      "tp1": null,
      "tp2": null,
      "tp3": null,
      "rr": null
    }
  }
}

============================================================
PROMPT UTILISATEUR
============================================================

${userPrompt}
`;
}


/* ============================================================
   PARSING JSON
   ============================================================ */

function parseJsonSafely(text) {

    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {}

    let cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch {}

    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first !== -1 && last !== -1 && last > first) {
        try {
            return JSON.parse(cleaned.slice(first, last + 1));
        } catch {}
    }

    return null;
}


/* ============================================================
   NORMALISATION
   ============================================================ */

function normalizeResult(data, asset, timeframe, mode) {

    const result = {
        asset: data.asset || asset,
        timeframe: data.timeframe || timeframe,
        market_type: data.market_type || "UNKNOWN",
        strategy_applied: data.strategy_applied || "SMC",

        signal: data.signal || "WAIT",
        direction: data.direction || inferDirection(data.signal),
        confidence_percent: normalizeNumber(data.confidence_percent),

        entry: normalizeNumber(data.entry),
        sl: normalizeNumber(data.sl),
        tp1: normalizeNumber(data.tp1),
        tp2: normalizeNumber(data.tp2),
        tp3: normalizeNumber(data.tp3),
        rr: normalizeNumber(data.rr),
        arkas_score: normalizeNumber(data.arkas_score),

        structure: data.structure || "",
        liquidity: data.liquidity || "",
        order_block: data.order_block || "",
        fvg: data.fvg || "",
        price_action: data.price_action || "",

        supports_resistances: data.supports_resistances || "",
        trendlines: data.trendlines || "",
        breakout: data.breakout || "",
        retest: data.retest || "",
        momentum: data.momentum || "",

        smc_analysis: data.smc_analysis || null,
        pa_analysis: data.pa_analysis || null,
        confluence_status: data.confluence_status || null,

        zones: normalizeZones(data.zones),

        primary_scenario: data.primary_scenario || "",
        alternative_scenario: data.alternative_scenario || "",
        invalidation: data.invalidation || "",

        risk_management: data.risk_management || {},
        economic_news: data.economic_news ||
            "Non disponible — vérifier le calendrier économique.",
        reason: data.reason || "",
        risk_warning: data.risk_warning ||
            "L'analyse technique ne garantit pas un résultat de trading."
    };

    if (mode === "audit") {
        result.audit = normalizeAudit(data.audit);
    }

    result.confidence_percent = clamp(result.confidence_percent, 0, 100);
    result.arkas_score = clamp(result.arkas_score, 0, 100);

    return result;
}


/* ============================================================
   NORMALISATION DES ZONES
   ============================================================ */

function normalizeZones(zones) {

    if (!Array.isArray(zones)) return [];

    return zones
        .map((z, idx) => ({

            id: String(z.id || String.fromCharCode(65 + idx)),
            type: String(z.type || "BUY_LIMIT").toUpperCase(),

            zone_label: z.zone_label || "",
            zone_price: z.zone_price || "",

            entry: normalizeNumber(z.entry),
            sl: normalizeNumber(z.sl),
            tp1: normalizeNumber(z.tp1),
            tp2: normalizeNumber(z.tp2),
            tp3: normalizeNumber(z.tp3),
            rr: normalizeNumber(z.rr),

            trigger: z.trigger || "",
            probability: z.probability || "moyenne",
            invalidation: z.invalidation || "",
            priority: Number(z.priority) || (idx + 1)
        }))
        .filter(z => z.entry !== null || z.zone_price)
        .sort((a, b) => a.priority - b.priority);
}


/* ============================================================
   AUDIT
   ============================================================ */

function normalizeAudit(audit) {

    audit = audit || {};

    const detected = audit.detected_user_analysis || {};
    const corrected = audit.corrected_trade || {};

    return {
        status: normalizeAuditStatus(audit.status),

        detected_user_analysis: {
            direction: detected.direction || "UNKNOWN",
            entry: normalizeNumber(detected.entry),
            sl: normalizeNumber(detected.sl),
            tp1: normalizeNumber(detected.tp1),
            tp2: normalizeNumber(detected.tp2),
            tp3: normalizeNumber(detected.tp3),
            annotations: Array.isArray(detected.annotations)
                ? detected.annotations : [],
            claimed_setup: detected.claimed_setup || ""
        },

        verdict: audit.verdict || "",
        strengths: Array.isArray(audit.strengths) ? audit.strengths : [],
        errors: Array.isArray(audit.errors) ? audit.errors : [],
        corrections: Array.isArray(audit.corrections) ? audit.corrections : [],

        corrected_trade: {
            signal: corrected.signal || "WAIT",
            entry: normalizeNumber(corrected.entry),
            sl: normalizeNumber(corrected.sl),
            tp1: normalizeNumber(corrected.tp1),
            tp2: normalizeNumber(corrected.tp2),
            tp3: normalizeNumber(corrected.tp3),
            rr: normalizeNumber(corrected.rr)
        }
    };
}


/* ============================================================
   VALIDATION TRADE
   ============================================================ */

function validateTradeLevels(result) {

    const direction = String(result.direction || "").toUpperCase();

    const entry = result.entry;
    const sl = result.sl;
    const tp1 = result.tp1;
    const tp2 = result.tp2;
    const tp3 = result.tp3;

    if (direction === "WAIT" || result.signal === "WAIT") {
        result.trade_valid = true;
        return;
    }

    if (!isFiniteNumber(entry) || !isFiniteNumber(sl) ||
        !isFiniteNumber(tp1) || !isFiniteNumber(tp2)) {
        result.trade_valid = false;
        return;
    }

    if (direction === "BUY") {
        const valid = sl < entry && entry < tp1 && tp1 < tp2 &&
            (tp3 === null || tp3 > tp2);
        if (!valid) {
            result.trade_valid = false;
            result.risk_warning = "Niveaux BUY invalides.";
        }
        return;
    }

    if (direction === "SELL") {
        const valid = tp2 < tp1 && tp1 < entry && sl > entry &&
            (tp3 === null || tp3 < tp2);
        if (!valid) {
            result.trade_valid = false;
            result.risk_warning = "Niveaux SELL invalides.";
        }
        return;
    }
}


/* ============================================================
   UTILITAIRES
   ============================================================ */

function inferDirection(signal) {
    const value = String(signal || "").toUpperCase();
    if (value.includes("BUY")) return "BUY";
    if (value.includes("SELL")) return "SELL";
    return "WAIT";
}

function normalizeAuditStatus(status) {
    const allowed = ["VALIDATED", "CORRECT", "PREMATURE", "INVALID", "UNCLEAR"];
    const value = String(status || "UNCLEAR").toUpperCase();
    return allowed.includes(value) ? value : "UNCLEAR";
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;

    const normalized = Number(
        String(value).replace(",", ".").replace(/[^0-9eE.+-]/g, "")
    );

    return Number.isFinite(normalized) ? normalized : null;
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function clamp(value, min, max) {
    if (!isFiniteNumber(value)) return 0;
    return Math.min(Math.max(value, min), max);
}

function safeGeminiError(text) {
    try {
        const parsed = JSON.parse(text);
        return parsed?.error?.message || "Erreur Gemini.";
    } catch {
        return "Erreur Gemini.";
    }
}
