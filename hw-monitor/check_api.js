const http = require('http');

http.get('http://localhost:3005/api/system', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log('CPU Temperature:', json.cpu?.temperature);
        console.log('CPU Temp Cores:', json.cpu?.temperatureCores);
        console.log('CPU Temp Max:', json.cpu?.tempMax);
        console.log('GPU Temperatures:');
        json.graphics?.forEach((g, i) => {
            console.log(`  GPU ${i}: ${g.model} - ${g.temperature}°C`);
        });
    });
}).on('error', e => console.error('Failed:', e.message));
