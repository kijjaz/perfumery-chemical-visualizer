// Color generator for categories
const generateColors = (categories) => {
    const colors = {};
    const total = categories.length;
    categories.forEach((cat, i) => {
        const hue = (i * 360 / total) % 360;
        // Use high saturation and lightness for 'Carbon & Gold' aesthetic contrast
        colors[cat] = `hsl(${hue}, 80%, 65%)`;
    });
    return colors;
};

// Initialize Plotly Map
function initMap() {
    const axisStyle = {
        showbackground: false,
        gridcolor: 'rgba(212, 175, 55, 0.05)',
        zerolinecolor: 'rgba(212, 175, 55, 0.1)',
        tickfont: { color: '#333', size: 8 },
        title: { font: { color: '#555', size: 10 } }
    };

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: { ...axisStyle, title: 'UMAP 1' },
            yaxis: { ...axisStyle, title: 'UMAP 2' },
            zaxis: { ...axisStyle, title: 'UMAP 3' },
            camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
        },
        legend: {
            font: { color: '#e0e0e0', family: 'Inter', size: 12 },
            bgcolor: 'rgba(10, 10, 10, 0.8)',
            bordercolor: '#333',
            borderwidth: 1
        }
    };

    Plotly.newPlot('vector-map', [], layout, { responsive: true });
}

function renderMap() {
    if (typeof globalData === 'undefined') {
        console.error("globalData is not loaded.");
        return;
    }

    const colorBy = document.getElementById('color-select').value;
    
    // Group data by selected category
    const grouped = {};
    globalData.forEach(mat => {
        // Skip unmapped items to keep the visual cluster clean
        if (mat.x === 0 && mat.y === 0 && mat.z === 0) return;

        let key = mat[colorBy] || 'Unknown';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(mat);
    });

    const categories = Object.keys(grouped).sort();
    const categoryColors = generateColors(categories);

    const traces = [];

    categories.forEach(cat => {
        const mats = grouped[cat];
        
        traces.push({
            name: cat,
            type: 'scatter3d',
            mode: 'markers',
            x: mats.map(m => m.x),
            y: mats.map(m => m.y),
            z: mats.map(m => m.z),
            marker: { 
                size: 6, 
                color: categoryColors[cat], 
                line: { color: '#fff', width: 0.5 },
                opacity: 0.8
            },
            text: mats.map(m => `<b>${m.name}</b><br>Family: ${m.odorFamily}<br>Group: ${m.chemGroup}`),
            hoverinfo: 'text'
        });
    });

    const plotEl = document.getElementById('vector-map');
    const layout = plotEl.layout || {};
    layout.uirevision = 'true'; // Keep camera state

    Plotly.react('vector-map', traces, layout);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    renderMap();
});
