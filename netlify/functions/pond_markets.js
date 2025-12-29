/**
 * DFlow Pond API Proxy
 */

const API_BASE = 'https://prediction-markets-api.dflow.net';
const API_KEY = process.env.POND_API_KEY;

// Simple in-memory rate limiting for function instances (not shared across instances)
let lastRequestTime = 0;
const MIN_INTERVAL_NO_KEY = 5000; // 5 seconds between requests if no API key

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        const queryParams = new URLSearchParams(event.queryStringParameters);

        // Ensure some defaults if not provided
        if (!queryParams.has('withNestedMarkets')) queryParams.append('withNestedMarkets', 'true');
        if (!queryParams.has('limit')) queryParams.append('limit', '100');

        const url = `${API_BASE}/api/v1/events?${queryParams.toString()}`;
        console.log(`[Pond Proxy] Fetching: ${url} (API Key present: ${!!API_KEY})`);

        const requestHeaders = {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (API_KEY) {
            requestHeaders['x-api-key'] = API_KEY;
        } else {
            const now = Date.now();
            if (now - lastRequestTime < MIN_INTERVAL_NO_KEY) {
                console.warn(`[Pond Proxy] Rate limiting request (No API Key)`);
                return {
                    statusCode: 429,
                    headers,
                    body: JSON.stringify({ error: 'Rate limit exceeded (No API Key). Please wait 5 seconds between requests or provide POND_API_KEY.' }),
                };
            }
            lastRequestTime = now;
        }

        const response = await fetch(url, {
            headers: requestHeaders,
        });

        if (!response.ok) {
            console.error(`Pond API Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error(`Response Body: ${errorText}`);
        }

        const data = await response.json();
        console.log(`[Pond Proxy] Status: ${response.status}`);

        return {
            statusCode: response.status,
            headers,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Pond proxy error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch from DFlow Pond API' }),
        };
    }
};
