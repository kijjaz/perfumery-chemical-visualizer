// Standard chemical colors used in molecular visualization
const COLOR_MAP = {
    'Floral': '#d4af37',
    'Woody': '#7a6a53',
    'Wood': '#7a6a53',
    'Amber': '#996515',
    'Citrus': '#f9d71c',
    'Fruity': '#cc5500',
    'Green': '#4f7942',
    'Water': '#4d79ff',
    'Aromatic': '#7a8b7a',
    'Spice': '#8b0000',
    'Musk': '#bba8a8',
    'Gourmand': '#c28e0e',
    'Animalic': '#4b3621'
};

document.addEventListener('DOMContentLoaded', () => {
    initNaturalsExplorer();
    initWindowManager();
    init3DPlot();
    setupSearch();
    initFilters();
    initCompareModal();
    initPrecisionControls();

    document.getElementById('toggle-labels').addEventListener('change', (e) => {
        updateLabelsVisibility();
    });

    // Keyboard shortcut for toggling names
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'n' && document.activeElement.tagName !== 'INPUT') {
            toggleLabels();
        }
    });

    document.getElementById('neighbor-limit').addEventListener('change', () => {
        if (currentSelectedMol) {
            selectNode(currentSelectedMol); // re-render list and lines
            applyFilters(); // update proximity view
        }
    });

    // Restore selected molecule slightly after plot init
    setTimeout(() => {
        if (osState && osState.selectedMolId) {
            selectNodeById(osState.selectedMolId);
        }
    }, 1000);
});

let osState = {
    windows: {},
    selectedMolId: null
};
let zIndexCounter = 100;

let currentPlotData = [];
let currentSelectedMol = null;
let baseTraceIndex = 0;
let molViewer = null;
let extraTraceCount = 0;

let showLabels = false;
let proximityMode = false;
let pinnedNodeIds = new Set();
let lastClickTime = 0;
let lastClickedPoint = -1;

function updateLabelsVisibility() {
    const show = showLabels;
    if (!currentPlotData || currentPlotData.length === 0) return;

    if (!show) {
        Plotly.restyle('plot-container', { mode: ['markers'] }, [0]);
        return;
    }

    // Performance optimization: 
    // If showing names, limit it to avoid WebGL string texture freezing.

    // We get the opacity array from the base trace (handles active filters)
    const graphDiv = document.getElementById('plot-container');
    const opacities = graphDiv.data[0].marker.opacity;

    let activeNodes = [];
    if (Array.isArray(opacities)) {
        opacities.forEach((op, index) => {
            if (op > 0.1) activeNodes.push(index);
        });
    } else {
        // If not an array, all nodes are visible
        activeNodes = molecularData.map((_, i) => i);
    }

    // Only render text for active nodes, and truncate if there are too many (> 150)
    const textArray = molecularData.map((m, i) => {
        // If it's a selected node, neighbor, or pinned node, ALWAYS show name
        if (currentSelectedMol && currentSelectedMol.id === m.id) return m.name;
        if (pinnedNodeIds.has(m.id)) return m.name;
        
        if (currentSelectedMol) {
            const isNeighbor = currentSelectedMol.neighbors.find(n => n.target === m.id);
            if (isNeighbor) return m.name;
        }

        // Otherwise, only show if it's an active node (filtered) and we aren't overloaded
        if (activeNodes.includes(i) && (activeNodes.length <= 150 || showLabels)) {
            return m.name;
        }

        return "";
    });

    Plotly.restyle('plot-container', {
        mode: ['markers+text'],
        text: [textArray]
    }, [0]);
}

function init3DPlot() {
    const trace = {
        x: molecularData.map(m => m.x),
        y: molecularData.map(m => m.y),
        z: molecularData.map(m => m.z),
        mode: 'markers', // 'markers+text' triggered by toggle
        type: 'scatter3d',
        text: molecularData.map(m => m.name),
        textposition: 'top center',
        textfont: {
            family: 'Space Mono, monospace',
            size: 10,
            color: '#aaa'
        },
        hovertemplate: '<b>%{text}</b><extra></extra>',
        marker: {
            size: 6,
            color: molecularData.map(m => COLOR_MAP[m.wheel] || '#888'),
            symbol: molecularData.map(m => m.source === 'reference' ? 'diamond' : 'circle'),
            opacity: 0.9,
            line: {
                width: 0.5,
                color: '#fff'
            }
        }
    };

    const layout = {
        paper_bgcolor: '#0a0a0a',
        scene: {
            xaxis: {
                showbackground: false, showgrid: true, gridcolor: '#222',
                zerolinecolor: '#444', title: '', showticklabels: false
            },
            yaxis: {
                showbackground: false, showgrid: true, gridcolor: '#222',
                zerolinecolor: '#444', title: '', showticklabels: false
            },
            zaxis: {
                showbackground: false, showgrid: true, gridcolor: '#222',
                zerolinecolor: '#444', title: '', showticklabels: false
            },
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.5 }
            }
        },
        margin: { l: 0, r: 0, b: 0, t: 0 },
        showlegend: false
    };

    Plotly.newPlot('plot-container', [trace], layout, { displayModeBar: false });

    document.getElementById('plot-container').on('plotly_click', function (data) {
        if (data.points.length > 0) {
            const pointIndex = data.points[0].pointNumber;
            const mol = molecularData[pointIndex];
            
            const currentTime = new Date().getTime();
            const isDoubleClick = (currentTime - lastClickTime < 400) && (lastClickedPoint === pointIndex);
            
            lastClickTime = currentTime;
            lastClickedPoint = pointIndex;

            if (isDoubleClick) {
                centerOnNode(mol);
            } else {
                selectNode(mol);
            }
        }
    });

    currentPlotData = [trace];
}

