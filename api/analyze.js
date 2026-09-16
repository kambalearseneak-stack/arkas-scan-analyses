// ============================================================
// ARKAS SCAN AI V2
// api/analyze.js
// Gemini 3.6 Flash Vision — Multi-timeframe + Stratégie adaptative
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

        const mode = body.mode || "scan";
        const images = body.images || null;

        const imageBase64 = body.imageBase64;
        const mimeType = body.mimeType || "image/jpeg";
        const asset = body.asset || "AUTO";
        const timeframe = body.timeframe || "AUTO";
        const userPrompt = body.prompt || "";

        /* ====================================================
           VALIDATION
           ==================================================== */

        const isMultiTF = (mode === "multi-tf" && Array.isArray(images) && images.length > 0);

        if (!isMultiTF && !imageBase64) {
            return res.status(400).json({
                error: "Aucune image n'a été envoyée."
            });
        }

        if (isMultiTF) {
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (!img || !img.imageBase64) {
                    return res.status(400).json({
                        error: `Image ${i + 1} manquante.`
                    });
                }
                if (!img.timeframe) {
                    return res.status(400).json({
                        error: `Timeframe manquant pour l'image ${i + 1}.`
                    });
                }
            }
        }

        /* ====================================================
           CHOIX DU PROMPT
           ==================================================== */

        let finalPrompt;

        if (mode === "audit") {

            finalPrompt = buildAuditPrompt(asset, timeframe, userPrompt);

        } else if (isMultiTF) {

            finalPrompt = buildMultiTFPrompt(images);

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
                default:
                    finalPrompt = buildSimplePriceActionPrompt(asset, timeframe, marketType, userPrompt);
                    break;
            }
        }

        /* ====================================================
           CONSTRUCTION DES PARTS GEMINI
           ==================================================== */

        const imageParts = isMultiTF
            ? images.map(img => ({
                inline_data: {
                    mime_type: img.mimeType || "image/jpeg",
                    data: img.imageBase64
                }
            }))
            : [{
                inline_data: {
                    mime_type: mimeType,
                    data: imageBase64
                }
            }];

        /* ====================================================
           GEMINI
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
                            ...imageParts
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
                error: "Gemini a refusé la demande.",
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
                error: "Gemini n'a retourné aucun résultat."
            });
        }

        /* ====================================================
           PARSING
           ==================================================== */

        const parsed = parseJsonSafely(rawText);

        if (!parsed) {
            console.error("JSON invalide:", rawText);
            return res.status(502).json({
                error: "Gemini a retourné un JSON invalide."
            });
        }

        /* ====================================================
           NORMALISATION
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

    if (a.includes("XAU") || a.includes("GOLD")) return "GOLD";

    const forexPairs = [
        "EURUSD", "GBPUSD", "USDJPY", "USDCHF",
        "AUDUSD", "NZDUSD", "USDCAD",
        "EURJPY", "GBPJPY", "EURGBP", "EURCHF"
    ];

    if (forexPairs.some(p => a.includes(p))) return "FOREX";
    if (/^[A-Z]{6}$/.test(a)) return "FOREX";
    if (a.includes("BTC") || a.includes("ETH")) return "CRYPTO_MAJOR";

    const indices = [
        "US30", "NAS100", "US500", "SP500",
        "GER40", "DAX", "UK100", "JP225"
    ];

    if (indices.some(i => a.includes(i))) return "INDICES";

    return "OTHER";
}


/* ============================================================
   PROMPT MULTI-TIMEFRAME
   ============================================================ */

