import express from "express";
import multer from "multer";
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import Application from "../models/Application.js";
import cloudinary from "../config/cloudinary.js";
import { sendAcceptanceMail } from "../utils/sendMail.js";
import jwt from "jsonwebtoken";

const router = express.Router();

/* FILE UPLOAD CONFIG */
const upload = multer({ dest: "uploads/" });

/* PDF TEXT EXTRACTION FUNCTION */
async function extractTextFromPDF(filePath) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data });

    const pdf = await loadingTask.promise;
    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);

      text += strings
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/[^\w\s.,]/g, "") + "\n";
    }

    return text.trim();

  } catch (error) {
    console.error("PDF Extraction Error:", error);
    return "";
  }
}

/* ================= APPLY JOB ================= */

router.post("/apply", upload.single("resume"), async (req, res) => {
  try {

    const { name, phone, role } = req.body;

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    if (!req.file) {
      return res.status(400).json({
        message: "Resume required"
      });
    }

    const extractedText = await extractTextFromPDF(req.file.path);

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "raw",
      folder: "hiremate_resumes",
      use_filename: true,
      unique_filename: false
    });

    const application = new Application({
      name,
      email,
      phone,
      role,
      resumeName: req.file.originalname,
      resumeUrl: result.secure_url,
      text: extractedText,
      atsScore: 0,
      status: "APPLIED",
      rejectionReason: ""
    });

    await application.save();

    fs.unlinkSync(req.file.path);

    res.json({
      message: "Application submitted successfully"
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({
      message: "Error uploading resume"
    });
  }
});

/* ================= GET ALL APPLICATIONS (HR / ADMIN) ================= */

router.get("/", async (req, res) => {
  try {
    const apps = await Application.find();
    res.json(apps);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error fetching applications"
    });
  }
});

/* ================= USER DASHBOARD ================= */

router.get("/my-applications", async (req, res) => {
  try {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const apps = await Application.find({
      email: decoded.email
    });

    res.json(apps);

  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({
      message: "Error fetching applications"
    });
  }
});

/* ================= UPDATE STATUS ================= */

router.put("/status/:id", async (req, res) => {
  try {

    const { status, rejectionReason } = req.body;

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      {
        status,
        rejectionReason: rejectionReason || ""
      },
      { new: true }
    );

    if (!updatedApplication) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    /* SEND MAIL IF ACCEPTED */

    let emailSent = false;

    if (status === "ACCEPTED") {
      try {
        const mailInfo = await sendAcceptanceMail(
          updatedApplication.email,
          updatedApplication.name
        );

        emailSent = true;
        console.log("Acceptance mail sent:", mailInfo.messageId);
      } catch (mailErr) {
        console.error("Mail sending failed:", mailErr);

        return res.status(500).json({
          message: "Status updated, but acceptance email failed to send",
          application: updatedApplication,
          emailSent
        });
      }
    }

    res.json({
      message: "Status updated successfully",
      application: updatedApplication,
      emailSent
    });

  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    res.status(500).json({
      message: "Status update failed"
    });
  }
});

/* ================= INTERVIEW SCHEDULING ================= */

router.put("/schedule/:id", async (req, res) => {
  try {

    const { interviewDate, interviewTime, interviewMode } = req.body;

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      {
        interviewDate,
        interviewTime,
        interviewMode
      },
      { new: true }
    );

    if (!updatedApplication) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    res.json({
      message: "Interview scheduled successfully",
      updatedApplication
    });

  } catch (err) {
    console.error("INTERVIEW SCHEDULE ERROR:", err);
    res.status(500).json({
      message: "Interview scheduling failed"
    });
  }
});

export default router;
