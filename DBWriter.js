const fs = require('fs')
const readline = require('readline')
const mysql = require('mysql')
const dbcolumns = ['msec', 'latency', 'riderid', 'lineid', 'fwd', 'meters', 'mwh',
  'duration', 'elevation', 'speed', 'hr', 'cad', 'grp', 'rideons', 'sport', 'road_position', 'laps', 'power',
  'monitorid']
const journalFilename = 'zwift-logger.journal'

class DBWriter {
  constructor (connectionParameters, worldTimeOffset, maxInserts = 50) {
    this._connectionParameters = connectionParameters
    this._connectionParameters.autocommit = true
    this._connectionParameters.charset = 'utf8mb4'
    this._connectionParameters.timezone = 'Z'
    this._maxInserts = 200
    this._rows = []
    this._worldTimeOffset = worldTimeOffset
    this._verbose = false
    this._loud = false
    this._activeLines = {}
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
        if (this._loud || this._verbose) {
          console.log('Connected to database')
        }
        if (fs.existsSync(journalFilename)) {
          console.log(`Reading journal ${journalFilename}`)
          this.readJournal()
          console.log('Done reading journal')
        }
      }
    })
  }

  markLinesActive() {
    if (this._connection) {
      let q = this._connection.query("UPDATE chalkline SET active=1, lastmonitored=now() WHERE line in (?)", [Object.keys(this._activeLines)])
      this._connection.commit()
      if (this._loud) {
        console.log(q.sql)
      }
    } else {
      if (this._loud) {
        console.log('Can\'t mark lines active - no db connection')
      }
    }
    this._activeLines = {}
  }

  addCrossing(crossing) {
    if (!this._timeOut) {
      this._timeOut = setTimeout(() => {
        this.flush()
        this._timeOut = null
      }, 2000)
    }
    if (!this._lineTimeout) {
      this._lineTimeout = setTimeout(() => {
        this.markLinesActive()
        this._lineTimeout = null
      }, 1000)
    }
    this._activeLines[crossing.lineId] = true
    this._rows.push([Math.round(crossing.playerWorldTime + this._worldTimeOffset),
      Math.round(crossing.serverWorldTime - crossing.playerWorldTime),
      crossing.riderId, crossing.lineId, crossing.forward,
      Math.round(crossing.distance), Math.round(crossing.calories), Math.round(crossing.time), Math.round(crossing.climbing),
      Math.round(crossing.speed), Math.round(crossing.heartrate), Math.round(crossing.cadence),
      crossing.groupId, crossing.rideOns, crossing.sport.toNumber(), crossing.roadPosition, crossing.laps, crossing.power, crossing.watcherId])
    if (this._rows.length >= this._maxInserts) {
      this.flush()
    }
  }

  flushToJournal() {
    if (this._rows.length) {
      if (this._loud || this._verbose) {
        console.log(`Flushing ${this._rows.length} rows to journal`)
      }
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
    if (this._verbose) {
      console.log(`Flushing ${this._rows.length} rows to database`)
    }
    let sql = `INSERT INTO live_results (${dbcolumns.join(',')}) `
      + 'VALUES ?'
      + ' ON DUPLICATE KEY UPDATE '
    sql += dbcolumns.map(col => `${col}=VALUES(${col})`).join(',')
    let q = this._connection.query(sql, [this._rows], (error) => {
      if (error) {
        if (flushToJournal) {
          this.flushToJournal()
        }
        console.error(`Error inserting data - reopening connection: ${error} ${error.sql}`)
        this.openConnection()
      } else {
        this._rows = []
        if (this._verbose) {
          console.log(q.sql)
        }
      }
    })
    this._connection.commit((error) => {
      if (error) {
        if (flushToJournal) {
          this.flushToJournal()
        }
        console.error(`Error committing data - reopening connection: ${error} ${error.sql}`)
        this.openConnection()
      }
    })
  }

  flush() {
    if (this._rows.length) {
      if (this._connection) {
        this.flushToDB()
      } else {
        if (this._loud) {
          console.log(`Not connected to database - falling back to journal`)
        }
        this.flushToJournal()
      }
    }
  }
}

module.exports = DBWriter