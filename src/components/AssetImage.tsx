import React, { useMemo } from 'react';
import { Asset, AssetRequestType } from '../lib/supabase';
import { MonitorIcon } from 'lucide-react';

interface AssetImageProps {
    asset?: Asset;
    assetType?: AssetRequestType;
    className?: string;
}

const AssetImage: React.FC<AssetImageProps> = ({ asset, assetType, className = "w-full h-full object-cover" }) => {
    const getImageUrl = (data: any, type: string | null) => {
        if (!data || !type) return null;

        try {
            // Handle different formats that binary data might come in (Buffer object from JSON or Array)
            let uint8Array: Uint8Array;

            if (data.type === 'Buffer' && Array.isArray(data.data)) {
                uint8Array = new Uint8Array(data.data);
            } else if (Array.isArray(data)) {
                uint8Array = new Uint8Array(data);
            } else if (data instanceof Uint8Array) {
                uint8Array = data;
            } else {
                return null;
            }

            const blob = new Blob([uint8Array], { type: type || 'image/png' });
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('Error creating image URL:', error);
            return null;
        }
    };

    const imageUrl = useMemo(() => {
        // 1. Try Custom Asset Image
        let url = getImageUrl(asset?.image_data, asset?.image_type || null);
        if (url) return url;

        // 2. Try Default Type Image
        url = getImageUrl(assetType?.image_data, assetType?.image_type || null);
        if (url) return url;

        return null;
    }, [asset?.image_data, asset?.image_type, assetType?.image_data, assetType?.image_type]);

    // Cleanup effect for createObjectURL would be good, but for now we'll rely on browser or manual logic
    // In a more complex app, we'd use a custom hook to manage these URLs

    if (imageUrl) {
        return <img src={imageUrl} alt={asset?.name || 'Asset'} className={className} />;
    }

    return (
        <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}>
            <MonitorIcon className="w-1/2 h-1/2 text-gray-400" />
        </div>
    );
};

export default AssetImage;
