import mongoose from "mongoose";
import { Application } from "../models/applicationModel.js";
import { Job } from "../models/jobModel.js";
import { User } from "../models/userModel.js";
import { SendApplicationAcceptedEmail, SendApplicationRejectedEmail } from "../mails/emailApi.js";

export const applyForJob = async (req, res) => {
  try {
    // Get candidate ID from token (set by VerifyToken middleware)
    const candidateId = req.user && req.user.userId;
    if (!candidateId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized. User not found." });
    }

    // Get the jobId from URL parameters
    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid job ID format." });
    }

    // Check that the job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res
        .status(404)
        .json({ success: false, message: "Job not found." });
    }

     // Add this check for job status
    if (!job.isOpen) {
      return res.status(400).json({ 
        success: false, 
        message: "This job is no longer accepting applications." 
      });
    }

    // Optionally check if the candidate has already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      applicant: candidateId,
    });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for this job.",
      });
    }

    // Retrieve candidate details from their profile
    const candidate = await User.findById(candidateId);
    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate not found." });
    }

    // Check if candidate profile is complete
    const profile = candidate.profile;
    const missingFields = [];

    if (!profile?.firstName?.trim()) {
      missingFields.push("First name");
    }
    if (!profile?.lastName?.trim()) {
      missingFields.push("Last name");
    }
    if (!profile?.skills?.length || !Array.isArray(profile.skills)) {
      missingFields.push("Skills");
    }
    if (!profile?.resume?.trim()) {
      missingFields.push("Resume");
    }

    if (missingFields.length > 0) {
      const errorMessage = `Please complete your profile by adding: ${missingFields.join(', ')}`;
      return res.status(400).json({
        success: false,
        message: errorMessage,
        missingFields // Optional: include array of missing fields in response
      });
    }

    // Get additional experience details from the request body
    const { experienceYears, experienceLevel } = req.body;
    if (experienceYears === undefined || !experienceLevel) {
      return res.status(400).json({
        success: false,
        message: "Please provide your experience years and experience level.",
      });
    }

    // Validate the provided experience level
    const allowedExperienceLevels = ["entry", "intermediate", "advanced", "expert"];
    if (!allowedExperienceLevels.includes(experienceLevel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid experience level.",
      });
    }

    // Create a new Application using candidate's profile information and provided experience details
    const application = new Application({
      job: jobId,
      applicant: candidateId,
      status: "pending",
      resume: candidate.profile.resume, // from candidate profile
      skills: candidate.profile.skills, // from candidate profile
      experienceYears,                  // from req.body
      experienceLevel,                  // from req.body
    });

    await application.save();

    // Update the job document's applications field
    job.applications.push(application._id);
    await job.save();

    return res.status(201).json({
      success: true,
      message: "Applied for job successfully.",
      application,
    });
  } catch (error) {
    console.error("Error applying for job:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while applying for the job.",
    });
  }
};

export const getJobApplications = async (req, res) => {
  try {
    // Get recruiter ID from token
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized. User not found." });
    }

    // Get jobId from URL parameters
    const { jobId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid job ID format." });
    }

    // Verify the job exists and that the recruiter is its owner
    const job = await Job.findById(jobId);
    if (!job) {
      return res
        .status(404)
        .json({ success: false, message: "Job not found." });
    }
    if (job.created_by.toString() !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view applications for this job.",
      });
    }

    // Retrieve all applications for the job and populate candidate details from their profile
    const applications = await Application.find({ job: jobId }).populate(
      "applicant",
      "profile" // This will return the entire profile object. Adjust as needed.
    );

    return res.status(200).json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error("Error retrieving job applications:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving job applications.",
    });
  }
};

