(async () => { const si = require('systeminformation'); const t = await si.cpuTemperature(); console.log(JSON.stringify(t)); })()