function buildMultiTFPrompt(images) {

    const count = images.length;

    return `
Tu es ARKAS SCAN AI, expert en analyse multi-timeframe (SMC + ICT + Price Action).

============================================================
ANALYSE MULTI-TIMEFRAME AVEC DÉTECTION AUTO
============================================================

Tu reçois ${count} capture(s) SANS indication de timeframe.

============================================================
ÉTAPE 1 — DÉTECTION DU TIMEFRAME
============================================================

Pour CHAQUE image, tu dois DÉTECTER le timeframe en analysant :
- Les bougies (nombre, taille)
- L'échelle de temps (M1, M5, M15, M30, H1, H4, D1, W1)
- Les indicateurs visibles (si affichés)
- Le contexte général

Timeframes possibles : M1, M5, M15, M30, H1, H4, D1, W1

Si tu ne peux PAS déterminer le timeframe → retourne "UNKNOWN".
N'INVENTE JAMAIS un timeframe.

============================================================
ÉTAPE 2 — ANALYSE PAR TIMEFRAME
============================================================

Pour chaque image, identifie :
- Le timeframe détecté
- Le biais directionnel (BUY / SELL / NEUTRAL)
- La structure (BOS, CHoCH, OB, FVG, liquidité)
- Les zones clés

============================================================
ÉTAPE 3 — CONFLUENCE
============================================================

- ALIGNED      → tous les TF vont dans le même sens
- PARTIAL      → 2 sur 3 alignés
- DISAGREEMENT → désaccord
- NEUTRAL      → aucun biais

============================================================
ÉTAPE 4 — SIGNAL FINAL
============================================================

- BUY NOW / SELL NOW      → confluence totale
- BUY LIMIT / SELL LIMIT  → attente retour zone
- WAIT                    → désaccord

============================================================
FORMAT JSON (aucun Markdown)
============================================================

{
  "asset": "",
  "market_type": "",
  "strategy_applied": "MULTI_TF",
  "timeframes_analyzed": ["H4", "H1", "M15"],
  "tf_analysis": [
    {
      "image_index": 1,
      "timeframe": "H4",
      "bias": "BUY|SELL|NEUTRAL",
      "structure": "",
      "key_zone": ""
    }
  ],
  "confluence_status": "ALIGNED|PARTIAL|DISAGREEMENT|NEUTRAL",
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
  "reason": "",
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "zones": [],
  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },
  "economic_news": "",
  "risk_warning": ""
}

============================================================
INSTRUCTIONS FINALES
============================================================

- IMPORTANT : détecte le timeframe de CHAQUE image.
- Le champ "tf_analysis" DOIT avoir un élément par image, dans l'ordre.
- Réponds UNIQUEMENT en JSON valide.
- Ne force JAMAIS un trade.
`;
}


/* ============================================================
   PROMPT OR (SMC)
   ============================================================ */

function buildGoldSMCPrompt(asset, timeframe, userPrompt) {
    return `
Tu es ARKAS SCAN AI, expert en Smart Money Concepts.

MARCHÉ : ${asset} (OR — SMC PUR)
TIMEFRAME : ${timeframe}

RÈGLE : NE JAMAIS RESTER PASSIF.
Propose AU MOINS 2 scénarios BUY LIMIT / SELL LIMIT.

FORMAT JSON :
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
  "zones": [],
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "reason": "",
  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },
  "economic_news": "",
  "risk_warning": ""
}

PROMPT UTILISATEUR : ${userPrompt}
`;
}


/* ============================================================
   PROMPT FOREX (SMC + PA)
   ============================================================ */

function buildForexHybridPrompt(asset, timeframe, userPrompt) {
    return `
Tu es ARKAS SCAN AI, expert SMC + Price Action.

MARCHÉ : ${asset} (FOREX)
TIMEFRAME : ${timeframe}

Analyse SMC + Price Action + confluence.

FORMAT JSON :
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
  "structure": "",
  "liquidity": "",
  "order_block": "",
  "fvg": "",
  "price_action": "",
  "confluence_status": "ALIGNED|PARTIAL|DISAGREEMENT|NEUTRAL",
  "zones": [],
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "reason": "",
  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },
  "economic_news": "",
  "risk_warning": ""
}

PROMPT UTILISATEUR : ${userPrompt}
`;
}


/* ============================================================
   PROMPT INDICES / CRYPTO (PA SIMPLIFIÉE)
   ============================================================ */

