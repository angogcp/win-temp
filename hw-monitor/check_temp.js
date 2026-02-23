const si = require('systeminformation');

async function main() {
    console.log('=== systeminformation cpuTemperature ===');
    const temp = await si.cpuTemperature();
    console.log(JSON.stringify(temp, null, 2));

    console.log('\n=== systeminformation graphics ===');
    const gpu = await si.graphics();
    for (const ctrl of gpu.controllers) {
        console.log(`GPU: ${ctrl.model}, temp: ${ctrl.temperatureGpu}`);
    }
}

main().catch(console.error);
