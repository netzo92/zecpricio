/**
 * CoinGecko API Proxy
 * Fallback to public API if no Pro key is configured
 */

const API_KEY = process.env.COINGECKO_API_KEY;
const API_BASE_PRO = 'https://pro-api.coingecko.com/api/v3';
const API_BASE_PUBLIC = 'https://api.coingecko.com/api/v3';

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-cg-pro-api-key',
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

  const isAllowed = allowedEndpoints.some(allowed => endpoint.startsWith(allowed));
  if (!isAllowed) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Endpoint not allowed' }) };
  }

  try {
    // Reconstruct query parameters
    const queryParams = new URLSearchParams(event.queryStringParameters);
    queryParams.delete('endpoint');
    const queryString = queryParams.toString();

    // Choose base URL and headers based on API key availability
    const baseUrl = API_KEY ? API_BASE_PRO : API_BASE_PUBLIC;
    const fetchHeaders = {};
    if (API_KEY) {
      fetchHeaders['x-cg-pro-api-key'] = API_KEY;
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${baseUrl}/${endpoint}${queryString ? separator + queryString : ''}`;

    const response = await fetch(url, { headers: fetchHeaders });
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

