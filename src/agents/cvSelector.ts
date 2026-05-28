import { supabase } from '../supabaseClient'
import type { CVVersion } from './types'

export async function selectCV(track: 'ux' | 'pm' | 'devrel', userId: string): Promise<CVVersion> {
  const { data, error } = await supabase
    .from('cv_versions')
    .select('*')
    .eq('track', track)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error(
      `CV version not found for track "${track}". ` +
      `Please set up your CV data in Settings before generating documents.`
    )
  }

  return data as CVVersion
}
