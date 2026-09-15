/* =========================================================
   ARKAS SCAN AI V2 — DÉSACTIVER TELEGRAM
   Désactive les notifications Telegram pour un utilisateur
   ========================================================= */

import admin from "firebase-admin";

/* ---- Initialisation Firebase Admin (une seule fois) ---- */
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
        })
    });
}

const db = admin.firestore();

export default async function handler(req, res) {

    /* ---- CORS ---- */
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    try {

        const { userId } = req.body || {};

        if (!userId) {
            return res.status(400).json({ error: "userId manquant" });
        }

        /* ---- Mettre enabled = false ---- */
        await db
            .collection("users")
            .doc(userId)
            .collection("integrations")
            .doc("telegram")
            .set({ enabled: false }, { merge: true });

        console.log(`🔕 Telegram désactivé pour user ${userId}`);

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("❌ Disable handler error:", error);
        return res.status(500).json({
            error: error.message || "Erreur interne."
        });
    }
}
