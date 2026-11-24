// Fixed tokenizer and price table. o200k_base is not Claude's tokenizer (none is public), so counts are estimates.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { deps } from './paths.mjs';

const require = createRequire(join(deps, 'package.json'));
const { getEncoding } = require('js-tiktoken');
const encoding = getEncoding('o200k_base');

export const countTokens = text => encoding.encode(text, [], []).length;

// Claude Sonnet 5.5, https://platform.claude.com/docs/en/about-claude/pricing, read on 2026-11-24.
export const usdPerMillion = { input: 2, output: 10 };
