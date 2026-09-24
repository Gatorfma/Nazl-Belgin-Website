/* Copy the Project URL and Publishable key from Supabase Project Settings → API.
 * The publishable key is designed for browser use; RLS protects the data.
 * Never place a service_role key in this file.
 */
window.NB_SUPABASE_CONFIG = Object.freeze({
  url: 'https://your-project-ref.supabase.co',
  publishableKey: 'your-publishable-key'
});
