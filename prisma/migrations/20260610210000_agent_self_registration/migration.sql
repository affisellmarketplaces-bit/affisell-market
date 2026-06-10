-- Step 1: extend enum (must commit before using new values as default)

ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "AgentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
