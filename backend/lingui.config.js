/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  sourceLocale: 'en',
  locales: ['en', 'de'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
    },
  ],
};
