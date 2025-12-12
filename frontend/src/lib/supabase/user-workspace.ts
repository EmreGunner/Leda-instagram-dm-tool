import { createClient } from './server';
import type { Database } from '@/types/database';

type Workspace = Database['public']['Tables']['workspaces']['Row'];
type User = Database['public']['Tables']['users']['Row'];

/**
 * Get the current user's workspace
 * Returns null if user is not authenticated or has no workspace
 */
export async function getUserWorkspace(): Promise<Workspace | null> {
  const supabase = await createClient();
  
  // Get current authenticated user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    return null;
  }

  // Get user record from users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('workspace_id, workspace:workspaces(*)')
    .eq('supabase_auth_id', authUser.id)
    .single();

  if (userError || !user) {
    return null;
  }

  return (user.workspace as Workspace) || null;
}

/**
 * Get the current user's workspace ID
 * Returns null if user is not authenticated or has no workspace
 */
export async function getUserWorkspaceId(): Promise<string | null> {
  const workspace = await getUserWorkspace();
  return workspace?.id || null;
}

/**
 * Get the current authenticated user record
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    return null;
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_auth_id', authUser.id)
    .single();

  if (userError || !user) {
    return null;
  }

  return user;
}

/**
 * Create a workspace for a new user
 * Called during signup
 */
export async function createUserWorkspace(
  supabaseAuthId: string,
  email: string,
  name?: string
): Promise<{ workspace: Workspace; user: User } | null> {
  const supabase = await createClient();
  
  // Create workspace
  const workspaceSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name: name || email.split('@')[0],
      slug: workspaceSlug,
    })
    .select()
    .single();

  if (workspaceError || !workspace) {
    console.error('Error creating workspace:', workspaceError);
    return null;
  }

  // Create user record linked to workspace
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      supabase_auth_id: supabaseAuthId,
      workspace_id: workspace.id,
      name: name || null,
      role: 'OWNER',
    })
    .select()
    .single();

  if (userError || !user) {
    console.error('Error creating user:', userError);
    // Cleanup workspace if user creation fails
    await supabase.from('workspaces').delete().eq('id', workspace.id);
    return null;
  }

  return { workspace, user };
}

