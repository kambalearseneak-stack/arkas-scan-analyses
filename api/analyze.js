// ============================================================
// ARKAS SCAN AI V2
// api/analyze.js
//
// Multi-Timeframe + Audit + SMC + Price Action
// Validation serveur des Entry / SL / TP
// Protection contre les niveaux incohérents
// Action finale : BUY NOW / SELL NOW / BUY LIMIT / SELL LIMIT / WAIT
// ============================================================

export default async function handler(req, res) {

    // ========================================================
    // CORS
    // ========================================================

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

        // ====================================================
        // API KEY
        // ====================================================

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: "GEMINI_API_KEY manquante dans les variables d'environnement Vercel."
            });
        }

        // ====================================================
        // BODY
        // ====================================================

        const body = req.body || {};

        const mode = String(body.mode || "scan").toLowerCase();

        const images = Array.isArray(body.images)
            ? body.images
            : null;

        const imageBase64 = body.imageBase64 || null;

        const mimeType = normalizeMimeType(
            body.mimeType || "image/jpeg"
        );

        const asset = String(
            body.asset || "AUTO"
        ).trim();

        const timeframe = String(
            body.timeframe || "AUTO"
        ).trim();

        const userPrompt = String(
            body.prompt || ""
        ).trim();

        // ====================================================
        // VALIDATION MODE
        // ====================================================

        const isMultiTF =
            mode === "multi-tf" &&
            Array.isArray(images) &&
            images.length > 0;

        const isAudit =
            mode === "audit";

        const isNormalScan =
            !isMultiTF &&
            !isAudit;

        // ====================================================
        // IMAGE REQUIRED
        // ====================================================

        if (!isMultiTF && !imageBase64) {
            return res.status(400).json({
                error: "Aucune image envoyée."
            });
        }

        if (isMultiTF) {

            if (images.length > 6) {
                return res.status(400).json({
                    error: "Maximum 6 images pour une analyse multi-timeframe."
                });
            }

            for (const img of images) {

                if (
                    !img ||
                    !img.imageBase64
                ) {
                    return res.status(400).json({
                        error: "Une image Multi-TF est invalide."
                    });
                }
            }
        }

        // ====================================================
        // CONSTRUCTION DU PROMPT
        // ====================================================

        let finalPrompt;

        if (isAudit) {

            finalPrompt = buildAuditPrompt(
                asset,
                timeframe,
                userPrompt
            );

        } else if (isMultiTF) {

            finalPrompt = buildMultiTFPrompt(
                images,
                asset,
                timeframe,
                userPrompt
            );

        } else {

            const marketType =
                classifyMarket(asset);

            switch (marketType) {

                case "GOLD":

                    finalPrompt =
                        buildGoldSMCPrompt(
                            asset,
                            timeframe,
                            userPrompt
                        );

                    break;

                case "FOREX":

                    finalPrompt =
                        buildForexHybridPrompt(
                            asset,
                            timeframe,
                            userPrompt
                        );

                    break;

                case "CRYPTO_MAJOR":

                case "INDICES":

                case "OTHER":

                default:

                    finalPrompt =
                        buildSimplePriceActionPrompt(
                            asset,
                            timeframe,
                            marketType,
                            userPrompt
                        );

                    break;
            }
        }

        // ====================================================
        // IMAGE PARTS
        // ====================================================

        let imageParts = [];

        if (isMultiTF) {

            imageParts = images.map((img) => {

                const imgMime =
                    normalizeMimeType(
                        img.mimeType || "image/jpeg"
                    );

                return {
                    inline_data: {
                        mime_type: imgMime,
                        data: img.imageBase64
                    }
                };

            });

        } else {

            imageParts = [
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: imageBase64
                    }
                }
            ];
        }

        // ====================================================
        // GEMINI MODEL
        // ====================================================

        // Gemini 3.6 Flash est un modèle stable multimodal.
        // Il accepte les images et les sorties structurées JSON.
        const model = "gemini-3.6-flash";

        const endpoint =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        // ====================================================
        // GEMINI REQUEST
        // ====================================================

        const geminiResponse = await fetch(
            endpoint,
            {
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
                                {
                                    text: finalPrompt
                                },
                                ...imageParts
                            ]
                        }
                    ],

                    generationConfig: {

                        responseMimeType:
                            "application/json",

                        maxOutputTokens: 8000
                    }
                })
            }
        );

        // ====================================================
        // GEMINI ERROR
        // ====================================================

        if (!geminiResponse.ok) {

            const errorText =
                await geminiResponse.text();

            console.error(
                "Gemini error:",
                errorText
            );

            return res
                .status(geminiResponse.status)
                .json({

                    error:
                        "Gemini a refusé la demande.",

                    details:
                        safeGeminiError(
                            errorText
                        )
                });
        }

        // ====================================================
        // GEMINI RESPONSE
        // ====================================================

        const geminiData =
            await geminiResponse.json();

        const rawText =
            geminiData
                ?.candidates?.[0]
                ?.content?.parts
                ?.map(
                    part =>
                        part.text || ""
                )
                .join("")
                .trim();

        if (!rawText) {

            return res.status(502).json({
                error:
                    "Gemini n'a retourné aucun résultat."
            });
        }

        // ====================================================
        // JSON PARSER
        // ====================================================

        const parsed =
            parseJsonSafely(rawText);

        if (!parsed) {

            console.error(
                "JSON Gemini invalide:",
                rawText
            );

            return res.status(502).json({
                error:
                    "JSON invalide retourné par Gemini."
            });
        }

        // ====================================================
        // NORMALISATION
        // ====================================================

        const result =
            normalizeResult(
                parsed,
                asset,
                timeframe,
                mode
            );

        // ====================================================
        // VALIDATION TRADE PRINCIPAL
        // ====================================================

        validateTradeLevels(result);

        // ====================================================
        // VALIDATION DES ZONES
        // ====================================================

        result.zones =
            result.zones.map(
                normalizeAndValidateZone
            );

        // ====================================================
        // FILTRE DE SÉCURITÉ
        // ====================================================

        applySafetyFilter(result);

        // ====================================================
        // ACTION FINALE
        // ====================================================

        result.action =
            normalizeAction(
                result.signal,
                result.direction
            );

        result.action_label =
            buildActionLabel(result);

        // ====================================================
        // RISK
        // ====================================================

        result.risk_management =
            normalizeRiskManagement(
                result.risk_management
            );

        // ====================================================
        // AUDIT
        // ====================================================

        if (mode === "audit") {

            result.audit =
                normalizeAudit(
                    parsed.audit
                );
        }

        // ====================================================
        // SERVER META
        // ====================================================

        result.server_validation = {
            checked: true,
            trade_valid:
                result.trade_valid === true,
            model: model,
            mode: mode
        };

        // ====================================================
        // RESPONSE
        // ====================================================

        return res
            .status(200)
            .json(result);

    } catch (error) {

        console.error(
            "ARKAS API ERROR:",
            error
        );

        return res.status(500).json({

            error:
                error?.message ||
                "Erreur serveur ARKAS SCAN AI."
        });
    }
}


