const { ESLint } = require("eslint");

module.exports = [
  {
    ignores: ["node_modules/", "dist/", "build/"], // Ignora pastas comuns
  },
  {
    files: ["**/*.ts", "**/*.tsx"], // Aplica as regras apenas a arquivos TypeScript
    languageOptions: {
      ecmaVersion: "latest", // Suporte para a versão mais recente do ECMAScript
      sourceType: "module", // Suporte para módulos ES
      parser: require("@typescript-eslint/parser"), // Parser para TypeScript
      parserOptions: {
        project: "./tsconfig.json", // Caminho para o arquivo tsconfig.json
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
      prettier: require("eslint-plugin-prettier"),
    },
    rules: {
      "prettier/prettier": "error", // Integração com Prettier
      "no-unused-vars": "off", // Desativa a regra padrão do ESLint
      "@typescript-eslint/no-unused-vars": ["error"], // Usa a regra do TypeScript
      "@typescript-eslint/no-explicit-any": "warn", // Emite um aviso para o uso de `any`
      "no-console": "warn", // Emite um aviso para `console.log`
    },
  },
];