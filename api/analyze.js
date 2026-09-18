// ============================================================
// ARKAS SCAN AI V2
// API GEMINI - V2.4 (Modèle corrigé)
// ============================================================

export default async function handler(req, res) {

    /* ========================================================
       CORS
       ======================================================== */

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Méthode non autorisée. Utilise POST."
        });
    }

    try {

        /* ====================================================
           API KEY
           ==================================================== */

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("❌ GEMINI_API_KEY absente");
            return res.status(500).json({
                success: false,
                error: "GEMINI_KEY_MISSING",
                message: "La clé GEMINI_API_KEY n'est pas configurée."
            });
        }

        /* ====================================================
           BODY
           ==================================================== */

        const body = req.body || {};
        const mode = String(body.mode || "scan").toLowerCase().trim();
        const asset = String(body.asset || "UNKNOWN").trim();
        const timeframe = String(body.timeframe || "UNKNOWN").trim();
        const userPrompt = String(body.prompt || "").trim();

        /* ====================================================
           RÉCUPÉRATION DES IMAGES
           ==================================================== */

        let images = [];

        if (Array.isArray(body.images)) {
            images = body.images
                .filter(item => item && item.imageBase64)
                .map(item => ({
                    imageBase64: cleanBase64(item.imageBase64),
                    mimeType: normalizeMimeType(item.mimeType)
                }));
        }

        if (images.length === 0 && body.imageBase64) {
            images = [{
                imageBase64: cleanBase64(body.imageBase64),
                mimeType: normalizeMimeType(body.mimeType)
            }];
        }

        /* ====================================================
           VALIDATION IMAGES
           ==================================================== */

        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                error: "IMAGE_MISSING",
                message: "Aucune capture graphique reçue."
            });
        }

        if (images.length > 6) {
            return res.status(400).json({
                success: false,
                error: "TOO_MANY_IMAGES",
                message: "Maximum 6 captures par analyse."
            });
        }

        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

        for (const image of images) {
            if (!allowedMimeTypes.includes(image.mimeType)) {
                return res.status(400).json({
                    success: false,
                    error: "INVALID_IMAGE_TYPE",
                    message: `Format non supporté : ${image.mimeType}. Utilise JPG, PNG ou WebP.`
                });
            }
            if (!image.imageBase64 || image.imageBase64.length < 100) {
                return res.status(400).json({
                    success: false,
                    error: "INVALID_IMAGE",
                    message: "Une capture est vide ou invalide."
                });
            }
        }

        const totalBase64Size = images.reduce((total, img) => total + img.imageBase64.length, 0);

        if (totalBase64Size > 18_000_000) {
            return res.status(413).json({
                success: false,
                error: "IMAGE_TOO_LARGE",
                message: "Captures trop volumineuses. Réduis leur taille."
            });
        }

        /* ====================================================
           CLASSIFICATION
           ==================================================== */

        const marketType = classifyMarket(asset);

        /* ====================================================
           PROMPT
           ==================================================== */

        const prompt = buildPrompt({
            mode,
            asset,
            timeframe,
            marketType,
            userPrompt,
            imageCount: images.length
        });

        /* ====================================================
           PARTS GEMINI
           ==================================================== */

        const parts = [{ text: prompt }];

        for (const image of images) {
            parts.push({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.imageBase64
                }
            });
        }

        /* ====================================================
           MODÈLE + ENDPOINT
           ==================================================== */

        const model = "gemini-2.0-flash-exp";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        /* ====================================================
           REQUÊTE GEMINI
           ==================================================== */

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55_000);

        let geminiResponse;

        try {
            geminiResponse = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: parts
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        maxOutputTokens: 8000
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                    ]
                }),
                signal: controller.signal
            });

        } catch (error) {
            clearTimeout(timeout);
            if (error && error.name === "AbortError") {
                return res.status(504).json({
                    success: false,
                    error: "GEMINI_TIMEOUT",
                    message: "Gemini met trop de temps à répondre. Réessaie."
                });
            }
            console.error("❌ GEMINI FETCH ERROR:", error);
            return res.status(502).json({
                success: false,
                error: "GEMINI_CONNECTION_ERROR",
                message: "Impossible de contacter Gemini.",
                details: error?.message || "Erreur réseau"
            });
        }

        clearTimeout(timeout);

        /* ====================================================
           LECTURE RÉPONSE
           ==================================================== */

        const rawText = await geminiResponse.text();
        let geminiData = null;

        try {
            geminiData = JSON.parse(rawText);
        } catch (error) {
            console.error("❌ GEMINI INVALID JSON:", rawText);
            return res.status(502).json({
                success: false,
                error: "GEMINI_INVALID_RESPONSE",
                message: "Gemini a retourné une réponse illisible.",
                httpStatus: geminiResponse.status
            });
        }

        /* ====================================================
           ERREUR HTTP GEMINI
           ==================================================== */

        if (!geminiResponse.ok) {
            console.error("❌ GEMINI HTTP ERROR:", geminiResponse.status, JSON.stringify(geminiData));
            return handleGeminiHttpError(res, geminiResponse.status, geminiData);
        }

        /* ====================================================
           PROMPT BLOQUÉ
           ==================================================== */

        if (geminiData.promptFeedback && geminiData.promptFeedback.blockReason) {
            const reason = geminiData.promptFeedback.blockReason;
            console.warn("⚠️ GEMINI PROMPT BLOCKED:", reason);
            return res.status(400).json({
                success: false,
                error: "GEMINI_PROMPT_BLOCKED",
                message: "Gemini a bloqué cette demande.",
                reason: reason,
                userMessage: buildFriendlyBlockMessage(reason)
            });
        }

        /* ====================================================
           CANDIDATS
           ==================================================== */

        const candidates = Array.isArray(geminiData.candidates) ? geminiData.candidates : [];

        if (candidates.length === 0) {
            console.warn("⚠️ GEMINI SANS CANDIDAT:", JSON.stringify(geminiData));
            return res.status(400).json({
                success: false,
                error: "GEMINI_NO_CANDIDATE",
                message: "Gemini n'a retourné aucune analyse exploitable."
            });
        }

        const candidate = candidates[0];
        const finishReason = candidate.finishReason || null;

        if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT" || finishReason === "BLOCKLIST" || finishReason === "SPII") {
            return res.status(400).json({
                success: false,
                error: "GEMINI_RESPONSE_BLOCKED",
                message: "Gemini a bloqué la réponse générée.",
                reason: finishReason
            });
        }

        /* ====================================================
           EXTRACTION TEXTE
           ==================================================== */

        const generatedText = extractGeminiText(candidate);

        if (!generatedText) {
            console.warn("⚠️ GEMINI EMPTY TEXT:", JSON.stringify(candidate));
            return res.status(400).json({
                success: false,
                error: "GEMINI_EMPTY_RESPONSE",
                message: "Gemini a répondu sans contenu.",
                finishReason: finishReason
            });
        }

        /* ====================================================
           PARSING JSON
           ==================================================== */

        let parsed;

        try {
            parsed = parseGeminiJSON(generatedText);
        } catch (error) {
            console.error("❌ JSON GEMINI IMPOSSIBLE:", generatedText);
            return res.status(502).json({
                success: false,
                error: "INVALID_ANALYSIS_JSON",
                message: "Gemini a répondu avec un JSON invalide."
            });
        }

        /* ====================================================
           NORMALISATION
           ==================================================== */

        const result = normalizeResult(parsed, {
            asset,
            timeframe,
            marketType,
            mode
        });

        /* ====================================================
           VALIDATION
           ==================================================== */

        const validation = validateResult(result);

        if (!validation.valid) {
            console.warn("⚠️ ANALYSE INVALIDE:", validation.message, result);
            result.signal = "WAIT";
            result.direction = "WAIT";
            result.entry = null;
            result.sl = null;
            result.tp1 = null;
            result.tp2 = null;
            result.tp3 = null;
            result.rr = null;
            result.invalidation = validation.message;
        }

        /* ====================================================
           RÉPONSE FINALE
           ==================================================== */

        return res.status(200).json({
            success: true,
            model: model,
            mode: mode,
            asset: asset,
            timeframe: timeframe,
            market_type: marketType,

            signal: result.signal,
            action: result.signal,
            direction: result.direction,
            confidence_percent: result.confidence_percent,
            arkas_score: result.arkas_score,

            entry: result.entry,
            sl: result.sl,
            tp1: result.tp1,
            tp2: result.tp2,
            tp3: result.tp3,
            rr: result.rr,

            structure: result.structure,
            trend: result.trend,
            liquidity: result.liquidity,
            order_block: result.order_block,
            fvg: result.fvg,
            bos: result.bos,
            choch: result.choch,
            support: result.support,
            resistance: result.resistance,
            reason: result.reason,
            invalidation: result.invalidation,
            primary_scenario: result.primary_scenario,
            alternative_scenario: result.alternative_scenario,

            confluence_status: result.confluence_status,
            timeframes_analyzed: result.timeframes_analyzed,
            tf_analysis: result.tf_analysis,

            zones: result.zones,

            strategy_applied: result.strategy_applied,
            risk_management: result.risk_management || {},
            economic_news: result.economic_news || "Non disponible",

            raw_finish_reason: finishReason
        });

    } catch (error) {
        console.error("🔥 ARKAS API ERROR:", error);
        return res.status(500).json({
            success: false,
            error: "SERVER_ERROR",
            message: "Une erreur interne est survenue.",
            details: error?.message || "Erreur inconnue"
        });
    }
}


