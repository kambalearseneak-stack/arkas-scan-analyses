// ============================================================
// ARKAS SCAN AI V2
// API GEMINI - V2.1
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
        "Content-Type, Authorization"
    );

    // Préflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Seulement POST
    if (req.method !== "POST") {

        return res.status(405).json({
            success: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Méthode non autorisée. Utilise POST."
        });
    }

    try {

        // ====================================================
        // API KEY
        // ====================================================

        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {

            console.error(
                "❌ GEMINI_API_KEY absente"
            );

            return res.status(500).json({
                success: false,
                error: "GEMINI_KEY_MISSING",
                message:
                    "La clé GEMINI_API_KEY n'est pas configurée sur Vercel."
            });
        }

        // ====================================================
        // BODY
        // ====================================================

        const body =
            req.body || {};

        const mode =
            String(
                body.mode || "scan"
            )
            .toLowerCase()
            .trim();

        const asset =
            String(
                body.asset || "UNKNOWN"
            )
            .trim();

        const timeframe =
            String(
                body.timeframe || "UNKNOWN"
            )
            .trim();

        const userPrompt =
            String(
                body.prompt || ""
            )
            .trim();

        // ====================================================
        // RÉCUPÉRATION DES IMAGES
        // ====================================================

        let images = [];

        // Format recommandé :
        // images: [{ imageBase64, mimeType }]

        if (Array.isArray(body.images)) {

            images =
                body.images
                    .filter(item =>
                        item &&
                        item.imageBase64
                    )
                    .map(item => ({
                        imageBase64:
                            cleanBase64(
                                item.imageBase64
                            ),

                        mimeType:
                            normalizeMimeType(
                                item.mimeType
                            )
                    }));
        }

        // Compatibilité ancien frontend
        if (
            images.length === 0 &&
            body.imageBase64
        ) {

            images = [
                {
                    imageBase64:
                        cleanBase64(
                            body.imageBase64
                        ),

                    mimeType:
                        normalizeMimeType(
                            body.mimeType
                        )
                }
            ];
        }

        // ====================================================
        // VALIDATION IMAGES
        // ====================================================

        if (images.length === 0) {

            return res.status(400).json({
                success: false,
                error: "IMAGE_MISSING",
                message:
                    "Aucune capture graphique n'a été reçue."
            });
        }

        if (images.length > 6) {

            return res.status(400).json({
                success: false,
                error: "TOO_MANY_IMAGES",
                message:
                    "Maximum 6 captures par analyse."
            });
        }

        // ====================================================
        // VALIDATION MIME
        // ====================================================

        const allowedMimeTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        for (const image of images) {

            if (
                !allowedMimeTypes.includes(
                    image.mimeType
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error: "INVALID_IMAGE_TYPE",
                    message:
                        `Format non supporté : ${image.mimeType}. ` +
                        "Utilise JPG, PNG ou WebP."
                });
            }

            if (
                !image.imageBase64 ||
                image.imageBase64.length < 100
            ) {

                return res.status(400).json({
                    success: false,
                    error: "INVALID_IMAGE",
                    message:
                        "Une des captures reçues est vide ou invalide."
                });
            }
        }

        // ====================================================
        // LIMITE TOTALE
        // Gemini accepte les images inline de taille limitée.
        // On garde une marge de sécurité pour la requête.
        // ====================================================

        const totalBase64Size =
            images.reduce(
                (total, image) =>
                    total +
                    image.imageBase64.length,
                0
            );

        if (
            totalBase64Size >
            18_000_000
        ) {

            return res.status(413).json({
                success: false,
                error: "IMAGE_TOO_LARGE",
                message:
                    "Les captures sont trop volumineuses. " +
                    "Réduis leur résolution ou leur taille."
            });
        }

        // ====================================================
        // CLASSIFICATION ACTIF
        // ====================================================

        const marketType =
            classifyMarket(
                asset
            );

        // ====================================================
        // PROMPT
        // ====================================================

        const prompt =
            buildPrompt({
                mode,
                asset,
                timeframe,
                marketType,
                userPrompt,
                imageCount:
                    images.length
            });

        // ====================================================
        // CONSTRUCTION PARTS GEMINI
        // ====================================================

        const parts = [];

        // Texte d'abord
        parts.push({
            text: prompt
        });

        // Images
        for (
            const image of images
        ) {

            parts.push({
                inlineData: {
                    mimeType:
                        image.mimeType,

                    data:
                        image.imageBase64
                }
            });
        }

        // ====================================================
        // MODÈLE
        // ====================================================

        const model =
            "gemini-3.6-flash";

        const endpoint =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        // ====================================================
        // REQUÊTE GEMINI
        // ====================================================

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => controller.abort(),
                55_000
            );

        let geminiResponse;

        try {

            geminiResponse =
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

                        body:
                            JSON.stringify({

                                contents: [
                                    {
                                        role: "user",

                                        parts:
                                            parts
                                    }
                                ],

                                generationConfig: {

                                    responseMimeType:
                                        "application/json",

                                    responseSchema:
                                        buildResponseSchema(),

                                    maxOutputTokens:
                                        4000
                                },

                                safetySettings: [
                                    {
                                        category:
                                            "HARM_CATEGORY_HARASSMENT",

                                        threshold:
                                            "BLOCK_ONLY_HIGH"
                                    },

                                    {
                                        category:
                                            "HARM_CATEGORY_HATE_SPEECH",

                                        threshold:
                                            "BLOCK_ONLY_HIGH"
                                    },

                                    {
                                        category:
                                            "HARM_CATEGORY_SEXUALLY_EXPLICIT",

                                        threshold:
                                            "BLOCK_ONLY_HIGH"
                                    },

                                    {
                                        category:
                                            "HARM_CATEGORY_DANGEROUS_CONTENT",

                                        threshold:
                                            "BLOCK_ONLY_HIGH"
                                    }
                                ]
                            }),

                        signal:
                            controller.signal
                    }
                );

        } catch (error) {

            clearTimeout(
                timeout
            );

            if (
                error &&
                error.name === "AbortError"
            ) {

                return res.status(504).json({
                    success: false,
                    error: "GEMINI_TIMEOUT",
                    message:
                        "Gemini met trop longtemps à répondre. Réessaie."
                });
            }

            console.error(
                "❌ GEMINI FETCH ERROR:",
                error
            );

            return res.status(502).json({
                success: false,
                error: "GEMINI_CONNECTION_ERROR",
                message:
                    "Impossible de contacter Gemini.",
                details:
                    error?.message ||
                    "Erreur réseau"
            });
        }

        clearTimeout(
            timeout
        );

        // ====================================================
        // LECTURE RÉPONSE
        // ====================================================

        const rawText =
            await geminiResponse.text();

        let geminiData = null;

        try {

            geminiData =
                JSON.parse(
                    rawText
                );

        } catch (error) {

            console.error(
                "❌ GEMINI INVALID JSON:",
                rawText
            );

            return res.status(502).json({
                success: false,
                error: "GEMINI_INVALID_RESPONSE",
                message:
                    "Gemini a retourné une réponse illisible.",
                httpStatus:
                    geminiResponse.status
            });
        }

        // ====================================================
        // ERREUR HTTP GEMINI
        // ====================================================

        if (!geminiResponse.ok) {

            console.error(
                "❌ GEMINI HTTP ERROR:",
                geminiResponse.status,
                JSON.stringify(
                    geminiData
                )
            );

            return handleGeminiHttpError(
                res,
                geminiResponse.status,
                geminiData
            );
        }

        // ====================================================
        // PROMPT BLOQUÉ
        // ====================================================

        if (
            geminiData.promptFeedback &&
            geminiData.promptFeedback.blockReason
        ) {

            const reason =
                geminiData
                    .promptFeedback
                    .blockReason;

            const ratings =
                geminiData
                    .promptFeedback
                    .safetyRatings ||
                [];

            console.warn(
                "⚠️ GEMINI PROMPT BLOCKED:",
                reason
            );

            return res.status(400).json({

                success: false,

                error:
                    "GEMINI_PROMPT_BLOCKED",

                message:
                    "Gemini a bloqué cette demande.",

                reason:
                    reason,

                safetyRatings:
                    ratings,

                userMessage:
                    buildFriendlyBlockMessage(
                        reason
                    )
            });
        }

        // ====================================================
        // CANDIDATS
        // ====================================================

        const candidates =
            Array.isArray(
                geminiData.candidates
            )
                ? geminiData.candidates
                : [];

        if (
            candidates.length === 0
        ) {

            console.warn(
                "⚠️ GEMINI SANS CANDIDAT:",
                JSON.stringify(
                    geminiData
                )
            );

            return res.status(400).json({

                success: false,

                error:
                    "GEMINI_NO_CANDIDATE",

                message:
                    "Gemini n'a retourné aucune analyse exploitable.",

                feedback:
                    geminiData.promptFeedback ||
                    null
            });
        }

        const candidate =
            candidates[0];

        // ====================================================
        // FINISH REASON
        // ====================================================

        const finishReason =
            candidate.finishReason ||
            null;

        if (
            finishReason ===
            "SAFETY"
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "GEMINI_RESPONSE_BLOCKED",

                message:
                    "Gemini a bloqué la réponse générée.",

                reason:
                    finishReason,

                safetyRatings:
                    candidate.safetyRatings ||
                    []
            });
        }

        if (
            finishReason ===
                "PROHIBITED_CONTENT" ||
            finishReason ===
                "BLOCKLIST" ||
            finishReason ===
                "SPII"
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "GEMINI_CONTENT_BLOCKED",

                message:
                    "Gemini n'a pas pu générer cette réponse.",

                reason:
                    finishReason,

                safetyRatings:
                    candidate.safetyRatings ||
                    []
            });
        }

        // ====================================================
        // EXTRACTION DU TEXTE
        // ====================================================

        const generatedText =
            extractGeminiText(
                candidate
            );

        if (!generatedText) {

            console.warn(
                "⚠️ GEMINI EMPTY TEXT:",
                JSON.stringify(
                    candidate
                )
            );

            return res.status(400).json({

                success: false,

                error:
                    "GEMINI_EMPTY_RESPONSE",

                message:
                    "Gemini a répondu sans contenu exploitable.",

                finishReason:
                    finishReason
            });
        }

        // ====================================================
        // PARSING JSON
        // ====================================================

        let parsed;

        try {

            parsed =
                parseGeminiJSON(
                    generatedText
                );

        } catch (error) {

            console.error(
                "❌ JSON GEMINI IMPOSSIBLE:",
                generatedText
            );

            return res.status(502).json({

                success: false,

                error:
                    "INVALID_ANALYSIS_JSON",

                message:
                    "Gemini a répondu avec un format JSON invalide.",

                raw:
                    generatedText
            });
        }

        // ====================================================
        // NORMALISATION
        // ====================================================

        const result =
            normalizeResult(
                parsed,
                {
                    asset,
                    timeframe,
                    marketType,
                    mode
                }
            );

        // ====================================================
        // VALIDATION
        // ====================================================

        const validation =
            validateResult(
                result
            );

        if (
            !validation.valid
        ) {

            console.warn(
                "⚠️ ANALYSE INVALIDE:",
                validation.message,
                result
            );

            /*
             * On ne détruit pas toute la réponse.
             * On transforme simplement en WAIT.
             */

            result.action =
                "WAIT";

            result.direction =
                "WAIT";

            result.entry =
                null;

            result.sl =
                null;

            result.tp1 =
                null;

            result.tp2 =
                null;

            result.tp3 =
                null;

            result.rr =
                null;

            result.invalidation =
                validation.message;
        }

        // ====================================================
        // RÉPONSE FINALE
        // ====================================================

        return res.status(200).json({

            success: true,

            model:
                model,

            mode:
                mode,

            asset:
                asset,

            timeframe:
                timeframe,

            market_type:
                marketType,

            analysis:
                result,

            raw_finish_reason:
                finishReason
        });

    } catch (error) {

        console.error(
            "🔥 ARKAS API ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            error:
                "SERVER_ERROR",

            message:
                "Une erreur interne est survenue.",

            details:
                error?.message ||
                "Erreur inconnue"
        });
    }
}


