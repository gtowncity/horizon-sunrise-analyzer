import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['dist/**','node_modules/**','_local_audit/**','test-results/**','playwright-report/**']},js.configs.recommended,...ts.configs.recommended,{languageOptions:{globals:{console:'readonly',process:'readonly',URL:'readonly',fetch:'readonly',Buffer:'readonly',setTimeout:'readonly',performance:'readonly'}},rules:{'@typescript-eslint/no-explicit-any':'error','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}});
