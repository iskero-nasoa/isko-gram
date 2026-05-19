import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directories exist
const uploadDirs = ["uploads/images", "uploads/videos", "uploads/avatars", "uploads/audio"];
uploadDirs.forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = "uploads/";
    const baseMime = file.mimetype.split(";")[0].trim();
    if (baseMime.startsWith("image/")) {
      if (file.fieldname === "avatar") {
        dest = "uploads/avatars/";
      } else {
        dest = "uploads/images/";
      }
    } else if (baseMime.startsWith("video/")) {
      dest = "uploads/videos/";
    } else if (baseMime.startsWith("audio/")) {
      dest = "uploads/audio/";
    }
    cb(null, path.join(process.cwd(), dest));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/")) {
    const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (validImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid image type. Only JPEG, PNG, GIF, and WEBP are allowed."));
    }
  } else if (file.mimetype.startsWith("audio/")) {
    const baseMime = file.mimetype.split(";")[0].trim();
    const validAudioTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac"];
    if (validAudioTypes.includes(baseMime)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid audio type."));
    }
  } else {
    cb(new Error("Invalid file type. Only images, videos and audio are allowed."));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    // We'll set a generic upper bound limit, and check specific limits in the route
    fileSize: 50 * 1024 * 1024, // 50 MB max overall
  },
});
