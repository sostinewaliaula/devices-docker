# Asset Types & Categories

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the asset types and categories management system. It covers how asset types are configured with dynamic custom attributes, how dropdown options support global and custom field choices, and how categories enable classification. It also documents request types, dynamic form generation, validation rules, and business logic enforcement. Finally, it outlines relationships among asset types, categories, and custom attributes, and addresses permissions, department-specific configurations, and audit requirements for type changes.

## Project Structure
The system spans backend routes and migrations, and frontend pages and services:
- Backend routes expose CRUD APIs for asset types, dropdown options, and issue categories.
- Migrations define database schemas and seed initial data.
- Frontend pages manage configuration and present forms for administrators.

```mermaid
graph TB
subgraph "Backend"
RT1["Routes<br/>assetTypes.js"]
RT2["Routes<br/>dropdownOptions.js"]
RT3["Routes<br/>issueCategories.js"]
DB1["Schema<br/>asset_types"]
DB2["Schema<br/>dropdown_options"]
DB3["Schema<br/>issue_categories"]
DB4["Schema<br/>asset_request_types"]
end
subgraph "Frontend"
FE1["Pages<br/>AssetTypesConfig.tsx"]
FE2["Pages<br/>AssetTypeManagement.tsx"]
SVC["Services<br/>apiService.ts"]
end
FE1 --> SVC
FE2 --> SVC
SVC --> RT1
SVC --> RT2
SVC --> RT3
RT1 --> DB1
RT2 --> DB2
RT3 --> DB3
DB1 --> DB4
```

## Core Components
- Asset Types: Define categories of assets with a dynamic parameters schema stored as JSON. Includes name, description, activation flag, and search/filtering.
- Dropdown Options: Provide reusable lists for fields such as manufacturer, category, status, and condition. Supports active/inactive toggles and uniqueness constraints.
- Issue Categories: Separate classification system for issues, with similar CRUD and filtering capabilities.
- Frontend Configuration: Administrators configure asset types and dropdown options via dedicated pages with live previews and validation.

Key behaviors:
- Validation enforces minimum lengths and required fields.
- Unique constraints prevent duplicates for names and type/value combinations.
- Soft-deletion safety checks prevent removal of asset types still referenced by assets.

## Architecture Overview
The system follows a layered architecture:
- Presentation: React pages render configuration UIs and collect user input.
- Services: API client encapsulates HTTP communication and interceptors.
- Routes: Express endpoints validate, authorize, and persist changes.
- Persistence: SQL schemas define typed storage for asset types, dropdown options, and categories.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant FE as "Frontend Pages"
participant API as "API Client"
participant RT as "Backend Routes"
participant DB as "Database"
Admin->>FE : Open "Asset Configuration"
FE->>API : GET /asset-types?includeInactive=true&search=
API->>RT : GET /asset-types
RT->>DB : SELECT asset_types
DB-->>RT : Rows
RT-->>API : JSON types[]
API-->>FE : types[]
FE-->>Admin : Render table and parameters builder
Admin->>FE : Save Asset Type (with parameters_schema)
FE->>API : POST /asset-types
API->>RT : POST /asset-types
RT->>DB : INSERT asset_types (JSON parameters_schema)
DB-->>RT : OK
RT-->>API : New type
API-->>FE : Success
FE-->>Admin : Toast + refresh
```

## Detailed Component Analysis

### Asset Types Management
Asset types define categories of assets and carry a dynamic parameters schema as JSON. The backend enforces:
- Uniqueness of names.
- Optional parameters_schema array persisted as JSON.
- Activation/deactivation and soft-delete safeguards.

```mermaid
flowchart TD
Start(["Create/Update Asset Type"]) --> Validate["Validate Fields<br/>name length, optional parameters_schema"]
Validate --> Exists{"Duplicate name?"}
Exists --> |Yes| Error["Return 400 Duplicate"]
Exists --> |No| Build["Build INSERT/UPDATE SQL"]
Build --> Persist["Persist to asset_types"]
Persist --> Success["Return saved type"]
Error --> End(["Exit"])
Success --> End
```

### Dropdown Options Management
Dropdown options provide controlled vocabularies for fields. The backend enforces:
- Required type and value.
- Unique type+value pairs.
- Optional activation toggle.

```mermaid
flowchart TD
Start(["Create/Update Dropdown Option"]) --> Validate["Validate type and value"]
Validate --> Persist["INSERT/UPDATE dropdown_options"]
Persist --> Success["Return saved option"]
Success --> End(["Exit"])
```

### Issue Categories Management
Issue categories mirror asset type patterns for categorizing issues, with similar validations and lifecycle controls.

### Dynamic Form Generation and Attribute Mapping
The frontend constructs dynamic forms from asset type parameters_schema:
- Parameters builder supports reordering, adding/removing fields.
- Field types include text, number, date, boolean, dropdown (custom), and global_dropdown.
- Global dropdowns source values from seeded dropdown_options.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant Page as "AssetTypesConfig.tsx"
participant API as "apiService.ts"
participant Types as "assetTypes.js"
participant Seed as "seed_dropdown_options.sql"
Admin->>Page : Open "Asset Configuration"
Page->>API : GET /asset-types
API->>Types : GET /asset-types
Types-->>API : types[] with parameters_schema
API-->>Page : types[]
Page-->>Admin : Render parameters builder
Admin->>Page : Select "global_dropdown" field
Page->>Seed : Read global option types
Seed-->>Page : manufacturer, category, status, condition
Page-->>Admin : Render dropdown with values
```

