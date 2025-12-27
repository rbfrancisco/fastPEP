# FastPEP - Fast Electronic Medical Record Generator

A lightweight, fast web application for generating standardized medical record documentation in Brazilian Portuguese. Designed for emergency physicians to quickly produce consistent physical exam findings, therapeutic conduct notes, and prescriptions.

## Quick Start

1. Open `index.html` in any modern web browser
2. Select the patient's pronoun (Ele/Ela)
3. Search and select a diagnosis
4. Customize physical exam addons, conduct items, and medications as needed
5. Click the copy buttons to transfer each section to your EMR

No installation, no server, no internet required - it runs entirely in your browser.

---

## For Data Editors

You can add new conditions, medications, and physical exam findings by editing the JSON files in the `data/` folder. There's also an **Admin Editor** tool at `admin/index.html` that provides forms with autocomplete to generate the JSON for you.

### Data Files Overview

| File | Purpose |
|------|---------|
| `data/medications.json` | All available medications with dosing instructions |
| `data/medication-classes.json` | Groups of interchangeable medications (e.g., NSAIDs) |
| `data/physical-exam.json` | Base exam text and condition-specific addons |
| `data/conditions.json` | Diagnoses with their exam addons, conduct, and prescriptions |

---

## Technical Documentation

This section provides detailed specifications for each data file. Follow these patterns exactly when adding new entries.

### 1. Medications (`data/medications.json`)

Each medication is an object with a unique ID as the key.

#### Schema

```json
"medication-id": {
  "name": "Display Name",
  "instruction": "Dosing instructions text",
  "defaultDuration": "3",           // Optional: only if using {duration}
  "inHospital": true,               // Optional: medication given in hospital
  "hospitalNote": "(Applied at ER)" // Optional: note shown in UI
}
```

#### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | The medication name shown to users |
| `instruction` | Yes | Complete dosing instructions for the prescription |
| `defaultDuration` | No | Default value for `{duration}` placeholder |
| `inHospital` | No | If `true`, medication is given in hospital and excluded from take-home prescription |
| `hospitalNote` | No | Explanatory note shown when `inHospital` is true |

#### ID Naming Convention

- Use lowercase letters, numbers, and hyphens only
- Format: `drug-name-dose` (e.g., `amoxicilina-500mg`)
- For variants, add suffix: `amoxicilina-500mg-8h` (every 8 hours variant)

#### Duration Placeholder

Use `{duration}` in the instruction for medications where duration varies by condition:

```json
"cetoprofeno-100mg": {
  "name": "Cetoprofeno 100mg",
  "instruction": "Tomar 1cp de 12 em 12 horas, por {duration} dias",
  "defaultDuration": "3"
}
```

The actual duration is determined by:
1. Condition-level override (in `prescriptionGroups`)
2. Medication's `defaultDuration`
3. Fallback to "3" if neither is specified

#### Examples

**Standard medication:**
```json
"dipirona-500mg": {
  "name": "Dipirona 500mg",
  "instruction": "Tomar 2cp de 6 em 6 horas, SE DOR OU FEBRE"
}
```

**With duration placeholder:**
```json
"ibuprofeno-600mg": {
  "name": "Ibuprofeno 600mg",
  "instruction": "Tomar 1cp de 8 em 8 horas, por {duration} dias",
  "defaultDuration": "3"
}
```

**In-hospital medication:**
```json
"penicilina-benzatina": {
  "name": "Penicilina Benzatina 1.200.000 UI",
  "instruction": "Aplicar 1 ampola intramuscular, dose única",
  "inHospital": true,
  "hospitalNote": "(Aplicado no PS - não entra na prescrição para casa)"
}
```

---

### 2. Medication Classes (`data/medication-classes.json`)

Medication classes group interchangeable drugs, allowing users to pick one from the group.

#### Schema

```json
"class-id": {
  "label": "Display Label",
  "options": ["medication-id-1", "medication-id-2", "medication-id-3"]
}
```

#### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `label` | Yes | Display name for the class (e.g., "AINE", "Analgésico") |
| `options` | Yes | Array of medication IDs that belong to this class |

#### Important Notes

- All medication IDs in `options` must exist in `medications.json`
- Order matters: first option is typically the most common choice
- The condition specifies which option is the default

#### Example

```json
"aine": {
  "label": "AINE",
  "options": ["cetoprofeno-100mg", "ibuprofeno-600mg", "naproxeno-500mg"]
},
"analgesico": {
  "label": "Analgésico/Antitérmico",
  "options": ["dipirona-500mg", "dipirona-1g", "paracetamol-500mg"]
}
```

---

