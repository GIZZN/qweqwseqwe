/**
 * Unit tests for LiveCoding core modules.
 * Execute: npx tsx src/app/features/livecoding/core/livecoding.test.ts
 */

import { PromptBuilder } from './promptBuilder';
import { StreamProcessor } from './streamProcessor';
import type { StreamState } from './streamProcessor';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✅ ${msg}`);
}

function runTests() {
  console.log('🧪 LiveCoding Core Tests\n');

  // --- PromptBuilder Tests ---
  console.log('📝 PromptBuilder:');
  const builder = new PromptBuilder();

  // Test 1: Build messages for ALGORITHM
  const msgs = builder.buildMessages('ALGORITHM', 'fakeBase64Data');
  assert(msgs.length === 2, 'buildMessages returns 2 messages (system + user)');
  assert(msgs[0].role === 'system', 'first message is system');
  assert(msgs[1].role === 'user', 'second message is user');
  assert(Array.isArray(msgs[1].content), 'user content is array (multimodal)');

  // Test 2: Custom prompt
  const msgsCustom = builder.buildMessages('CODE_ANALYSIS', 'base64', { customPrompt: 'Мой промпт' });
  const userContent = msgsCustom[1].content as Array<{ type: string; text?: string }>;
  assert(userContent[0].text === 'Мой промпт', 'custom prompt overrides default');

  // Test 3: LLM config
  const config = builder.getLLMConfig('THEORY', { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' });
  assert(config.apiKey === 'sk-test', 'LLM config has apiKey');
  assert(config.model === 'gpt-4o', 'LLM config has model');
  assert(config.temperature === 0.3, 'LLM config temperature = 0.3');
  assert(config.maxTokens === 4096, 'LLM config maxTokens = 4096');

  // Test 4: All analysis types exist
  const types = builder.getAnalysisTypes();
  assert('ALGORITHM' in types, 'ALGORITHM type exists');
  assert('CODE_ANALYSIS' in types, 'CODE_ANALYSIS type exists');
  assert('CODE_ITERATION' in types, 'CODE_ITERATION type exists');
  assert('THEORY' in types, 'THEORY type exists');

  // Test 5: Unknown type throws
  let threw = false;
  try {
    builder.buildMessages('UNKNOWN' as Parameters<typeof builder.buildMessages>[0], 'data');
  } catch {
    threw = true;
  }
  assert(threw, 'unknown analysis type throws error');

  // --- StreamProcessor Tests ---
  console.log('\n📡 StreamProcessor:');
  const processor = new StreamProcessor();

  // Test 6: Process a mock SSE stream
  const mockSSE = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
    'data: {"choices":[{"delta":{"content":" World"}}]}\n',
    'data: [DONE]\n',
  ].join('\n');

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(mockSSE));
      controller.close();
    },
  });

  const reader = stream.getReader();
  const abortController = new AbortController();
  let finalState: StreamState | null = null;

  processor
    .processStream(reader, abortController.signal, {
      onStateChange: (s) => { finalState = s; },
      responseType: 'code',
    })
    .then((result) => {
      assert(result === 'Hello World', 'stream processed correctly: "Hello World"');
      assert(finalState?.isStreaming === false, 'final state isStreaming = false');
      assert(finalState?.currentResponse === 'Hello World', 'final state has full response');
      console.log('\n✅ All LiveCoding tests passed!');
    })
    .catch((e) => {
      console.error('❌ Stream test failed:', e);
      process.exit(1);
    });
}

runTests();
