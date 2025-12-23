#!/usr/bin/env node
/**
 * Daily Shielded Pool Data Updater
 * 
 * Fetches the latest block and updates/appends to shielded-pool-data.json
 * Designed to run via GitHub Actions daily.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = process.env.ZCASH_RPC_URL || 'http://127.0.0.1:8232';
const DATA_FILE = path.join(__dirname, '..', 'shielded-pool-data.json');

// RPC helper
async function rpcCall(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'daily-update', method, params })
  });
  const json = await response.json();
  if (json.error) throw new Error(`RPC Error: ${json.error.message}`);
  return json.result;
}

// Get date string (YYYY-MM-DD) from Unix timestamp
function getDateKey(timestamp) {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

async function main() {
  console.log('📊 Shielded Pool Daily Update');
  console.log('─'.repeat(40));
  
  // Load existing data
  let jsonData;
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    jsonData = JSON.parse(raw);
    console.log(`✓ Loaded ${jsonData.data.length} existing entries`);
  } catch (err) {
    console.error('✗ Failed to load existing data:', err.message);
    process.exit(1);
  }
  
  // Fetch latest block
  console.log('→ Fetching latest block...');
  const height = await rpcCall('getblockcount');
  const block = await rpcCall('getblock', [String(height), 1]);
  
  // Extract shielded pool values
  const pools = block.valuePools || [];
  const sprout = (pools.find(p => p.id === 'sprout')?.chainValueZat || 0) / 1e8;
  const sapling = (pools.find(p => p.id === 'sapling')?.chainValueZat || 0) / 1e8;
  const orchard = (pools.find(p => p.id === 'orchard')?.chainValueZat || 0) / 1e8;
  const total = sprout + sapling + orchard;
  
  const newEntry = {
    t: block.time,
    h: height,
    sp: Math.round(sprout * 100) / 100,
    sa: Math.round(sapling * 100) / 100,
    or: Math.round(orchard * 100) / 100,
    v: Math.round(total * 100) / 100
  };
  
  const newDateKey = getDateKey(block.time);
  console.log(`✓ Block ${height} | ${newDateKey} | Total: ${total.toLocaleString()} ZEC`);
  
  // Check if we should update the last entry or append
  const lastEntry = jsonData.data[jsonData.data.length - 1];
  const lastDateKey = getDateKey(lastEntry.t);
  
  if (lastDateKey === newDateKey) {
    // Same day - update in place
    console.log(`→ Updating existing entry for ${newDateKey}`);
    jsonData.data[jsonData.data.length - 1] = newEntry;
  } else {
    // New day - append
    console.log(`→ Appending new entry for ${newDateKey}`);
    jsonData.data.push(newEntry);
  }
  
  // Update metadata
  jsonData.lastUpdated = new Date().toISOString();
  jsonData.latestBlock = height;
  
  // Write back
  fs.writeFileSync(DATA_FILE, JSON.stringify(jsonData, null, 2));
  console.log('✓ Saved to shielded-pool-data.json');
  console.log('─'.repeat(40));
  console.log(`Total entries: ${jsonData.data.length}`);
}

main().catch(err => {
  console.error('✗ Fatal error:', err.message);
  process.exit(1);
});

