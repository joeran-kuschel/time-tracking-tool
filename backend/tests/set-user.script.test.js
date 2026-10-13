jest.mock('../src/models/User');
jest.mock('../src/models/Session');

const User = require('../src/models/User');
const Session = require('../src/models/Session');
const { verifyPassword } = require('../src/utils/password');
const path = require('path');
const { spawnSync } = require('child_process');
const { setUser } = require('../src/scripts/set-user');

const GOOD = 'Correct-Horse-1';
const answers = (...texts) => {
  const prompt = jest.fn();
  texts.forEach((text) => prompt.mockResolvedValueOnce(text));
  return prompt;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  User.save.mockResolvedValue({ id: 7, email: 'me@example.com' });
  Session.removeAllOfUser.mockResolvedValue();
});

afterEach(() => jest.restoreAllMocks());

describe('set-user script', () => {
  test('saves the user with a hash of the password and ends all their sessions', async () => {
    const code = await setUser('me@example.com', answers(GOOD, GOOD));

    expect(code).toBe(0);
    const [email, hash] = User.save.mock.calls[0];
    expect(email).toBe('me@example.com');
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await verifyPassword(GOOD, hash)).toBe(true);
    expect(Session.removeAllOfUser).toHaveBeenCalledWith(7);
    expect(console.log).toHaveBeenCalledWith('Password of me@example.com saved; all sessions ended.');
  });

  test('never prints the password', async () => {
    await setUser('me@example.com', answers(GOOD, GOOD));

    const output = [...console.log.mock.calls, ...console.error.mock.calls].flat().join(' ');
    expect(output).not.toContain(GOOD);
  });

  test.each([
    ['short', 'Abc1!', 'at least 10 characters'],
    ['no capital', 'abcdefgh1!', 'a capital letter'],
    ['no number', 'Abcdefghi!', 'a number'],
    ['no special character', 'Abcdefgh12', 'a special character'],
  ])('refuses a password with %s and names the requirement', async (name, password, missing) => {
    const prompt = answers(password);
    const code = await setUser('me@example.com', prompt);

    expect(code).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(missing));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(User.save).not.toHaveBeenCalled();
  });

  test('refuses when the repeated password is different', async () => {
    const code = await setUser('me@example.com', answers(GOOD, 'Correct-Horse-2'));

    expect(code).toBe(1);
    expect(console.error).toHaveBeenCalledWith('The passwords are different.');
    expect(User.save).not.toHaveBeenCalled();
    expect(Session.removeAllOfUser).not.toHaveBeenCalled();
  });

  test('lets a database error through, so the script can exit with 1', async () => {
    User.save.mockRejectedValue(new Error('database down'));

    await expect(setUser('me@example.com', answers(GOOD, GOOD))).rejects.toThrow('database down');
    expect(Session.removeAllOfUser).not.toHaveBeenCalled();
  });

  test('refuses an empty password and an ended input', async () => {
    expect(await setUser('me@example.com', answers(''))).toBe(1);
    expect(User.save).not.toHaveBeenCalled();
  });

  test('refuses a repeated password that is missing', async () => {
    expect(await setUser('me@example.com', answers(GOOD, ''))).toBe(1);
    expect(User.save).not.toHaveBeenCalled();
  });

  test.each([undefined, '', 'not-an-email', 'me@', '@example.com', 'me @example.com'])(
    'shows the usage for the email %p without asking for a password',
    async (email) => {
      const prompt = answers(GOOD, GOOD);
      const code = await setUser(email, prompt);

      expect(code).toBe(2);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(prompt).not.toHaveBeenCalled();
      expect(User.save).not.toHaveBeenCalled();
    },
  );
});

// The real prompt, in a child process with piped input. Typing is hidden on a terminal; checked by hand with a
// pseudo terminal, which a test can't open portably.
describe('set-user script prompt', () => {
  const backendDir = path.join(__dirname, '..');
  const run = (code, input) =>
    spawnSync(process.execPath, ['-e', code], { cwd: backendDir, input, encoding: 'utf8' });

  test('asks for a line and returns it', () => {
    const result = run(
      `const prompt = require('./src/scripts/set-user').openPrompt();
       prompt.ask('New password: ').then((a) => { console.log('GOT:' + a); prompt.close(); })`,
      'Secret-Pass-1!\n',
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('New password: GOT:Secret-Pass-1!\n');
  });

  test('asks the password twice from one input', () => {
    const result = run(
      `const prompt = require('./src/scripts/set-user').openPrompt();
       (async () => { console.log('1:' + await prompt.ask('A: ')); console.log('2:' + await prompt.ask('B: ')); prompt.close(); })()`,
      'one\ntwo\n',
    );

    expect(result.stdout).toContain('1:one');
    expect(result.stdout).toContain('2:two');
  });

  test('answers an empty line when the input ends', () => {
    const result = run(
      `const prompt = require('./src/scripts/set-user').openPrompt();
       prompt.ask('A: ').then((a) => { console.log('GOT:[' + a + ']'); prompt.close(); })`,
      '',
    );

    expect(result.stdout).toContain('GOT:[]');
  });

  test('exits with 2 and the usage for a missing email, without opening the database', () => {
    const result = spawnSync(process.execPath, ['src/scripts/set-user.js'], {
      cwd: backendDir,
      input: '',
      encoding: 'utf8',
      env: { PATH: process.env.PATH, DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none' },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
  });

  test('exits with 1 for a weak password, and prints nothing of it', () => {
    const result = spawnSync(process.execPath, ['src/scripts/set-user.js', 'me@example.com'], {
      cwd: backendDir,
      input: 'weakpass\nweakpass\n',
      encoding: 'utf8',
      env: { PATH: process.env.PATH, DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The password needs');
    expect(result.stdout + result.stderr).not.toContain('weakpass\n');
  });

  test('exits with 1 and an error when the database is not reachable', () => {
    const result = spawnSync(process.execPath, ['src/scripts/set-user.js', 'me@example.com'], {
      cwd: backendDir,
      input: 'Correct-Horse-1\nCorrect-Horse-1\n',
      encoding: 'utf8',
      env: { PATH: process.env.PATH, DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none' },
      timeout: 20000,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('saved');
  });
});
