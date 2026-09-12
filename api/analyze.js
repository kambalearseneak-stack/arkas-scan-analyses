// ============================================================
// ARKAS SCAN AI V2
// api/analyze.js
// Gemini Vision backend
// ============================================================

export default async function handler(req, res) {

    // ========================================================
    // CORS
    // ========================================================

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    // Préflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Seulement POST
    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Méthode non autorisée. Utilisez POST."
        });

    }

    try {

        // ====================================================
        // API KEY
        // ====================================================

        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {

            return res.status(500).json({
                error:
                    "GEMINI_API_KEY est absente des variables d'environnement Vercel."
            });

        }

        // ====================================================
        // BODY
        // ====================================================

        const body =
            req.body || {};

        const imageBase64 =
            body.imageBase64;

        const mimeType =
            body.mimeType || "image/jpeg";

        const mode =
            body.mode === "audit"
                ? "audit"
                : "scan";

        const asset =
            body.asset || "AUTO";

        const timeframe =
            body.timeframe || "AUTO";

        const userPrompt =
            body.prompt || "";

        // ====================================================
        // VALIDATION IMAGE
        // ====================================================

        if (!imageBase64) {

            return res.status(400).json({
                error:
                    "Aucune image n'a été envoyée."
            });

        }

        const allowedMimeTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (
            !allowedMimeTypes.includes(
                mimeType
            )
        ) {

            return res.status(400).json({
                error:
                    "Format d'image non supporté. Utilisez JPG, PNG ou WebP."
            });

        }

        // Protection taille
        if (
            imageBase64.length >
            12000000
        ) {

            return res.status(413).json({
                error:
                    "Image trop volumineuse pour l'analyse."
            });

        }

        // ====================================================
        // PROMPT SCAN
        // ====================================================

        const scanPrompt = `

Tu es ARKAS SCAN AI V2,
un système expert d'analyse technique de graphiques.

Tu analyses UNIQUEMENT les informations réellement
visibles dans l'image.

MARCHÉ DEMANDÉ :
${asset}

TIMEFRAME DEMANDÉ :
${timeframe}

============================================================
OBJECTIF
============================================================

Analyse le graphique avec une approche principalement :

- Price Action
- Smart Money Concepts
- Market Structure
- BOS
- CHoCH
- Liquidity
- Order Block
- Fair Value Gap
- Support / Resistance
- Breakout
- Retest
- Momentum

Ne considère jamais une information comme certaine
si elle n'est pas suffisamment visible.

============================================================
SIGNAL
============================================================

Tu peux retourner exactement l'un des signaux :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

Règles :

BUY NOW :
entrée exploitable immédiatement avec confirmation suffisante.

SELL NOW :
vente exploitable immédiatement avec confirmation suffisante.

BUY LIMIT :
attente d'un retour sur une zone d'achat précise.

SELL LIMIT :
attente d'un retour sur une zone de vente précise.

WAIT :
structure trop incertaine, entrée prématurée ou absence
de configuration suffisamment claire.

Ne force jamais un BUY ou SELL.

============================================================
NIVEAUX
============================================================

Si une configuration est suffisamment claire,
fournis :

Entry
SL
TP1
TP2
TP3
RR

Les niveaux doivent respecter :

BUY :
SL < Entry < TP1 < TP2 < TP3

SELL :
TP3 < TP2 < TP1 < Entry < SL

Si TP3 n'est pas suffisamment déterminable,
retourne null.

Si les prix ne peuvent pas être lus correctement,
retourne null plutôt que d'inventer.

============================================================
STRUCTURE
============================================================

Détermine si possible :

- tendance haussière
- tendance baissière
- range
- BOS haussier
- BOS baissier
- CHoCH haussier
- CHoCH baissier
- structure incertaine

============================================================
LIQUIDITÉ
============================================================

Recherche notamment :

- equal highs
- equal lows
- buy-side liquidity
- sell-side liquidity
- liquidity sweep
- stop hunt potentiel

============================================================
ORDER BLOCK
============================================================

Détermine si un Order Block est visible.

Indique :

- bullish
- bearish
- zone
- rôle potentiel

Si aucun OB fiable n'est visible :
"Non identifié"

============================================================
FVG
============================================================

Détermine si un Fair Value Gap est visible.

Si aucun FVG fiable n'est visible :
"Non identifié"

============================================================
SCÉNARIOS
============================================================

Donne :

1. scénario principal
2. scénario alternatif
3. condition de confirmation
4. condition d'invalidation

Utilise une logique :

SI...
ALORS...

============================================================
CONFIANCE
============================================================

Donne confidence_percent entre 0 et 100.

Ce pourcentage représente la confiance
dans la qualité de la configuration,
pas la probabilité garantie de gagner le trade.

============================================================
SCORE ARKAS
============================================================

Donne arkas_score entre 0 et 100.

Répartition indicative :

structure : /20
liquidité : /15
OB : /15
FVG : /10
price_action : /20
confirmation : /20

============================================================
ACTUALITÉ
============================================================

Tu n'as PAS accès automatiquement aux actualités
économiques en temps réel.

N'invente donc jamais une actualité.

Si aucune actualité vérifiée n'est disponible :
"Non disponible — vérifier le calendrier économique."

============================================================
GESTION DU RISQUE
============================================================

Donne des recommandations générales :

- risque recommandé
- rapport risque/rendement
- prudence
- taille de position si calculable

Ne présente jamais le résultat comme une garantie
de profit.

============================================================
FORMAT DE RÉPONSE
============================================================

Réponds UNIQUEMENT avec un JSON valide.

Aucun Markdown.
Aucun texte avant ou après le JSON.

Structure obligatoire :

{
  "asset": "",
  "timeframe": "",
  "signal": "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",
  "direction": "BUY|SELL|WAIT|UNKNOWN",
  "execution": "",
  "market_bias": "",
  "trade_valid": true,
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
  "score_breakdown": {
    "structure": 0,
    "liquidity": 0,
    "order_block": 0,
    "fvg": 0,
    "price_action": 0,
    "confirmation": 0
  },
  "risk_management": {
    "risk_percent": "",
    "position_size": "",
    "recommendation": ""
  },
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "economic_news": "",
  "reason": "",
  "risk_warning": ""
}

============================================================
PROMPT UTILISATEUR
============================================================

${userPrompt}

`;


        // ====================================================
        // PROMPT AUDIT
        // ====================================================

        const auditPrompt = `

Tu es ARKAS SCAN AI V2 en MODE AUDIT.

Le graphique peut contenir une analyse déjà réalisée
par l'utilisateur.

IMPORTANT :

Tu dois distinguer :

1. ce qui est réellement visible sur l'image
2. ce que l'utilisateur semble avoir conclu
3. ta propre analyse indépendante
4. le verdict final

Ne considère JAMAIS une annotation comme correcte
simplement parce qu'elle apparaît sur le graphique.

============================================================
ÉTAPE 1 — LIRE L'ANALYSE UTILISATEUR
============================================================

Cherche visuellement :

- BUY
- SELL
- WAIT
- Entry
- SL
- TP
- flèches
- lignes
- supports
- résistances
- Order Blocks
- FVG
- zones
- texte
- indicateurs
- niveaux de prix

Si une annotation n'est pas lisible,
retourne null ou "Non lisible".

============================================================
ÉTAPE 2 — ANALYSE INDÉPENDANTE
============================================================

Fais ensuite ta propre analyse :

- Market Structure
- BOS
- CHoCH
- Liquidity
- Order Block
- FVG
- Price Action
- Breakout
- Retest
- Momentum

============================================================
ÉTAPE 3 — COMPARAISON
============================================================

Compare l'analyse utilisateur
avec ton analyse indépendante.

Tu dois pouvoir dire :

VALIDATED :
analyse cohérente et suffisamment confirmée.

CORRECT :
analyse globalement correcte.

PREMATURE :
direction/scénario cohérent mais entrée trop précoce.

INVALID :
analyse contradictoire avec la structure visible.

UNCLEAR :
image insuffisante pour conclure.

============================================================
ÉTAPE 4 — CORRECTION
============================================================

Si l'analyse est incorrecte ou prématurée :

explique clairement :

- ce qui est correct
- ce qui est incorrect
- pourquoi
- quelle correction est préférable

Si nécessaire, propose :

Entry
SL
TP1
TP2
TP3
RR

Ne fabrique jamais un prix qui n'est pas
raisonnablement lisible sur le graphique.

============================================================
SIGNAL FINAL
============================================================

Le signal final doit être celui que tu juges
le plus défendable après ton audit.

Il peut être :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

============================================================
ACTUALITÉ
============================================================

Ne fabrique aucune actualité économique en temps réel.

Si elle n'est pas disponible :

"Non disponible — vérifier le calendrier économique."

============================================================
FORMAT
============================================================

Réponds UNIQUEMENT avec un JSON valide.

Aucun Markdown.
Aucun texte avant ou après.

Structure :

{
  "asset": "",
  "timeframe": "",
  "signal": "",
  "direction": "",
  "execution": "",
  "market_bias": "",
  "trade_valid": true,
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
  "score_breakdown": {
    "structure": 0,
    "liquidity": 0,
    "order_block": 0,
    "fvg": 0,
    "price_action": 0,
    "confirmation": 0
  },
  "risk_management": {
    "risk_percent": "",
    "position_size": "",
    "recommendation": ""
  },
  "primary_scenario": "",
  "alternative_scenario": "",
  "invalidation": "",
  "economic_news": "",
  "reason": "",
  "risk_warning": "",

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
      "signal": "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",
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
PARAMÈTRES
============================================================

Marché :
${asset}

Timeframe :
${timeframe}

Prompt :
${userPrompt}

`;


        // ====================================================
        // CHOIX PROMPT
        // ====================================================

        const finalPrompt =
            mode === "audit"
                ? auditPrompt
                : scanPrompt;


        // ====================================================
        // GEMINI
        // ====================================================

        const model =
            "gemini-3.6-flash";

        const endpoint =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;


        const geminiResponse =
            await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-goog-api-key":
                            apiKey
                    },

                    body: JSON.stringify({

                        contents: [

                            {
                                role: "user",

                                parts: [

                                    {
                                        text:
                                            finalPrompt
                                    },

                                    {
                                        inline_data: {
                                            mime_type:
                                                mimeType,

                                            data:
                                                imageBase64
                                        }
                                    }

                                ]

                            }

                        ],

                        generationConfig: {

                            temperature: 0.15,

                            responseMimeType:
                                "application/json"

                        }

                    })

                }
            );


        // ====================================================
        // ERREUR GEMINI
        // ====================================================

        if (
            !geminiResponse.ok
        ) {

            const errorText =
                await geminiResponse.text();

            console.error(
                "Gemini error:",
                errorText
            );

            return res.status(
                geminiResponse.status
            ).json({

                error:
                    "Gemini a refusé ou n'a pas pu traiter la demande.",

                details:
                    safeGeminiError(
                        errorText
                    )

            });

        }


        // ====================================================
        // RÉCUPÉRATION RÉPONSE
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
                    "Gemini n'a retourné aucun résultat exploitable."
            });

        }


        // ====================================================
        // PARSING JSON
        // ====================================================

        const parsed =
            parseJsonSafely(
                rawText
            );


        if (!parsed) {

            console.error(
                "Gemini JSON invalide:",
                rawText
            );

            return res.status(502).json({
                error:
                    "Gemini a retourné un résultat JSON invalide."
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
        // VALIDATION DES NIVEAUX
        // ====================================================

        validateTradeLevels(
            result
        );


        // ====================================================
        // RÉPONSE
        // ====================================================

        return res.status(200).json(
            result
        );


    } catch (error) {

        console.error(
            "ARKAS API ERROR:",
            error
        );

        return res.status(500).json({

            error:
                error.message ||
                "Erreur interne du serveur."

        });

    }

}


// ============================================================
// PARSING JSON ROBUSTE
// ============================================================

function parseJsonSafely(text) {

    if (!text) {
        return null;
    }

    // Premier essai
    try {

        return JSON.parse(
            text
        );

    } catch {}

    // Nettoyage éventuel Markdown
    let cleaned =
        text
            .replace(
                /^```json\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();

    try {

        return JSON.parse(
            cleaned
        );

    } catch {}

    // Chercher le premier objet JSON
    const first =
        cleaned.indexOf("{");

    const last =
        cleaned.lastIndexOf("}");

    if (
        first !== -1 &&
        last !== -1 &&
        last > first
    ) {

        const possibleJson =
            cleaned.slice(
                first,
                last + 1
            );

        try {

            return JSON.parse(
                possibleJson
            );

        } catch {}

    }

    return null;

}


// ============================================================
// NORMALISATION
// ============================================================

function normalizeResult(
    data,
    asset,
    timeframe,
    mode
) {

    const result = {

        asset:
            data.asset ||
            asset,

        timeframe:
            data.timeframe ||
            timeframe,

        signal:
            data.signal ||
            "WAIT",

        direction:
            data.direction ||
            inferDirection(
                data.signal
            ),

        execution:
            data.execution ||
            "",

        market_bias:
            data.market_bias ||
            "",

        trade_valid:
            data.trade_valid !== false,

        confidence_percent:
            normalizeNumber(
                data.confidence_percent
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
            normalizeNumber(
                data.arkas_score
            ),

        structure:
            data.structure ||
            "",

        liquidity:
            data.liquidity ||
            "",

        order_block:
            data.order_block ||
            "",

        fvg:
            data.fvg ||
            "",

        price_action:
            data.price_action ||
            "",

        score_breakdown:
            data.score_breakdown ||
            {},

        risk_management:
            data.risk_management ||
            {},

        primary_scenario:
            data.primary_scenario ||
            "",

        alternative_scenario:
            data.alternative_scenario ||
            "",

        invalidation:
            data.invalidation ||
            "",

        economic_news:
            data.economic_news ||
            "Non disponible — vérifier le calendrier économique.",

        reason:
            data.reason ||
            "",

        risk_warning:
            data.risk_warning ||
            "L'analyse technique ne garantit pas un résultat de trading."

    };


    // Audit
    if (
        mode === "audit"
    ) {

        result.audit =
            normalizeAudit(
                data.audit
            );

    }


    // Limites
    result.confidence_percent =
        clamp(
            result.confidence_percent,
            0,
            100
        );

    result.arkas_score =
        clamp(
            result.arkas_score,
            0,
            100
        );


    return result;

}


// ============================================================
// AUDIT
// ============================================================

function normalizeAudit(
    audit
) {

    audit =
        audit || {};

    const detected =
        audit.detected_user_analysis ||
        {};

    const corrected =
        audit.corrected_trade ||
        {};

    return {

        status:
            normalizeAuditStatus(
                audit.status
            ),

        detected_user_analysis: {

            direction:
                detected.direction ||
                "UNKNOWN",

            entry:
                normalizeNumber(
                    detected.entry
                ),

            sl:
                normalizeNumber(
                    detected.sl
                ),

            tp1:
                normalizeNumber(
                    detected.tp1
                ),

            tp2:
                normalizeNumber(
                    detected.tp2
                ),

            tp3:
                normalizeNumber(
                    detected.tp3
                ),

            annotations:
                Array.isArray(
                    detected.annotations
                )
                    ? detected.annotations
                    : [],

            claimed_setup:
                detected.claimed_setup ||
                ""

        },

        verdict:
            audit.verdict ||
            "",

        strengths:
            Array.isArray(
                audit.strengths
            )
                ? audit.strengths
                : [],

        errors:
            Array.isArray(
                audit.errors
            )
                ? audit.errors
                : [],

        corrections:
            Array.isArray(
                audit.corrections
            )
                ? audit.corrections
                : [],

        corrected_trade: {

            signal:
                corrected.signal ||
                "WAIT",

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
                )

        }

    };

}


// ============================================================
// VALIDATION TRADE
// ============================================================

function validateTradeLevels(
    result
) {

    const direction =
        String(
            result.direction || ""
        ).toUpperCase();

    const entry =
        result.entry;

    const sl =
        result.sl;

    const tp1 =
        result.tp1;

    const tp2 =
        result.tp2;

    const tp3 =
        result.tp3;


    // WAIT ne nécessite pas de niveaux
    if (
        direction === "WAIT" ||
        result.signal === "WAIT"
    ) {

        result.trade_valid = true;

        return;

    }


    // Si niveaux incomplets
    if (
        !isFiniteNumber(entry) ||
        !isFiniteNumber(sl) ||
        !isFiniteNumber(tp1) ||
        !isFiniteNumber(tp2)
    ) {

        result.trade_valid = false;

        return;

    }


    // BUY
    if (
        direction === "BUY"
    ) {

        const valid =
            sl < entry &&
            entry < tp1 &&
            tp1 < tp2 &&
            (
                tp3 === null ||
                tp3 > tp2
            );

        if (!valid) {

            result.trade_valid = false;

            result.risk_warning =
                "Les niveaux BUY fournis ne respectent pas une structure Entry/SL/TP valide.";

        }

        return;

    }


    // SELL
    if (
        direction === "SELL"
    ) {

        const valid =
            tp2 < tp1 &&
            tp1 < entry &&
            sl > entry &&
            (
                tp3 === null ||
                tp3 < tp2
            );

        if (!valid) {

            result.trade_valid = false;

            result.risk_warning =
                "Les niveaux SELL fournis ne respectent pas une structure Entry/SL/TP valide.";

        }

        return;

    }

}


// ============================================================
// DIRECTION
// ============================================================

function inferDirection(
    signal
) {

    const value =
        String(
            signal || ""
        ).toUpperCase();

    if (
        value.includes("BUY")
    ) {

        return "BUY";

    }

    if (
        value.includes("SELL")
    ) {

        return "SELL";

    }

    return "WAIT";

}


// ============================================================
// AUDIT STATUS
// ============================================================

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

    const value =
        String(
            status || "UNCLEAR"
        ).toUpperCase();

    return allowed.includes(
        value
    )
        ? value
        : "UNCLEAR";

}


// ============================================================
// NUMBER
// ============================================================

function normalizeNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {

        return value;

    }

    const normalized =
        Number(
            String(value)
                .replace(
                    ",",
                    "."
                )
                .replace(
                    /[^0-9eE.+-]/g,
                    ""
                )
        );

    return Number.isFinite(
        normalized
    )
        ? normalized
        : null;

}


// ============================================================
// NUMBER CHECK
// ============================================================

function isFiniteNumber(
    value
) {

    return (
        typeof value === "number" &&
        Number.isFinite(value)
    );

}


// ============================================================
// CLAMP
// ============================================================

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


// ============================================================
// GEMINI ERROR SAFE
// ============================================================

function safeGeminiError(
    text
) {

    try {

        const parsed =
            JSON.parse(
                text
            );

        return (
            parsed?.error?.message ||
            "Erreur Gemini."
        );

    } catch {

        return "Erreur Gemini.";

    }

}
