import dns from "node:dns/promises";
import nodemailer from "nodemailer";

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SMTP_SECURE = true;
const RESEND_API_URL = "https://api.resend.com/emails";

let transporterPromise;

const parseBoolean = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const resolveSmtpConnection = async () => {
  const host = (process.env.SMTP_HOST || DEFAULT_SMTP_HOST).trim();
  const manualIp = (process.env.SMTP_HOST_IP || "").trim();
  const servername = (process.env.SMTP_TLS_SERVERNAME || host).trim();

  if (manualIp) {
    return { host: manualIp, servername };
  }

  try {
    const ipv4Addresses = await dns.resolve4(host);

    if (ipv4Addresses.length > 0) {
      return { host: ipv4Addresses[0], servername };
    }
  } catch (error) {
    console.warn(`SMTP IPv4 lookup failed for ${host}: ${error.message}`);
  }

  return { host, servername };
};

const createTransport = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials are missing");
  }

  const { host, servername } = await resolveSmtpConnection();
  const port = Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT);
  const secure = parseBoolean(process.env.SMTP_SECURE, DEFAULT_SMTP_SECURE);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      servername,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 60_000,
  });
};

export const getMailTransport = async () => {
  if (!transporterPromise) {
    transporterPromise = createTransport().catch((error) => {
      transporterPromise = undefined;
      throw error;
    });
  }

  return transporterPromise;
};

const resolveMailProvider = () => {
  const configuredProvider = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();

  if (configuredProvider) {
    return configuredProvider;
  }

  if (process.env.RESEND_API_KEY) {
    return "resend";
  }

  return "smtp";
};

const assertSupportedMailConfiguration = (provider) => {
  if (provider === "smtp" && process.env.RENDER === "true") {
    const error = new Error(
      "SMTP is blocked on Render. Configure EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM."
    );
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
};

const shouldRetryMailSend = (error) => {
  if (process.env.SMTP_HOST_IP) {
    return false;
  }

  return ["ESOCKET", "ECONNECTION", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH"].includes(
    error?.code
  );
};

const sendMailWithSmtp = async (mailOptions) => {
  const message = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    ...mailOptions,
  };

  try {
    const transporter = await getMailTransport();
    return await transporter.sendMail(message);
  } catch (error) {
    if (!shouldRetryMailSend(error)) {
      throw error;
    }

    resetMailTransport();
    const transporter = await getMailTransport();
    return transporter.sendMail(message);
  }
};

const sendMailWithResend = async (message) => {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error("RESEND_API_KEY is missing");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const from = process.env.EMAIL_FROM || message.from;

  if (!from) {
    const error = new Error("EMAIL_FROM is required when using Resend");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const payload = {
    from,
    to: Array.isArray(message.to) ? message.to : [message.to],
    subject: message.subject,
  };

  if (message.text !== undefined) {
    payload.text = message.text;
  }

  if (message.html !== undefined) {
    payload.html = message.html;
  }

  if (message.cc) {
    payload.cc = Array.isArray(message.cc) ? message.cc : [message.cc];
  }

  if (message.bcc) {
    payload.bcc = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
  }

  const replyTo = process.env.EMAIL_REPLY_TO || message.replyTo;
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  let response;

  try {
    response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    error.code = "EMAIL_API_ERROR";
    throw error;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      data?.message || data?.error?.message || `Resend API request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    error.code = "EMAIL_API_ERROR";
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return {
    messageId: data?.id,
    provider: "resend",
    raw: data,
  };
};

export const sendMail = async (mailOptions) => {
  const provider = resolveMailProvider();
  assertSupportedMailConfiguration(provider);
  const message = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    ...mailOptions,
  };

  if (provider === "resend") {
    return sendMailWithResend(message);
  }

  return sendMailWithSmtp(message);
};

export const resetMailTransport = () => {
  transporterPromise = undefined;
};
