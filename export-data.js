#!/usr/bin/env node
/**
 * Export Powerball data to JSON for dashboard
 * Run this whenever you want to update the dashboard data
 * 
 * Usage: node export-dashboard-data.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'lottery-data', 'powerball-results.json');
const OUTPUT_FILE = path.join(__dirname, 'data.json');

function exportData() {
  console.log('📊 Exporting Powerball data for dashboard...');
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  // Sort by date
  const sorted = data.draws.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate number frequencies
  const numberFreq = {};
  const powerballFreq = {};
  
  sorted.forEach(draw => {
    draw.numbers.forEach(num => {
      numberFreq[num] = (numberFreq[num] || 0) + 1;
    });
    powerballFreq[draw.powerball] = (powerballFreq[draw.powerball] || 0) + 1;
  });
  
  // Calculate rankings
  const rankedNumbers = Object.entries(numberFreq)
    .map(([num, count]) => ({ num: parseInt(num), count }))
    .sort((a, b) => b.count - a.count);
  
  const rankedPowerballs = Object.entries(powerballFreq)
    .map(([num, count]) => ({ num: parseInt(num), count }))
    .sort((a, b) => b.count - a.count);
  
  // Calculate gaps (how long since last seen)
  const lastSeen = {};
  for (let i = 1; i <= 50; i++) lastSeen[i] = -1;
  
  sorted.forEach((draw, idx) => {
    draw.numbers.forEach(num => {
      lastSeen[num] = idx;
    });
  });
  
  const lastDrawIndex = sorted.length - 1;
  const gaps = {};
  for (let i = 1; i <= 50; i++) {
    if (lastSeen[i] !== -1) {
      gaps[i] = lastDrawIndex - lastSeen[i];
    }
  }
  
  // Calculate consecutive repeats
  const consecCounts = {};
  for (let i = 1; i <= 50; i++) consecCounts[i] = 0;
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i-1];
    const curr = sorted[i];
    
    curr.numbers.forEach(num => {
      if (prev.numbers.includes(num)) {
        consecCounts[num]++;
      }
    });
  }
  
  // Calculate number pairs
  const pairs = {};
  sorted.forEach(draw => {
    const nums = [...draw.numbers].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const pair = `${nums[i]}-${nums[j]}`;
        pairs[pair] = (pairs[pair] || 0) + 1;
      }
    }
  });
  
  const sortedPairs = Object.entries(pairs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([pair, count]) => {
      const [n1, n2] = pair.split('-');
      return { n1: parseInt(n1), n2: parseInt(n2), count };
    });
  
  // Get last 20 draws with metadata
  const last20 = sorted.slice(-20).reverse().map(draw => ({
    date: draw.date,
    numbers: draw.numbers.sort((a, b) => a - b),
    powerball: draw.powerball,
    jackpot: draw.jackpot,
    rollover: draw.rollover,
    totalPrizePool: draw.totalPrizePool,
    totalSales: draw.totalSales,
    drawNumber: draw.drawNumber
  }));
  
  // Build dashboard data structure
  const dashboardData = {
    metadata: {
      totalDraws: data.totalDraws,
      dateRange: data.dateRange,
      lastUpdated: new Date().toISOString(),
      lastDraw: last20[0]
    },
    hotNumbers: rankedNumbers.slice(0, 15).map((item, index) => ({
      ...item,
      rank: index + 1,
      percentage: ((item.count / data.totalDraws) * 100).toFixed(1),
      gap: gaps[item.num] || 0,
      isSticky: consecCounts[item.num] > 5,
      stickyCount: consecCounts[item.num]
    })),
    coldNumbers: rankedNumbers.slice(-15).reverse().map((item, index) => ({
      ...item,
      rank: rankedNumbers.length - 14 + index,
      percentage: ((item.count / data.totalDraws) * 100).toFixed(1),
      gap: gaps[item.num] || data.totalDraws,
      isOverdue: (gaps[item.num] || 0) > 15
    })),
    powerballs: rankedPowerballs.map((item, index) => ({
      ...item,
      rank: index + 1,
      percentage: ((item.count / data.totalDraws) * 100).toFixed(1)
    })),
    topPairs: sortedPairs,
    last20Draws: last20,
    statistics: {
      expectedFreq: (data.totalDraws * 5 / 50).toFixed(1),
      expectedPB: (data.totalDraws / 20).toFixed(1),
      consecutiveRate: '9.25%',
      drawsWithRepeat: Math.round(data.totalDraws * 0.46)
    },
    recommendations: {
      hotCombo: [3, 15, 18, 24, 38],
      hotPB: 2,
      coldCombo: [1, 7, 14, 26, 44],
      coldPB: 14,
      stickyNumbers: rankedNumbers.slice(0, 5).filter(n => consecCounts[n.num] > 8).map(n => n.num),
      overdueHot: rankedNumbers.filter(n => (gaps[n.num] || 0) > 10 && consecCounts[n.num] > 5).map(n => n.num)
    }
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dashboardData, null, 2));
  
  console.log('✅ Data exported successfully!');
  console.log(`📁 File: ${OUTPUT_FILE}`);
  console.log(`📊 Total draws: ${data.totalDraws}`);
  console.log(`🔥 Hottest: #${dashboardData.hotNumbers[0].num} (${dashboardData.hotNumbers[0].count}x)`);
  console.log(`❄️ Coldest: #${dashboardData.coldNumbers[0].num} (${dashboardData.coldNumbers[0].count}x)`);
  console.log(`📅 Date range: ${data.dateRange.earliest} to ${data.dateRange.latest}`);
}

exportData();
