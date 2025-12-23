/**
 * CoinGecko API Proxy
 * Hides API key from frontend
 */

const API_KEY = process.env.COINGECKO_API_KEY;
const API_BASE = 'https://pro-api.coingecko.com/api/v3';

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  // Get the endpoint from query params
  const endpoint = event.queryStringParameters?.endpoint;
  
  if (!endpoint) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing endpoint parameter' }) };
  }

  // Whitelist allowed endpoints
  const allowedEndpoints = [
    'simple/price',
    'coins/zcash',
    'coins/zcash/market_chart'
  ];

  // Check if endpoint starts with any allowed endpoint
  const isAllowed = allowedEndpoints.some(allowed => endpoint.startsWith(allowed));
  if (!isAllowed) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Endpoint not allowed' }) };
  }

  try {
    const url = `${API_BASE}/${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'x-cg-pro-api-key': API_KEY,
      },
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('CoinGecko proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch from CoinGecko' }),
    };
  }
};

