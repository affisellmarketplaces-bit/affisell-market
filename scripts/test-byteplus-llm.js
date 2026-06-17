#!/usr/bin/env node
/**
 * Quick probe: Dola Seed 2.0 Mini (AP Singapour — Affisell copy).
 *
 * Usage:
 *   BYTEPLUS_API_KEY=ark-... \
 *   BYTEPLUS_BASE_URL=https://ark.ap-southeast.bytepluses.com/api/v3 \
 *   node scripts/test-byteplus-llm.js
 */
"use strict"

process.env.BYTEPLUS_ONLY = "dola-seed-2-0-mini"
require("./test-byteplus-11.js")
