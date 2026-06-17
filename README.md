# Modern Perfumery Course Visualizer Suite

An interactive web-based visualizer suite designed to accompany the **Modern Perfumery Curriculum**. It maps chemical structures, sensory odor relationships, and spatial coordinates for course student organ setups.

## 🌐 Live Website
The interactive portal is deployed and accessible at:
👉 **[https://kijjaz.github.io/perfumery-chemical-visualizer/](https://kijjaz.github.io/perfumery-chemical-visualizer/)**

---

## 🛠️ Included Modules

### 1. 2D Organ Explorer (`/OrganExplorer`)
* **Features:** Multidimensional Scaling (MDS) map of course raw materials.
* **Function:** Helps students visualize odor relationship groupings (Floral, Woody, Citrus, Musk, Gourmand, etc.) and discover structural similarity networks.
* **Technology:** MDS coordinate mapping, structural Tanimoto similarity matching, custom responsive styling.

### 2. 3D Molecular Space (`/MolecularSpace`)
* **Features:** Full 3D coordinate space clustering based on Morgan fingerprints and topological descriptors.
* **Function:** Filter by supply vendor (e.g. *SimpleScentsDIY, PerfumersWorld, MySkinRecipes, Fraterworks*) to highlight available materials, and view interactive, rotating WebGL 3D molecular structures.
* **Technology:** UMAP reduction, `3Dmol.js` WebGL drawing engine, Gasteiger partial charges coloring.

### 3. Statistical Affinity Map (`/StatisticalAffinityMap`)
* **Features:** Global materials mapping that projects localized inventory items onto the standard TGSC (The Good Scents Company) olfactory network.

---

## 📊 Student Data Downloads
The portal provides direct access to standardized chemical spreadsheets for local student lookup:
* **`Student_Organ_Database.csv`** — Master student organ database containing odor groups, families, volatility roles, and molecular properties.
* **`Student_Organ_Chemical_Features.csv`** — Cleaned chemical features table with standardised CAS numbers, canonical SMILES, structural classes, and chemical groups.

---

## 🧬 Technologies Used
* **Coordinates Generation:** RDKit (2D depiction, 3D conformation generation, MMFF94 force field optimization), UMAP, MDS, and Scikit-Learn.
* **Frontend Libraries:** [Plotly.js](https://plotly.com/javascript/), [3Dmol.js](https://3dmol.csb.pitt.edu/), [SmilesDrawer](https://github.com/reymond-group/smilesDrawer), FontAwesome, Google Fonts.
