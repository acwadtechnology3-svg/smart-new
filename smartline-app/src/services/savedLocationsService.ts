import { apiRequest } from './backend';

export interface SavedLocation {
    id?: string;
    type: 'home' | 'work' | 'favorite' | 'other';
    name: string;
    address: string;
    lat: number;
    lng: number;
}

export interface SearchHistoryItem {
    id: string;
    address: string;
    lat: number;
    lng: number;
    created_at: string;
}

export const getSavedLocations = async (): Promise<SavedLocation[]> => {
    const response = await apiRequest<{ success: boolean; data?: SavedLocation[]; daa?: SavedLocation[] }>('/saved-locations');
    return response.data || response.daa || [];
};

export const addSavedLocation = async (location: SavedLocation): Promise<SavedLocation> => {
    const response = await apiRequest<{ success: boolean; data: SavedLocation }>('/saved-locations', {
        method: 'POST',
        body: JSON.stringify(location),
    });
    return response.data;
};

export const updateSavedLocation = async (id: string, location: Partial<SavedLocation>): Promise<SavedLocation> => {
    const response = await apiRequest<{ success: boolean; data: SavedLocation }>('/saved-locations/' + id, {
        method: 'PUT',
        body: JSON.stringify(location),
    });
    return response.data;
};

export const deleteSavedLocation = async (id: string): Promise<boolean> => {
    const response = await apiRequest<{ success: boolean }>('/saved-locations/' + id, {
        method: 'DELETE',
    });
    return response.success;
};

export const getSearchHistory = async (): Promise<SearchHistoryItem[]> => {
    const response = await apiRequest<{ success: boolean; data: SearchHistoryItem[] }>('/saved-locations/history');
    return response.data || [];
};

export const addSearchHistory = async (address: string, lat: number, lng: number): Promise<SearchHistoryItem> => {
    const response = await apiRequest<{ success: boolean; data: SearchHistoryItem }>('/saved-locations/history', {
        method: 'POST',
        body: JSON.stringify({ address, lat, lng }),
    });
    return response.data;
};

export const clearSearchHistory = async (): Promise<boolean> => {
    const response = await apiRequest<{ success: boolean }>('/saved-locations/history', {
        method: 'DELETE',
    });
    return response.success;
};
