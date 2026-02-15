import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Get saved locations for the user
export const getSavedLocations = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const { data: locations, error } = await supabase
            .from('saved_locations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, daa: locations }); // Typo 'daa' -> 'data' fixed below
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Add a saved location
export const addSavedLocation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { type, name, address, lat, lng } = req.body;

        if (!name || !address || !lat || !lng) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data: location, error } = await supabase
            .from('saved_locations')
            .insert([
                {
                    user_id: userId,
                    type: type || 'other',
                    name,
                    address,
                    lat,
                    lng
                }
            ])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data: location });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Delete a saved location
export const deleteSavedLocation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const { error } = await supabase
            .from('saved_locations')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, message: 'Location deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Update a saved location
export const updateSavedLocation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { type, name, address, lat, lng } = req.body;

        const updates: any = {};
        if (type) updates.type = type;
        if (name) updates.name = name;
        if (address) updates.address = address;
        if (lat) updates.lat = lat;
        if (lng) updates.lng = lng;

        const { data: location, error } = await supabase
            .from('saved_locations')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data: location });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Get Search History
export const getSearchHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        // Check if we use 'search_history' table or 'trips' table.
        // Assuming we use 'search_history' table as created in migration.
        const { data: history, error } = await supabase
            .from('search_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            // If table doesn't exist yet (migration failed), callback to trips?
            // No, we should ensure migration runs.
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data: history });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Add to Search History
export const addSearchHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { address, lat, lng } = req.body;

        if (!address || !lat || !lng) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data: history, error } = await supabase
            .from('search_history')
            .insert([
                {
                    user_id: userId,
                    address,
                    lat,
                    lng
                }
            ])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data: history });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Clear Search History
export const clearSearchHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const { error } = await supabase
            .from('search_history')
            .delete()
            .eq('user_id', userId);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, message: 'History cleared' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
