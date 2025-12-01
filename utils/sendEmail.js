const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM; // <- verified domain

const sendEmail = async (to, subject, html) => {
  try {
    console.log("📨 Sending email...");
    console.log("FROM:", FROM_EMAIL);
    console.log("TO:", to);

    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    console.log("📩 RESEND RESPONSE:", response);
    return response;
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    throw new Error("Email could not be sent");
  }
};

module.exports = sendEmail;
