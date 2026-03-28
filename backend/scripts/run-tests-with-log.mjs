import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';

const logsDir = resolve(process.cwd(), 'test-results');
mkdirSync(logsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = resolve(logsDir, `backend-tests-${timestamp}.log`);
const latestPath = resolve(logsDir, 'latest.log');

const latestStream = createWriteStream(latestPath, { flags: 'w' });
const timestampedStream = createWriteStream(logPath, { flags: 'w' });

const writeToAllOutputs = (chunk) => {
  process.stdout.write(chunk);
  latestStream.write(chunk);
  timestampedStream.write(chunk);
};

const writeErrorToAllOutputs = (chunk) => {
  process.stderr.write(chunk);
  latestStream.write(chunk);
  timestampedStream.write(chunk);
};

const testProcess = spawn(process.execPath, ['--test', '--test-reporter=spec'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DOTENV_CONFIG_QUIET: 'true',
  },
});

testProcess.stdout.on('data', writeToAllOutputs);
testProcess.stderr.on('data', writeErrorToAllOutputs);

testProcess.on('close', (code) => {
  const summaryLines = [
    '',
    `Test output saved to: ${latestPath}`,
    `Timestamped copy saved to: ${logPath}`,
    '',
  ].join('\n');

  process.stdout.write(summaryLines);
  latestStream.write(summaryLines);
  timestampedStream.write(summaryLines);

  latestStream.end();
  timestampedStream.end();

  process.exit(code ?? 1);
});

testProcess.on('error', (error) => {
  const message = `Failed to run backend tests: ${error.message}\n`;
  process.stderr.write(message);
  latestStream.write(message);
  timestampedStream.write(message);

  latestStream.end();
  timestampedStream.end();

  process.exit(1);
});