/* ============================================================
   PROMPT PRINCIPAL
   ============================================================ */

function buildPrompt({ mode, asset, timeframe, marketType, userPrompt, imageCount }) {

    const isMultiTF = (mode === "multi-tf" || mode === "multitf" || (imageCount > 1 && mode !== "audit"));
    const isAudit = (mode === "audit");

    const base = `
Tu es ARKAS SCAN AI V2, un assistant spécialisé en analyse technique.

Actif : ${asset}
Marché : ${marketType}
Timeframe fourni : ${timeframe}
Nombre de captures : ${imageCount}

============================================================
RÈGLES ABSOLUES
============================================================

1. Analyse UNIQUEMENT ce qui est visible.
2. Ne fabrique JAMAIS un prix absent.
3. Si l'échelle de prix n'est pas lisible → WAIT.
4. Pour BUY : SL < Entry < TP1 < TP2 < TP3
5. Pour SELL : TP3 < TP2 < TP1 < Entry < SL
6. Si TP2/TP3 incertains → null.
7. N'invente JAMAIS d'actualités.
8. Chaque capture a son PROPRE timeframe.

============================================================
DÉTECTION AUTOMATIQUE DU TIMEFRAME
============================================================

Pour CHAQUE image, examine :

1. L'échelle de temps affichée (haut/bas)
2. La taille des bougies
3. Le nombre de bougies visibles
4. Les indicateurs (RSI, MACD, MA)
5. Les décimales des prix
6. Les patterns visibles

TIMEFRAMES POSSIBLES :
S15, S30, M1, M2, M3, M5, M10, M15, M30,
H1, H2, H4, H6, H8, H12, D1, W1, MN1

Si tu n'es pas sûr → "UNKNOWN".
N'invente JAMAIS.

============================================================
ANALYSE TECHNIQUE
============================================================

- Tendance, structure
- HH, HL, LH, LL
- BOS, CHoCH
- Liquidité, sweep
- Support, résistance
- Order Block, FVG
- Breakout, retest, momentum

============================================================
SIGNAL
============================================================

BUY NOW | SELL NOW | BUY LIMIT | SELL LIMIT | WAIT

- BUY NOW / SELL NOW : entrée immédiate
- BUY LIMIT / SELL LIMIT : attente zone
- WAIT : pas clair
`;

    let modeInstructions = "";

    if (isMultiTF) {
        modeInstructions = `

============================================================
MODE MULTI-TIMEFRAME
============================================================

Tu reçois ${imageCount} capture(s) de timeframes DIFFÉRENTS.

ÉTAPE 1 — DÉTECTE le timeframe de CHAQUE image.
Retourne un objet par image dans "tf_analysis".

ÉTAPE 2 — ANALYSE chaque timeframe (biais, structure, zones).

ÉTAPE 3 — CONFLUENCE :
ALIGNED | PARTIAL | DISAGREEMENT | NEUTRAL

ÉTAPE 4 — SIGNAL PRINCIPAL :
- Confluence totale → NOW
- Partielle → LIMIT
- Désaccord → WAIT

ÉTAPE 5 — 4 SCÉNARIOS (A, B, C, D) chiffrés.

⚠️ NE MÉLANGE PAS les prix entre TF.
`;
    } else if (isAudit) {
        modeInstructions = `

============================================================
MODE AUDIT
============================================================

Analyse la capture contenant une analyse utilisateur.
Statue : VALIDATED | CORRECT | PREMATURE | INVALID | UNCLEAR.
Fournis les corrections chiffrées.
`;
    } else {
        modeInstructions = `

============================================================
MODE SCAN
============================================================

Analyse complète : signal, direction, entry, sl, tp1, tp2, tp3, rr,
confidence, score, reason, invalidation, 2-4 scénarios.
`;
    }

    const extra = userPrompt ? `

============================================================
INSTRUCTION UTILISATEUR
============================================================

${userPrompt}
` : "";

    const schema = `

============================================================
FORMAT JSON ATTENDU
============================================================

{
  "signal": "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",
  "action": "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",
  "direction": "BUY|SELL|WAIT",
  "entry": 0,
  "sl": 0,
  "tp1": 0,
  "tp2": 0,
  "tp3": 0,
  "rr": 0,
  "confidence_percent": 0,
  "arkas_score": 0,
  "strategy_applied": "MULTI_TF|SMC|PRICE_ACTION|AUDIT",
  "structure": "",
  "trend": "",
  "liquidity": "",
  "bos": "",
  "choch": "",
  "order_block": "",
  "fvg": "",
  "support": "",
  "resistance": "",
  "reason": "",
  "invalidation": "",
  "primary_scenario": "",
  "alternative_scenario": "",
  "confluence_status": "ALIGNED|PARTIAL|DISAGREEMENT|NEUTRAL",
  "timeframes_analyzed": [],
  "tf_analysis": [
    {
      "image_index": 1,
      "timeframe": "H4",
      "confidence": "haute",
      "bias": "BUY",
      "structure": "",
      "key_zone": ""
    }
  ],
  "zones": [
    {
      "id": "A",
      "type": "BUY_LIMIT",
      "zone_label": "",
      "zone_price": "",
      "entry": 0,
      "sl": 0,
      "tp1": 0,
      "tp2": 0,
      "tp3": 0,
      "rr": 0,
      "priority": 1
    }
  ],
  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },
  "economic_news": "Non disponible",
  "risk_warning": ""
}

RÈGLES :
1. DÉTECTE le timeframe de CHAQUE image.
2. "tf_analysis" DOIT contenir ${imageCount} élément(s).
3. Les niveaux doivent être NUMÉRIQUES.
4. Réponds UNIQUEMENT avec ce JSON.
`;

    return base + modeInstructions + extra + schema;
}


