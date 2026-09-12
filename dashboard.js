/* =========================================================
   ARKAS SCAN AI V2 — DASHBOARD
   Scanner + Audit + Détection auto + Stratégie adaptative
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       RÉFÉRENCES DOM
       ========================================================= */

    const fileInput = document.getElementById("chart-file");
    const importBtn = document.getElementById("import-btn");
    const dropZone = document.getElementById("dropZone");

    const previewContainer = document.getElementById("preview-container");
    const imagePreview = document.getElementById("image-preview");
    const fileName = document.getElementById("file-name");

    const detectedInfo = document.getElementById("detected-info");
    const detectedAsset = document.getElementById("detected-asset");
    const detectedTimeframe = document.getElementById("detected-timeframe");

    const scannerActions = document.getElementById("scanner-actions");
    const analyzeBtn = document.getElementById("analyze-btn");
    const auditBtn = document.getElementById("auditBtn");

    const analysisStatus = document.getElementById("analysis-status");

    const resultsSection = document.getElementById("results-section");
    const resultsContent = document.getElementById("results-content");

    let selectedFile = null;
    let selectedBase64 = null;
    let selectedMimeType = null;
    let isProcessing = false;

    /* =========================================================
       INITIALISATION
       ========================================================= */

    if (scannerActions) scannerActions.style.display = "none";
    if (detectedInfo) detectedInfo.style.display = "none";
    if (resultsSection) resultsSection.style.display = "none";

    /* =========================================================
       IMPORTATION
       ========================================================= */

    if (importBtn && fileInput) {
        importBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isProcessing) fileInput.click();
        });
    }

    if (dropZone && fileInput) {

        dropZone.addEventListener("click", (event) => {
            if (event.target.closest("button")) return;
            if (!isProcessing) fileInput.click();
        });

        dropZone.addEventListener("keydown", (event) => {
            if ((event.key === "Enter" || event.key === " ") && !isProcessing) {
                event.preventDefault();
                fileInput.click();
            }
        });

        dropZone.addEventListener("dragover", (event) => {
            event.preventDefault();
            if (!isProcessing) dropZone.classList.add("drag-over");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", (event) => {
            event.preventDefault();
            dropZone.classList.remove("drag-over");
            if (isProcessing) return;

            const files = event.dataTransfer.files;
            if (files && files.length > 0) handleFile(files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (!fileInput.files || !fileInput.files.length) return;
            handleFile(fileInput.files[0]);
        });
    }

    /* =========================================================
       GESTION DU FICHIER
       ========================================================= */

    function handleFile(file) {

        if (!file) return;

        stopScanAnimation();

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxSize = 10 * 1024 * 1024;

        if (!allowedTypes.includes(file.type)) {
            showStatus("❌ Format non supporté. Utilise JPG, PNG ou WEBP.", "error");
            return;
        }

        if (file.size > maxSize) {
            showStatus("❌ Image trop lourde. Maximum : 10 MB.", "error");
            return;
        }

        selectedFile = file;
        selectedMimeType = file.type;

        showStatus("📷 Capture importée. Préparation du scanner…", "info");

        const reader = new FileReader();

        reader.onload = (event) => {

            selectedBase64 = event.target.result;

            if (imagePreview) {
                imagePreview.src = selectedBase64;
                imagePreview.style.display = "block";
            }

            if (fileName) fileName.textContent = file.name;
            if (previewContainer) previewContainer.style.display = "block";
            if (detectedInfo) detectedInfo.style.display = "block";

            if (detectedAsset) detectedAsset.textContent = "Détection automatique…";
            if (detectedTimeframe) detectedTimeframe.textContent = "Détection automatique…";

            if (scannerActions) scannerActions.style.display = "flex";
            if (resultsSection) resultsSection.style.display = "none";

            setupScanOverlay();

            showStatus("✅ Capture prête. Choisis SCANNER ou AUDITER.", "success");

            if (scannerActions) {
                setTimeout(() => {
                    scannerActions.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest"
                    });
                }, 100);
            }

            if (fileInput) fileInput.value = "";
        };

        reader.onerror = () => {
            showStatus("❌ Impossible de lire cette image.", "error");
        };

        reader.readAsDataURL(file);
    }

    /* =========================================================
       EFFET SCAN
       ========================================================= */

    function setupScanOverlay() {

        if (!imagePreview) return null;

        let wrapper = imagePreview.closest(".scan-image-wrapper");
        if (wrapper) return wrapper;

        wrapper = document.createElement("div");
        wrapper.className = "scan-image-wrapper";

        imagePreview.parentNode.insertBefore(wrapper, imagePreview);
        wrapper.appendChild(imagePreview);

        const overlay = document.createElement("div");
        overlay.className = "scan-overlay";
