const ZwiftAccount = require('zwift-mobile-api')
const {wrappedStatus} = require('zwift-mobile-api/src/riderStatus')
const ZwiftPacketMonitor = require('zwift-packet-monitor')
const Watcher = require('./Watcher')
const program = require('commander')
const mysql = require('mysql')
const jsonfile = require('jsonfile')
const DBWriter = require('./DBWriter')
let watchers = []
let worldTimeOffset = 0
let zpm = null
let lines

program
  .version('0.1.0')
  .option('-u, --user <zwiftuser>', 'zwift user to log in with')
  .option('-p, --password <password>', 'zwift password to log in with')
  .option('-D, --mysql_database <db>', 'mysql database to connect to')
  .option('-H, --mysql_host <host>', 'mysql host to connect to')
  .option('-U, --mysql_user <user>', 'mysql user name')
  .option('-P, --mysql_password <password>', 'mysql password')
  .option('-I, --interface <interface>', 'interface to monitor (or IP address of that interface)')
  .option('-c, --chalk <chalkfile>', 'file name of json file containing chalk line definitions')
  .option('-r, --radius <radius>', 'radius (in cm) that each watcher is responsible - note that visibility is a box, not a circle')
  .option('-l, --list_interfaces', 'list available interfaces and exit')
  .option('-v, --verbose', 'turn on verbose mode')
  .option('--loud', 'turn loud mode on - periodic status messages will be printed out')
  .parse(process.argv)


if (program.list_interfaces) {
  for (var device of ZwiftPacketMonitor.deviceList()) {
    console.log(`${device.name} ${device.description} ${device.addresses[0].addr}`)
  }
  return
}

program.chalk = program.chalk || 'chalk.json'
jsonfile.readFile(program.chalk, (err, chalklines) => {
  if (err) {
    throw err
  }
  // id, name, wold, roadID, roadTime
  lines = chalklines
})

const account = new ZwiftAccount(program.user, program.password)

const connectionParameters = {
  host: program.mysql_host,
  user: program.mysql_user,
  password: program.mysql_password,
  database: program.mysql_database,
  charset: 'utf8mb4',
  timezone: 'Z',
}

let dbw

function handleCrossing (crossing) {
  if (dbw) {
    dbw.addCrossing(crossing)
  }
  let data = [Math.round(crossing.playerWorldTime + worldTimeOffset), Math.round(crossing.serverWorldTime + worldTimeOffset),
    crossing.riderId, crossing.lineId, crossing.forward,
    Math.round(crossing.distance), Math.round(crossing.calories), Math.round(crossing.time), Math.round(crossing.climbing),
    Math.round(crossing.speed), Math.round(crossing.heartrate), Math.round(crossing.cadence),
    crossing.groupId, crossing.rideOns, crossing.sport.toNumber()]
  console.log(data.join())
}

function getWatcher(port) {
  if (!lines) {
    return null
  }
  if (!(port in watchers)) {
    if (program.loud){
      console.log(`New watcher on port ${port}`)
    }
    watchers[port] = new Watcher(port, lines, program.radius, {verbose: program.verbose, loud: program.loud})
    watchers[port].on('crossing', handleCrossing)
  }
  return watchers[port]
}

function processIncomingPlayerState(playerState, serverWorldTime, localPort) {
  watcher = getWatcher(localPort)
  if (watcher) {
    watcher.processIncomingPlayerState(wrappedStatus(Object.assign({}, playerState)), serverWorldTime)
  }
}

function processOutgoingPlayerState(playerState, serverWorldTime, localPort) {
  watcher = getWatcher(localPort)
  if (watcher) {
    watcher.processOutgoingPlayerState(playerState, serverWorldTime)
  }
}

riders = account.getWorld().riders().then(riders => {
  worldTimeOffset = (Number(riders.currentDateTime) * 1000) - Number(riders.currentWorldTime)
  dbw = new DBWriter(connectionParameters, worldTimeOffset)
  if (program.verbose) {
    dbw._verbose=true
  }
  if (program.loud) {
    dbw._loud=true
    dbw._verbose=true
  }
  zpm = new ZwiftPacketMonitor(program.interface)
  zpm.on('incomingPlayerState', processIncomingPlayerState)
  zpm.on('outgoingPlayerState', processOutgoingPlayerState)
  zpm.start()
  console.log('Monitoring network traffic.')
}).catch(error => {
  console.log(error)
})

