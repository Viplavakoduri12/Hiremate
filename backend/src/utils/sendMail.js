import { sendMail } from "../config/mail.js";

export const sendAcceptanceMail = async (to, name) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials are missing");
  }

  return sendMail({
    to,
    subject: "Application Accepted",
    text: `Congratulations ${name}. Your application has been accepted. Our team will contact you soon with the next steps.`,
    html: `
      <h2>Congratulations ${name}!</h2>
      <p>Your application has been accepted by HR.</p>
      <p>We will contact you soon with the next steps.</p>
    `
  });
};