export const acceptApplication = async (req, res) => {
  try {
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { id } = req.params; // Application ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid application ID format." });
    }

    // Find the application and populate job (with company) and applicant
    const application = await Application.findById(id)
      .populate({
        path: "job",
        populate: { path: "company" }
      })
      .populate("applicant");
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    // Verify that the recruiter is the owner of the job
    if (application.job.created_by.toString() !== recruiterId) {
      return res.status(403).json({ success: false, message: "You are not authorized to update this application." });
    }

    // Ensure the application is still pending
    if (["accepted", "rejected", "withdrawn"].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `This application has already been ${application.status}.`
      });
    }

    // Update the selected application to "accepted"
    application.status = "accepted";
    await application.save();

    // Send acceptance email
    const applicantName = `${application.applicant.profile.firstName} ${application.applicant.profile.lastName}`;
    const jobTitle = application.job.title;
    const companyName = application.job.company.name;
    try {
      await SendApplicationAcceptedEmail(application.applicant.email, applicantName, jobTitle, companyName);
    } catch (emailError) {
      console.error("Failed to send acceptance email:", emailError.message);
      // Continue execution even if email fails, logging the error
    }

    // Find and reject all other pending applications for the same job
    const pendingApplications = await Application.find({
      job: application.job._id,
      _id: { $ne: application._id },
      status: "pending"
    }).populate("applicant");

    if (pendingApplications.length > 0) {
      const applicationIds = pendingApplications.map(app => app._id);
      await Application.updateMany(
        { _id: { $in: applicationIds } },
        { status: "rejected" }
      );

      // Send rejection emails to other applicants
      for (const app of pendingApplications) {
        const rejectApplicantName = `${app.applicant.profile.firstName} ${app.applicant.profile.lastName}`;
        try {
          await SendApplicationRejectedEmail(app.applicant.email, rejectApplicantName, jobTitle, companyName);
        } catch (emailError) {
          console.error("Failed to send rejection email:", emailError.message);
          // Continue execution, logging the error
        }
      }
    }

    // Close the job posting
    const updatedJob = await Job.findByIdAndUpdate(
      application.job._id,
      { isOpen: false },
      { new: true }
    );
    if (!updatedJob) {
      console.error("Failed to close job after accepting application");
    }

    return res.status(200).json({
      success: true,
      message: "Application accepted. Job listing closed. All other pending applications have been rejected.",
      application,
    });
  } catch (error) {
    console.error("Error accepting application:", error);
    return res.status(500).json({ success: false, message: "An error occurred while processing the request." });
  }
};

export const rejectApplication = async (req, res) => {
  try {
    const recruiterId = req.user && req.user.userId;
    if (!recruiterId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { id } = req.params; // Application ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid application ID format." });
    }

    // Find the application and populate job (with company) and applicant
    const application = await Application.findById(id)
      .populate({
        path: "job",
        populate: { path: "company" }
      })
      .populate("applicant");
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    // Verify that the recruiter is the owner of the job
    if (application.job.created_by.toString() !== recruiterId) {
      return res.status(403).json({ success: false, message: "You are not authorized to update this application." });
    }

    // Ensure the application is still pending
    if (["accepted", "rejected", "withdrawn"].includes(application.status)) {
      return res.status(400).json({ success: false, message: "This application has already been processed." });
    }

    // Update the selected application to "rejected"
    application.status = "rejected";
    await application.save();

    // Send rejection email
    const applicantName = `${application.applicant.profile.firstName} ${application.applicant.profile.lastName}`;
    const jobTitle = application.job.title;
    const companyName = application.job.company.name;
    try {
      await SendApplicationRejectedEmail(application.applicant.email, applicantName, jobTitle, companyName);
    } catch (emailError) {
      console.error("Failed to send rejection email:", emailError.message);
      // Continue execution, logging the error
    }

    return res.status(200).json({
      success: true,
      message: "Application rejected.",
      application,
    });
  } catch (error) {
    console.error("Error rejecting application:", error);
    return res.status(500).json({ success: false, message: "An error occurred while processing the request." });
  }
};


export const getCandidateApplications = async (req, res) => {
  try {
    const candidateId = req.user && req.user.userId;
    if (!candidateId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User not found."
      });
    }

    const applications = await Application.find({ applicant: candidateId })
      .populate({
        path: "job",
        select: "title description location company",
        populate: { path: "company", select: "name" }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      applications
    });
  } catch (error) {
    console.error("Error fetching candidate applications:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching your applications."
    });
  }
};


export const withdrawApplication = async (req, res) => {
  try {
    const candidateId = req.user && req.user.userId;
    if (!candidateId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const { id } = req.params; // Application ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid application ID format." });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    if (application.applicant.toString() !== candidateId) {
      return res.status(403).json({ success: false, message: "You are not authorized to withdraw this application." });
    }

    // Allow withdrawal only if the application is still pending
    if (application.status !== "pending") {
      return res.status(400).json({ success: false, message: "This application cannot be withdrawn." });
    }

    // Update the application status to "withdrawn"
    application.status = "withdrawn";
    // Set expiresAt to 1 hour from now
    application.expiresAt = new Date(Date.now() + 3600 * 1000);
    await application.save();

    return res.status(200).json({
      success: true,
      message: "Application withdrawn successfully. It will be deleted after 1 hour.",
      application,
    });
  } catch (error) {
    console.error("Error withdrawing application:", error);
    return res.status(500).json({ success: false, message: "An error occurred while processing the request." });
  }
};