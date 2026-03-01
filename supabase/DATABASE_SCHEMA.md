# Resume Builder Database Schema Documentation

## Overview

This document describes the database schema for the Resume Builder & Manager feature. The schema supports modular resume management, allowing users to create reusable resume components and assemble them into multiple resume versions.

## Architecture

The schema follows a modular architecture with three core tables:

1. **resume_versions** - Named collections of modules (complete resumes)
2. **resume_modules** - Individual resume components (experience, education, skills, etc.)
3. **version_modules** - Junction table linking versions to modules with ordering

## Entity Relationship Diagram

```
┌─────────────────┐
│  auth.users     │
└────────┬────────┘
         │
         │ 1:N
         │
    ┌────┴─────────────────────────────┐
    │                                  │
    ▼                                  ▼
┌─────────────────┐            ┌─────────────────┐
│resume_versions  │            │resume_modules   │
│─────────────────│            │─────────────────│
│id (PK)          │            │id (PK)          │
│user_id (FK)     │            │user_id (FK)     │
│name             │            │type             │
│template_id      │            │content (JSONB)  │
│created_at       │            │created_at       │
│updated_at       │            │updated_at       │
└────────┬────────┘            └────────┬────────┘
         │                              │
         │                              │
         │         N:M                  │
         │    ┌──────────────┐          │
         └────►version_modules◄─────────┘
              │──────────────│
              │version_id(FK)│
              │module_id (FK)│
              │display_order │
              │created_at    │
              └──────────────┘
                     │
                     │ 1:N
                     ▼
              ┌──────────────┐
              │applications  │
              │──────────────│
              │id (PK)       │
              │resume_ver... │
              └──────────────┘
```

## Table Definitions

### resume_versions

Stores named resume versions. Each version is a collection of modules arranged in a specific order.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| user_id | UUID | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Owner of the resume version |
| name | VARCHAR(255) | NOT NULL | User-defined name for the version |
| template_id | VARCHAR(50) | DEFAULT 'default' | Template identifier for PDF export styling |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp (auto-updated) |

**Constraints:**
- UNIQUE(user_id, name) - Each user must have unique version names

**Indexes:**
- `idx_resume_versions_user` ON (user_id)
- `idx_resume_versions_created` ON (created_at DESC)

**RLS Policies:**
- Users can only SELECT, INSERT, UPDATE, DELETE their own versions

### resume_modules

Stores individual resume components. Modules are reusable across multiple versions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| user_id | UUID | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Owner of the module |
| type | VARCHAR(50) | NOT NULL, CHECK (type IN (...)) | Module type (see Module Types) |
| content | JSONB | NOT NULL | Flexible structure based on module type |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp (auto-updated) |

**Valid Module Types:**
- `experience` - Job experience entries
- `education` - Education entries
- `skills` - Skills grouped by category
- `custom` - Custom sections
- `summary` - Professional summary
- `certification` - Certifications and credentials

**Indexes:**
- `idx_resume_modules_user` ON (user_id)
- `idx_resume_modules_type` ON (type)
- `idx_resume_modules_created` ON (created_at DESC)

**RLS Policies:**
- Users can only SELECT, INSERT, UPDATE, DELETE their own modules

### version_modules

Junction table linking resume versions to modules with display ordering.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| version_id | UUID | NOT NULL, REFERENCES resume_versions(id) ON DELETE CASCADE | Resume version |
| module_id | UUID | NOT NULL, REFERENCES resume_modules(id) ON DELETE CASCADE | Resume module |
| display_order | INTEGER | NOT NULL | Order in which module appears (0-indexed) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Constraints:**
- PRIMARY KEY (version_id, module_id) - Each module can appear once per version

**Indexes:**
- `idx_version_modules_version` ON (version_id)
- `idx_version_modules_module` ON (module_id)
- `idx_version_modules_order` ON (version_id, display_order)

**RLS Policies:**
- Users can manage links for their own versions (checked via version ownership)

### applications (modified)

Existing table modified to link applications to resume versions.

**New Column:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| resume_version_id | UUID | REFERENCES resume_versions(id) ON DELETE SET NULL | Linked resume version |

**New Index:**
- `idx_applications_resume_version` ON (resume_version_id)

## Module Content Structures

The `content` column in `resume_modules` uses JSONB to store flexible structures based on module type.

### Experience Module

```json
{
  "company": "Tech Corp",
  "position": "Senior Engineer",
  "location": "San Francisco, CA",
  "startDate": "2020-01",
  "endDate": "Present",
  "achievements": [
    "Led team of 5 engineers",
    "Improved performance by 50%"
  ],
  "technologies": ["React", "Node.js", "PostgreSQL"]
}
```

### Education Module

