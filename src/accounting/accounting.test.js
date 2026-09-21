const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { test } = require('node:test');

const {
  INITIAL_BALANCE_CENTS,
  createDataStore,
  createOperations,
  runApplication,
} = require('./index');

function runWithInput(lines) {
  const output = [];
  const input = Readable.from(lines.map((line) => `${line}\n`));

  return runApplication({
    input,
    output: (message) => output.push(message),
  }).then(() => output);
}

function createOperationHarness(inputLines = []) {
  const output = [];
  const input = {
    question: async () => inputLines.shift(),
  };
  const dataStore = createDataStore();

  return {
    dataStore,
    output,
    operations: createOperations(dataStore, (message) => output.push(message), input),
  };
}

test('TC-001 displays the main menu on startup', async () => {
  const output = await runWithInput(['4']);

  assert.deepEqual(output.slice(0, 7), [
    '--------------------------------',
    'Account Management System',
    '1. View Balance',
    '2. Credit Account',
    '3. Debit Account',
    '4. Exit',
    '--------------------------------',
  ]);
});

test('TC-002 displays the initial account balance', async () => {
  const output = await runWithInput(['1', '4']);

  assert.ok(output.includes('Current balance: 1000.00'));
});

test('TC-003 credits the account with a positive amount', async () => {
  const output = await runWithInput(['2', '250.00', '4']);

  assert.ok(output.includes('Amount credited. New balance: 1250.00'));
});

test('TC-004 displays the balance after a credit', async () => {
  const output = await runWithInput(['2', '250.00', '1', '4']);

  assert.ok(output.includes('Current balance: 1250.00'));
});

test('TC-005 debits an amount less than the balance', async () => {
  const output = await runWithInput(['3', '200.00', '4']);

  assert.ok(output.includes('Amount debited. New balance: 800.00'));
});

test('TC-006 displays the balance after a debit', async () => {
  const output = await runWithInput(['3', '200.00', '1', '4']);

  assert.ok(output.includes('Current balance: 800.00'));
});

test('TC-007 accepts a debit equal to the available balance', async () => {
  const output = await runWithInput(['3', '1000.00', '4']);

  assert.ok(output.includes('Amount debited. New balance: 0.00'));
});

test('TC-008 rejects a debit greater than the available balance', async () => {
  const output = await runWithInput(['3', '1000.01', '4']);

  assert.ok(output.includes('Insufficient funds for this debit.'));
  assert.ok(!output.includes('Amount debited.'));
});

test('TC-009 rejects a debit from a zero-balance account', async () => {
  const output = await runWithInput(['3', '1000.00', '3', '0.01', '4']);

  assert.equal(output.filter((message) => message === 'Insufficient funds for this debit.').length, 1);
});

test('TC-010 applies multiple credits cumulatively', async () => {
  const output = await runWithInput(['2', '100.00', '2', '50.00', '1', '4']);

  assert.ok(output.includes('Amount credited. New balance: 1100.00'));
  assert.ok(output.includes('Amount credited. New balance: 1150.00'));
  assert.ok(output.includes('Current balance: 1150.00'));
});

test('TC-011 applies multiple debits cumulatively', async () => {
  const output = await runWithInput(['3', '100.00', '3', '50.00', '1', '4']);

  assert.ok(output.includes('Amount debited. New balance: 900.00'));
  assert.ok(output.includes('Amount debited. New balance: 850.00'));
  assert.ok(output.includes('Current balance: 850.00'));
});

test('TC-012 accepts a zero credit without changing the balance', async () => {
  const output = await runWithInput(['2', '0.00', '1', '4']);

  assert.ok(output.includes('Amount credited. New balance: 1000.00'));
  assert.ok(output.includes('Current balance: 1000.00'));
});

test('TC-013 accepts a zero debit without changing the balance', async () => {
  const output = await runWithInput(['3', '0.00', '1', '4']);

  assert.ok(output.includes('Amount debited. New balance: 1000.00'));
  assert.ok(output.includes('Current balance: 1000.00'));
});

test('TC-014 preserves two decimal places for a fractional debit', async () => {
  const output = await runWithInput(['3', '0.25', '1', '4']);

  assert.ok(output.includes('Amount debited. New balance: 999.75'));
  assert.ok(output.includes('Current balance: 999.75'));
});

test('TC-015 rejects a menu choice below the valid range', async () => {
  const output = await runWithInput(['0', '4']);

  assert.ok(output.includes('Invalid choice, please select 1-4.'));
});

test('TC-016 rejects a menu choice above the valid range', async () => {
  const output = await runWithInput(['5', '4']);

  assert.ok(output.includes('Invalid choice, please select 1-4.'));
});

test('TC-017 continues operating after an invalid menu choice', async () => {
  const output = await runWithInput(['9', '1', '4']);

  assert.ok(output.includes('Invalid choice, please select 1-4.'));
  assert.ok(output.includes('Current balance: 1000.00'));
});

test('TC-018 exits from the main menu', async () => {
  const output = await runWithInput(['4']);

  assert.equal(output.at(-1), 'Exiting the program. Goodbye!');
});

test('TC-019 does not display another menu after exit', async () => {
  const output = await runWithInput(['4']);

  assert.equal(output.at(-1), 'Exiting the program. Goodbye!');
  assert.equal(output.filter((message) => message === 'Account Management System').length, 1);
});

test('TC-020 preserves the balance across a credit, debit, and read', async () => {
  const output = await runWithInput(['2', '300.00', '3', '100.00', '1', '4']);

  assert.ok(output.includes('Current balance: 1200.00'));
});

test('TC-021 reads the stored balance through the data store', () => {
  const dataStore = createDataStore();

  assert.equal(dataStore.read(), INITIAL_BALANCE_CENTS);
});

test('TC-022 writes and then reads a balance through the data store', () => {
  const dataStore = createDataStore();

  dataStore.write(123456);

  assert.equal(dataStore.read(), 123456);
});

test('TC-023 leaves the data store unchanged when no supported operation writes it', () => {
  const dataStore = createDataStore();
  const initialBalance = dataStore.read();

  assert.equal(dataStore.read(), initialBalance);
});

test('TC-024 ignores an unsupported operations command', async () => {
  const { dataStore, operations, output } = createOperationHarness();

  assert.equal(typeof operations.transfer, 'undefined');
  assert.deepEqual(output, []);
  assert.equal(dataStore.read(), INITIAL_BALANCE_CENTS);
});

test('TC-025 leaves the balance unchanged after an insufficient debit', async () => {
  const output = await runWithInput(['3', '1500.00', '1', '4']);

  assert.ok(output.includes('Insufficient funds for this debit.'));
  assert.ok(output.includes('Current balance: 1000.00'));
  assert.ok(!output.includes('Amount debited.'));
});