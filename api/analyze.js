// ============================================================
// ARKAS SCAN AI V2
// api/analyze.js
// Multi-timeframe + Audit + Stratégie adaptative
// ============================================================

export default async function handler(req, res) {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée. Utilisez POST." });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "GEMINI_API_KEY manquante." });
        }

        const body = req.body || {};
        const mode = body.mode || "scan";
        const images = body.images || null;
        const imageBase64 = body.imageBase64;
        const mimeType = body.mimeType || "image/jpeg";
        const asset = body.asset || "AUTO";
        const timeframe = body.timeframe || "AUTO";
        const userPrompt = body.prompt || "";

        const isMultiTF = (mode === "multi-tf" && Array.isArray(images) && images.length > 0);
        const isAudit = (mode === "audit");

        if (!isMultiTF && !imageBase64) {
            return res.status(400).json({ error: "Aucune image envoyée." });
        }

        let finalPrompt;

        if (isAudit) {
            finalPrompt = buildAuditPrompt(asset, timeframe, userPrompt);
        } else if (isMultiTF) {
            finalPrompt = buildMultiTFPrompt(images);
        } else {
            const marketType = classifyMarket(asset);
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

        const model = "gemini-3.6-flash";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const geminiResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: finalPrompt }, ...imageParts]
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini error:", errorText);
            return res.status(geminiResponse.status).json({
                error: "Gemini a refusé la demande.",
                details: safeGeminiError(errorText)
            });
        }

        const geminiData = await geminiResponse.json();
        const rawText = geminiData
            ?.candidates?.[0]
            ?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (!rawText) {
            return res.status(502).json({ error: "Aucun résultat Gemini." });
        }

        const parsed = parseJsonSafely(rawText);
        if (!parsed) {
            return res.status(502).json({ error: "JSON invalide retourné par Gemini." });
        }

        const result = normalizeResult(parsed, asset, timeframe, mode);
        validateTradeLevels(result);

        return res.status(200).json(result);

    } catch (error) {
        console.error("ARKAS API ERROR:", error);
        return res.status(500).json({ error: error.message || "Erreur serveur." });
    }
}


/* ============================================================
   CLASSIFICATION DU MARCHÉ
   ============================================================ */

