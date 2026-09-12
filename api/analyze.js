/* =========================================================
   ARKAS SCAN AI V2
   api/analyze.js

   Vercel Serverless Function
   Gemini Vision sécurisé
   MODE SCAN + MODE AUDIT
   ========================================================= */

export default async function handler(req, res) {

    /* =====================================================
       CORS
    ====================================================== */

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "POST, OPTIONS"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Méthode non autorisée."
        });
    }

    /* =====================================================
       API KEY
    ====================================================== */

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("GEMINI_API_KEY manquante.");

        return res.status(500).json({
            success: false,
            error:
                "La clé Gemini n'est pas configurée sur le serveur."
        });
    }

    /* =====================================================
       DONNÉES
    ====================================================== */

    const body = req.body || {};

    const {
        imageBase64,
        mimeType,
        prompt,
        accountBalance,
        riskPercent,
        valuePerPriceUnitPerLot,
        asset,
        timeframe,
        mode
    } = body;

    /* =====================================================
       VALIDATION IMAGE
    ====================================================== */

    if (!imageBase64) {
        return res.status(400).json({
            success: false,
            error: "Aucune image graphique reçue."
        });
    }

    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const finalMimeType =
        allowedMimeTypes.includes(mimeType)
            ? mimeType
            : "image/jpeg";

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
       MODE
    ====================================================== */

    const analysisMode =
        mode === "audit"
            ? "audit"
            : "scan";

    /* =====================================================
       INFORMATIONS RISQUE
    ====================================================== */

    const balance =
        Number(accountBalance);

    const risk =
        Number(riskPercent);

    const valueLot =
        Number(valuePerPriceUnitPerLot);

    let riskInformation = "";

    if (
        Number.isFinite(balance) &&
        balance > 0 &&
        Number.isFinite(risk) &&
        risk > 0
    ) {
        const riskMoney =
            balance * (risk / 100);

        riskInformation = `
Compte :
- Capital = ${balance}
- Risque demandé = ${risk}%
- Montant maximum risqué = ${riskMoney}
`;
    }

    if (
        Number.isFinite(valueLot) &&
        valueLot > 0
    ) {
        riskInformation += `
Valeur monétaire par unité de prix pour 1 lot :
${valueLot}
`;
    }

    /* =====================================================
       PROMPT SCAN
    ====================================================== */

    const scanPrompt = `

Tu es ARKAS SCAN AI V2.

Tu es un analyste spécialisé en :

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
- Risk Management

Tu analyses une CAPTURE D'ÉCRAN d'un graphique.

==================================================
RÈGLE PRINCIPALE
==================================================

Analyse ce qui est réellement visible.

Ne considère jamais une information comme certaine
si elle n'est pas visible ou raisonnablement déductible.

Ne fabrique jamais un prix.

Si le prix est lisible, utilise-le.

Si le prix est difficile à lire, tu peux fournir
une estimation raisonnable uniquement si elle est
cohérente avec l'échelle visible.

==================================================
OBJECTIF
==================================================

Tu dois chercher le meilleur scénario actuel.

Les possibilités sont :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

WAIT ne doit PAS être utilisé simplement parce que
le graphique n'est pas parfait.

Si plusieurs confirmations visibles indiquent clairement
une direction, donne un signal.

==================================================
BUY NOW
==================================================

Utilise BUY NOW lorsque :

- structure haussière
- ou BOS haussier
- ou CHoCH haussier confirmé
- momentum haussier
- zone de demande / OB / support pertinente
- confirmation Price Action
- risque acceptable

==================================================
SELL NOW
==================================================

Utilise SELL NOW lorsque :

- structure baissière
- ou BOS baissier
- ou CHoCH baissier confirmé
- momentum baissier
- zone d'offre / OB / résistance pertinente
- confirmation Price Action
- risque acceptable

==================================================
BUY LIMIT
==================================================

Utilise BUY LIMIT lorsque le scénario haussier
est suffisamment clair mais que le meilleur point
d'entrée se trouve plus bas.

Exemples :

- retour sur Bullish OB
- retour sur FVG
- retest
- support
- zone de demande

Donne le prix exact ou estimé raisonnablement
à partir du graphique.

==================================================
SELL LIMIT
==================================================

Utilise SELL LIMIT lorsque le scénario baissier
est suffisamment clair mais que le meilleur point
d'entrée se trouve plus haut.

Exemples :

- retour sur Bearish OB
- FVG
- résistance
- zone d'offre
- retest

==================================================
STRUCTURE
==================================================

Analyse :

- tendance
- HH
- HL
- LH
- LL
- BOS
- CHoCH
- structure externe
- structure interne
- range

==================================================
LIQUIDITÉ
==================================================

Recherche :

- Buy Side Liquidity
- Sell Side Liquidity
- Equal Highs
- Equal Lows
- Liquidity Sweep
- Stop Hunt
- prise de liquidité

==================================================
ORDER BLOCK
==================================================

Identifie uniquement les Order Blocks
réellement visibles.

==================================================
FVG
==================================================

Identifie uniquement les FVG
réellement visibles.

==================================================
PRICE ACTION
==================================================

Recherche :

- Engulfing
- Pin Bar
- Rejection
- Breakout
- Retest
- Displacement
- Continuation
- Reversal

==================================================
SCÉNARIOS
==================================================

Fournis :

SCÉNARIO PRINCIPAL :

SI [condition]
ALORS [action]

SCÉNARIO ALTERNATIF :

SI [condition]
ALORS [action]

==================================================
TRADE
==================================================

Pour BUY :

SL < Entry < TP1 < TP2 < TP3

Pour SELL :

TP3 < TP2 < TP1 < Entry < SL

RR principal = distance Entry → TP2
divisée par distance Entry → SL.

==================================================
SCORE ARKAS
==================================================

Score sur 100.

Structure = 25
Liquidity = 20
Order Block = 15
FVG = 15
Price Action = 15
Risk/Reward = 10

Ne force PAS WAIT uniquement parce que le score
est inférieur à 50.

Le score doit représenter la qualité réelle
du setup.

==================================================
CONFIDENCE
==================================================

Donne une confiance entre 0 et 100%.

La confiance ne signifie PAS une probabilité
réelle de gagner le trade.

Elle représente uniquement la qualité et la
cohérence des éléments visibles.

==================================================
RISK MANAGEMENT
==================================================

Si les informations du compte sont disponibles :

Calcule :

Montant à risquer =
capital × risque %

Distance SL =
abs(Entry - SL)

Lot =
montant à risquer /
(distance SL × valeur par unité de prix par lot)

Si la valeur par lot n'est pas fournie,
ne fabrique PAS le lot.

==================================================
NEWS
==================================================

Ne fabrique jamais une actualité économique.

Si aucune donnée de news n'est fournie :

available = false

==================================================
JSON
==================================================

Réponds UNIQUEMENT avec un JSON valide.

Format :

{
  "asset": "",
  "timeframe": "",

  "signal": "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",
  "direction": "BUY|SELL|WAIT",
  "execution": "MARKET|LIMIT|NONE",

  "market_bias": "",

  "trade_valid": false,
  "confidence_percent": 0,

  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "tp3": null,
  "rr": null,

  "arkas_score": 0,

  "structure": {
    "bos": "",
    "choch": "",
    "trend": "",
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

  "risk_management": {
    "account_balance": null,
    "risk_percent": null,
    "risk_amount": null,
    "sl_distance": null,
    "lot": null,
    "description": ""
  },

  "primary_scenario": {
    "condition": "",
    "action": ""
  },

  "alternative_scenario": {
    "condition": "",
    "action": ""
  },

  "invalidation": "",

  "economic_news": {
    "available": false,
    "impact": "",
    "description": ""
  },

  "reason": "",
  "risk_warning": ""
}

==================================================
CONSIGNES FINALES
==================================================

Ne réponds jamais avec du Markdown.

Ne mets jamais de texte avant le JSON.

Ne mets jamais de texte après le JSON.

${riskInformation}

Informations supplémentaires :

${typeof prompt === "string" ? prompt : ""}

Asset fourni :
${asset || "À déterminer depuis le graphique"}

Timeframe fourni :
${timeframe || "À déterminer depuis le graphique"}

Analyse maintenant l'image.
`;

    /* =====================================================
       PROMPT AUDIT
    ====================================================== */

    const auditPrompt = `

Tu es ARKAS SCAN AI V2 en MODE AUDIT.

L'utilisateur t'envoie une capture d'écran
qui contient DÉJÀ une analyse de trading.

Cette capture peut contenir :

- BUY
- SELL
- WAIT
- Entry
- Stop Loss
- Take Profit
- flèches
- lignes
- rectangles
- supports
- résistances
- Order Blocks
- FVG
- BOS
- CHoCH
- indicateurs
- annotations manuelles

==================================================
OBJECTIF
==================================================

Tu dois AUDITER l'analyse existante.

IMPORTANT :

L'analyse dessinée par l'utilisateur n'est PAS
automatiquement correcte.

Tu dois d'abord identifier ce que l'utilisateur
a proposé, puis vérifier indépendamment si cette
analyse correspond réellement au graphique.

==================================================
ÉTAPE 1 — LIRE L'ANALYSE UTILISATEUR
==================================================

Identifie si possible :

- direction proposée
- Entry
- SL
- TP1
- TP2
- TP3
- zones
- supports
- résistances
- OB
- FVG
- BOS
- CHoCH
- autres annotations

Si une donnée n'est pas lisible :

utilise null ou UNKNOWN.

Ne l'invente jamais.

==================================================
ÉTAPE 2 — ANALYSE INDÉPENDANTE
==================================================

Analyse ensuite le graphique comme un analyste
professionnel :

- Market Structure
- Price Action
- BOS
- CHoCH
- Liquidity
- Order Block
- FVG
- Support / Resistance
- Breakout
- Retest
- Momentum

==================================================
ÉTAPE 3 — COMPARAISON
==================================================

Compare l'analyse utilisateur avec ton analyse.

Vérifie notamment :

1. Direction correcte ?
2. Structure correcte ?
3. BOS/CHoCH correct ?
4. Zone correcte ?
5. Entry correcte ?
6. SL correctement placé ?
7. TP cohérents ?
8. RR acceptable ?
9. Entrée prématurée ?
10. Invalidation correcte ?

==================================================
VERDICTS
==================================================

Utilise uniquement :

VALIDATED

si l'analyse utilisateur est globalement correcte.

CORRECT

si l'idée est correcte mais nécessite une
petite correction.

PREMATURE

si la direction/setup est cohérent mais que
l'entrée est trop tôt et qu'une confirmation
ou un retest est nécessaire.

INVALID

si la direction ou la logique principale
est incorrecte.

UNCLEAR

si les annotations sont trop difficiles
à lire pour réaliser un audit fiable.

==================================================
IMPORTANT
==================================================

Même si l'analyse utilisateur indique BUY,
tu peux conclure SELL ou WAIT.

Même si elle indique SELL,
tu peux conclure BUY ou WAIT.

Ne cherche pas à confirmer l'utilisateur.

Cherche à vérifier objectivement son analyse.

==================================================
CORRECTION
==================================================

Si l'analyse est incorrecte ou prématurée,
propose une analyse corrigée.

La correction peut être :

BUY NOW
SELL NOW
BUY LIMIT
SELL LIMIT
WAIT

Avec :

Entry
SL
TP1
TP2
TP3
RR

==================================================
SCÉNARIOS
==================================================

Donne aussi :

SI [condition]
ALORS [action]

et

SI [condition inverse]
ALORS [action]

==================================================
NEWS
==================================================

Ne fabrique jamais de news économiques.

==================================================
JSON OBLIGATOIRE
==================================================

Réponds UNIQUEMENT avec JSON valide.

Format :

{
  "asset": "",
  "timeframe": "",

  "signal": "BUY NOW|SELL NOW|BUY LIMIT|SELL LIMIT|WAIT",
  "direction": "BUY|SELL|WAIT",
  "execution": "MARKET|LIMIT|NONE",

  "market_bias": "",

  "trade_valid": false,
  "confidence_percent": 0,

  "entry": null,
  "sl": null,
  "tp1": null,
  "tp2": null,
  "tp3": null,
  "rr": null,

  "arkas_score": 0,

  "structure": {
    "bos": "",
    "choch": "",
    "trend": "",
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
  },

  "score_breakdown": {
    "structure": 0,
    "liquidity": 0,
    "order_block": 0,
    "fvg": 0,
    "price_action": 0,
    "risk_reward": 0
  },

  "risk_management": {
    "account_balance": null,
    "risk_percent": null,
    "risk_amount": null,
    "sl_distance": null,
    "lot": null,
    "description": ""
  },

  "primary_scenario": {
    "condition": "",
    "action": ""
  },

  "alternative_scenario": {
    "condition": "",
    "action": ""
  },

  "invalidation": "",

  "economic_news": {
    "available": false,
    "impact": "",
    "description": ""
  },

  "reason": "",
  "risk_warning": ""
}

==================================================
RÈGLES
==================================================

Ne fabrique aucune annotation.

Ne fabrique aucun prix.

Si une annotation est illisible :
null ou UNKNOWN.

Si l'analyse utilisateur est mauvaise,
corrige-la.

Si elle est bonne,
dis clairement pourquoi.

${riskInformation}

Informations supplémentaires :

${typeof prompt === "string" ? prompt : ""}

Asset fourni :
${asset || "À déterminer"}

Timeframe fourni :
${timeframe || "À déterminer"}

Effectue maintenant l'audit de l'image.
`;

    /* =====================================================
       PROMPT FINAL
    ====================================================== */

    const arkasPrompt =
        analysisMode === "audit"
            ? auditPrompt
            : scanPrompt;

    /* =====================================================
       GEMINI
    ====================================================== */

    const GEMINI_MODEL =
        "gemini-3.6-flash";

    const geminiUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
                            mime_type: finalMimeType,
                            data: imageBase64
                        }
                    }

                ]
            }
        ],

        generationConfig: {

            temperature: 0.1,

            topP: 0.8,

            topK: 20,

            maxOutputTokens: 6000,

            responseMimeType:
                "application/json"
        }
    };

    let geminiResponse;

    /* =====================================================
       APPEL GEMINI
    ====================================================== */

    try {

        geminiResponse =
            await fetch(
                geminiUrl,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-goog-api-key":
                            apiKey
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
        await geminiResponse
            .json()
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
            ?.map(
                part =>
                    part.text || ""
            )
            .join("")
            .trim();

    if (!text) {

        return res.status(502).json({

            success: false,

            error:
                "Gemini n'a retourné aucune analyse."
        });
    }

    /* =====================================================
       PARSE JSON
    ====================================================== */

    let analysis = null;

    try {

        analysis =
            JSON.parse(text);

    } catch (error) {

        console.error(
            "JSON Gemini invalide :",
            text
        );

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

                analysis =
                    JSON.parse(
                        text.substring(
                            firstBrace,
                            lastBrace + 1
                        )
                    );
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
       HELPERS
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
                    .replace(
                        /[^0-9.-]/g,
                        ""
                    )
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

    function clampConfidence(value) {

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
       SIGNAL
    ====================================================== */

    const validSignals = [

        "BUY NOW",
        "SELL NOW",
        "BUY LIMIT",
        "SELL LIMIT",
        "WAIT"

    ];

    let signal =
        String(
            analysis.signal ||
            "WAIT"
        )
        .trim()
        .toUpperCase();

    if (
        !validSignals.includes(signal)
    ) {
        signal = "WAIT";
    }

    analysis.signal =
        signal;

    if (
        signal === "BUY NOW" ||
        signal === "BUY LIMIT"
    ) {

        analysis.direction =
            "BUY";

        analysis.execution =
            signal === "BUY LIMIT"
                ? "LIMIT"
                : "MARKET";

    } else if (
        signal === "SELL NOW" ||
        signal === "SELL LIMIT"
    ) {

        analysis.direction =
            "SELL";

        analysis.execution =
            signal === "SELL LIMIT"
                ? "LIMIT"
                : "MARKET";

    } else {

        analysis.direction =
            "WAIT";

        analysis.execution =
            "NONE";
    }

    /* =====================================================
       NOMBRES
    ====================================================== */

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

    analysis.tp3 =
        toNumber(
            analysis.tp3
        );

    analysis.arkas_score =
        clampScore(
            analysis.arkas_score
        );

    analysis.confidence_percent =
        clampConfidence(
            analysis.confidence_percent
        );

    /* =====================================================
       RR
    ====================================================== */

    let calculatedRR = null;

    if (
        analysis.entry !== null &&
        analysis.sl !== null &&
        analysis.tp2 !== null
    ) {

        const riskDistance =
            Math.abs(
                analysis.entry -
                analysis.sl
            );

        const rewardDistance =
            Math.abs(
                analysis.tp2 -
                analysis.entry
            );

        if (
            riskDistance > 0
        ) {

            calculatedRR =
                Number(
                    (
                        rewardDistance /
                        riskDistance
                    ).toFixed(2)
                );
        }
    }

    analysis.rr =
        calculatedRR;

    /* =====================================================
       VALIDATION TRADE
    ====================================================== */

    let tradeValid =
        false;

    if (
        analysis.direction === "BUY"
    ) {

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
                analysis.tp2 &&
            (
                analysis.tp3 === null ||
                analysis.tp2 <
                    analysis.tp3
            );
    }

    if (
        analysis.direction === "SELL"
    ) {

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
                analysis.sl &&
            (
                analysis.tp3 === null ||
                analysis.tp3 <
                    analysis.tp2
            );
    }

    /* =====================================================
       WAIT UNIQUEMENT SI NIVEAUX VRAIMENT INCOHÉRENTS
    ====================================================== */

    if (
        analysis.signal !== "WAIT" &&
        !tradeValid
    ) {

        console.warn(
            "Trade incohérent : passage en WAIT."
        );

        analysis.signal =
            "WAIT";

        analysis.direction =
            "WAIT";

        analysis.execution =
            "NONE";

        tradeValid =
            false;
    }

    analysis.trade_valid =
        tradeValid;

    /* =====================================================
       RISK MANAGEMENT
    ====================================================== */

    const riskManagement =
        analysis.risk_management ||
        {};

    riskManagement.account_balance =
        Number.isFinite(balance) &&
        balance > 0
            ? balance
            : null;

    riskManagement.risk_percent =
        Number.isFinite(risk) &&
        risk > 0
            ? risk
            : null;

    if (
        Number.isFinite(balance) &&
        balance > 0 &&
        Number.isFinite(risk) &&
        risk > 0
    ) {

        riskManagement.risk_amount =
            Number(
                (
                    balance *
                    risk /
                    100
                ).toFixed(2)
            );

    } else {

        riskManagement.risk_amount =
            null;
    }

    if (
        analysis.entry !== null &&
        analysis.sl !== null
    ) {

        riskManagement.sl_distance =
            Number(
                Math.abs(
                    analysis.entry -
                    analysis.sl
                ).toFixed(8)
            );

    } else {

        riskManagement.sl_distance =
            null;
    }

    if (
        riskManagement.risk_amount !== null &&
        riskManagement.sl_distance !== null &&
        riskManagement.sl_distance > 0 &&
        Number.isFinite(valueLot) &&
        valueLot > 0
    ) {

        riskManagement.lot =
            Number(
                (
                    riskManagement.risk_amount /
                    (
                        riskManagement.sl_distance *
                        valueLot
                    )
                ).toFixed(4)
            );

    } else {

        riskManagement.lot =
            null;
    }

    analysis.risk_management =
        riskManagement;

    /* =====================================================
       STRUCTURES PAR DÉFAUT
    ====================================================== */

    analysis.structure =
        analysis.structure ||
        {
            bos: "",
            choch: "",
            trend: "",
            description: ""
        };

    analysis.liquidity =
        analysis.liquidity ||
        {
            type: "",
            description: ""
        };

    analysis.order_block =
        analysis.order_block ||
        {
            detected: false,
            type: "",
            zone: "",
            description: ""
        };

    analysis.fvg =
        analysis.fvg ||
        {
            detected: false,
            type: "",
            zone: "",
            description: ""
        };

    analysis.price_action =
        analysis.price_action ||
        {
            confirmation: "",
            description: ""
        };

    analysis.score_breakdown =
        analysis.score_breakdown ||
        {
            structure: 0,
            liquidity: 0,
            order_block: 0,
            fvg: 0,
            price_action: 0,
            risk_reward: 0
        };

    analysis.primary_scenario =
        analysis.primary_scenario ||
        {
            condition: "",
            action: ""
        };

    analysis.alternative_scenario =
        analysis.alternative_scenario ||
        {
            condition: "",
            action: ""
        };

    analysis.invalidation =
        analysis.invalidation ||
        "";

    analysis.economic_news =
        analysis.economic_news ||
        {
            available: false,
            impact: "",
            description:
                "Aucune donnée économique en temps réel fournie."
        };

    analysis.reason =
        analysis.reason ||
        "Analyse basée sur les éléments visibles du graphique.";

    analysis.risk_warning =
        analysis.risk_warning ||
        "Une analyse technique n'offre aucune garantie de résultat.";

    /* =====================================================
       AUDIT PAR DÉFAUT
    ====================================================== */

    if (analysisMode === "audit") {

        analysis.audit =
            analysis.audit ||
            {
                status: "UNCLEAR",

                detected_user_analysis: {
                    direction: "UNKNOWN",
                    entry: null,
                    sl: null,
                    tp1: null,
                    tp2: null,
                    tp3: null,
                    annotations: [],
                    claimed_setup: ""
                },

                verdict: "",
                strengths: [],
                errors: [],
                corrections: [],

                corrected_trade: {
                    signal: "WAIT",
                    entry: null,
                    sl: null,
                    tp1: null,
                    tp2: null,
                    tp3: null,
                    rr: null
                }
            };

        const audit =
            analysis.audit;

        const statuses = [
            "VALIDATED",
            "CORRECT",
            "PREMATURE",
            "INVALID",
            "UNCLEAR"
        ];

        if (
            !statuses.includes(
                audit.status
            )
        ) {
            audit.status =
                "UNCLEAR";
        }

        audit.detected_user_analysis =
            audit.detected_user_analysis ||
            {
                direction: "UNKNOWN",
                entry: null,
                sl: null,
                tp1: null,
                tp2: null,
                tp3: null,
                annotations: [],
                claimed_setup: ""
            };

        audit.corrected_trade =
            audit.corrected_trade ||
            {
                signal:
                    analysis.signal ||
                    "WAIT",
                entry:
                    analysis.entry,
                sl:
                    analysis.sl,
                tp1:
                    analysis.tp1,
                tp2:
                    analysis.tp2,
                tp3:
                    analysis.tp3,
                rr:
                    analysis.rr
            };

        audit.strengths =
            Array.isArray(
                audit.strengths
            )
                ? audit.strengths
                : [];

        audit.errors =
            Array.isArray(
                audit.errors
            )
                ? audit.errors
                : [];

        audit.corrections =
            Array.isArray(
                audit.corrections
            )
                ? audit.corrections
                : [];

        analysis.audit =
            audit;
    }

    /* =====================================================
       RÉPONSE
    ====================================================== */

    return res.status(200).json({

        success: true,

        engine:
            "ARKAS SCAN AI V2",

        model:
            GEMINI_MODEL,

        mode:
            analysisMode,

        analysis
    });
}
