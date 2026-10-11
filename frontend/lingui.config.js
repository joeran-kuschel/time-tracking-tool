/** @type {import('@lingui/conf').LinguiConfig} */
export default {
  sourceLocale: 'en',
  locales: ['en', 'de'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
}