### 3. Physical Exam (`data/physical-exam.json`)

Contains the base physical exam and condition-specific addons.

#### Schema

```json
{
  "base": {
    "masculino": "Base exam text for male patients...",
    "feminino": "Base exam text for female patients..."
  },
  "addons": {
    "addon-id": {
      "label": "Short label for checkbox",
      "text": "Full text to append to exam"
    }
  }
}
```

#### Base Exam

The `base` object contains the standard physical exam text that applies to all patients:
- `masculino`: Text with masculine adjectives (corado, hidratado, etc.)
- `feminino`: Text with feminine adjectives (corada, hidratada, etc.)

Use `\n` for line breaks within the text.

#### Addons

Addons are additional findings appended based on the diagnosis.

| Field | Required | Description |
|-------|----------|-------------|
| `label` | Yes | Short description shown in the checkbox list |
| `text` | Yes | Full text appended to the physical exam |

**Note:** If the addon text doesn't vary by gender, the same text is used for both. The addon structure uses a simple `text` field (not `male`/`female`) since most findings are gender-neutral.

#### Example

```json
{
  "base": {
    "masculino": "Bom estado geral, corado, hidratado...",
    "feminino": "Bom estado geral, corada, hidratada..."
  },
  "addons": {
    "oroscopia-amigdalite": {
      "label": "Oroscopia com amigdalite",
      "text": "Orofaringe hiperemiada, amígdalas edemaciadas e com presença de secreção purulenta."
    },
    "giordano-positivo": {
      "label": "Giordano positivo",
      "text": "Giordano positivo à direita/esquerda."
    }
  }
}
```

---

### 4. Conditions (`data/conditions.json`)

The main configuration file that defines diagnoses and links everything together.

#### Schema

```json
"condition-id": {
  "name": "Display Name",
  "physicalExamAddons": ["addon-id-1", "addon-id-2"],
  "conduct": [
    "Conduct item 1",
    "Conduct item 2"
  ],
  "prescriptionGroups": [
    // Group definitions (see below)
  ]
}
```

#### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name shown in search results |
| `physicalExamAddons` | Yes | Array of addon IDs from `physical-exam.json` |
| `conduct` | Yes | Array of therapeutic conduct text items |
| `prescriptionGroups` | Yes | Array of prescription group definitions |

#### Prescription Groups

There are two types of prescription groups:

##### Type 1: Radio Group (Single Selection)

Used when the user must choose ONE option from a list (e.g., antibiotic selection).

