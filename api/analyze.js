// ============================================================
// ARKAS SCAN AI V2 - VERCEL API
// /api/analyze.js
// ============================================================

export default async function handler(req, res) {
  // ----------------------------------------------------------
  // CORS
  // ----------------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Méthode non autorisée. Utilisez POST."
    });
  }

  try {
    // --------------------------------------------------------
    // 1. RÉCUPÉRATION DES DONNÉES
    // --------------------------------------------------------
    const {
      imageBase64,
      prompt,
      mimeType
    } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: "Aucune image n'a été envoyée."
      });
    }

    // --------------------------------------------------------
    // 2. VÉRIFICATION DE LA CLÉ GEMINI
    // --------------------------------------------------------
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY manquante dans Vercel.");

      return res.status(500).json({
        success: false,
        error: "Configuration serveur incomplète : clé API Gemini manquante."
      });
    }

    // --------------------------------------------------------
    // 3. VÉRIFICATION DE L'IMAGE
    // --------------------------------------------------------
    if (typeof imageBase64 !== "string") {
      return res.status(400).json({
        success: false,
        error: "Format d'image invalide."
      });
    }

    // Évite les images excessivement grandes
    if (imageBase64.length > 12 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: "Image trop volumineuse. Utilisez une image plus légère."
      });
    }

    // --------------------------------------------------------
    // 4. TYPE MIME
    // --------------------------------------------------------
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    const finalMimeType = allowedMimeTypes.includes(mimeType)
      ? mimeType
      : "image/jpeg";

    // --------------------------------------------------------
    // 5. PROMPT SMC STRUCTURÉ
    // --------------------------------------------------------
    const systemPrompt = `
Tu es ARKAS SCAN AI V2, un moteur d'analyse technique spécialisé
dans le Smart Money Concepts (SMC) et le Price Action.

Analyse l'image du graphique avec prudence.

OBJECTIFS :

1. Identifier la structure du marché.
2. Détecter BOS et CHoCH.
3. Identifier la liquidité.
4. Identifier les Order Blocks.
5. Identifier les Fair Value Gaps.
6. Identifier les zones premium/discount si visibles.
7. Rechercher les confirmations Price Action.
8. Déterminer le biais BUY, SELL ou WAIT.
9. Proposer Entry, SL et TP uniquement si une configuration
   suffisamment claire existe.
10. Calculer un score ARKAS sur 100.
11. Refuser le trade si les informations visibles sont
    insuffisantes ou contradictoires.

IMPORTANT :

Ne jamais inventer un niveau de prix qui n'est pas raisonnablement
visible ou déductible du graphique.

Si la configuration n'est pas suffisamment claire :
direction = "WAIT"
trade_valid = false

Pour un BUY :

SL < Entry < TP1 < TP2

Pour un SELL :

TP2 < TP1 < Entry < SL

Le R:R doit être calculé à partir de Entry, SL et TP1.

FORMULE :

Risk = abs(Entry - SL)
Reward = abs(TP1 - Entry)
RR = Reward / Risk

SCORE ARKAS :

Structure = 25 points
Liquidité = 20 points
Order Block = 15 points
FVG = 15 points
Price Action = 15 points
Risk/Reward = 10 points

TOTAL = 100 points

INTERPRÉTATION :

80-100 = STRONG SIGNAL
65-79 = VALID SIGNAL
50-64 = WAIT
0-49 = NO TRADE

Le score doit refléter uniquement les éléments réellement
observables sur le graphique.

Retourne UNIQUEMENT du JSON valide.
Aucun Markdown.
Aucun texte avant ou après le JSON.

FORMAT EXACT :

{
  "asset": "BTCUSD",
  "timeframe": "M5",
  "market_bias": "BULLISH",
  "signal": "STRONG BUY",
  "direction": "BUY",
  "trade_valid": true,

  "entry": 0,
  "sl": 0,
  "tp1": 0,
  "tp2": 0,

  "rr": 0,

  "arkas_score": 0,

  "score_breakdown": {
    "structure": 0,
    "liquidity": 0,
    "order_block": 0,
    "fvg": 0,
    "price_action": 0,
    "risk_reward": 0
  },

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

  "zone": {
    "type": "",
    "description": ""
  },

  "reason": "",

  "risk_warning": ""
}

Si les niveaux ne sont pas fiables, utilise :

{
  "signal": "WAIT",
  "direction": "WAIT",
  "trade_valid": false
}

et mets les niveaux à null.
`;

    // Le prompt fourni par le frontend peut compléter la demande,
    // mais ne remplace jamais les règles ARKAS.
    const userPrompt = `
${systemPrompt}

Demande supplémentaire du client :
${typeof prompt === "string" ? prompt.slice(0, 4000) : ""}
`;

    // --------------------------------------------------------
    // 6. APPEL GEMINI
    // --------------------------------------------------------
    //
    // Gemini 2.5 Flash est utilisé ici comme modèle multimodal.
    //
    const model = "gemini-2.5-flash";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: userPrompt
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
          maxOutputTokens: 3000,

          responseMimeType: "application/json"
        }
      })
    });

    const geminiData = await geminiResponse.json();

    // --------------------------------------------------------
    // 7. GESTION DES ERREURS GEMINI
    // --------------------------------------------------------
    if (!geminiResponse.ok) {
      console.error("Erreur Gemini :", geminiData);

      const message =
        geminiData?.error?.message ||
        "Erreur lors de l'analyse Gemini.";

      return res.status(geminiResponse.status).json({
        success: false,
        error: message
      });
    }

    // --------------------------------------------------------
    // 8. RÉCUPÉRATION DU TEXTE
    // --------------------------------------------------------
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!rawText) {
      return res.status(502).json({
        success: false,
        error: "Gemini n'a retourné aucune analyse."
      });
    }

    // --------------------------------------------------------
    // 9. NETTOYAGE DU JSON
    // --------------------------------------------------------
    let cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let analysis;

    try {
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON Gemini invalide :", rawText);

      return res.status(502).json({
        success: false,
        error: "Gemini a retourné une analyse JSON invalide.",
        raw: rawText
      });
    }

    // --------------------------------------------------------
    // 10. VALIDATION ARKAS
    // --------------------------------------------------------
    const validated = validateARKASAnalysis(analysis);

    // --------------------------------------------------------
    // 11. RÉPONSE FINALE
    // --------------------------------------------------------
    return res.status(200).json({
      success: true,
      engine: "ARKAS SCAN AI V2",
      model,
      analysis: validated
    });

  } catch (error) {
    console.error("Erreur API ARKAS :", error);

    return res.status(500).json({
      success: false,
      error: "Erreur interne du serveur.",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
}


// ============================================================
// VALIDATION ARKAS
// ============================================================

function validateARKASAnalysis(data) {

  if (!data || typeof data !== "object") {
    return createWaitAnalysis(
      "Analyse invalide reçue du moteur IA."
    );
  }

  let direction = String(
    data.direction || "WAIT"
  ).toUpperCase();

  let signal = String(
    data.signal || "WAIT"
  ).toUpperCase();

  let entry = toNumber(data.entry);
  let sl = toNumber(data.sl);
  let tp1 = toNumber(data.tp1);
  let tp2 = toNumber(data.tp2);

  // ----------------------------------------------------------
  // NORMALISATION
  // ----------------------------------------------------------

  if (
    direction !== "BUY" &&
    direction !== "SELL"
  ) {
    direction = "WAIT";
  }

  // ----------------------------------------------------------
  // SI WAIT
  // ----------------------------------------------------------

  if (
    direction === "WAIT" ||
    entry === null ||
    sl === null ||
    tp1 === null
  ) {
    return {
      ...data,
      direction: "WAIT",
      signal: "WAIT",
      trade_valid: false,
      entry: null,
      sl: null,
      tp1: null,
      tp2: null,
      rr: null,
      reason:
        data.reason ||
        "Configuration insuffisamment confirmée."
    };
  }

  // ----------------------------------------------------------
  // VALIDATION BUY
  // ----------------------------------------------------------

  if (direction === "BUY") {

    const validLevels =
      sl < entry &&
      tp1 > entry &&
      (!tp2 || tp2 > tp1);

    if (!validLevels) {
      return createWaitAnalysis(
        "Les niveaux BUY proposés sont incohérents."
      );
    }
  }

  // ----------------------------------------------------------
  // VALIDATION SELL
  // ----------------------------------------------------------

  if (direction === "SELL") {

    const validLevels =
      sl > entry &&
      tp1 < entry &&
      (!tp2 || tp2 < tp1);

    if (!validLevels) {
      return createWaitAnalysis(
        "Les niveaux SELL proposés sont incohérents."
      );
    }
  }

  // ----------------------------------------------------------
  // CALCUL DU R:R
  // ----------------------------------------------------------

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp1 - entry);

  if (risk <= 0 || reward <= 0) {
    return createWaitAnalysis(
      "Risk/Reward impossible à calculer."
    );
  }

  const rr = Number(
    (reward / risk).toFixed(2)
  );

  // ----------------------------------------------------------
  // SCORE
  // ----------------------------------------------------------

  const score = calculateARKASScore(
    data,
    rr
  );

  // ----------------------------------------------------------
  // SIGNAL AUTOMATIQUE
  // ----------------------------------------------------------

  let finalSignal;

  if (score >= 80) {
    finalSignal =
      direction === "BUY"
        ? "STRONG BUY"
        : "STRONG SELL";
  } else if (score >= 65) {
    finalSignal =
      direction === "BUY"
        ? "BUY"
        : "SELL";
  } else if (score >= 50) {
    finalSignal = "WAIT";
  } else {
    finalSignal = "NO TRADE";
  }

  // Si score trop faible, pas de trade
  const tradeValid = score >= 65;

  if (!tradeValid) {
    return {
      ...data,
      direction: "WAIT",
      signal: finalSignal,
      trade_valid: false,
      entry: null,
      sl: null,
      tp1: null,
      tp2: null,
      rr,
      arkas_score: score,
      reason:
        "La configuration ne possède pas suffisamment de confirmations ARKAS."
    };
  }

  // ----------------------------------------------------------
  // RÉSULTAT FINAL
  // ----------------------------------------------------------

  return {
    ...data,

    direction,
    signal: finalSignal,
    trade_valid: true,

    entry,
    sl,
    tp1,
    tp2,

    rr,

    arkas_score: score,

    risk_warning:
      data.risk_warning ||
      "Analyse technique uniquement. Toujours gérer le risque."
  };
}


// ============================================================
// CALCUL DU SCORE ARKAS
// ============================================================

function calculateARKASScore(data, rr) {

  const breakdown = {
    structure: 0,
    liquidity: 0,
    order_block: 0,
    fvg: 0,
    price_action: 0,
    risk_reward: 0
  };

  // ----------------------------------------------------------
  // STRUCTURE / 25
  // ----------------------------------------------------------

  const structure =
    data.structure || {};

  if (
    hasMeaningfulText(structure.bos)
  ) {
    breakdown.structure += 15;
  }

  if (
    hasMeaningfulText(structure.choch)
  ) {
    breakdown.structure += 10;
  }

  // ----------------------------------------------------------
  // LIQUIDITÉ / 20
  // ----------------------------------------------------------

  const liquidity =
    data.liquidity || {};

  if (
    hasMeaningfulText(liquidity.type) ||
    hasMeaningfulText(liquidity.description)
  ) {
    breakdown.liquidity = 20;
  }

  // ----------------------------------------------------------
  // ORDER BLOCK / 15
  // ----------------------------------------------------------

  const ob =
    data.order_block || {};

  if (ob.detected === true) {
    breakdown.order_block = 15;
  }

  // ----------------------------------------------------------
  // FVG / 15
  // ----------------------------------------------------------

  const fvg =
    data.fvg || {};

  if (fvg.detected === true) {
    breakdown.fvg = 15;
  }

  // ----------------------------------------------------------
  // PRICE ACTION / 15
  // ----------------------------------------------------------

  const pa =
    data.price_action || {};

  if (
    hasMeaningfulText(pa.confirmation) ||
    hasMeaningfulText(pa.description)
  ) {
    breakdown.price_action = 15;
  }

  // ----------------------------------------------------------
  // RISK / REWARD / 10
  // ----------------------------------------------------------

  if (rr >= 3) {
    breakdown.risk_reward = 10;
  } else if (rr >= 2) {
    breakdown.risk_reward = 8;
  } else if (rr >= 1.5) {
    breakdown.risk_reward = 5;
  } else {
    breakdown.risk_reward = 0;
  }

  const total =
    breakdown.structure +
    breakdown.liquidity +
    breakdown.order_block +
    breakdown.fvg +
    breakdown.price_action +
    breakdown.risk_reward;

  // On remet aussi le détail dans l'objet retourné
  if (data.score_breakdown) {
    data.score_breakdown = breakdown;
  }

  return Math.max(
    0,
    Math.min(100, total)
  );
}


// ============================================================
// OUTILS
// ============================================================

function toNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function hasMeaningfulText(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  const text = String(value)
    .trim()
    .toLowerCase();

  if (!text) return false;

  const invalidValues = [
    "none",
    "n/a",
    "na",
    "unknown",
    "aucun",
    "aucune",
    "non détecté",
    "non detecte",
    "null"
  ];

  return !invalidValues.includes(text);
}


function createWaitAnalysis(reason) {

  return {
    asset: "UNKNOWN",
    timeframe: "UNKNOWN",
    market_bias: "NEUTRAL",

    signal: "WAIT",
    direction: "WAIT",
    trade_valid: false,

    entry: null,
    sl: null,
    tp1: null,
    tp2: null,

    rr: null,

    arkas_score: 0,

    score_breakdown: {
      structure: 0,
      liquidity: 0,
      order_block: 0,
      fvg: 0,
      price_action: 0,
      risk_reward: 0
    },

    structure: {
      bos: "",
      choch: "",
      description: ""
    },

    liquidity: {
      type: "",
      description: ""
    },

    order_block: {
      detected: false,
      type: "",
      zone: "",
      description: ""
    },

    fvg: {
      detected: false,
      type: "",
      zone: "",
      description: ""
    },

    price_action: {
      confirmation: "",
      description: ""
    },

    zone: {
      type: "",
      description: ""
    },

    reason,

    risk_warning:
      "Aucun trade recommandé tant que la configuration n'est pas suffisamment confirmée."
  };
}
