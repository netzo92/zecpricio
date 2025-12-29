/**
 * CoinMarketCap API Proxy
 * Hides API key from frontend
 */

const API_KEY = process.env.CMC_API_KEY;
const API_BASE = 'https://pro-api.coinmarketcap.com/v1';

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-CMC_PRO_API_KEY',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!API_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'CMC API key not configured' }) };
    }

    // Get the endpoint from query params
    const endpoint = event.queryStringParameters?.endpoint;

    if (!endpoint) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing endpoint parameter' }) };
    }

    // Whitelist allowed endpoints (regex to allow parameters)
    const allowedEndpoints = [
        /^cryptocurrency\/quotes\/latest/,
        /^cryptocurrency\/ohlcv\/historical/,
        /^cryptocurrency\/info/
    ];

    const isAllowed = allowedEndpoints.some(pattern => pattern.test(endpoint));
    if (!isAllowed) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Endpoint not allowed' }) };
    }

    try {
        // Reconstruct the URL with original query parameters except 'endpoint'
        const queryParams = new URLSearchParams(event.queryStringParameters);
        queryParams.delete('endpoint');

        // Some CMC endpoints might already have '?' in them if incorrectly passed
        const separator = endpoint.includes('?') ? '&' : '?';
        const queryString = queryParams.toString();
        const url = `${API_BASE}/${endpoint}${queryString ? separator + queryString : ''}`;

        const response = await fetch(url, {
            headers: {
                'X-CMC_PRO_API_KEY': API_KEY,
                'Accept': 'application/json'
            },
        });

        const data = await response.json();

        return {
            statusCode: response.status,
            headers,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('CMC proxy error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch from CoinMarketCap' }),
        };
    }
};
