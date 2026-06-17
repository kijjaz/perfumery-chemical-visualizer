let currentAccord = [];

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    setupSearch();
    renderStudyRoom();
    initAccordChart();
    initMap();
    renderGrid([]); // Start collapsed
});

// Tab Navigation
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');

    // Trigger chart resize if needed
    if (tabId === 'explorer' || tabId === 'map') {
        window.dispatchEvent(new Event('resize'));
    }
}

function initMap() {
    const trace = {
        x: organMaterials.map(m => m.x),
        y: organMaterials.map(m => m.y),
        text: organMaterials.map(m => `<b>${m["Material Name"]}</b><br>${m.Odor_Family}<br>${m.Chemical_Group}`),
        mode: 'markers',
        hovertemplate: '%{text}<extra></extra>',
        textfont: { family: 'Inter', size: 9, color: '#aaa' },
        marker: {
            size: 14,
            color: organMaterials.map(m => {
                const colors = { 'Amber': '#996515', 'Floral': '#d4af37', 'Wood': '#555', 'Green': '#2c4d2c' };
                return colors[m.Wheel_Family] || '#f9d71c';
            }),
            line: { color: '#000', width: 1 },
            opacity: 0.8
        },
        type: 'scatter'
    };

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(10,10,10,0.5)',
        font: { family: 'Inter', color: '#fff' },
        hovermode: 'closest',
        dragmode: 'pan',
        xaxis: { showgrid: false, zeroline: false, showticklabels: false },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false },
        margin: { l: 0, r: 0, b: 0, t: 0 }
    };

    Plotly.newPlot('scatter-chart', [trace], layout, {
        displayModeBar: true,
        scrollZoom: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
    });

    document.getElementById('scatter-chart').on('plotly_click', function (data) {
        const idx = data.points[0].pointIndex;
        const mat = organMaterials[idx];
        addToAccord(mat);
        // Visual feedback
        const counter = document.getElementById('accord-counter');
        counter.style.transform = 'scale(1.2)';
        setTimeout(() => counter.style.transform = 'scale(1)', 200);
    });
}

function initCharts() {
    // 1. Sunburst Chart
    const sunburstData = processSunburstData(organMaterials);
    const sunburstLayout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 10, r: 10, b: 10, t: 10 },
        font: { family: 'Inter', color: '#fff' }
    };
    Plotly.newPlot('sunburst-chart', [sunburstData], sunburstLayout, { displayModeBar: false });

    // 2. Structural Pyramid
    const simpleRoles = { 'Top': 0, 'Heart': 0, 'Base': 0 };
    organMaterials.forEach(m => {
        let r = m.Perfume_Role || 'Unknown';
        if (r.includes('Top')) simpleRoles['Top']++;
        if (r.includes('Heart') || r.includes('Modifier') || r.includes('Blender')) simpleRoles['Heart']++;
        if (r.includes('Base') || r.includes('Fixative')) simpleRoles['Base']++;
    });

    const funnelData = {
        type: 'funnel',
        y: ['TOP NOTE', 'HEART NOTE', 'BASE NOTE'],
        x: [simpleRoles['Top'], simpleRoles['Heart'], simpleRoles['Base']],
        textinfo: "value+percent initial",
        marker: { color: ["#f9d71c", "#d4af37", "#996515"] }
    };
    Plotly.newPlot('pyramid-chart', [funnelData], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter', color: '#fff' },
        margin: { l: 140, r: 20, b: 0, t: 20 }
    }, { displayModeBar: false });

    // 3. Chemical Groups
    const chemCounts = countBy(organMaterials, 'Chemical_Group');
    const sortedChem = Object.entries(chemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const chemData = {
        x: sortedChem.map(k => k[1]),
        y: sortedChem.map(k => k[0]),
        type: 'bar',
        orientation: 'h',
        marker: { color: '#d4af37' }
    };
    Plotly.newPlot('chemistry-chart', [chemData], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter', color: '#fff' },
        yaxis: { automargin: true, tickfont: { size: 10 } },
        xaxis: { gridcolor: '#333' },
        margin: { l: 10, r: 20, b: 30, t: 0 }
    }, { displayModeBar: false });
}

