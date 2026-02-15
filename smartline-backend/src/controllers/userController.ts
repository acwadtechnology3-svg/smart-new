import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

const PROFILE_PHOTO_PERMISSION_PREFIX = 'profile_photo_url:';

function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);
}

function extractProfilePhotoFromPermissions(input: unknown): string | null {
  const permissions = normalizePermissions(input);
  const entry = permissions.find((item) => item.startsWith(PROFILE_PHOTO_PERMISSION_PREFIX));
  if (!entry) return null;
  const value = entry.slice(PROFILE_PHOTO_PERMISSION_PREFIX.length).trim();
  return value.length > 0 ? value : null;
}

function setProfilePhotoInPermissions(input: unknown, profilePhotoUrl: string | null): string[] {
  const permissions = normalizePermissions(input).filter(
    (item) => !item.startsWith(PROFILE_PHOTO_PERMISSION_PREFIX)
  );
  const value = String(profilePhotoUrl || '').trim();
  if (value) {
    permissions.push(`${PROFILE_PHOTO_PERMISSION_PREFIX}${value}`);
  }
  return permissions;
}

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check if user has any active trips
    const { data: activeTrips, error: tripError } = await supabase
      .from('trips')
      .select('id')
      .or(`customer_id.eq.${userId},driver_id.eq.${userId}`)
      .in('status', ['requested', 'accepted', 'arrived', 'started']);

    if (tripError) {
      return res.status(500).json({ error: 'Failed to check active trips' });
    }

    if (activeTrips && activeTrips.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete account while you have active trips. Please complete or cancel them first.' 
      });
    }

    // Soft delete - mark user as deleted
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        deleted_at: new Date().toISOString(),
        phone: `deleted_${Date.now()}_${userId}`, // Anonymize phone
        full_name: 'Deleted User',
        email: null
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to soft delete user:', updateError);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    // Optionally delete auth user (requires admin privileges)
    // const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err: any) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch user details
    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone, full_name, email, role, balance, created_at, permissions')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is a driver or just to be safe, try to fetch driver profile photo
    let profile_photo_url = extractProfilePhotoFromPermissions(user.permissions);
    if (user.role === 'driver') {
      const { data: driver } = await supabase
        .from('drivers')
        .select('profile_photo_url')
        .eq('id', userId)
        .single();

      if (driver?.profile_photo_url) {
        profile_photo_url = driver.profile_photo_url;
      }
    }

    // Combine data
    const { permissions: _permissions, ...safeUser } = user as any;
    const responseData = {
      ...safeUser,
      profile_photo_url
    };

    res.json({ user: responseData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { full_name, email, preferences, profile_photo_url } = req.body;

    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('role, permissions')
      .eq('id', userId)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates: any = {};
    if (full_name) updates.full_name = full_name;
    if (email) updates.email = email;
    if (preferences) updates.preferences = preferences;
    if (profile_photo_url !== undefined) {
      updates.permissions = setProfilePhotoInPermissions(currentUser.permissions, profile_photo_url);
    }

    // Update 'users' table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    // Keep driver profile photo in sync for driver accounts.
    if (profile_photo_url !== undefined && currentUser.role === 'driver') {
      const { error: driverError } = await supabase
        .from('drivers')
        .update({ profile_photo_url })
        .eq('id', userId); // Assuming drivers table uses same ID as users (from auth.users/public.users)

      if (driverError) {
        console.error('Failed to update driver photo:', driverError);
        // We don't fail the whole request, but logging it is important
      }
    }

    const { permissions: _permissions, ...safeUserData } = userData as any;
    const responseUser = {
      ...safeUserData,
      profile_photo_url: profile_photo_url !== undefined
        ? (profile_photo_url || null)
        : extractProfilePhotoFromPermissions(userData?.permissions)
    };

    res.json({ success: true, user: responseUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