function centerOnNode(mol) {
    if (!mol) return;
    const w = 10.0; // Tighter zoom for double click
    Plotly.relayout('plot-container', {
        'scene.xaxis.range': [mol.x - w, mol.x + w],
        'scene.yaxis.range': [mol.y - w, mol.y + w],
        'scene.zaxis.range': [mol.z - w, mol.z + w]
    });
}

function selectNode(mol) {
    if (!mol) return;

    // 1. Update the UI Panel
    const nameEl = document.getElementById('info-name');
    if (mol.source === 'reference') {
        nameEl.innerHTML = `${mol.name} <span class="reference-badge">REFERENCE</span>`;
    } else {
        nameEl.innerText = mol.name;
    }
    
    // Pin the label
    pinnedNodeIds.add(mol.id);
    updateLabelsVisibility();

    document.getElementById('info-chem').innerText = mol.chemGroup || 'Unknown Chem';
    document.getElementById('info-odor').innerText = mol.odor || 'Unknown Odor';

    // 2. Draw 3D Structure or fallback to SMILES
    const viewerDiv = document.getElementById('3dmol-viewer');
    const canvas = document.getElementById('smiles-canvas');

    if (mol.molblock && typeof $3Dmol !== 'undefined') {
        canvas.style.display = 'none';
        viewerDiv.style.display = 'block';
        if (!molViewer) {
            molViewer = $3Dmol.createViewer(viewerDiv, { backgroundColor: 'black' });
            viewerDiv.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
        }
        molViewer.clear();
        molViewer.addModel(mol.molblock, "sdf");
        molViewer.setStyle({}, { stick: { radius: 0.2 }, sphere: { scale: 0.3 } });
        molViewer.zoomTo();
        molViewer.render();
    } else {
        viewerDiv.style.display = 'none';
        canvas.style.display = 'block';
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (mol.smiles && typeof SmilesDrawer !== 'undefined') {
            let sw = new SmilesDrawer.Drawer({ width: 280, height: 200 });
            SmilesDrawer.parse(mol.smiles, function (tree) {
                sw.draw(tree, 'smiles-canvas', 'dark', false);
            });
        }
    }

    // 3. Populate neighbor list
    currentSelectedMol = mol;
    const listHtml = document.getElementById('neighbor-list');
    const exactHtml = document.getElementById('exact-match-list');
    const exactContainer = document.getElementById('exact-matches-container');
    const limitSelect = document.getElementById('neighbor-limit');

    listHtml.innerHTML = '';
    exactHtml.innerHTML = '';

    let limit = 20;
    if (limitSelect) {
        limit = parseInt(limitSelect.value, 10) || 20;
    }

    let exactMatches = [];
    let otherNeighbors = [];

    mol.neighbors.forEach(n => {
        // threshold for 100% since float precision
        if (n.score > 0.999) {
            exactMatches.push(n);
        } else {
            otherNeighbors.push(n);
        }
    });

    if (exactMatches.length > 0) {
        exactContainer.style.display = 'block';
        exactMatches.forEach(n => {
            const targetMol = molecularData.find(m => m.id === n.target);
            if (!targetMol) return;
            exactHtml.innerHTML += `
                <div class="neighbor-card" onclick="selectNodeById('${targetMol.id}')" style="border-left-color: #4ba6a6;">
                    <span class="neighbor-name">${targetMol.name}</span>
                    <span class="neighbor-score">100% Match</span>
                </div>
            `;
        });
    } else {
        exactContainer.style.display = 'none';
    }

    const topNeighbors = otherNeighbors.slice(0, limit);

    // Combine all 3D line segments into a single trace for massive WebGL performance boost
    let newExtraTraces = [];
    let lineX = [];
    let lineY = [];
    let lineZ = [];

    const allLinesToDraw = [...exactMatches, ...topNeighbors];

    allLinesToDraw.forEach(n => {
        const targetMol = molecularData.find(m => m.id === n.target);
        if (!targetMol) return;

        // Add to Sidebar for sub-100% matches
        if (n.score <= 0.999) {
            const p = Math.round(n.score * 100);
            listHtml.innerHTML += `
                <div class="neighbor-card" onclick="selectNodeById('${targetMol.id}')">
                    <span class="neighbor-name">${targetMol.name}</span>
                    <span class="neighbor-score">${p}% Match</span>
                </div>
            `;
        }

        // Add 3D Line coordinates separated by null to prevent connecting all lines
        lineX.push(mol.x, targetMol.x, null);
        lineY.push(mol.y, targetMol.y, null);
        lineZ.push(mol.z, targetMol.z, null);
    });

    if (lineX.length > 0) {
        const linesTrace = {
            type: 'scatter3d',
            mode: 'lines',
            x: lineX,
            y: lineY,
            z: lineZ,
            line: {
                color: '#4ba6a6',
                width: 3
            },
            hoverinfo: 'none',
            showlegend: false,
            opacity: 0.7
        };
        newExtraTraces.push(linesTrace);
    }

    // Add Highlight marker trace
    const highlightTrace = {
        type: 'scatter3d',
        mode: 'markers',
        x: [mol.x], y: [mol.y], z: [mol.z],
        marker: {
            size: 10,
            color: '#fff',
            symbol: 'circle-open',
            line: { color: '#d4af37', width: 4 }
        },
        hoverinfo: 'none',
        showlegend: false
    };
    newExtraTraces.push(highlightTrace);

    // Remove old extra traces first to prevent buildup
    if (extraTraceCount > 0) {
        let indices = [];
        // Trace 0 is always the base scatter plot. We remove from 1 onwards.
        for (let i = 1; i <= extraTraceCount; i++) {
            indices.push(i);
        }
        Plotly.deleteTraces('plot-container', indices);
    }

    // Add new extra traces
    extraTraceCount = newExtraTraces.length;
    if (extraTraceCount > 0) {
        Plotly.addTraces('plot-container', newExtraTraces);
    }

    // Show Panel
    openWindow('window-info');

    // 5. Update Visibility
    applyFilters();
    updateLabelsVisibility();

    // 6. Save State
    osState.selectedMolId = mol.id;
    localStorage.setItem('aromaOsState', JSON.stringify(osState));

    // Zoom camera to node (wider window to prevent intense snap)
    const w = 15.0; // Zoom window size
    Plotly.relayout('plot-container', {
        'scene.xaxis.range': [mol.x - w, mol.x + w],
        'scene.yaxis.range': [mol.y - w, mol.y + w],
        'scene.zaxis.range': [mol.z - w, mol.z + w]
    });

    // Refresh labels to ensure neighbors have text if toggled
    if (document.getElementById('toggle-labels').checked) {
        updateLabelsVisibility();
    }
}

