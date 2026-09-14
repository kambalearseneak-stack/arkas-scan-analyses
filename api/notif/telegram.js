/* =========================================================
   ARKAS SCAN AI V2 — NOTIFICATIONS TELEGRAM
   Envoie à un utilisateur spécifique (via son userId)
   ========================================================= */

import admin from "firebase-admin";

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

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    try {
        const { userId, message } = req.body || {};

        if (!userId) {
            return res.status(401).json({ error: "userId manquant" });
        }

        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "Message invalide" });
        }

        /* ---- Récupérer le chat_id de l'utilisateur ---- */
        const telegramDoc = await db
            .collection("users")
            .doc(userId)
            .collection("integrations")
            .doc("telegram")
            .get();

        const telegramData = telegramDoc.data();

        if (!telegramData || !telegramData.enabled || !telegramData.chatId) {
            return res.status(400).json({
                error: "Telegram non activé pour cet utilisateur."
            });
        }

        /* ---- Envoyer via le bot unique ---- */
        const botToken = process.env.TELEGRAM_BOT_TOKEN;

        if (!botToken) {
            return res.status(500).json({ error: "Bot token manquant." });
        }

        const safeMessage = message.slice(0, 4000);

        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: telegramData.chatId,
                    text: safeMessage,
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
            return res.status(502).json({
                error: "Telegram a refusé l'envoi.",
                details: data.description
            });
        }

        return res.status(200).json({
            ok: true,
            message_id: data.result?.message_id
        });

    } catch (error) {
        console.error("Notify error:", error);
        return res.status(500).json({ error: error.message });
    }
}
