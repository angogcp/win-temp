const si = window.si || require('systeminformation'); si.cpuTemperature().then(t => console.log('TEMP!', t)).catch(console.error);
