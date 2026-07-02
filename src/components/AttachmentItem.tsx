import React, { useState, useEffect } from 'react';
import { TagIcon } from 'lucide-react';

interface AttachmentItemProps {
    file: any;
    onPreview: (imageUrl: string, fileName: string) => void;
}

const AttachmentItem: React.FC<AttachmentItemProps> = ({ file, onPreview }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (file.file_type?.includes('image') && !imageUrl) {
            fetchImage();
        }
    }, [file]);

    const fetchImage = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/issues/attachments/${file.id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            if (response.ok) {
                const blob = await response.blob();
                setImageUrl(URL.createObjectURL(blob));
            }
        } catch (e) {
            console.error('Failed to load image', e);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (file.file_type?.includes('image')) {
            if (imageUrl) {
                onPreview(imageUrl, file.file_name);
            }
            return;
        }

        // For non-images, download/open in new tab
        try {
            const response = await fetch(`/api/issues/attachments/${file.id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.file_name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="group relative">
            <a
                href="#"
                onClick={handleClick}
                className={`block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors ${file.file_type?.includes('image') ? 'aspect-video' : 'p-3 flex items-center'
                    }`}
            >
                {file.file_type?.includes('image') ? (
                    <>
                        {loading ? (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={file.file_name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                                <span className="text-xs">Failed to load</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </>
                ) : (
                    <div className="flex items-center w-full">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                            <TagIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={file.file_name}>
                                {file.file_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.file_size / 1024).toFixed(1)} KB
                            </p>
                        </div>
                    </div>
                )}
            </a>
        </div>
    );
};

export default AttachmentItem;
