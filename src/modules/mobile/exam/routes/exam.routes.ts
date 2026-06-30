import { Router } from "express";
import multer from "multer";
import { authenticateMobileStudent } from "../../auth/middleware/authenticate";
import * as controller from "../controller/exam.controller";

const router = Router();
const uploadInMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(authenticateMobileStudent);

router.get("/my-upcoming", controller.getMyUpcomingExams);
router.get("/:id/result", controller.getStudentExamResult);
router.get("/:id/questions", controller.getStudentQuestions);
router.post("/:id/submit", controller.submitExam);
router.post(
  "/upload-file",
  uploadInMemory.single("file"),
  controller.uploadFileToCloudinary
);

export default router;