```json
{
  "id": "antibiotico",
  "label": "Antibiótico",
  "type": "radio",
  "options": ["amoxicilina-500mg", "penicilina-benzatina", "azitromicina-500mg"],
  "default": "amoxicilina-500mg"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for this group |
| `label` | Yes | Display label for the group |
| `type` | Yes | Must be `"radio"` |
| `options` | Yes | Array of medication IDs |
| `default` | Yes | Which medication is pre-selected |

##### Type 2: Items Group (Multiple Selection)

Used for symptomatic medications where multiple can be selected.

```json
{
  "id": "sintomaticos",
  "label": "Sintomáticos",
  "items": [
    { "type": "med", "medId": "lavagem-nasal", "checked": true },
    { "type": "class", "classId": "aine", "default": "cetoprofeno-100mg", "checked": true },
    { "type": "class", "classId": "analgesico", "default": "dipirona-500mg", "checked": true, "duration": "5" }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for this group |
| `label` | Yes | Display label for the group |
| `items` | Yes | Array of item definitions |

##### Item Types

**Direct medication (`type: "med"`):**
```json
{ "type": "med", "medId": "medication-id", "checked": true }
```
- `medId`: ID from `medications.json`
- `checked`: Whether it's pre-selected

**Medication class (`type: "class"`):**
```json
{ "type": "class", "classId": "class-id", "default": "medication-id", "checked": true, "duration": "5" }
```
- `classId`: ID from `medication-classes.json`
- `default`: Which option in the class is pre-selected
- `checked`: Whether the class is enabled
- `duration`: (Optional) Override the medication's default duration

#### Complete Example

```json
"faringoamigdalite-bacteriana": {
  "name": "Faringoamigdalite bacteriana",
  "physicalExamAddons": ["oroscopia-amigdalite", "linfonodomegalia-cervical"],
  "conduct": [
    "Explico sobre a condição e esclareço dúvidas",
    "Prescrevo antibioticoterapia",
    "Prescrevo sintomáticos para casa",
    "Oriento sinais de alarme para retorno ao pronto-socorro",
    "Atesto 2 dias"
  ],
  "prescriptionGroups": [
    {
      "id": "antibiotico",
      "label": "Antibiótico",
      "type": "radio",
      "options": ["amoxicilina-500mg", "penicilina-benzatina", "azitromicina-500mg"],
      "default": "amoxicilina-500mg"
    },
    {
      "id": "sintomaticos",
      "label": "Sintomáticos",
      "items": [
        { "type": "med", "medId": "flurbiprofeno-pastilha", "checked": true },
        { "type": "class", "classId": "aine", "default": "cetoprofeno-100mg", "checked": true },
        { "type": "class", "classId": "analgesico", "default": "dipirona-500mg", "checked": true }
      ]
    }
  ]
}
```

---

## Adding New Data: Step-by-Step

### Adding a New Medication

1. Open `data/medications.json`
2. Add a new entry before the closing `}`
3. Use the pattern:
```json
"new-medication-id": {
  "name": "Medication Name Dose",
  "instruction": "Complete dosing instructions"
}
```
4. Add a comma after the previous entry if needed

### Adding a New Condition

1. **First, ensure all dependencies exist:**
   - All medication IDs must exist in `medications.json`
   - All class IDs must exist in `medication-classes.json`
   - All addon IDs must exist in `physical-exam.json`

2. **Open `data/conditions.json`**

3. **Add the new condition following this template:**
```json
"new-condition-id": {
  "name": "Condition Display Name",
  "physicalExamAddons": ["relevant-addon-id"],
  "conduct": [
    "First conduct item",
    "Second conduct item"
  ],
  "prescriptionGroups": [
    {
      "id": "treatment",
      "label": "Treatment",
      "items": [
        { "type": "med", "medId": "medication-id", "checked": true }
      ]
    }
  ]
}
```

### Using the Admin Editor

The Admin Editor (`admin/index.html`) provides a visual interface for creating and editing JSON entries without manually editing files.

#### Features

- **Create New Entries**: Fill in form fields to generate JSON for new medications, classes, addons, or conditions
- **Edit Existing Entries**: Load and modify any existing entry from the database
- **Autocomplete**: All fields suggest existing values to ensure consistency and speed up data entry
- **Drag-and-Drop Reordering**: Reorder prescription items, medication options, addons, and conduct items by dragging
- **Validation**: Warns about missing references or duplicate IDs

#### Creating New Entries

1. Open `admin/index.html` in your browser
2. Select the appropriate tab (Medication, Class, Physical Exam, or Condition)
3. Ensure "Novo" mode is selected (default)
4. Fill in the form fields - autocomplete will suggest existing values
5. For lists (medications in a class, items in a prescription group), use the drag handles (⋮⋮) to reorder
6. Click "Gerar JSON" to generate the JSON code
7. Click "Copiar" to copy to clipboard
8. Paste into the appropriate data file, replacing or adding the entry

#### Editing Existing Entries

1. Open `admin/index.html` in your browser
2. Select the appropriate tab
3. Click "Editar Existente" to switch to edit mode
4. Select an entry from the dropdown - all fields will be populated
5. Make your changes (edit text, reorder items, add/remove elements)
6. Click "Gerar JSON" to generate the updated JSON
7. Click "Copiar" to copy to clipboard
8. In the data file, find and replace the existing entry with the new JSON

#### Reordering Items

The order of items in the editor directly affects the output order. To reorder:

1. Locate the drag handle (⋮⋮) on the left side of any reorderable item
2. Click and hold the drag handle
3. Drag the item to its new position
4. Release to drop

Reorderable elements include:
- Medication options in a class
- Physical exam addons in a condition
- Conduct items in a condition
- Prescription groups (entire groups can be reordered)
- Items within a prescription group

---

## Prescription Order

**Important:** The order of items in `prescriptionGroups` and within each group's `items` array determines the order they appear in the final prescription. This order is preserved exactly as defined in the JSON, so arrange items in the clinically appropriate order for patient comprehension.

---

## Project Structure

```
fastPEP/
├── index.html              # Main application
├── css/
│   └── styles.css          # Application styles
├── js/
│   └── app.js              # Application logic
├── data/
│   ├── medications.json    # Medication definitions
│   ├── medication-classes.json  # Medication groups
│   ├── physical-exam.json  # Physical exam templates
│   └── conditions.json     # Condition definitions
└── admin/
    ├── index.html          # Admin editor interface
    ├── css/
    │   └── styles.css      # Editor styles
    └── js/
        └── editor.js       # Editor logic with autocomplete
```

---

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge). No Internet Explorer support.

## License

This project is provided for medical documentation assistance. Always verify prescriptions and clinical information according to current medical guidelines and local regulations.