function classifyMarket(asset) {
    const a = String(asset || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (a.includes("XAU") || a.includes("GOLD")) return "GOLD";
    if (/^[A-Z]{6}$/.test(a)) return "FOREX";
    if (a.includes("BTC") || a.includes("ETH")) return "CRYPTO_MAJOR";
    if (a.includes("US30") || a.includes("NAS100") || a.includes("US500")) return "INDICES";
    return "OTHER";
}


/* ============================================================
   PROMPT AUDIT
   ============================================================ */

function buildAuditPrompt(asset, timeframe, userPrompt) {
    return `Tu es ARKAS SCAN AI en MODE AUDIT.

Analyse la capture qui contient une analyse utilisateur.
Vérifie-la indépendamment.

Étapes :
1. Lis les annotations (Entry, SL, TP, flèches, zones)
2. Fais une analyse indépendante
3. Compare
4. Statue : VALIDATED / CORRECT / PREMATURE / INVALID / UNCLEAR
5. Propose une correction chiffrée

Réponds UNIQUEMENT avec ce JSON :
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
  "economic_news": "",
  "risk_warning": "",
  "zones": [],
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

Prompt utilisateur : ${userPrompt}`;
}


/* ============================================================
   PROMPT MULTI-TIMEFRAME
   ============================================================ */

function buildMultiTFPrompt(images) {
    const count = images.length;

    return `Tu es ARKAS SCAN AI, expert en analyse multi-timeframe.

Tu reçois ${count} capture(s) SANS indication de timeframe.

ÉTAPE 1 — DÉTECTE le timeframe de CHAQUE image :
M1, M5, M15, M30, H1, H4, D1, W1.
Si impossible → "UNKNOWN".

ÉTAPE 2 — ANALYSE chaque timeframe :
- Biais (BUY/SELL/NEUTRAL)
- Structure (BOS, CHoCH, OB, FVG)
- Zones clés

ÉTAPE 3 — CONFLUENCE :
- ALIGNED / PARTIAL / DISAGREEMENT / NEUTRAL

ÉTAPE 4 — SIGNAL :
- BUY NOW / SELL NOW / BUY LIMIT / SELL LIMIT / WAIT

Réponds UNIQUEMENT avec ce JSON :
{
  "asset": "",
  "market_type": "",
  "strategy_applied": "MULTI_TF",
  "timeframes_analyzed": [],
  "tf_analysis": [
    { "image_index": 1, "timeframe": "H4", "bias": "BUY", "structure": "", "key_zone": "" }
  ],
  "confluence_status": "ALIGNED|PARTIAL|DISAGREEMENT|NEUTRAL",
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
  "reason": "",
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "zones": [],
  "risk_management": { "risk_percent": "1%", "recommendation": "" },
  "economic_news": "",
  "risk_warning": ""
}`;
}


/* ============================================================
   PROMPTS SIMPLES
   ============================================================ */

function buildGoldSMCPrompt(asset, timeframe, userPrompt) {
    return `Tu es ARKAS SCAN AI, expert SMC.
MARCHÉ : ${asset} — ${timeframe}
Réponds en JSON avec : asset, market_type, strategy_applied, signal, direction, confidence_percent, entry, sl, tp1, tp2, tp3, rr, arkas_score, structure, liquidity, order_block, fvg, zones, primary_scenario, alternative_scenario, invalidation, reason, risk_management, economic_news, risk_warning.
Prompt : ${userPrompt}`;
}

function buildForexHybridPrompt(asset, timeframe, userPrompt) {
    return `Tu es ARKAS SCAN AI, expert SMC + Price Action.
MARCHÉ : ${asset} — ${timeframe}
Réponds en JSON avec : asset, market_type, strategy_applied, signal, direction, confidence_percent, entry, sl, tp1, tp2, tp3, rr, arkas_score, structure, zones, primary_scenario, invalidation, reason, risk_management.
Prompt : ${userPrompt}`;
}

function buildSimplePriceActionPrompt(asset, timeframe, marketType, userPrompt) {
    return `Tu es ARKAS SCAN AI en mode Price Action.
MARCHÉ : ${asset} — ${timeframe} (${marketType})
Réponds en JSON avec : asset, market_type, strategy_applied, signal, direction, confidence_percent, entry, sl, tp1, tp2, tp3, rr, arkas_score, structure, zones, reason, risk_management.
Prompt : ${userPrompt}`;
}


/* ============================================================
   PARSING + NORMALISATION
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
        timeframes_analyzed: Array.isArray(data.timeframes_analyzed) ? data.timeframes_analyzed : [],
        tf_analysis: Array.isArray(data.tf_analysis) ? data.tf_analysis : [],
        confluence_status: data.confluence_status || null,
        zones: normalizeZones(data.zones),
        primary_scenario: data.primary_scenario || "",
        alternative_scenario: data.alternative_scenario || "",
        invalidation: data.invalidation || "",
        risk_management: data.risk_management || {},
        economic_news: data.economic_news || "Non disponible",
        reason: data.reason || "",
        risk_warning: data.risk_warning || ""
    };

    if (mode === "audit") result.audit = normalizeAudit(data.audit);

    result.confidence_percent = clamp(result.confidence_percent, 0, 100);
    result.arkas_score = clamp(result.arkas_score, 0, 100);
    return result;
}

function normalizeZones(zones) {
    if (!Array.isArray(zones)) return [];
    return zones.map((z, i) => ({
        id: z.id || String.fromCharCode(65 + i),
        type: String(z.type || "BUY_LIMIT").toUpperCase(),
        zone_label: z.zone_label || "",
        zone_price: z.zone_price || "",
        entry: normalizeNumber(z.entry),
        sl: normalizeNumber(z.sl),
        tp1: normalizeNumber(z.tp1),
        tp2: normalizeNumber(z.tp2),
        tp3: normalizeNumber(z.tp3),
        rr: normalizeNumber(z.rr),
        priority: z.priority || (i + 1)
    }));
}

function normalizeAudit(audit) {
    audit = audit || {};
    const corrected = audit.corrected_trade || {};
    return {
        status: audit.status || "UNCLEAR",
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
            validation_probability: normalizeNumber(corrected.validation_probability) || 0
        }
    };
}

function validateTradeLevels(result) {
    const dir = String(result.direction || "").toUpperCase();
    if (dir === "WAIT" || result.signal === "WAIT") { result.trade_valid = true; return; }

    const { entry, sl, tp1 } = result;
    if (!isFiniteNumber(entry) || !isFiniteNumber(sl) || !isFiniteNumber(tp1)) {
        result.trade_valid = false;
        return;
    }
    if (dir === "BUY" && !(sl < entry && entry < tp1)) {
        result.trade_valid = false;
    } else if (dir === "SELL" && !(tp1 < entry && entry < sl)) {
        result.trade_valid = false;
    } else {
        result.trade_valid = true;
    }
}

function inferDirection(signal) {
    const v = String(signal || "").toUpperCase();
    if (v.includes("BUY")) return "BUY";
    if (v.includes("SELL")) return "SELL";
    return "WAIT";
}

function normalizeNumber(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(String(v).replace(",", ".").replace(/[^0-9eE.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
}

function isFiniteNumber(v) { return typeof v === "number" && Number.isFinite(v); }
function clamp(v, min, max) { return isFiniteNumber(v) ? Math.min(Math.max(v, min), max) : 0; }

function safeGeminiError(text) {
    try { const p = JSON.parse(text); return p?.error?.message || "Erreur"; }
    catch { return "Erreur Gemini"; }
}