/* ============================================================
   MIME TYPE
   ============================================================ */

function normalizeMimeType(mimeType) {
    const value = String(mimeType || "image/jpeg").toLowerCase().trim();
    if (value === "image/jpg" || value === "jpeg" || value === "jpg") return "image/jpeg";
    if (value === "png") return "image/png";
    if (value === "webp") return "image/webp";
    return value;
}


/* ============================================================
   NETTOYAGE BASE64
   ============================================================ */

function cleanBase64(value) {
    let result = String(value || "").trim();
    if (result.startsWith("data:")) {
        const comma = result.indexOf(",");
        if (comma !== -1) result = result.substring(comma + 1);
    }
    return result.replace(/\s+/g, "");
}


/* ============================================================
   EXTRACTION TEXTE
   ============================================================ */

function extractGeminiText(candidate) {
    if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) return "";
    return candidate.content.parts
        .map(part => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();
}


/* ============================================================
   PARSING JSON
   ============================================================ */

function parseGeminiJSON(text) {
    let clean = String(text || "").trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "");

    try {
        return JSON.parse(clean);
    } catch (error) {
        const first = clean.indexOf("{");
        const last = clean.lastIndexOf("}");
        if (first === -1 || last === -1 || last <= first) throw error;
        return JSON.parse(clean.substring(first, last + 1));
    }
}


