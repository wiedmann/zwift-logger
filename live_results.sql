CREATE TABLE `live_results` (
	`msec` BIGINT(13) NULL DEFAULT NULL,
	`riderid` INT(11) NULL DEFAULT NULL,
	`lineid` INT(11) NULL DEFAULT NULL,
	`fwd` INT(11) NULL DEFAULT NULL,
	`meters` INT(11) NULL DEFAULT NULL,
	`mwh` INT(11) NULL DEFAULT NULL,
	`duration` INT(11) NULL DEFAULT NULL,
	`elevation` INT(11) NULL DEFAULT NULL,
	`speed` INT(11) NULL DEFAULT NULL,
	`hr` INT(11) NULL DEFAULT NULL,
	`monitorid` INT(11) NULL DEFAULT NULL,
	`timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	`backupwatcher` INT(1) NULL DEFAULT NULL,
	`lpup` BIGINT(13) NULL DEFAULT NULL,
	`pup` VARCHAR(20) NULL DEFAULT NULL,
	`cad` INT(11) NULL DEFAULT NULL,
	`grp` INT(11) NULL DEFAULT NULL,
	`latency` SMALLINT(6) NULL DEFAULT NULL,
	`laps` SMALLINT(6) NULL DEFAULT NULL,
	`sport` TINYINT(4) NULL DEFAULT NULL,
	`road_position` INT(11) NULL DEFAULT NULL,
	`rideons` SMALLINT(6) NULL DEFAULT NULL,
	`power` INT(11) NULL DEFAULT NULL,
	INDEX `live_results_index` (`msec`, `riderid`)
)
COLLATE='latin1_swedish_ci'
ENGINE=InnoDB
;