function processSunburstData(data) {
    const labels = ["Organ Explorer"];
    const parents = [""];
    const ids = ["root"];
    const values = [0];
    const customColors = ["#1a1a1a"];
    const customData = [""];

    const categoryColors = {
        'Amber': '#996515',
        'Floral': '#d4af37',
        'Woody': '#555555',
        'Wood': '#555555',
        'Green': '#2c4d2c',
        'Citrus': '#f2a900',
        'Aromatic': '#7a8b7a',
        'Fruity': '#cc5500',
        'Animalic': '#4b3621',
        'Gourmand': '#c28e0e',
        'Water': '#4d79ff',
        'Spicy': '#8b0000',
        'Spice': '#8b0000',
        'Fougère': '#4f7942',
        'Leather': '#5c4033',
        'Mossy': '#3b5e2b',
        'Musk': '#bba8a8'
    };

    const addNode = (id, label, parent, val, color) => {
        const idx = ids.indexOf(id);
        if (idx === -1) {
            ids.push(id);
            labels.push(label);
            parents.push(parent);
            values.push(val);
            customColors.push(color || "#888");
            customData.push(""); // No extra text for group nodes
        } else {
            values[idx] += val;
        }
    };

    data.forEach(item => {
        const wheel = item.Wheel_Family || "Unclassified";
        const odor = item.Odor_Family || "Other";
        const material = item["Material Name"];
        const color = categoryColors[wheel] || '#f9d71c';

        // increment root
        values[0] += 1;

        const wheelId = `wheel-${wheel}`;
        addNode(wheelId, wheel, "root", 1, color);

        const odorId = `${wheelId}-${odor}`;
        addNode(odorId, odor, wheelId, 1, color);

        const matId = `mat-${item.SKU}`;
        if (!ids.includes(matId)) {
            ids.push(matId);
            labels.push(material);
            parents.push(odorId);
            values.push(1);
            customColors.push(color);
            customData.push(`<br><span style="color:#aaa;font-size:10px;">SKU: ${item.SKU} | CAS: ${item.CAS || 'N/A'}<br>Role: ${item.Perfume_Role}<br>Chem: ${item.Chemical_Group}</span>`);
        }
    });

    return {
        type: "sunburst",
        ids: ids,
        labels: labels,
        parents: parents,
        values: values,
        customdata: customData,
        branchvalues: "total",
        marker: {
            colors: customColors,
            line: { width: 1, color: '#111' }
        },
        hovertemplate: '<b>%{label}</b><br>Materials: %{value}%{customdata}<extra></extra>',
        textinfo: 'label',
        insidetextorientation: 'radial'
    };
}

function countBy(data, key) {
    return data.reduce((acc, curr) => {
        const raw = curr[key] || "Other";
        const parts = raw.split(',').map(s => s.trim());
        parts.forEach(p => { if (p) acc[p] = (acc[p] || 0) + 1; });
        return acc;
    }, {});
}

function renderGrid(data) {
    const grid = document.getElementById('material-grid');
    grid.innerHTML = '';

    if (data.length === 0) {
        const hasSearch = document.getElementById('search-input') && document.getElementById('search-input').value.trim() !== '';
        const msg = hasSearch ? "No materials found matching your search." : "Search above to explore materials in the databank...";
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 3rem;">${msg}</div>`;
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'material-card';
        card.innerHTML = `
            <div class="material-name">${item["Material Name"]}</div>
            <span class="material-sku">SKU: ${item.SKU}</span>
            <div class="tag-container">
                <span class="tag wheel">${item.Wheel_Family}</span>
                <span class="tag role">${item.Perfume_Role}</span>
                <span class="tag chem">${item.Chemical_Group}</span>
            </div>
            ${item.Special_Use ? `<div style="font-size: 0.75rem; color: var(--gold-bright); margin-bottom: 0.5rem; border-left: 2px solid var(--gold-primary); padding-left: 0.5rem;">${item.Special_Use}</div>` : ''}
            <div class="material-odor">${item.Odor_Family}</div>
            ${item.SMILES ? `<div style="text-align: center; margin: 0.5rem 0;"><canvas id="smiles-${item.SKU}" data-smiles="${item.SMILES}" width="200" height="150"></canvas></div>` : ''}
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button class="tab-btn" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; flex: 1;" onclick="event.stopPropagation(); addToAccordBySKU('${item.SKU}')">+ ACCORD</button>
                <button class="tab-btn" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; flex: 1;" onclick="event.stopPropagation(); findSimilar('${item.SKU}')">SIMILAR</button>
            </div>
        `;
        grid.appendChild(card);
    });

    // Draw molecules if SmilesDrawer is available
    if (typeof SmilesDrawer !== 'undefined') {
        const smilesDrawer = new SmilesDrawer.Drawer({ width: 200, height: 150 });
        document.querySelectorAll('canvas[data-smiles]').forEach(canvas => {
            SmilesDrawer.parse(canvas.dataset.smiles, function (tree) {
                smilesDrawer.draw(tree, canvas.id, 'dark', false);
            }, function (err) {
                console.error("Error drawing SMILES:", err);
            });
        });
    }
}

