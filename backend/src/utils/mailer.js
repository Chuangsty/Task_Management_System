import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendTaskForReviewEmail({ to, projectLeadName, developerName, taskId, taskName, planName }) {
  const defaultEmail = process.env.SEED_ADMIN_EMAIL;

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: defaultEmail,
    subject: `Task submitted for review: ${taskName}`,
    text: `
        Hi ${projectLeadName},
        
        A task has been submitted for your review.

        Task ID: ${taskId}
        Task Name: ${taskName}
        Plan: ${planName || "No plan"}
        Submitted by: ${developerName}

        Please log in to the Task Management System to approve or reject the task.
        `.trim(),
  });
}
