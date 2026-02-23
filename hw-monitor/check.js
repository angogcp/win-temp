const si = require('systeminformation'); si.cpuTemperature().then(t => console.log('Final Temp:', t));
