/**
 * Window event that opens the ⌘K palette. Kept in its own module so a trigger
 * button can dispatch it without pulling the palette (cmdk, framer-motion,
 * next-auth) into the page's first JavaScript.
 */
export const COMMAND_K_OPEN_EVENT = "affisell:command-k-open"
