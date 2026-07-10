-- ========================================
-- DROP UNUSED RELATIONAL RESUME-BUILDER TABLES
-- resume_modules and version_modules backed the relational resume-builder
-- system (ResumeBuilder.jsx / VersionManager.jsx / ResumeVersionPreview.jsx,
-- deleted in #2). Confirmed via live query: zero resume_versions rows have
-- ever linked to a module (module_id null across the board). No remaining
-- code references either table.
--
-- resume_versions itself is NOT dropped — it still backs ResumeManager.jsx
-- via the flat `content` column (see the prior migration).
--
-- DESTRUCTIVE — take a schema/data dump of both tables before applying.
-- ========================================

DROP TABLE IF EXISTS public.version_modules;
DROP TABLE IF EXISTS public.resume_modules;