function addToAccordBySKU(sku) {
    const material = organMaterials.find(m => m.SKU === sku);
    if (material) addToAccord(material);
}

// Substitution Assistant (MDS Distance matching)
function findSimilar(sku) {
    const target = organMaterials.find(m => m.SKU === sku);
    if (!target) return;

    // Use MDS coordinates for Euclidian distance 
    const distances = organMaterials.map(m => {
        if (m.SKU === sku) return { material: m, distance: Infinity };

        let distance = Infinity;
        if (m.x !== undefined && m.y !== undefined && target.x !== undefined && target.y !== undefined) {
            distance = Math.sqrt(Math.pow(m.x - target.x, 2) + Math.pow(m.y - target.y, 2));

            // Exact match bonuses (brings distance closer to 0)
            if (m.Odor_Family === target.Odor_Family && m.Odor_Family !== "Other") {
                distance *= 0.1; // Huge relevancy boost!
            } else if (m.Wheel_Family === target.Wheel_Family) {
                distance *= 0.5; // Moderate boost
            }
        }
        return { material: m, distance: distance };
    });

    const topMatches = distances
        .filter(d => d.distance < Infinity)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4)
        .map(d => d.material);

    // Filter structural matches (Tanimoto similarity)
    const structuralMatches = (target.Structural_Matches || [])
        .slice(0, 4)
        .map(sm => {
            const mat = organMaterials.find(m => m.SKU === sm.SKU);
            return mat ? { material: mat, score: sm.Score } : null;
        })
        .filter(m => m !== null);

    if (topMatches.length > 0 || structuralMatches.length > 0) {
        showSimilarModal(target, topMatches, structuralMatches);
    } else {
        alert("No similar materials found in this curated organ.");
    }
}

function showSimilarModal(target, matches, structuralMatches) {
    const modal = document.getElementById('substitution-modal');
    document.getElementById('modal-title').innerText = `Substitutes for ${target["Material Name"]}`;

    const body = document.getElementById('modal-body');
    let html = '';

    if (matches && matches.length > 0) {
        html += `<h4 style="margin: 0 0 1rem 0; color: var(--gold-primary); font-size: 0.85rem; text-transform: uppercase;">Odor Profile Relatives (MDS Map)</h4>`;
        html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">`;
        html += matches.map(item => `
            <div class="material-card" style="padding: 1.5rem; background: #1a1a1a; cursor: default;">
                <div class="material-name" style="font-size: 1rem;">${item["Material Name"]}</div>
                <div class="tag-container" style="margin-bottom: 0.5rem; margin-top: 0.5rem;">
                    <span class="tag role">${item.Perfume_Role}</span>
                </div>
                <div class="material-odor" style="font-size: 0.85rem; margin-bottom: 1rem;">${item.Odor_Family}</div>
                <button class="tab-btn" style="padding: 0.5rem; font-size: 0.75rem; width: 100%; border-color: var(--gold-primary);" onclick="addToAccordBySKU('${item.SKU}'); closeSimilarModal();">+ ADD TO ACCORD</button>
            </div>
        `).join('');
        html += `</div>`;
    }

    if (structuralMatches && structuralMatches.length > 0) {
        html += `<h4 style="margin: 0 0 1rem 0; color: #4ba6a6; font-size: 0.85rem; text-transform: uppercase;">Structural Relatives (Morgan / Tanimoto)</h4>`;
        html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">`;
        html += structuralMatches.map(sm => {
            const item = sm.material;
            return `
            <div class="material-card" style="padding: 1.5rem; background: #152222; border-color: #2b5555; cursor: default;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div class="material-name" style="font-size: 1rem;">${item["Material Name"]}</div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #4ba6a6; background: rgba(75, 166, 166, 0.1); padding: 0.2rem 0.4rem; border-radius: 4px;">${sm.score < 1 ? (sm.score * 100).toFixed(0) + '%' : '100%'}</div>
                </div>
                <div class="tag-container" style="margin-bottom: 0.5rem; margin-top: 0.5rem;">
                    <span class="tag chem" style="background:#0d1a1a;border-color:#4ba6a6;color:#4ba6a6;">${item.Chemical_Group.split(',')[0]}</span>
                </div>
                <button class="tab-btn" style="padding: 0.5rem; color: #4ba6a6; font-size: 0.75rem; width: 100%; border-color: #2b5555;" onclick="addToAccordBySKU('${item.SKU}'); closeSimilarModal();">+ ADD TO ACCORD</button>
            </div>
            `;
        }).join('');
        html += `</div>`;
    }

    body.innerHTML = html;
    modal.style.display = "block";
}

