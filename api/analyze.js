// ============================================================
// ARKAS SCAN AI V2
// api/analyze.js
// Proxy sécurisé Vercel -> Gemini Vision
// ============================================================

export default async function handler(req, res) {

  // ------------------------------------------------------------
  // CORS
  // ------------------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

    // ----------------------------------------------------------
    // VARIABLES
    // ----------------------------------------------------------
    const {
      imageBase64,
      prompt = "",
      mimeType = "image/jpeg"
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;

    // ----------------------------------------------------------
    // VÉRIFICATION CLÉ API
    // ----------------------------------------------------------
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY est absente des variables d'environnement Vercel."
      });
    }

    // ----------------------------------------------------------
    // VÉRIFICATION IMAGE
    // ----------------------------------------------------------
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        success: false,
        error: "Aucune image valide n'a été reçue."
      });
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    const safeMimeType = allowedMimeTypes.includes(mimeType)
      ? mimeType
      : "image/jpeg";

    // Limite approximative pour éviter des requêtes énormes
    if (imageBase64.length > 12 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: "Image trop volumineuse. Utilisez une image plus légère."
      });
    }

    // ----------------------------------------------------------
    // PROMPT ARKAS SCAN AI
    // ----------------------------------------------------------
    const systemPrompt = `
Tu es ARKAS SCAN AI V2, un analyseur de graphiques spécialisé
dans Smart Money Concepts (SMC) et Price Action.

Analyse UNIQUEMENT ce qui est réellement visible sur le graphique.

NE FORCE JAMAIS un signal.

Si les preuves sont insuffisantes, retourne WAIT.

Tu dois rechercher :

1. Tendance générale
2. Structure du marché
3. BOS (Break of Structure)
4. CHoCH (Change of Character)
5. Liquidité
6. Liquidity Sweep
7. Order Block
8. Fair Value Gap
9. Premium / Discount
10. Price Action
11. Zone d'achat
12. Zone de vente
13. Confirmation du mouvement
14. Entry
15. Stop Loss
16. Take Profit 1
17. Take Profit 2

RÈGLES :

- BUY uniquement si la structure et la confirmation favorisent réellement
  une hausse.
- SELL uniquement si la structure et la confirmation favorisent réellement
  une baisse.
- Sinon WAIT.
- Ne jamais inventer un prix qui n'est pas cohérent avec le graphique.
- Le Stop Loss doit être placé derrière une zone technique logique.
- TP1 et TP2 doivent être cohérents avec la structure/liquidité.
- Le Risk/Reward doit être calculé correctement.
- Si les niveaux Entry/SL/TP ne sont pas suffisamment fiables,
  trade_valid doit être false.
- Le score ARKAS est compris entre 0 et 100.

Répartition du score :

Structure = 25 points
Liquidité = 20 points
Order Block = 15 points
FVG = 15 points
Price Action = 15 points
Risk/Reward = 10 points

Interprétation :

80-100 = configuration forte
65-79 = configuration intéressante
50-64 = attendre une confirmation
0-49 = aucune configuration suffisamment fiable

${prompt}

IMPORTANT :
Réponds UNIQUEMENT avec un objet JSON valide.
Aucun texte avant ou après le JSON.

FORMAT EXACT :

{
  "asset": "nom du marché si visible",
  "timeframe": "timeframe si visible",
  "direction": "BUY|SELL|WAIT",
  "signal": "BUY|SELL|WAIT",
  "market_bias": "BULLISH|BEARISH|NEUTRAL",

  "trade_valid": true,

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
`;

    // ----------------------------------------------------------
    // APPEL GEMINI
    // ----------------------------------------------------------
    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        contents: [
          {
            parts: [
              {
                text: systemPrompt
              },
              {
                inline_data: {
                  mime_type: safeMimeType,
                  data: imageBase64
                }
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.15,
          responseMimeType: "application/json"
        }

      })
    });

    const geminiData = await geminiResponse.json();

    // ----------------------------------------------------------
    // ERREUR GEMINI
    // ----------------------------------------------------------
    if (!geminiResponse.ok) {

      console.error(
        "Erreur Gemini :",
        JSON.stringify(geminiData)
      );

      const message =
        geminiData?.error?.message ||
        "Erreur lors de l'appel à Gemini.";

      return res.status(geminiResponse.status).json({
        success: false,
        error: message
      });
    }

    // ----------------------------------------------------------
    // EXTRACTION TEXTE
    // ----------------------------------------------------------
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

    // ----------------------------------------------------------
    // NETTOYAGE JSON
    // ----------------------------------------------------------
    let cleanJson = rawText;

    // Supprime éventuellement ```json ... ```
    cleanJson = cleanJson
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let analysis;

    try {

      analysis = JSON.parse(cleanJson);

    } catch (parseError) {

      console.error(
        "JSON Gemini invalide :",
        rawText
      );

      return res.status(502).json({
        success: false,
        error: "Gemini a retourné une réponse JSON invalide."
      });
    }

    // ----------------------------------------------------------
    // VALEURS PAR DÉFAUT
    // ----------------------------------------------------------
    analysis.asset =
      analysis.asset || "Marché";

    analysis.timeframe =
      analysis.timeframe || "N/A";

    analysis.direction =
      String(analysis.direction || "WAIT").toUpperCase();

    analysis.signal =
      String(analysis.signal || analysis.direction || "WAIT").toUpperCase();

    analysis.market_bias =
      String(analysis.market_bias || "NEUTRAL").toUpperCase();

    analysis.structure =
      analysis.structure || {};

    analysis.liquidity =
      analysis.liquidity || {};

    analysis.order_block =
      analysis.order_block || {};

    analysis.fvg =
      analysis.fvg || {};

    analysis.price_action =
      analysis.price_action || {};

    analysis.score_breakdown =
      analysis.score_breakdown || {};

    // ----------------------------------------------------------
    // NORMALISATION DU SIGNAL
    // ----------------------------------------------------------
    if (
      !["BUY", "SELL", "WAIT"].includes(analysis.direction)
    ) {
      analysis.direction = "WAIT";
    }

    if (
      !["BUY", "SELL", "WAIT"].includes(analysis.signal)
    ) {
      analysis.signal = analysis.direction;
    }

    // ----------------------------------------------------------
    // SCORE ARKAS
    // ----------------------------------------------------------
    const structureScore = clampScore(
      analysis.score_breakdown.structure,
      25
    );

    const liquidityScore = clampScore(
      analysis.score_breakdown.liquidity,
      20
    );

    const orderBlockScore = clampScore(
      analysis.score_breakdown.order_block,
      15
    );

    const fvgScore = clampScore(
      analysis.score_breakdown.fvg,
      15
    );

    const priceActionScore = clampScore(
      analysis.score_breakdown.price_action,
      15
    );

    // RR sera recalculé plus bas
    let rrScore = 0;

    // ----------------------------------------------------------
    // PRIX
    // ----------------------------------------------------------
    const entry = toNumber(analysis.entry);
    const sl = toNumber(analysis.sl);
    const tp1 = toNumber(analysis.tp1);
    const tp2 = toNumber(analysis.tp2);

    analysis.entry = entry;
    analysis.sl = sl;
    analysis.tp1 = tp1;
    analysis.tp2 = tp2;

    // ----------------------------------------------------------
    // VALIDATION DU TRADE
    // ----------------------------------------------------------
    let validTrade = true;

    if (
      analysis.direction === "WAIT" ||
      analysis.signal === "WAIT"
    ) {
      validTrade = false;
    }

    if (
      entry === null ||
      sl === null ||
      tp1 === null ||
      tp2 === null
    ) {
      validTrade = false;
    }

    // ----------------------------------------------------------
    // VALIDATION BUY
    // BUY : SL < Entry < TP1 < TP2
    // ----------------------------------------------------------
    if (analysis.direction === "BUY") {

      if (
        !(
          sl < entry &&
          entry < tp1 &&
          tp1 < tp2
        )
      ) {
        validTrade = false;
      }

    }

    // ----------------------------------------------------------
    // VALIDATION SELL
    // SELL : TP2 < TP1 < Entry < SL
    // ----------------------------------------------------------
    if (analysis.direction === "SELL") {

      if (
        !(
          tp2 < tp1 &&
          tp1 < entry &&
          entry < sl
        )
      ) {
        validTrade = false;
      }

    }

    // ----------------------------------------------------------
    // CALCUL RISK / REWARD
    // ----------------------------------------------------------
    let rr = null;

    if (
      validTrade &&
      entry !== null &&
      sl !== null &&
      tp2 !== null
    ) {

      const risk =
        Math.abs(entry - sl);

      const reward =
        Math.abs(tp2 - entry);

      if (risk > 0) {
        rr = reward / risk;
      }
    }

    analysis.rr =
      rr !== null
        ? Number(rr.toFixed(2))
        : null;

    // ----------------------------------------------------------
    // SCORE RR
    // ----------------------------------------------------------
    if (rr !== null) {

      if (rr >= 3) {
        rrScore = 10;
      } else if (rr >= 2) {
        rrScore = 8;
      } else if (rr >= 1.5) {
        rrScore = 6;
      } else if (rr >= 1) {
        rrScore = 3;
      } else {
        rrScore = 0;
      }
    }

    // ----------------------------------------------------------
    // SCORE FINAL
    // ----------------------------------------------------------
    const finalScore =
      structureScore +
      liquidityScore +
      orderBlockScore +
      fvgScore +
      priceActionScore +
      rrScore;

    analysis.score_breakdown = {
      structure: structureScore,
      liquidity: liquidityScore,
      order_block: orderBlockScore,
      fvg: fvgScore,
      price_action: priceActionScore,
      risk_reward: rrScore
    };

    analysis.arkas_score = Math.round(
      Math.max(0, Math.min(100, finalScore))
    );

    // ----------------------------------------------------------
    // SI LE TRADE EST INVALIDE -> WAIT
    // ----------------------------------------------------------
    if (!validTrade) {

      analysis.trade_valid = false;
      analysis.direction = "WAIT";
      analysis.signal = "WAIT";
      analysis.entry = null;
      analysis.sl = null;
      analysis.tp1 = null;
      analysis.tp2 = null;
      analysis.rr = null;

      if (!analysis.reason) {
        analysis.reason =
          "Les conditions techniques ne sont pas suffisamment confirmées pour prendre un trade.";
      }

    } else {

      analysis.trade_valid = true;

    }

    // ----------------------------------------------------------
    // SEUIL DE SÉCURITÉ DU SCORE
    // ----------------------------------------------------------
    if (
      analysis.arkas_score < 50
    ) {

      analysis.trade_valid = false;
      analysis.direction = "WAIT";
      analysis.signal = "WAIT";

      analysis.entry = null;
      analysis.sl = null;
      analysis.tp1 = null;
      analysis.tp2 = null;
      analysis.rr = null;

      analysis.reason =
        "Score ARKAS insuffisant. Attendre une meilleure confirmation.";

    }

    // ----------------------------------------------------------
    // AVERTISSEMENT
    // ----------------------------------------------------------
    if (!analysis.risk_warning) {

      analysis.risk_warning =
        "Cette analyse est une aide technique et ne garantit pas un résultat financier.";
    }

    // ----------------------------------------------------------
    // RÉPONSE FINALE
    // ----------------------------------------------------------
    return res.status(200).json({

      success: true,

      engine: "ARKAS SCAN AI V2",

      model: "gemini-2.5-flash",

      analysis

    });

  } catch (error) {

    console.error(
      "Erreur serveur ARKAS :",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        "Erreur interne du serveur."

    });
  }
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

  const number =
    Number(
      String(value)
        .replace(",", ".")
        .trim()
    );

  return Number.isFinite(number)
    ? number
    : null;
}


function clampScore(value, max) {

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(
    Math.max(0, Math.min(max, number))
  );
}
