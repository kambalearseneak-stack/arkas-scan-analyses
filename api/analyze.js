/* =========================================================
   ARKAS SCAN AI V2
   api/analyze.js

   Vercel Serverless Function
   Gemini Vision sécurisé
   ========================================================= */

export default async function handler(req, res) {

    /* =====================================================
       CORS
    ====================================================== */

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


    /* =====================================================
       PREFLIGHT
    ====================================================== */

    if (req.method === "OPTIONS") {

        return res.status(204).end();

    }


    /* =====================================================
       METHOD
    ====================================================== */

    if (req.method !== "POST") {

        return res.status(405).json({

            success: false,

            error: "Méthode non autorisée."

        });

    }


    /* =====================================================
       API KEY
    ====================================================== */

    const apiKey =
        process.env.GEMINI_API_KEY;


    if (!apiKey) {

        console.error(
            "GEMINI_API_KEY manquante."
        );

        return res.status(500).json({

            success: false,

            error:
                "La clé Gemini n'est pas configurée sur le serveur."

        });

    }


    /* =====================================================
       DONNÉES
    ====================================================== */

    const {
        imageBase64,
        mimeType,
        prompt
    } = req.body || {};


    /* =====================================================
       VALIDATION IMAGE
    ====================================================== */

    if (!imageBase64) {

        return res.status(400).json({

            success: false,

            error:
                "Aucune image graphique reçue."

        });

    }


    /* =====================================================
       TYPES MIME AUTORISÉS
    ====================================================== */

    const allowedMimeTypes = [

        "image/jpeg",
        "image/png",
        "image/webp"

    ];


    const finalMimeType =
        allowedMimeTypes.includes(mimeType)
            ? mimeType
            : "image/jpeg";


    /* =====================================================
       LIMITATION DE TAILLE
    ====================================================== */

    /*
     * Limite approximative de sécurité.
     * Le frontend limite déjà les fichiers à 10 MB.
     */

    if (
        typeof imageBase64 !== "string" ||
        imageBase64.length > 12_000_000
    ) {

        return res.status(413).json({

            success: false,

            error:
                "Image trop volumineuse. Utilisez une image de moins de 10 MB."

        });

    }


    /* =====================================================
       PROMPT ARKAS
    ====================================================== */

    const arkasPrompt = `

Tu es ARKAS SCAN AI V2, un moteur spécialisé
dans l'analyse technique des graphiques de trading.

Analyse UNIQUEMENT ce qui est réellement visible
sur l'image.

N'invente jamais un niveau de prix qui n'est pas
lisible ou raisonnablement identifiable.

Utilise principalement :

- Price Action
- Smart Money Concepts
- Market Structure
- BOS
- CHoCH
- Liquidity
- Order Block
- Fair Value Gap
- Support / Resistance
- Confirmation Price Action
- Risk / Reward

==================================================
OBJECTIF
==================================================

Déterminer si le graphique présente :

BUY
SELL
WAIT

Le signal doit être basé sur plusieurs confirmations.

Si les informations visibles sont insuffisantes,
retourne WAIT.

Si la structure est contradictoire,
retourne WAIT.

Si l'entrée, le Stop Loss ou les Take Profits
ne peuvent pas être déterminés correctement,
retourne WAIT.

==================================================
STRUCTURE
==================================================

Recherche :

- tendance haussière
- tendance baissière
- range
- BOS haussier
- BOS baissier
- CHoCH haussier
- CHoCH baissier
- structure interne
- structure externe

==================================================
LIQUIDITÉ
==================================================

Recherche notamment :

- Buy-side liquidity
- Sell-side liquidity
- Equal Highs
- Equal Lows
- Liquidity sweep
- Stop hunt
- prise de liquidité

==================================================
ORDER BLOCK
==================================================

Recherche :

- Bullish Order Block
- Bearish Order Block

Ne signale un Order Block que s'il est
visuellement identifiable.

==================================================
FVG
==================================================

Recherche :

- Bullish FVG
- Bearish FVG

Ne signale une FVG que si elle est identifiable
sur le graphique.

==================================================
PRICE ACTION
==================================================

Recherche une confirmation telle que :

- engulfing
- rejection
- pin bar
- break and retest
- strong displacement
- rejection of OB
- rejection of FVG
- continuation
- reversal

==================================================
SIGNAL
==================================================

BUY seulement si plusieurs éléments concordent.

SELL seulement si plusieurs éléments concordent.

WAIT si :

- structure faible
- marché en range sans confirmation
- niveaux peu clairs
- risque trop élevé
- confirmations contradictoires
- image insuffisante

==================================================
TRADE
==================================================

Pour BUY :

SL < Entry < TP1 < TP2

Pour SELL :

TP2 < TP1 < Entry < SL

Le Risk/Reward doit être calculé correctement.

Utilise TP2 pour le calcul du RR principal.

==================================================
SCORE ARKAS
==================================================

Score total sur 100.

Pondération :

Structure       = 25
Liquidity       = 20
Order Block     = 15
FVG             = 15
Price Action    = 15
Risk/Reward     = 10

Total maximum = 100.

Un score inférieur à 50 doit normalement
être considéré comme WAIT.

==================================================
IMPORTANT
==================================================

Réponds UNIQUEMENT avec un JSON valide.

Aucun markdown.

Aucun texte avant le JSON.

Aucun texte après le JSON.

Format obligatoire :

{
  "asset": "",
  "timeframe": "",
  "direction": "BUY|SELL|WAIT",
  "signal": "BUY|SELL|WAIT",
  "market_bias": "",

  "trade_valid": false,

  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "rr": null,

  "arkas_score": 0,

  "structure": {
    "bos": "",
    "choch": "",
    "description": ""
  },

  "liquidity": {
    "type": "",
    "description": ""
  },

  "order_block": {
    "detected": false,
    "type": "",
    "zone": "",
    "description": ""
  },

  "fvg": {
    "detected": false,
    "type": "",
    "zone": "",
    "description": ""
  },

  "price_action": {
    "confirmation": "",
    "description": ""
  },

  "score_breakdown": {
    "structure": 0,
    "liquidity": 0,
    "order_block": 0,
    "fvg": 0,
    "price_action": 0,
    "risk_reward": 0
  },

  "reason": "",

  "risk_warning": ""
}

==================================================
RÈGLES JSON
==================================================

Les nombres doivent être de vrais nombres JSON
ou null.

arkas_score doit être compris entre 0 et 100.

trade_valid doit être true uniquement si Entry,
SL et TP sont cohérents.

Si le signal est WAIT :

trade_valid = false

Si les niveaux ne sont pas fiables :

entry = null
sl = null
tp1 = null
tp2 = null
rr = null

==================================================
CONSIGNES SUPPLÉMENTAIRES
==================================================

${typeof prompt === "string" ? prompt : ""}

Analyse maintenant l'image fournie.
`;


    /* =====================================================
       REQUÊTE GEMINI
    ====================================================== */

    const geminiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key="
        + encodeURIComponent(apiKey);


    const requestBody = {

        contents: [

            {

                role: "user",

                parts: [

                    {
                        text: arkasPrompt
                    },

                    {

                        inline_data: {

                            mime_type:
                                finalMimeType,

                            data:
                                imageBase64

                        }

                    }

                ]

            }

        ],

        generationConfig: {

            temperature: 0.1,

            topP: 0.8,

            topK: 20,

            maxOutputTokens: 4000,

            responseMimeType:
                "application/json"

        }

    };


    /* =====================================================
       APPEL GEMINI
    ====================================================== */

    let geminiResponse;

    try {

        geminiResponse =
            await fetch(
                geminiUrl,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            requestBody
                        )

                }
            );

    } catch (error) {

        console.error(
            "Erreur réseau Gemini :",
            error
        );

        return res.status(502).json({

            success: false,

            error:
                "Impossible de contacter Gemini."

        });

    }


    /* =====================================================
       RÉPONSE GEMINI
    ====================================================== */

    const geminiData =
        await geminiResponse.json()
            .catch(() => null);


    if (!geminiResponse.ok) {

        console.error(
            "Erreur Gemini :",
            geminiData
        );

        const message =
            geminiData?.error?.message ||
            "Gemini a refusé ou n'a pas pu traiter l'image.";

        return res.status(
            geminiResponse.status >= 400 &&
            geminiResponse.status < 600
                ? geminiResponse.status
                : 502
        ).json({

            success: false,

            error: message

        });

    }


    /* =====================================================
       EXTRACTION TEXTE
    ====================================================== */

    const text =
        geminiData
            ?.candidates?.[0]
            ?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();


    if (!text) {

        console.error(
            "Réponse Gemini vide :",
            geminiData
        );

        return res.status(502).json({

            success: false,

            error:
                "Gemini n'a retourné aucune analyse."

        });

    }


    /* =====================================================
       PARSING JSON
    ====================================================== */

    let analysis;

    try {

        analysis =
            JSON.parse(text);

    } catch (error) {

        console.error(
            "JSON Gemini invalide :",
            text
        );

        /*
         * Petite tentative de récupération
         * si Gemini ajoute accidentellement
         * des caractères autour du JSON.
         */

        try {

            const firstBrace =
                text.indexOf("{");

            const lastBrace =
                text.lastIndexOf("}");

            if (
                firstBrace !== -1 &&
                lastBrace !== -1 &&
                lastBrace > firstBrace
            ) {

                const extracted =
                    text.substring(
                        firstBrace,
                        lastBrace + 1
                    );

                analysis =
                    JSON.parse(extracted);

            }

        } catch (secondError) {

            console.error(
                "Impossible de récupérer le JSON."
            );

        }

    }


    if (
        !analysis ||
        typeof analysis !== "object"
    ) {

        return res.status(502).json({

            success: false,

            error:
                "La réponse de Gemini n'est pas exploitable."

        });

    }


    /* =====================================================
       OUTILS DE VALIDATION
    ====================================================== */

    function toNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        const number =
            Number(
                String(value)
                    .replace(",", ".")
                    .replace(/[^0-9.-]/g, "")
            );

        return Number.isFinite(number)
            ? number
            : null;
    }


    function clampScore(value) {

        const number =
            toNumber(value);

        if (number === null) {
            return 0;
        }

        return Math.max(
            0,
            Math.min(
                100,
                Math.round(number)
            )
        );

    }


    /* =====================================================
       NORMALISATION
    ====================================================== */

    const signal =
        String(
            analysis.signal ||
            analysis.direction ||
            "WAIT"
        )
        .trim()
        .toUpperCase();


    const validSignals = [
        "BUY",
        "SELL",
        "WAIT"
    ];


    analysis.signal =
        validSignals.includes(signal)
            ? signal
            : "WAIT";


    analysis.direction =
        analysis.signal;


    analysis.arkas_score =
        clampScore(
            analysis.arkas_score
        );


    analysis.entry =
        toNumber(
            analysis.entry
        );

    analysis.sl =
        toNumber(
            analysis.sl
        );

    analysis.tp1 =
        toNumber(
            analysis.tp1
        );

    analysis.tp2 =
        toNumber(
            analysis.tp2
        );


    /* =====================================================
       CALCUL RR
    ====================================================== */

    let calculatedRR = null;


    if (
        analysis.entry !== null &&
        analysis.sl !== null &&
        analysis.tp2 !== null
    ) {

        const risk =
            Math.abs(
                analysis.entry -
                analysis.sl
            );

        const reward =
            Math.abs(
                analysis.tp2 -
                analysis.entry
            );

        if (
            risk > 0 &&
            reward >= 0
        ) {

            calculatedRR =
                Number(
                    (reward / risk)
                        .toFixed(2)
                );

        }

    }


    analysis.rr =
        calculatedRR;


    /* =====================================================
       VALIDATION DES NIVEAUX
    ====================================================== */

    let tradeValid = false;


    if (analysis.signal === "BUY") {

        tradeValid =
            analysis.entry !== null &&
            analysis.sl !== null &&
            analysis.tp1 !== null &&
            analysis.tp2 !== null &&

            analysis.sl <
            analysis.entry &&

            analysis.entry <
            analysis.tp1 &&

            analysis.tp1 <
            analysis.tp2;

    }


    if (analysis.signal === "SELL") {

        tradeValid =
            analysis.entry !== null &&
            analysis.sl !== null &&
            analysis.tp1 !== null &&
            analysis.tp2 !== null &&

            analysis.tp2 <
            analysis.tp1 &&

            analysis.tp1 <
            analysis.entry &&

            analysis.entry <
            analysis.sl;

    }


    /* =====================================================
       SCORE MINIMUM
    ====================================================== */

    if (
        analysis.arkas_score < 50
    ) {

        analysis.signal =
            "WAIT";

        analysis.direction =
            "WAIT";

        tradeValid =
            false;

    }


    /* =====================================================
       SIGNAL INVALIDE
    ====================================================== */

    if (
        analysis.signal !== "WAIT" &&
        !tradeValid
    ) {

        analysis.signal =
            "WAIT";

        analysis.direction =
            "WAIT";

        analysis.trade_valid =
            false;

    } else {

        analysis.trade_valid =
            tradeValid;

    }


    /* =====================================================
       WAIT = PAS DE TRADE
    ====================================================== */

    if (
        analysis.signal === "WAIT"
    ) {

        analysis.trade_valid =
            false;

        /*
         * On conserve les niveaux éventuellement
         * détectés pour information, mais le frontend
         * devra considérer WAIT comme absence de trade.
         */

    }


    /* =====================================================
       STRUCTURES PAR DÉFAUT
    ====================================================== */

    analysis.structure =
        analysis.structure || {

            bos: "",

            choch: "",

            description: ""

        };


    analysis.liquidity =
        analysis.liquidity || {

            type: "",

            description: ""

        };


    analysis.order_block =
        analysis.order_block || {

            detected: false,

            type: "",

            zone: "",

            description: ""

        };


    analysis.fvg =
        analysis.fvg || {

            detected: false,

            type: "",

            zone: "",

            description: ""

        };


    analysis.price_action =
        analysis.price_action || {

            confirmation: "",

            description: ""

        };


    analysis.score_breakdown =
        analysis.score_breakdown || {

            structure: 0,

            liquidity: 0,

            order_block: 0,

            fvg: 0,

            price_action: 0,

            risk_reward: 0

        };


    analysis.reason =
        analysis.reason ||
        "Analyse basée sur les éléments visibles du graphique.";


    analysis.risk_warning =
        analysis.risk_warning ||
        "Toujours vérifier le graphique avant toute décision.";


    /* =====================================================
       RÉPONSE FINALE
    ====================================================== */

    return res.status(200).json({

        success: true,

        engine:
            "ARKAS SCAN AI V2",

        model:
            "gemini-2.5-flash",

        analysis

    });

}