function closeSimilarModal() {
    document.getElementById('substitution-modal').style.display = "none";
}

// Close modal if user clicks outside of it
window.addEventListener('click', function (event) {
    const modal = document.getElementById('substitution-modal');
    // Also handle chart interactions gracefully
    if (event.target == modal) {
        modal.style.display = "none";
    }
});

// Accord Logic
function addToAccord(material) {
    if (currentAccord.some(m => m.SKU === material.SKU)) return;
    currentAccord.push(material);
    updateAccordUI();
}

function removeFromAccord(sku) {
    currentAccord = currentAccord.filter(m => m.SKU !== sku);
    updateAccordUI();
}

function clearAccord() {
    currentAccord = [];
    updateAccordUI();
}

function updateAccordUI() {
    const list = document.getElementById('accord-items');
    const counter = document.getElementById('accord-counter');

    counter.innerText = `Accord: ${currentAccord.length} Items`;

    if (currentAccord.length === 0) {
        list.innerHTML = `<p style="color: var(--text-dim); text-align: center; margin-top: 2rem;">Select materials from the explorer to add to your accord.</p>`;
    } else {
        list.innerHTML = currentAccord.map(m => `
            <div class="material-card" style="margin-bottom: 0.5rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="color: var(--gold-bright); font-weight: 700;">${m["Material Name"]}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${m.Perfume_Role.replace('Base', 'Base Note')}</div>
                </div>
                <button onclick="removeFromAccord('${m.SKU}')" style="background:none; border:none; color: #ff6b6b; cursor:pointer; font-weight:700;">&times;</button>
            </div>
        `).join('');
    }

    updateAccordChart();
}

function initAccordChart() {
    Plotly.newPlot('accord-chart', [], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter', color: '#fff' },
        margin: { l: 40, r: 40, b: 40, t: 20 }
    }, { displayModeBar: false });
}

function updateAccordChart() {
    const wheelCounts = countBy(currentAccord, 'Wheel_Family');
    const data = [{
        values: Object.values(wheelCounts),
        labels: Object.keys(wheelCounts),
        type: 'pie',
        hole: .4,
        marker: { colors: ['#d4af37', '#996515', '#f9d71c', '#555', '#333', '#777'] },
        textinfo: 'label+percent'
    }];

    Plotly.react('accord-chart', data, {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter', color: '#fff' },
        showlegend: false,
        margin: { l: 10, r: 10, b: 10, t: 10 }
    });
}

function setupSearch() {
    const input = document.getElementById('search-input');
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (!term) {
            renderGrid([]);
            return;
        }
        const filtered = organMaterials.filter(item => {
            return Object.values(item).some(val =>
                String(val).toLowerCase().includes(term)
            );
        });
        renderGrid(filtered);
    });
}