/* ============================================================
   NORMALISATION
   ============================================================ */

function normalizeResult(data, context) {

    const action = normalizeAction(data.action || data.signal);

    let direction = String(data.direction || "").toUpperCase().trim();
    if (direction !== "BUY" && direction !== "SELL") {
        if (action.startsWith("BUY")) direction = "BUY";
        else if (action.startsWith("SELL")) direction = "SELL";
        else direction = "WAIT";
    }
    if (action === "WAIT") direction = "WAIT";

    return {
        signal: action,
        action: action,
        direction: direction,
        entry: normalizeNumber(data.entry),
        sl: normalizeNumber(data.sl),
        tp1: normalizeNumber(data.tp1),
        tp2: normalizeNumber(data.tp2),
        tp3: normalizeNumber(data.tp3),
        rr: normalizeNumber(data.rr),
        confidence_percent: clamp(normalizeNumber(data.confidence_percent) || 0, 0, 100),
        arkas_score: clamp(normalizeNumber(data.arkas_score) || 0, 0, 100),
        strategy_applied: safeText(data.strategy_applied) || (context.mode === "multi-tf" ? "MULTI_TF" : "SMC"),
        structure: safeText(data.structure || data.market_structure),
        trend: safeText(data.trend),
        liquidity: safeText(data.liquidity),
        bos: safeText(data.bos),
        choch: safeText(data.choch),
        order_block: safeText(data.order_block),
        fvg: safeText(data.fvg),
        support: safeText(data.support),
        resistance: safeText(data.resistance),
        primary_scenario: safeText(data.primary_scenario),
        alternative_scenario: safeText(data.alternative_scenario),
        invalidation: safeText(data.invalidation),
        reason: safeText(data.reason),
        confluence_status: data.confluence_status || null,
        timeframes_analyzed: Array.isArray(data.timeframes_analyzed) ? data.timeframes_analyzed : [],
        tf_analysis: Array.isArray(data.tf_analysis) ? data.tf_analysis : [],
        zones: normalizeZones(data.zones),
        risk_management: data.risk_management || {},
        economic_news: safeText(data.economic_news) || "Non disponible",
        risk_warning: safeText(data.risk_warning)
    };
}


