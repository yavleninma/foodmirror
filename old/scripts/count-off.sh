#!/bin/bash
docker exec foodmirror-postgres-1 psql -U fm -d foodmirror -t -c '
SELECT s.name, COUNT(*) 
FROM "FoodReference" fr 
JOIN "FoodSource" s ON fr."sourceId" = s.id 
GROUP BY s.name 
ORDER BY COUNT(*) DESC;
'
echo "---"
docker exec foodmirror-postgres-1 psql -U fm -d foodmirror -t -c 'SELECT COUNT(*) as total FROM "FoodReference";'
echo "--- Alias count ---"
docker exec foodmirror-postgres-1 psql -U fm -d foodmirror -t -c 'SELECT COUNT(*) FROM "FoodAlias";'
echo "--- Sizes ---"
docker exec foodmirror-postgres-1 psql -U fm -d foodmirror -t -c "SELECT pg_size_pretty(pg_total_relation_size('\"FoodReference\"')) AS food_ref;"
docker exec foodmirror-postgres-1 psql -U fm -d foodmirror -t -c "SELECT pg_size_pretty(pg_total_relation_size('\"FoodAlias\"')) AS food_alias;"
docker exec foodmirror-postgres-1 psql -U fm -d foodmirror -t -c "SELECT pg_size_pretty(pg_database_size('foodmirror')) AS db;"
