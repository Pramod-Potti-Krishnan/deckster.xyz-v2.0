# Layout Service Data Model

This document specifies the database schema, hierarchical ID system, and metadata storage requirements for the Layout Service.

---

## 1. Hierarchical ID System

### 1.1 Entity Hierarchy

```
Organization (optional)
└── User
    └── Presentation
        └── Slide
            └── Element (textbox, image, table, chart, infographic, diagram)
```

### 1.2 ID Specifications

| Entity | ID Format | Example |
|--------|-----------|---------|
| User | UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |
| Presentation | UUID v4 | `6ba7b810-9dad-11d1-80b4-00c04fd430c8` |
| Slide | UUID v4 | `6ba7b811-9dad-11d1-80b4-00c04fd430c8` |
| Element | UUID v4 | `6ba7b812-9dad-11d1-80b4-00c04fd430c8` |
| Group | UUID v4 with prefix | `grp-6ba7b813-9dad-11d1-80b4-00c04fd430c8` |
| AI Generation | UUID v4 | `6ba7b814-9dad-11d1-80b4-00c04fd430c8` |

### 1.3 Composite Keys

```typescript
// Element fully qualified identifier
interface ElementFQID {
  presentationId: string
  slideId: string
  elementId: string
}

// String representation: "pres_xxx:slide_yyy:elem_zzz"
function toFQIDString(fqid: ElementFQID): string {
  return `pres_${fqid.presentationId}:slide_${fqid.slideId}:elem_${fqid.elementId}`
}

function parseFQIDString(fqidStr: string): ElementFQID {
  const [pres, slide, elem] = fqidStr.split(':')
  return {
    presentationId: pres.replace('pres_', ''),
    slideId: slide.replace('slide_', ''),
    elementId: elem.replace('elem_', '')
  }
}
```

---

## 2. Database Schema

### 2.1 New Table: `presentation_elements`