// ============================================================
// PROMPT PRINCIPAL
// ============================================================

function buildPrompt({
    mode,
    asset,
    timeframe,
    marketType,
    userPrompt,
    imageCount
}) {

    const base = `

Tu es ARKAS SCAN AI V2, un assistant spécialisé
dans l'analyse technique de graphiques financiers.

Tu analyses une ou plusieurs captures de graphiques
fournies par l'utilisateur.

ACTIF :
${asset}

MARCHÉ :
${marketType}

TIMEFRAME FOURNI :
${timeframe}

NOMBRE DE CAPTURES :
${imageCount}

============================================================
RÈGLES ABSOLUES
============================================================

1. Analyse UNIQUEMENT ce qui est réellement visible
   sur les captures.

2. Ne fabrique jamais un prix qui n'est pas visible.

3. Ne devine pas une valeur numérique absente.

4. Si l'échelle de prix n'est pas lisible :
   utilise WAIT plutôt que d'inventer un niveau.

5. Si le timeframe n'est pas visible :
   retourne "UNKNOWN".

6. Si les informations sont insuffisantes :
   retourne WAIT.

7. Les niveaux Entry, SL et TP doivent être cohérents
   avec les prix visibles.

8. Pour BUY :
   SL < Entry < TP1 < TP2 < TP3

9. Pour SELL :
   TP3 < TP2 < TP1 < Entry < SL

10. Si TP2 ou TP3 ne sont pas clairement déterminables,
    retourne null.

11. N'utilise pas de données de marché externes.

12. N'affirme pas avoir consulté les actualités économiques
    ou les prix en direct.

13. Une capture peut être un graphique Forex, Gold,
    Crypto ou autre actif.

============================================================
ANALYSE TECHNIQUE
============================================================

Observe lorsque visible :

- tendance
- structure du marché
- HH
- HL
- LH
- LL
- BOS
- CHoCH
- liquidité
- sweep
- support
- résistance
- Order Block
- Fair Value Gap
- imbalance
- rejet
- breakout
- retest
- momentum
- zones d'entrée

============================================================
SIGNAL
============================================================

Tu dois choisir UNE seule action :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

BUY NOW :
une entrée immédiate est cohérente avec la structure visible.

SELL NOW :
une entrée immédiate à la vente est cohérente.

BUY LIMIT :
attendre un retour du prix vers un niveau d'achat.

SELL LIMIT :
attendre un retour du prix vers un niveau de vente.

WAIT :
aucune entrée suffisamment claire.

============================================================
IMPORTANT
============================================================

Si tu vois une configuration intéressante mais que
l'entrée n'est pas encore confirmée, préfère :

BUY LIMIT
ou
SELL LIMIT

plutôt que BUY NOW ou SELL NOW.

Si la configuration est contradictoire :
WAIT.

Si tu ne peux pas lire correctement les prix :
WAIT.

============================================================
FORMAT
============================================================

Réponds uniquement avec le JSON demandé.

Aucun markdown.
Aucun texte avant le JSON.
Aucun texte après le JSON.
`;

    let modeInstructions = "";

    // ========================================================
    // MODE SCAN
    // ========================================================

    if (mode === "scan") {

        modeInstructions = `

Effectue une analyse complète mais concise.

Donne :

- action
- direction
- entry
- sl
- tp1
- tp2
- tp3
- rr
- confiance
- score ARKAS
- résumé
- invalidation

Le résultat final doit être immédiatement compréhensible
par le dashboard.
`;
    }

    // ========================================================
    // MODE MULTI TIMEFRAME
    // ========================================================

    else if (
        mode === "multi-tf" ||
        mode === "multitf"
    ) {

        modeInstructions = `

Plusieurs captures peuvent représenter plusieurs
timeframes.

Détermine le timeframe seulement lorsqu'il est lisible.

Utilise les timeframes supérieurs pour le contexte
et les timeframes inférieurs pour l'entrée.

Cherche une confluence entre :

- tendance
- structure
- liquidité
- BOS
- CHoCH
- OB
- FVG
- support/résistance
- price action

Si les timeframes se contredisent fortement :
WAIT.
`;
    }

    // ========================================================
    // MODE AUDIT
    // ========================================================

    else if (
        mode === "audit"
    ) {

        modeInstructions = `

Effectue un audit du setup visible.

Vérifie :

- direction
- entrée
- SL
- TP
- structure
- invalidation
- cohérence du risque

Si le setup proposé est incorrect,
indique précisément le problème.

Ne crée pas de prix non visibles.
`;
    }

    // ========================================================
    // PROMPT UTILISATEUR
    // ========================================================

    let extra =
        "";

    if (userPrompt) {

        extra = `

============================================================
INSTRUCTION UTILISATEUR
============================================================

${userPrompt}

`;
    }

    // ========================================================
    // JSON ATTENDU
    // ========================================================

    const schemaExample = `

Le JSON doit respecter cette structure :

{
  "action": "BUY NOW",
  "direction": "BUY",
  "entry": 0,
  "sl": 0,
  "tp1": 0,
  "tp2": 0,
  "tp3": 0,
  "rr": 0,
  "confidence_percent": 0,
  "arkas_score": 0,
  "market_structure": "",
  "trend": "",
  "liquidity": "",
  "bos": "",
  "choch": "",
  "order_block": "",
  "fvg": "",
  "support": "",
  "resistance": "",
  "reason": "",
  "invalidation": ""
}

Si WAIT :

{
  "action": "WAIT",
  "direction": "WAIT",
  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "tp3": null,
  "rr": null,
  "confidence_percent": 0,
  "arkas_score": 0,
  "market_structure": "",
  "trend": "",
  "liquidity": "",
  "bos": "",
  "choch": "",
  "order_block": "",
  "fvg": "",
  "support": "",
  "resistance": "",
  "reason": "",
  "invalidation": ""
}
`;

    return (
        base +
        modeInstructions +
        extra +
        schemaExample
    );
}