/* ============================================================
   ZONES
   ============================================================ */

function normalizeZones(zones) {
    if (!Array.isArray(zones)) return [];
    return zones.map((z, i) => ({
        id: z.id || String.fromCharCode(65 + i),
        type: String(z.type || "BUY_LIMIT").toUpperCase(),
        zone_label: safeText(z.zone_label),
        zone_price: safeText(z.zone_price),
        entry: normalizeNumber(z.entry),
        sl: normalizeNumber(z.sl),
        tp1: normalizeNumber(z.tp1),
        tp2: normalizeNumber(z.tp2),
        tp3: normalizeNumber(z.tp3),
        rr: normalizeNumber(z.rr),
        priority: z.priority || (i + 1)
    }));
}


/* ============================================================
   ACTION
   ============================================================ */

function normalizeAction(value) {
    const action = String(value || "").toUpperCase().trim();
    if (action.includes("BUY LIMIT")) return "BUY LIMIT";
    if (action.includes("SELL LIMIT")) return "SELL LIMIT";
    if (action.includes("BUY NOW")) return "BUY NOW";
    if (action.includes("SELL NOW")) return "SELL NOW";
    if (action === "BUY") return "BUY NOW";
    if (action === "SELL") return "SELL NOW";
    return "WAIT";
}


