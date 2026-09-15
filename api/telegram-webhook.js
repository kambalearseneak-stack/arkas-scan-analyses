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
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    try {
        const update = req.body;
        const message = update?.message;
        if (!message) return res.status(200).json({ ok: true });

        const chatId = message.chat?.id;
        const text = message.text || "";
        const firstName = message.from?.first_name || "Utilisateur";

        if (!chatId) return res.status(200).json({ ok: true });

        if (text.startsWith("/start")) {
            const parts = text.split(" ");
            const userId = parts[1];

            if (userId) {
                await db
                    .collection("users").doc(userId)
                    .collection("integrations").doc("telegram")
                    .set({
                        chatId: String(chatId),
                        firstName: firstName,
                        enabled: true,
                        activatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                await sendMessage(chatId, `✅ <b>Notifications ARKAS activées !</b>\n\nBienvenue ${firstName} 🎯`);
            }
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(200).json({ ok: true });
    }
}

async function sendMessage(chatId, text) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
    });
}
