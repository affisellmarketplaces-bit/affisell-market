-- Dedupe legacy marketplace inbox rows before adding uniqueness guard.
DELETE FROM "Notification"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "userId", "orderId", "type"
        ORDER BY "createdAt" DESC
      ) AS "rowNum"
    FROM "Notification"
    WHERE "orderId" IS NOT NULL
      AND "type" IN ('NEW_ORDER', 'NEW_SALE')
  ) AS "ranked"
  WHERE "rowNum" > 1
);

CREATE UNIQUE INDEX "Notification_userId_orderId_marketplace_inbox_key"
ON "Notification" ("userId", "orderId", "type")
WHERE "orderId" IS NOT NULL AND "type" IN ('NEW_ORDER', 'NEW_SALE');
