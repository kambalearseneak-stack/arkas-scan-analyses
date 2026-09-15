/* =========================================================
   ARKAS SCAN AI V2 — STATUT TELEGRAM
   Vérifie si l'utilisateur a activé ses notifications
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

        /* ---- Lire le document Telegram de l'utilisateur ---- */
        const doc = await db
            .collection("users")
            .doc(userId)
            .collection("integrations")
            .doc("telegram")
            .get();

        const data = doc.data();

        return res.status(200).json({
            enabled: !!(data && data.enabled && data.chatId),
            chatId: data?.chatId || null,
            firstName: data?.firstName || null
        });

    } catch (error) {
        console.error("❌ Status handler error:", error);
        return res.status(500).json({
            error: error.message || "Erreur interne."
        });
    }
}