function buildSimplePriceActionPrompt(asset, timeframe, marketType, userPrompt) {
    return `
Tu es ARKAS SCAN AI en mode Price Action simplifiée.

MARCHÉ : ${asset} (${marketType})
TIMEFRAME : ${timeframe}

Outils : Supports, Résistances, Trendlines, Cassure, Retest, Momentum.

FORMAT JSON :
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
  "zones": [],
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "reason": "",
  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },
  "economic_news": "",
  "risk_warning": ""
}

PROMPT UTILISATEUR : ${userPrompt}
`;
}


/* ============================================================
   PROMPT AUDIT
   ============================================================ */

function buildAuditPrompt(asset, timeframe, userPrompt) {
    return `
Tu es ARKAS SCAN AI en MODE AUDIT.

MARCHÉ : ${asset}
TIMEFRAME : ${timeframe}

Vérifie l'analyse utilisateur :
1. Lis les annotations
2. Fais une analyse indépendante
3. Compare
4. Statue : VALIDATED / CORRECT / PREMATURE / INVALID / UNCLEAR
5. Propose une correction chiffrée

FORMAT JSON :
{
  "asset": "",
  "timeframe": "",
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
  "zones": [],
  "reason": "",
  "risk_management": {},
  "economic_news": "",
  "risk_warning": "",
  "audit": {
    "status": "VALIDATED|CORRECT|PREMATURE|INVALID|UNCLEAR",
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
      "rr": null,
      "validation_probability": 0
    }
  }
}

PROMPT UTILISATEUR : ${userPrompt}
`;
}


/* ============================================================
   PARSING JSON
   ============================================================ */

function parseJsonSafely(text) {
    if (!text) return null;

    try { return JSON.parse(text); } catch {}

    let cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    try { return JSON.parse(cleaned); } catch {}

    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first !== -1 && last !== -1 && last > first) {
        try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
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
        confluence_status: data.confluence_status || null,
        timeframes_analyzed: Array.isArray(data.timeframes_analyzed) ? data.timeframes_analyzed : [],
        tf_analysis: Array.isArray(data.tf_analysis) ? data.tf_analysis : [],
        zones: normalizeZones(data.zones),
        primary_scenario: data.primary_scenario || "",
        alternative_scenario: data.alternative_scenario || "",
        invalidation: data.invalidation || "",
        risk_management: data.risk_management || {},
        economic_news: data.economic_news || "Non disponible — vérifier le calendrier.",
        reason: data.reason || "",
        risk_warning: data.risk_warning || "L'analyse technique ne garantit pas un résultat."
    };

    if (mode === "audit") {
        result.audit = normalizeAudit(data.audit);
    }

    result.confidence_percent = clamp(result.confidence_percent, 0, 100);
    result.arkas_score = clamp(result.arkas_score, 0, 100);

    return result;
}


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
            annotations: Array.isArray(detected.annotations) ? detected.annotations : [],
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
            rr: normalizeNumber(corrected.rr),
            validation_probability: clamp(normalizeNumber(corrected.validation_probability) || 0, 0, 100)
        }
    };
}


function validateTradeLevels(result) {
    const direction = String(result.direction || "").toUpperCase();
    const { entry, sl, tp1, tp2, tp3 } = result;

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


function inferDirection(signal) {
    const v = String(signal || "").toUpperCase();
    if (v.includes("BUY")) return "BUY";
    if (v.includes("SELL")) return "SELL";
    return "WAIT";
}

function normalizeAuditStatus(status) {
    const allowed = ["VALIDATED", "CORRECT", "PREMATURE", "INVALID", "UNCLEAR"];
    const v = String(status || "UNCLEAR").toUpperCase();
    return allowed.includes(v) ? v : "UNCLEAR";
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const n = Number(String(value).replace(",", ".").replace(/[^0-9eE.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
}

function isFiniteNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
}

function clamp(v, min, max) {
    if (!isFiniteNumber(v)) return 0;
    return Math.min(Math.max(v, min), max);
}

function safeGeminiError(text) {
    try {
        const p = JSON.parse(text);
        return p?.error?.message || "Erreur Gemini.";
    } catch {
        return "Erreur Gemini.";
    }
}

