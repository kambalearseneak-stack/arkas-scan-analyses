<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>ARKAS SCAN AI V2</title>

    <meta
        name="description"
        content="ARKAS SCAN AI V2 — Analyse de graphiques avec Smart Money Concepts et Price Action."
    >

    <link rel="stylesheet" href="style.css">

    <style>
        /* ================= SCANNER CONTROLS ================= */

        .scanner-controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
        }

        .scanner-control label {
            display: block;
            margin-bottom: 7px;
            font-size: 13px;
            opacity: .75;
        }

        .scanner-control select {
            width: 100%;
            padding: 12px;
            border-radius: 10px;
            background: #101b2d;
            color: #fff;
            border: 1px solid rgba(255,255,255,.15);
            outline: none;
        }

        .scanner-control select:focus {
            border-color: rgba(0,255,150,.6);
        }

        /* ================= ACTION BUTTONS ================= */

        .preview-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 20px;
        }

        .preview-actions button {
            min-height: 52px;
            font-size: 15px;
            font-weight: 700;
        }

        #analyze-btn {
            min-width: 0;
        }

        #auditBtn {
            min-width: 0;
        }

        #analyze-btn:disabled,
        #auditBtn:disabled {
            opacity: .45;
            cursor: not-allowed;
        }

        #analyze-btn:not(:disabled),
        #auditBtn:not(:disabled) {
            cursor: pointer;
        }

        /* ================= PREVIEW ================= */

        .preview-container.hidden {
            display: none;
        }

        .preview-container {
            margin-top: 20px;
        }

        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }

        .preview-image-wrapper {
            width: 100%;
            overflow: hidden;
            border-radius: 14px;
        }

        #image-preview {
            display: block;
            width: 100%;
            max-height: 600px;
            object-fit: contain;
            border-radius: 14px;
        }

        /* ================= STATUS ================= */

        .scanner-status {
            text-align: center;
            margin-top: 10px;
            font-size: 13px;
            opacity: .75;
        }

        /* ================= RESPONSIVE ================= */

        @media (max-width: 700px) {

            .scanner-controls {
                grid-template-columns: 1fr;
            }

            .preview-actions {
                grid-template-columns: 1fr;
            }

        }
    </style>
</head>

