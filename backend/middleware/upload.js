import multer from 'multer';

// Use memory storage to store file in buffer
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];

    console.log('DEBUG: Multer fileFilter processing:', file.originalname, file.mimetype);
    if (allowedTypes.includes(file.mimetype)) {
        console.log('DEBUG: File accepted');
        cb(null, true);
    } else {
        console.log('DEBUG: File rejected due to type');
        cb(new Error('Invalid file type. Only images, PDF, DOC, and TXT files are allowed.'), false);
    }
};

// Configure upload middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 5 // Max 5 files
    }
});

export default upload;
