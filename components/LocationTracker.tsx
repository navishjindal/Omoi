import React, { useState } from 'react';
import { MapPin, Loader2, MapPinOff } from 'lucide-react';

export const LocationTracker: React.FC = () => {
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleLocation = () => {
        if (location || loading) {
            // Turn OFF
            setLocation(null);
            setLoading(false);
            setError(null);
        } else {
            // Turn ON
            setLoading(true);
            setError(null);

            if (!navigator.geolocation) {
                setError('Geolocation not supported');
                setLoading(false);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                    setLoading(false);
                },
                (err) => {
                    setError('Unable to retrieve location');
                    setLoading(false);
                    console.error(err);
                }
            );
        }
    };

    const isActive = !!location;

    let title = "Enable Location";
    if (loading) title = "Fetching location...";
    if (error) title = error;
    if (location) title = `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`;

    return (
        <button
            onClick={toggleLocation}
            className={`
        flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-bold
        ${isActive
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }
        ${error ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : ''}
      `}
            title={title}
        >
            {loading ? (
                <Loader2 size={20} className="animate-spin" />
            ) : isActive ? (
                <MapPin size={20} />
            ) : (
                <MapPinOff size={20} />
            )}
            <span className="hidden md:inline">
                {loading ? 'Locating...' : isActive ? 'Location On' : 'Location Off'}
            </span>
        </button>
    );
};
