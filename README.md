# Perfumery Chemical Directory

An interactive single-page web directory designed for students and educators to explore chemical data, 2D structures, and 3D molecular conformations of pure aroma chemicals from the **Modern Perfumery Curriculum**.

## 🌐 Live Website
The interactive portal is deployed and accessible at:
👉 **[https://kijjaz.github.io/perfumery-chemical-visualizer/](https://kijjaz.github.io/perfumery-chemical-visualizer/)**

---

## 🛠️ Features
* **Full Chemical Inventory:** Displays all aroma chemicals from `20260616 Student_Organ_Chemical_Features.csv` (680 materials including pure compounds and standard supplier dilutions).
* **Live Search & Filter:** Filter the list instantly by SKU, Name, CAS Number, or Odor Family.
* **Interactive 2D Rendering:** Renders high-quality vector SVGs of chemical structures directly in the browser using the **RDKit.js Minimal** engine.
* **Interactive 3D conformations:** Visualizes full 3D conformations (optimized with the MMFF94 force field) inside a rotating WebGL viewport powered by **3Dmol.js**.
* **💡 Click-to-Highlight Molecular Features:** Click on any functional group badge (e.g. *Ester, Phenol, Pyrazine, Lactone, Ketone, Aldehyde, Primary Alcohol, or Benzene Ring*) to instantly highlight the matching atoms and bonds on **both** the 2D SVG drawing and the 3D rotating model.

---

## 📊 Student Data Downloads
The portal provides direct download buttons for:
* **`Student_Organ_Database.csv`** — Master student organ database containing odor groups, families, volatility roles, and molecular properties.
* **`Student_Organ_Chemical_Features.csv`** — Cleaned chemical features table with standardised CAS numbers, canonical SMILES, structural classes, and chemical groups.

---

## 🧬 Technologies Used
* **Data Compilation:** Python (RDKit conformation generator, MMFF94 force-field optimizer).
* **2D & Substructure Matching:** RDKit.js Minimal.
* **3D Visualizer:** 3Dmol.js (WebGL).
* **Theme Styling:** Carbon & Gold premium responsive design (dark glassmorphism theme, Outfit and Space Mono fonts).