function clearHighlight() {
    // Remove extra traces
    if (extraTraceCount > 0) {
        let indices = [];
        for (let i = 1; i <= extraTraceCount; i++) {
            indices.push(i);
        }
        Plotly.deleteTraces('plot-container', indices);
        extraTraceCount = 0;
    }

    // Reset camera zoom
    Plotly.relayout('plot-container', {
        'scene.xaxis.autorange': true,
        'scene.yaxis.autorange': true,
        'scene.zaxis.autorange': true
    });

    // Refresh labels after deselecting
    if (document.getElementById('toggle-labels').checked) {
        updateLabelsVisibility();
    }
}

function selectNodeById(id) {
    const mol = molecularData.find(m => m.id === id);
    if (mol) selectNode(mol);
}

function setupSearch() {
    const input = document.getElementById('hub-search');
    const datalist = document.getElementById('molecule-search-list');

    // Populate datalist efficiently
    let optionsHtml = '';
    molecularData.forEach(m => {
        optionsHtml += `<option value="${m.name}"></option>`;
    });
    datalist.innerHTML = optionsHtml;

    input.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        if (!term) {
            clearHighlight();
            return;
        }

        // Only exact string selection triggers the expensive UI update to prevent halting
        const exactMatch = molecularData.find(m => m.name.toLowerCase() === term);
        if (exactMatch) {
            selectNode(exactMatch);
        }
    });
}

