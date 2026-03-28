import dns from "node:dns/promises";
import nodemailer from "nodemailer";

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SMTP_SECURE = true;

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

const shouldRetryMailSend = (error) => {
  if (process.env.SMTP_HOST_IP) {
    return false;
  }

  return ["ESOCKET", "ECONNECTION", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH"].includes(
    error?.code
  );
};

export const sendMail = async (mailOptions) => {
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

export const resetMailTransport = () => {
  transporterPromise = undefined;
};
