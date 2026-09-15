export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

    try {
        const { accountId, derivToken } = req.body;
        if (!accountId || !derivToken) {
            return res.status(400).json({ error: "accountId et derivToken obligatoires." });
        }

        const otpUrl = `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`;

        const response = await fetch(otpUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${derivToken}`,
                "Deriv-App-ID": "1089",
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: errorData.errors?.[0]?.message || `Erreur Deriv (${response.status})`
            });
        }

        const data = await response.json();
        const wsUrl = data?.data?.url;

        if (!wsUrl) return res.status(502).json({ error: "Pas d'URL WebSocket." });

        return res.status(200).json({ wsUrl });
    } catch (error) {
        return res.status(500).json({ error: error.message || "Erreur interne." });
    }
}
