import React from 'react';
import { XIcon, DownloadIcon } from 'lucide-react';

interface ImagePreviewModalProps {
    isOpen: boolean;
    imageUrl: string | null;
    fileName: string;
    onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, imageUrl, fileName, onClose }) => {
    if (!isOpen || !imageUrl) return null;

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
            <div className="absolute top-4 right-4 flex space-x-4">
                <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    title="Download Image"
                >
                    <DownloadIcon className="w-6 h-6" />
                </button>
                <button
                    onClick={onClose}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    title="Close Preview"
                >
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="max-w-[90vw] max-h-[90vh] overflow-hidden rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <img
                    src={imageUrl}
                    alt={fileName}
                    className="w-full h-full object-contain max-h-[90vh]"
                />
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <p className="text-white/80 text-sm font-medium px-4 inline-block bg-black/50 rounded-full py-1">
                    {fileName}
                </p>
            </div>
        </div>
    );
};

export default ImagePreviewModal;
