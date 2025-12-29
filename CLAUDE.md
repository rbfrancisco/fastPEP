# FastPEP - Project Context for Claude Code

## Project Overview

FastPEP (Prontuário Eletrônico Rápido) is a medical record documentation generator for Brazilian emergency room physicians. It generates standardized text for electronic medical records in **Brazilian Portuguese**.

**Tech Stack:** Vanilla HTML, CSS, JavaScript (no frameworks), Node.js/Express (local editor server)

**Main Application:** `index.html` + `js/app.js` + `css/styles.css`
**Admin Editor:** `admin/index.html` + `admin/js/editor.js` + `admin/css/styles.css`
**Editor Server:** `server/index.js` + `server/routes/data.js`

## Core Functionality

The application has 3 main output sections:
1. **Exame Físico (Physical Exam)** - Generated from condition-specific addons
2. **Conduta (Therapeutic Conduct)** - Bullet points of what the doctor did
3. **Prescrição (Prescription)** - Medications for the patient to take home

## Data Architecture

All data is stored in JSON files in `/data/`:

### 1. `conditions.json` - Main configuration
Each condition (diagnosis) links everything together:
```json
"condition-id": {
  "name": "Display Name",
  "physicalExamAddons": ["geral-bom", "cv-normal", "resp-normal", "specific-addon"],
  "conduct": ["Conduct item 1", "Conduct item 2"],
  "prescriptionGroups": [...]
}
```

### 2. `physical-exam.json` - Physical exam addons
**IMPORTANT:** All physical exam components are unified as addons (flat structure):
```json
{
  "addons": {
    "addon-id": {
      "label": "Display label",
      "text": "Text string" // OR object for gendered text
    }
  }
}
```

**Gendered text** (for estado geral):
```json
"text": {
  "masculino": "Bom estado geral, corado, hidratado...",
  "feminino": "Bom estado geral, corada, hidratada..."
}
```

**Standard addons used by most conditions:**
- `geral-bom` (or `geral-regular`, `geral-mau`)
- `cv-normal` (or `cv-taquicardico`, `cv-tec-aumentado`)
- `resp-normal` (or `resp-sibilos`, `resp-estertores`)

### 3. `medications.json` - Individual medications
```json
"medication-id": {
  "name": "Display Name",
  "instruction": "Tomar 1 comprimido de 8/8h por {duration} dias",
  "defaultDuration": "7",
  "inHospital": true,  // Optional: medication given in hospital, not on prescription
  "hospitalNote": "(Aplicado no PS)"  // Optional: shown in UI
}
```

**Duration placeholder:** Use `{duration}` in instruction, replaced at runtime.

### 4. `medication-classes.json` - Medication groups
For checkbox+radio selection pattern (e.g., "Analgésico" with options):
```json
"class-id": {
  "label": "Display Label",
  "options": ["med-id-1", "med-id-2", "med-id-3"]
}
```

## Prescription Groups

Two types in `prescriptionGroups`:

### Radio Group (mutually exclusive)
```json
{
  "id": "antibiotico",
  "label": "Antibiótico",
  "type": "radio",
  "options": ["amoxicilina-500mg", "azitromicina-500mg"],
  "default": "amoxicilina-500mg"
}
```

### Items Group (checkboxes)
```json
{
  "id": "sintomaticos",
  "label": "Sintomáticos",
  "items": [
    { "type": "med", "medId": "lavagem-nasal", "checked": true },
    { "type": "class", "classId": "analgesico", "default": "dipirona-500mg", "checked": true, "duration": "5" }
  ]
}
```

## Key Design Decisions

1. **Unified Addons Structure:** Physical exam was simplified from a complex "systems" structure to a flat addons structure. Each condition explicitly lists all needed addons.

2. **Gender Handling:** The app supports gender-specific text for physical exam (masculino/feminino) via radio buttons. Gendered addons use object format for `text`.

3. **Cache Busting:** JSON files are loaded with `?v=timestamp` to prevent browser caching issues.

4. **In-Hospital Medications:** Medications with `inHospital: true` appear in treatment options but NOT in the final prescription (they're given at the hospital).

5. **Duration Override:** Conditions can override medication duration via the `duration` field in class items.

6. **Prescription Order:** Medications appear in the order defined in the JSON, not in UI selection order (important for patient adherence).

7. **Default Addons in Editor:** New conditions in the editor start with `geral-bom`, `cv-normal`, `resp-normal` pre-filled.

## Admin Editor Features

- **Tabs:** Medicamento, Classe de Med., Exame Físico, Condição
- **Mode Toggle:** New / Edit Existing
- **Autocomplete:** Suggestions based on existing data
- **Drag-and-Drop:** Reorder items within lists
- **Gendered Text Toggle:** Checkbox to switch between simple text and masculino/feminino fields
- **Direct Save:** Save directly to JSON files (requires server)
- **Delete:** Remove entries when in edit mode
- **Refresh:** Reload data from files without page refresh
- **Validation:** Checks for broken references before save

## Editor Server (Local Development)

The editor can save directly to JSON files using a local Express server:

```bash
npm install        # First time only
npm run server     # Start server on port 3001
# Open http://localhost:3001/admin/
```

**API Endpoints:**
- `GET /api/data/:type` - Get all data for a type
- `PUT /api/data/:type/:id` - Create/update entry
- `DELETE /api/data/:type/:id` - Delete entry

**Type mapping:** `medications`, `medication-classes`, `physical-exam`, `conditions`

When server is not running, the editor still works for preview/copy workflow.

## File Structure

```
fastPEP/
├── index.html              # Main application
├── js/app.js               # Main application logic
├── css/styles.css          # Main styles
├── data/
│   ├── conditions.json     # Diagnoses configuration
│   ├── physical-exam.json  # Physical exam addons
│   ├── medications.json    # Medications database
│   └── medication-classes.json  # Medication groups
├── admin/
│   ├── index.html          # Editor interface
│   ├── js/editor.js        # Editor logic
│   └── css/styles.css      # Editor styles
├── server/
│   ├── index.js            # Express server entry point
│   └── routes/data.js      # API routes for JSON editing
├── package.json            # npm dependencies
└── README.md               # Full documentation
```

## Common Tasks

### Adding a new condition
1. Add physical exam addons if needed to `physical-exam.json`
2. Add medications if needed to `medications.json`
3. Add the condition to `conditions.json` with:
   - `physicalExamAddons` (always include base addons)
   - `conduct` array
   - `prescriptionGroups`

### Adding a new medication
Add to `medications.json`:
```json
"new-med-id": {
  "name": "Nome do Medicamento",
  "instruction": "Instruções de uso"
}
```

### Adding a new physical exam addon
Add to `physical-exam.json` under `addons`:
```json
"new-addon-id": {
  "label": "Label for display",
  "text": "Full text for the exam"
}
```

## Main App Features

- **Keyboard shortcuts:** `/` to focus search, `Ctrl+1/2/3` to copy sections, `Ctrl+Shift+A` to copy all
- **Editable sections:** Output sections can be edited before copying (temporary, resets on changes)
- **Data validation:** Checks for broken references on load (logged to console)
- **Gender support:** Toggle between masculino/feminino for gendered physical exam text

## Important Notes

- All IDs use lowercase with hyphens (e.g., `amoxicilina-500mg`)
- The app is in Brazilian Portuguese
- Fuzzy search for diagnoses matches any word in the name
- Clicking on a filled diagnosis search input clears it for new search
- Main app works statically (can be hosted on GitHub Pages)
- Editor server is local-only for data editing