### Asset Request Types
Asset request types are separate from asset types but share a similar schema and lifecycle. They are managed via a dedicated route and table.

### Asset Type Inheritance and Business Logic
- Asset types do not inherit from each other; each defines its own parameters_schema.
- Business logic enforced:
  - Unique names for asset types and dropdown options.
  - Prevent deletion of asset types still referenced by assets.
  - Activation flags control visibility and availability.
  - Search and filter support for admin views.

### Permissions and Authorization
- Admin-only endpoints require authentication and admin role.
- Frontend uses bearer tokens injected via interceptors.

### Department-Specific Configurations and Audit Requirements
- Department hierarchy exists in the system, enabling department-scoped views and assignments elsewhere.
- Audit logs table exists for broader auditing; while not directly tied to asset type changes here, it supports organizational compliance needs.

## Dependency Analysis
- Frontend depends on API client for all backend interactions.
- Routes depend on database queries and enforce validation.
- Asset types schema references asset request types table conceptually for request workflows.

```mermaid
graph LR
FE["AssetTypesConfig.tsx"] --> API["apiService.ts"]
FE2["AssetTypeManagement.tsx"] --> API
API --> RT1["assetTypes.js"]
API --> RT2["dropdownOptions.js"]
API --> RT3["issueCategories.js"]
RT1 --> DB1["asset_types"]
RT2 --> DB2["dropdown_options"]
RT3 --> DB3["issue_categories"]
DB1 --> DB4["asset_request_types"]
```

## Performance Considerations
- Prefer filtering via query parameters (search, includeInactive) to reduce payload sizes.
- Batch updates for dropdown options leverage upsert semantics to avoid duplicate inserts.
- Keep parameters_schema concise to minimize JSON parsing overhead on the client.

## Troubleshooting Guide
Common issues and resolutions:
- Duplicate asset type name: Ensure uniqueness before creation/update.
- Attempted deletion of in-use asset type: Remove or reassign assets before deleting.
- Validation failures: Confirm required fields meet minimum length and type constraints.
- Dropdown option conflicts: Respect unique type+value constraint.

## Conclusion
The asset types and categories management system provides a flexible, admin-controlled framework for defining asset categories, custom attributes, and controlled vocabularies. With robust validation, authorization, and dynamic form generation, it supports scalable asset and request workflows while maintaining compliance and usability.

## Appendices

### Example Asset Type Configuration
- Name: “Laptop”
- Description: “Laptop computers”
- Parameters Schema includes fields such as Manufacturer (global_dropdown), Category (global_dropdown), Model (text), Serial Number (text), Status (global_dropdown), Condition (global_dropdown), Purchase Date (date), Warranty End Date (date), Purchase Price (number), Current Value (number), RAM (dropdown), Storage (text), Processor (text), OS (text).

### Attribute Mapping Examples
- Global dropdown mapping:
  - Manufacturer → values seeded under type “manufacturer”.
  - Category → values seeded under type “category”.
  - Status → values seeded under type “status”.
  - Condition → values seeded under type “condition”.

### Form Customization Notes
- Administrators can reorder parameters, add/remove fields, and choose between custom and global dropdown sources.
- Required flags can be set per parameter to enforce data capture.

- `AssetTypesConfig.tsx:394-490`
