/**
 * Netlify Function: Solana RPC Proxy
 * 
 * Proxies requests to Solana RPC nodes with CORS headers.
 * This avoids browser CORS restrictions on direct RPC calls.
 */

// Allowed RPC methods (whitelist for security)
const ALLOWED_METHODS = [
    'getBalance',
    'getAccountInfo',
    'getLatestBlockhash',
    'getTokenAccountsByOwner',
    'getTransaction',
];

// RPC endpoints to try (in order)
const RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
];

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const body = JSON.parse(event.body);

        // Validate RPC method is allowed
        if (!ALLOWED_METHODS.includes(body.method)) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: `Method '${body.method}' not allowed` }),
            };
        }

        // Try each RPC endpoint until one works
        let lastError = null;
        for (const rpcUrl of RPC_ENDPOINTS) {
            try {
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    lastError = `${rpcUrl} returned ${response.status}`;
                    continue;
                }

                const data = await response.json();

                if (data.error) {
                    lastError = `${rpcUrl}: ${data.error.message}`;
                    continue;
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(data),
                };
            } catch (err) {
                lastError = `${rpcUrl}: ${err.message}`;
                continue;
            }
        }

        // All endpoints failed
        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({ error: `All RPC endpoints failed. Last error: ${lastError}` }),
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
