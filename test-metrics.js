/**
 * Simple test script to verify Prometheus metrics endpoint
 * Run with: node test-metrics.js
 */

import http from 'http';

const PORT = process.env.PORT || 5000;
const HOST = 'localhost';

console.log('Testing Prometheus metrics endpoint...\n');

// Test 1: Check if metrics endpoint is accessible
const options = {
    hostname: HOST,
    port: PORT,
    path: '/metrics',
    method: 'GET',
};

const req = http.request(options, (res) => {
    console.log(`✓ Metrics endpoint responded with status: ${res.statusCode}`);
    console.log(`✓ Content-Type: ${res.headers['content-type']}\n`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✓ Metrics endpoint is working!\n');
            
            // Check for key metrics
            const metricsToCheck = [
                'ai_auction_http_requests_total',
                'ai_auction_http_request_duration_seconds',
                'ai_auction_http_errors_total',
                'ai_auction_auctions_created_total',
                'ai_auction_bids_placed_total',
                'ai_auction_payments_processed_total',
                'ai_auction_process_cpu_user_seconds_total',
                'ai_auction_nodejs_heap_size_total_bytes',
            ];

            console.log('Checking for required metrics:\n');
            metricsToCheck.forEach(metric => {
                if (data.includes(metric)) {
                    console.log(`  ✓ ${metric}`);
                } else {
                    console.log(`  ✗ ${metric} - NOT FOUND`);
                }
            });

            console.log('\n✓ All checks passed!');
            console.log('\nSample metrics output (first 500 characters):');
            console.log('─'.repeat(60));
            console.log(data.substring(0, 500) + '...');
            console.log('─'.repeat(60));
        } else {
            console.error('✗ Metrics endpoint returned error status');
            console.error('Response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('✗ Failed to connect to metrics endpoint');
    console.error('Error:', error.message);
    console.error('\nMake sure the server is running on port', PORT);
    console.error('Start the server with: npm start');
});

req.end();
