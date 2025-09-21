WITH this_weeks_date_range AS (
    SELECT
        "2025-08-24 12:00:00" AS dateFrom,
        "2025-08-31 11:59:59" AS dateTo
),
last_weeks_date_range AS (
    SELECT
        DATE_SUB(dateFrom, INTERVAL 7 DAY) AS dateFrom,
        DATE_SUB(dateTo, INTERVAL 7 DAY) AS dateTo
    FROM this_weeks_date_range
),
this_week_headers AS (
    SELECT
        header.id,
        MAX(measurement.blockNumber) AS maxBlockNumber
    FROM this_weeks_date_range
    JOIN RPCMeasurementHeader header
    JOIN Network n
        ON n.id = header.networkId
        AND n.id = 2
    JOIN RPCMeasurement measurement
        ON measurement.rpcMeasurementHeaderId = header.id
    WHERE header.executedAt BETWEEN this_weeks_date_range.dateFrom AND this_weeks_date_range.dateTo
    GROUP BY header.id
),
last_week_headers AS (
    SELECT
        header.id,
        MAX(measurement.blockNumber) AS maxBlockNumber
    FROM last_weeks_date_range
    JOIN RPCMeasurementHeader header
    JOIN Network n
        ON n.id = header.networkId
        AND n.id = 2
    JOIN RPCMeasurement measurement
        ON measurement.rpcMeasurementHeaderId = header.id
    WHERE header.executedAt BETWEEN last_weeks_date_range.dateFrom AND last_weeks_date_range.dateTo
    GROUP BY header.id
),
this_week_total_measurements AS (
    SELECT 2016 as slotsInPeriod, COUNT(id) AS actualMeasurementsInPeriod
    FROM this_week_headers
),
last_week_total_measurements AS (
    SELECT 2016 as slotsInPeriod, COUNT(id) AS actualMeasurementsInPeriod
    FROM last_week_headers
),
block_lag AS (
    SELECT 1800 AS blocks
),
this_week_measurements AS (
    SELECT
        v.id AS validatorId,
        this_week_total_measurements.actualMeasurementsInPeriod,        
        this_week_total_measurements.slotsInPeriod,
        this_week_total_measurements.actualMeasurementsInPeriod / this_week_total_measurements.slotsInPeriod * 100 AS missingMeasurementsPercentage,
        COUNT(measurement.id) AS electedCount,
        this_week_total_measurements.actualMeasurementsInPeriod - COUNT(measurement.id) AS notElectedCount,
        ((this_week_total_measurements.actualMeasurementsInPeriod - COUNT(measurement.id)) / this_week_total_measurements.actualMeasurementsInPeriod) * 100 AS notElectedPercentagePeriod,
        SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL THEN 1 ELSE 0 END) AS measuredDownMeasurementCount,
        ROUND((SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL THEN 1 ELSE 0 END) / this_week_total_measurements.slotsInPeriod * 100), 2) AS measuredDownPercentageInTotalPeriod,
        SUM(CASE WHEN this_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks THEN 1 ELSE 0 END) AS measuredHighBlockLagCount,
        SUM(CASE WHEN this_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks THEN 1 ELSE 0 END) / this_week_total_measurements.slotsInPeriod * 100 AS measuredHighBlockLagPercentageInTotalPeriod,
        SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL OR (this_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks) THEN 1 ELSE 0 END) AS measuredDownOrHighBlockLagCount,
        ROUND((SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL OR (this_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks) THEN 1 ELSE 0 END) / this_week_total_measurements.slotsInPeriod * 100), 2) AS measuredDownOrHighBlockLagPercentageInTotalPeriod
    FROM this_week_headers
    JOIN this_week_total_measurements
    JOIN block_lag
    LEFT JOIN RPCMeasurement measurement
        ON measurement.rpcMeasurementHeaderId = this_week_headers.id
    LEFT JOIN Validator v
        ON v.id = measurement.validatorId
    GROUP BY 
        v.id, 
        this_week_total_measurements.actualMeasurementsInPeriod,
        this_week_total_measurements.slotsInPeriod
),
last_week_measurements AS (
    SELECT
        v.id AS validatorId,
        last_week_total_measurements.actualMeasurementsInPeriod,        
        last_week_total_measurements.slotsInPeriod,
        last_week_total_measurements.actualMeasurementsInPeriod / last_week_total_measurements.slotsInPeriod * 100 AS missingMeasurementsPercentage,
        COUNT(measurement.id) AS electedCount,
        last_week_total_measurements.actualMeasurementsInPeriod - COUNT(measurement.id) AS notElectedCount,
        ((last_week_total_measurements.actualMeasurementsInPeriod - COUNT(measurement.id)) / last_week_total_measurements.actualMeasurementsInPeriod) * 100 AS notElectedPercentagePeriod,
        SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL THEN 1 ELSE 0 END) AS measuredDownMeasurementCount,
        ROUND((SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL THEN 1 ELSE 0 END) / last_week_total_measurements.slotsInPeriod * 100), 2) AS measuredDownPercentageInTotalPeriod,
        SUM(CASE WHEN last_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks THEN 1 ELSE 0 END) AS measuredHighBlockLagCount,
        SUM(CASE WHEN last_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks THEN 1 ELSE 0 END) / last_week_total_measurements.slotsInPeriod * 100 AS measuredHighBlockLagPercentageInTotalPeriod,
        SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL OR (last_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks) THEN 1 ELSE 0 END) AS measuredDownOrHighBlockLagCount,
        ROUND((SUM(CASE WHEN measurement.up = 0 OR measurement.up IS NULL OR (last_week_headers.maxBlockNumber - measurement.blockNumber > block_lag.blocks) THEN 1 ELSE 0 END) / last_week_total_measurements.slotsInPeriod * 100), 2) AS measuredDownOrHighBlockLagPercentageInTotalPeriod
    FROM last_week_headers
    JOIN last_week_total_measurements
    JOIN block_lag
    LEFT JOIN RPCMeasurement measurement
        ON measurement.rpcMeasurementHeaderId = last_week_headers.id
    LEFT JOIN Validator v
        ON v.id = measurement.validatorId
    GROUP BY 
        v.id, 
        last_week_total_measurements.actualMeasurementsInPeriod,
        last_week_total_measurements.slotsInPeriod
),
this_week_formatted_results AS (
    SELECT
        v.address,
        COALESCE(
            CONVERT(FROM_BASE64(vn.validatorName) USING utf8mb4),
            '<Unnamed>'
        ) AS validatorName,
        v.rpcUrl,
        DATE_FORMAT(CONVERT_TZ(this_weeks_date_range.dateFrom, '+00:00', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') AS dateFrom,
        DATE_FORMAT(CONVERT_TZ(this_weeks_date_range.dateTo, '+00:00', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') AS dateTo,
        this_week_measurements.actualMeasurementsInPeriod,
        this_week_measurements.electedCount,
        this_week_measurements.missingMeasurementsPercentage,
        this_week_measurements.notElectedCount,
        this_week_measurements.notElectedPercentagePeriod,
        this_week_measurements.measuredDownMeasurementCount,
        this_week_measurements.measuredDownPercentageInTotalPeriod,
        this_week_measurements.measuredHighBlockLagCount,
        this_week_measurements.measuredHighBlockLagPercentageInTotalPeriod,
        this_week_measurements.measuredDownOrHighBlockLagCount,
        this_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod,
        CASE
            WHEN v.rpcUrl IS NULL THEN 'SLASHED'
            WHEN this_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 80 THEN 'SLASHED'
            WHEN this_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 60 THEN '0.4' 
            WHEN this_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 40 THEN '0.6'             
            WHEN this_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 20 THEN '0.8'             
            ELSE '1.0' 
        END AS score
    FROM this_week_measurements
    JOIN this_weeks_date_range
    LEFT JOIN Validator v
        ON v.id = this_week_measurements.validatorId
    LEFT JOIN ValidatorName vn
        ON vn.validatorId = v.id
        AND vn.toBlock IS NULL
),
last_week_formatted_results AS (
    SELECT
        v.address,
        COALESCE(
            CONVERT(FROM_BASE64(vn.validatorName) USING utf8mb4),
            '<Unnamed>'
        ) AS validatorName,
        v.rpcUrl,
        DATE_FORMAT(CONVERT_TZ(last_weeks_date_range.dateFrom, '+00:00', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') AS dateFrom,
        DATE_FORMAT(CONVERT_TZ(last_weeks_date_range.dateTo, '+00:00', '+00:00'), '%Y-%m-%dT%H:%i:%sZ') AS dateTo,
        last_week_measurements.actualMeasurementsInPeriod,
        last_week_measurements.electedCount,
        last_week_measurements.missingMeasurementsPercentage,
        last_week_measurements.notElectedCount,
        last_week_measurements.notElectedPercentagePeriod,
        last_week_measurements.measuredDownMeasurementCount,
        last_week_measurements.measuredDownPercentageInTotalPeriod,
        last_week_measurements.measuredHighBlockLagCount,
        last_week_measurements.measuredHighBlockLagPercentageInTotalPeriod,
        last_week_measurements.measuredDownOrHighBlockLagCount,
        last_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod,
        CASE
            WHEN v.rpcUrl IS NULL THEN 'SLASHED'
            WHEN last_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 80 THEN 'SLASHED'
            WHEN last_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 60 THEN '0.4' 
            WHEN last_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 40 THEN '0.6'             
            WHEN last_week_measurements.measuredDownOrHighBlockLagPercentageInTotalPeriod > 20 THEN '0.8'             
            ELSE '1.0' 
        END AS score
    FROM last_week_measurements
    JOIN last_weeks_date_range
    LEFT JOIN Validator v
        ON v.id = last_week_measurements.validatorId
    LEFT JOIN ValidatorName vn
        ON vn.validatorId = v.id
        AND vn.toBlock IS NULL
),
score_change AS (
    SELECT 
        currentWeek.address,
        currentWeek.validatorName,
        currentWeek.rpcUrl,
        currentWeek.dateFrom,
        currentWeek.dateTo,
        currentWeek.actualMeasurementsInPeriod,
        currentWeek.electedCount,
        currentWeek.missingMeasurementsPercentage,
        currentWeek.notElectedCount,
        currentWeek.notElectedPercentagePeriod,
        currentWeek.measuredDownMeasurementCount,
        currentWeek.measuredDownPercentageInTotalPeriod,
        currentWeek.measuredHighBlockLagCount,
        currentWeek.measuredHighBlockLagPercentageInTotalPeriod,
        currentWeek.measuredDownOrHighBlockLagCount,
        currentWeek.measuredDownOrHighBlockLagPercentageInTotalPeriod,
        currentWeek.score,
        lastWeek.score as lastWeekScore,
        CASE
            WHEN currentWeek.score = lastWeek.score THEN "NO CHANGE"
            ELSE currentWeek.score
        END AS scoreChange
    FROM this_week_formatted_results currentWeek
    LEFT JOIN last_week_formatted_results lastWeek
        ON lastWeek.address = currentWeek.address
    UNION
    SELECT         
        lastWeek.address,
        lastWeek.validatorName,
        lastWeek.rpcUrl,
        currentWeek.dateFrom,
        currentWeek.dateTo,
        currentWeek.actualMeasurementsInPeriod,
        currentWeek.electedCount,
        currentWeek.missingMeasurementsPercentage,
        currentWeek.notElectedCount,
        currentWeek.notElectedPercentagePeriod,
        currentWeek.measuredDownMeasurementCount,
        currentWeek.measuredDownPercentageInTotalPeriod,
        currentWeek.measuredHighBlockLagCount,
        currentWeek.measuredHighBlockLagPercentageInTotalPeriod,
        currentWeek.measuredDownOrHighBlockLagCount,
        currentWeek.measuredDownOrHighBlockLagPercentageInTotalPeriod,
        currentWeek.score,
        lastWeek.score as lastWeekScore,
        CASE
            WHEN currentWeek.score = lastWeek.score OR currentWeek.score IS NULL THEN "NO CHANGE"
            ELSE currentWeek.score
        END AS scoreChange
    FROM last_week_formatted_results lastWeek
    LEFT JOIN this_week_formatted_results currentWeek
        ON currentWeek.address = lastWeek.address
    ORDER BY validatorName
)
SELECT address, validatorName, rpcUrl, measuredDownOrHighBlockLagPercentageInTotalPeriod as downPercentage, COALESCE(lastWeekScore, 'NOT ELECTED') as lastWeekScore, COALESCE(score, 'NOT ELECTED') as currentWeekScore, scoreChange, actualMeasurementsInPeriod as currentWeekMeasurementCount 
FROM score_change
WHERE scoreChange != "NO CHANGE" or score = "SLASHED"
-- SELECT * FROM score_change
;
