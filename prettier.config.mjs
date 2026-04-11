/**
 * Shared formatting rules for the monorepo.
 *
 * Keep these aligned with the existing code style to avoid unnecessary churn.
 *
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ['prettier-plugin-astro'],
  printWidth: 160,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
}

export default config