<body class="dashboard-body">

    <div class="bg-overlay"></div>

    <!-- =====================================================
         NAVBAR
    ====================================================== -->

    <header class="navbar">

        <div class="logo">
            <h2>ARKAS SCAN AI</h2>
            <span>V2</span>
        </div>

        <div class="user-menu">

            <span id="user-status" class="header-status">
                Vérification...
            </span>

            <span id="user-email">
                Chargement...
            </span>

            <button
                id="logout-btn"
                class="btn-secondary"
                type="button"
            >
                Déconnexion
            </button>

        </div>

    </header>


    <!-- =====================================================
         CONTENU
    ====================================================== -->

    <main class="dashboard-container">


        <!-- =================================================
             SCANNER
        ================================================== -->

        <section class="card upload-section">

            <div class="section-header">

                <div>

                    <h3>Scanner un graphique</h3>

                    <p>
                        Importez une capture d'écran de votre graphique.
                        ARKAS SCAN AI analyse la structure du marché,
                        la liquidité, les Order Blocks, les FVG,
                        le BOS, le CHoCH et le Price Action.
                    </p>

                </div>

                <div class="engine-badge">
                    ARKAS AI
                </div>

            </div>


            <!-- =================================================
                 MARCHÉ + TIMEFRAME
            ================================================== -->

            <div class="scanner-controls">

                <!-- MARCHÉ -->

                <div class="scanner-control">

                    <label for="assetSelect">
                        MARCHÉ
                    </label>

                    <select
                        id="assetSelect"
                        name="asset"
                    >

                        <option value="AUTO">
                            Détection automatique
                        </option>

                        <option value="XAUUSD">
                            Gold / XAUUSD
                        </option>

                        <option value="BTCUSD">
                            Bitcoin / BTCUSD
                        </option>

                        <option value="ETHUSD">
                            Ethereum / ETHUSD
                        </option>

                        <option value="EURUSD">
                            EUR/USD
                        </option>

                        <option value="GBPUSD">
                            GBP/USD
                        </option>

                        <option value="USDJPY">
                            USD/JPY
                        </option>

                        <option value="AUDUSD">
                            AUD/USD
                        </option>

                        <option value="USDCAD">
                            USD/CAD
                        </option>

                        <option value="USDCHF">
                            USD/CHF
                        </option>

                        <option value="NAS100">
                            NAS100
                        </option>

                        <option value="US30">
                            US30
                        </option>

                        <option value="SPX500">
                            S&P 500
                        </option>

                        <option value="OTHER">
                            Autre
                        </option>

                    </select>

                </div>


                <!-- TIMEFRAME -->

                <div class="scanner-control">

                    <label for="timeframeSelect">
                        TIMEFRAME
                    </label>

                    <select
                        id="timeframeSelect"
                        name="timeframe"
                    >

                        <option value="AUTO">
                            Détection automatique
                        </option>

                        <option value="M1">
                            M1
                        </option>

                        <option value="M5">
                            M5
                        </option>

                        <option value="M15">
                            M15
                        </option>

                        <option value="M30">
                            M30
                        </option>

                        <option value="H1">
                            H1
                        </option>

                        <option value="H4">
                            H4
                        </option>

                        <option value="D1">
                            D1
                        </option>

                    </select>

                </div>

            </div>


            <!-- =================================================
                 ZONE IMPORT
            ================================================== -->

            <div
                class="drop-zone"
                id="dropZone"
                role="button"
                tabindex="0"
                aria-label="Importer un graphique"
            >

                <input
                    type="file"
                    id="chart-file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    hidden
                >

                <div class="upload-icon">
                    📊
                </div>

                <h4>
                    Importer votre graphique
                </h4>

                <p>
                    Glissez-déposez votre capture ici
                </p>

                <p class="upload-or">
                    ou
                </p>

                <label
                    for="chart-file"
                    class="browse-label"
                >
                    📁 Parcourir les fichiers
                </label>

                <small>
                    JPG, PNG ou WebP — maximum 10 MB
                </small>

            </div>


            <!-- =================================================
                 APERÇU
            ================================================== -->

            <div
                id="preview-container"
                class="preview-container hidden"
            >

                <div class="preview-header">

                    <h4>
                        👁️ Aperçu du graphique
                    </h4>

                    <span id="file-name">
                        Graphique sélectionné
                    </span>

                </div>


                <div class="preview-image-wrapper">

                    <img
                        id="image-preview"
                        src=""
                        alt="Aperçu du graphique"
                    >

                </div>


                <!-- =================================================
                     BOUTONS
                ================================================== -->

                <div class="preview-actions">

                    <!-- ANALYSE AUTONOME -->

                    <button
                        id="analyze-btn"
                        class="btn-primary"
                        type="button"
                        disabled
                    >
                        🔍 ANALYSER LE GRAPHIQUE
                    </button>


                    <!-- AUDIT -->

                    <button
                        id="auditBtn"
                        class="btn-secondary"
                        type="button"
                        disabled
                    >
                        🧪 VÉRIFIER MON ANALYSE
                    </button>

                </div>


                <p
                    id="scan-help"
                    class="scanner-status"
                >
                    Sélectionnez d'abord un graphique.
                </p>

            </div>

        </section>


        <!-- =================================================
             RESULTATS
        ================================================== -->

        <section class="card results-section">

            <div class="section-header">

                <div>

                    <h3>
                        Rapport & Signaux SMC
                    </h3>

                    <p>
                        Résultat de l'analyse du graphique.
                    </p>

                </div>

                <div
                    id="analysis-status"
                    class="analysis-status"
                >
                    En attente
                </div>

            </div>


            <div
                id="results-content"
                class="results-content"
            >

                <div class="placeholder-text">

                    <div class="placeholder-icon">
                        📈
                    </div>

                    <h4>
                        Aucun graphique analysé
                    </h4>

                    <p>
                        Importez un graphique puis choisissez
                        une action :
                    </p>

                    <ul class="analysis-list">

                        <li>
                            🔍 Analyser le graphique
                        </li>

                        <li>
                            🧪 Vérifier mon analyse
                        </li>

                        <li>
                            Direction BUY / SELL / WAIT
                        </li>

                        <li>
                            Score ARKAS /100
                        </li>

                        <li>
                            Entry
                        </li>

                        <li>
                            Stop Loss
                        </li>

                        <li>
                            Take Profit 1 / 2 / 3
                        </li>

                        <li>
                            Risk / Reward
                        </li>

                        <li>
                            BOS / CHoCH
                        </li>

                        <li>
                            Order Block
                        </li>

                        <li>
                            Fair Value Gap
                        </li>

                        <li>
                            Liquidité
                        </li>

                        <li>
                            Price Action
                        </li>

                    </ul>

                </div>

            </div>

        </section>


        <!-- =================================================
             METHODE
        ================================================== -->

        <section class="card method-section">

            <h3>
                Comment fonctionne ARKAS SCAN AI ?
            </h3>

            <div class="method-grid">


                <!-- 01 -->

                <div class="method-item">

                    <div class="method-icon">
                        01
                    </div>

                    <h4>
                        Structure
                    </h4>

                    <p>
                        Détection du BOS, du CHoCH et de la
                        tendance dominante du marché.
                    </p>

                </div>


                <!-- 02 -->

                <div class="method-item">

                    <div class="method-icon">
                        02
                    </div>

                    <h4>
                        Liquidité
                    </h4>

                    <p>
                        Recherche des zones de liquidité et
                        des éventuels balayages de liquidité.
                    </p>

                </div>


                <!-- 03 -->

                <div class="method-item">

                    <div class="method-icon">
                        03
                    </div>

                    <h4>
                        OB & FVG
                    </h4>

                    <p>
                        Identification des Order Blocks et
                        Fair Value Gaps.
                    </p>

                </div>


                <!-- 04 -->

                <div class="method-item">

                    <div class="method-icon">
                        04
                    </div>

                    <h4>
                        Validation
                    </h4>

                    <p>
                        Vérification de l'entrée, du Stop Loss,
                        des Take Profits et du Risk/Reward.
                    </p>

                </div>

            </div>

        </section>


        <!-- =================================================
             AVERTISSEMENT
        ================================================== -->

        <section class="risk-notice">

            <strong>
                ⚠️ Avertissement
            </strong>

            <p>
                ARKAS SCAN AI fournit une analyse technique
                basée sur les informations visibles sur le
                graphique. Ce résultat ne constitue pas une
                garantie de profit ni un conseil financier.
                Vérifiez toujours l'analyse avant de prendre
                une décision de trading.
            </p>

        </section>

    </main>


    <!-- =====================================================
         SCRIPTS
    ====================================================== -->

    <script
        type="module"
        src="app.js"
    ></script>

    <script
        type="module"
        src="dashboard.js"
    ></script>

</body>
</html>
