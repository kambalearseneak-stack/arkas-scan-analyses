/* =========================================================
   ARKAS SCAN AI V2 — API ACCOUNTS DERIV
   Liste les comptes associés au token
   ========================================================= */

export default async function handler(req, res) {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    try {
        const { derivToken } = req.body;

        if (!derivToken) {
            return res.status(400).json({ error: "derivToken obligatoire." });
        }

        const response = await fetch(
            "https://api.derivws.com/trading/v1/options/accounts",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${derivToken}`,
                    "Deriv-App-ID": "34pbyNrTVwNMucC6ssXhH",
                    "Content-Type": "application/json"
                }
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: errorData.errors?.[0]?.message
                    || `Erreur Deriv (${response.status})`
            });
        }

        const data = await response.json();
        return res.status(200).json({ accounts: data.data || [] });

    } catch (error) {
        console.error("❌ Accounts handler error:", error);
        return res.status(500).json({
            error: error.message || "Erreur interne."
        });
    }
}
