/**
 * Template generator for the Task Automation scaffold file.
 * Produces src/task-runner.ts in the generated project.
 */

export function generateTaskRunner(): string {
    return `/**
 * Task Runner
 *
 * An event-driven task queue for Arbitrum. Listens for on-chain events and
 * processes tasks received via the A2A protocol.
 *
 * Architecture:
 *   - TaskQueue: in-memory FIFO queue (swap for Redis/BullMQ in production)
 *   - TaskHandler: map of task type → async handler function
 *   - EventWatcher: polls for on-chain events and enqueues tasks
 *
 * To add a new task type:
 *   1. Define its input/output types below
 *   2. Register a handler in TASK_HANDLERS
 *   3. Optionally add an event watcher that enqueues it automatically
 */

import 'dotenv/config';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { defineChain } from 'viem';

// ============================================================================
// Chain setup
// ============================================================================

const chainId = parseInt(process.env.CHAIN_ID ?? '421614', 10);

const arbitrumChain = defineChain({
  id: chainId,
  name: chainId === 42161 ? 'Arbitrum One' : 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc'] } },
});

export const publicClient = createPublicClient({
  chain: arbitrumChain,
  transport: http(),
});

// ============================================================================
// Task types
// ============================================================================

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Task<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: TaskStatus;
  createdAt: string;   // ISO 8601
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  /** Set to prevent double-execution of the same logical operation */
  idempotencyKey?: string;
}

export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Task queue (in-memory — replace with Redis/BullMQ for production)
// ============================================================================

const queue: Task[] = [];
const completedKeys = new Set<string>(); // tracks idempotency keys

export function enqueue<T>(type: string, payload: T, idempotencyKey?: string): Task<T> {
  // Idempotency check: skip if this key was already processed
  if (idempotencyKey && completedKeys.has(idempotencyKey)) {
    console.log(\`[task-runner] Skipping duplicate task (idempotencyKey=\${idempotencyKey})\`);
    return { id: idempotencyKey, type, payload, status: 'completed', createdAt: new Date().toISOString() };
  }

  const task: Task<T> = {
    id: idempotencyKey ?? \`\${type}-\${Date.now()}-\${Math.random().toString(36).slice(2, 7)}\`,
    type,
    payload,
    status: 'queued',
    createdAt: new Date().toISOString(),
    idempotencyKey,
  };

  queue.push(task as Task);
  console.log(\`[task-runner] Enqueued \${type} (id=\${task.id})\`);
  return task;
}

export function getQueue(): Task[] {
  return [...queue];
}

export function getTask(id: string): Task | undefined {
  return queue.find((t) => t.id === id);
}

// ============================================================================
// Task handlers
// Register your task implementations here.
// Each handler receives the task payload and returns a TaskResult.
// ============================================================================

type HandlerFn = (payload: unknown) => Promise<TaskResult>;

/**
 * Example: log-event task
 * Triggered when a contract event is detected; logs relevant details.
 */
const handleLogEvent: HandlerFn = async (payload) => {
  const { contractAddress, eventName, blockNumber } = payload as {
    contractAddress: string;
    eventName: string;
    blockNumber: string;
  };

  console.log(\`[log-event] \${eventName} on \${contractAddress} at block \${blockNumber}\`);

  // Add your event-specific logic here:
  // - Call an external API
  // - Trigger another agent via A2A
  // - Write to a database

  return { success: true, data: { contractAddress, eventName, blockNumber } };
};

/**
 * Example: health-check task
 * Verifies the agent is connected to the chain and returns the current block.
 */
const handleHealthCheck: HandlerFn = async () => {
  const blockNumber = await publicClient.getBlockNumber();
  return { success: true, data: { blockNumber: blockNumber.toString(), timestamp: new Date().toISOString() } };
};

// Add new handlers here following the same pattern.
export const TASK_HANDLERS: Record<string, HandlerFn> = {
  'log-event': handleLogEvent,
  'health-check': handleHealthCheck,
};

// ============================================================================
// Task processor
// ============================================================================

/** Run all queued tasks sequentially. Call this on a timer or manually. */
export async function processTasks(): Promise<void> {
  const pending = queue.filter((t) => t.status === 'queued');

  for (const task of pending) {
    const handler = TASK_HANDLERS[task.type];
    if (!handler) {
      task.status = 'failed';
      task.error = \`No handler for task type: \${task.type}\`;
      console.warn(\`[task-runner] \${task.error}\`);
      continue;
    }

    task.status = 'running';
    task.startedAt = new Date().toISOString();

    try {
      const result = await handler(task.payload);
      task.status = result.success ? 'completed' : 'failed';
      task.result = result.data;
      task.error = result.error;
      task.completedAt = new Date().toISOString();

      if (task.idempotencyKey) completedKeys.add(task.idempotencyKey);
      console.log(\`[task-runner] \${task.status} \${task.type} (id=\${task.id})\`);
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : String(err);
      task.completedAt = new Date().toISOString();
      console.error(\`[task-runner] failed \${task.type} (id=\${task.id}): \${task.error}\`);
    }
  }
}

// ============================================================================
// On-chain event watcher
// ============================================================================

/**
 * Watch for Transfer events on a contract and enqueue a log-event task.
 * Set WATCH_CONTRACT_ADDRESS in .env to enable.
 *
 * In production, consider using a dedicated indexer (The Graph, Ponder)
 * instead of polling to avoid missing events during downtime.
 */
export function startEventWatcher(): () => void {
  const contractAddress = process.env.WATCH_CONTRACT_ADDRESS as \`0x\${string}\` | undefined;
  if (!contractAddress) {
    console.log('[task-runner] WATCH_CONTRACT_ADDRESS not set, event watcher disabled.');
    return () => {};
  }

  console.log(\`[task-runner] Watching for Transfer events on \${contractAddress}\`);

  const unwatch = publicClient.watchEvent({
    address: contractAddress,
    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
    onLogs: (logs) => {
      for (const log of logs) {
        enqueue('log-event', {
          contractAddress,
          eventName: 'Transfer',
          blockNumber: log.blockNumber?.toString() ?? 'unknown',
          transactionHash: log.transactionHash,
        }, \`transfer-\${log.transactionHash}-\${log.logIndex}\`);
      }
    },
    onError: (err) => console.error('[task-runner] Event watcher error:', err),
  });

  return unwatch;
}
`;
}
