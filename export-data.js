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

// User's TOP 10 combinations with strategies (optimized from 13)
const USER_TICKETS = [
  { name: '1', numbers: [3, 15, 18, 24, 38], pb: 2, strategy: 'Hot & Overdue' },
  { name: '5', numbers: [3, 13, 15, 19, 24], pb: 2, strategy: 'Hot Triplets' },
  { name: 'B', numbers: [15, 18, 24, 38, 44], pb: 14, strategy: 'Overdue Heat' },
  { name: '7', numbers: [3, 13, 21, 24, 33], pb: 12, strategy: 'Recent Triplets' },
  { name: '3', numbers: [15, 19, 24, 35, 46], pb: 2, strategy: 'Hot Pairs' },
  { name: 'E', numbers: [7, 15, 16, 22, 29], pb: 14, strategy: 'Hot + Overdue Mix' },
  { name: '4', numbers: [12, 19, 20, 32, 33], pb: 12, strategy: 'Consecutive Focus' },
  { name: 'F', numbers: [3, 22, 29, 41, 49], pb: 2, strategy: 'Complete Coverage' },
  { name: 'A', numbers: [3, 11, 24, 38, 49], pb: 2, strategy: 'Sticky Streak' },
  { name: '6', numbers: [1, 7, 27, 44, 46], pb: 14, strategy: 'Overdue Cold' }
];

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
  
  // Get last 6 draws with metadata and winner info
  const last6 = sorted.slice(-6).reverse().map(draw => ({
    date: draw.date,
    numbers: draw.numbers.sort((a, b) => a - b),
    powerball: draw.powerball,
    jackpot: draw.jackpot,
    rollover: draw.rollover,
    totalPrizePool: draw.totalPrizePool,
    totalSales: draw.totalSales,
    drawNumber: draw.drawNumber,
    hasWinner: draw.rollover === 0 || (draw.rollover !== undefined && draw.rollover === 0),
    isRollover: draw.rollover > 0
  }));
  
  // Calculate historical performance for user's tickets
  const activeTickets = USER_TICKETS.map(ticket => {
    const ticketSet = new Set(ticket.numbers);
    let wins = 0;
    let totalPrize = 0;
    let bestResult = { matchCount: 0, pbMatch: false };
    let bestPrize = 0;
    
    sorted.forEach(draw => {
      const matches = draw.numbers.filter(n => ticketSet.has(n));
      const matchCount = matches.length;
      const pbMatch = ticket.pb === draw.powerball;
      
      // Calculate prize
      let prize = 0;
      if (matchCount === 5 && pbMatch) prize = draw.jackpot || 65000000;
      else if (matchCount === 5) prize = 127919;
      else if (matchCount === 4 && pbMatch) prize = 9709;
      else if (matchCount === 4) prize = 1084;
      else if (matchCount === 3 && pbMatch) prize = 532;
      else if (matchCount === 3) prize = 23;
      else if (matchCount === 2 && pbMatch) prize = 24;
      else if (matchCount === 1 && pbMatch) prize = 15;
      else if (matchCount === 0 && pbMatch) prize = 10;
      
      if (prize > 0) {
        wins++;
        totalPrize += prize;
        if (prize > bestPrize) {
          bestPrize = prize;
          bestResult = { matchCount, pbMatch };
        }
      }
    });
    
    const winRate = ((wins / sorted.length) * 100).toFixed(2);
    const resultText = bestResult.matchCount > 0 
      ? `${bestResult.matchCount} match${bestResult.pbMatch ? ' + PB' : ''}` 
      : 'No wins yet';
    
    return {
      ...ticket,
      wins,
      totalPrize,
      winRate: parseFloat(winRate),
      bestResult: resultText,
      bestPrize,
      isBest: false // Will mark best performer below
    };
  }).sort((a, b) => b.winRate - a.winRate);
  
  // Mark the best performer
  if (activeTickets.length > 0) {
    activeTickets[0].isBest = true;
  }
  
  // Analyze last draw
  const lastDraw = last6[0];
  const top15Hot = new Set(rankedNumbers.slice(0, 15).map(n => n.num));
  const bottom15Cold = new Set(rankedNumbers.slice(-15).map(n => n.num));
  const hotPB = new Set(rankedPowerballs.slice(0, 5).map(n => n.num));
  const coldPB = new Set(rankedPowerballs.slice(-5).map(n => n.num));
  
  const lastDrawAnalysis = {
    hotNumbers: lastDraw.numbers.filter(n => top15Hot.has(n)),
    coldNumbers: lastDraw.numbers.filter(n => bottom15Cold.has(n)),
    neutralNumbers: lastDraw.numbers.filter(n => !top15Hot.has(n) && !bottom15Cold.has(n)),
    isHotPB: hotPB.has(lastDraw.powerball),
    isColdPB: coldPB.has(lastDraw.powerball),
    hotCount: lastDraw.numbers.filter(n => top15Hot.has(n)).length,
    coldCount: lastDraw.numbers.filter(n => bottom15Cold.has(n)).length,
    neutralCount: lastDraw.numbers.filter(n => !top15Hot.has(n) && !bottom15Cold.has(n)).length
  };
  
  // Check which user tickets matched
  const lastDrawMatches = USER_TICKETS.map(ticket => {
    const ticketSet = new Set(ticket.numbers);
    const matches = lastDraw.numbers.filter(n => ticketSet.has(n));
    const pbMatch = ticket.pb === lastDraw.powerball;
    return {
      name: ticket.name,
      numbers: ticket.numbers,
      pb: ticket.pb,
      matches: matches,
      matchCount: matches.length,
      pbMatch: pbMatch,
      totalMatches: matches.length + (pbMatch ? 1 : 0)
    };
  }).sort((a, b) => b.totalMatches - a.totalMatches);
  
  // Build dashboard data structure
  const dashboardData = {
    metadata: {
      totalDraws: data.totalDraws,
      dateRange: data.dateRange,
      lastUpdated: new Date().toISOString(),
      lastDraw: lastDraw
    },
    lastDrawAnalysis: lastDrawAnalysis,
    lastDrawMatches: lastDrawMatches,
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
    last6Draws: last6,
    activeTickets: activeTickets,
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
  console.log(`🎟️ Active tickets exported: ${activeTickets.length}`);
  console.log(`👑 Best ticket: Combo ${activeTickets[0].name} (${activeTickets[0].winRate}% win rate)`);
  console.log(`📅 Date range: ${data.dateRange.earliest} to ${data.dateRange.latest}`);
}

exportData();