function initFilters() {
    const wheels = new Set();
    const chems = new Set();
    const suppliers = new Set();

    molecularData.forEach(m => {
        if (m.wheel) wheels.add(m.wheel);
        if (m.chemGroup) {
            m.chemGroup.split(',').forEach(c => chems.add(c.trim()));
        }
        if (m.supplier) suppliers.add(m.supplier);
    });

    const wheelSelect = document.getElementById('hub-filter-family');
    Array.from(wheels).sort().forEach(w => {
        wheelSelect.innerHTML += `<option value="${w}">${w}</option>`;
    });

    const chemSelect = document.getElementById('hub-filter-chem');
    Array.from(chems).sort().forEach(c => {
        chemSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });

    const supplierSelect = document.getElementById('hub-filter-supplier');
    if (supplierSelect) {
        Array.from(suppliers).sort().forEach(s => {
            supplierSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
        supplierSelect.addEventListener('change', () => {});
    }

    wheelSelect.addEventListener('change', () => {}); // Managed by Hub
    chemSelect.addEventListener('change', () => {});

    // Main Menu / Dashboard logic
    document.getElementById('menu-reset').addEventListener('click', () => {
        resetView();
        closeWindow('start-menu');
    });

    document.getElementById('menu-toggle-labels').addEventListener('click', () => {
        toggleLabels();
    });

    document.getElementById('taskbar-toggle-labels').addEventListener('click', () => {
        toggleLabels();
    });
}

function toggleLabels() {
    showLabels = !showLabels;
    const btn = document.getElementById('taskbar-toggle-labels');
    if (showLabels) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
    updateLabelsVisibility();
}

function resetView() {
    const familySelect = document.getElementById('hub-filter-family');
    const chemSelect = document.getElementById('hub-filter-chem');
    const supplierSelect = document.getElementById('hub-filter-supplier');
    if (familySelect) familySelect.value = 'all';
    if (chemSelect) chemSelect.value = 'all';
    if (supplierSelect) supplierSelect.value = 'all';
    
    applyFilters();

    // Reset camera
    Plotly.relayout('plot-container', {
        'scene.camera': { eye: { x: 1.5, y: 1.5, z: 1.5 } },
        'scene.xaxis.autorange': true,
        'scene.yaxis.autorange': true,
        'scene.zaxis.autorange': true
    });
    
    closeWindow('window-info');
    clearHighlight();
    const search = document.getElementById('hub-search');
    if (search) search.value = '';
}

function applyHubFilters() {
    applyFilters();
    closeWindow('window-discovery');
}

function clearHubFilters() {
    resetView();
}

function applyFilters() {
    const wheelVal = document.getElementById('hub-filter-family')?.value || 'all';
    const chemVal = document.getElementById('hub-filter-chem')?.value || 'all';
    const supplierVal = document.getElementById('hub-filter-supplier')?.value || 'all';

    const opacities = molecularData.map(m => {
        // If Proximity Mode is on, only show the selected molecule and its neighbors
        if (proximityMode && currentSelectedMol) {
            const isSelf = m.id === currentSelectedMol.id;
            const isNeighbor = currentSelectedMol.neighbors.find(n => n.target === m.id);
            return (isSelf || isNeighbor) ? 0.9 : 0.01;
        }

        let matchWheel = wheelVal === 'all' || m.wheel === wheelVal;
        let matchChem = chemVal === 'all' || (m.chemGroup && m.chemGroup.includes(chemVal));
        let matchSupplier = supplierVal === 'all' || m.supplier === supplierVal;
        return (matchWheel && matchChem && matchSupplier) ? 0.9 : 0.05;
    });

    const sizes = molecularData.map(m => {
        if (proximityMode && currentSelectedMol) {
            const isSelf = m.id === currentSelectedMol.id;
            const isNeighbor = currentSelectedMol.neighbors.find(n => n.target === m.id);
            return isSelf ? 12 : (isNeighbor ? 8 : 2);
        }

        let matchWheel = wheelVal === 'all' || m.wheel === wheelVal;
        let matchChem = chemVal === 'all' || (m.chemGroup && m.chemGroup.includes(chemVal));
        let matchSupplier = supplierVal === 'all' || m.supplier === supplierVal;
        return (matchWheel && matchChem && matchSupplier) ? 6 : 3;
    });

    Plotly.restyle('plot-container', {
        'marker.opacity': [opacities],
        'marker.size': [sizes]
    }, [0]);

    if (showLabels) {
        updateLabelsVisibility();
    }
}

function toggleProximity() {
    proximityMode = !proximityMode;
    const btn = document.getElementById('taskbar-proximity');
    if (proximityMode) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
    applyFilters();
}

// --- Precision Navigation Logic ---

function initPrecisionControls() {
    const plotDiv = document.getElementById('plot-container');

    // Calibrated Scroll Zoom
    plotDiv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.05 : 0.95; // Gentle zoom factor
        
        const fullLayout = plotDiv._fullLayout;
        if (!fullLayout || !fullLayout.scene) return;
        
        const scene = fullLayout.scene._scene;
        const camera = scene.getCamera();
        
        // Zoom by moving the camera eye closer/further
        const eye = camera.eye;
        const newEye = {
            x: eye.x * factor,
            y: eye.y * factor,
            z: eye.z * factor
        };
        
        Plotly.relayout(plotDiv, { 'scene.camera.eye': newEye });
    }, { passive: false });

    // Keyboard Navigation (WASD / Arrows)
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;

        const key = e.key.toLowerCase();
        const step = 2.0;

        if (key === 'w' || key === 'arrowup') navMove('up', step);
        if (key === 's' || key === 'arrowdown') navMove('down', step);
        if (key === 'a' || key === 'arrowleft') navMove('left', step);
        if (key === 'd' || key === 'arrowright') navMove('right', step);
        if (key === 'q') navMove('up-z', step);
        if (key === 'e') navMove('down-z', step);
    });
}

function navMove(dir, step = 5.0) {
    const plotDiv = document.getElementById('plot-container');
    const fullLayout = plotDiv._fullLayout;
    if (!fullLayout || !fullLayout.scene) return;
    
    const xaxis = fullLayout.scene.xaxis;
    const yaxis = fullLayout.scene.yaxis;
    const zaxis = fullLayout.scene.zaxis;

    let xr = [...xaxis.range];
    let yr = [...yaxis.range];
    let zr = [...zaxis.range];

    switch(dir) {
        case 'up': yr[0] += step; yr[1] += step; break;
        case 'down': yr[0] -= step; yr[1] -= step; break;
        case 'left': xr[0] -= step; xr[1] -= step; break;
        case 'right': xr[0] += step; xr[1] += step; break;
        case 'up-z': zr[0] += step; zr[1] += step; break;
        case 'down-z': zr[0] -= step; zr[1] -= step; break;
        case 'home': resetView(); return;
    }

    Plotly.relayout(plotDiv, {
        'scene.xaxis.range': xr,
        'scene.yaxis.range': yr,
        'scene.zaxis.range': zr
    });
}

