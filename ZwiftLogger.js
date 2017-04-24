const ZwiftAccount = require('zwift-mobile-api')
const {wrappedStatus} = require('zwift-mobile-api/src/riderStatus')
const ZwiftPacketMonitor = require('zwift-packet-monitor')
const ZwiftLineMonitor = require('zwift-line-monitor')
const program = require('commander')
const mysql = require('mysql')
const jsonfile = require('jsonfile')
const DBWriter = require('./DBWriter')
let zlm = new ZwiftLineMonitor()
let worldTimeOffset = 0
let zpm = null

program
  .version('0.1.0')
  .option('-u, --user <zwiftuser>', 'zwift user to log in with')
  .option('-p, --password <password>', 'zwift password to log in with')
  .option('-D, --mysql_database <db>', 'mysql database to connect to')
  .option('-H, --mysql_host <host>', 'mysql host to connect to')
  .option('-U, --mysql_user <user>', 'mysql user name')
  .option('-P, --mysql_password <password>', 'mysql password')
  .option('-I, --interface <interface>', 'interface to monitor')
  .option('-c, --chalk <chalkfile>', 'file name of json file containing chalk line definitions')
  .option('-l, --list_interfaces', 'list available interfaces and exit')
  .option('-v, --verbose', 'turn on verbose mode')
  .parse(process.argv)


if (program.list_interfaces) {
  for (var device of ZwiftLineMonitor.deviceList()) {
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
  for (line of chalklines) {
    zlm.addLine(...line)
  }
})

const account = new ZwiftAccount(program.user, program.password)

const connection = mysql.createConnection({
  host: program.mysql_host,
  user: program.mysql_user,
  password: program.mysql_password,
  database: program.mysql_database,
  charset: 'utf8mb4',
  timezone: 'Z',
})

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
zlm.on('crossing', handleCrossing)

function processPlayerState(playerState, serverWorldTime) {
  zlm.updateRiderStatus(wrappedStatus(Object.assign({}, playerState)), serverWorldTime)
}

riders = account.getWorld().riders().then(riders => {
  worldTimeOffset = (Number(riders.currentDateTime) * 1000) - Number(riders.currentWorldTime)
  dbw = new DBWriter(connection, worldTimeOffset)
  zpm = new ZwiftPacketMonitor(program.interface)
  zpm.on('incomingPlayerState', processPlayerState)
  zpm.start()
  console.log('Monitoring network traffic.')
}).catch(error => {
  console.log(error)
})

