/* =========================================================
   ARKAS SCAN AI V2 — WEBHOOK TELEGRAM
   Reçoit les messages du bot et enregistre les chat_id
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

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    try {
        const update = req.body;

        /* ---- Récupérer le message ---- */
        const message = update?.message;
        if (!message) {
            return res.status(200).json({ ok: true });
        }

        const chatId = message.chat?.id;
        const text = message.text || "";
        const firstName = message.from?.first_name || "Utilisateur";

        if (!chatId) {
            return res.status(200).json({ ok: true });
        }

        /* ---- Commande /start USER_ID ---- */
        if (text.startsWith("/start")) {

            const parts = text.split(" ");
            const userId = parts[1]; // le USER_ID passé dans le lien

            if (!userId) {
                await sendTelegramMessage(
                    chatId,
                    `👋 Bonjour ${firstName} !\n\n` +
                    `Pour activer les notifications ARKAS, ` +
                    `clique sur le lien depuis ton dashboard ARKAS.`
                );
                return res.status(200).json({ ok: true });
            }

            /* ---- Enregistrer dans Firebase ---- */
            try {
                await db
                    .collection("users")
                    .doc(userId)
                    .collection("integrations")
                    .doc("telegram")
                    .set({
                        chatId: String(chatId),
                        firstName: firstName,
                        enabled: true,
                        activatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                console.log(`✅ Telegram activé pour user ${userId} (chat ${chatId})`);

                await sendTelegramMessage(
                    chatId,
                    `✅ <b>Notifications ARKAS activées !</b>\n\n` +
                    `Tu recevras désormais :\n` +
                    `• Les signaux ARKAS\n` +
                    `• Les alertes break-even\n` +
                    `• Les mises à jour importantes\n\n` +
                    `Bienvenue ${firstName} 🎯`
                );

            } catch (err) {
                console.error("Firebase save error:", err);
                await sendTelegramMessage(
                    chatId,
                    `❌ Erreur lors de l'activation. Réessaie.`
                );
            }

            return res.status(200).json({ ok: true });
        }

        /* ---- Autres commandes ---- */
        if (text === "/stop") {

            /* On ne peut pas identifier l'utilisateur directement ici
               → l'utilisateur doit utiliser le lien depuis son dashboard
               pour désactiver. */

            await sendTelegramMessage(
                chatId,
                `Pour désactiver les notifications, ` +
                `va sur ton dashboard ARKAS.`
            );
            return res.status(200).json({ ok: true });
        }

        /* ---- Commande inconnue ---- */
        await sendTelegramMessage(
            chatId,
            `🤖 Commandes disponibles :\n` +
            `/start <userId> — activer\n` +
            `/stop — aide`
        );

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("Webhook error:", error);
        return res.status(200).json({ ok: true });
    }
}


/* =========================================================
   ENVOI DE MESSAGE TELEGRAM
   ========================================================= */

async function sendTelegramMessage(chatId, text) {

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        console.error("TELEGRAM_BOT_TOKEN manquant");
        return;
    }

    try {
        await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                })
            }
        );
    } catch (err) {
        console.error("Telegram send error:", err);
    }
}