function resetCamera(view) {
    const plotDiv = document.getElementById('plot-container');
    let eye = { x: 1.5, y: 1.5, z: 1.5 };
    
    if (view === 'top') eye = { x: 0, y: 0, z: 2.5 };
    if (view === 'front') eye = { x: 2.5, y: 0, z: 0 };
    
    Plotly.relayout(plotDiv, {
        'scene.camera.eye': eye,
        'scene.xaxis.autorange': true,
        'scene.yaxis.autorange': true,
        'scene.zaxis.autorange': true
    });
}


// --- Compare Modal Logic ---

let compareViewerA = null;
let compareViewerB = null;

function initCompareModal() {
    // Base64 to bit vector conversion
    function base64ToByteArray(base64) {
        const binString = window.atob(base64);
        const len = binString.length;
        let bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binString.charCodeAt(i);
        }
        return bytes;
    }

    function popCount(byte) {
        let count = 0;
        for (let i = 0; i < 8; i++) {
            if ((byte & (1 << i)) !== 0) count++;
        }
        return count;
    }

    // Native JS Tanimoto Similarity calculation
    function calculateTanimoto(b64A, b64B) {
        if (!b64A || !b64B) return 0;
        const a = base64ToByteArray(b64A);
        const b = base64ToByteArray(b64B);

        let intersection = 0;
        let sumA = 0;
        let sumB = 0;

        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            intersection += popCount(a[i] & b[i]);
            sumA += popCount(a[i]);
            sumB += popCount(b[i]);
        }

        const union = sumA + sumB - intersection;
        if (union === 0) return 0;
        return intersection / union;
    }

    function renderCompareMolecule(mol, viewerDivId, canvasId, nameId, chemId, odorId, isA) {
        document.getElementById(nameId).innerText = mol.name;
        const chemSpan = document.getElementById(chemId);
        const odorSpan = document.getElementById(odorId);

        chemSpan.innerText = mol.chemGroup || 'Unknown';
        chemSpan.style.opacity = mol.chemGroup ? '1' : '0';

        odorSpan.innerText = mol.odor || 'Unknown';
        odorSpan.style.opacity = mol.odor ? '1' : '0';

        const viewerDiv = document.getElementById(viewerDivId);
        const canvas = document.getElementById(canvasId);

        if (mol.molblock && typeof $3Dmol !== 'undefined') {
            canvas.style.display = 'none';
            viewerDiv.style.display = 'block';
            let viewer = isA ? compareViewerA : compareViewerB;
            if (!viewer) {
                viewer = $3Dmol.createViewer(viewerDiv, { backgroundColor: 'black' });
                viewerDiv.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, { passive: false });
                if (isA) compareViewerA = viewer;
                else compareViewerB = viewer;
            }
            viewer.clear();
            viewer.addModel(mol.molblock, "sdf");
            viewer.setStyle({}, { stick: { radius: 0.2 }, sphere: { scale: 0.3 } });
            viewer.zoomTo();
            viewer.render();
        } else {
            viewerDiv.style.display = 'none';
            canvas.style.display = 'block';
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (mol.smiles && typeof SmilesDrawer !== 'undefined') {
                let sw = new SmilesDrawer.Drawer({ width: 300, height: 250 });
                SmilesDrawer.parse(mol.smiles, function (tree) {
                    sw.draw(tree, canvasId, 'dark', false);
                });
            }
        }
    }

    const btnCompareTop = document.getElementById('btn-compare');
    const btnCompareSide = document.getElementById('btn-compare-side');
    const closeBtn = document.getElementById('close-compare');

    const searchInputA = document.getElementById('compare-search-a');
    const searchInputB = document.getElementById('compare-search-b');

    let compareMolA = null;
    let compareMolB = null;

    function updateCompareScore() {
        const sharedContainer = document.getElementById('compare-shared-container');
        const sharedList = document.getElementById('compare-shared-list');
        sharedList.innerHTML = '';
        const sharedHeading = sharedContainer.querySelector('h3');

        if (compareMolA && compareMolB) {
            const rawScore = calculateTanimoto(compareMolA.fp_b64, compareMolB.fp_b64);
            const percentage = Math.round(rawScore * 100);

            const scoreEl = document.getElementById('comp-score');
            scoreEl.innerText = `${percentage}%`;

            const circle = document.querySelector('.similarity-circle');
            if (percentage >= 80) circle.style.borderColor = '#4ba6a6'; // Teal
            else if (percentage >= 50) circle.style.borderColor = '#d4af37'; // Gold
            else circle.style.borderColor = '#888'; // Gray

            const shared = [];
            molecularData.forEach(m => {
                if (m.id === compareMolA.id || m.id === compareMolB.id) return;
                const simA = calculateTanimoto(compareMolA.fp_b64, m.fp_b64);
                const simB = calculateTanimoto(compareMolB.fp_b64, m.fp_b64);
                if (simA >= 0.35 && simB >= 0.35) {
                    shared.push({ mol: m, simA, simB, avg: (simA + simB) / 2 });
                }
            });

            if (shared.length > 0) {
                sharedHeading.innerText = 'Shared Structural Relatives';
                shared.sort((a, b) => b.avg - a.avg);
                const toShow = shared.slice(0, 15);
                toShow.forEach(s => {
                    const avgPct = Math.round(s.avg * 100);
                    const div = document.createElement('div');
                    div.style.minWidth = '130px';
                    div.style.background = 'rgba(20,20,20,0.8)';
                    div.style.border = '1px solid var(--border-color)';
                    div.style.borderRadius = '4px';
                    div.style.padding = '8px';
                    div.style.textAlign = 'center';
                    div.innerHTML = `
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--gold-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.mol.name}">${s.mol.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-dim);">Avg Sim: <span style="color: var(--accent-teal); font-weight: 700;">${avgPct}%</span></div>
                        <div style="font-size: 0.65rem; color: #888; display: flex; justify-content: space-between; margin-top: 4px;">
                           <span title="Similarity to ${compareMolA.name}">A: ${Math.round(s.simA * 100)}%</span>
                           <span title="Similarity to ${compareMolB.name}">B: ${Math.round(s.simB * 100)}%</span>
                        </div>
                    `;
                    sharedList.appendChild(div);
                });
                sharedContainer.style.display = 'block';
            } else {
                sharedContainer.style.display = 'none';
            }

        } else if (compareMolA || compareMolB) {
            const singleMol = compareMolA || compareMolB;
            document.getElementById('comp-score').innerText = '0%';
            document.querySelector('.similarity-circle').style.borderColor = '#4ba6a6';

            const similar = [];
            molecularData.forEach(m => {
                if (m.id === singleMol.id) return;
                const sim = calculateTanimoto(singleMol.fp_b64, m.fp_b64);
                if (sim >= 0.35) {
                    similar.push({ mol: m, sim });
                }
            });

            if (similar.length > 0) {
                sharedHeading.innerText = `Similar to ${singleMol.name}`;
                similar.sort((a, b) => b.sim - a.sim);
                const toShow = similar.slice(0, 15);
                toShow.forEach(s => {
                    const pct = Math.round(s.sim * 100);
                    const div = document.createElement('div');
                    div.style.minWidth = '120px';
                    div.style.background = 'rgba(20,20,20,0.8)';
                    div.style.border = '1px solid var(--border-color)';
                    div.style.borderRadius = '4px';
                    div.style.padding = '8px';
                    div.style.textAlign = 'center';
                    div.innerHTML = `
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--gold-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.mol.name}">${s.mol.name}</div>
                        <div style="font-size: 0.8rem; color: var(--accent-teal); font-weight: 700;">${pct}%</div>
                    `;
                    sharedList.appendChild(div);
                });
                sharedContainer.style.display = 'block';
            } else {
                sharedContainer.style.display = 'none';
            }
        } else {
            document.getElementById('comp-score').innerText = '0%';
            document.querySelector('.similarity-circle').style.borderColor = '#4ba6a6';
            sharedContainer.style.display = 'none';
        }
    }

    // Remove Window Manager Open logic from here as it's triggered via Start Menu / Info Panel
    function initCompareModalData() {
        // If there's a selected mol, load it into A by default if A is not populated
        if (currentSelectedMol && !compareMolA) {
            compareMolA = currentSelectedMol;
            searchInputA.value = currentSelectedMol.name;
            renderCompareMolecule(compareMolA, 'comp-3d-a', 'comp-canvas-a', 'comp-name-a', 'comp-chem-a', 'comp-odor-a', true);
        } else if (!compareMolA) {
            // Reset A
            document.getElementById('comp-name-a').innerText = 'Select a molecule...';
            document.getElementById('comp-chem-a').style.opacity = '0';
            document.getElementById('comp-odor-a').style.opacity = '0';
            searchInputA.value = '';
            const ctx = document.getElementById('comp-canvas-a').getContext('2d');
            ctx.clearRect(0, 0, 300, 250);
            document.getElementById('comp-canvas-a').style.display = 'block';
            document.getElementById('comp-3d-a').style.display = 'none';
        }

        if (!compareMolB) {
            // Reset B
            document.getElementById('comp-name-b').innerText = 'Select a molecule...';
            document.getElementById('comp-chem-b').style.opacity = '0';
            document.getElementById('comp-odor-b').style.opacity = '0';
            searchInputB.value = '';
            const ctx = document.getElementById('comp-canvas-b').getContext('2d');
            ctx.clearRect(0, 0, 300, 250);
            document.getElementById('comp-canvas-b').style.display = 'block';
            document.getElementById('comp-3d-b').style.display = 'none';
        }

        updateCompareScore();
    }


    searchInputA.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        if (!term) return;
        const exactMatch = molecularData.find(m => m.name.toLowerCase() === term);
        if (exactMatch) {
            compareMolA = exactMatch;
            renderCompareMolecule(compareMolA, 'comp-3d-a', 'comp-canvas-a', 'comp-name-a', 'comp-chem-a', 'comp-odor-a', true);
            updateCompareScore();
        }
    });

    searchInputB.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        if (!term) return;
        const exactMatch = molecularData.find(m => m.name.toLowerCase() === term);
        if (exactMatch) {
            compareMolB = exactMatch;
            renderCompareMolecule(compareMolB, 'comp-3d-b', 'comp-canvas-b', 'comp-name-b', 'comp-chem-b', 'comp-odor-b', false);
            updateCompareScore();
        }
    });
}

