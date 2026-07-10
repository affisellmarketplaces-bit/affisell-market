#!/usr/bin/env node
/** Print local dev origin (respects PORT, default 3001). */
import { devLocalhostOrigin } from "./dev-localhost-url.mjs"

console.log(devLocalhostOrigin())
