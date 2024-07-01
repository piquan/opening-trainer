import globals from "globals";

import js from "@eslint/js";

import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import reactJsxRuntime from 'eslint-plugin-react/configs/jsx-runtime.js';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
    {
        // As a special case, eslint applies "ignores" globally if
        // it's the only key.
        ignores: ["dist", "public/stockfish*"],
    },
    js.configs.recommended,
    reactRecommended,
    reactJsxRuntime,
    {
        files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
        plugins: {
            "react-refresh": reactRefresh,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: { jsx: true, },
            },
            globals: { ...globals.browser, },
        },
        rules: {
            "react-refresh/only-export-components": [
                "warn",
                { "allowConstantExport": true }
            ]
        },
        settings: {
            "react": { "version": "detect", },
        },
    },
];