```sql
-- Main element storage table
CREATE TABLE presentation_elements (
  -- Primary Keys
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL,
  slide_id UUID NOT NULL,

  -- Element Classification
  element_type VARCHAR(20) NOT NULL CHECK (element_type IN (
    'textbox', 'image', 'table', 'chart', 'infographic', 'diagram'
  )),

  -- Display Name (user-editable)
  display_name VARCHAR(255),

  -- Grid Positioning (percentage-based, 0-100)
  position_x DECIMAL(6,3) NOT NULL DEFAULT 10.000,
  position_y DECIMAL(6,3) NOT NULL DEFAULT 10.000,
  width DECIMAL(6,3) NOT NULL DEFAULT 20.000,
  height DECIMAL(6,3) NOT NULL DEFAULT 20.000,

  -- Grid Metadata (calculated from position/size)
  grid_column_start INT,
  grid_column_span INT,
  grid_row_start INT,
  grid_row_span INT,

  -- Transform Properties
  rotation DECIMAL(6,2) DEFAULT 0.00,
  z_index INT DEFAULT 0,
  opacity DECIMAL(3,2) DEFAULT 1.00,  -- 0.00 to 1.00
  is_locked BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  is_flipped_horizontal BOOLEAN DEFAULT false,
  is_flipped_vertical BOOLEAN DEFAULT false,

  -- Grouping
  group_id UUID,  -- NULL if not in a group
  group_order INT, -- Order within group

  -- Element-Specific Content (JSONB)
  content JSONB NOT NULL DEFAULT '{}',

  -- Styling (JSONB for flexibility)
  styles JSONB DEFAULT '{}',

  -- AI Generation Metadata
  ai_prompt TEXT,
  ai_generation_id UUID,
  ai_service_used VARCHAR(50),
  ai_generated_at TIMESTAMPTZ,
  ai_model_version VARCHAR(50),

  -- Version Control
  version INT DEFAULT 1,
  previous_version_id UUID,  -- For undo/history

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ,  -- Soft delete

  -- Foreign Keys
  CONSTRAINT fk_presentation
    FOREIGN KEY (presentation_id)
    REFERENCES presentations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_group
    FOREIGN KEY (group_id)
    REFERENCES element_groups(id)
    ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_elements_presentation ON presentation_elements(presentation_id);
CREATE INDEX idx_elements_slide ON presentation_elements(slide_id);
CREATE INDEX idx_elements_type ON presentation_elements(element_type);
CREATE INDEX idx_elements_group ON presentation_elements(group_id);
CREATE INDEX idx_elements_z_index ON presentation_elements(slide_id, z_index);
CREATE INDEX idx_elements_deleted ON presentation_elements(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_elements_ai_generation ON presentation_elements(ai_generation_id);

-- GIN index for JSONB content searches
CREATE INDEX idx_elements_content ON presentation_elements USING GIN (content);
CREATE INDEX idx_elements_styles ON presentation_elements USING GIN (styles);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_elements_timestamp
  BEFORE UPDATE ON presentation_elements
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

### 2.2 Element Groups Table

```sql
CREATE TABLE element_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL,
  slide_id UUID NOT NULL,
  display_name VARCHAR(255),

  -- Group bounds (calculated from members)
  bounds_x DECIMAL(6,3),
  bounds_y DECIMAL(6,3),
  bounds_width DECIMAL(6,3),
  bounds_height DECIMAL(6,3),

  -- Group properties
  is_locked BOOLEAN DEFAULT false,

  -- Nesting
  parent_group_id UUID,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_presentation
    FOREIGN KEY (presentation_id)
    REFERENCES presentations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_parent_group
    FOREIGN KEY (parent_group_id)
    REFERENCES element_groups(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_groups_presentation ON element_groups(presentation_id);
CREATE INDEX idx_groups_slide ON element_groups(slide_id);
CREATE INDEX idx_groups_parent ON element_groups(parent_group_id);
```

### 2.3 AI Generations Table

```sql
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  presentation_id UUID NOT NULL,
  slide_id UUID NOT NULL,
  element_id UUID NOT NULL,
  element_type VARCHAR(20) NOT NULL,

  -- Request
  prompt TEXT NOT NULL,
  options JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',

  -- Response
  content JSONB,
  raw_response JSONB,  -- Full AI service response for debugging

  -- Metadata
  service_name VARCHAR(50) NOT NULL,
  model_version VARCHAR(50),
  tokens_used INT,
  processing_time_ms INT,

  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  error_message TEXT,
  retry_count INT DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID,

  CONSTRAINT fk_presentation
    FOREIGN KEY (presentation_id)
    REFERENCES presentations(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_generations_element ON ai_generations(element_id);
CREATE INDEX idx_generations_status ON ai_generations(status);
CREATE INDEX idx_generations_created ON ai_generations(created_at DESC);
```

### 2.4 Element History Table (for undo/versioning)

```sql
CREATE TABLE element_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id UUID NOT NULL,
  version INT NOT NULL,

  -- Snapshot of element state
  snapshot JSONB NOT NULL,

  -- Change metadata
  change_type VARCHAR(20) NOT NULL CHECK (change_type IN (
    'create', 'update', 'delete', 'move', 'resize', 'style', 'content', 'ai_regenerate'
  )),
  change_description TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT unique_element_version UNIQUE (element_id, version)
);

CREATE INDEX idx_history_element ON element_history(element_id);
CREATE INDEX idx_history_element_version ON element_history(element_id, version DESC);
```

### 2.5 Presentation Versions Table (for version history)

```sql
CREATE TABLE presentation_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,

  -- Version snapshot (complete presentation state)
  snapshot JSONB NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(20) NOT NULL CHECK (created_by IN (
    'user', 'auto-save', 'system', 'restore'
  )),
  change_summary TEXT,

  -- For ordering
  version_number INT NOT NULL
);

CREATE INDEX idx_versions_presentation ON presentation_versions(presentation_id);
CREATE INDEX idx_versions_created ON presentation_versions(presentation_id, created_at DESC);

