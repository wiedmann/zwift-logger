const ZwiftLineMonitor = require('zwift-line-monitor')
const EventEmitter = require('events')

class Watcher extends EventEmitter {
  constructor (port, chalklines, radius, options) {
    super()
    this._port = port
    this._radius = radius
    this._zlm = new ZwiftLineMonitor()
    this._zlm.on('crossing', this.handleCrossing.bind(this))
    if (options.verbose) this._zlm.setVerbose(options.verbose)
    this._visibilitySet = false
    this._verbose = options.verbose
    this._lastUpdate = 0
    this._loud = options.loud
    this._numCrossings = 0
    this._numUpdates = 0
    for (let line of chalklines) {
      if (line[0] === 'distance') {
        this._zlm.addDistanceMark(...line.slice(1))
      } else {
        this._zlm.addLine(...line)
      }
    }
  }

  handleCrossing(...args) {
    this._numCrossings++
    args[0].watcherId = this._watchingRiderId
    this.emit('crossing', ...args)
  }

  updateVisibilityFromPlayerState(playerState) {
    this._zlm.setVisibiltyBox(playerState.x, playerState.y, this._radius)
    this._visibilitySet = true
  }

  processIncomingPlayerState(playerState, serverWorldTime) {
    this._lastUpdate = new Date().getTime()
    this._numUpdates++
    if (this._radius && this._watchingRiderId && playerState.id === this._watchingRiderId) {
      this.updateVisibilityFromPlayerState(playerState)
    }
    if (! this._radius || this._visibilitySet) {
      this._zlm.updateRiderStatus(playerState, serverWorldTime)
    }
  }

  processOutgoingPlayerState(playerState) {
    this._lastUpdate = new Date().getTime()
    if (this._loud && (this._watchingRiderId !== playerState.watchingRiderId)) {
      console.log(`Watcher on port ${this._port} watching rider ID ${playerState.watchingRiderId}`)
    }
    this._watchingRiderId = playerState.watchingRiderId
    if (this._radius && playerState.watchingRiderId === playerState.id) {
      this.updateVisibilityFromPlayerState(playerState)
    }
  }

  get port () {return this._port}

}

module.exports = Watcher