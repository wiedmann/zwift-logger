const NodeCache = require('node-cache')

class PowerupTracker {
  constructor (riderTimeout = 1200) {
    this._riders = new NodeCache ( { stdTTL: riderTimeout, checkperiod: 120, useClones: false })
    this._riderTimeout = riderTimeout
  }

  addPowerup(riderId, pup, timestamp) {
    let obj = this._riders.get(riderId)

    if (obj) {
      obj.powerup = pup
      obj.timestamp = timestamp
    } else {
      this._riders.set(riderId, {id: riderId, powerup: pup, timestamp: timestamp})
    }
  }

  findPowerup(riderId) {
    return this._riders.get(riderId)
  }
}

module.exports = PowerupTracker
