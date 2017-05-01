const ZwiftLineMonitor = require('zwift-line-monitor')
const EventEmitter = require('events')

class Watcher extends EventEmitter {
  constructor (port, chalklines, radius, verbose=false) {
    super()
    this._port = port
    this._radius = radius
    this._zlm = new ZwiftLineMonitor()
    this._zlm.on('crossing', (...args) => {this.emit('crossing', ...args)})
    if (verbose) this._zlm.setVerbose(verbose)
    this._visibilitySet = false
    this._verbose = verbose
    for (let line of chalklines) {
      this._zlm.addLine(...line)
    }
  }

  updateVisibilityFromPlayerState(playerState) {
    this._zlm.setVisibiltyBox(playerState.x, playerState.y, this._radius)
    this._visibilitySet = true
  }

  processIncomingPlayerState(playerState, serverWorldTime) {
    if (this._radius && this._watchingRiderId && playerState.id === this._watchingRiderId) {
      this.updateVisibilityFromPlayerState(playerState)
    }
    if (! this._radius || this._visibilitySet) {
      this._zlm.updateRiderStatus(playerState, serverWorldTime)
    }
  }

  processOutgoingPlayerState(playerState) {
    this._watchingRiderId = playerState.watchingRiderId
    if (this._radius && playerState.watchingRiderId === playerState.id) {
      this.updateVisibilityFromPlayerState(playerState)
    }
  }

  get port () {return this._port}

}

module.exports = Watcher