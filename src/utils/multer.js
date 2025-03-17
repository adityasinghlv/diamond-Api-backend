const fs = require('fs');
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, `../public/${req.body.typename}`);
        // Ensure the directory exists, create it if it doesn't
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);  // Set the destination path
    },
    filename: function (req, file, cb) {
        const fileExtension = file.originalname.split('.').pop();
        const filename = `${Date.now()}.${fileExtension}`;
        cb(null, filename);  // Set the filename
    }
});

const upload = multer({
    storage: storage
});

module.exports = upload;