-- Keep only last 50 versions per presentation
CREATE OR REPLACE FUNCTION cleanup_old_versions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM presentation_versions
  WHERE presentation_id = NEW.presentation_id
  AND version_id NOT IN (
    SELECT version_id FROM presentation_versions
    WHERE presentation_id = NEW.presentation_id
    ORDER BY created_at DESC
    LIMIT 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_versions
AFTER INSERT ON presentation_versions
FOR EACH ROW EXECUTE FUNCTION cleanup_old_versions();
```

---

## 3. Element-Specific Content Schemas (JSONB)

### 3.1 TextBox Content

```json
{
  "html": "<p>Hello <strong>world</strong></p>",
  "plainText": "Hello world",
  "wordCount": 2,

  "formatting": {
    "fontFamily": "Inter",
    "fontSize": "16pt",
    "fontWeight": "400",
    "fontStyle": "normal",
    "color": "#000000",
    "backgroundColor": "transparent",
    "textAlign": "left",
    "verticalAlign": "top",
    "lineHeight": 1.5,
    "letterSpacing": "0",
    "textDecoration": "none"
  },

  "paragraph": {
    "marginTop": "0",
    "marginBottom": "12pt"
  },

  "layout": {
    "padding": "12px",
    "verticalAlignment": "top"
  },

  "border": {
    "width": "0",
    "style": "solid",
    "color": "#000000",
    "radius": "0"
  },

  "highlight": {
    "color": null
  }
}
```

### 3.2 Image Content

```json
{
  "url": "https://storage.example.com/images/abc123.png",
  "thumbnailUrl": "https://storage.example.com/thumbnails/abc123.png",
  "originalUrl": "https://storage.example.com/originals/abc123.png",

  "metadata": {
    "width": 1920,
    "height": 1080,
    "format": "png",
    "fileSize": 245678,
    "altText": "A beautiful sunset over mountains"
  },

  "display": {
    "objectFit": "cover",
    "objectPosition": "center center"
  },

  "effects": {
    "brightness": 100,
    "contrast": 100,
    "saturation": 100,
    "grayscale": 0,
    "blur": 0
  },

  "border": {
    "width": "0",
    "style": "solid",
    "color": "#000000",
    "radius": "0"
  },

  "shadow": {
    "enabled": false,
    "offsetX": "4px",
    "offsetY": "4px",
    "blur": "8px",
    "spread": "0",
    "color": "rgba(0,0,0,0.25)"
  },

  "generation": {
    "style": "realistic",
    "aspectRatio": "16:9",
    "prompt": "A beautiful sunset over mountains"
  }
}
```

### 3.3 Table Content

```json
{
  "structure": {
    "rows": 4,
    "columns": 3,
    "hasHeader": true
  },

  "headers": ["Name", "Q1 Sales", "Q2 Sales"],

  "data": [
    ["Product A", "$10,000", "$12,000"],
    ["Product B", "$8,500", "$9,200"],
    ["Product C", "$15,000", "$18,000"]
  ],

  "cellStyles": {
    "0-0": { "fontWeight": "bold", "backgroundColor": "#f0f0f0" },
    "0-1": { "fontWeight": "bold", "backgroundColor": "#f0f0f0" },
    "0-2": { "fontWeight": "bold", "backgroundColor": "#f0f0f0" }
  },

  "columnWidths": ["auto", "120px", "120px"],

  "style": {
    "preset": "professional",
    "borderColor": "#d1d5db",
    "borderWidth": "1px",
    "headerBackground": "#1f2937",
    "headerColor": "#ffffff",
    "alternatingRows": true,
    "alternatingColor": "#f9fafb",
    "cellPadding": "8px 12px",
    "fontSize": "14px",
    "fontFamily": "Inter"
  }
}
```

### 3.4 Chart Content

```json
{
  "chartType": "bar",

  "data": {
    "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    "datasets": [
      {
        "label": "Revenue 2024",
        "data": [12000, 15000, 18000, 14000, 22000, 25000],
        "backgroundColor": "#3B82F6",
        "borderColor": "#2563EB",
        "borderWidth": 1
      },
      {
        "label": "Revenue 2023",
        "data": [10000, 12000, 15000, 13000, 18000, 20000],
        "backgroundColor": "#10B981",
        "borderColor": "#059669",
        "borderWidth": 1
      }
    ]
  },

  "options": {
    "responsive": true,
    "maintainAspectRatio": false,
    "animation": {
      "duration": 1000
    },
    "plugins": {
      "legend": {
        "display": true,
        "position": "top"
      },
      "title": {
        "display": true,
        "text": "Revenue Comparison"
      },
      "tooltip": {
        "enabled": true
      }
    },
    "scales": {
      "x": {
        "display": true,
        "title": {
          "display": true,
          "text": "Month"
        }
      },
      "y": {
        "display": true,
        "title": {
          "display": true,
          "text": "Revenue ($)"
        },
        "beginAtZero": true
      }
    }
  },

  "style": {
    "palette": "professional",
    "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"]
  }
}
```

### 3.5 Infographic Content

```json
{
  "infographicType": "process",

  "items": [
    {
      "id": "step-1",
      "order": 1,
      "title": "Research",
      "description": "Gather requirements and analyze market",
      "icon": "search",
      "color": "#3B82F6",
      "value": null
    },
    {
      "id": "step-2",
      "order": 2,
      "title": "Design",
      "description": "Create wireframes and prototypes",
      "icon": "palette",
      "color": "#10B981",
      "value": null
    },
    {
      "id": "step-3",
      "order": 3,
      "title": "Develop",
      "description": "Build the product",
      "icon": "code",
      "color": "#F59E0B",
      "value": null
    },
    {
      "id": "step-4",
      "order": 4,
      "title": "Launch",
      "description": "Deploy and monitor",
      "icon": "rocket",
      "color": "#EF4444",
      "value": null
    }
  ],

  "layout": {
    "direction": "horizontal",
    "showConnectors": true,
    "connectorStyle": "arrow",
    "itemSpacing": 20
  },

  "style": {
    "colorScheme": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
    "iconStyle": "filled",
    "titleFontSize": "16px",
    "descriptionFontSize": "12px",
    "showNumbers": true
  },

  "renderedSvg": "<svg>...</svg>"
}
```

### 3.6 Diagram Content

```json
{
  "diagramType": "flowchart",
  "direction": "TB",
  "theme": "default",

  "mermaidCode": "graph TB\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Action 1]\n  B -->|No| D[Action 2]\n  C --> E[End]\n  D --> E",

  "nodes": [
    { "id": "A", "label": "Start", "type": "terminal" },
    { "id": "B", "label": "Decision", "type": "decision" },
    { "id": "C", "label": "Action 1", "type": "process" },
    { "id": "D", "label": "Action 2", "type": "process" },
    { "id": "E", "label": "End", "type": "terminal" }
  ],

  "edges": [
    { "from": "A", "to": "B", "label": null },
    { "from": "B", "to": "C", "label": "Yes" },
    { "from": "B", "to": "D", "label": "No" },
    { "from": "C", "to": "E", "label": null },
    { "from": "D", "to": "E", "label": null }
  ],

  "style": {
    "nodeColor": "#ffffff",
    "nodeBorderColor": "#000000",
    "edgeColor": "#000000",
    "labelColor": "#000000"
  },

  "renderedSvg": "<svg>...</svg>"
}
```

---

## 4. Common Styles Schema (JSONB)

```json
{
  "border": {
    "width": "1px",
    "style": "solid",
    "color": "#000000",
    "radius": "4px"
  },

  "shadow": {
    "enabled": false,
    "offsetX": "0px",
    "offsetY": "4px",
    "blur": "8px",
    "spread": "0px",
    "color": "rgba(0,0,0,0.1)"
  },

  "background": {
    "type": "solid",
    "color": "#ffffff",
    "gradient": null,
    "image": null
  },

  "padding": {
    "top": "0px",
    "right": "0px",
    "bottom": "0px",
    "left": "0px"
  }
}
```

---

## 5. Reconciliation with Existing Tables

### 5.1 Presentations Table Integration

```sql
-- Existing presentations table (assumed structure)
-- ALTER to add element-related fields if needed