// --- Aroma OS Window Manager ---
function initWindowManager() {
    const windows = document.querySelectorAll('.os-window');
    const taskbarWindows = document.getElementById('taskbar-windows');
    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');

    // Load state
    try {
        const saved = localStorage.getItem('aromaOsState');
        if (saved) osState = JSON.parse(saved);
    } catch (e) { console.error('Error loading OS state', e); }

    // Start menu toggle
    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('hidden');
        startBtn.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && e.target !== startBtn) {
            startMenu.classList.add('hidden');
            startBtn.classList.remove('active');
        }
    });

    // Start Menu Items
    const menuItems = startMenu.querySelectorAll('.start-menu-item[data-window]');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const winId = item.getAttribute('data-window');
            openWindow(winId);
        });
    });

    document.getElementById('menu-reset').addEventListener('click', () => {
        Plotly.relayout('plot-container', {
            'scene.xaxis.autorange': true,
            'scene.yaxis.autorange': true,
            'scene.zaxis.autorange': true,
            'scene.camera': { eye: { x: 1.5, y: 1.5, z: 1.5 } }
        });
        clearHighlight();
        closeWindow('window-info');
        localStorage.removeItem('aromaOsState');
    });

    document.getElementById('btn-compare-side').addEventListener('click', () => {
        openWindow('window-compare');
    });

    // Wait 500ms before making a function call globally available.
    // Ensure we add window.initCompareModalData below explicitly since compare is inside another block

    function saveState() {
        localStorage.setItem('aromaOsState', JSON.stringify(osState));
    }

    // Initialize windows
    windows.forEach(win => {
        const header = win.querySelector('.os-window-header');
        const closeBtn = win.querySelector('.os-close-btn');
        const title = win.getAttribute('data-title') || 'Window';
        const id = win.id;

        // Restore geometry if saved
        if (!osState.windows[id]) osState.windows[id] = { open: false, x: win.style.left, y: win.style.top };

        let state = osState.windows[id];
        if (state.x) win.style.left = state.x;
        if (state.y) win.style.top = state.y;
        if (state.open) {
            win.classList.remove('hidden');
            createTaskbarIcon(id, title);
            bringToFront(win);
        }

        // Dragging
        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target === closeBtn) return;
            bringToFront(win);
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseInt(window.getComputedStyle(win).left, 10);
            initialTop = parseInt(window.getComputedStyle(win).top, 10);
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Basic bounds checking
            let newX = initialLeft + dx;
            let newY = initialTop + dy;
            if (newY < 0) newY = 0;

            win.style.left = `${newX}px`;
            win.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                state.x = win.style.left;
                state.y = win.style.top;
                saveState();
            }
        });

        // Click focus
        win.addEventListener('mousedown', () => bringToFront(win));

        // Close
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (id === 'window-info') {
                    clearHighlight();
                    currentSelectedMol = null;
                    osState.selectedMolId = null;
                }
                closeWindow(id);
            });
        }
    });

    // Clock
    setInterval(() => {
        const now = new Date();
        document.getElementById('taskbar-clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);
}

function bringToFront(win) {
    zIndexCounter++;
    win.style.zIndex = zIndexCounter;
}

// Ensure initCompareModalData is globally accessible inside app.js if needed or keep calling the event
let globalInitCompareModalData = null; // Will bind inside initCompareModal

function openWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    win.classList.remove('hidden');
    bringToFront(win);

    if (!osState.windows[id]) osState.windows[id] = {};
    osState.windows[id].open = true;
    localStorage.setItem('aromaOsState', JSON.stringify(osState));

    // Update Taskbar
    const title = win.getAttribute('data-title') || 'Window';
    createTaskbarIcon(id, title);

    // Custom triggers
    if (id === 'window-compare' && typeof globalInitCompareModalData === 'function') {
        globalInitCompareModalData();
    }
}

function closeWindow(id) {
    const win = document.getElementById(id);
    if (win) win.classList.add('hidden');
    if (osState.windows[id]) osState.windows[id].open = false;
    localStorage.setItem('aromaOsState', JSON.stringify(osState));

    const icon = document.querySelector(`.taskbar-window-btn[data-target="${id}"]`);
    if (icon) icon.remove();
}

function createTaskbarIcon(id, title) {
    const taskbarWindows = document.getElementById('taskbar-windows');
    let existing = document.querySelector(`.taskbar-window-btn[data-target="${id}"]`);
    if (!existing) {
        const btn = document.createElement('button');
        btn.className = 'taskbar-window-btn active';
        btn.setAttribute('data-target', id);
        btn.innerText = title;
        btn.onclick = () => {
            const win = document.getElementById(id);
            if (!win.classList.contains('hidden')) {
                // If it's already top, minimize? For now just hide
                if (parseInt(win.style.zIndex) === zIndexCounter) {
                    win.classList.add('hidden');
                    btn.classList.remove('active');
                    if (osState.windows[id]) osState.windows[id].open = false;
                } else {
                    bringToFront(win);
                    document.querySelectorAll('.taskbar-window-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            } else {
                win.classList.remove('hidden');
                bringToFront(win);
                document.querySelectorAll('.taskbar-window-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (osState.windows[id]) osState.windows[id].open = true;
            }
            localStorage.setItem('aromaOsState', JSON.stringify(osState));
        };
        taskbarWindows.appendChild(btn);
    } else {
        document.querySelectorAll('.taskbar-window-btn').forEach(b => b.classList.remove('active'));
        existing.classList.add('active');
    }
}

// --- Natural Explorer Logic ---

function initNaturalsExplorer() {
    const list = document.getElementById('naturals-list');
    if (!list || typeof naturalsData === 'undefined') return;

    let html = '';
    naturalsData.forEach(nat => {
        html += `
            <div class="natural-card" onclick="selectNatural('${nat.id}')">
                <i class="fas fa-leaf"></i>
                <span>${nat.name}</span>
            </div>
        `;
    });
    list.innerHTML = html;
}

function selectNatural(id) {
    const natural = naturalsData.find(n => n.id === id);
    if (!natural) return;

    // 1. Show detail panel, hide grid
    document.getElementById('naturals-list').parentElement.classList.add('hidden');
    const detail = document.getElementById('natural-detail-panel');
    detail.classList.remove('hidden');

    document.getElementById('nat-detail-name').innerText = natural.name;
    document.getElementById('nat-detail-desc').innerText = natural.description;

    const constituentList = document.getElementById('nat-detail-list');
    constituentList.innerHTML = '';

    const constituentIds = natural.constituents.map(c => c.id);
    const activeConstituents = [];

    natural.constituents.forEach(c => {
        const mol = molecularData.find(m => m.id === c.id);
        if (mol) {
            activeConstituents.push(mol);
            constituentList.innerHTML += `
                <div class="constituent-row">
                    <span class="constituent-name">${c.name}</span>
                    <span class="constituent-pct">${c.percentage}%</span>
                </div>
            `;
        }
    });

    // 2. Highlight in Plot
    const opacities = molecularData.map(m => constituentIds.includes(m.id) ? 0.9 : 0.05);
    const sizes = molecularData.map(m => constituentIds.includes(m.id) ? 10 : 2);

    Plotly.restyle('plot-container', {
        'marker.opacity': [opacities],
        'marker.size': [sizes]
    }, [0]);

    // 3. Draw Constellation Lines
    if (activeConstituents.length > 1) {
        // Calculate Centroid for "Star" constellation
        let avgX = activeConstituents.reduce((sum, m) => sum + m.x, 0) / activeConstituents.length;
        let avgY = activeConstituents.reduce((sum, m) => sum + m.y, 0) / activeConstituents.length;
        let avgZ = activeConstituents.reduce((sum, m) => sum + m.z, 0) / activeConstituents.length;

        let lineX = [];
        let lineY = [];
        let lineZ = [];

        activeConstituents.forEach(mol => {
            lineX.push(avgX, mol.x, null);
            lineY.push(avgY, mol.y, null);
            lineZ.push(avgZ, mol.z, null);
        });

        const linesTrace = {
            type: 'scatter3d',
            mode: 'lines',
            x: lineX, y: lineY, z: lineZ,
            line: { color: '#4ba6a6', width: 4 },
            hoverinfo: 'none',
            showlegend: false,
            opacity: 0.8
        };

        // Clear previous and add
        if (extraTraceCount > 0) {
            let indices = [];
            for (let i = 1; i <= extraTraceCount; i++) indices.push(i);
            Plotly.deleteTraces('plot-container', indices);
        }
        
        Plotly.addTraces('plot-container', [linesTrace]);
        extraTraceCount = 1;

        // Auto-zoom camera to center of cluster
        Plotly.relayout('plot-container', {
            'scene.camera': {
                eye: { x: 1.5, y: 1.5, z: 1.5 }, // Consistent eye
                center: { x: avgX, y: avgY, z: avgZ }
            },
            'scene.xaxis.range': [avgX - 15, avgX + 15],
            'scene.yaxis.range': [avgY - 15, avgY + 15],
            'scene.zaxis.range': [avgZ - 15, avgZ + 15]
        });
    }

    // Custom: ensure labels show for these nodes
    if (document.getElementById('toggle-labels').checked) {
        const textArray = molecularData.map(m => constituentIds.includes(m.id) ? m.name : "");
        Plotly.restyle('plot-container', {
            mode: ['markers+text'],
            text: [textArray]
        }, [0]);
    }
}

function resetFromNatural() {
    // 1. Reset UI
    document.getElementById('naturals-list').parentElement.classList.remove('hidden');
    document.getElementById('natural-detail-panel').classList.add('hidden');

    // 2. Reset Plot
    applyFilters(); // returns to current selector/group filter state
    clearHighlight(); // removes lines and reset zoom
}