/* ============================================================
   CLASSIFICATION DU MARCHÉ
   ============================================================ */

function classifyMarket(asset) {

    const a =
        String(asset || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");

    if (
        a.includes("XAU") ||
        a.includes("GOLD")
    ) {
        return "GOLD";
    }

    if (
        /^[A-Z]{6}$/.test(a)
    ) {
        return "FOREX";
    }

    if (
        a.includes("BTC") ||
        a.includes("ETH")
    ) {
        return "CRYPTO_MAJOR";
    }

    if (
        a.includes("US30") ||
        a.includes("NAS100") ||
        a.includes("US500") ||
        a.includes("SPX500") ||
        a.includes("DJ30")
    ) {
        return "INDICES";
    }

    return "OTHER";
}


/* ============================================================
   PROMPT GLOBAL DE SÉCURITÉ
   ============================================================ */

function baseRules() {

    return `

============================================================
RÈGLES ABSOLUES ARKAS SCAN AI
============================================================

1. Tu analyses UNIQUEMENT ce qui est visible sur les images.

2. NE JAMAIS inventer :
- prix
- bougie
- support
- résistance
- OB
- FVG
- BOS
- CHoCH
- liquidité
- timeframe
- actualité économique.

3. Si une information n'est pas suffisamment visible :
retourne "UNKNOWN", "NON_VISIBLE" ou "WAIT".

4. Le score de confiance n'est PAS une probabilité statistique
de gagner le trade.

5. confidence_percent représente uniquement le niveau de
confiance ANALYTIQUE basé sur les éléments visibles.

6. Ne présente jamais confidence_percent comme une
probabilité de profit.

7. Si le graphique ne permet pas de déterminer un niveau
précis, ne fabrique pas un prix.

8. Les niveaux doivent provenir du graphique visible.

9. BUY :
SL < ENTRY < TP1 < TP2 < TP3

10. SELL :
TP3 < TP2 < TP1 < ENTRY < SL

11. Si les niveaux sont incohérents :
SIGNAL = WAIT.

12. Si la structure est contradictoire :
SIGNAL = WAIT.

13. Si le prix exact n'est pas lisible :
ne pas inventer une précision artificielle.

14. Aucun conseil financier personnalisé n'est affirmé comme
une certitude.

15. economic_news doit être "NON_DISPONIBLE" si aucune
source d'actualité n'est fournie.

============================================================
`;
}


/* ============================================================
   PROMPT MULTI-TIMEFRAME
   ============================================================ */

function buildMultiTFPrompt(
    images,
    asset,
    timeframe,
    userPrompt
) {

    const count =
        images.length;

    return `${baseRules()}

============================================================
ARKAS SCAN AI — MULTI-TIMEFRAME
============================================================

Tu reçois ${count} capture(s).

Actif indiqué :
${asset}

Timeframe indiqué :
${timeframe}

Prompt utilisateur :
${userPrompt || "Aucun"}

============================================================
ÉTAPE 1 — IDENTIFICATION
============================================================

Pour chaque image :

- Identifier l'actif uniquement s'il est visible.
- Identifier le timeframe uniquement si suffisamment
  d'indices sont visibles.
- Sinon :
  "UNKNOWN"

Ne jamais deviner le timeframe.

============================================================
ÉTAPE 2 — STRUCTURE
============================================================

Pour chaque capture, analyser :

- tendance
- BOS
- CHoCH
- liquidité
- Order Block
- FVG
- support
- résistance
- Price Action
- momentum visible

============================================================
ÉTAPE 3 — CONFLUENCE
============================================================

Utiliser :

ALIGNED
PARTIAL
DISAGREEMENT
NEUTRAL

Ne pas transformer automatiquement ces états en
probabilités statistiques.

============================================================
ÉTAPE 4 — ACTION
============================================================

Choisir une seule action principale :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

RÈGLE :

BUY NOW :
structure haussière claire + confirmation visible +
niveau d'entrée exploitable.

SELL NOW :
structure baissière claire + confirmation visible +
niveau d'entrée exploitable.

BUY LIMIT :
biais haussier mais meilleur prix situé dans une zone
visible.

SELL LIMIT :
biais baissier mais meilleur prix situé dans une zone
visible.

WAIT :
incertitude, conflit ou niveaux non fiables.

============================================================
ÉTAPE 5 — SCÉNARIOS
============================================================

Fournir jusqu'à 4 scénarios.

IMPORTANT :

Ne crée PAS artificiellement quatre scénarios.

Un scénario ne doit être présent que si une zone ou
une hypothèse est réellement justifiée par le graphique.

Si une alternative n'est pas identifiable :
utiliser :

"type": "WAIT"

et expliquer :

"zone non suffisamment identifiable"

Les scénarios valides doivent avoir :

entry
sl
tp1
tp2
tp3

et respecter :

BUY :
SL < ENTRY < TP1 < TP2 < TP3

SELL :
TP3 < TP2 < TP1 < ENTRY < SL

============================================================
FORMAT JSON
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "",
  "strategy_applied": "MULTI_TF",

  "timeframes_analyzed": [],

  "tf_analysis": [
    {
      "image_index": 1,
      "timeframe": "UNKNOWN",
      "bias": "BUY|SELL|NEUTRAL|UNKNOWN",
      "structure": "",
      "key_zone": ""
    }
  ],

  "confluence_status":
    "ALIGNED|PARTIAL|DISAGREEMENT|NEUTRAL",

  "signal":
    "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",

  "direction":
    "BUY|SELL|WAIT",

  "confidence_percent": 0,

  "entry": 0,
  "sl": 0,
  "tp1": 0,
  "tp2": 0,
  "tp3": 0,
  "rr": 0,

  "arkas_score": 0,

  "structure": "",
  "liquidity": "",
  "order_block": "",
  "fvg": "",
  "price_action": "",

  "reason": "",

  "primary_scenario": "",
  "alternative_scenario": "",

  "invalidation": "",

  "zones": [],

  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },

  "economic_news":
    "NON_DISPONIBLE",

  "risk_warning": ""
}

============================================================
FIN
============================================================

Retourne UNIQUEMENT du JSON valide.
`;
}


/* ============================================================
   PROMPT AUDIT
   ============================================================ */

function buildAuditPrompt(
    asset,
    timeframe,
    userPrompt
) {

    return `${baseRules()}

============================================================
ARKAS SCAN AI — MODE AUDIT
============================================================

Actif :
${asset}

Timeframe :
${timeframe}

Analyse utilisateur :
${userPrompt || "Aucune analyse textuelle fournie."}

============================================================
OBJECTIF
============================================================

La capture contient probablement :

- Entry
- SL
- TP
- flèches
- zones
- annotations

Tu dois :

1. Lire l'analyse visible.
2. Faire ta propre analyse.
3. Comparer les deux.
4. Identifier les incohérences.
5. Proposer une correction uniquement si les niveaux
   peuvent être déterminés visuellement.

============================================================
STATUTS
============================================================

VALIDATED
CORRECT
PREMATURE
INVALID
UNCLEAR

============================================================
IMPORTANT
============================================================

"validation_confidence" n'est PAS une probabilité
statistique de réussite.

C'est uniquement un niveau de confiance analytique
dans la validation proposée.

============================================================
JSON
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "",
  "strategy_applied": "AUDIT",

  "signal":
    "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",

  "direction":
    "BUY|SELL|WAIT",

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

  "economic_news":
    "NON_DISPONIBLE",

  "risk_warning": "",

  "zones": [],

  "audit": {

    "status":
      "VALIDATED|CORRECT|PREMATURE|INVALID|UNCLEAR",

    "verdict": "",

    "strengths": [],

    "errors": [],

    "corrections": [],

    "corrected_trade": {

      "signal":
        "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",

      "entry": null,
      "sl": null,
      "tp1": null,
      "tp2": null,
      "tp3": null,
      "rr": null,

      "validation_confidence": 0
    }
  }
}

============================================================
FIN
============================================================

Retourne uniquement du JSON.
`;
}


/* ============================================================
   GOLD
   ============================================================ */

function buildGoldSMCPrompt(
    asset,
    timeframe,
    userPrompt
) {

    return `${baseRules()}

============================================================
ARKAS SCAN AI — GOLD / XAUUSD
============================================================

Actif :
${asset}

Timeframe :
${timeframe}

Méthode :
SMC + Price Action

Prompt utilisateur :
${userPrompt || "Aucun"}

Analyse :

- Market Structure
- BOS
- CHoCH
- Liquidity
- Order Block
- FVG
- Support / Resistance
- Breakout / Retest
- Price Action

Ne donne BUY ou SELL que si les éléments visibles
sont suffisamment cohérents.

Sinon :
WAIT.

============================================================
JSON
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "GOLD",
  "strategy_applied": "SMC",

  "signal":
    "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",

  "direction":
    "BUY|SELL|WAIT",

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

  "zones": [],

  "primary_scenario": "",
  "alternative_scenario": "",

  "invalidation": "",
  "reason": "",

  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },

  "economic_news":
    "NON_DISPONIBLE",

  "risk_warning": ""
}

Retourne uniquement du JSON valide.
`;
}


/* ============================================================
   FOREX
   ============================================================ */

function buildForexHybridPrompt(
    asset,
    timeframe,
    userPrompt
) {

    return `${baseRules()}

============================================================
ARKAS SCAN AI — FOREX
============================================================

Actif :
${asset}

Timeframe :
${timeframe}

Méthode :
SMC + Price Action

Prompt utilisateur :
${userPrompt || "Aucun"}

Analyser :

- Structure
- BOS
- CHoCH
- Liquidity
- OB
- FVG
- Support / Resistance
- Breakout
- Retest
- Price Action

Si aucune configuration claire :
WAIT.

============================================================
JSON
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "FOREX",
  "strategy_applied": "SMC_PRICE_ACTION",

  "signal":
    "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",

  "direction":
    "BUY|SELL|WAIT",

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

  "zones": [],

  "primary_scenario": "",
  "alternative_scenario": "",

  "invalidation": "",
  "reason": "",

  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },

  "economic_news":
    "NON_DISPONIBLE",

  "risk_warning": ""
}

Retourne uniquement du JSON.
`;
}


/* ============================================================
   CRYPTO / INDICES / AUTRES
   ============================================================ */

function buildSimplePriceActionPrompt(
    asset,
    timeframe,
    marketType,
    userPrompt
) {

    return `${baseRules()}

============================================================
ARKAS SCAN AI — PRICE ACTION
============================================================

Actif :
${asset}

Type :
${marketType}

Timeframe :
${timeframe}

Prompt :
${userPrompt || "Aucun"}

Analyse :

- tendance
- structure
- support
- résistance
- breakout
- retest
- liquidité
- Price Action
- SMC si visible

Ne jamais inventer les niveaux.

Si aucune entrée fiable :
WAIT.

============================================================
JSON
============================================================

{
  "asset": "",
  "timeframe": "",
  "market_type": "${marketType}",
  "strategy_applied": "PRICE_ACTION",

  "signal":
    "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",

  "direction":
    "BUY|SELL|WAIT",

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

  "zones": [],

  "reason": "",
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",

  "risk_management": {
    "risk_percent": "1%",
    "recommendation": ""
  },

  "economic_news":
    "NON_DISPONIBLE",

  "risk_warning": ""
}

Retourne uniquement du JSON valide.
`;
}


/* ============================================================
   JSON SAFE PARSER
   ============================================================ */

function parseJsonSafely(text) {

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {}

    let cleaned =
        String(text)
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

    try {
        return JSON.parse(cleaned);
    } catch {}

    const first =
        cleaned.indexOf("{");

    const last =
        cleaned.lastIndexOf("}");

    if (
        first !== -1 &&
        last !== -1 &&
        last > first
    ) {

        try {
            return JSON.parse(
                cleaned.slice(
                    first,
                    last + 1
                )
            );
        } catch {}
    }

    return null;
}


/* ============================================================
   NORMALISATION PRINCIPALE
   ============================================================ */

function normalizeResult(
    data,
    asset,
    timeframe,
    mode
) {

    const signal =
        normalizeSignal(
            data.signal
        );

    const direction =
        normalizeDirection(
            data.direction,
            signal
        );

    const result = {

        asset:
            cleanText(
                data.asset,
                asset
            ),

        timeframe:
            cleanText(
                data.timeframe,
                timeframe
            ),

        market_type:
            cleanText(
                data.market_type,
                "UNKNOWN"
            ),

        strategy_applied:
            cleanText(
                data.strategy_applied,
                "SMC"
            ),

        signal,

        direction,

        confidence_percent:
            clamp(
                normalizeNumber(
                    data.confidence_percent
                ),
                0,
                100
            ),

        entry:
            normalizeNumber(
                data.entry
            ),

        sl:
            normalizeNumber(
                data.sl
            ),

        tp1:
            normalizeNumber(
                data.tp1
            ),

        tp2:
            normalizeNumber(
                data.tp2
            ),

        tp3:
            normalizeNumber(
                data.tp3
            ),

        rr:
            normalizeNumber(
                data.rr
            ),

        arkas_score:
            clamp(
                normalizeNumber(
                    data.arkas_score
                ),
                0,
                100
            ),

        structure:
            cleanText(
                data.structure,
                ""
            ),

        liquidity:
            cleanText(
                data.liquidity,
                ""
            ),

        order_block:
            cleanText(
                data.order_block,
                ""
            ),

        fvg:
            cleanText(
                data.fvg,
                ""
            ),

        price_action:
            cleanText(
                data.price_action,
                ""
            ),

        timeframes_analyzed:
            Array.isArray(
                data.timeframes_analyzed
            )
                ? data.timeframes_analyzed
                : [],

        tf_analysis:
            Array.isArray(
                data.tf_analysis
            )
                ? data.tf_analysis
                : [],

        confluence_status:
            cleanText(
                data.confluence_status,
                null
            ),

        zones:
            normalizeZones(
                data.zones
            ),

        primary_scenario:
            cleanText(
                data.primary_scenario,
                ""
            ),

        alternative_scenario:
            cleanText(
                data.alternative_scenario,
                ""
            ),

        invalidation:
            cleanText(
                data.invalidation,
                ""
            ),

        risk_management:
            data.risk_management &&
            typeof data.risk_management === "object"
                ? data.risk_management
                : {},

        economic_news:
            "NON_DISPONIBLE",

        reason:
            cleanText(
                data.reason,
                ""
            ),

        risk_warning:
            cleanText(
                data.risk_warning,
                ""
            ),

        trade_valid:
            false
    };

    if (mode === "audit") {

        result.audit =
            normalizeAudit(
                data.audit
            );
    }

    return result;
}


/* ============================================================
   ZONES
   ============================================================ */

function normalizeZones(zones) {

    if (!Array.isArray(zones)) {
        return [];
    }

    return zones
        .slice(0, 4)
        .map((z, i) => {

            const zone = {

                id:
                    cleanText(
                        z?.id,
                        String.fromCharCode(
                            65 + i
                        )
                    ),

                type:
                    normalizeSignal(
                        z?.type
                    ),

                zone_label:
                    cleanText(
                        z?.zone_label,
                        ""
                    ),

                zone_price:
                    cleanText(
                        z?.zone_price,
                        ""
                    ),

                entry:
                    normalizeNumber(
                        z?.entry
                    ),

                sl:
                    normalizeNumber(
                        z?.sl
                    ),

                tp1:
                    normalizeNumber(
                        z?.tp1
                    ),

                tp2:
                    normalizeNumber(
                        z?.tp2
                    ),

                tp3:
                    normalizeNumber(
                        z?.tp3
                    ),

                rr:
                    normalizeNumber(
                        z?.rr
                    ),

                priority:
                    normalizeNumber(
                        z?.priority
                    ) || i + 1,

                valid:
                    false
            };

            return zone;
        });
}


/* ============================================================
   VALIDATION ZONE
   ============================================================ */

function normalizeAndValidateZone(zone) {

    const direction =
        inferDirection(
            zone.type
        );

    if (
        zone.type === "WAIT"
    ) {
        zone.valid = true;
        return zone;
    }

    zone.valid =
        validateLevelsObject(
            direction,
            zone
        );

    if (!zone.valid) {

        zone.type = "WAIT";

        zone.zone_label =
            zone.zone_label ||
            "Zone invalide ou incohérente";
    }

    return zone;
}


/* ============================================================
   VALIDATION TRADE PRINCIPAL
   ============================================================ */

function validateTradeLevels(result) {

    const direction =
        String(
            result.direction || ""
        ).toUpperCase();

    if (
        direction === "WAIT" ||
        result.signal === "WAIT"
    ) {

        result.trade_valid = true;

        return true;
    }

    result.trade_valid =
        validateLevelsObject(
            direction,
            result
        );

    return result.trade_valid;
}


/* ============================================================
   VALIDATION DES CINQ NIVEAUX
   ============================================================ */

function validateLevelsObject(
    direction,
    data
) {

    const {
        entry,
        sl,
        tp1,
        tp2,
        tp3
    } = data;

    if (
        !isFiniteNumber(entry) ||
        !isFiniteNumber(sl) ||
        !isFiniteNumber(tp1) ||
        !isFiniteNumber(tp2) ||
        !isFiniteNumber(tp3)
    ) {
        return false;
    }

    if (direction === "BUY") {

        return (
            sl < entry &&
            entry < tp1 &&
            tp1 < tp2 &&
            tp2 < tp3
        );
    }

    if (direction === "SELL") {

        return (
            tp3 < tp2 &&
            tp2 < tp1 &&
            tp1 < entry &&
            entry < sl
        );
    }

    return false;
}


/* ============================================================
   SAFETY FILTER
   ============================================================ */

function applySafetyFilter(result) {

    if (
        result.signal === "WAIT"
    ) {

        result.direction = "WAIT";
        result.trade_valid = true;

        return;
    }

    // Si les niveaux sont incohérents,
    // ARKAS transforme le signal en WAIT.

    if (
        result.trade_valid !== true
    ) {

        result.signal = "WAIT";
        result.direction = "WAIT";
        result.trade_valid = true;

        result.risk_warning =
            appendWarning(
                result.risk_warning,
                "Niveaux de trade incohérents ou insuffisants : signal transformé en WAIT."
            );

        return;
    }

    // Score faible = prudence.
    // Ce n'est pas une probabilité de réussite.
    if (
        result.arkas_score > 0 &&
        result.arkas_score < 50
    ) {

        result.signal = "WAIT";
        result.direction = "WAIT";

        result.risk_warning =
            appendWarning(
                result.risk_warning,
                "Score ARKAS inférieur au seuil de validation."
            );
    }

    // Pas de prix d'entrée = pas de trade.
    if (
        !isFiniteNumber(
            result.entry
        )
    ) {

        result.signal = "WAIT";
        result.direction = "WAIT";

        result.risk_warning =
            appendWarning(
                result.risk_warning,
                "Prix d'entrée non suffisamment identifiable."
            );
    }
}


/* ============================================================
   SIGNAL NORMALIZER
   ============================================================ */

function normalizeSignal(signal) {

    const s =
        String(
            signal || ""
        )
            .trim()
            .toUpperCase()
            .replace(/\s+/g, " ");

    if (
        s.includes("BUY NOW")
    ) {
        return "BUY NOW";
    }

    if (
        s.includes("SELL NOW")
    ) {
        return "SELL NOW";
    }

    if (
        s.includes("BUY LIMIT")
    ) {
        return "BUY LIMIT";
    }

    if (
        s.includes("SELL LIMIT")
    ) {
        return "SELL LIMIT";
    }

    if (
        s === "BUY"
    ) {
        return "BUY NOW";
    }

    if (
        s === "SELL"
    ) {
        return "SELL NOW";
    }

    return "WAIT";
}


/* ============================================================
   DIRECTION
   ============================================================ */

function normalizeDirection(
    direction,
    signal
) {

    const d =
        String(
            direction || ""
        )
            .toUpperCase()
            .trim();

    if (
        d === "BUY"
    ) {
        return "BUY";
    }

    if (
        d === "SELL"
    ) {
        return "SELL";
    }

    return inferDirection(
        signal
    );
}


/* ============================================================
   INFER DIRECTION
   ============================================================ */

function inferDirection(signal) {

    const v =
        String(
            signal || ""
        ).toUpperCase();

    if (
        v.includes("BUY")
    ) {
        return "BUY";
    }

    if (
        v.includes("SELL")
    ) {
        return "SELL";
    }

    return "WAIT";
}


/* ============================================================
   ACTION FINALE
   ============================================================ */

function normalizeAction(
    signal,
    direction
) {

    const s =
        normalizeSignal(
            signal
        );

    const d =
        String(
            direction || ""
        ).toUpperCase();

    if (
        s !== "WAIT" &&
        (
            d === "BUY" ||
            d === "SELL"
        )
    ) {
        return s;
    }

    return "WAIT";
}


/* ============================================================
   ACTION LABEL
   ============================================================ */

function buildActionLabel(result) {

    if (
        result.signal === "WAIT"
    ) {
        return "WAIT";
    }

    if (
        result.signal === "BUY NOW"
    ) {

        if (
            isFiniteNumber(
                result.entry
            )
        ) {
            return `BUY NOW @ ${formatPrice(result.entry)}`;
        }

        return "BUY NOW";
    }

    if (
        result.signal === "SELL NOW"
    ) {

        if (
            isFiniteNumber(
                result.entry
            )
        ) {
            return `SELL NOW @ ${formatPrice(result.entry)}`;
        }

        return "SELL NOW";
    }

    if (
        result.signal === "BUY LIMIT"
    ) {

        if (
            isFiniteNumber(
                result.entry
            )
        ) {
            return `BUY LIMIT @ ${formatPrice(result.entry)}`;
        }

        return "BUY LIMIT";
    }

    if (
        result.signal === "SELL LIMIT"
    ) {

        if (
            isFiniteNumber(
                result.entry
            )
        ) {
            return `SELL LIMIT @ ${formatPrice(result.entry)}`;
        }

        return "SELL LIMIT";
    }

    return "WAIT";
}


/* ============================================================
   AUDIT NORMALIZER
   ============================================================ */

function normalizeAudit(
    audit
) {

    audit =
        audit &&
        typeof audit === "object"
            ? audit
            : {};

    const corrected =
        audit.corrected_trade &&
        typeof audit.corrected_trade === "object"
            ? audit.corrected_trade
            : {};

    const correctedSignal =
        normalizeSignal(
            corrected.signal
        );

    const correctedDirection =
        inferDirection(
            correctedSignal
        );

    const correctedTrade = {

        signal:
            correctedSignal,

        entry:
            normalizeNumber(
                corrected.entry
            ),

        sl:
            normalizeNumber(
                corrected.sl
            ),

        tp1:
            normalizeNumber(
                corrected.tp1
            ),

        tp2:
            normalizeNumber(
                corrected.tp2
            ),

        tp3:
            normalizeNumber(
                corrected.tp3
            ),

        rr:
            normalizeNumber(
                corrected.rr
            ),

        validation_confidence:
            clamp(
                normalizeNumber(
                    corrected.validation_confidence ??
                    corrected.validation_probability
                ),
                0,
                100
            ),

        valid:
            false
    };

    if (
        correctedSignal === "WAIT"
    ) {

        correctedTrade.valid = true;

    } else {

        correctedTrade.valid =
            validateLevelsObject(
                correctedDirection,
                correctedTrade
            );

        if (
            !correctedTrade.valid
        ) {

            correctedTrade.signal =
                "WAIT";
        }
    }

    return {

        status:
            normalizeAuditStatus(
                audit.status
            ),

        verdict:
            cleanText(
                audit.verdict,
                ""
            ),

        strengths:
            normalizeStringArray(
                audit.strengths
            ),

        errors:
            normalizeStringArray(
                audit.errors
            ),

        corrections:
            normalizeStringArray(
                audit.corrections
            ),

        corrected_trade:
            correctedTrade
    };
}


/* ============================================================
   AUDIT STATUS
   ============================================================ */

function normalizeAuditStatus(
    status
) {

    const allowed = [
        "VALIDATED",
        "CORRECT",
        "PREMATURE",
        "INVALID",
        "UNCLEAR"
    ];

    const s =
        String(
            status || ""
        )
            .toUpperCase()
            .trim();

    return allowed.includes(s)
        ? s
        : "UNCLEAR";
}


/* ============================================================
   RISK MANAGEMENT
   ============================================================ */

function normalizeRiskManagement(
    risk
) {

    if (
        !risk ||
        typeof risk !== "object"
    ) {

        return {
            risk_percent: "1%",
            recommendation:
                "Risque à adapter au capital et à la taille du compte."
        };
    }

    return {

        risk_percent:
            cleanText(
                risk.risk_percent,
                "1%"
            ),

        recommendation:
            cleanText(
                risk.recommendation,
                "Utiliser une taille de position adaptée au risque accepté."
            )
    };
}


/* ============================================================
   NUMBER NORMALIZER
   ============================================================ */

function normalizeNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? value
            : null;
    }

    const text =
        String(value)
            .trim()
            .replace(/\s/g, "")
            .replace(",", ".");

    // Accepte uniquement une vraie représentation numérique.
    if (
        !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)
    ) {
        return null;
    }

    const number =
        Number(text);

    return Number.isFinite(number)
        ? number
        : null;
}


