const koa = require("koa");
const router = require("koa-router");
const websockify = require('koa-websocket');
const json = require("koa-json");
const bodyParser = require("koa-bodyparser");
const PoweredUP = require("node-poweredup");


const app =  new koa();

const http = router();
const ws = router();
const poweredUP = new PoweredUP.PoweredUP();

const socket = websockify(app);

app.use(json());
app.use(bodyParser());

var sLog="";

const COLORS = {
  off: 0,
  pink: 1,
  purple: 2,
  blue: 3,
  "light-blue": 4,
  cyan: 5,
  green: 6,
  yellow: 7,
  orange: 8,
  red: 9,
  white: 10
};

const HUBTYPES = {
  0: "Unknown",
  1: "WeDo2 Smart Hub",
  2: "Boost Move Hub",
  3: "Powered Up Hub",
  4: "Powered Up Remote",
  5: "Duplo Train Hub"
};

const DEVICETYPES = {
  0: "Unknown",
  1: "Basic Motor",
  2: "Train Motor",
  8: "Led Lights",
  22: "Boost Led",
  34: "WeDo2 Tilt",
  35: "WeDo2 Distance",
  37: "Boost Distance",
  38: "Boost Tacho Motor",
  39: "Boost Move Hub Motor",
  40: "Boost Tilt",
  41: "Duplo Train Base Motor",
  42: "Duplo Train Base Speaker",
  43: "Duplo Train Base Color",
  44: "Duplo Train Base Speedmeter",
  55: "Powered Up Remote Button"
};

const PORTS = ["A", "B"];

poweredUP.scan();
console.log("Looking for Hubs...");
sLog += "Looking for Hubs...\n";
poweredUP.on("discover", async (hub) => {
    await hub.connect();
    console.log(`Connected to ${hub.name} (${hub.uuid})`);
    sLog += `Connected to ${hub.name} (${hub.uuid})\n`;
    
    if (hub.name=="Gianluca"){
        hub.setLEDColor(9);
    }

    hub.on("disconnect", () => {
        console.log(`Hub ${hub.name} (${hub.uuid}) disconnected`);
        sLog += `Hub ${hub.name} (${hub.uuid}) disconnected\n`;
    })
});

//mostra il log su browser
http.get("/log/", showlog);

async function showlog(ctx) {
  ctx.body = sLog;
  await ctx;
}
//---------------------------------

//chiude il processo, scollegando tutti gli hub
http.get("/exit/", exitapp);

async function exitapp(ctx) {
  ctx.body = "Shutdown app...";
  await ctx;
  setTimeout(shutdownapp,2000);
}

function shutdownapp(){
  console.log("Shutdown from user!");
  process.exit(0);
}
//---------------------------------  

http.get("/hubs/", hubs);

function hubInfo(hub) {
  const { uuid, batteryLevel, firmwareVersion, current, name, rssi } = hub;
  const hubTypeId = hub.getHubType();
  const hubType = { name: HUBTYPES[hubTypeId], id: hubTypeId };
  let ports = [];
  if (hubTypeId != 4) {
    PORTS.forEach(port => {
      const deviceType = hub.getPortDeviceType(port);
      ports.push({ port: port, name: DEVICETYPES[deviceType], id: deviceType });
    });
  }
  const data = {
    uuid,
    batteryLevel,
    firmwareVersion,
    current,
    name,
    rssi,
    hubType,
    ports
  };
  return data;
}

async function hubs(ctx) {
  const connectedHubs = poweredUP.getConnectedHubs();
  let hubs = [];
  connectedHubs.forEach(hub => {
    hubs.push(hubInfo(hub));
  });
  ctx.body = { hubs: hubs };
  await ctx;
}

http.get("/hubs/:uuid/", hub);

async function hub(ctx) {
  const { uuid } = ctx.params;
  const { name } = ctx.query;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");

  if (name) {
    hub.setName(name);
  }

  ctx.body = hubInfo(hub);
  await ctx;
}

http.get("/hubs/:uuid/disconnect", hubDisconnect);

async function hubDisconnect(ctx) {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.disconnect();
  ctx.body = hubInfo(hub);
  await ctx;
}

http.get("/hubs/:uuid/connect", hubConnect);

async function hubConnect(ctx) {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.connect();
  ctx.body = hubInfo(hub);
  await ctx;
}

http.get("/hubs/:uuid/shutdown", shutdown);

async function shutdown(ctx) {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.shutdown();
  ctx.body = hubInfo(hub);
  await ctx;
}

http.get("/hubs/:uuid/:port/speed/:speed", speedControl);

async function speedControl(ctx) {
  const { uuid, port, speed } = ctx.params;
  const { time } = ctx.query;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.setMotorSpeed(port, speed, parseInt(time));
  ctx.body = { uuid, port, speed, time };
  await ctx;
}

http.get("/hubs/:uuid/:port/rampspeed/:fromSpeed/:toSpeed/:time",
  rampSpeedControl
);

async function rampSpeedControl(ctx) {
  const { uuid, port, fromSpeed, toSpeed, time } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.rampMotorSpeed(port, fromSpeed, toSpeed, parseInt(time));
  ctx.body = { uuid, port, fromSpeed, toSpeed, time };
  await ctx;
}

http.get("/hubs/:uuid/stop", motorStop);

