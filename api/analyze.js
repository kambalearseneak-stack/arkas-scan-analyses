// ============================================================
// ARKAS SCAN AI V2
// FRONTEND JAVASCRIPT
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const PROXY_API_URL =
  "https://arkas-scan-analyses.vercel.app/api/analyze";

document.addEventListener("DOMContentLoaded", () => {

  console.log("🚀 ARKAS SCAN AI V2 chargé");

  // ----------------------------------------------------------
  // RÉCUPÉRATION DES ÉLÉMENTS
  // ----------------------------------------------------------

  const dropZone =
    document.querySelector(".upload-zone") ||
    document.querySelector(".border-dashed") ||
    document.getElementById("dropZone");

  const fileInput =
    document.getElementById("chartInput") ||
    document.getElementById("chart-file") ||
    document.querySelector('input[type="file"]');

  const scanBtn =
    document.getElementById("scanBtn") ||
    document.getElementById("analyze-btn") ||
    document.querySelector('button[type="submit"]');

  const outputContainer =
    document.getElementById("analysisOutput") ||
    document.getElementById("results-content") ||
    document.querySelector(".report-container");

  console.log("Drop zone :", dropZone);
  console.log("File input :", fileInput);
  console.log("Scan button :", scanBtn);
  console.log("Output :", outputContainer);

  // ----------------------------------------------------------
  // VÉRIFICATION DU HTML
  // ----------------------------------------------------------

  if (!fileInput) {
    console.error(
      "❌ Impossible de trouver l'input fichier."
    );

    showError(
      "Le sélecteur d'image n'est pas correctement configuré dans la page."
    );

    return;
  }

  if (!scanBtn) {
    console.error(
      "❌ Impossible de trouver le bouton d'analyse."
    );
  }

  // ----------------------------------------------------------
  // VARIABLES
  // ----------------------------------------------------------

  let selectedFile = null;
  let selectedBase64 = null;

  // ----------------------------------------------------------
  // CONFIGURATION INPUT
  // ----------------------------------------------------------

  fileInput.accept = "image/jpeg,image/png,image/webp";
  fileInput.removeAttribute("multiple");

  // ----------------------------------------------------------
  // CLIC SUR LA ZONE
  // ----------------------------------------------------------

  if (dropZone) {

    dropZone.addEventListener("click", (event) => {

      // Si l'utilisateur clique directement sur l'input,
      // on ne déclenche pas un deuxième clic.
      if (event.target === fileInput) {
        return;
      }

      fileInput.click();
    });

    // --------------------------------------------------------
    // DRAG & DROP
    // --------------------------------------------------------

    [
      "dragenter",
      "dragover"
    ].forEach(eventName => {

      dropZone.addEventListener(eventName, (event) => {

        event.preventDefault();
        event.stopPropagation();

        dropZone.classList.add("drag-active");
      });
    });

    [
      "dragleave",
      "drop"
    ].forEach(eventName => {

      dropZone.addEventListener(eventName, (event) => {

        event.preventDefault();
        event.stopPropagation();

        dropZone.classList.remove("drag-active");
      });
    });

    dropZone.addEventListener("drop", (event) => {

      const files = event.dataTransfer.files;

      if (!files || !files.length) {
        return;
      }

      processSelectedFile(files[0]);
    });
  }

  // ----------------------------------------------------------
  // SÉLECTION CLASSIQUE
  // ----------------------------------------------------------

  fileInput.addEventListener("change", (event) => {

    console.log("📁 Fichier sélectionné");

    const files = event.target.files;

    if (!files || !files.length) {
      console.warn("Aucun fichier sélectionné.");
      return;
    }

    processSelectedFile(files[0]);
  });

  // ==========================================================
  // TRAITEMENT DU FICHIER
  // ==========================================================

  function processSelectedFile(file) {

    console.log("📷 Traitement :", file.name);

    // --------------------------------------------------------
    // TYPE
    // --------------------------------------------------------

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

      showError(
        "Format non accepté. Utilisez JPG, PNG ou WebP."
      );

      resetFile();

      return;
    }

    // --------------------------------------------------------
    // TAILLE
    // --------------------------------------------------------

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {

      showError(
        "Image trop lourde. Taille maximale : 10 MB."
      );

      resetFile();

      return;
    }

    // --------------------------------------------------------
    // STOCKAGE
    // --------------------------------------------------------

    selectedFile = file;

    // --------------------------------------------------------
    // LECTURE
    // --------------------------------------------------------

    const reader = new FileReader();

    reader.onload = (event) => {

      selectedBase64 =
        event.target.result.split(",")[1];

      console.log("✅ Image convertie en Base64");

      showPreview(
        event.target.result,
        file
      );

      // Active le bouton
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.innerText = "🧠 Lancer l'analyse SMC";
      }

      // Message utilisateur
      if (outputContainer) {

        outputContainer.innerHTML = `
          <div style="
            padding:20px;
            text-align:center;
            color:#cbd5e1;
            background:rgba(15,23,42,.65);
            border-radius:10px;
          ">
            <div style="
              font-size:28px;
              margin-bottom:8px;
            ">
              ✅
            </div>

            <strong style="color:#4ed9a2;">
              Image prête
            </strong>

            <p style="
              margin-top:6px;
              font-size:13px;
              color:#94a3b8;
            ">
              Cliquez sur « Lancer l'analyse SMC »
            </p>
          </div>
        `;
      }
    };

    reader.onerror = () => {

      console.error(
        "❌ Impossible de lire l'image"
      );

      showError(
        "Impossible de lire cette image."
      );
    };

    reader.readAsDataURL(file);
  }

  // ==========================================================
  // APERÇU
  // ==========================================================

  function showPreview(dataUrl, file) {

    if (!dropZone) {
      return;
    }

    // IMPORTANT :
    // On ne remplace PAS tout le innerHTML de la zone.
    // Cela évite de supprimer l'input file.

    let preview =
      dropZone.querySelector(".arkas-image-preview");

    if (!preview) {

      preview =
        document.createElement("div");

      preview.className =
        "arkas-image-preview";

      preview.style.cssText = `
        margin-top:12px;
        text-align:center;
      `;

      dropZone.appendChild(preview);
    }

    preview.innerHTML = `

      <img
        src="${dataUrl}"
        alt="Graphique sélectionné"
        style="
          display:block;
          max-width:100%;
          width:auto;
          max-height:220px;
          margin:0 auto;
          border-radius:10px;
          object-fit:contain;
          box-shadow:0 0 20px rgba(0,0,0,.35);
        "
      >

      <div style="
        margin-top:8px;
        color:#4ed9a2;
        font-size:13px;
        font-weight:600;
      ">
        ✓ Image prête pour l'analyse
      </div>

      <div style="
        margin-top:4px;
        color:#94a3b8;
        font-size:11px;
      ">
        ${escapeHtml(file.name)}
      </div>

      <button
        type="button"
        class="arkas-change-image"
        style="
          margin-top:10px;
          padding:7px 12px;
          border:1px solid #334155;
          border-radius:6px;
          background:#1e293b;
          color:#cbd5e1;
          cursor:pointer;
        "
      >
        📷 Changer l'image
      </button>
    `;

    const changeBtn =
      preview.querySelector(".arkas-change-image");

    if (changeBtn) {

      changeBtn.addEventListener("click", (event) => {

        event.stopPropagation();

        fileInput.click();
      });
    }
  }

  // ==========================================================
  // BOUTON SCAN
  // ==========================================================

  if (scanBtn) {

    scanBtn.disabled = false;

    scanBtn.addEventListener("click", async (event) => {

      event.preventDefault();
      event.stopPropagation();

      console.log("🧠 Démarrage du scan");

      // ------------------------------------------------------
      // VÉRIFICATION
      // ------------------------------------------------------

      if (!selectedFile || !selectedBase64) {

        showError(
          "Veuillez sélectionner une image du graphique avant de lancer l'analyse."
        );

        return;
      }

      // ------------------------------------------------------
      // LOADER
      // ------------------------------------------------------

      setLoading(true);

      try {

        // ----------------------------------------------------
        // REQUÊTE VERCEL
        // ----------------------------------------------------

        console.log(
          "📡 Envoi vers :",
          PROXY_API_URL
        );

        const response = await fetch(
          PROXY_API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({

              imageBase64: selectedBase64,

              mimeType:
                selectedFile.type ||
                "image/jpeg",

              prompt: `
Analyse ce graphique avec ARKAS SCAN AI V2.

Utilise Smart Money Concepts et Price Action.

Identifie :
- tendance
- structure
- BOS
- CHoCH
- liquidité
- liquidity sweep
- Order Block
- Fair Value Gap
- premium / discount
- confirmation Price Action
- zone d'achat
- zone de vente

Si une configuration valide existe :
donne Entry, SL, TP1 et TP2.

Si les conditions ne sont pas suffisamment confirmées :
retourne WAIT.

Ne force jamais un BUY ou SELL.
              `
            })
          }
        );

        console.log(
          "📥 Réponse serveur :",
          response.status
        );

        // ----------------------------------------------------
        // LECTURE RÉPONSE
        // ----------------------------------------------------

        const data =
          await response.json();

        console.log(
          "📊 Réponse API :",
          data
        );

        // ----------------------------------------------------
        // ERREUR API
        // ----------------------------------------------------

        if (!response.ok) {

          throw new Error(
            data?.error ||
            `Erreur serveur (${response.status})`
          );
        }

        // ----------------------------------------------------
        // NOUVELLE STRUCTURE ARKAS V2
        // ----------------------------------------------------

        if (
          !data ||
          !data.analysis
        ) {

          console.error(
            "Réponse inattendue :",
            data
          );

          throw new Error(
            "L'API n'a pas retourné d'analyse."
          );
        }

        // ----------------------------------------------------
        // AFFICHAGE
        // ----------------------------------------------------

        displayAnalysis(
          data.analysis
        );

      } catch (error) {

        console.error(
          "❌ Erreur de scan :",
          error
        );

        showError(
          error.message ||
          "Une erreur est survenue pendant l'analyse."
        );

      } finally {

        setLoading(false);
      }
    });
  }

  // ==========================================================
  // LOADER
  // ==========================================================

  function setLoading(loading) {

    if (!scanBtn) {
      return;
    }

    scanBtn.disabled = loading;

    scanBtn.innerText =
      loading
        ? "🧠 Analyse SMC en cours..."
        : "🧠 Lancer l'analyse SMC";
  }

  // ==========================================================
  // AFFICHAGE ANALYSE
  // ==========================================================

  function displayAnalysis(data) {

    if (!outputContainer) {
      return;
    }

    const direction =
      String(data.direction || "WAIT")
        .toUpperCase();

    const signal =
      String(data.signal || "WAIT")
        .toUpperCase();

    const score =
      Number(data.arkas_score || 0);

    const isBuy =
      direction === "BUY";

    const isSell =
      direction === "SELL";

    const isWait =
      direction === "WAIT";

    let signalColor = "#facc15";

    if (isBuy) {
      signalColor = "#22c55e";
    }

    if (isSell) {
      signalColor = "#ef4444";
    }

    // --------------------------------------------------------
    // HTML
    // --------------------------------------------------------

    outputContainer.innerHTML = `

      <div style="
        background:#0f172a;
        border:1px solid #1e293b;
        border-radius:12px;
        padding:16px;
        color:#e2e8f0;
      ">

        <!-- HEADER -->

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          border-bottom:1px solid #1e293b;
          padding-bottom:14px;
          margin-bottom:14px;
        ">

          <div>

            <div style="
              color:#94a3b8;
              font-size:12px;
            ">
              ARKAS SCAN AI V2
            </div>

            <h3 style="
              margin:4px 0 0;
              color:${signalColor};
              font-size:20px;
            ">
              ${escapeHtml(
                data.asset || "Marché"
              )}
              —
              ${escapeHtml(signal)}
            </h3>

          </div>

          <div style="
            background:rgba(78,217,162,.10);
            border:1px solid #4ed9a2;
            border-radius:10px;
            padding:10px 14px;
            text-align:center;
          ">

            <div style="
              font-size:11px;
              color:#94a3b8;
            ">
              SCORE ARKAS
            </div>

            <strong style="
              color:#4ed9a2;
              font-size:24px;
            ">
              ${score}/100
            </strong>

          </div>

        </div>


        <!-- BIAS -->

        <div style="
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:8px;
          margin-bottom:14px;
        ">

          ${infoCard(
            "BIAIS",
            data.market_bias || "NEUTRAL"
          )}

          ${infoCard(
            "TIMEFRAME",
            data.timeframe || "N/A"
          )}

        </div>


        <!-- TRADE -->

        ${
          data.trade_valid
            ? `
              <div style="
                display:grid;
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:8px;
                margin-bottom:14px;
              ">

                ${priceCard(
                  "ENTRY",
                  data.entry,
                  "#3b82f6"
                )}

                ${priceCard(
                  "STOP LOSS",
                  data.sl,
                  "#ef4444"
                )}

                ${priceCard(
                  "TAKE PROFIT 1",
                  data.tp1,
                  "#22c55e"
                )}

                ${priceCard(
                  "TAKE PROFIT 2",
                  data.tp2,
                  "#10b981"
                )}

              </div>

              <div style="
                background:#1e293b;
                padding:12px;
                border-radius:8px;
                margin-bottom:14px;
                text-align:center;
              ">

                <span style="
                  color:#94a3b8;
                  font-size:12px;
                ">
                  RISK / REWARD
                </span>

                <strong style="
                  color:#4ed9a2;
                  font-size:18px;
                  margin-left:8px;
                ">
                  1:${data.rr ?? "N/A"}
                </strong>

              </div>
            `
            : `
              <div style="
                padding:15px;
                border-radius:9px;
                background:rgba(250,204,21,.08);
                border:1px solid rgba(250,204,21,.35);
                color:#fde68a;
                margin-bottom:14px;
              ">
                ⚠️
                <strong>
                  PAS DE TRADE POUR LE MOMENT
                </strong>

                <div style="
                  margin-top:6px;
                  font-size:12px;
                ">
                  ${escapeHtml(
                    data.reason ||
                    "La configuration n'est pas suffisamment confirmée."
                  )}
                </div>
              </div>
            `
        }


        <!-- STRUCTURE -->

        <section style="
          background:#111827;
          border-radius:9px;
          padding:12px;
          margin-bottom:10px;
        ">

          <h4 style="
            color:#4ed9a2;
            margin:0 0 9px;
            font-size:14px;
          ">
            📊 Structure du marché
          </h4>

          <div style="font-size:13px;line-height:1.6;">

            <div>
              <strong>BOS :</strong>
              ${escapeHtml(
                data.structure?.bos || "Non identifié"
              )}
            </div>

            <div>
              <strong>CHoCH :</strong>
              ${escapeHtml(
                data.structure?.choch || "Non identifié"
              )}
            </div>

            <div>
              <strong>Analyse :</strong>
              ${escapeHtml(
                data.structure?.description || "N/A"
              )}
            </div>

          </div>

        </section>


        <!-- LIQUIDITY -->

        <section style="
          background:#111827;
          border-radius:9px;
          padding:12px;
          margin-bottom:10px;
        ">

          <h4 style="
            color:#facc15;
            margin:0 0 9px;
            font-size:14px;
          ">
            💧 Liquidité
          </h4>

          <div style="
            font-size:13px;
            line-height:1.6;
          ">

            <div>
              <strong>Type :</strong>
              ${escapeHtml(
                data.liquidity?.type ||
                "Non identifié"
              )}
            </div>

            <div>
              ${escapeHtml(
                data.liquidity?.description ||
                "Aucune information."
              )}
            </div>

          </div>

        </section>


        <!-- ORDER BLOCK -->

        <section style="
          background:#111827;
          border-radius:9px;
          padding:12px;
          margin-bottom:10px;
        ">

          <h4 style="
            color:#60a5fa;
            margin:0 0 9px;
            font-size:14px;
          ">
            🟦 Order Block
          </h4>

          <div style="
            font-size:13px;
            line-height:1.6;
          ">

            <div>
              <strong>Détecté :</strong>
              ${
                data.order_block?.detected
                  ? "✅ Oui"
                  : "❌ Non"
              }
            </div>

            <div>
              <strong>Type :</strong>
              ${escapeHtml(
                data.order_block?.type ||
                "N/A"
              )}
            </div>

            <div>
              <strong>Zone :</strong>
              ${escapeHtml(
                data.order_block?.zone ||
                "N/A"
              )}
            </div>

            <div>
              ${escapeHtml(
                data.order_block?.description ||
                ""
              )}
            </div>

          </div>

        </section>


        <!-- FVG -->

        <section style="
          background:#111827;
          border-radius:9px;
          padding:12px;
          margin-bottom:10px;
        ">

          <h4 style="
            color:#f59e0b;
            margin:0 0 9px;
            font-size:14px;
          ">
            🟨 Fair Value Gap
          </h4>

          <div style="
            font-size:13px;
            line-height:1.6;
          ">

            <div>
              <strong>Détecté :</strong>
              ${
                data.fvg?.detected
                  ? "✅ Oui"
                  : "❌ Non"
              }
            </div>

            <div>
              <strong>Type :</strong>
              ${escapeHtml(
                data.fvg?.type ||
                "N/A"
              )}
            </div>

            <div>
              <strong>Zone :</strong>
              ${escapeHtml(
                data.fvg?.zone ||
                "N/A"
              )}
            </div>

            <div>
              ${escapeHtml(
                data.fvg?.description ||
                ""
              )}
            </div>

          </div>

        </section>


        <!-- PRICE ACTION -->

        <section style="
          background:#111827;
          border-radius:9px;
          padding:12px;
          margin-bottom:10px;
        ">

          <h4 style="
            color:#c084fc;
            margin:0 0 9px;
            font-size:14px;
          ">
            🕯️ Price Action
          </h4>

          <div style="
            font-size:13px;
            line-height:1.6;
          ">

            <div>
              <strong>Confirmation :</strong>
              ${escapeHtml(
                data.price_action?.confirmation ||
                "N/A"
              )}
            </div>

            <div>
              ${escapeHtml(
                data.price_action?.description ||
                ""
              )}
            </div>

          </div>

        </section>


        <!-- SCORE -->

        <section style="
          background:#111827;
          border-radius:9px;
          padding:12px;
          margin-bottom:10px;
        ">

          <h4 style="
            color:#4ed9a2;
            margin:0 0 10px;
            font-size:14px;
          ">
            🎯 Détail du Score ARKAS
          </h4>

          ${scoreRow(
            "Structure",
            data.score_breakdown?.structure,
            25
          )}

          ${scoreRow(
            "Liquidité",
            data.score_breakdown?.liquidity,
            20
          )}

          ${scoreRow(
            "Order Block",
            data.score_breakdown?.order_block,
            15
          )}

          ${scoreRow(
            "FVG",
            data.score_breakdown?.fvg,
            15
          )}

          ${scoreRow(
            "Price Action",
            data.score_breakdown?.price_action,
            15
          )}

          ${scoreRow(
            "Risk / Reward",
            data.score_breakdown?.risk_reward,
            10
          )}

        </section>


        <!-- CONCLUSION -->

        <div style="
          padding:13px;
          border-radius:9px;
          background:rgba(78,217,162,.07);
          border-left:3px solid #4ed9a2;
          font-size:13px;
          line-height:1.6;
        ">

          <strong style="color:#4ed9a2;">
            🧠 Conclusion ARKAS
          </strong>

          <div style="margin-top:6px;">
            ${escapeHtml(
              data.reason ||
              "Analyse terminée."
            )}
          </div>

        </div>


        <!-- WARNING -->

        ${
          data.risk_warning
            ? `
              <div style="
                margin-top:10px;
                font-size:11px;
                color:#94a3b8;
                text-align:center;
              ">
                ⚠️
                ${escapeHtml(
                  data.risk_warning
                )}
              </div>
            `
            : ""
        }

      </div>
    `;
  }

  // ==========================================================
  // CARTES
  // ==========================================================

  function priceCard(label, value, color) {

    return `
      <div style="
        background:#1e293b;
        padding:12px;
        border-radius:8px;
        border-left:4px solid ${color};
      ">

        <div style="
          color:#94a3b8;
          font-size:10px;
          margin-bottom:5px;
        ">
          ${label}
        </div>

        <strong style="
          color:#fff;
          font-size:16px;
        ">
          ${
            value !== null &&
            value !== undefined
              ? escapeHtml(String(value))
              : "N/A"
          }
        </strong>

      </div>
    `;
  }

  function infoCard(label, value) {

    return `
      <div style="
        background:#1e293b;
        padding:10px;
        border-radius:8px;
      ">

        <div style="
          color:#64748b;
          font-size:10px;
        ">
          ${label}
        </div>

        <strong style="
          color:#e2e8f0;
          font-size:13px;
        ">
          ${escapeHtml(String(value))}
        </strong>

      </div>
    `;
  }

  function scoreRow(label, value, max) {

    const score =
      Number(value || 0);

    const percent =
      Math.max(
        0,
        Math.min(
          100,
          (score / max) * 100
        )
      );

    return `
      <div style="
        margin-bottom:9px;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          font-size:11px;
          margin-bottom:4px;
        ">

          <span>
            ${label}
          </span>

          <strong>
            ${score}/${max}
          </strong>

        </div>

        <div style="
          height:5px;
          background:#1e293b;
          border-radius:10px;
          overflow:hidden;
        ">

          <div style="
            width:${percent}%;
            height:100%;
            background:#4ed9a2;
            border-radius:10px;
          "></div>

        </div>

      </div>
    `;
  }

  // ==========================================================
  // ERREUR
  // ==========================================================

  function showError(message) {

    console.error(
      "⚠️ ARKAS ERROR:",
      message
    );

    if (!outputContainer) {
      alert(message);
      return;
    }

    outputContainer.innerHTML = `

      <div style="
        padding:16px;
        border-radius:10px;
        background:rgba(239,68,68,.10);
        border:1px solid rgba(239,68,68,.35);
        color:#fecaca;
      ">

        <strong style="
          color:#ef4444;
        ">
          ⚠️ Erreur ARKAS SCAN AI
        </strong>

        <div style="
          margin-top:8px;
          font-size:13px;
          line-height:1.5;
          word-break:break-word;
        ">
          ${escapeHtml(message)}
        </div>

      </div>
    `;
  }

  // ==========================================================
  // RESET
  // ==========================================================

  function resetFile() {

    selectedFile = null;
    selectedBase64 = null;

    try {
      fileInput.value = "";
    } catch (error) {
      console.warn(error);
    }
  }

  // ==========================================================
  // PROTECTION HTML
  // ==========================================================

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================
  // FIN
  // ==========================================================

  console.log(
    "✅ ARKAS SCAN AI V2 prêt."
  );

});
