function handleQueryError (error) {
  if (error) {
    console.log(error.sql)
    throw error
  }
}

class DBWriter {
  constructor (connection, worldTimeOffset, maxInserts = 50) {
    this._connection = connection
    this._maxInserts = 200
    this._rows = []
    this._worldTimeOffset = worldTimeOffset
    this._verbose = false
  }

  addCrossing(crossing) {
    if (!this._timeOut) {
      this._timeOut = setTimeout(() => {
        this.flush()
        this._timeOut = null
      }, 2000)
    }
    this._rows.push([Math.round(crossing.playerWorldTime + this._worldTimeOffset),
      Math.round(crossing.serverWorldTime - crossing.playerWorldTime),
      crossing.riderId, crossing.lineId, crossing.forward,
      Math.round(crossing.distance), Math.round(crossing.calories), Math.round(crossing.time), Math.round(crossing.climbing),
      Math.round(crossing.speed), Math.round(crossing.heartrate), Math.round(crossing.cadence),
      crossing.groupId, crossing.rideOns, crossing.sport.toNumber(), crossing.roadPosition, crossing.laps, crossing.power])
    if (this._rows.length >= this._maxInserts) {
      this.flush()
    }
  }

  flush() {
    if (this._rows.length) {
      let q = this._connection.query('INSERT IGNORE INTO live_results (msec, latency, riderid, lineid, fwd, meters, mwh,' +
        'duration, elevation, speed, hr, cad, grp, rideons, sport, road_position, laps, power)'
        + 'VALUES ?'
        + ' ON DUPLICATE KEY UPDATE msec=VALUES(msec),power=VALUES(power),speed=VALUES(speed),hr=VALUES(hr),'
        + 'cad=VALUES(cad),duration=VALUES(duration),meters=VALUES(meters),elevation=VALUES(elevation),'
        + 'mwh=VALUES(mwh),fwd=VALUES(fwd),road_position=VALUES(road_position),'
        + 'grp=VALUES(grp),rideons=VALUES(rideons),road_position=VALUES(road_position),'
        + 'laps=VALUES(laps),latency=VALUES(latency),'
        + 'sport=VALUES(sport)', [this._rows],
        handleQueryError.bind(this)
      )
      if (this._verbose) {
        console.log(q.sql)
      }
      this._rows = []
    }
  }
}

module.exports = DBWriter