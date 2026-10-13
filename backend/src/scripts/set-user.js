// Creates the user or changes their password, and ends all their sessions:
//   node src/scripts/set-user.js you@example.com
// The password is asked on the terminal (not echoed), never taken from an argument or the environment.
const readline = require('readline');
const { Writable } = require('stream');
const User = require('../models/User');
const Session = require('../models/Session');
const { hashPassword, passwordProblems } = require('../utils/password');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One terminal session for all questions. On a terminal, the typed characters are not shown (the interface
// writes to a stream that discards everything). Lines are buffered, so piped input works for several questions.
function openPrompt() {
  const output = new Writable({ write: (chunk, encoding, done) => done() });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
  const lines = rl[Symbol.asyncIterator]();
  return {
    async ask(question) {
      process.stdout.write(question);
      const { value } = await lines.next();
      if (process.stdin.isTTY) process.stdout.write('\n');
      return value ?? '';
    },
    close: () => rl.close(),
  };
}

// Returns the exit code; prompt(question) answers a question with a line of input
async function setUser(email, prompt) {
  if (!email || !EMAIL.test(email)) {
    console.error('Usage: node src/scripts/set-user.js <email>');
    return 2;
  }

  const password = await prompt('New password: ');
  const problems = passwordProblems(password);
  if (problems.length > 0) {
    console.error(`The password needs ${problems.join(', ')}.`);
    return 1;
  }
  if (password !== (await prompt('Repeat the password: '))) {
    console.error('The passwords are different.');
    return 1;
  }

  const user = await User.save(email, await hashPassword(password));
  await Session.removeAllOfUser(user.id);
  console.log(`Password of ${user.email} saved; all sessions ended.`);
  return 0;
}

module.exports = { setUser, openPrompt };

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  const prompt = openPrompt();
  setUser(process.argv[2], prompt.ask)
    .catch((err) => {
      console.error(err);
      return 1;
    })
    .then((code) => {
      prompt.close();
      require('../config/database').end();
      process.exitCode = code;
    });
}