async function motorStop(ctx) {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  PORTS.forEach(port => {
    const deviceType = hub.getPortDeviceType(port);
    if (deviceType === 2) {
      hub.brakeMotor(port);
    }
  });
  ctx.body = { uuid};
  await ctx;
}

http.get("/hubs/:uuid/:port/stop", motorStopPort);

async function motorStopPort(ctx) {
  const { uuid, port } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.hardStopMotor(port);
  ctx.body = { uuid, port };
  await ctx;
}

http.get("/hubs/:uuid/led/:color/", LEDcolorChange);

async function LEDcolorChange(ctx) {
  const { uuid, color } = ctx.params;
  const colorValue = COLORS[color];
  ctx.assert(colorValue, 422, "Wrong color!");
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.setLEDColor(colorValue);
  ctx.body = { hub_uuid: uuid, color_value: colorValue };
  await ctx;
}

//imposta il nome (senza spazi)
http.get("/hubs/:uuid/setname/:newname/", SetHubName);

async function SetHubName(ctx) {
  const { uuid, newname } = ctx.params;
  //const colorValue = COLORS[color];
  //ctx.assert(colorValue, 422, "Wrong color!")  
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.setName(newname);
  ctx.body = { hub_uuid: uuid, name_value: newname };
  await ctx;
}

ws.get('/:uuid/sensor/color', async (ctx) => {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);  
  ctx.websocket.on('message', (message) => {
    hub.on("color", async (port, color) => {
      ctx.websocket.send(color);
      });
  });
});

ws.get('/:uuid/sensor/distance', async (ctx) => {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);  
  ctx.websocket.on('message', (message) => {
    hub.on("distance", async (port, distance) => {
      ctx.websocket.send(distance);
      });
  });
});

ws.get('/:uuid/sensor/color-distance', async (ctx) => {
  const { uuid } = ctx.params;
  hub = poweredUP.getConnectedHubByUUID(uuid);  
  ctx.websocket.on('message', (message) => {
    hub.on("colorAndDistance", async (port, color, distance) => {
      ctx.websocket.send(distance);
      ctx.websocket.send(color);
      });
  });
});

//funzioni con pattern device/nome/comando

//funzione di supporto che Restituisce 
//l'UIDD di un un Hub, partendo dal nome impostato
//dall'utente. Se non lo trova, restituisce stringa vuota
function GetUIDDFromName(sname) {
  var uidd="";
  console.log(sname);
  const connectedHubs = poweredUP.getConnectedHubs();
  connectedHubs.forEach(hub => {
    if (hub.name==sname){
      uidd=hub.uuid;
      }
  });
  return uidd;
}

//Gestione motore
// http://localhost:3000/device/Gianluca/A/100  per impostare il motore sulla porta A al 100%
http.get("/device/:friendlyname/:port/speed/:speed", speedControlfname);

async function speedControlfname(ctx) {
  const { friendlyname, port, speed } = ctx.params;
  const { time } = ctx.query;
  var uuid = GetUIDDFromName(friendlyname);
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.setMotorSpeed(port, speed, parseInt(time));
  ctx.body = { friendlyname, uuid, port, speed, time };
  await ctx;
}

//gestione motore con rampa di partenza / discesa
http.get("/device/:friendlyname/:port/rampspeed/:fromSpeed/:toSpeed/:time",
  rampSpeedControlfname
);

async function rampSpeedControlfname(ctx) {
  const { friendlyname, port, fromSpeed, toSpeed, time } = ctx.params;
  var uuid = GetUIDDFromName(friendlyname);
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  const deviceType = hub.getPortDeviceType(port);
  ctx.assert(deviceType === 2, 422, "Motor not found on this port");
  hub.rampMotorSpeed(port, fromSpeed, toSpeed, parseInt(time));
  ctx.body = { uuid, port, fromSpeed, toSpeed, time };
  await ctx;
}

//imposta il colore
http.get("/device/:friendlyname/led/:color/", LEDcolorChangefname);

async function LEDcolorChangefname(ctx) {
  const { friendlyname, color } = ctx.params;
  const colorValue = COLORS[color];
  ctx.assert(colorValue, 422, "Wrong color!");
  var uuid = GetUIDDFromName(friendlyname);
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.setLEDColor(colorValue);
  ctx.body = { device_name: friendlyname, hub_uuid: uuid, color_value: colorValue };
  await ctx;
}


//spenge il dispositivo
http.get("/device/:friendlyname/shutdown", shutdownfname);

async function shutdownfname(ctx) {
  const { friendlyname } = ctx.params;
  var uuid = GetUIDDFromName(friendlyname);
  hub = poweredUP.getConnectedHubByUUID(uuid);
  ctx.assert(hub, 404, "Hub is not connected!");
  hub.shutdown();
  ctx.body = hubInfo(hub);
  await ctx;
}

//restituisce le info dal mone
http.get("/device/:friendlyname/", hubfromname);

async function hubfromname(ctx) {
  const connectedHubs = poweredUP.getConnectedHubs();
  const { friendlyname } = ctx.params;
  let hubs = [];
  connectedHubs.forEach(hub => {
    if (hub.name==friendlyname){
      hubs.push(hubInfo(hub));
      }
  });
  ctx.body = { hubs: hubs };
  await ctx;
}



app.use(http.routes()).use(http.allowedMethods());
app.ws.use(ws.routes()).use(ws.allowedMethods());
app.listen(3000, () => console.log("Server started..."));
