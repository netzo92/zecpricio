#!/usr/bin/env node

/**
 * Fetch Shielded Pool Historical Data
 * 
 * This script connects to a Zcash node via JSON-RPC and collects
 * historical data for all three shielded pools (Sprout, Sapling, Orchard).
 * 
 * Usage:
 *   node scripts/fetch-shielded-data.js
 * 
 * Environment variables:
 *   ZCASH_RPC_URL      - RPC endpoint (default: http://127.0.0.1:8232/)
 *   ZCASH_RPC_USER     - RPC username (default: none)
 *   ZCASH_RPC_PASSWORD - RPC password (default: none)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Zcash node RPC settings
  rpcUrl: process.env.ZCASH_RPC_URL || 'http://127.0.0.1:8232/',
  rpcUser: process.env.ZCASH_RPC_USER || '',
  rpcPassword: process.env.ZCASH_RPC_PASSWORD || '',
  
  // Start from genesis (block 1)
  startBlock: 1,
  
  // Sample every N blocks (576 blocks ≈ 1 day at 576 blocks/day)
  sampleInterval: 576,
  
  // Output file path
  outputPath: path.join(__dirname, '..', 'shielded-pool-data.json'),
  
  // Request timeout in ms
  timeout: 30000,
  
  // Delay between requests (ms) - set to 0 for max speed
  requestDelay: 0,
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 1000,
};

// Pool activation blocks for reference
const POOL_ACTIVATIONS = {
  sprout: 1,           // Genesis (Oct 28, 2016)
  sapling: 419200,     // Oct 28, 2018
  orchard: 1687104,    // May 31, 2022
};

// ============================================================================
// RPC Client
// ============================================================================

async function rpcCall(method, params = []) {
  const auth = CONFIG.rpcUser && CONFIG.rpcPassword
    ? `${CONFIG.rpcUser}:${CONFIG.rpcPassword}@`
    : '';
  
  const url = CONFIG.rpcUrl.replace('://', `://${auth}`);
  
  const body = JSON.stringify({
    jsonrpc: '1.0',
    id: 'shielded-fetch',
    method,
    params,
  });

  let lastError;
  
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }
      
      return data.result;
    } catch (err) {
      lastError = err;
      
      if (attempt < CONFIG.maxRetries) {
        console.warn(`  ⚠ Attempt ${attempt} failed, retrying in ${CONFIG.retryDelay}ms...`);
        await sleep(CONFIG.retryDelay);
      }
    }
  }
  
  throw lastError;
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatZEC(zatoshis) {
  return zatoshis / 1e8;
}

function formatNumber(num) {
  return num.toLocaleString('en-US');
}

function formatZECDisplay(zec) {
  return zec.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// Main Data Fetching
// ============================================================================

async function getBlockCount() {
  return await rpcCall('getblockcount');
}

async function getBlock(height, verbosity = 1) {
  // Height must be passed as a string
  return await rpcCall('getblock', [String(height), verbosity]);
}

function extractShieldedPools(block) {
  const pools = block.valuePools || [];
  
  const sprout = pools.find(p => p.id === 'sprout')?.chainValueZat || 0;
  const sapling = pools.find(p => p.id === 'sapling')?.chainValueZat || 0;
  const orchard = pools.find(p => p.id === 'orchard')?.chainValueZat || 0;
  
  return {
    sprout: formatZEC(sprout),
    sapling: formatZEC(sapling),
    orchard: formatZEC(orchard),
    total: formatZEC(sprout + sapling + orchard),
  };
}

async function fetchShieldedData() {
  console.log('🔐 Zcash Shielded Pool Data Fetcher\n');
  console.log(`RPC Endpoint: ${CONFIG.rpcUrl}`);
  console.log(`Start Block:  ${formatNumber(CONFIG.startBlock)} (genesis)`);
  console.log(`Sample Rate:  Every ${formatNumber(CONFIG.sampleInterval)} blocks (~daily)\n`);
  
  console.log('📋 Pool Activation Blocks:');
  console.log(`   Sprout:  Block ${formatNumber(POOL_ACTIVATIONS.sprout)} (Oct 2016)`);
  console.log(`   Sapling: Block ${formatNumber(POOL_ACTIVATIONS.sapling)} (Oct 2018)`);
  console.log(`   Orchard: Block ${formatNumber(POOL_ACTIVATIONS.orchard)} (May 2022)\n`);
  
  // Get current block height
  console.log('📡 Connecting to Zcash node...');
  let currentHeight;
  
  try {
    currentHeight = await getBlockCount();
    console.log(`✓ Connected! Current height: ${formatNumber(currentHeight)}\n`);
  } catch (err) {
    console.error('✗ Failed to connect to Zcash node:', err.message);
    console.error('\nMake sure:');
    console.error('  1. Your Zcash node is running');
    console.error('  2. RPC is enabled in zcash.conf (server=1)');
    console.error('  3. The RPC URL, user, and password are correct');
    process.exit(1);
  }
  
  // Calculate blocks to fetch
  const blocksToFetch = [];
  for (let h = CONFIG.startBlock; h <= currentHeight; h += CONFIG.sampleInterval) {
    blocksToFetch.push(h);
  }
  
  // Always include the latest block
  if (blocksToFetch[blocksToFetch.length - 1] !== currentHeight) {
    blocksToFetch.push(currentHeight);
  }
  
  console.log(`📊 Fetching ${formatNumber(blocksToFetch.length)} data points...\n`);
  
  const data = [];
  const startTime = Date.now();
  
  for (let i = 0; i < blocksToFetch.length; i++) {
    const height = blocksToFetch[i];
    
    try {
      const block = await getBlock(height);
      const pools = extractShieldedPools(block);
      
      data.push({
        t: block.time,       // Unix timestamp
        h: height,           // Block height
        sp: pools.sprout,    // Sprout pool (ZEC)
        sa: pools.sapling,   // Sapling pool (ZEC)
        or: pools.orchard,   // Orchard pool (ZEC)
        v: pools.total,      // Total shielded (ZEC)
      });
      
      // Log each block
      const lastEntry = data[data.length - 1];
      const date = new Date(lastEntry.t * 1000).toISOString().split('T')[0];
      
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (blocksToFetch.length - i - 1) / rate;
      const eta = remaining > 0 ? `ETA ${Math.ceil(remaining)}s` : 'done';
      
      console.log(`[${i + 1}/${blocksToFetch.length}] Block ${formatNumber(height)} | ${date} | ${formatZECDisplay(lastEntry.v)} ZEC total | ${eta}`);
      
      // Optional delay
      if (CONFIG.requestDelay > 0) {
        await sleep(CONFIG.requestDelay);
      }
      
    } catch (err) {
      console.error(`\n✗ Failed to fetch block ${height}:`, err.message);
      // Continue with next block
    }
  }
  
  console.log('');
  
  // Write output file
  console.log(`💾 Writing ${formatNumber(data.length)} records to ${CONFIG.outputPath}...`);
  
  const output = {
    meta: {
      generated: new Date().toISOString(),
      startBlock: CONFIG.startBlock,
      endBlock: currentHeight,
      sampleInterval: CONFIG.sampleInterval,
      dataPoints: data.length,
      pools: ['sprout', 'sapling', 'orchard'],
      poolActivations: POOL_ACTIVATIONS,
    },
    data,
  };
  
  fs.writeFileSync(CONFIG.outputPath, JSON.stringify(output, null, 2));
  
  const fileSizeKB = (fs.statSync(CONFIG.outputPath).size / 1024).toFixed(1);
  console.log(`✓ Done! File size: ${fileSizeKB} KB\n`);
  
  // Summary
  const latest = data[data.length - 1];
  const maxTotal = Math.max(...data.map(d => d.v));
  
  console.log('📈 Summary:');
  console.log(`   Latest Total Shielded: ${formatZECDisplay(latest.v)} ZEC`);
  console.log(`     ├─ Sprout:  ${formatZECDisplay(latest.sp)} ZEC`);
  console.log(`     ├─ Sapling: ${formatZECDisplay(latest.sa)} ZEC`);
  console.log(`     └─ Orchard: ${formatZECDisplay(latest.or)} ZEC`);
  console.log(`   All-Time High:         ${formatZECDisplay(maxTotal)} ZEC`);
  console.log(`   Time Range:            ${new Date(data[0].t * 1000).toLocaleDateString()} → ${new Date(latest.t * 1000).toLocaleDateString()}`);
}

// ============================================================================
// Entry Point
// ============================================================================

fetchShieldedData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