// ============================================================
// SCHÉMA STRUCTURED OUTPUT
// ============================================================

function buildResponseSchema() {

    return {

        type: "OBJECT",

        properties: {

            action: {
                type: "STRING",
                enum: [
                    "BUY NOW",
                    "SELL NOW",
                    "BUY LIMIT",
                    "SELL LIMIT",
                    "WAIT"
                ]
            },

            direction: {
                type: "STRING",
                enum: [
                    "BUY",
                    "SELL",
                    "WAIT"
                ]
            },

            entry: {
                type: "NUMBER",
                nullable: true
            },

            sl: {
                type: "NUMBER",
                nullable: true
            },

            tp1: {
                type: "NUMBER",
                nullable: true
            },

            tp2: {
                type: "NUMBER",
                nullable: true
            },

            tp3: {
                type: "NUMBER",
                nullable: true
            },

            rr: {
                type: "NUMBER",
                nullable: true
            },

            confidence_percent: {
                type: "NUMBER"
            },

            arkas_score: {
                type: "NUMBER"
            },

            market_structure: {
                type: "STRING"
            },

            trend: {
                type: "STRING"
            },

            liquidity: {
                type: "STRING"
            },

            bos: {
                type: "STRING"
            },

            choch: {
                type: "STRING"
            },

            order_block: {
                type: "STRING"
            },

            fvg: {
                type: "STRING"
            },

            support: {
                type: "STRING"
            },

            resistance: {
                type: "STRING"
            },

            reason: {
                type: "STRING"
            },

            invalidation: {
                type: "STRING"
            }
        },

        required: [
            "action",
            "direction",
            "confidence_percent",
            "arkas_score",
            "market_structure",
            "trend",
            "liquidity",
            "bos",
            "choch",
            "order_block",
            "fvg",
            "support",
            "resistance",
            "reason",
            "invalidation"
        ]
    };
}