/* ============================================================
   NOMBRE
   ============================================================ */

function normalizeNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    let text = String(value).trim().replace(/,/g, ".");
    const match = text.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
}


/* ============================================================
   VALIDATION
   ============================================================ */

function validateResult(result) {

    if (result.action === "WAIT") return { valid: true };

    if (result.direction !== "BUY" && result.direction !== "SELL") {
        return { valid: false, message: "Direction BUY/SELL absente." };
    }

    if (!Number.isFinite(result.entry) || !Number.isFinite(result.sl) || !Number.isFinite(result.tp1)) {
        return { valid: false, message: "Entry, SL ou TP1 manquant." };
    }

    if (result.direction === "BUY") {
        if (result.sl >= result.entry) return { valid: false, message: "BUY : SL doit être < Entry." };
        if (result.tp1 <= result.entry) return { valid: false, message: "BUY : TP1 doit être > Entry." };
    }

    if (result.direction === "SELL") {
        if (result.sl <= result.entry) return { valid: false, message: "SELL : SL doit être > Entry." };
        if (result.tp1 >= result.entry) return { valid: false, message: "SELL : TP1 doit être < Entry." };
    }

    return { valid: true };
}


/* ============================================================
   CLASSIFICATION MARCHÉ
   ============================================================ */

function classifyMarket(asset) {
    const value = String(asset || "").toUpperCase().trim();

    if (value.includes("XAU") || value.includes("GOLD")) return "GOLD";

    const cryptoSymbols = ["BTC", "ETH", "LTC", "XRP", "SOL", "BNB", "ADA", "DOGE"];
    if (cryptoSymbols.some(s => value.includes(s))) return "CRYPTO";

    const forexSymbols = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"];
    if (forexSymbols.some(s => value.includes(s))) return "FOREX";

    const indices = ["US30", "NAS100", "SPX500", "GER40", "DAX", "UK100"];
    if (indices.some(s => value.includes(s))) return "INDICES";

    if (value.includes("VOLATILITY") || /^R_\d+$/.test(value) || value.includes("BOOM") || value.includes("CRASH")) {
        return "SYNTHETIC";
    }

    return "OTHER";
}


/* ============================================================
   UTILITAIRES
   ============================================================ */

function safeText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}


/* ============================================================
   ERREURS HTTP GEMINI
   ============================================================ */

function handleGeminiHttpError(res, status, data) {
    const apiError = data && data.error ? data.error : null;
    const message = apiError?.message || "Erreur retournée par Gemini.";

    if (status === 401 || status === 403) {
        return res.status(status).json({
            success: false,
            error: "GEMINI_AUTH_ERROR",
            message: "Clé Gemini invalide ou non autorisée.",
            details: message
        });
    }

    if (status === 429) {
        return res.status(429).json({
            success: false,
            error: "GEMINI_QUOTA",
            message: "Quota Gemini atteint.",
            details: message
        });
    }

    if (status === 404) {
        return res.status(404).json({
            success: false,
            error: "GEMINI_MODEL_ERROR",
            message: "Modèle Gemini indisponible.",
            model: "gemini-2.0-flash-exp",
            details: message
        });
    }

    return res.status(502).json({
        success: false,
        error: "GEMINI_API_ERROR",
        message: "Gemini a retourné une erreur.",
        details: message,
        status: status
    });
}


/* ============================================================
   MESSAGE BLOCAGE
   ============================================================ */

function buildFriendlyBlockMessage(reason) {
    switch (String(reason || "").toUpperCase()) {
        case "SAFETY":
            return "Bloqué par les contrôles de sécurité.";
        case "BLOCKLIST":
            return "La demande contient un élément bloqué.";
        case "PROHIBITED_CONTENT":
            return "Le contenu ne peut pas être analysé.";
        case "SPII":
            return "La capture contient des informations sensibles.";
        default:
            return "Gemini a bloqué la demande.";
    }
}
