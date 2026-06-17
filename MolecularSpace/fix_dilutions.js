const fs = require('fs');
const path = require('path');

const dir = '/Users/kijjaz/Desktop/Antigravity/2026/20260102 Building Perfumery Student Organ/MolecularSpace';
const files = [
    { name: 'data.js', prefix: 'const molecularData = ' },
    { name: 'data_hybrid.js', prefix: 'const molecularDataHybrid = ' }
];

let totalFixed = 0;

files.forEach(fileDef => {
    const filePath = path.join(dir, fileDef.name);
    console.log(`Processing ${fileDef.name}...`);
    
    let content = fs.readFileSync(filePath, 'utf-8');
    let jsonStr = content.replace(fileDef.prefix, '').replace(/;\s*$/, '');
    
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        console.error(`Error parsing JSON in ${fileDef.name}:`, e.message);
        return;
    }

    // Step 1: Build dictionary of neat materials
    const neatDict = {};
    data.forEach(mat => {
        // Assume neat if it doesn't contain "% in"
        if (!mat.name.includes('% in')) {
            neatDict[mat.name] = {
                chemGroup: mat.chemGroup,
                odor: mat.odor,
                wheel: mat.wheel
            };
        }
    });

    let fixedCount = 0;

    // Step 2: Apply to diluted materials
    data.forEach(mat => {
        if (mat.name.includes('% in')) {
            const match = mat.name.match(/^(.*?)\s+\d+(?:\.\d+)?%\s+in\s+[a-zA-Z0-9\-]+(\s+from\s+.*)?$/i);
            if (match) {
                const baseName = match[1];
                const vendor = match[2] || '';
                const lookupKey = baseName + vendor;
                
                const neatMat = neatDict[lookupKey];
                if (neatMat) {
                    let updated = false;
                    if (mat.chemGroup === 'UNKNOWN' || !mat.chemGroup) {
                        mat.chemGroup = neatMat.chemGroup;
                        updated = true;
                    }
                    if (mat.odor === 'UNKNOWN' || !mat.odor) {
                        mat.odor = neatMat.odor;
                        updated = true;
                    }
                    if (mat.wheel === 'Unclassified' || !mat.wheel) {
                        mat.wheel = neatMat.wheel;
                        updated = true;
                    }
                    
                    if (updated) {
                        console.log(`Fixed ${mat.name} -> Group: ${mat.chemGroup}, Odor: ${mat.odor}, Wheel: ${mat.wheel}`);
                        fixedCount++;
                    }
                }
            }
        }
    });

    // Step 3: Write back
    if (fixedCount > 0) {
        const newContent = fileDef.prefix + JSON.stringify(data, null, 2) + ';\n';
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`Updated ${fixedCount} entries in ${fileDef.name}.`);
        totalFixed += fixedCount;
    } else {
        console.log(`No entries needed fixing in ${fileDef.name}.`);
    }
});

console.log(`\nTotal entries fixed across all datasets: ${totalFixed}`);
