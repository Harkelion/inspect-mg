const fetch = require("node-fetch");

const Bosses = [
    { dungeonId: 3205, bossTemplateId: 1000, bossName: "CFL" },
    { dungeonId: 3107, bossTemplateId: 1000, bossName: "DTG" },	
    { dungeonId: 444, bossTemplateId: 2000, bossName: "Bahaar" },
    { dungeonId: 3044, bossTemplateId: 2000, bossName: "SC" },		
    { dungeonId: 3105, bossTemplateId: 1000, bossName: "FL" },	
    { dungeonId: 982, bossTemplateId: 3000, bossName: "GLS" },
    { dungeonId: 3104, bossTemplateId: 1000, bossName: "CAT" },	
    { dungeonId: 3041, bossTemplateId: 2000, bossName: "DC" },	
    { dungeonId: 3102, bossTemplateId: 1000, bossName: "DA" },
    { dungeonId: 780, bossTemplateId: 3000, bossName: "VH" },
    { dungeonId: 3023, bossTemplateId: 2000, bossName: "AQ" },
    { dungeonId: 811, bossTemplateId: 81101, bossName: "AB" },
];

module.exports = function MoongourdInspect(mod) {
    const {command} = mod;

    let enabled = true,
        region = mod.region,
        cache = {};

    function formatDpsNumber(dps) {
        return `${(Math.round((dps / 1000000) * 100) / 100).toFixed(2)}m`
    }
    
    function formatColor(text, color) {
        return `<font color="${color}">${text}</font>`;
    }
    
    function getFormatMessage(message, {name, bossName, killCount, dpsHistory}, index) {
        if (index === 0) {
            message.push(`Moongourd statistics for ${formatColor(name, "#FDD017")}:`);
        }
        
        if (killCount > 0) {
            const worstDpsAverage = formatDpsNumber(dpsHistory.slice(Math.max(dpsHistory.length - 10, 0)).reduce((total, value, index, arr) => total + value / arr.length, 0));
            const bestDpsAverage = formatDpsNumber(dpsHistory.slice(0, 10).reduce((total, value, index, arr) => total + value / arr.length, 0));
            const highestDps = formatDpsNumber(dpsHistory[0]);
            const lowestDps = formatDpsNumber(dpsHistory[dpsHistory.length - 1]);
            message.push(`Total ${formatColor(bossName, "#FDD017")} kills: ${formatColor(killCount, "#00FFFF")}, Avg: ${formatColor(bestDpsAverage, "#00FFFF")}, H: ${formatColor(highestDps, "#00FFFF")}, L: ${formatColor(lowestDps, "#00FFFF")}`);
        } else {
            message.push(`Total ${formatColor(bossName, "#FDD017")} kills: ${formatColor(killCount, "#00FFFF")}`);
        }
    }
    
    async function inspect(name, { dungeonId, bossTemplateId, bossName }) {
        const realName = name;
        name = name.toLowerCase();
        if (!cache[name]) cache[name] = {};
        
        if (cache[name][`${dungeonId}-${bossTemplateId}`]) return await cache[name][`${dungeonId}-${bossTemplateId}`];
        
        return await (cache[name][`${dungeonId}-${bossTemplateId}`] = fetch(encodeURI(`https://kabedon.moongourd.com/api/mg/search.php?region=${region}&zone=${dungeonId}&boss=${bossTemplateId}&ver=1&name=${name}`), { timeout: 30000 })
            .then(res => res.json())
            .then(body => {
                const moongourdKillCount = body[0].count;
                const dpsHistory = [];
                
                let killCount = 0;
                if (moongourdKillCount) {
                    body[1].filter(log => JSON.parse(`"${log.playerName}"`).toLowerCase() === name).forEach(log => {
                        if (log.timestamp >= 1605229200 && log.timestamp <= 1605574800) return;
                        dpsHistory.push(log.playerDps);
                        killCount++;
                    });
                }
        
                dpsHistory.sort((a, b) => b - a);
                cache[name][`${dungeonId}-${bossTemplateId}`] = { name: realName, bossName, killCount, dpsHistory };
                
                return cache[name][`${dungeonId}-${bossTemplateId}`];
            }));
    }

    const inspectHookFunction = ({name}) => {
        if (!enabled) return;
        
        Promise.all(Bosses.map(boss => inspect(name, boss)))
            .then(results => {
                const message = [""];
                results.forEach(getFormatMessage.bind(null, message));
                command.message(message.join("\n"));
            })
            .catch(err => command.message(`Couldn't load moongourd statistics for ${formatColor(name, "#FDD017")}`));
    };

    command.add("mg", name => {
        if (name) {
            const previousState = enabled;
            enabled = true;
            inspectHookFunction({name});
            enabled = previousState;
        } else {
            enabled = !enabled;
            command.message(`Inspect moongourd ${enabled ? "enabled" : "disabled"}.`);
        }
    });

    mod.hook('S_OTHER_USER_APPLY_PARTY', 2, inspectHookFunction);
    mod.hook('S_USER_PAPERDOLL_INFO', 15, inspectHookFunction);

    this.destructor = () => {
        mod.command.remove(['mg']);
    }
}