```json
{
  "institution": "University of California",
  "degree": "Bachelor of Science",
  "field": "Computer Science",
  "startDate": "2016-09",
  "endDate": "2020-05",
  "gpa": "3.8",
  "honors": ["Dean's List", "Cum Laude"]
}
```

### Skills Module

```json
{
  "category": "technical",
  "skills": ["JavaScript", "Python", "React", "Node.js"]
}
```

### Custom Module

```json
{
  "title": "Publications",
  "format": "list",
  "data": [
    "Paper 1: Title and Journal",
    "Paper 2: Title and Conference"
  ]
}
```

### Summary Module

```json
{
  "text": "Experienced software engineer with 5+ years..."
}
```

### Certification Module

```json
{
  "name": "AWS Certified Solutions Architect",
  "issuer": "Amazon Web Services",
  "date": "2023-06",
  "expiryDate": "2026-06",
  "credentialId": "ABC123XYZ"
}
```

## Security

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring users can only access their own data.

**resume_versions policies:**
- `Users can view own resume versions` - SELECT WHERE user_id = auth.uid()
- `Users can insert own resume versions` - INSERT WITH CHECK user_id = auth.uid()
- `Users can update own resume versions` - UPDATE WHERE user_id = auth.uid()
- `Users can delete own resume versions` - DELETE WHERE user_id = auth.uid()

**resume_modules policies:**
- `Users can view own modules` - SELECT WHERE user_id = auth.uid()
- `Users can insert own modules` - INSERT WITH CHECK user_id = auth.uid()
- `Users can update own modules` - UPDATE WHERE user_id = auth.uid()
- `Users can delete own modules` - DELETE WHERE user_id = auth.uid()

**version_modules policies:**
- `Users can manage version-module links` - ALL WHERE version owned by user

### Cascade Behavior

- Deleting a user cascades to delete all their versions and modules
- Deleting a version cascades to delete all version-module links
- Deleting a module cascades to delete all version-module links
- Deleting a version sets application.resume_version_id to NULL (not cascade)

## Performance Optimization

### Indexes

Strategic indexes are created for common query patterns:

1. **User-based queries** - Most queries filter by user_id
2. **Type filtering** - Modules are often filtered by type
3. **Ordering** - Results are typically ordered by created_at
4. **Junction lookups** - Fast lookups in both directions for version-module links

### Automatic Timestamp Updates

Triggers automatically update the `updated_at` column on resume_versions and resume_modules:

```sql
CREATE TRIGGER update_resume_versions_updated_at
  BEFORE UPDATE ON public.resume_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Common Queries

### Fetch all versions with module count

```sql
SELECT 
  rv.*,
  COUNT(vm.module_id) as module_count
FROM resume_versions rv
LEFT JOIN version_modules vm ON rv.id = vm.version_id
WHERE rv.user_id = auth.uid()
GROUP BY rv.id
ORDER BY rv.updated_at DESC;
```

### Fetch a version with all its modules

```sql
SELECT 
  rv.*,
  json_agg(
    json_build_object(
      'id', rm.id,
      'type', rm.type,
      'content', rm.content,
      'display_order', vm.display_order
    ) ORDER BY vm.display_order
  ) as modules
FROM resume_versions rv
LEFT JOIN version_modules vm ON rv.id = vm.version_id
LEFT JOIN resume_modules rm ON vm.module_id = rm.id
WHERE rv.id = $1 AND rv.user_id = auth.uid()
GROUP BY rv.id;
```

### Find modules not in a specific version

```sql
SELECT rm.*
FROM resume_modules rm
WHERE rm.user_id = auth.uid()
AND rm.id NOT IN (
  SELECT module_id 
  FROM version_modules 
  WHERE version_id = $1
)
ORDER BY rm.created_at DESC;
```

### Search modules by content

```sql
SELECT *
FROM resume_modules
WHERE user_id = auth.uid()
AND (
  content->>'company' ILIKE '%search%'
  OR content->>'position' ILIKE '%search%'
  OR content->>'institution' ILIKE '%search%'
)
ORDER BY created_at DESC;
```

## Migration History

| Version | Date | Description |
|---------|------|-------------|
| 20240101000000 | 2024 | Initial schema - resume_versions, resume_modules, version_modules tables |

## Maintenance

### Backup Recommendations

- Regular backups of all three tables
- JSONB content should be included in backups
- Consider point-in-time recovery for production

### Monitoring

Monitor these metrics:
- Table sizes and growth rates
- Index usage statistics
- Query performance on JSONB content searches
- RLS policy evaluation time

### Future Considerations

Potential schema enhancements:
- Add full-text search indexes on JSONB content
- Add materialized views for complex aggregations
- Consider partitioning for high-volume users
- Add audit logging for module changes
