const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000;

function formatBalance(balanceCents) {
  return (balanceCents / 100).toFixed(2);
}

function parseAmount(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const amount = Number(input.trim());

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function createDataStore(initialBalanceCents = INITIAL_BALANCE_CENTS) {
  let storageBalanceCents = initialBalanceCents;

  return {
    read() {
      return storageBalanceCents;
    },
    write(balanceCents) {
      storageBalanceCents = balanceCents;
    },
  };
}

function createOperations(dataStore, output = console.log, input) {
  async function readAmount(prompt) {
    let amountCents = null;

    while (amountCents === null) {
      amountCents = parseAmount(await input.question(prompt));

      if (amountCents === null) {
        output('Invalid amount, please enter a non-negative number.');
      }
    }

    return amountCents;
  }

  return {
    async total() {
      output(`Current balance: ${formatBalance(dataStore.read())}`);
    },

    async credit() {
      const amountCents = await readAmount('Enter credit amount: ');
      const finalBalanceCents = dataStore.read() + amountCents;

      dataStore.write(finalBalanceCents);
      output(`Amount credited. New balance: ${formatBalance(finalBalanceCents)}`);
    },

    async debit() {
      const amountCents = await readAmount('Enter debit amount: ');
      const finalBalanceCents = dataStore.read();

      if (finalBalanceCents >= amountCents) {
        const newBalanceCents = finalBalanceCents - amountCents;

        dataStore.write(newBalanceCents);
        output(`Amount debited. New balance: ${formatBalance(newBalanceCents)}`);
      } else {
        output('Insufficient funds for this debit.');
      }
    },
  };
}

async function runApplication({ input = process.stdin, output = console.log } = {}) {
  const terminal = readline.createInterface({ input });
  const lines = terminal[Symbol.asyncIterator]();

  async function askQuestion(prompt) {
    output(prompt);
    const nextLine = await lines.next();
    return nextLine.done ? null : nextLine.value;
  }

  const dataStore = createDataStore();
  const operations = createOperations(dataStore, output, { question: askQuestion });
  let continueRunning = true;

  try {
    while (continueRunning) {
      output('--------------------------------');
      output('Account Management System');
      output('1. View Balance');
      output('2. Credit Account');
      output('3. Debit Account');
      output('4. Exit');
      output('--------------------------------');

      const choice = await askQuestion('Enter your choice (1-4): ');

      if (choice === null) {
        break;
      }

      switch (choice.trim()) {
        case '1':
          await operations.total();
          break;
        case '2':
          await operations.credit();
          break;
        case '3':
          await operations.debit();
          break;
        case '4':
          continueRunning = false;
          break;
        default:
          output('Invalid choice, please select 1-4.');
      }
    }

    output('Exiting the program. Goodbye!');
  } finally {
    terminal.close();
  }
}

if (require.main === module) {
  runApplication().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  INITIAL_BALANCE_CENTS,
  createDataStore,
  createOperations,
  formatBalance,
  parseAmount,
  runApplication,
};