ALTER TABLE presentations
ADD COLUMN IF NOT EXISTS element_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_element_updated_at TIMESTAMPTZ;

-- Trigger to maintain element count
CREATE OR REPLACE FUNCTION update_presentation_element_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE presentations
    SET element_count = element_count + 1,
        last_element_updated_at = NOW()
    WHERE id = NEW.presentation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE presentations
    SET element_count = element_count - 1,
        last_element_updated_at = NOW()
    WHERE id = OLD.presentation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_element_count
AFTER INSERT OR DELETE ON presentation_elements
FOR EACH ROW EXECUTE FUNCTION update_presentation_element_count();
```

### 5.2 Slides Table Integration

```sql
-- If a slides table exists, add element count

ALTER TABLE slides
ADD COLUMN IF NOT EXISTS element_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_element_updated_at TIMESTAMPTZ;

-- Trigger for slide element count
CREATE OR REPLACE FUNCTION update_slide_element_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE slides
    SET element_count = element_count + 1,
        last_element_updated_at = NOW()
    WHERE id = NEW.slide_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE slides
    SET element_count = element_count - 1,
        last_element_updated_at = NOW()
    WHERE id = OLD.slide_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_slide_element_count
AFTER INSERT OR DELETE ON presentation_elements
FOR EACH ROW EXECUTE FUNCTION update_slide_element_count();
```

### 5.3 User Sessions Integration

```sql
-- Track which user is editing which elements
CREATE TABLE element_locks (
  element_id UUID PRIMARY KEY,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT fk_element
    FOREIGN KEY (element_id)
    REFERENCES presentation_elements(id)
    ON DELETE CASCADE
);

