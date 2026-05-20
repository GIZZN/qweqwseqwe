/**
 * Quick unit test for TokenTracker (runs in Node.js without Tauri).
 * Execute: npx tsx src/app/features/common/capture/tokenTracker.test.ts
 */

import { TokenTracker } from './tokenTracker';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

function runTests() {
  console.log('🧪 TokenTracker Tests\n');

  // Test 1: Basic token tracking
  const tracker = new TokenTracker();
  tracker.addTokens(100, 'image');
  tracker.addTokens(50, 'audio');
  assert(tracker.getTokensInLastMinute() === 150, 'addTokens + getTokensInLastMinute');

  // Test 2: Image token calculation
  assert(tracker.calculateImageTokens(384, 384) === 85, 'small image = 85 tokens');
  assert(tracker.calculateImageTokens(1920, 1080) > 85, 'large image > 85 tokens');

  // Test 3: Statistics
  const stats = tracker.getStatistics();
  assert(stats.total === 150, 'stats.total = 150');
  assert(stats.image === 100, 'stats.image = 100');
  assert(stats.audio === 50, 'stats.audio = 50');
  assert(stats.count === 2, 'stats.count = 2');

  // Test 4: Reset
  tracker.reset();
  assert(tracker.getTokensInLastMinute() === 0, 'reset clears tokens');

  // Test 5: Throttle (disabled by default without localStorage)
  assert(tracker.shouldThrottle() === false, 'shouldThrottle = false by default');

  // Test 6: Auto tracking
  tracker.startAutoTracking(100);
  tracker.stopAutoTracking();
  assert(true, 'startAutoTracking/stopAutoTracking no crash');

  console.log('\n✅ All TokenTracker tests passed!');
}

runTests();