/* ============================================================
   NUMBER TEST
   ============================================================ */

function isFiniteNumber(value) {

    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );
}


/* ============================================================
   CLAMP
   ============================================================ */

function clamp(
    value,
    min,
    max
) {

    if (
        !isFiniteNumber(value)
    ) {
        return 0;
    }

    return Math.min(
        Math.max(
            value,
            min
        ),
        max
    );
}


/* ============================================================
   TEXT CLEANER
   ============================================================ */

function cleanText(
    value,
    fallback = ""
) {

    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    const text =
        String(value)
            .trim();

    return text || fallback;
}


/* ============================================================
   STRING ARRAY
   ============================================================ */

function normalizeStringArray(
    value
) {

    if (
        !Array.isArray(value)
    ) {
        return [];
    }

    return value
        .map(
            item =>
                String(item || "").trim()
        )
        .filter(Boolean)
        .slice(0, 20);
}


/* ============================================================
   MIME TYPE
   ============================================================ */

function normalizeMimeType(
    mime
) {

    const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const value =
        String(
            mime || ""
        )
            .toLowerCase()
            .trim();

    return allowed.includes(value)
        ? value
        : "image/jpeg";
}


/* ============================================================
   FORMAT PRICE
   ============================================================ */

function formatPrice(
    value
) {

    if (
        !isFiniteNumber(value)
    ) {
        return "";
    }

    return String(
        Number(
            value.toFixed(8)
        )
    );
}


/* ============================================================
   WARNING
   ============================================================ */

function appendWarning(
    current,
    message
) {

    const old =
        String(
            current || ""
        ).trim();

    if (!old) {
        return message;
    }

    if (
        old.includes(message)
    ) {
        return old;
    }

    return `${old} ${message}`;
}


/* ============================================================
   GEMINI ERROR
   ============================================================ */

function safeGeminiError(
    text
) {

    try {

        const parsed =
            JSON.parse(text);

        return (
            parsed?.error?.message ||
            "Erreur Gemini."
        );

    } catch {

        return "Erreur Gemini.";
    }
}
