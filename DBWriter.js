const fs = require('fs')
const readline = require('readline')
const mysql = require('mysql')
const dbcolumns = ['msec', 'latency', 'riderid', 'lineid', 'fwd', 'meters', 'mwh',
  'duration', 'elevation', 'speed', 'hr', 'cad', 'grp', 'rideons', 'sport', 'road_position', 'laps', 'power']
const journalFilename = 'zwift-logger.journal'

class DBWriter {
  constructor (connectionParameters, worldTimeOffset, maxInserts = 50) {
    this._connectionParameters = connectionParameters
    this._connectionParameters.charset = 'utf8mb4'
    this._connectionParameters.timezone = 'Z'
    this._maxInserts = 200
    this._rows = []
    this._worldTimeOffset = worldTimeOffset
    this._verbose = false
    this.openConnection()
  }

  openConnection () {
    if (this._connection) {
      this._connection.end(() => {})
      this._connection = null
    }
    this._connection = mysql.createConnection(this._connectionParameters)
    this._connection.on('error', (error) => {
      console.error(`Mysql connection error: ${error.stack}`)
      this.openConnection()
    })
    this._connection.connect((err) => {
      if (err) {
        if (this._connection) {
          this._connection.end(() => {})
          this._connection = null
        }
        console.error(`Error connecting to the database: ${err.stack}`)
        if (this._reconnectTimeout) {
          clearTimeout(this._reconnectTimeout)
          this._reconnectTimeout = null
        }
        this._reconnectTimeout = setTimeout(() => {
          console.info("Retrying database connection")
          this.openConnection()
          this._reconnectTimeout = null
        }, 3000)
      } else {
        if (fs.existsSync(journalFilename)) {
          this.readJournal()
        }
      }
    })
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

  flushToJournal() {
    if (this._rows.length) {
      let fd = fs.openSync(journalFilename, 'a')
      for (let row of this._rows) {
        let crossing={}
        let index = 0
        for (let col of dbcolumns) {
          crossing[col] = row[index++]
        }
        fs.writeFileSync(fd, `${JSON.stringify(crossing)}\n`)
      }
      fs.close(fd)
      this._rows = []
    }
  }

  readJournal() {
    const rl = readline.createInterface({
      input: fs.createReadStream(journalFilename)
    })
    rl.on('line', (line) => {
      let obj = JSON.parse(line)
      let row = dbcolumns.map(val => obj[val])
      this._rows.push(row)
      if (this._connection && this._rows.length >= this._maxInserts) {
        this.flushToDB(false)
      }
      if (! this._connection) {
        return
      }
    })
    rl.on('close', () => {
      if (this._connection) {
        if (this._rows.length) {
          this.flushToDB(false)
        }
        let counter = 1
        let newname
        while (fs.existsSync(newname = `${journalFilename}.bak.${counter}`)) {
          counter++
        }
        fs.renameSync(journalFilename, newname)
      }
    })
  }

  flushToDB (flushToJournal = true) {
    let sql = `INSERT IGNORE INTO live_results (${dbcolumns.join(',')}) `
      + 'VALUES ?'
      + ' ON DUPLICATE KEY UPDATE '
    sql += dbcolumns.map(col => `${col}=VALUES(${col})`).join(',')
    let q = this._connection.query(sql, [this._rows], (error) => {
      if (error) {
        if (flushToJournal) {
          this.flushToJournal()
        }
        console.error(`Error writing data - reopening connection: ${error.sql}`)
        this.openConnection()
      } else {
        this._rows = []
        if (this._verbose) {
          console.log(q.sql)
        }
      }
    })
  }

  flush() {
    if (this._rows.length) {
      if (this._connection) {
        this.flushToDB()
      } else {
        this.flushToJournal()
      }
    }
  }
}

module.exports = DBWriter