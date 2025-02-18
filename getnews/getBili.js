const axios = require('axios');
const fs = require('fs');
const path = require('path');

const config = {
    uid: '267766441',
    limit: 1,
    outputDir: 'getnews/News/Bili',
    cookie: 'SESSDATA=dd1a0c90%2C1754487074%2C43643%2A22CjDUuo8zO-fULnA2rnK7alEd5FcsYEoekJDwW5YRP6DM3bOAcyqZ7nFolE2VIty2xLISVkZaNGpwRFBlSGxDbHFWaS1aQ1lNU1cyckppU0xYQVA5Y0ZVZkc0UjROeE5vcFJsUGViM21UNkFsS0Q2aDdMZDRqMXdLQ2JlejlLcVRvVHczOTVVWjdBIIEC'
};

function ensureDir() {
    if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
        console.log(`Created directory: ${config.outputDir}`);
    }
}

function saveDynamic(item) {
    const dynamic = parseDynamic(item);
    const filename = `dynamic_${dynamic.dynamic_id}.json`;
    const filePath = path.join(config.outputDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(dynamic, null, 2));
    console.log(`Saved: ${filename}`);
}

function parseDynamic(item) {
    const modules = item.modules;
    return {
        dynamic_id: item.id_str,
        type: getTypeName(item.type),
        timestamp: item.modules.module_author.pub_ts,
        time: new Date(item.modules.module_author.pub_ts * 1000).toLocaleString(),
        content: modules.module_dynamic?.desc?.text || 'No text content',
        link: `https://t.bilibili.com/${item.id_str}`
    };
}

function getTypeName(type) {
    const types = {
        'DYNAMIC_TYPE_WORD': 'Text',
        'DYNAMIC_TYPE_AV': 'Video',
        'DYNAMIC_TYPE_DRAW': 'Gallery',
        'DYNAMIC_TYPE_FORWARD': 'Repost'
    };
    return types[type] || `Unknown (${type})`;
}

async function fetchDynamics() {
    try {
        ensureDir();

        const apiUrl = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space`;
        const params = {
            host_mid: config.uid,
            offset: '',
            features: 'itemOpusStyle'
        };

        const response = await axios.get(apiUrl, {
            params,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Cookie': config.cookie,
                'Referer': `https://space.bilibili.com/${config.uid}/dynamic`,
                'Origin': 'https://space.bilibili.com'
            }
        });

        if (response.data.code === 0) {
            const items = response.data.data.items;
            if (items && items.length > 0) {
                const dynamics = items.slice(0, config.limit);
                console.log(`Successfully fetched ${dynamics.length} dynamics`);
                dynamics.forEach(saveDynamic);
            } else {
                console.log('No dynamics found');
            }
        } else {
            console.log('API Error:', response.data.message);
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

fetchDynamics();