// ============================================================
// MIME TYPE
// ============================================================

function normalizeMimeType(
    mimeType
) {

    const value =
        String(
            mimeType ||
            "image/jpeg"
        )
        .toLowerCase()
        .trim();

    if (
        value ===
        "image/jpg"
    ) {

        return "image/jpeg";
    }

    if (
        value ===
        "jpeg"
    ) {

        return "image/jpeg";
    }

    if (
        value ===
        "jpg"
    ) {

        return "image/jpeg";
    }

    if (
        value ===
        "png"
    ) {

        return "image/png";
    }

    if (
        value ===
        "webp"
    ) {

        return "image/webp";
    }

    return value;
}


// ============================================================
// NETTOYAGE BASE64
// ============================================================

function cleanBase64(
    value
) {

    let result =
        String(
            value || ""
        ).trim();

    /*
     * Si le frontend envoie :
     *
     * data:image/png;base64,AAAA...
     *
     * on retire le préfixe.
     */

    if (
        result.startsWith(
            "data:"
        )
    ) {

        const comma =
            result.indexOf(",");

        if (
            comma !== -1
        ) {

            result =
                result.substring(
                    comma + 1
                );
        }
    }

    /*
     * Retirer espaces et retours ligne.
     */

    result =
        result.replace(
           (/\s+/g),
            ""
        );

    return result;
}


