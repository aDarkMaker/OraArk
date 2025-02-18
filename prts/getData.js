const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');

const baseUrl = 'https://prts.wiki/w/%E6%95%8C%E4%BA%BA%E4%B8%80%E8%A7%88';
const doneLinksFile = path.join(__dirname, 'donelinks.json');
const allEnemiesDataFile = path.join(__dirname, '所有敌人数据.json');
const processedDataFile = path.join(__dirname, 'enemies.json');

function loadDoneLinks() {
    if (fs.existsSync(doneLinksFile)) {
        const data = fs.readFileSync(doneLinksFile, 'utf-8');
        return new Set(JSON.parse(data));
    }
    return new Set();
}

function saveDoneLinks(doneLinks) {
    fs.writeFileSync(doneLinksFile, JSON.stringify(Array.from(doneLinks), null, 4), 'utf-8');
}

function loadExistingData(filePath) {
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    return [];
}

async function getEnemyLinks(doneLinks) {
    console.log("开始获取敌人链接...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl);

    const enemyLinks = new Set();
    let pageCount = 0;
    const estimatedTotalPages = 122; // 估计的总页数

    // 进度条
    const linkBar = new cliProgress.SingleBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {percentage}% | 页数: {pageCount} | 链接数: {linkCount}'
    }, cliProgress.Presets.shades_classic);

    linkBar.start(estimatedTotalPages, 0, {
        pageCount: 0,
        linkCount: 0
    });

    while (true) {
        const links = await page.$$eval('.n-data-table-table a', anchors => anchors.map(anchor => ({
            name: anchor.textContent.trim(),
            href: anchor.href
        })));

        links.forEach(link => {
            if (link.name && !enemyLinks.has(link.name) && !doneLinks.has(link.href)) {
                enemyLinks.add(link.href);
            }
        });

        pageCount++;
        linkBar.update(pageCount, {
            pageCount,
            linkCount: enemyLinks.size
        });

        const nextButton = await page.$('#root > div > div > div > div.n-data-table.n-data-table--bottom-bordered.n-data-table--single-line.my-2 > div.n-data-table__pagination > div > div:nth-child(11)');
        const isDisabled = await page.$eval('#root > div > div > div > div.n-data-table.n-data-table--bottom-bordered.n-data-table--single-line.my-2 > div.n-data-table__pagination > div > div:nth-child(11)', button => button.classList.contains('n-pagination-item--disabled'));

        if (nextButton && !isDisabled) {
            await nextButton.click();
            await page.waitForSelector('.n-data-table-table a', { timeout: 5000 });
        } else {
            break;
        }
    }

    linkBar.stop();
    await browser.close();
    console.log(`总共找到 ${enemyLinks.size} 个敌人链接`);
    return Array.from(enemyLinks);
}

async function fetchEnemyData(url, retries = 3) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url);
        await page.waitForSelector('.wikitable', { timeout: 5000 });

        const data = await page.evaluate(() => {
            const extractTableData = (selector) => {
                const table = document.querySelector(selector);
                if (!table) return null;
                return Array.from(table.rows).map(row =>
                    Array.from(row.cells).map(cell => cell.textContent.trim())
                );
            };

            const name = document.querySelector('.wikitable.hlist.logo')?.rows[0]?.cells[0]?.textContent.trim() || '未知';

            return {
                name,
                abilities: extractTableData('.wikitable.hlist.logo'),
                stats: extractTableData('.wikitable.logo-top'),
                resistances: extractTableData('.wikitable.logo-top + .wikitable.logo-top')
            };
        });

        await browser.close();
        return data;
    } catch (error) {
        console.error(`Error fetching data for ${url}:`, error);
        await browser.close();
        if (retries > 0) {
            console.log(`重试中... 剩余重试次数: ${retries}`);
            return fetchEnemyData(url, retries - 1);
        } else {
            return null;
        }
    }
}

function processEnemyData(allEnemiesData) {
    return allEnemiesData.map(enemyData => {
        if (!enemyData || !enemyData.abilities || !enemyData.stats || !enemyData.resistances ||
            enemyData.abilities.length < 8 || enemyData.stats.length < 6 || enemyData.resistances.length < 3) {
            return null;
        }

        const { abilities, stats, resistances } = enemyData;

        return {
            "名称": enemyData.name,
            "种类": abilities[3][0],
            "地位级别": abilities[3][1],
            "攻击方式": abilities[3][2],
            "行动方式": abilities[3][3],
            "属性": {
                "耐久": abilities[5][0],
                "攻击力": abilities[5][1],
                "防御力": abilities[5][2],
                "法术抗性": abilities[5][3]
            },
            "能力": abilities[7][0],
            "数值": {
                "最大生命值": parseInt(stats[3][0]) || 0,
                "攻击力": parseInt(stats[3][1]) || 0,
                "防御力": parseInt(stats[3][2]) || 0,
                "法术抗性": parseInt(stats[3][3]) || 0,
                "攻击间隔": parseFloat(stats[3][4]) || 0,
                "攻击范围半径": stats[3][5]
            },
            "额外数值": {
                "目标价值": parseInt(stats[5][0]) || 0,
                "移动速度": parseFloat(stats[5][1]) || 0,
                "重量等级": parseInt(stats[5][2]) || 0,
                "元素抗性": parseInt(stats[5][3]) || 0,
                "损伤抵抗": parseInt(stats[5][4]) || 0,
                "生命恢复速度": parseInt(stats[5][5]) || 0
            },
            "抗性": {
                "沉默抗性": resistances[2][0],
                "晕眩抗性": resistances[2][1],
                "沉睡抗性": resistances[2][2],
                "冻结抗性": resistances[2][3],
                "浮空抗性": resistances[2][4],
                "战栗抗性": resistances[2][5],
                "恐惧抗性": resistances[2][6]
            }
        };
    }).filter(enemy => enemy !== null);
}

async function main() {
    console.log("开始获取数据：");
    const doneLinks = loadDoneLinks();
    const enemyLinks = await getEnemyLinks(doneLinks);
    const allData = loadExistingData(allEnemiesDataFile);
    let successCount = 0;
    let failCount = 0;

    // 进度条
    const multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {percentage}% | {value}/{total} | 成功:{successCount} 失败:{failCount} | {status}'
    }, cliProgress.Presets.shades_classic);

    const progressBar = multibar.create(enemyLinks.length, 0, {
        successCount: 0,
        failCount: 0,
        status: '进行中...'
    });

    for (let i = 0; i < enemyLinks.length; i++) {
        const link = enemyLinks[i];
        const enemyData = await fetchEnemyData(link);

        if (enemyData) {
            allData.push(enemyData);
            successCount++;
            doneLinks.add(link);

            // 每处理完一个数据就写入文件
            fs.writeFileSync(
                allEnemiesDataFile,
                JSON.stringify(allData, null, 4),
                'utf-8'
            );

            const processedData = processEnemyData(allData);
            fs.writeFileSync(
                processedDataFile,
                JSON.stringify(processedData, null, 4),
                'utf-8'
            );

            saveDoneLinks(doneLinks);
        } else {
            failCount++;
        }

        progressBar.update(i + 1, {
            successCount,
            failCount,
            status: `正在处理: ${enemyData?.name || '未知'}`
        });
    }

    multibar.stop();

    console.log(`\n数据处理完成！`);
    console.log(`总计: ${enemyLinks.length} | 成功: ${successCount} | 失败: ${failCount}`);
}

main().catch(console.error);