#!/usr/bin/env node

const https = require('https');

const packageName = 'agentguard-sdk';

async function getDownloadStats(period = 'last-week') {
  const url = `https://api.npmjs.org/downloads/range/${period}/${packageName}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const stats = JSON.parse(data);
          resolve(stats);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function trackDownloads() {
  try {
    console.log(`📊 Download Statistics for ${packageName}\n`);
    
    // Get different time periods
    const periods = ['last-day', 'last-week', 'last-month'];
    
    for (const period of periods) {
      try {
        const stats = await getDownloadStats(period);
        
        if (stats.downloads) {
          const total = stats.downloads.reduce((sum, day) => sum + day.downloads, 0);
          console.log(`${period.toUpperCase()}: ${total} downloads`);
          
          if (period === 'last-week' && stats.downloads.length > 0) {
            console.log('Daily breakdown:');
            stats.downloads.forEach(day => {
              console.log(`  ${day.day}: ${day.downloads} downloads`);
            });
          }
        } else {
          console.log(`${period.toUpperCase()}: No data available yet`);
        }
        
        console.log('');
      } catch (error) {
        console.log(`${period.toUpperCase()}: No data available yet (package too new)`);
      }
    }
    
    // Get package info
    console.log('📦 Package Information:');
    console.log(`npm page: https://www.npmjs.com/package/${packageName}`);
    console.log(`npm trends: https://npmtrends.com/${packageName}`);
    console.log(`npm stats: https://npm-stat.com/charts.html?package=${packageName}`);
    
  } catch (error) {
    console.error('Error fetching download stats:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  trackDownloads();
}

module.exports = { getDownloadStats, trackDownloads };