// ============================================================
// EXTRACTION TEXTE GEMINI
// ============================================================

function extractGeminiText(
    candidate
) {

    if (
        !candidate ||
        !candidate.content ||
        !Array.isArray(
            candidate.content.parts
        )
    ) {

        return "";
    }

    return candidate.content.parts
        .map(
            part =>
                typeof part.text === "string"
                    ? part.text
                    : ""
        )
        .join("")
        .trim();
}


// ============================================================
// PARSING JSON
// ============================================================

function parseGeminiJSON(
    text
) {

    let clean =
        String(
            text || ""
        ).trim();

    /*
     * Retirer éventuellement ```json
     */

    clean =
        clean.replace(
            /^```json\s*/i,
            ""
        );

    clean =
        clean.replace(
            /^```\s*/i,
            ""
        );

    clean =
        clean.replace(
            /\s*```$/i,
            ""
        );

    /*
     * Première tentative
     */

    try {

        return JSON.parse(
            clean
        );

    } catch (error) {

        /*
         * Chercher le premier objet JSON.
         */

        const first =
            clean.indexOf("{");

        const last =
            clean.lastIndexOf("}");

        if (
            first === -1 ||
            last === -1 ||
            last <= first
        ) {

            throw error;
        }

        const possible =
            clean.substring(
                first,
                last + 1
            );

        return JSON.parse(
            possible
        );
    }
}


// ============================================================
// NORMALISATION
// ============================================================

function normalizeResult(
    data,
    context
) {

    const action =
        normalizeAction(
            data.action ||
            data.signal
        );

    let direction =
        String(
            data.direction ||
            ""
        )
        .toUpperCase()
        .trim();

    if (
        direction !== "BUY" &&
        direction !== "SELL"
    ) {

        if (
            action.startsWith(
                "BUY"
            )
        ) {

            direction =
                "BUY";

        } else if (
            action.startsWith(
                "SELL"
            )
        ) {

            direction =
                "SELL";

        } else {

            direction =
                "WAIT";
        }
    }

    /*
     * WAIT ne doit jamais avoir de niveaux
     */

    if (
        action === "WAIT"
    ) {

        direction =
            "WAIT";
    }

    return {

        action:
            action,

        direction:
            direction,

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

        confidence_percent:
            clamp(
                normalizeNumber(
                    data.confidence_percent
                ) || 0,
                0,
                100
            ),

        arkas_score:
            clamp(
                normalizeNumber(
                    data.arkas_score
                ) || 0,
                0,
                100
            ),

        market_structure:
            safeText(
                data.market_structure
            ),

        trend:
            safeText(
                data.trend
            ),

        liquidity:
            safeText(
                data.liquidity
            ),

        bos:
            safeText(
                data.bos
            ),

        choch:
            safeText(
                data.choch
            ),

        order_block:
            safeText(
                data.order_block
            ),

        fvg:
            safeText(
                data.fvg
            ),

        support:
            safeText(
                data.support
            ),

        resistance:
            safeText(
                data.resistance
            ),

        reason:
            safeText(
                data.reason
            ),

        invalidation:
            safeText(
                data.invalidation
            ),

        asset:
            context.asset,

        timeframe:
            context.timeframe,

        market_type:
            context.marketType
    };
}


// ============================================================
// ACTION
// ============================================================

function normalizeAction(
    value
) {

    const action =
        String(
            value || ""
        )
        .toUpperCase()
        .trim();

    if (
        action.includes(
            "BUY LIMIT"
        )
    ) {

        return "BUY LIMIT";
    }

    if (
        action.includes(
            "SELL LIMIT"
        )
    ) {

        return "SELL LIMIT";
    }

    if (
        action.includes(
            "BUY NOW"
        )
    ) {

        return "BUY NOW";
    }

    if (
        action.includes(
            "SELL NOW"
        )
    ) {

        return "SELL NOW";
    }

    if (
        action === "BUY"
    ) {

        return "BUY NOW";
    }

    if (
        action === "SELL"
    ) {

        return "SELL NOW";
    }

    return "WAIT";
}


// ============================================================
// NOMBRE
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
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? value
            : null;
    }

    let text =
        String(
            value
        )
        .trim();

    /*
     * Valeurs textuelles comme :
     * "1.2450"
     * "$1,245.50"
     */

    text =
        text.replace(
            /,/g,
            "."
        );

    /*
     * Garder uniquement nombre simple.
     */

    const match =
        text.match(
            /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/
        );

    if (!match) {
        return null;
    }

    const number =
        Number(
            match[0]
        );

    return Number.isFinite(number)
        ? number
        : null;
}


// ============================================================
// VALIDATION
// ============================================================

function validateResult(
    result
) {

    if (
        result.action === "WAIT"
    ) {

        return {
            valid: true
        };
    }

    if (
        result.direction !== "BUY" &&
        result.direction !== "SELL"
    ) {

        return {
            valid: false,
            message:
                "Direction BUY/SELL absente."
        };
    }

    if (
        !Number.isFinite(
            result.entry
        ) ||
        !Number.isFinite(
            result.sl
        ) ||
        !Number.isFinite(
            result.tp1
        )
    ) {

        return {
            valid: false,
            message:
                "Entry, SL ou TP1 manquant."
        };
    }

    /*
     * BUY
     */

    if (
        result.direction === "BUY"
    ) {

        if (
            result.sl >=
            result.entry
        ) {

            return {
                valid: false,
                message:
                    "BUY : SL doit être inférieur à Entry."
            };
        }

        if (
            result.tp1 <=
            result.entry
        ) {

            return {
                valid: false,
                message:
                    "BUY : TP1 doit être supérieur à Entry."
            };
        }

        if (
            result.tp2 !== null &&
            result.tp2 <=
            result.tp1
        ) {

            return {
                valid: false,
                message:
                    "BUY : TP2 doit être supérieur à TP1."
            };
        }

        if (
            result.tp3 !== null &&
            result.tp2 !== null &&
            result.tp3 <=
            result.tp2
        ) {

            return {
                valid: false,
                message:
                    "BUY : TP3 doit être supérieur à TP2."
            };
        }
    }

    /*
     * SELL
     */

    if (
        result.direction === "SELL"
    ) {

        if (
            result.sl <=
            result.entry
        ) {

            return {
                valid: false,
                message:
                    "SELL : SL doit être supérieur à Entry."
            };
        }

        if (
            result.tp1 >=
            result.entry
        ) {

            return {
                valid: false,
                message:
                    "SELL : TP1 doit être inférieur à Entry."
            };
        }

        if (
            result.tp2 !== null &&
            result.tp2 >=
            result.tp1
        ) {

            return {
                valid: false,
                message:
                    "SELL : TP2 doit être inférieur à TP1."
            };
        }

        if (
            result.tp3 !== null &&
            result.tp2 !== null &&
            result.tp3 >=
            result.tp2
        ) {

            return {
                valid: false,
                message:
                    "SELL : TP3 doit être inférieur à TP2."
            };
        }
    }

    return {
        valid: true
    };
}


// ============================================================
// CLASSIFICATION MARCHÉ
// ============================================================

function classifyMarket(
    asset
) {

    const value =
        String(
            asset || ""
        )
        .toUpperCase()
        .trim();

    /*
     * GOLD
     */

    if (
        value.includes("XAU") ||
        value.includes("GOLD")
    ) {

        return "GOLD";
    }

    /*
     * CRYPTO
     */

    const cryptoSymbols = [

        "BTC",
        "ETH",
        "LTC",
        "XRP",
        "SOL",
        "BNB",
        "ADA",
        "DOGE",
        "DOT",
        "AVAX",
        "LINK",
        "TRX",
        "MATIC",
        "SHIB",
        "ATOM",
        "UNI",
        "ETC",
        "BCH",
        "XLM",
        "NEAR",
        "APT",
        "ARB",
        "OP"
    ];

    if (
        cryptoSymbols.some(
            symbol =>
                value.includes(
                    symbol
                )
        )
    ) {

        return "CRYPTO";
    }

    /*
     * FOREX
     */

    const forexSymbols = [

        "EURUSD",
        "GBPUSD",
        "USDJPY",
        "USDCHF",
        "AUDUSD",
        "USDCAD",
        "NZDUSD",
        "EURJPY",
        "GBPJPY",
        "EURGBP",
        "EURCHF",
        "AUDJPY",
        "CADJPY",
        "CHFJPY"
    ];

    if (
        forexSymbols.some(
            symbol =>
                value.includes(
                    symbol
                )
        )
    ) {

        return "FOREX";
    }

    /*
     * INDICES
     */

    const indices = [
        "US30",
        "NAS100",
        "NASDAQ",
        "SPX500",
        "SP500",
        "GER40",
        "DAX",
        "UK100"
    ];

    if (
        indices.some(
            symbol =>
                value.includes(
                    symbol
                )
        )
    ) {

        return "INDICES";
    }

    /*
     * SYNTHETIC
     */

    if (
        value.includes(
            "VOLATILITY"
        ) ||
        /^R_\d+$/.test(
            value
        ) ||
        value.includes(
            "BOOM"
        ) ||
        value.includes(
            "CRASH"
        ) ||
        value.includes(
            "JUMP"
        )
    ) {

        return "SYNTHETIC";
    }

    return "OTHER";
}


// ============================================================
// TEXTE SÛR
// ============================================================

function safeText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }

    return String(
        value
    ).trim();
}


// ============================================================
// CLAMP
// ============================================================

function clamp(
    value,
    min,
    max
) {

    return Math.min(
        Math.max(
            value,
            min
        ),
        max
    );
}


// ============================================================
// ERREURS HTTP GEMINI
// ============================================================

function handleGeminiHttpError(
    res,
    status,
    data
) {

    const apiError =
        data &&
        data.error
            ? data.error
            : null;

    const message =
        apiError?.message ||
        "Erreur retournée par Gemini.";

    const code =
        apiError?.status ||
        null;

    /*
     * API KEY
     */

    if (
        status === 401 ||
        status === 403
    ) {

        return res.status(status).json({

            success: false,

            error:
                "GEMINI_AUTH_ERROR",

            message:
                "La clé Gemini est invalide, absente ou non autorisée.",

            details:
                message,

            status:
                status
        });
    }

    /*
     * QUOTA
     */

    if (
        status === 429
    ) {

        return res.status(429).json({

            success: false,

            error:
                "GEMINI_QUOTA",

            message:
                "La limite ou le quota Gemini a été atteint.",

            details:
                message
        });
    }

    /*
     * MODÈLE
     */

    if (
        status === 404
    ) {

        return res.status(404).json({

            success: false,

            error:
                "GEMINI_MODEL_ERROR",

            message:
                "Le modèle Gemini demandé n'est pas disponible pour cette API key.",

            model:
                "gemini-3.6-flash",

            details:
                message
        });
    }

    return res.status(502).json({

        success: false,

        error:
            "GEMINI_API_ERROR",

        message:
            "Gemini a retourné une erreur.",

        details:
            message,

        status:
            status,

        code:
            code
    });
}


// ============================================================
// MESSAGE DE BLOCAGE LISIBLE
// ============================================================

function buildFriendlyBlockMessage(
    reason
) {

    switch (
        String(
            reason || ""
        ).toUpperCase()
    ) {

        case "SAFETY":
            return (
                "La demande a été bloquée par les contrôles de sécurité. " +
                "Essaie une capture claire du graphique sans contenu supplémentaire."
            );

        case "BLOCKLIST":
            return (
                "La demande contient un élément bloqué par les règles Gemini."
            );

        case "PROHIBITED_CONTENT":
            return (
                "Le contenu envoyé ne peut pas être analysé par Gemini."
            );

        case "SPII":
            return (
                "La capture semble contenir des informations personnelles sensibles."
            );

        default:
            return (
                "Gemini a bloqué la demande. " +
                "Consulte la raison retournée par l'API."
            );
    }
}