-- Function to acquire lock
CREATE OR REPLACE FUNCTION acquire_element_lock(
  p_element_id UUID,
  p_user_id UUID,
  p_duration_seconds INT DEFAULT 300
)
RETURNS BOOLEAN AS $$
DECLARE
  v_existing_lock element_locks%ROWTYPE;
BEGIN
  -- Check for existing lock
  SELECT * INTO v_existing_lock
  FROM element_locks
  WHERE element_id = p_element_id;

  IF v_existing_lock IS NULL OR v_existing_lock.expires_at < NOW() THEN
    -- No lock or expired lock, acquire new lock
    INSERT INTO element_locks (element_id, locked_by, locked_at, expires_at)
    VALUES (p_element_id, p_user_id, NOW(), NOW() + (p_duration_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (element_id) DO UPDATE
    SET locked_by = p_user_id,
        locked_at = NOW(),
        expires_at = NOW() + (p_duration_seconds || ' seconds')::INTERVAL;
    RETURN TRUE;
  ELSIF v_existing_lock.locked_by = p_user_id THEN
    -- User already has lock, extend it
    UPDATE element_locks
    SET expires_at = NOW() + (p_duration_seconds || ' seconds')::INTERVAL
    WHERE element_id = p_element_id;
    RETURN TRUE;
  ELSE
    -- Another user has lock
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to release lock
CREATE OR REPLACE FUNCTION release_element_lock(
  p_element_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM element_locks
  WHERE element_id = p_element_id
    AND locked_by = p_user_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Database Queries

### 6.1 Get All Elements for a Slide

```sql
SELECT
  e.*,
  g.display_name as group_name,
  g.is_locked as group_locked
FROM presentation_elements e
LEFT JOIN element_groups g ON e.group_id = g.id
WHERE e.slide_id = $1
  AND e.deleted_at IS NULL
ORDER BY e.z_index ASC;
```

### 6.2 Get Element with Full History

```sql
SELECT
  e.*,
  (
    SELECT json_agg(h ORDER BY h.version DESC)
    FROM element_history h
    WHERE h.element_id = e.id
  ) as history
FROM presentation_elements e
WHERE e.id = $1;
```

### 6.3 Get Elements by Type for Presentation

```sql
SELECT
  e.*,
  s.title as slide_title,
  s.index as slide_index
FROM presentation_elements e
JOIN slides s ON e.slide_id = s.id
WHERE e.presentation_id = $1
  AND e.element_type = $2
  AND e.deleted_at IS NULL
ORDER BY s.index ASC, e.z_index ASC;
```

### 6.4 Search Elements by Content

```sql
-- Search in JSONB content
SELECT *
FROM presentation_elements
WHERE presentation_id = $1
  AND deleted_at IS NULL
  AND (
    content->>'plainText' ILIKE '%' || $2 || '%'
    OR content->>'html' ILIKE '%' || $2 || '%'
    OR ai_prompt ILIKE '%' || $2 || '%'
  );
```

### 6.5 Get AI Generation Statistics

```sql
SELECT
  element_type,
  ai_service_used,
  COUNT(*) as generation_count,
  AVG(EXTRACT(EPOCH FROM (ai_generated_at - created_at))) as avg_generation_time_sec
FROM presentation_elements
WHERE ai_generation_id IS NOT NULL
  AND presentation_id = $1
GROUP BY element_type, ai_service_used;
```

---

## 7. Migration Strategy

### 7.1 Initial Migration Script

```sql
-- Migration: Create presentation_elements and related tables
-- Version: 001
-- Date: 2024-XX-XX

BEGIN;

-- Create element_groups table first (referenced by elements)
CREATE TABLE IF NOT EXISTS element_groups (...);

-- Create presentation_elements table
CREATE TABLE IF NOT EXISTS presentation_elements (...);

-- Create ai_generations table
CREATE TABLE IF NOT EXISTS ai_generations (...);

-- Create element_history table
CREATE TABLE IF NOT EXISTS element_history (...);

-- Create element_locks table
CREATE TABLE IF NOT EXISTS element_locks (...);

-- Create all indexes
CREATE INDEX IF NOT EXISTS ...;

-- Create all triggers
CREATE TRIGGER IF NOT EXISTS ...;

-- Update existing presentations table
ALTER TABLE presentations
ADD COLUMN IF NOT EXISTS element_count INT DEFAULT 0;

COMMIT;
```

### 7.2 Rollback Script

```sql
-- Rollback: Remove presentation_elements and related tables
-- Version: 001

BEGIN;

DROP TABLE IF EXISTS element_locks CASCADE;
DROP TABLE IF EXISTS element_history CASCADE;
DROP TABLE IF EXISTS ai_generations CASCADE;
DROP TABLE IF EXISTS presentation_elements CASCADE;
DROP TABLE IF EXISTS element_groups CASCADE;

ALTER TABLE presentations
DROP COLUMN IF EXISTS element_count;

COMMIT;
```

---

## 8. Data Validation Rules

### 8.1 Position/Size Constraints

```typescript
const VALIDATION_RULES = {
  position: {
    x: { min: -50, max: 150 },  // Allow slight off-slide for animations
    y: { min: -50, max: 150 }
  },
  size: {
    width: { min: 1, max: 100 },
    height: { min: 1, max: 100 }
  },
  rotation: { min: 0, max: 360 },
  opacity: { min: 0, max: 1 },
  zIndex: { min: -1000, max: 1000 }
}

function validateElementPosition(element: Partial<Element>): ValidationResult {
  const errors: string[] = []

  if (element.position_x !== undefined) {
    if (element.position_x < VALIDATION_RULES.position.x.min ||
        element.position_x > VALIDATION_RULES.position.x.max) {
      errors.push(`position_x must be between ${VALIDATION_RULES.position.x.min} and ${VALIDATION_RULES.position.x.max}`)
    }
  }
  // ... similar for other fields

  return { valid: errors.length === 0, errors }
}
```

### 8.2 Content Schema Validation

```typescript
import Ajv from 'ajv'

const ajv = new Ajv()

// JSON Schema for TextBox content
const textBoxContentSchema = {
  type: 'object',
  required: ['html'],
  properties: {
    html: { type: 'string' },
    plainText: { type: 'string' },
    formatting: {
      type: 'object',
      properties: {
        fontFamily: { type: 'string' },
        fontSize: { type: 'string' },
        color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }
      }
    }
  }
}

const validateTextBoxContent = ajv.compile(textBoxContentSchema)

// Similar schemas for other element types...
```
