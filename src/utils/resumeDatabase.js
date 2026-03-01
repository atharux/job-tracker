/**
 * Database utility functions for Resume Builder & Manager
 * Handles all Supabase interactions for resume versions, modules, and version-module links
 */

import { supabase } from '../supabaseClient';

// ========================================
// Resume Versions
// ========================================

/**
 * Fetch all resume versions for the current user
 * @returns {Promise<Array>} Array of resume versions
 */
export async function fetchResumeVersions() {
  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching resume versions:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch a single resume version by ID
 * @param {string} versionId - UUID of the resume version
 * @returns {Promise<Object>} Resume version object
 */
export async function fetchResumeVersion(versionId) {
  const { data, error } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error) {
    console.error('Error fetching resume version:', error);
    throw error;
  }

  return data;
}

/**
 * Create a new resume version
 * @param {Object} version - Resume version data (name, template_id)
 * @returns {Promise<Object>} Created resume version
 */
export async function createResumeVersion(version) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('resume_versions')
    .insert([{
      user_id: user.id,
      name: version.name,
      template_id: version.template_id || 'default'
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating resume version:', error);
    throw error;
  }

  return data;
}

/**
 * Update a resume version
 * @param {string} versionId - UUID of the resume version
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated resume version
 */
export async function updateResumeVersion(versionId, updates) {
  const { data, error } = await supabase
    .from('resume_versions')
    .update(updates)
    .eq('id', versionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating resume version:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a resume version
 * @param {string} versionId - UUID of the resume version
 * @returns {Promise<void>}
 */
export async function deleteResumeVersion(versionId) {
  const { error } = await supabase
    .from('resume_versions')
    .delete()
    .eq('id', versionId);

  if (error) {
    console.error('Error deleting resume version:', error);
    throw error;
  }
}

/**
 * Clone a resume version
 * @param {string} versionId - UUID of the version to clone
 * @param {string} newName - Name for the cloned version
 * @returns {Promise<Object>} Cloned resume version with modules
 */
export async function cloneResumeVersion(versionId, newName) {
  // Fetch original version
  const original = await fetchResumeVersion(versionId);
  
  // Create new version
  const newVersion = await createResumeVersion({
    name: newName || `${original.name} Copy`,
    template_id: original.template_id
  });

  // Fetch module links from original
  const { data: moduleLinks } = await supabase
    .from('version_modules')
    .select('module_id, display_order')
    .eq('version_id', versionId)
    .order('display_order');

  // Copy module links to new version
  if (moduleLinks && moduleLinks.length > 0) {
    const newLinks = moduleLinks.map(link => ({
      version_id: newVersion.id,
      module_id: link.module_id,
      display_order: link.display_order
    }));

    await supabase
      .from('version_modules')
      .insert(newLinks);
  }

  return newVersion;
}

// ========================================
// Resume Modules
// ========================================

/**
 * Fetch all modules for the current user
 * @param {Object} filters - Optional filters (type, search)
 * @returns {Promise<Array>} Array of resume modules
 */
export async function fetchResumeModules(filters = {}) {
  let query = supabase
    .from('resume_modules')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.search) {
    query = query.or(`content->>'company'.ilike.%${filters.search}%,content->>'position'.ilike.%${filters.search}%,content->>'institution'.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching resume modules:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch a single module by ID
 * @param {string} moduleId - UUID of the module
 * @returns {Promise<Object>} Resume module object
 */
export async function fetchResumeModule(moduleId) {
  const { data, error } = await supabase
    .from('resume_modules')
    .select('*')
    .eq('id', moduleId)
    .single();

  if (error) {
    console.error('Error fetching resume module:', error);
    throw error;
  }

  return data;
}

/**
 * Create a new resume module
 * @param {Object} module - Module data (type, content)
 * @returns {Promise<Object>} Created module
 */
export async function createResumeModule(module) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('resume_modules')
    .insert([{
      user_id: user.id,
      type: module.type,
      content: module.content
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating resume module:', error);
    throw error;
  }

  return data;
}

/**
 * Update a resume module
 * @param {string} moduleId - UUID of the module
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated module
 */
export async function updateResumeModule(moduleId, updates) {
  const { data, error } = await supabase
    .from('resume_modules')
    .update(updates)
    .eq('id', moduleId)
    .select()
    .single();

  if (error) {
    console.error('Error updating resume module:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a resume module
 * @param {string} moduleId - UUID of the module
 * @returns {Promise<void>}
 */
export async function deleteResumeModule(moduleId) {
  const { error } = await supabase
    .from('resume_modules')
    .delete()
    .eq('id', moduleId);

  if (error) {
    console.error('Error deleting resume module:', error);
    throw error;
  }
}

/**
 * Batch create multiple modules
 * @param {Array} modules - Array of module objects
 * @returns {Promise<Array>} Created modules
 */
export async function batchCreateModules(modules) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const modulesWithUserId = modules.map(module => ({
    user_id: user.id,
    type: module.type,
    content: module.content
  }));

  const { data, error } = await supabase
    .from('resume_modules')
    .insert(modulesWithUserId)
    .select();

  if (error) {
    console.error('Error batch creating modules:', error);
    throw error;
  }

  return data;
}

// ========================================
// Version-Module Links
// ========================================

/**
 * Fetch modules for a specific resume version
 * @param {string} versionId - UUID of the resume version
 * @returns {Promise<Array>} Array of modules with display order
 */
export async function fetchVersionModules(versionId) {
  const { data, error } = await supabase
    .from('version_modules')
    .select(`
      display_order,
      module_id,
      resume_modules (*)
    `)
    .eq('version_id', versionId)
    .order('display_order');

  if (error) {
    console.error('Error fetching version modules:', error);
    throw error;
  }

  // Flatten the structure
  return data.map(item => ({
    ...item.resume_modules,
    display_order: item.display_order
  }));
}

/**
 * Add a module to a resume version
 * @param {string} versionId - UUID of the resume version
 * @param {string} moduleId - UUID of the module
 * @param {number} displayOrder - Order position
 * @returns {Promise<Object>} Created link
 */
export async function addModuleToVersion(versionId, moduleId, displayOrder) {
  const { data, error } = await supabase
    .from('version_modules')
    .insert([{
      version_id: versionId,
      module_id: moduleId,
      display_order: displayOrder
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding module to version:', error);
    throw error;
  }

  return data;
}

/**
 * Remove a module from a resume version
 * @param {string} versionId - UUID of the resume version
 * @param {string} moduleId - UUID of the module
 * @returns {Promise<void>}
 */
export async function removeModuleFromVersion(versionId, moduleId) {
  const { error } = await supabase
    .from('version_modules')
    .delete()
    .eq('version_id', versionId)
    .eq('module_id', moduleId);

  if (error) {
    console.error('Error removing module from version:', error);
    throw error;
  }
}

/**
 * Update module order in a resume version
 * @param {string} versionId - UUID of the resume version
 * @param {Array} moduleOrders - Array of {module_id, display_order}
 * @returns {Promise<void>}
 */
export async function updateModuleOrder(versionId, moduleOrders) {
  // Delete existing links
  await supabase
    .from('version_modules')
    .delete()
    .eq('version_id', versionId);

  // Insert new links with updated order
  const links = moduleOrders.map(item => ({
    version_id: versionId,
    module_id: item.module_id,
    display_order: item.display_order
  }));

  const { error } = await supabase
    .from('version_modules')
    .insert(links);

  if (error) {
    console.error('Error updating module order:', error);
    throw error;
  }
}

/**
 * Batch add modules to a version
 * @param {string} versionId - UUID of the resume version
 * @param {Array} moduleIds - Array of module UUIDs
 * @returns {Promise<Array>} Created links
 */
export async function batchAddModulesToVersion(versionId, moduleIds) {
  const links = moduleIds.map((moduleId, index) => ({
    version_id: versionId,
    module_id: moduleId,
    display_order: index
  }));

  const { data, error } = await supabase
    .from('version_modules')
    .insert(links)
    .select();

  if (error) {
    console.error('Error batch adding modules to version:', error);
    throw error;
  }

  return data;
}

// ========================================
// Application Integration
// ========================================

/**
 * Link a resume version to an application
 * @param {number} applicationId - ID of the application
 * @param {string} versionId - UUID of the resume version
 * @returns {Promise<Object>} Updated application
 */
export async function linkResumeToApplication(applicationId, versionId) {
  const { data, error } = await supabase
    .from('applications')
    .update({ resume_version_id: versionId })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    console.error('Error linking resume to application:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch applications with their linked resume versions
 * @returns {Promise<Array>} Applications with resume version data
 */
export async function fetchApplicationsWithResumes() {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      resume_versions (
        id,
        name,
        template_id,
        updated_at
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching applications with resumes:', error);
    throw error;
  }

  return data;
}
