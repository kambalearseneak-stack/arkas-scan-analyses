/* =========================================================
   ARKAS SCAN AI V2 — NOTIFICATIONS TELEGRAM
   ========================================================= */

export default async function handler(req, res) {

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

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            return res.status(500).json({
                error: "TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant dans Vercel."
            });
        }

        const { message } = req.body || {};

        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "Message manquant ou invalide" });
        }

        const safeMessage = message.slice(0, 4000);

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: safeMessage,
                parse_mode: "HTML",
                disable_web_page_preview: true
            })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            console.error("Telegram API error:", data);
            return res.status(502).json({
                error: "Telegram a refusé l'envoi.",
                details: data.description || "Erreur inconnue"
            });
        }

        return res.status(200).json({
            ok: true,
            message_id: data.result?.message_id
        });

    } catch (error) {
        console.error("Telegram handler error:", error);
        return res.status(500).json({ error: error.message || "Erreur interne" });
    }
}
