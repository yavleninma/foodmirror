-- Analytics views for DAU, WAU, MAU, new users, meals
-- Used by Metabase for dashboards

-- DAU: unique users with IN message per day
CREATE OR REPLACE VIEW "dau_daily" AS
SELECT
  ("createdAt" AT TIME ZONE 'UTC')::date AS "date",
  COUNT(DISTINCT "userId")::int AS "dau"
FROM "MessageEvent"
WHERE "direction" = 'IN'
GROUP BY ("createdAt" AT TIME ZONE 'UTC')::date
ORDER BY 1;

-- WAU: for each date, unique users active in [date-6, date]
CREATE OR REPLACE VIEW "wau_daily" AS
SELECT
  d."date",
  (
    SELECT COUNT(DISTINCT "userId")::int
    FROM "MessageEvent" m
    WHERE m."direction" = 'IN'
      AND (m."createdAt" AT TIME ZONE 'UTC')::date BETWEEN d."date" - 6 AND d."date"
  ) AS "wau"
FROM (
  SELECT DISTINCT ("createdAt" AT TIME ZONE 'UTC')::date AS "date"
  FROM "MessageEvent"
  WHERE "direction" = 'IN'
) d
ORDER BY d."date";

-- MAU: for each date, unique users active in [date-29, date]
CREATE OR REPLACE VIEW "mau_daily" AS
SELECT
  d."date",
  (
    SELECT COUNT(DISTINCT "userId")::int
    FROM "MessageEvent" m
    WHERE m."direction" = 'IN'
      AND (m."createdAt" AT TIME ZONE 'UTC')::date BETWEEN d."date" - 29 AND d."date"
  ) AS "mau"
FROM (
  SELECT DISTINCT ("createdAt" AT TIME ZONE 'UTC')::date AS "date"
  FROM "MessageEvent"
  WHERE "direction" = 'IN'
) d
ORDER BY d."date";

-- New users per day
CREATE OR REPLACE VIEW "new_users_daily" AS
SELECT
  ("createdAt" AT TIME ZONE 'UTC')::date AS "date",
  COUNT(*)::int AS "count"
FROM "User"
GROUP BY ("createdAt" AT TIME ZONE 'UTC')::date
ORDER BY 1;

-- Confirmed meals per day
CREATE OR REPLACE VIEW "meals_daily" AS
SELECT
  ("createdAt" AT TIME ZONE 'UTC')::date AS "date",
  COUNT(*)::int AS "count"
FROM "Meal"
GROUP BY ("createdAt" AT TIME ZONE 'UTC')::date
ORDER BY 1;
